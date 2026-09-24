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
    canvas.showGrid = false;
    canvas.showXAxis = canvas.showYAxis = Boolean(source.showAxes);
    canvas.showAxisNumbers = false;
    const manager = new ObjectManager();
    const history = new HistoryManager(manager);
    const schema = new SchemaValidator().validate({ operations: source.operations });
    const payload = enhanceDiagramQuality({ operations: source.operations }, source.prompt || '시험 도형', {
        view: { ...source.view, showXAxis: Boolean(source.showAxes), showYAxis: Boolean(source.showAxes) },
        preserveExplicitOffsets: source.preserveExplicitOffsets !== false
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
    const nativeArc = ctx.arc.bind(ctx);
    const nativeQuadratic = ctx.quadraticCurveTo.bind(ctx);
    const nativeLineTo = ctx.lineTo.bind(ctx);
    let owner = null, mode = 'normal';
    let labels = [];
    const markerCalls = new Map();
    const angleArcs = new Map(), lengthCurves = new Map();
    const equalityTicks = new Map(), solidEdges = new Map();
    const angleTickStrokes = new Map(), lengthTickStrokes = new Map();
    const drawPoint = canvas.drawPoint.bind(canvas);
    const drawSegment = canvas.drawSegment.bind(canvas);
    const drawEqualLengthMarker = canvas.drawEqualLengthMarker.bind(canvas);
    canvas.drawPoint = (position, options = {}) => {
        if (mode === 'normal' && options.radius > 0)
            markerCalls.set(owner.id, { id: owner.id, type: owner.type, radius: options.radius });
        return drawPoint(position, options);
    };
    canvas.drawSegment = (a, b, options = {}) => {
        if (mode === 'normal' && ['prism', 'pyramid'].includes(owner?.type)) {
            const list = solidEdges.get(owner.id) || [];
            list.push({ a: { x: a.x, y: a.y }, b: { x: b.x, y: b.y }, dashed: Boolean(options.dashed) });
            solidEdges.set(owner.id, list);
        }
        return drawSegment(a, b, options);
    };
    canvas.drawEqualLengthMarker = (a, b, options = {}) => {
        if (mode === 'normal' && owner?.type === 'equalLengthMarker') {
            const list = equalityTicks.get(owner.id) || [];
            list.push({ count: options.tickCount });
            equalityTicks.set(owner.id, list);
        }
        return drawEqualLengthMarker(a, b, options);
    };
    ctx.arc = (x, y, radius, start, end, ...args) => {
        if (mode === 'normal' && owner?.type === 'angleDimension') {
            const list = angleArcs.get(owner.id) || [];
            list.push({ radius, start, end });
            angleArcs.set(owner.id, list);
        }
        return nativeArc(x, y, radius, start, end, ...args);
    };
    ctx.quadraticCurveTo = (x, y, endX, endY) => {
        if (mode === 'normal' && owner?.type === 'lengthDimension') {
            const list = lengthCurves.get(owner.id) || [];
            list.push({ dashed: ctx.getLineDash().length > 0, width: ctx.lineWidth });
            lengthCurves.set(owner.id, list);
        }
        return nativeQuadratic(x, y, endX, endY);
    };
    ctx.lineTo = (x, y) => {
        if (mode === 'normal' && owner?.type === 'angleDimension')
            angleTickStrokes.set(owner.id, (angleTickStrokes.get(owner.id) || 0) + 1);
        if (mode === 'normal' && owner?.type === 'equalLengthMarker')
            lengthTickStrokes.set(owner.id, (lengthTickStrokes.get(owner.id) || 0) + 1);
        return nativeLineTo(x, y);
    };
    ctx.fillText = (text, x, y, ...args) => {
        if (mode === 'geometry')
            return;
        if (mode === 'axes') {
            nativeFillText(text, x, y, ...args);
            return;
        }
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
        const layer = o => o.type === 'functionRegion' ? -1 : typeof o.getPosition === 'function' ? 2 : ['angleDimension', 'lengthDimension'].includes(o.type) ? 1 : 0;
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
        if (source.showAxes) {
            mode = geometry ? 'geometry' : 'axes';
            canvas.drawAxes();
            mode = geometry ? 'geometry' : 'normal';
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
    for (const c of source.conditions) {
        const obj = c.id ? objectFor(c.id) : null;
        if (c.kind === 'angle-arc') {
            const right = obj && Math.abs(obj.getAngleDegrees() - 90) < 1e-8;
            const drawn = angleArcs.get(obj?.id) || [];
            if (!obj?.valid || Math.abs(obj.arcRadius - c.radius) > 1e-9 || obj.markerCount !== c.marks ||
                (!right && (!drawn.some(arc => Math.abs(arc.radius - c.radius * canvas.scale) < 1e-6) ||
                    (angleTickStrokes.get(obj.id) || 0) !== c.marks)))
                add('angle-arc-missing', { id: c.id, right, drawn, ticks: angleTickStrokes.get(obj?.id) || 0 });
        }
        if (c.kind === 'equal-angle') {
            const angles = c.ids.map(id => objectFor(id));
            if (angles.some(angle => !angle?.valid || angle.markerCount !== c.marks) ||
                Math.abs(angles[0].angle - angles[1].angle) > 1e-8)
                add('equal-angle-mismatch', { ids: c.ids, marks: c.marks });
        }
        if (c.kind === 'equal-length') {
            const segments = c.segments.map(id => objectFor(id));
            const measure = segment => segment?.getPoint1?.().distanceTo(segment?.getPoint2?.());
            const calls = equalityTicks.get(obj?.id) || [];
            if (!obj?.valid || obj.tickCount !== c.ticks || calls.length !== 2 ||
                (lengthTickStrokes.get(obj?.id) || 0) !== 2 * c.ticks ||
                calls.some(call => call.count !== c.ticks) || Math.abs(measure(segments[0]) - measure(segments[1])) > 1e-8)
                add('equal-length-mismatch', { id: c.id, ticks: c.ticks, drawn: calls.length,
                    strokes: lengthTickStrokes.get(obj?.id) || 0 });
        }
        if (c.kind === 'length-curve') {
            const curves = lengthCurves.get(obj?.id) || [];
            if (!curves.some(curve => curve.dashed === c.dashed && curve.width === c.lineWidth))
                add('length-curve-missing', { id: c.id, curves });
        }
        if (c.kind === 'solid-edges') {
            const edges = solidEdges.get(obj?.id) || [];
            const front = c.front.map(id => objectFor(id)?.getPosition());
            const close = (a, b) => a && b && Math.hypot(a.x - b.x, a.y - b.y) < 1e-8;
            const pointNames = source.operations.filter(op => op.type === 'point').map(op => op.id);
            const nameAt = position => pointNames.find(name => close(objectFor(name)?.getPosition(), position));
            const key = names => names.slice().sort().join('-');
            const hidden = edges.filter(edge => edge.dashed).map(edge => key([nameAt(edge.a), nameAt(edge.b)])).sort();
            const expectedHidden = (c.hidden || []).map(key).sort();
            if (!obj?.valid || edges.filter(edge => edge.dashed).length < c.minDashed ||
                edges.filter(edge => !edge.dashed).length < c.minSolid ||
                JSON.stringify(hidden) !== JSON.stringify(expectedHidden) ||
                !edges.some(edge => (close(edge.a, front[0]) && close(edge.b, front[1]) ||
                    close(edge.a, front[1]) && close(edge.b, front[0])) && !edge.dashed))
                add('solid-edge-style-mismatch', { id: c.id, dashed: edges.filter(edge => edge.dashed).length,
                    solid: edges.filter(edge => !edge.dashed).length, hidden, expectedHidden });
        }
        if (c.kind === 'function-region') {
            if (!obj?.valid || obj.function1Id !== ids.get(c.function1Id) ||
                obj.function2Id !== (c.function2Id ? ids.get(c.function2Id) : null) ||
                Math.abs(obj.xMin - c.xMin) > 1e-9 || Math.abs(obj.xMax - c.xMax) > 1e-9 ||
                (!c.function2Id && obj.baselineY !== c.baselineY))
                add('function-region-boundary-mismatch', { id: c.id });
            if (obj?.valid && obj.pathPoints.some(point => {
                const screen = canvas.toScreen(point);
                return screen.x < 5 || screen.y < 5 || screen.x > canvas.width - 5 || screen.y > canvas.height - 5;
            })) add('function-region-clipped', { id: c.id });
        }
        if (['function-region', 'fill-probes'].includes(c.kind)) {
            if (!obj?.valid) continue;
            mode = 'probe';
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            owner = obj;
            obj.render(canvas);
            for (const probe of c.probes) {
                const screen = canvas.toScreen(probe);
                const x = Math.round(screen.x), y = Math.round(screen.y);
                if (x < 2 || y < 2 || x >= canvas.width - 2 || y >= canvas.height - 2) {
                    add('fill-probe-outside-canvas', { id: c.id, probe });
                    continue;
                }
                const pixels = ctx.getImageData(x - 1, y - 1, 3, 3).data;
                let alpha = 0;
                for (let i = 3; i < pixels.length; i += 4) alpha = Math.max(alpha, pixels[i]);
                if ((alpha > 10) !== probe.inside)
                    add('fill-probe-mismatch', { id: c.id, probe, alpha });
            }
            if (c.kind === 'function-region') {
                for (const xValue of [c.xMin, c.xMax]) {
                    const upper = obj.function1.evaluate(xValue);
                    const lower = obj.function2 ? obj.function2.evaluate(xValue) : obj.baselineY;
                    if (Math.abs(upper - lower) < 0.2) continue;
                    const screen = canvas.toScreen({ x: xValue, y: (upper + lower) / 2 });
                    const x = Math.round(screen.x), y = Math.round(screen.y);
                    if (x < 1 || y < 1 || x >= canvas.width - 1 || y >= canvas.height - 1) continue;
                    const pixels = ctx.getImageData(x - 1, y - 1, 3, 3).data;
                    let alpha = 0;
                    for (let i = 3; i < pixels.length; i += 4) alpha = Math.max(alpha, pixels[i]);
                    if (alpha < 180) add('function-region-boundary-line-missing', { id: c.id, xValue, alpha });
                }
            }
            mode = 'normal';
        }
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
    ctx.arc = nativeArc;
    ctx.quadraticCurveTo = nativeQuadratic;
    ctx.lineTo = nativeLineTo;
    canvas.drawSegment = drawSegment;
    canvas.drawEqualLengthMarker = drawEqualLengthMarker;
    return { id: source.id, family: source.family, split: source.split, title: source.title,
        objectCount: project.objects.length, labels: observed, issues, project, prepared: { operations: payload.operations }, image: before };
}
