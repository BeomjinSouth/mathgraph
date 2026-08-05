/**
 * ProblemScenePipeline.js
 *
 * A compact, source-grounded boundary between vision and GraphA operations.
 * The model describes what must be drawn; MathGraph owns compilation and
 * coverage validation.
 */

import { compileSceneGraph } from './SceneGraphCompiler.js';
import Geometry, { Vec2 } from '../utils/Geometry.js';
import { FunctionParser } from '../utils/Parser.js';

const NULLABLE_STRING = { type: ['string', 'null'] };
const NULLABLE_NUMBER = { type: ['number', 'null'] };
const NULLABLE_BOOLEAN = { type: ['boolean', 'null'] };

const compactStyleSchema = {
    type: 'object',
    properties: {
        color: NULLABLE_STRING,
        lineWidth: NULLABLE_NUMBER,
        dashed: NULLABLE_BOOLEAN,
        fillColor: NULLABLE_STRING,
        fillOpacity: NULLABLE_NUMBER,
        visible: NULLABLE_BOOLEAN,
        pointStyle: {
            type: ['string', 'null'],
            enum: ['closed', 'open', null]
        },
        labelOffset: {
            type: 'array',
            items: { type: 'number' },
            maxItems: 2
        }
    },
    required: [
        'color',
        'lineWidth',
        'dashed',
        'fillColor',
        'fillOpacity',
        'visible',
        'pointStyle',
        'labelOffset'
    ],
    additionalProperties: false
};

const compactSceneItemSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        kind: { type: 'string' },
        label: NULLABLE_STRING,
        refs: { type: 'array', items: { type: 'string' } },
        groups: {
            type: 'array',
            items: { type: 'array', items: { type: 'string' } }
        },
        numbers: { type: 'array', items: { type: 'number' } },
        text: { type: 'string' },
        style: compactStyleSchema
    },
    required: ['id', 'kind', 'label', 'refs', 'groups', 'numbers', 'text', 'style'],
    additionalProperties: false
};

const mustDrawSchema = {
    type: 'object',
    properties: {
        id: { type: 'string' },
        description: { type: 'string' },
        nodeIds: { type: 'array', items: { type: 'string' } },
        relationIds: { type: 'array', items: { type: 'string' } },
        required: { type: 'boolean' },
        evidence: { type: 'string' }
    },
    required: ['id', 'description', 'nodeIds', 'relationIds', 'required', 'evidence'],
    additionalProperties: false
};

const sourceBindingSchema = {
    type: 'object',
    properties: {
        pointLabel: NULLABLE_STRING,
        onObjectLabels: { type: 'array', items: { type: 'string' } },
        verticalTargetLabel: NULLABLE_STRING,
        verticalTargetOnObjectLabel: NULLABLE_STRING
    },
    required: ['pointLabel', 'onObjectLabels', 'verticalTargetLabel', 'verticalTargetOnObjectLabel'],
    additionalProperties: false
};

export const PROBLEM_SCENE_RESPONSE_FORMAT = {
    type: 'json_schema',
    name: 'math_problem_scene',
    description: 'A compact source-grounded math scene that MathGraph compiles locally.',
    strict: true,
    schema: {
        type: 'object',
        properties: {
            scene: {
                type: 'object',
                properties: {
                    diagramType: { type: 'string' },
                    sourceHasPrintedFigure: { type: 'boolean' },
                    constructionSummary: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                    nodes: { type: 'array', items: compactSceneItemSchema },
                    relations: { type: 'array', items: compactSceneItemSchema },
                    mustDraw: { type: 'array', items: mustDrawSchema },
                    sourceBindings: { type: 'array', items: sourceBindingSchema },
                    unsupported: { type: 'array', items: { type: 'string' } }
                },
                required: [
                    'diagramType',
                    'sourceHasPrintedFigure',
                    'constructionSummary',
                    'confidence',
                    'nodes',
                    'relations',
                    'mustDraw',
                    'sourceBindings',
                    'unsupported'
                ],
                additionalProperties: false
            }
        },
        required: ['scene'],
        additionalProperties: false
    }
};

