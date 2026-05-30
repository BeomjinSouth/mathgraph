/**
 * FillTool.js - vector paint-bucket fill for closed MathGraph objects.
 */

import { Tool } from './Tool.js';
import { ObjectType } from '../objects/GeoObject.js';
import { Geometry } from '../utils/Geometry.js';

const FILLABLE_TYPES = new Set([
    ObjectType.CIRCLE,
    ObjectType.CIRCLE_THREE_POINTS,
    ObjectType.SECTOR,
    ObjectType.CIRCULAR_SEGMENT,
    ObjectType.LENS_REGION,
    ObjectType.CLOSED_REGION,
    ObjectType.POLYGON
]);

const MAX_SEGMENTS_FOR_INFERENCE = 80;
const MAX_LOOP_VERTICES = 12;
const MAX_INFERRED_CYCLES = 500;
const MIN_REGION_AREA = 1e-8;

export class FillTool extends Tool {
    constructor() {
        super('fill');
    }

    activate(app) {
        super.activate(app);
        app.showToast?.('채울 닫힌 도형을 클릭하세요.', 'info');
    }

    deactivate(app) {
        app.objectManager.clearHighlight();
        super.deactivate(app);
        app.render?.();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        const fillColor = app.currentFillColor || '#000000';
        const fillOpacity = Number.isFinite(app.currentFillOpacity) ? app.currentFillOpacity : 0.24;
        let target = this.findFillTargetAt(mathPos, app);
        let createdTarget = null;

        if (!target || isCircleType(target.type)) {
            createdTarget = this.createInferredFillTargetAt(mathPos, app, { fillColor, fillOpacity });
            if (createdTarget) {
                target = createdTarget;
            }
        }

        if (!target) {
            app.showToast?.('이 위치에서 채울 수 있는 도형을 찾지 못했습니다.', 'warning');
            return;
        }

        if (createdTarget) {
            app.historyManager.recordCreate(createdTarget);
            app.objectManager.highlightObject(createdTarget);
            app.showToast?.('닫힌 영역을 찾아 채우기를 적용했습니다.', 'success');
            app.render();
            app.toolManager.returnToSelect();
            return;
        }

        const actions = [];

        if (target.fillColor !== fillColor) {
            actions.push({
                type: 'propertyChange',
                objectId: target.id,
                property: 'fillColor',
                oldValue: target.fillColor,
                newValue: fillColor
            });
            target.fillColor = fillColor;
        }

        if (target.fillOpacity !== fillOpacity) {
            actions.push({
                type: 'propertyChange',
                objectId: target.id,
                property: 'fillOpacity',
                oldValue: target.fillOpacity,
                newValue: fillOpacity
            });
            target.fillOpacity = fillOpacity;
        }

        if (actions.length > 0) {
            if (typeof app.historyManager.recordBatch === 'function') {
                app.historyManager.recordBatch(actions);
            } else {
                for (const action of actions) {
                    app.historyManager.recordPropertyChange(
                        action.objectId,
                        action.property,
                        action.oldValue,
                        action.newValue
                    );
                }
            }
        }

        app.objectManager.updateObject(target.id);
        app.objectManager.highlightObject(target);
        app.showToast?.('채우기를 적용했습니다.', 'success');
        app.render();
        app.toolManager.returnToSelect();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        app.objectManager.highlightObject(this.findFillTargetAt(mathPos, app));
        app.render();
    }

    findFillTargetAt(mathPos, app) {
        const objects = [...app.objectManager.getAllObjects()].reverse();

        for (const object of objects) {
            if (!object.visible || !object.valid || !FILLABLE_TYPES.has(object.type)) {
                continue;
            }

            if (!isCircleType(object.type) && object.hitTest(mathPos, 8, app.canvas)) {
                return object;
            }
        }

        for (const object of objects) {
            if (!object.visible || !object.valid || !isCircleType(object.type)) {
                continue;
            }

            if (pointInsideCircle(mathPos, object, app.canvas)) {
                return object;
            }
        }

        return null;
    }

    createInferredFillTargetAt(mathPos, app, params) {
        const segmentRegion = this.createSegmentLoopRegionAt(mathPos, app, params);
        if (segmentRegion) {
            return segmentRegion;
        }

        return this.createTwoCircleLensAt(mathPos, app, params);
    }

    createSegmentLoopRegionAt(mathPos, app, params) {
        if (typeof app.objectManager.createClosedRegion !== 'function') {
            return null;
        }

        const loop = findSmallestSegmentLoopAt(mathPos, app);
        if (!loop) {
            return null;
        }

        return app.objectManager.createClosedRegion(loop.vertexIds, loop.boundaryObjectIds, {
            ...params,
            showLabel: false,
            lineWidth: 0
        });
    }

