import { mathPartsToLatex } from './ProblemDocument.js';
import { createInkMap, layoutDiagramLabels } from './DiagramExportLayout.js';

// A point name is a geometric label, not an algebraic variable. Keep the
// distinction in the payload so the native equation stays upright in Hancom.
export function toHwpEquationLabel(value, { italic = false } = {}) {
    const text = String(value ?? '');
    return !italic && /^[A-Z]+(?:['′]+)?$/.test(text) ? `\\mathrm{${text}}` : text;
}

// The PNG contains geometry only; every label becomes an editable HWP equation.
export function captureHwpDiagram(app, { widthMm = 80, includeAxes = true, includePreview = false } = {}) {
    if (!Number.isFinite(widthMm) || widthMm < 40 || widthMm > 160) throw new Error('그림 폭은 40~160 mm로 설정해 주세요.');
    const width = app.canvas.width;
    const height = app.canvas.height;
    if (width < 1 || height < 1) throw new Error('그래프 작업판을 먼저 열어 주세요.');
    const target = document.createElement('canvas');
    const ctx = target.getContext('2d');
    const labels = [];
    const originalFillText = ctx.fillText;
    const originalSink = app.canvas.exportTextSink;
    let collecting = true;
    const push = label => {
        if (!collecting || !label.text?.trim()) return;
        if (labels.length >= 300) throw new Error('그림의 라벨이 너무 많습니다. 축 눈금을 줄이거나 그림 범위를 좁혀 주세요.');
        const transform = ctx.getTransform();
        if (Math.abs(transform.b) > .001 || Math.abs(transform.c) > .001) {
            throw new Error('회전된 글자가 있습니다. 글자 방향을 가로로 바꾼 뒤 한글에 넣어 주세요.');
        }
        const x = transform.a * label.x + transform.e;
        const y = transform.d * label.y + transform.f;
        if (x >= width || y >= height || x + label.width < 0 || y + label.fontSize < 0) return;
        labels.push({ ...label, x, y });
    };
    ctx.fillText = function(text, x, y) {
        if (!collecting) return;
        const value = String(text);
        const fontSize = Number(/([\d.]+)px/.exec(this.font)?.[1]) || 14;
        const textWidth = this.measureText(value).width;
        const left = x - (this.textAlign === 'center' ? textWidth / 2 : ['right', 'end'].includes(this.textAlign) ? textWidth : 0);
        const top = y - (['bottom', 'alphabetic', 'ideographic'].includes(this.textBaseline) ? fontSize : this.textBaseline === 'middle' ? fontSize / 2 : 0);
        const italic = /\b(?:italic|oblique)\b/.test(this.font);
        // Preserve drawLabel's roman default and explicit italic setting.
        // Formula labels use exportTextSink, which retains math styling.
        const equation = toHwpEquationLabel(value, { italic });
        const font = !italic && /^[a-z]$/.test(value) ? `italic ${this.font}` : this.font;
        push({ text: equation, displayText: value, font, color: this.fillStyle, x: left, y: top, fontSize, width: textWidth });
    };
    app.canvas.exportTextSink = label => push({
        ...label, text: mathPartsToLatex(label.parts),
        height: label.fontSize * (label.parts.some(part => part.type === 'fraction') ? 2 : 1.35)
    });
    try {
        app.renderSceneToCanvas(target, { scale: 1, includeBackground: true, includeGrid: false, includeAxes });
        const layout = layoutDiagramLabels(createInkMap(ctx.getImageData(0, 0, width, height)), labels, { width, height });
        const { crop } = layout;
        collecting = false;
        // Render only the cropped region at print resolution.
        const scale = Math.max(1, widthMm / 25.4 * 300 / crop.width);
        app.renderSceneToCanvas(target, { scale, crop, includeBackground: true, includeGrid: false, includeAxes });
        const result = {
            png: target.toDataURL('image/png'), widthMm, aspect: crop.height / crop.width,
            labels: layout.labels.map(label => ({
                text: label.text, x: (label.x - crop.x) / crop.width, y: (label.y - crop.y) / crop.width,
                fontSize: label.fontSize / crop.width, width: label.box.width / crop.width
            }))
        };
        if (includePreview) {
            ctx.fillText = originalFillText;
            app.canvas.exportTextSink = null;
            ctx.save();
            ctx.scale(scale, scale);
            ctx.translate(-crop.x, -crop.y);
            for (const label of layout.labels) {
                if (label.parts) app.canvas.renderMathExpression(label.parts, ctx, label.x, label.y + label.fontSize, label.fontSize, label.color);
                else {
                    ctx.font = label.font;
                    ctx.fillStyle = label.color;
                    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
                    ctx.fillText(label.displayText, label.x, label.y + label.fontSize);
                }
            }
            ctx.restore();
            result.preview = target.toDataURL('image/png');
        }
        return result;
    } finally {
        ctx.fillText = originalFillText;
        app.canvas.exportTextSink = originalSink;
    }
}