export const PROBLEM_SCENE_SYSTEM_PROMPT = [
    'You read Korean math problem images and return a compact, source-grounded scene plan.',
    'Do not solve the question and do not state the requested final answer.',
    'First identify every point, segment, line, curve, circle, arc, region, solid, axis, label, and construction that the source requires.',
    'Then choose a clear non-degenerate coordinate layout within -20 to 20 while preserving incidence, order, collinearity, containment, and the printed relative positions.',
    'Use direct point nodes for explicit or computed coordinates. Use pointOnLine or pointOnCircle when the source explicitly places a point on that object.',
    'A single capital letter printed beside a curve, circle, or arc with no dot is that object\'s name, not a point. Never create a point node for an object name label.',
    'When named points lie on one circle, make the incidence structural: build the circle with circleThreePoints through the named points, or place the points with pointOnCircle. A circle given as center and radius must have its declared on-circle points exactly at radius distance.',
    'A point that a sourceBinding declares on a curve or axis must satisfy that equation with its coordinates. MathGraph verifies every declared incidence numerically and rejects the scene otherwise.',
    'Every scene item id must be globally unique across nodes and relations.',
    'A named intersection must exist only as an intersection relation. Never also create a point node with the same id or label; use distinct hidden helper points to define its line.',
    'Relations create reusable scene ids. A later line, segment, polygon, circle, or relation may reference a midpoint or intersection relation id directly; never create a coordinate-duplicate helper point merely to use that result downstream.',
    'Respect the Korean source distinction: 직선 means line and 선분 means segment. For a second intersection with a line or circle, use one intersection relation with the branch that selects the point other than the already named intersection.',
    'Every marker or dimension must reference real scene objects. For example, AD=BC requires segment nodes AD and BC before an equalLengthMarker, and a requested angle requires the segments or rays that visibly define it.',
    'Treat equal-length statements as equivalence classes. Keep independent classes separate: AB=AC and AD=BC are two groups, not AB=AC=AD=BC.',
    'For angle notation ∠XYZ, Y is the vertex and angleDimension refs must be [Y,X,Z]. Display an angle explicitly stated in the source at that same vertex; never replace it with a derived angle at another vertex.',
    'When a point splits a named side, keep the whole side as a segment when a source condition names it; never substitute a subsegment such as CD for AC.',
    'When the question names an angle to find, draw both legs from its vertex even when one is absent from the printed sketch. Do not display its answer value.',
    'Unlabeled construction helpers must have label=null and visible=false. Shading polygons and outline polygons must have label=null unless the source explicitly prints a region name.',
    'Order is not important; MathGraph resolves dependencies locally.',
    'Use mustDraw as an audit list. Every required visual fact must name the scene nodeIds or relationIds that implement it.',
    'A printed shaded face or requested area region must be a polygon, sector, circularSegment, or lensRegion node with fillOpacity between 0.18 and 0.24.',
    'A semicircle must use an arc with mode minor or major, not a full circle alone.',
    'For compact items: refs contains referenced ids, groups contains grouped vertex ids, numbers contains numeric parameters, and text contains an expression or annotation.',
    'Do not copy long problem prose into the scene. Keep constructionSummary and evidence short and factual.'
].join('\n');

