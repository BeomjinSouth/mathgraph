import { ObjectManager } from '../core/ObjectManager.js';
import { HistoryManager } from '../core/HistoryManager.js';
import { PatchApplier } from './PatchApplier.js';
import { measurementLabelMatches } from './MeasurementLabel.js';

/** Replay only into an isolated manager; never validate a proposed edit against stale geometry. */
export function previewAnnotationState(operations, context) {
    const manager = new ObjectManager();
    try {
        manager.fromJSON({objects:structuredClone(context.objects)});
        const applied = new PatchApplier(manager, new HistoryManager(manager)).apply({operations});
        if (!applied.success) return {error:applied.errors.join(' ')};
        const pointTypes = new Set(['point','pointOnObject','midpoint','intersection','circleCenterPoint']);
        const creates = manager.getAllObjects().map(object => {
            const data = {...object.toJSON(),op:'create'};
            if (pointTypes.has(object.type) && typeof object.getPosition === 'function') {
                const position = object.getPosition();
                return {...data,type:'point',x:object.valid ? position?.x : NaN,y:object.valid ? position?.y : NaN};
            }
            return data;
        });
        return {creates};
    } catch (error) { return {error:error.message}; }
}

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

/** Only explicit named angles and numeric degree values; do not infer missing conditions. */
export function readNumericAngleConditions(prompt) {
    const name = '([A-Z]{3}|[A-Z])(?![A-Z])';
    const relation = '\\s*(?:의\\s*크기(?:는|가)?|[은는이가=])?\\s*';
    const value = '(\\d+(?:\\.\\d+)?)\\s*(?:°|도)';
    const patterns = [
        new RegExp(`∠\\s*${name}${relation}${value}`, 'g'),
        new RegExp(`(?<![A-Z])${name}\\s*각${relation}${value}`, 'g'),
        new RegExp(`(?:^|[^가-힣A-Z])각\\s*${name}${relation}${value}`, 'g')
    ];
    const conditions = new Map();
    for (const pattern of patterns) for (const match of prompt.matchAll(pattern)) {
        const condition = { name: match[1], value: Number(match[2]) };
        conditions.set(`${angleKey(condition.name)}=${condition.value}`, condition);
    }
    return [...conditions.values()];
}

// A stated numeric angle still constrains geometry when the teacher explicitly
// asks for a variable expression on that same angle's arc. Never infer a formula
// from an unrelated part of the prompt or accept an unsolicited replacement.
function requestedAngleFormulaMatches(prompt, name, op) {
    if (op.visible === false || op.showValue === false || op.label === false) return false;
    const normalize = text => String(text || '').replace(/\s/g, '');
    const pattern = /(?:∠\s*)?([A-Z]{3}|[A-Z])(?![A-Z])\s*(?:의\s*)?(?:각도\s*호|각도|각)\s*(?:에(?:는)?|은|는)\s*(\([0-9xyz+\-*/^.\s]+\)\s*°)\s*(?:를\s*)?(?:적|표시|써|쓰)/g;
    return [...prompt.matchAll(pattern)].some(([, target, formula]) =>
        (angleKey(target) === angleKey(name) || (target.length === 1 && target === (name.length === 3 ? name[1] : name))) &&
        /[xyz]/.test(formula) && normalize(formula) === normalize(op.customText));
}

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
    // An unrelated solid elsewhere on an existing canvas must not disable plane checks.
    const projectedVertices = new Set(creates.filter(op => ['prism','pyramid'].includes(op.type))
        .flatMap(op => [...(op.baseVertexIds || []),...(op.topVertexIds || []),op.apexId].filter(Boolean)));
    const projected = /입체|기둥|각뿔|원뿔|면체|sphere|prism|pyramid|cube|cone|cylinder/i.test(prompt);
    const projectedNames = names => projected || names.every(name => [...name].every(label => projectedVertices.has(labels.get(label)?.id)));
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
    const sameLengthGroups = groups(sideEdges, sideKey);
    for (const group of sameLengthGroups) {
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
        if (!projectedNames(group) && !group.every(name => nearLength(sideLength(name), sideLength(group[0]))))
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
            if (!projectedNames(group) && !marked.every(op => Math.abs(degrees(op)-degrees(marked[0])) <= 0.5))
                errors.push('같은 각 표식이 붙은 각의 실제 크기가 서로 다릅니다.');
        }
    }
    for (const { name, value } of readNumericAngleConditions(prompt)) {
        const matching = dimensions.some(op => angleMatches(name,op) &&
            (measurementLabelMatches(op, Number(value), degrees(op)) || requestedAngleFormulaMatches(prompt, name, op)) &&
            (projectedNames([name]) || Math.abs(degrees(op)-Number(value)) <= 0.5));
        if (!matching) errors.push(`∠${name}=${value}°의 꼭짓점·두 반직선·각도 호 또는 값이 일치하지 않습니다.`);
    }
    for (const [, name, value] of prompt.matchAll(/\b([A-Z]{2})\s*=\s*(\d+(?:\.\d+)?)\s*(?:cm|㎝)/g)) {
        const group = sameLengthGroups.find(group => group.some(member => sideKey(member) === sideKey(name))) || [name];
        const allowedSides = new Set(group.map(sideKey));
        const matching = creates.some(op => op.type === 'lengthDimension' &&
            allowedSides.has(side(op.segmentId)) &&
            measurementLabelMatches(op, Number(value), sideLength(side(op.segmentId))) &&
            (projectedNames([name]) || nearLength(sideLength(name), Number(value))));
        if (!matching) errors.push(`${name}=${value}cm의 실제 길이·치수 호 또는 값이 일치하지 않습니다.`);
    }
    return [...new Set(errors)];
}
