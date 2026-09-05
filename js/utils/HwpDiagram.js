import { mathPartsToLatex } from './ProblemDocument.js';

// Render the actual scene, separating every label from the drawing. The bridge
// inserts these labels as native Hancom equation controls at the same positions.
export function captureHwpDiagram(app, { widthMm = 80, includeAxes = true } = {}) {
    if (!Number.isFinite(widthMm) || widthMm < 40 || widthMm > 160) throw new Error('그림 폭은 40~160 mm로 설정해 주세요.');
    const width = app.canvas.width;
    const height = app.canvas.height;
    if (width < 1 || height < 1) throw new Error('그래프 작업판을 먼저 열어 주세요.');
    const target = document.createElement('canvas');
    const ctx = target.getContext('2d');
    const labels = [];
    const scale = Math.max(1, Math.min(4, widthMm / 25.4 * 300 / width));
    const originalFillText = ctx.fillText;
    const originalSink = app.canvas.exportTextSink;
    const push = label => {
        if (!label.text?.trim()) return;
        if (labels.length >= 300) throw new Error('그림의 라벨이 너무 많습니다. 축 눈금을 줄이거나 그림 범위를 좁혀 주세요.');
        const transform = ctx.getTransform();
        if (Math.abs(transform.b) > .001 || Math.abs(transform.c) > .001) {
            throw new Error('회전된 글자가 있습니다. 글자 방향을 가로로 바꾼 뒤 한글에 넣어 주세요.');
        }
        const x = (transform.a * label.x + transform.e) / scale;
        const y = (transform.d * label.y + transform.f) / scale;
        if (x >= width || y >= height || x + label.width < 0 || y + label.fontSize < 0) return;
        labels.push({
            text: label.text, x: Math.max(0, x) / width, y: Math.max(0, y) / width,
            fontSize: label.fontSize / width, width: label.width / width
        });
    };
    ctx.fillText = function(text, x, y) {
        const fontSize = Number(/([\d.]+)px/.exec(this.font)?.[1]) || 14;
        const textWidth = this.measureText(String(text)).width;
        const left = x - (this.textAlign === 'center' ? textWidth / 2 : ['right', 'end'].includes(this.textAlign) ? textWidth : 0);
        const top = y - (['bottom', 'alphabetic', 'ideographic'].includes(this.textBaseline) ? fontSize : this.textBaseline === 'middle' ? fontSize / 2 : 0);
        push({ text: String(text), x: left, y: top, fontSize, width: textWidth });
    };
    app.canvas.exportTextSink = label => push({ ...label, text: mathPartsToLatex(label.parts) });
    try {
        app.renderSceneToCanvas(target, { scale, includeBackground: true, includeGrid: false, includeAxes });
        return { png: target.toDataURL('image/png'), widthMm, aspect: height / width, labels };
    } finally {
        ctx.fillText = originalFillText;
        app.canvas.exportTextSink = originalSink;
    }
}