export function buildProblemScenePrompt(referencePrompt = '') {
    return [
        'Read the uploaded image as a math teacher preparing an editable supporting diagram.',
        'If the image already contains a diagram, reproduce its mathematical structure, including internal segments and shaded regions.',
        'If it contains only problem text, build the diagram that best exposes the explicitly stated relationships.',
        'Use these compact kind encodings:',
        '- point: numbers=[x,y]',
        '- pointOnLine: refs=[lineId], numbers=[t] with 0<=t<=1 for a segment',
        '- pointOnCircle: refs=[circleId], numbers=[angleRadians]',
        '- segment/line/ray/vector: refs=[firstPointId,secondPointId]',
        '- circle: refs=[centerId,throughPointId], or refs=[centerId], numbers=[radius]',
        '- circleThreePoints: refs=[point1Id,point2Id,point3Id]',
        '- arc/sector/circularSegment: refs=[circleId,startPointId,endPointId], text=minor or major',
        '- polygon: refs=[vertex ids in boundary order]',
        '- function: text=right-hand expression, numbers optionally [xMin,xMax,yMin,yMax]',
        '- ellipse: numbers=[x,y,radiusX,radiusY,rotation?]',
        '- hyperbola: numbers=[x,y,a,b,rotation?], text=horizontal or vertical',
        '- parabola: numbers=[x,y,p,rotation?], text=right/left/up/down',
        '- prism: groups=[baseVertexIds,topVertexIds]',
        '- pyramid: groups=[baseVertexIds], refs=[apexId]',
        '- cylinder/cone/sphere: numbers=[x,y,width,height,ellipseRatio?]',
        '- textLabel: numbers=[x,y], text=short annotation',
        '- relations use refs in the order implied by intersection, midpoint, parallel, perpendicular, rightAngleMarker, equalLengthMarker, angleDimension, lengthDimension, tangentCircle, or tangentFunction.',
        '- for ∠XYZ, angleDimension refs=[Y,X,Z]. Keep every explicitly stated angle at its stated vertex instead of substituting a derived angle.',
        '- keep independent equal-length groups separate; MathGraph assigns different tick counts to different equivalence classes.',
        '- relation ids are valid refs for later items; for example midpoint M -> line BM -> intersection D -> polygon using D.',
        referencePrompt
    ].filter(Boolean).join('\n\n');
}

export function compileProblemScenePayload(payload) {
    const scene = payload?.scene || payload || {};
    const compiled = compileSceneGraph(scene, { compact: true });
    normalizeSharedDefinitionIntersectionBranches(compiled.operations);
    normalizeEqualLengthMarkerTickCounts(compiled.operations);
    return {
        ...compiled,
        sourceBindings: Array.isArray(scene.sourceBindings) ? scene.sourceBindings : [],
        scene
    };
}

export function normalizeEqualLengthMarkerTickCounts(operations = []) {
    const markers = operations.filter(operation => (
        operation?.type === 'equalLengthMarker' &&
        operation.segment1Id &&
        operation.segment2Id
    ));
    if (markers.length === 0) return;

    const parent = new Map();
    const ensure = id => {
        if (!parent.has(id)) parent.set(id, id);
    };
    const find = id => {
        ensure(id);
        let root = id;
        while (parent.get(root) !== root) root = parent.get(root);
        let current = id;
        while (parent.get(current) !== current) {
            const next = parent.get(current);
            parent.set(current, root);
            current = next;
        }
        return root;
    };
    const union = (left, right) => {
        const leftRoot = find(left);
        const rightRoot = find(right);
        if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
    };

    for (const marker of markers) {
        union(marker.segment1Id, marker.segment2Id);
    }

    const tickCountByRoot = new Map();
    for (const marker of markers) {
        const root = find(marker.segment1Id);
        if (!tickCountByRoot.has(root)) {
            tickCountByRoot.set(root, tickCountByRoot.size + 1);
        }
        marker.tickCount = tickCountByRoot.get(root);
    }
}