    createTwoCircleLensAt(mathPos, app, params) {
        const circles = app.objectManager.getAllObjects().filter(object =>
            object.visible &&
            object.valid &&
            isCircleType(object.type) &&
            pointInsideCircle(mathPos, object, app.canvas)
        );

        if (circles.length < 2 || typeof app.objectManager.createLensRegion !== 'function') {
            return null;
        }

        const existingLens = app.objectManager.getAllObjects().find(object =>
            object.visible &&
            object.valid &&
            object.type === ObjectType.LENS_REGION &&
            object.hitTest(mathPos, 8, app.canvas)
        );
        if (existingLens) {
            return null;
        }

        let best = null;
        for (let i = 0; i < circles.length; i++) {
            for (let j = i + 1; j < circles.length; j++) {
                const candidate = createLensCandidate(circles[i], circles[j], mathPos);
                if (!candidate) continue;
                if (!best || candidate.area < best.area) {
                    best = candidate;
                }
            }
        }

        if (!best) {
            return null;
        }

        return app.objectManager.createLensRegion(best.circle1Id, best.circle2Id, {
            ...params,
            showLabel: false
        });
    }

    getCursor() {
        return 'cell';
    }
}

function isCircleType(type) {
    return type === ObjectType.CIRCLE || type === ObjectType.CIRCLE_THREE_POINTS;
}

function pointInsideCircle(point, circle, canvas) {
    if (typeof circle.getCenter !== 'function' || typeof circle.getRadius !== 'function') {
        return false;
    }

    const tolerance = canvas?.toMathLength ? canvas.toMathLength(8) : 0;
    return point.distanceTo(circle.getCenter()) <= circle.getRadius() + tolerance;
}

function findSmallestSegmentLoopAt(point, app) {
    const segments = app.objectManager.getAllObjects().filter(object =>
        object.visible &&
        object.valid &&
        object.type === ObjectType.SEGMENT &&
        object.point1Id &&
        object.point2Id
    );

    if (segments.length < 3 || segments.length > MAX_SEGMENTS_FOR_INFERENCE) {
        return null;
    }

    const graph = new Map();
    const edgeObjectIds = new Map();

    for (const segment of segments) {
        addGraphEdge(graph, segment.point1Id, segment.point2Id);
        edgeObjectIds.set(edgeKey(segment.point1Id, segment.point2Id), segment.id);
    }

    const cycles = [];
    const seenCycles = new Set();
    const pointIds = [...graph.keys()];

    for (const startId of pointIds) {
        walkSegmentCycles(startId, startId, [startId], new Set([startId]), graph, seenCycles, cycles);
        if (cycles.length >= MAX_INFERRED_CYCLES) {
            break;
        }
    }

    const tolerance = app.canvas?.toMathLength ? app.canvas.toMathLength(8) : 0.08;
    let best = null;

    for (const cycle of cycles) {
        const vertices = cycle
            .map(id => app.objectManager.getObject(id))
            .map(object => object?.getPosition?.())
            .filter(Boolean);

        if (vertices.length !== cycle.length || vertices.length < 3) {
            continue;
        }

        const area = Geometry.polygonArea(vertices);
        if (area <= MIN_REGION_AREA || !isSimplePolygon(vertices)) {
            continue;
        }

        if (!pointInsideOrNearPolygon(point, vertices, tolerance)) {
            continue;
        }

        const boundaryObjectIds = [];
        let missingBoundary = false;
        for (let i = 0; i < cycle.length; i++) {
            const next = (i + 1) % cycle.length;
            const boundaryId = edgeObjectIds.get(edgeKey(cycle[i], cycle[next]));
            if (!boundaryId) {
                missingBoundary = true;
                break;
            }
            boundaryObjectIds.push(boundaryId);
        }
        if (missingBoundary) {
            continue;
        }

        if (!best || area < best.area) {
            best = {
                area,
                vertexIds: cycle,
                boundaryObjectIds
            };
        }
    }

    return best;
}

function walkSegmentCycles(startId, currentId, path, visited, graph, seenCycles, cycles) {
    if (path.length > MAX_LOOP_VERTICES || cycles.length >= MAX_INFERRED_CYCLES) {
        return;
    }

    const neighbors = graph.get(currentId) || [];
    for (const neighborId of neighbors) {
        if (neighborId === startId && path.length >= 3) {
            const key = canonicalCycleKey(path);
            if (!seenCycles.has(key)) {
                seenCycles.add(key);
                cycles.push([...path]);
            }
            continue;
        }

        if (visited.has(neighborId)) {
            continue;
        }

        visited.add(neighborId);
        path.push(neighborId);
        walkSegmentCycles(startId, neighborId, path, visited, graph, seenCycles, cycles);
        path.pop();
        visited.delete(neighborId);
    }
}

