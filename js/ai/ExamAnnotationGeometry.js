import { ObjectManager } from '../core/ObjectManager.js';
import { HistoryManager } from '../core/HistoryManager.js';
import { PatchApplier } from './PatchApplier.js';

export function resolveAnnotationPoints(creates) {
    const points = new Map(creates.filter(op => op.type === 'point').map(op => [op.id, op]));
    if (!creates.some(op => ['midpoint', 'intersection', 'pointOnLine', 'pointOnCircle', 'circleCenterPoint'].includes(op.type))) return points;
    const manager = new ObjectManager();
    const applied = new PatchApplier(manager, new HistoryManager(manager)).apply({ operations: creates });
    if (applied.success) creates.forEach((op, index) => {
        if (!['point', 'midpoint', 'intersection', 'pointOnLine', 'pointOnCircle', 'circleCenterPoint'].includes(op.type)) return;
        const object = applied.createdObjects[index];
        if (typeof object?.getPosition !== 'function') return;
        const position = object.getPosition();
        if (object.valid && Number.isFinite(position?.x) && Number.isFinite(position?.y))
            points.set(op.id, { ...op, x: position.x, y: position.y, label: op.label ?? object.label });
    });
    return points;
}

const sideKey = name => [...name].sort().join('');
const angleKey = name => name.length === 3 ? `${name[1]}:${[name[0], name[2]].sort().join('')}` : name;
const nearLength = (a, b) => Number.isFinite(a) && Number.isFinite(b) &&
    Math.abs(a - b) <= Math.max(1e-6, Math.max(a, b) * 0.001);
const distance = (a, b) => a && b ? Math.hypot(a.x - b.x, a.y - b.y) : NaN;
function angleDegrees(vertex, a, b) {
    if (!vertex || !a || !b) return NaN;
    const u = { x: a.x - vertex.x, y: a.y - vertex.y }, v = { x: b.x - vertex.x, y: b.y - vertex.y };
    const length = Math.hypot(u.x, u.y) * Math.hypot(v.x, v.y);
    return length > 1e-12 ? Math.acos(Math.max(-1, Math.min(1, (u.x*v.x+u.y*v.y)/length))) * 180 / Math.PI : NaN;
}
function sameRay(vertex, requested, actual) {
    if (!vertex || !requested || !actual) return false;
    const u = { x: requested.x-vertex.x, y: requested.y-vertex.y };
    const v = { x: actual.x-vertex.x, y: actual.y-vertex.y };
    const size = Math.hypot(u.x,u.y) * Math.hypot(v.x,v.y);
    return size > 1e-12 && u.x*v.x+u.y*v.y > 0 && Math.abs(u.x*v.y-u.y*v.x) <= size * 1e-6;
}
function groups(edges, key) {
    const parent = new Map();
    const root = value => {
        if (!parent.has(value)) parent.set(value, value);
        if (parent.get(value) !== value) parent.set(value, root(parent.get(value)));
        return parent.get(value);
    };
    for (const [a,b] of edges) parent.set(root(key(a)), root(key(b)));
    const result = new Map();
    for (const edge of edges) for (const name of edge) {
        const id = root(key(name));
        if (!result.has(id)) result.set(id, new Map());
        result.get(id).set(key(name), name);
    }
    return [...result.values()].map(group => [...group.values()]);
}