export function normalizeSharedDefinitionIntersectionBranches(operations = []) {
    const operationMap = new Map(
        operations.filter(operation => operation?.id).map(operation => [operation.id, operation])
    );
    const pointPositions = resolveStaticPointPositions(operations, operationMap);

    for (const operation of operations) {
        if (operation?.type !== 'intersection') continue;
        const object1 = operationMap.get(operation.object1Id);
        const object2 = operationMap.get(operation.object2Id);
        const circle = isCircleOperation(object1) ? object1 : (isCircleOperation(object2) ? object2 : null);
        const line = isLineOperation(object1) ? object1 : (isLineOperation(object2) ? object2 : null);
        if (!circle || !line) continue;

        const sharedPointIds = circleBoundaryPointIds(circle)
            .filter(id => linePointIds(line).includes(id));
        if (sharedPointIds.length !== 1 || sharedPointIds[0] === operation.id) continue;

        const lineGeometry = resolveLineGeometry(line, pointPositions);
        const circleGeometry = resolveCircleGeometry(circle, pointPositions);
        const sharedPosition = pointPositions.get(sharedPointIds[0]);
        if (!lineGeometry || !circleGeometry || !sharedPosition) continue;

        let candidates = Geometry.lineCircleIntersection(
            lineGeometry.point1,
            lineGeometry.point2,
            circleGeometry.center,
            circleGeometry.radius
        );
        if (line.type === 'segment') {
            candidates = candidates.filter(point => lineParameter(lineGeometry, point) >= -1e-7 && lineParameter(lineGeometry, point) <= 1 + 1e-7);
        } else if (line.type === 'ray') {
            candidates = candidates.filter(point => lineParameter(lineGeometry, point) >= -1e-7);
        }
        if (candidates.length !== 2) continue;

        const sharedBranch = candidates.findIndex(point => point.distanceTo(sharedPosition) <= 1e-5);
        if (sharedBranch < 0) continue;
        operation.branch = sharedBranch === 0 ? 1 : 0;
    }
}

function resolveStaticPointPositions(operations, operationMap) {
    const positions = new Map();
    for (const operation of operations) {
        if (operation?.type === 'point' && Number.isFinite(operation.x) && Number.isFinite(operation.y)) {
            positions.set(operation.id, new Vec2(operation.x, operation.y));
        }
    }

    let changed = true;
    while (changed) {
        changed = false;
        for (const operation of operations) {
            if (!operation?.id || positions.has(operation.id)) continue;
            let position = null;
            if (operation.type === 'midpoint') {
                const segment = operationMap.get(operation.segmentId);
                const geometry = resolveLineGeometry(segment, positions);
                if (geometry) position = geometry.point1.add(geometry.point2).div(2);
            } else if (operation.type === 'pointOnLine') {
                const line = operationMap.get(operation.lineId);
                const geometry = resolveLineGeometry(line, positions);
                if (geometry && Number.isFinite(operation.t)) {
                    position = geometry.point1.add(geometry.point2.sub(geometry.point1).mul(operation.t));
                }
            } else if (operation.type === 'pointOnCircle') {
                const circle = operationMap.get(operation.circleId);
                const geometry = resolveCircleGeometry(circle, positions);
                if (geometry && Number.isFinite(operation.angle)) {
                    position = geometry.center.add(new Vec2(
                        Math.cos(operation.angle) * geometry.radius,
                        Math.sin(operation.angle) * geometry.radius
                    ));
                }
            }
            if (position) {
                positions.set(operation.id, position);
                changed = true;
            }
        }
    }
    return positions;
}

function resolveLineGeometry(operation, pointPositions) {
    if (!isLineOperation(operation)) return null;
    const ids = linePointIds(operation);
    const point1 = pointPositions.get(ids[0]);
    const point2 = pointPositions.get(ids[1]);
    return point1 && point2 ? { point1, point2 } : null;
}

function resolveCircleGeometry(operation, pointPositions) {
    if (!isCircleOperation(operation)) return null;
    if (operation.type === 'circle') {
        const center = pointPositions.get(operation.centerId);
        const through = pointPositions.get(operation.pointOnCircleId);
        return center && through ? { center, radius: center.distanceTo(through) } : null;
    }

    const point1 = pointPositions.get(operation.point1Id);
    const point2 = pointPositions.get(operation.point2Id);
    const point3 = pointPositions.get(operation.point3Id);
    if (!point1 || !point2 || !point3) return null;
    const denominator = 2 * (
        point1.x * (point2.y - point3.y) +
        point2.x * (point3.y - point1.y) +
        point3.x * (point1.y - point2.y)
    );
    if (Math.abs(denominator) <= 1e-9) return null;
    const p1Sq = point1.x * point1.x + point1.y * point1.y;
    const p2Sq = point2.x * point2.x + point2.y * point2.y;
    const p3Sq = point3.x * point3.x + point3.y * point3.y;
    const center = new Vec2(
        (p1Sq * (point2.y - point3.y) + p2Sq * (point3.y - point1.y) + p3Sq * (point1.y - point2.y)) / denominator,
        (p1Sq * (point3.x - point2.x) + p2Sq * (point1.x - point3.x) + p3Sq * (point2.x - point1.x)) / denominator
    );
    return { center, radius: center.distanceTo(point1) };
}

