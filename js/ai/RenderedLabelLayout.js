import { Canvas } from '../core/Canvas.js';
import { ObjectManager } from '../core/ObjectManager.js';
import { HistoryManager } from '../core/HistoryManager.js';
import { PatchApplier } from './PatchApplier.js';
const POINTS = new Set(['point', 'pointOnObject', 'pointOnLine', 'pointOnCircle', 'intersection', 'midpoint', 'circleCenterPoint']);
const DIMENSIONS = new Set(['angleDimension', 'lengthDimension']);
/** Place newly generated labels using the same canvas renderer and fonts as the app.
 * Explicit input positions are pinned; coordinates, arcs and user projects are never moved.
 * This runs once on generation, not during rendering, zooming or project loading.
 */
export function layoutGeneratedOperationLabels(operations, { view = {}, pinnedIds = new Set(), existingObjects = [] } = {}) {
    if (typeof OffscreenCanvas === 'undefined' || !operations.length)
        return { available: false };
    const width = Math.max(200, Math.min(2400, Math.ceil(Number(view.width) || 1000)));
    const height = Math.max(200, Math.min(1800, Math.ceil(Number(view.height) || 760)));
    const element = new OffscreenCanvas(width, height);
    const canvas = Object.create(Canvas.prototype);
    Object.assign(canvas, { canvas: element, ctx: element.getContext('2d', { willReadFrequently: true }), width, height,
        scale: Number(view.scale) || 50, offset: { x: Number(view.offset?.x) || 0, y: Number(view.offset?.y) || 0 },
        showXAxis: Boolean(view.showXAxis), showYAxis: Boolean(view.showYAxis), showAxisNumbers: false,
        labelBounds: [] });
    const manager = new ObjectManager();
    if (existingObjects.length)
        manager.fromJSON({ objects: existingObjects });
    const result = new PatchApplier(manager, new HistoryManager(manager)).apply({ operations });
    if (!result.success)
        return { available: true, errors: result.errors };
    const creates = operations.filter(o => o.op === 'create');
    const records = creates.map((op, i) => ({ op, obj: result.createdObjects[i] }));
    const objects = manager.getAllObjects();
    const ctx = canvas.ctx;
    const fillText = ctx.fillText.bind(ctx), fillRect = ctx.fillRect.bind(ctx), fill = ctx.fill.bind(ctx);
    let mode = 'measure', current = null, measured = null;
    ctx.fillText = (text, x, y) => {
        if (mode !== 'measure' || !String(text).trim())
            return;
        const m = ctx.measureText(String(text));
        const box = { x: x - m.actualBoundingBoxLeft - 3, y: y - m.actualBoundingBoxAscent - 3,
            w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight + 6, h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + 6 };
        measured = measured ? union(measured, box) : box;
    };
    ctx.fillRect = () => { };
    ctx.fill = (...args) => { if (mode === 'geometry' && POINTS.has(current?.type))
        fill(...args); };
    const measure = obj => {
        mode = 'measure';
        current = obj;
        measured = null;
        canvas.resetLabelLayout();
        ctx.save();
        obj.render(canvas);
        ctx.restore();
        return measured;
    };
    // Integral images make rectangle-vs-ink checks independent of glyph length.
    // Ignore a length label's own curve only: its renderer cuts an actual gap for the text.
    const inkCache = new Map();
    const inkFor = excluded => {
        if (inkCache.has(excluded))
            return inkCache.get(excluded);
        ctx.clearRect(0, 0, width, height);
        mode = 'geometry';
        canvas.resetLabelLayout();
        current = null;
        if (canvas.showXAxis || canvas.showYAxis)
            canvas.drawAxes();
        for (const obj of objects)
            if (obj.visible && obj.valid && obj !== excluded) {
                current = obj;
                ctx.save();
                const showValue = obj.showValue;
                if (obj.type === 'lengthDimension')
                    obj.showValue = false;
                try {
                    obj.render(canvas);
                }
                finally {
                    obj.showValue = showValue;
                    ctx.restore();
                }
            }
        const data = ctx.getImageData(0, 0, width, height).data;
        const stride = width + 1, table = new Uint32Array(stride * (height + 1));
        for (let y = 0; y < height; y++) {
            let row = 0;
            for (let x = 0; x < width; x++) {
                row += data[(y * width + x) * 4 + 3] > 32 ? 1 : 0;
                table[(y + 1) * stride + x + 1] = table[y * stride + x + 1] + row;
            }
        }
        const read = box => {
            const x0 = Math.max(0, Math.floor(box.x)), y0 = Math.max(0, Math.floor(box.y));
            const x1 = Math.min(width, Math.ceil(box.x + box.w)), y1 = Math.min(height, Math.ceil(box.y + box.h));
            if (x1 <= x0 || y1 <= y0)
                return 0;
            return table[y1 * stride + x1] - table[y0 * stride + x1] - table[y1 * stride + x0] + table[y0 * stride + x0];
        };
        inkCache.set(excluded, read);
        return read;
    };
    const eligible = records.filter(({ op, obj }) => obj?.visible && obj.valid && !pinnedIds.has(op.id) &&
        ((POINTS.has(obj.type) && obj.showLabel && obj.label) || (DIMENSIONS.has(obj.type) && obj.showValue) ||
            (obj.type === 'function' && obj.showLabel)));
    const movable = new Set(eligible.map(r => r.obj));
    const placed = objects.filter(obj => obj.visible && obj.valid && !movable.has(obj)).map(measure).filter(Boolean);
    // Resolve constrained angular text before free point labels.
    eligible.sort((a, b) => priority(a.obj) - priority(b.obj));
    const changes = [];
    for (const { op, obj } of eligible) {
        const initial = measure(obj);
        if (!initial)
            continue;
        const ink = inkFor(obj.type === 'lengthDimension' ? obj : null);
        const candidates = candidateCenters(obj, initial, canvas);
        let best = null;
        for (const candidate of candidates) {
            const box = { ...initial, x: candidate.x - initial.w / 2, y: candidate.y - initial.h / 2 };
            const outside = Math.max(0, 6 - box.x) + Math.max(0, 6 - box.y) + Math.max(0, box.x + box.w - width + 6) + Math.max(0, box.y + box.h - height + 6);
            const overlap = placed.reduce((sum, p) => sum + overlapArea(box, p), 0);
            const score = (outside * 100 + ink(box) * 10 + overlap * 10) * 1000 + candidate.cost;
            if (!best || score < best.score)
                best = { box, score };
        }
        if (!best)
            continue;
        const dx = best.box.x - initial.x, dy = best.box.y - initial.y;
        if (Math.abs(dx) + Math.abs(dy) > 0.01) {
            if (POINTS.has(obj.type)) {
                obj.labelOffset.x += dx;
                obj.labelOffset.y += dy;
            }
            else if (obj.type === 'function') {
                const position = obj.getLabelPosition();
                obj._labelMathPos = position;
                obj._labelMathPos.x += dx / canvas.scale;
                obj._labelMathPos.y -= dy / canvas.scale;
            }
            else {
                obj.labelOffset.x += dx / canvas.scale;
                obj.labelOffset.y -= dy / canvas.scale;
            }
            if (obj.type === 'function')
                op.labelMathPos = { x: obj._labelMathPos.x, y: obj._labelMathPos.y };
            else
                op.labelOffset = { x: obj.labelOffset.x, y: obj.labelOffset.y };
            changes.push(op.id);
        }
        placed.push(best.box);
        if (obj.type === 'lengthDimension')
            inkCache.delete(obj);
    }
    ctx.fillText = fillText;
    ctx.fillRect = fillRect;
    ctx.fill = fill;
    return { available: true, changedIds: changes };
}
function priority(obj) { return obj.type === 'angleDimension' ? 0 : obj.type === 'lengthDimension' ? 1 : 2; }
function union(a, b) { const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y); return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }; }
function overlapArea(a, b) { return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); }
function candidateCenters(obj, box, canvas) {
    const initial = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    const result = [];
    if (POINTS.has(obj.type)) {
        const anchor = canvas.toScreen(obj.getPosition());
        result.push({ ...initial, cost: Math.hypot(initial.x - anchor.x, initial.y - anchor.y) });
        for (const gap of [6, 10, 16, 24, 32])
            for (let i = 0; i < 16; i++) {
                const t = i * Math.PI / 8, dx = Math.cos(t), dy = Math.sin(t);
                const radius = Math.abs(dx) * box.w / 2 + Math.abs(dy) * box.h / 2 + gap;
                const x = anchor.x + dx * radius, y = anchor.y + dy * radius;
                result.push({ x, y, cost: radius + 0.05 * Math.hypot(x - initial.x, y - initial.y) });
            }
    }
    else if (obj.type === 'angleDimension') {
        const v = canvas.toScreen(obj.vertex), middle = -(obj.startAngle + obj.angle / 2);
        const base = obj.arcRadius * canvas.scale + Math.min(box.w, box.h) / 2 + 5;
        // Follow the internal bisector. Increasing text distance does not resize the arc.
        for (let distance = base; distance <= Math.max(150, base + 100); distance += 5) {
            for (const delta of [0, -0.06, 0.06]) {
                const t = middle + delta;
                result.push({ x: v.x + distance * Math.cos(t), y: v.y + distance * Math.sin(t), cost: distance + Math.abs(delta) * 100 });
            }
        }
    }
    else if (obj.type === 'lengthDimension') {
        const a = canvas.toScreen(obj.point1), b = canvas.toScreen(obj.point2);
        const n = Math.hypot(b.x - a.x, b.y - a.y), dx = (b.x - a.x) / n, dy = (b.y - a.y) / n;
        const control = { x: (a.x + b.x) / 2 + dy * obj.curvature, y: (a.y + b.y) / 2 - dx * obj.curvature };
        const curve = Array.from({ length: 101 }, (_, i) => { const t = i / 100, u = 1 - t; return { x: u * u * a.x + 2 * u * t * control.x + t * t * b.x, y: u * u * a.y + 2 * u * t * control.y + t * t * b.y }; });
        for (let tangent = -34; tangent <= 34; tangent += 2)
            for (let normal = -26; normal <= 26; normal += 2) {
                const x = initial.x + tangent * dx - normal * dy, y = initial.y + tangent * dy + normal * dx;
                // Text must still occupy a gap in its own curve, not float away from it.
                if (!curve.some(p => Math.abs(p.x - x) < Math.max(2, box.w / 2 - 7) && Math.abs(p.y - y) < Math.max(2, box.h / 2 - 5)))
                    continue;
                result.push({ x, y, cost: Math.abs(tangent) + Math.abs(normal) * 2 });
            }
    }
    else if (obj.type === 'function') {
        const bounds = canvas.getVisibleBounds();
        const min = Math.max(bounds.minX + 0.25, obj.xMin ?? bounds.minX);
        const max = Math.min(bounds.maxX - 0.25, obj.xMax ?? bounds.maxX);
        const fn = obj.getFunction();
        result.push({ ...initial, cost: 0 });
        if (fn && min < max) {
            for (let i = 0; i <= 24; i++) {
                const x = min + (max - min) * i / 24, y = fn(x);
                if (!Number.isFinite(y) || !obj.isPointWithinVisibleRange(x, y)) continue;
                const screen = canvas.toScreen({ x, y });
                const delta = Math.max(0.001, (max - min) / 1000);
                const slope = (fn(x + delta) - fn(x - delta)) / (2 * delta);
                if (!Number.isFinite(slope)) continue;
                const normalSize = Math.hypot(slope, 1);
                for (const sign of [-1, 1])
                    for (const gap of [8, 16, 26, 38]) {
                        const distance = box.h / 2 + gap;
                        const px = screen.x + sign * slope / normalSize * distance;
                        const py = screen.y + sign / normalSize * distance;
                        result.push({ x: px, y: py,
                            cost: Math.hypot(px - initial.x, py - initial.y) + gap / 2 });
                    }
            }
        }
    }
    else {
        for (const dx of [0, -24, 24, -48, 48, -80, 80])
            for (const dy of [0, -24, 24, -48, 48, -80, 80])
                result.push({ x: initial.x + dx, y: initial.y + dy, cost: Math.hypot(dx, dy) });
    }
    return result;
}