function createLensCandidate(circle1, circle2, point) {
    if (typeof circle1.getCenter !== 'function' ||
        typeof circle1.getRadius !== 'function' ||
        typeof circle2.getCenter !== 'function' ||
        typeof circle2.getRadius !== 'function') {
        return null;
    }

    const c1 = circle1.getCenter();
    const c2 = circle2.getCenter();
    const r1 = circle1.getRadius();
    const r2 = circle2.getRadius();
    const intersections = Geometry.circleCircleIntersection(c1, r1, c2, r2);
    if (intersections.length !== 2) {
        return null;
    }

    const midpoint = intersections[0].add(intersections[1]).mul(0.5);
    if (!pointInsideCircle(midpoint, circle1) || !pointInsideCircle(midpoint, circle2)) {
        return null;
    }

    const sample = sampleLensBoundary(c1, r1, c2, r2, intersections);
    if (sample.length < 3 || !Geometry.pointInPolygon(point, sample)) {
        return null;
    }

    return {
        circle1Id: circle1.id,
        circle2Id: circle2.id,
        area: Geometry.polygonArea(sample)
    };
}

function sampleLensBoundary(c1, r1, c2, r2, intersections) {
    const [a, b] = intersections;
    const arc1 = chooseInsideArc(c1, r1, a, b, c2, r2);
    const arc2 = chooseInsideArc(c2, r2, b, a, c1, r1);
    return [...arc1, ...arc2.slice(1)];
}

function chooseInsideArc(center, radius, startPoint, endPoint, otherCenter, otherRadius) {
    const start = Math.atan2(startPoint.y - center.y, startPoint.x - center.x);
    const end = Math.atan2(endPoint.y - center.y, endPoint.x - center.x);
    const ccw = sampleArc(center, radius, start, positiveSweep(start, end), 24);
    const cw = sampleArc(center, radius, start, -positiveSweep(end, start), 24);
    const ccwMid = ccw[Math.floor(ccw.length / 2)];
    const cwMid = cw[Math.floor(cw.length / 2)];
    const ccwInside = ccwMid.distanceTo(otherCenter) <= otherRadius + 1e-8;
    const cwInside = cwMid.distanceTo(otherCenter) <= otherRadius + 1e-8;

    if (ccwInside !== cwInside) {
        return ccwInside ? ccw : cw;
    }

    return ccwMid.distanceTo(otherCenter) <= cwMid.distanceTo(otherCenter) ? ccw : cw;
}

function sampleArc(center, radius, start, sweep, samples) {
    const points = [];
    for (let i = 0; i <= samples; i++) {
        const angle = start + sweep * (i / samples);
        points.push(center.add({
            x: radius * Math.cos(angle),
            y: radius * Math.sin(angle)
        }));
    }
    return points;
}

function positiveSweep(start, end) {
    const twoPi = Math.PI * 2;
    return (end - start + twoPi) % twoPi || twoPi;
}

function addGraphEdge(graph, a, b) {
    if (!graph.has(a)) graph.set(a, []);
    if (!graph.has(b)) graph.set(b, []);
    graph.get(a).push(b);
    graph.get(b).push(a);
}

function edgeKey(a, b) {
    return [a, b].sort().join('|');
}

function canonicalCycleKey(ids) {
    const variants = [];
    for (const sequence of [ids, [...ids].reverse()]) {
        for (let i = 0; i < sequence.length; i++) {
            variants.push([...sequence.slice(i), ...sequence.slice(0, i)].join('>'));
        }
    }
    return variants.sort()[0];
}

function pointInsideOrNearPolygon(point, vertices, tolerance) {
    if (Geometry.pointInPolygon(point, vertices)) {
        return true;
    }

    for (let i = 0; i < vertices.length; i++) {
        const next = (i + 1) % vertices.length;
        if (Geometry.pointToSegmentDistance(point, vertices[i], vertices[next]) <= tolerance) {
            return true;
        }
    }
    return false;
}

function isSimplePolygon(vertices) {
    for (let i = 0; i < vertices.length; i++) {
        const a1 = vertices[i];
        const a2 = vertices[(i + 1) % vertices.length];

        for (let j = i + 1; j < vertices.length; j++) {
            const adjacent = Math.abs(i - j) === 1 || (i === 0 && j === vertices.length - 1);
            if (adjacent) continue;

            const b1 = vertices[j];
            const b2 = vertices[(j + 1) % vertices.length];
            if (Geometry.segmentSegmentIntersection(a1, a2, b1, b2)) {
                return false;
            }
        }
    }
    return true;
}

export default FillTool;