function isLineOperation(operation) {
    return ['segment', 'line', 'ray'].includes(operation?.type);
}

function isCircleOperation(operation) {
    return ['circle', 'circleThreePoints'].includes(operation?.type);
}

function linePointIds(operation) {
    if (operation?.type === 'ray') return [operation.originId, operation.directionPointId].filter(Boolean);
    return [operation?.point1Id, operation?.point2Id].filter(Boolean);
}

function circleBoundaryPointIds(operation) {
    if (operation?.type === 'circle') return [operation.pointOnCircleId].filter(Boolean);
    return [operation?.point1Id, operation?.point2Id, operation?.point3Id].filter(Boolean);
}

function lineParameter(lineGeometry, point) {
    const direction = lineGeometry.point2.sub(lineGeometry.point1);
    const denominator = direction.dot(direction);
    if (denominator <= 1e-12) return Number.NaN;
    return point.sub(lineGeometry.point1).dot(direction) / denominator;
}

export function validateProblemSceneCoverage(scene, compiled) {
    const errors = [];
    const operations = Array.isArray(compiled?.operations) ? compiled.operations : [];
    const operationIds = new Set(operations.map(operation => operation?.id).filter(Boolean));
    const sceneItems = [
        ...(Array.isArray(scene?.nodes) ? scene.nodes : []),
        ...(Array.isArray(scene?.relations) ? scene.relations : [])
    ];
    const sceneIds = new Set(sceneItems.map(item => item?.id).filter(Boolean));
    const mustDraw = Array.isArray(scene?.mustDraw) ? scene.mustDraw : [];

    const seenIds = new Set();
    const seenPointLabels = new Set();
    const pointKinds = new Set(['point', 'pointonline', 'pointonsegment', 'pointoncircle', 'intersection', 'midpoint']);
    for (const item of sceneItems) {
        if (!item?.id) continue;
        if (seenIds.has(item.id)) {
            errors.push(`scene id "${item.id}" is duplicated across nodes or relations.`);
        }
        seenIds.add(item.id);

        const kind = String(item.kind || item.type || '').toLowerCase().replace(/[\s_-]+/g, '');
        const label = typeof item.label === 'string' ? item.label.trim() : '';
        if (label && pointKinds.has(kind)) {
            if (seenPointLabels.has(label)) {
                errors.push(`named point label "${label}" is duplicated across scene items.`);
            }
            seenPointLabels.add(label);
        }
    }

    if (operations.length === 0) {
        errors.push('problem scene compiled to an empty operations array.');
    }
    if (mustDraw.length === 0) {
        errors.push('problem scene mustDraw audit list is empty.');
    }

    for (const item of mustDraw.filter(entry => entry?.required !== false)) {
        const bindings = [...(item.nodeIds || []), ...(item.relationIds || [])].filter(Boolean);
        const description = `${item.description || ''} ${item.evidence || ''}`;
        if (bindings.length === 0) {
            errors.push(`required scene item "${item.id || item.description}" has no bound scene ids.`);
            continue;
        }
        for (const id of bindings) {
            if (!sceneIds.has(id)) {
                errors.push(`required scene item "${item.id || item.description}" references unknown scene id "${id}".`);
            } else if (!operationIds.has(id)) {
                errors.push(`required scene id "${id}" was not compiled into GraphA operations.`);
            }
        }

        const boundOperations = operations.filter(operation => bindings.includes(operation.id));
        if (/shade|shaded|fill|색칠|음영/i.test(description)) {
            const hasVisibleFill = boundOperations.some(operation =>
                ['polygon', 'sector', 'circularSegment', 'lensRegion'].includes(operation.type) &&
                Number(operation.fillOpacity) >= 0.05
            );
            if (!hasVisibleFill) {
                errors.push(`required shaded scene item "${item.id || item.description}" has no filled region operation.`);
            }
        }
        if (/semicircle|half.?circle|반원/i.test(description) &&
            !boundOperations.some(operation => ['arc', 'sector', 'circularSegment'].includes(operation.type))) {
            errors.push(`required semicircle scene item "${item.id || item.description}" has no arc operation.`);
        }
    }

    for (const warning of compiled?.warnings || []) {
        if (/skipped|unresolved|duplicate/i.test(String(warning))) {
            errors.push(String(warning));
        }
    }
    errors.push(...validateResolvedEqualLengthMarkers(operations));
    errors.push(...validateRequiredAngleLegs(scene, operations));
    errors.push(...validateSourceBindingIncidence(scene, operations));

    return { valid: errors.length === 0, errors };
}

