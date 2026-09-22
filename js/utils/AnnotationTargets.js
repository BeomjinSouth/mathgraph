import { Geometry } from './Geometry.js';

// Polygon edges are not standalone line objects. Defer hidden helper creation
// until the annotation is complete so cancellation leaves the document intact.
export function findAnnotationTarget(manager, position, canvas, { segmentsOnly = false } = {}) {
    const line = segmentsOnly
        ? manager.findObjectAt(position, 8, canvas, obj => obj.type === 'segment')
        : manager.findLineAt(position, 8, canvas);
    if (line) return line;
    let best = null;
    let distance = canvas.toMathLength(8);
    for (const polygon of manager.getAllObjects()) {
        if (polygon.type !== 'polygon' || !polygon.valid || !polygon.visible) continue;
        for (let i = 0; i < polygon.vertexIds.length; i++) {
            const j = (i + 1) % polygon.vertexIds.length;
            const a = polygon.vertices[i], b = polygon.vertices[j];
            const candidate = Geometry.pointToSegmentDistance(position, a, b);
            if (candidate > distance || a.distanceTo(b) < 1e-9) continue;
            distance = candidate;
            best = { id: `${polygon.id}:edge:${i}`, polygon, valid: true,
                point1Id: polygon.vertexIds[i], point2Id: polygon.vertexIds[j],
                getPoint1: () => a, getPoint2: () => b };
        }
    }
    return best;
}

export function materializeAnnotationTarget(manager, target, created) {
    if (!target.polygon) return target;
    const existing = manager.getAllObjects().find(obj => obj.type === 'segment' &&
        ((obj.point1Id === target.point1Id && obj.point2Id === target.point2Id) ||
         (obj.point1Id === target.point2Id && obj.point2Id === target.point1Id)));
    if (existing) return existing;
    const segment = manager.createSegment(target.point1Id, target.point2Id, { visible: false, showLabel: false });
    created.push(segment);
    return segment;
}