export function validateAnnotationGeometry(prompt, creates, points) {
    const errors = [];
    const labels = new Map([...points.values()].filter(point => point.label).map(point => [point.label, point]));
    const segments = new Map(creates.filter(op => op.type === 'segment').map(op => [op.id, op]));
    const projected = creates.some(op => ['prism','pyramid','cylinder','cone','sphere'].includes(op.type));
    const side = id => {
        const segment = segments.get(id), a = points.get(segment?.point1Id)?.label, b = points.get(segment?.point2Id)?.label;
        return a && b ? sideKey(a+b) : null;
    };
    const sideLength = name => distance(labels.get(name[0]), labels.get(name[1]));
    const dimensions = creates.filter(op => op.type === 'angleDimension' && op.visible !== false);
    const degrees = op => angleDegrees(points.get(op.vertexId), points.get(op.point1Id), points.get(op.point2Id));
    const angleMatches = (name, op) => {
        const vertex = points.get(op.vertexId);
        if (vertex?.label !== (name.length === 3 ? name[1] : name)) return false;
        if (name.length === 1) return Number.isFinite(degrees(op));
        const a = labels.get(name[0]), b = labels.get(name[2]);
        const p = points.get(op.point1Id), q = points.get(op.point2Id);
        return (sameRay(vertex,a,p) && sameRay(vertex,b,q)) || (sameRay(vertex,a,q) && sameRay(vertex,b,p));
    };
    const sideEdges = [...prompt.matchAll(/(?=(\b[A-Z]{2})\s*=\s*([A-Z]{2})\b)/g)].map(match => [match[1],match[2]]);
    const usedTicks = new Set();
    for (const group of groups(sideEdges, sideKey)) {
        const keys = new Set(group.map(sideKey)), ticks = new Set();
        const marked = new Set();
        for (const marker of creates.filter(op => op.type === 'equalLengthMarker' && op.visible !== false)) {
            const a = side(marker.segment1Id), b = side(marker.segment2Id);
            if (a !== b && keys.has(a) && keys.has(b)) {
                marked.add(a); marked.add(b); ticks.add(marker.tickCount ?? 1);
            }
        }
        if (marked.size !== keys.size || ticks.size !== 1 || [...ticks][0] <= 0)
            errors.push(`${group.join('=')}의 같은 길이 표식이 빠졌거나 눈금 수가 서로 다릅니다.`);
        else if (usedTicks.has([...ticks][0])) errors.push('서로 독립인 같은 길이 묶음은 서로 다른 눈금 개수로 표시해야 합니다.');
        else usedTicks.add([...ticks][0]);
        if (!projected && !group.every(name => nearLength(sideLength(name), sideLength(group[0]))))
            errors.push(`${group.join('=')}의 실제 선분 길이가 서로 다릅니다.`);
    }
    const angleEdges = [...prompt.matchAll(/(?=∠\s*([A-Z]{3}|[A-Z])(?![A-Z])\s*=\s*∠\s*([A-Z]{3}|[A-Z])(?![A-Z]))/g)]
        .map(match => [match[1],match[2]]);
    const usedAngleTicks = new Set();
    for (const group of groups(angleEdges, angleKey)) {
        const marked = group.map(name => dimensions.find(op => (op.markerCount ?? 0) > 0 && angleMatches(name,op)));
        const counts = new Set(marked.map(op => op?.markerCount));
        if (marked.some(op => !op) || counts.size !== 1)
            errors.push(`${group.map(name => '∠'+name).join('=')}에 대응하는 같은 각 호·표식이 없습니다.`);
        else {
            if (usedAngleTicks.has(marked[0].markerCount)) errors.push('서로 독립인 같은 각 묶음은 서로 다른 표식 개수로 표시해야 합니다.');
            usedAngleTicks.add(marked[0].markerCount);
            if (!projected && !marked.every(op => Math.abs(degrees(op)-degrees(marked[0])) <= 0.5))
                errors.push('같은 각 표식이 붙은 각의 실제 크기가 서로 다릅니다.');
        }
    }
    for (const [, name, value] of prompt.matchAll(/∠\s*([A-Z]{3}|[A-Z])(?![A-Z])\s*=\s*(\d+(?:\.\d+)?)\s*°/g)) {
        const matching = dimensions.some(op => angleMatches(name,op) && op.showValue !== false &&
            (!op.customText || Number.parseFloat(op.customText) === Number(value)) &&
            (projected || Math.abs(degrees(op)-Number(value)) <= 0.5));
        if (!matching) errors.push(`∠${name}=${value}°의 꼭짓점·두 반직선·각도 호 또는 값이 일치하지 않습니다.`);
    }
    for (const [, name, value] of prompt.matchAll(/\b([A-Z]{2})\s*=\s*(\d+(?:\.\d+)?)\s*(?:cm|㎝)/g)) {
        const matching = creates.some(op => op.type === 'lengthDimension' && op.visible !== false && op.showValue !== false &&
            side(op.segmentId) === sideKey(name) && (!op.customText || Number.parseFloat(op.customText) === Number(value)) &&
            (projected || nearLength(sideLength(name), Number(value))));
        if (!matching) errors.push(`${name}=${value}cm의 실제 길이·치수 호 또는 값이 일치하지 않습니다.`);
    }
    return [...new Set(errors)];
}