/**
 * sourceBindings가 선언한 점-객체 소속 관계를 컴파일된 좌표로 검산합니다.
 * 좌표를 확정할 수 없거나 대상 객체가 모호하면 검사하지 않습니다(오탐 방지).
 */
export function validateSourceBindingIncidence(scene, operations = []) {
    const bindings = Array.isArray(scene?.sourceBindings) ? scene.sourceBindings : [];
    if (bindings.length === 0) return [];

    const operationMap = new Map(
        operations.filter(operation => operation?.id).map(operation => [operation.id, operation])
    );
    const pointPositions = resolveStaticPointPositions(operations, operationMap);
    const pointTypes = new Set(['point', 'pointOnLine', 'pointOnCircle', 'midpoint', 'intersection']);
    const pointByName = new Map();
    for (const operation of operations) {
        if (!pointTypes.has(operation?.type)) continue;
        for (const name of [operation.label, operation.id]) {
            const trimmed = typeof name === 'string' ? name.trim() : '';
            if (trimmed && !pointByName.has(trimmed)) pointByName.set(trimmed, operation);
        }
    }

    const circles = operations.filter(isCircleOperation);
    const errors = [];

    for (const binding of bindings) {
        const pointLabel = typeof binding?.pointLabel === 'string' ? binding.pointLabel.trim() : '';
        const pointOperation = pointByName.get(pointLabel);
        const position = pointOperation ? pointPositions.get(pointOperation.id) : null;
        if (!pointLabel || !position) continue;
        // 구성 자체가 소속을 보장하는 경우는 검산이 불필요합니다.
        const structurallyBound = new Set([
            pointOperation.circleId,
            pointOperation.lineId,
            pointOperation.object1Id,
            pointOperation.object2Id
        ].filter(Boolean));

        for (const rawLabel of Array.isArray(binding.onObjectLabels) ? binding.onObjectLabels : []) {
            const normalized = normalizeIncidenceLabel(rawLabel);
            if (!normalized) continue;

            if (normalized === 'x-axis') {
                if (Math.abs(position.y) > 0.05) {
                    errors.push(`sourceBinding point "${pointLabel}" is declared on "x-axis" but resolves to y=${formatGeometryLength(position.y)} (tolerance 0.05).`);
                }
                continue;
            }
            if (normalized === 'y-axis') {
                if (Math.abs(position.x) > 0.05) {
                    errors.push(`sourceBinding point "${pointLabel}" is declared on "y-axis" but resolves to x=${formatGeometryLength(position.x)} (tolerance 0.05).`);
                }
                continue;
            }

            const circle = resolveIncidenceCircle(normalized, circles);
            if (circle) {
                if (structurallyBound.has(circle.id)) continue;
                const geometry = resolveCircleGeometry(circle, pointPositions);
                if (!geometry) continue;
                const distanceFromCenter = geometry.center.distanceTo(position);
                const difference = Math.abs(distanceFromCenter - geometry.radius);
                const tolerance = Math.max(0.05, geometry.radius * 0.03);
                if (difference > tolerance) {
                    errors.push(`sourceBinding point "${pointLabel}" is declared on circle "${circle.id}" but resolved center distance ${formatGeometryLength(distanceFromCenter)} differs from radius ${formatGeometryLength(geometry.radius)} by ${formatGeometryLength(difference)} (tolerance ${formatGeometryLength(tolerance)}).`);
                }
                continue;
            }

            const functionOperation = resolveIncidenceFunction(normalized, operations);
            if (functionOperation) {
                let value;
                try {
                    value = FunctionParser.parse(functionOperation.expression)(position.x);
                } catch {
                    continue;
                }
                if (!Number.isFinite(value)) continue;
                const difference = Math.abs(value - position.y);
                const tolerance = Math.max(0.1, Math.abs(value) * 0.03);
                if (difference > tolerance) {
                    errors.push(`sourceBinding point "${pointLabel}" is declared on "${String(rawLabel).trim()}" but the curve gives y=${formatGeometryLength(value)} at x=${formatGeometryLength(position.x)} while the point has y=${formatGeometryLength(position.y)} (difference ${formatGeometryLength(difference)}, tolerance ${formatGeometryLength(tolerance)}).`);
                }
            }
        }
    }

    return errors;
}

