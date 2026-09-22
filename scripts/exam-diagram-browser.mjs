import { Canvas } from '../js/core/Canvas.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { enhanceDiagramQuality } from '../js/ai/DiagramQualityEnhancer.js';
import { createProjectEnvelope, parseProjectFile } from '../js/utils/ProjectFile.js';
// This auditor observes browser text metrics and pixels, not the layout solver's score.
export async function renderExamCase(source) {
    const element = document.querySelector('canvas');
    element.parentElement.style.cssText = `width:${source.view.width}px;height:${source.view.height}px`;
    const canvas = new Canvas(element);
    canvas.scale = source.view.scale;
    canvas.offset.x = source.view.offset.x;
    canvas.offset.y = source.view.offset.y;
    canvas.showGrid = canvas.showXAxis = canvas.showYAxis = false;
    const manager = new ObjectManager();
    const history = new HistoryManager(manager);
    const schema = new SchemaValidator().validate({ operations: source.operations });
    const payload = enhanceDiagramQuality({ operations: source.operations }, '시험 도형', {
        view: source.view, preserveExplicitOffsets: source.preserveExplicitOffsets !== false
    });
    const result = new PatchApplier(manager, history).apply(payload);
    if (!schema.valid || !result.success)
        return { id: source.id, errors: [...schema.errors, ...result.errors] };
    const ids = new Map(payload.operations.map((o, i) => [o.id, result.createdObjects[i]?.id]));
    const objectFor = id => manager.getObject(ids.get(id));
    const issues = [];
    const add = (code, details) => issues.push({ code, ...details });
    for (const object of manager.getAllObjects()) {
        if (!object.valid)
            add('invalid-object', { id: object.id, type: object.type });
    }
    for (const op of source.operations) {
        const obj = objectFor(op.id);
        if (!obj) {
            add('missing-object', { id: op.id });
            continue;
        }
        if (op.type === 'point' && (Math.abs(obj.position.x - op.x) > 1e-9 || Math.abs(obj.position.y - op.y) > 1e-9))
            add('geometry-changed', { id: op.id });
        if (source.preserveExplicitOffsets !== false && op.labelOffset && JSON.stringify(op.labelOffset) !== JSON.stringify(obj.toJSON().labelOffset))
            add('manual-offset-changed', { id: op.id });
    }
    for (const c of source.conditions) {
        const obj = objectFor(c.id);
        if (c.kind === 'length-label') {
            if (obj?.curvature !== c.curvature)
                add('curvature-lost', { id: c.id, expected: c.curvature, actual: obj?.curvature });
            if (obj?.customText !== c.display)
                add('condition-lost', { id: c.id });
        }
        if (c.kind === 'angle-label' && obj?.customText !== c.display)
            add('condition-lost', { id: c.id });
        if (c.kind === 'coordinate' && (!obj || Math.hypot(obj.position.x - c.expected[0], obj.position.y - c.expected[1]) > 1e-8))
            add('coordinate-mismatch', { id: c.id });
        if (c.kind === 'midpoint') {
            const a = objectFor(c.ends[0]).getPosition(), b = objectFor(c.ends[1]).getPosition();
            if (!obj || Math.hypot(obj.position.x - (a.x + b.x) / 2, obj.position.y - (a.y + b.y) / 2) > 1e-8)
                add('midpoint-mismatch', { id: c.id });
        }
        if (c.kind === 'division') {
            const [a, b] = c.ends.map(id => objectFor(id).getPosition());
            if (Math.hypot(obj.position.x - a.x - c.t * (b.x - a.x), obj.position.y - a.y - c.t * (b.y - a.y)) > 1e-8)
                add('division-mismatch', { id: c.id });
        }
        if (c.kind === 'intersection') {
            for (const id of c.lines) {
                const line = objectFor(id), a = line.getPoint1(), b = line.getPoint2(), p = obj.getPosition();
                if (Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) > 1e-8)
                    add('intersection-mismatch', { id: c.id, line: id });
            }
        }
        if (c.kind === 'right') {
            const [a, v, b] = c.points.map(id => objectFor(id).getPosition());
            const dot = (a.x - v.x) * (b.x - v.x) + (a.y - v.y) * (b.y - v.y);
            if (Math.abs(dot) > 1e-8)
                add('right-angle-mismatch', { points: c.points });
        }
        if (c.kind === 'endpoint' && (obj?.pointStyle !== c.style || !(obj?.pointSize > 0)))
            add('endpoint-lost', { id: c.id });
    }
    const ctx = canvas.ctx;
    const nativeFillText = ctx.fillText.bind(ctx);
    const nativeFillRect = ctx.fillRect.bind(ctx);
    const nativeFill = ctx.fill.bind(ctx);
    let owner = null, mode = 'normal';
    let labels = [];
    const markerCalls = new Map();
    const drawPoint = canvas.drawPoint.bind(canvas);
    canvas.drawPoint = (position, options = {}) => {
        if (mode === 'normal' && options.radius > 0)
            markerCalls.set(owner.id, { id: owner.id, type: owner.type, radius: options.radius });
        return drawPoint(position, options);
    };
    ctx.fillText = (text, x, y, ...args) => {
        if (mode === 'geometry')
            return;
        const m = ctx.measureText(String(text));
        labels.push({ owner: owner.id, type: owner.type, text: String(text),
            x: x - m.actualBoundingBoxLeft - 2, y: y - m.actualBoundingBoxAscent - 2,
            w: m.actualBoundingBoxLeft + m.actualBoundingBoxRight + 4,
            h: m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + 4 });
        nativeFillText(text, x, y, ...args);
    };
    ctx.fillRect = (...args) => { if (mode !== 'geometry')
        nativeFillRect(...args); };
    ctx.fill = (...args) => { if (mode !== 'geometry' || ['point', 'pointOnLine', 'pointOnCircle'].includes(owner?.type))
        nativeFill(...args); };
    const ordered = () => manager.getAllObjects().slice().sort((a, b) => {
        const layer = o => typeof o.getPosition === 'function' ? 2 : ['angleDimension', 'lengthDimension'].includes(o.type) ? 1 : 0;
        return layer(a) - layer(b);
    });
    function paint(geometry = false) {
        labels = [];
        canvas.resetLabelLayout();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        mode = geometry ? 'geometry' : 'normal';
        if (!geometry) {
            ctx.fillStyle = '#fff';
            nativeFillRect(0, 0, canvas.width, canvas.height);
        }
        for (const obj of ordered()) {
            owner = obj;
            if (obj.visible)
                obj.render(canvas);
        }
    }
    paint(true);
    const mask = ctx.getImageData(0, 0, element.width, element.height).data;
    paint();
    const observed = labels;
    const meaningfulMarkers = new Set(source.conditions.filter(c => c.kind === 'endpoint').map(c => ids.get(c.id)));
    for (const [id, marker] of markerCalls)
        if (!meaningfulMarkers.has(id))
            add('unexpected-point-marker', marker);
    for (const [id, realId] of ids) {
        const object = manager.getObject(realId);
        const needsText = (['point', 'pointOnObject', 'intersection', 'midpoint', 'circleCenterPoint'].includes(object.type) && object.showLabel && object.label) ||
            (['angleDimension', 'lengthDimension'].includes(object.type) && object.showValue && object.customText);
        if (object.visible && needsText && !observed.some(l => l.owner === realId))
            add('required-label-missing', { id });
    }
    const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (let i = 0; i < observed.length; i++) {
        const label = observed[i];
        if (label.x < 0 || label.y < 0 || label.x + label.w > canvas.width || label.y + label.h > canvas.height)
            add('label-clipped', { label });
        let ink = 0;
        for (let y = Math.max(0, Math.floor(label.y)); y < Math.min(canvas.height, Math.ceil(label.y + label.h)); y++)
            for (let x = Math.max(0, Math.floor(label.x)); x < Math.min(canvas.width, Math.ceil(label.x + label.w)); x++)
                if (mask[(y * element.width + x) * 4 + 3] > 64)
                    ink++;
        if (ink > 0)
            add('label-on-stroke', { label, inkPixels: ink });
        for (let j = i + 1; j < observed.length; j++)
            if (label.owner !== observed[j].owner && intersects(label, observed[j]))
                add('label-overlap', { labels: [label, observed[j]] });
    }
    for (const c of source.conditions.filter(c => c.kind === 'angle-label')) {
        const obj = objectFor(c.id), box = obj?._labelBox;
        if (!box) {
            add('angle-label-missing', { id: c.id });
            continue;
        }
        // Derive the intended minor-angle bisector from the original three points.
        const [a, v, b] = c.points.map(id => objectFor(id).getPosition());
        const va = { x: a.x - v.x, y: a.y - v.y }, vb = { x: b.x - v.x, y: b.y - v.y };
        const na = Math.hypot(va.x, va.y), nb = Math.hypot(vb.x, vb.y);
        const expected = { x: va.x / na + vb.x / nb, y: va.y / na + vb.y / nb };
        const center = canvas.toMath({ x: box.x + box.w / 2, y: box.y + box.h / 2 });
        if ((center.x - v.x) * expected.x + (center.y - v.y) * expected.y <= 0)
            add('angle-label-wrong-side', { id: c.id });
    }
    for (const issue of issues.filter(i => i.code === 'label-on-stroke')) {
        const box = issue.label;
        issue.strokeOwners = [];
        mode = 'geometry';
        for (const object of ordered())
            if (object.visible && object.valid) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                owner = object;
                object.render(canvas);
                const x = Math.max(0, Math.floor(box.x)), y = Math.max(0, Math.floor(box.y));
                const w = Math.min(element.width - x, Math.ceil(box.x + box.w) - x), h = Math.min(element.height - y, Math.ceil(box.y + box.h) - y);
                if (w <= 0 || h <= 0)
                    continue;
                const data = ctx.getImageData(x, y, w, h).data;
                let count = 0;
                for (let i = 3; i < data.length; i += 4)
                    if (data[i] > 64)
                        count++;
                if (count)
                    issue.strokeOwners.push({ id: object.id, type: object.type, pixels: count });
            }
    }
    paint();
    const project = createProjectEnvelope({ name: source.title, view: { scale: canvas.scale, offset: { ...source.view.offset } }, objects: manager.toJSON().objects });
    parseProjectFile(JSON.stringify(project));
    const before = element.toDataURL();
    manager.fromJSON(JSON.parse(JSON.stringify({ objects: project.objects })));
    paint();
    const after = element.toDataURL();
    if (before !== after)
        add('roundtrip-render-changed', {});
    ctx.fillText = nativeFillText;
    ctx.fillRect = nativeFillRect;
    ctx.fill = nativeFill;
    return { id: source.id, family: source.family, split: source.split, title: source.title,
        objectCount: project.objects.length, labels: observed, issues, project, prepared: { operations: payload.operations }, image: before };
}