function normalizeIncidenceLabel(value) {
    const text = String(value ?? '').toLowerCase().replace(/[\s$]+/g, '');
    if (!text) return '';
    if (/^(x-?axis|x축)$/.test(text)) return 'x-axis';
    if (/^(y-?axis|y축)$/.test(text)) return 'y-axis';
    if (/^(circle|원)$/.test(text)) return 'circle';
    return text;
}

function resolveIncidenceCircle(normalizedLabel, circles) {
    const matched = circles.filter(circle =>
        normalizeIncidenceLabel(circle.label) === normalizedLabel ||
        normalizeIncidenceLabel(circle.id) === normalizedLabel
    );
    if (matched.length === 1) return matched[0];
    if (normalizedLabel === 'circle' && circles.length === 1) return circles[0];
    return null;
}

function resolveIncidenceFunction(normalizedLabel, operations) {
    const functions = operations.filter(operation =>
        operation?.type === 'function' && typeof operation.expression === 'string'
    );
    const matched = functions.filter(operation => {
        const candidates = [
            operation.label,
            operation.id,
            operation.expression,
            `y=${operation.expression}`
        ];
        return candidates.some(candidate => normalizeIncidenceLabel(candidate) === normalizedLabel);
    });
    return matched.length === 1 ? matched[0] : null;
}

function validateResolvedEqualLengthMarkers(operations) {
    const operationMap = new Map(
        operations.filter(operation => operation?.id).map(operation => [operation.id, operation])
    );
    const pointPositions = resolveStaticPointPositions(operations, operationMap);
    const errors = [];

    for (const marker of operations) {
        if (marker?.type !== 'equalLengthMarker') continue;

        const firstSegment = operationMap.get(marker.segment1Id);
        const secondSegment = operationMap.get(marker.segment2Id);
        if (!firstSegment || !secondSegment) continue;
        if (firstSegment.type !== 'segment' || secondSegment.type !== 'segment') {
            errors.push(`equalLengthMarker "${marker.id || marker.segment1Id}" must reference finite segment operations.`);
            continue;
        }

        const firstGeometry = resolveLineGeometry(firstSegment, pointPositions);
        const secondGeometry = resolveLineGeometry(secondSegment, pointPositions);
        if (!firstGeometry || !secondGeometry) continue;

        const firstLength = firstGeometry.point1.distanceTo(firstGeometry.point2);
        const secondLength = secondGeometry.point1.distanceTo(secondGeometry.point2);
        if (!Number.isFinite(firstLength) || !Number.isFinite(secondLength)) continue;

        const difference = Math.abs(firstLength - secondLength);
        const tolerance = Math.max(0.04, Math.max(firstLength, secondLength) * 0.015);
        if (difference <= tolerance) continue;

        errors.push(
            `equalLengthMarker "${marker.id || marker.segment1Id}" references ${firstSegment.id} and ${secondSegment.id}, but resolved length ${firstSegment.id}=${formatGeometryLength(firstLength)} and ${secondSegment.id}=${formatGeometryLength(secondLength)} differ by ${formatGeometryLength(difference)} (tolerance ${formatGeometryLength(tolerance)}).`
        );
    }

    return errors;
}

function formatGeometryLength(value) {
    return Number(value.toFixed(3)).toString();
}

function validateRequiredAngleLegs(scene, operations) {
    const pointIdsByName = collectPointIdsByName(operations);
    const requiredItems = Array.isArray(scene?.mustDraw)
        ? scene.mustDraw.filter(item => item?.required !== false)
        : [];
    const errors = new Set();

    for (const item of requiredItems) {
        const text = `${item.description || ''} ${item.evidence || ''}`;
        for (const angleName of extractAngleNames(text)) {
            const [firstPointName, vertexName, secondPointName] = [...angleName];
            const vertexIds = pointIdsByName.get(vertexName);
            const firstPointIds = pointIdsByName.get(firstPointName);
            const secondPointIds = pointIdsByName.get(secondPointName);
            if (!vertexIds?.size || !firstPointIds?.size || !secondPointIds?.size) continue;

            if (!hasDrawnAngleLeg(operations, vertexIds, firstPointIds)) {
                errors.add(`required angle \u2220${angleName} has no drawn leg ${vertexName}${firstPointName}.`);
            }
            if (!hasDrawnAngleLeg(operations, vertexIds, secondPointIds)) {
                errors.add(`required angle \u2220${angleName} has no drawn leg ${vertexName}${secondPointName}.`);
            }
        }
    }

    return [...errors];
}

function collectPointIdsByName(operations) {
    const pointTypes = new Set(['point', 'pointOnLine', 'pointOnCircle', 'midpoint', 'intersection', 'circleCenterPoint']);
    const pointIdsByName = new Map();

    for (const operation of operations) {
        if (!pointTypes.has(operation?.type)) continue;
        for (const name of [operation.id, operation.label]) {
            const normalized = normalizeAnglePointName(name);
            if (!normalized) continue;
            if (!pointIdsByName.has(normalized)) pointIdsByName.set(normalized, new Set());
            pointIdsByName.get(normalized).add(operation.id);
        }
    }

    return pointIdsByName;
}

function extractAngleNames(text) {
    return [...String(text || '').matchAll(/\u2220\s*([A-Za-z])\s*([A-Za-z])\s*([A-Za-z])/g)]
        .map(match => `${match[1]}${match[2]}${match[3]}`.toUpperCase());
}

function hasDrawnAngleLeg(operations, vertexIds, armIds) {
    return operations.some(operation => {
        if (operation?.visible === false) return false;
        if (isLineOperation(operation)) {
            const [firstId, secondId] = linePointIds(operation);
            return connectsPointSets(firstId, secondId, vertexIds, armIds);
        }
        if (operation?.type === 'polygon' && Array.isArray(operation.vertexIds)) {
            const vertexIdsInPolygon = operation.vertexIds;
            return vertexIdsInPolygon.some((pointId, index) => {
                const nextPointId = vertexIdsInPolygon[(index + 1) % vertexIdsInPolygon.length];
                return connectsPointSets(pointId, nextPointId, vertexIds, armIds);
            });
        }
        return false;
    });
}

function connectsPointSets(firstId, secondId, vertexIds, armIds) {
    return (vertexIds.has(firstId) && armIds.has(secondId)) ||
        (vertexIds.has(secondId) && armIds.has(firstId));
}

function normalizeAnglePointName(value) {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
}
