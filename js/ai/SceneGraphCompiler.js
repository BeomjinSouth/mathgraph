/**
 * SceneGraphCompiler.js - high-level math scene to GraphA operations compiler.
 *
 * Image/PDF reconstruction should not depend on a model directly authoring the
 * final low-level operations. This compiler is the app-owned bridge from a
 * structured scene description into the existing GraphA patch contract.
 */

import { SchemaValidator } from './SchemaValidator.js';

const COMMON_FIELDS = [
    'label',
    'color',
    'visible',
    'lineWidth',
    'pointSize',
    'fontSize',
    'dashed',
    'fillColor',
    'fillOpacity',
    'showLabel',
    'locked',
    'labelOffset'
];

const NODE_KIND_ALIASES = new Map(Object.entries({
    point: 'point',
    point2d: 'point',
    segment: 'segment',
    linesegment: 'segment',
    line: 'line',
    ray: 'ray',
    vector: 'vector',
    arrow: 'vector',
    directedsegment: 'vector',
    directionarrow: 'vector',
    annotationarrow: 'vector',
    circle: 'circle',
    circlethreepoints: 'circleThreePoints',
    circumcircle: 'circleThreePoints',
    arc: 'arc',
    sector: 'sector',
    circularsegment: 'circularSegment',
    lens: 'lensRegion',
    lensregion: 'lensRegion',
    circleintersectionregion: 'lensRegion',
    polygon: 'polygon',
    triangle: 'polygon',
    quadrilateral: 'polygon',
    function: 'function',
    graphfunction: 'function',
    numberline: 'numberLine',
    prism: 'prism',
    rectangularprism: 'prism',
    triangularprism: 'prism',
    pyramid: 'pyramid',
    cylinder: 'cylinder',
    cone: 'cone',
    sphere: 'sphere',
    textlabel: 'textLabel',
    text: 'textLabel'
}));

const RELATION_KIND_ALIASES = new Map(Object.entries({
    intersection: 'intersection',
    midpoint: 'midpoint',
    parallel: 'parallel',
    perpendicular: 'perpendicular',
    perpendicularbisector: 'perpendicularBisector',
    anglebisector: 'angleBisector',
    rightangle: 'rightAngleMarker',
    rightanglemarker: 'rightAngleMarker',
    equallength: 'equalLengthMarker',
    equallengthmarker: 'equalLengthMarker',
    angledimension: 'angleDimension',
    anglemeasure: 'angleDimension',
    lengthdimension: 'lengthDimension',
    lengthmeasure: 'lengthDimension',
    tangentcircle: 'tangentCircle',
    tangentfunction: 'tangentFunction'
}));

const UNSUPPORTED_NODE_KINDS = new Set([
    'histogram',
    'scatterplot',
    'boxplot',
    'dotplot',
    'table',
    'image'
]);

export const SCENE_GRAPH_SUPPORTED_NODE_KINDS = [
    'point',
    'segment',
    'line',
    'ray',
    'vector',
    'circle',
    'circleThreePoints',
    'arc',
    'sector',
    'circularSegment',
    'lensRegion',
    'polygon',
    'function',
    'numberLine',
    'prism',
    'pyramid',
    'cylinder',
    'cone',
    'sphere',
    'textLabel'
];

export const SCENE_GRAPH_SUPPORTED_RELATION_KINDS = [
    'intersection',
    'midpoint',
    'parallel',
    'perpendicular',
    'perpendicularBisector',
    'angleBisector',
    'rightAngleMarker',
    'equalLengthMarker',
    'angleDimension',
    'lengthDimension',
    'tangentCircle',
    'tangentFunction'
];

export class SceneGraphCompiler {
    constructor(options = {}) {
        this.options = options;
        this.reset();
    }

    reset() {
        this.operations = [];
        this.warnings = [];
        this.pointPositions = new Map();
        this.createdIds = new Set();
        this.idCounter = 0;
    }

    compile(scene, options = {}) {
        this.reset();
        this.options = { ...this.options, ...options };

        const nodes = Array.isArray(scene?.nodes) ? scene.nodes : [];
        const relations = Array.isArray(scene?.relations) ? scene.relations : [];
        const unsupported = Array.isArray(scene?.unsupported) ? scene.unsupported : [];

        for (const item of unsupported) {
            this.addUnsupportedWarning(item, 'scene.unsupported');
        }

        for (const node of nodes) {
            if (normalizeNodeKind(node?.kind ?? node?.type) === 'point') {
                this.addNode(node);
            }
        }

        for (const node of nodes) {
            if (normalizeNodeKind(node?.kind ?? node?.type) !== 'point') {
                this.addNode(node);
            }
        }

        for (const relation of relations) {
            this.addRelation(relation);
        }

        return {
            operations: this.operations,
            warnings: this.warnings,
            metadata: {
                nodeCount: nodes.length,
                relationCount: relations.length,
                operationCount: this.operations.length
            }
        };
    }

    compilePatch(patch, options = {}) {
        this.reset();
        this.options = { ...this.options, ...options };

        const selectedIds = new Set(
            (options.selectedObjectIds || patch?.selectedObjectIds || [])
                .filter(id => typeof id === 'string' && id.trim())
        );
        const strictSelectedEdit = Boolean(options.strictSelectedEdit ?? patch?.strictSelectedEdit);

        for (const update of asArray(patch?.updates)) {
            const id = ref(update.id ?? update.targetId ?? update.nodeId);
            if (!id) {
                this.warn('Patch update skipped because it has no target id.');
                continue;
            }
            if (strictSelectedEdit && selectedIds.size > 0 && !selectedIds.has(id)) {
                this.warn(`Patch update for unselected id "${id}" skipped by strict selected-edit mode.`);
                continue;
            }
            this.addOperation({
                op: 'update',
                id,
                ...copyAllowedUpdateFields(update)
            });
        }

        for (const deletion of asArray(patch?.deletes ?? patch?.deletions)) {
            const id = ref(deletion.id ?? deletion.targetId ?? deletion.nodeId ?? deletion);
            if (!id) {
                this.warn('Patch delete skipped because it has no target id.');
                continue;
            }
            if (strictSelectedEdit && selectedIds.size > 0 && !selectedIds.has(id)) {
                this.warn(`Patch delete for unselected id "${id}" skipped by strict selected-edit mode.`);
                continue;
            }
            this.addOperation({ op: 'delete', id });
        }

        const createNodes = asArray(patch?.creates);
        if (strictSelectedEdit && createNodes.length > 0) {
            this.warn('Patch creates were skipped by strict selected-edit mode.');
        } else if (createNodes.length > 0) {
            const createCompiler = new SceneGraphCompiler(this.options);
            const created = createCompiler.compile({ nodes: createNodes, relations: patch.relations || [] }, options);
            this.operations.push(...created.operations);
            this.warnings.push(...created.warnings);
        }

        return {
            operations: this.operations,
            warnings: this.warnings,
            metadata: {
                nodeCount: 0,
                relationCount: 0,
                operationCount: this.operations.length
            }
        };
    }

    validateCompiled(compiled, existingIds = new Set()) {
        const payload = Array.isArray(compiled)
            ? { operations: compiled }
            : { operations: compiled?.operations || [] };
        const validator = new SchemaValidator();
        return {
            schema: validator.validate(payload),
            references: validator.validateReferences(payload, existingIds)
        };
    }

    addNode(node) {
        if (!node || typeof node !== 'object') {
            this.warn('Scene node skipped because it is not an object.');
            return;
        }

        const rawKind = node.kind ?? node.type;
        const normalizedKey = normalizeKey(rawKind);
        const kind = normalizeNodeKind(rawKind);

        if (UNSUPPORTED_NODE_KINDS.has(normalizedKey)) {
            this.addUnsupportedWarning(node, `node:${node.id || normalizedKey}`);
            return;
        }

        if (!kind) {
            this.warn(`Scene node "${node.id || '(no id)'}" skipped because it has no kind.`);
            return;
        }

        switch (kind) {
            case 'point':
                this.addPoint(node);
                break;
            case 'segment':
            case 'line':
                this.addTwoPointObject(node, kind, ['point1Id', 'point1', 'from', 'start'], ['point2Id', 'point2', 'to', 'end']);
                break;
            case 'ray':
                this.addTwoPointObject(node, kind, ['originId', 'origin', 'from', 'start'], ['directionPointId', 'directionPoint', 'to', 'end']);
                break;
            case 'vector':
                this.addTwoPointObject(node, kind, ['startPointId', 'startPoint', 'from', 'start'], ['endPointId', 'endPoint', 'to', 'end']);
                break;
            case 'circle':
                this.addCircle(node);
                break;
            case 'circleThreePoints':
                this.addCircleThreePoints(node);
                break;
            case 'arc':
            case 'sector':
            case 'circularSegment':
                this.addCircleRegion(node, kind);
                break;
            case 'lensRegion':
                this.addLensRegion(node);
                break;
            case 'polygon':
                this.addPolygon(node);
                break;
            case 'function':
                this.addFunction(node);
                break;
            case 'numberLine':
                this.addNumberLine(node);
                break;
            case 'prism':
                this.addPrism(node);
                break;
            case 'pyramid':
                this.addPyramid(node);
                break;
            case 'cylinder':
            case 'cone':
            case 'sphere':
                this.addCurvedSolid(node, kind);
                break;
            case 'textLabel':
                this.addTextLabel(node);
                break;
            default:
                this.warn(`Scene node "${node.id || rawKind}" has unsupported kind "${rawKind}".`);
        }
    }

    addRelation(relation) {
        if (!relation || typeof relation !== 'object') {
            this.warn('Scene relation skipped because it is not an object.');
            return;
        }

        const kind = normalizeRelationKind(relation.kind ?? relation.type);
        if (!kind) {
            this.warn(`Scene relation "${relation.id || '(no id)'}" skipped because it has no kind.`);
            return;
        }

        switch (kind) {
            case 'intersection':
                this.addRelationObject(relation, 'intersection', {
                    object1Id: ['object1Id', 'object1', 'line1', 'curve1'],
                    object2Id: ['object2Id', 'object2', 'line2', 'curve2']
                }, {
                    ...(Number.isInteger(numberFrom(relation.branch))
                        ? { branch: numberFrom(relation.branch) }
                        : {})
                });
                break;
            case 'midpoint':
                this.addRelationObject(relation, 'midpoint', {
                    segmentId: ['segmentId', 'segment']
                });
                break;
            case 'parallel':
            case 'perpendicular':
                this.addRelationObject(relation, kind, {
                    baseLineId: ['baseLineId', 'baseLine', 'line', 'lineId'],
                    throughPointId: ['throughPointId', 'throughPoint', 'point', 'pointId']
                });
                break;
            case 'perpendicularBisector':
                this.addRelationObject(relation, 'perpendicularBisector', {
                    segmentId: ['segmentId', 'segment']
                });
                break;
            case 'angleBisector':
                this.addRelationObject(relation, 'angleBisector', {
                    line1Id: ['line1Id', 'line1'],
                    line2Id: ['line2Id', 'line2']
                });
                break;
            case 'rightAngleMarker':
                this.addRelationObject(relation, 'rightAngleMarker', {
                    vertexId: ['vertexId', 'vertex'],
                    line1Id: ['line1Id', 'line1', 'side1'],
                    line2Id: ['line2Id', 'line2', 'side2']
                });
                break;
            case 'equalLengthMarker':
                this.addRelationObject(relation, 'equalLengthMarker', {
                    segment1Id: ['segment1Id', 'segment1', 'side1'],
                    segment2Id: ['segment2Id', 'segment2', 'side2']
                });
                break;
            case 'angleDimension':
                this.addRelationObject(relation, 'angleDimension', {
                    vertexId: ['vertexId', 'vertex'],
                    point1Id: ['point1Id', 'point1', 'start'],
                    point2Id: ['point2Id', 'point2', 'end']
                });
                break;
            case 'lengthDimension':
                this.addRelationObject(relation, 'lengthDimension', {
                    segmentId: ['segmentId', 'segment']
                });
                break;
            case 'tangentCircle':
                this.addRelationObject(relation, 'tangentCircle', {
                    circleId: ['circleId', 'circle'],
                    tangentPointId: ['tangentPointId', 'tangentPoint', 'point']
                });
                break;
            case 'tangentFunction':
                this.addRelationObject(relation, 'tangentFunction', {
                    functionId: ['functionId', 'function']
                }, {
                    x: numberFrom(relation.x ?? relation.atX)
                });
                break;
            default:
                this.warn(`Scene relation "${relation.id || kind}" has unsupported kind "${relation.kind || relation.type}".`);
        }
    }

    addPoint(node, forced = {}) {
        const id = forced.id || this.nodeId(node, 'point');
        if (this.createdIds.has(id)) {
            this.warn(`Duplicate point id "${id}" skipped.`);
            return null;
        }

        const x = numberFrom(forced.x ?? node.x ?? node.position?.x ?? node.coordinates?.x);
        const y = numberFrom(forced.y ?? node.y ?? node.position?.y ?? node.coordinates?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            this.warn(`Point "${id}" skipped because x/y coordinates are missing.`);
            return null;
        }

        this.addOperation({
            op: 'create',
            id,
            type: 'point',
            x,
            y,
            ...commonFields(node),
            ...forced.commonFields
        });
        this.pointPositions.set(id, { x, y });
        this.createdIds.add(id);
        return id;
    }

    addTwoPointObject(node, type, firstAliases, secondAliases) {
        const id = this.nodeId(node, type);
        const first = ref(firstValue(node, firstAliases));
        const second = ref(firstValue(node, secondAliases));
        if (!first || !second) {
            this.warn(`${type} "${id}" skipped because endpoint references are missing.`);
            return;
        }

        const fields = type === 'ray'
            ? { originId: first, directionPointId: second }
            : type === 'vector'
                ? { startPointId: first, endPointId: second }
                : { point1Id: first, point2Id: second };

        this.addOperation({
            op: 'create',
            id,
            type,
            ...fields,
            ...commonFields(node)
        });
        this.createdIds.add(id);
    }

    addCircle(node) {
        const id = this.nodeId(node, 'circle');
        const centerId = ref(firstValue(node, ['centerId', 'center']));
        const pointOnCircleId = ref(firstValue(node, ['pointOnCircleId', 'pointOnCircle', 'through', 'radiusPoint']));

        if (centerId && pointOnCircleId) {
            this.addOperation({
                op: 'create',
                id,
                type: 'circle',
                centerId,
                pointOnCircleId,
                ...commonFields(node)
            });
            this.createdIds.add(id);
            return;
        }

        const threePointRefs = refsFrom(firstValue(node, ['points', 'throughPoints', 'pointIds']));
        if (threePointRefs.length >= 3) {
            this.addOperation({
                op: 'create',
                id,
                type: 'circleThreePoints',
                point1Id: threePointRefs[0],
                point2Id: threePointRefs[1],
                point3Id: threePointRefs[2],
                ...commonFields(node)
            });
            this.createdIds.add(id);
            return;
        }

        const radius = numberFrom(node.radius);
        const centerPosition = centerId ? this.pointPositions.get(centerId) : null;
        if (centerId && Number.isFinite(radius) && radius > 0 && centerPosition) {
            const supportId = `${id}_radius_point`;
            this.addPoint({ id: supportId, x: centerPosition.x + radius, y: centerPosition.y, showLabel: false }, {
                id: supportId,
                x: centerPosition.x + radius,
                y: centerPosition.y,
                commonFields: { showLabel: false, locked: true }
            });
            this.addOperation({
                op: 'create',
                id,
                type: 'circle',
                centerId,
                pointOnCircleId: supportId,
                ...commonFields(node)
            });
            this.createdIds.add(id);
            return;
        }

        this.warn(`Circle "${id}" skipped because it needs center+pointOnCircle, three points, or center+numeric radius with known center coordinates.`);
    }

    addCircleThreePoints(node) {
        const id = this.nodeId(node, 'circleThreePoints');
        const points = refsFrom(firstValue(node, ['points', 'throughPoints', 'pointIds']));
        const point1Id = ref(node.point1Id ?? node.point1) || points[0];
        const point2Id = ref(node.point2Id ?? node.point2) || points[1];
        const point3Id = ref(node.point3Id ?? node.point3) || points[2];
        if (!point1Id || !point2Id || !point3Id) {
            this.warn(`circleThreePoints "${id}" skipped because three point references are required.`);
            return;
        }
        this.addOperation({
            op: 'create',
            id,
            type: 'circleThreePoints',
            point1Id,
            point2Id,
            point3Id,
            ...commonFields(node)
        });
        this.createdIds.add(id);
    }

    addCircleRegion(node, type) {
        const id = this.nodeId(node, type);
        const circleId = ref(firstValue(node, ['circleId', 'circle']));
        const startPointId = ref(firstValue(node, ['startPointId', 'startPoint', 'start']));
        const endPointId = ref(firstValue(node, ['endPointId', 'endPoint', 'end']));
        if (!circleId || !startPointId || !endPointId) {
            this.warn(`${type} "${id}" skipped because circle/start/end references are required.`);
            return;
        }

        this.addOperation({
            op: 'create',
            id,
            type,
            circleId,
            startPointId,
            endPointId,
            ...(node.mode === 'major' || node.mode === 'minor' ? { mode: node.mode } : {}),
            ...commonFields(node)
        });
        this.createdIds.add(id);
    }

    addLensRegion(node) {
        const id = this.nodeId(node, 'lensRegion');
        const circleRefs = refsFrom(firstValue(node, ['circleIds', 'circles']));
        const circle1Id = ref(firstValue(node, ['circle1Id', 'circle1', 'firstCircle', 'leftCircle'])) || circleRefs[0];
        const circle2Id = ref(firstValue(node, ['circle2Id', 'circle2', 'secondCircle', 'rightCircle'])) || circleRefs[1];
        if (!circle1Id || !circle2Id) {
            this.warn(`lensRegion "${id}" skipped because two circle references are required.`);
            return;
        }

        this.addOperation({
            op: 'create',
            id,
            type: 'lensRegion',
            circle1Id,
            circle2Id,
            ...commonFields(node)
        });
        this.createdIds.add(id);
    }

    addPolygon(node) {
        const id = this.nodeId(node, 'polygon');
        const vertexIds = refsFrom(firstValue(node, ['vertexIds', 'vertices', 'points', 'pointIds']));
        if (vertexIds.length < 3) {
            this.warn(`Polygon "${id}" skipped because at least three vertex ids are required.`);
            return;
        }
        this.addOperation({
            op: 'create',
            id,
            type: 'polygon',
            vertexIds,
            ...commonFields(node)
        });
        this.createdIds.add(id);
    }

    addFunction(node) {
        const id = this.nodeId(node, 'function');
        const expression = normalizeFunctionExpression(firstString(node, ['expression', 'equation', 'formula']));
        if (!expression) {
            this.warn(`Function "${id}" skipped because expression is missing.`);
            return;
        }
        this.addOperation({
            op: 'create',
            id,
            type: 'function',
            expression,
            ...(Number.isFinite(numberFrom(node.xMin)) ? { xMin: numberFrom(node.xMin) } : {}),
            ...(Number.isFinite(numberFrom(node.xMax)) ? { xMax: numberFrom(node.xMax) } : {}),
            ...(Number.isFinite(numberFrom(node.yMin)) ? { yMin: numberFrom(node.yMin) } : {}),
            ...(Number.isFinite(numberFrom(node.yMax)) ? { yMax: numberFrom(node.yMax) } : {}),
            ...commonFields(node)
        });
        this.createdIds.add(id);
    }

    addNumberLine(node) {
        const id = this.nodeId(node, 'numberLine');
        const start = numberFrom(node.start ?? node.min);
        const end = numberFrom(node.end ?? node.max);
        const step = numberFrom(node.step ?? node.interval ?? 1);
        const y = numberFrom(node.y ?? node.yLine ?? 0);
        if (!Number.isFinite(start) || !Number.isFinite(end)) {
            this.warn(`Number line "${id}" skipped because start/end are required.`);
            return;
        }
        this.addOperation({
            op: 'create',
            id,
            type: 'numberLine',
            start,
            end,
            step: Number.isFinite(step) && step > 0 ? step : 1,
            y: Number.isFinite(y) ? y : 0,
            ...(node.showArrows !== undefined ? { showArrows: Boolean(node.showArrows) } : {}),
            ...(Number.isFinite(numberFrom(node.tickHeight)) ? { tickHeight: numberFrom(node.tickHeight) } : {}),
            ...(Array.isArray(node.customMarks) ? { customMarks: node.customMarks } : {}),
            ...commonFields(node)
        });
        this.createdIds.add(id);
    }

    addCurvedSolid(node, type) {
        const id = this.nodeId(node, type);
        const x = numberFrom(node.x ?? node.centerX ?? 0);
        const y = numberFrom(node.y ?? node.centerY ?? 0);
        const width = numberFrom(node.width ?? (Number.isFinite(numberFrom(node.radius)) ? numberFrom(node.radius) * 2 : undefined));
        const height = numberFrom(node.height ?? (type === 'sphere' ? width : undefined));
        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
            this.warn(`${type} "${id}" skipped because positive x/y/width/height values are required.`);
            return;
        }
        this.addOperation({
            op: 'create',
            id,
            type,
            x,
            y,
            width,
            height,
            ...(Number.isFinite(numberFrom(node.ellipseRatio)) ? { ellipseRatio: numberFrom(node.ellipseRatio) } : {}),
            ...(node.showHiddenLines !== undefined ? { showHiddenLines: Boolean(node.showHiddenLines) } : {}),
            ...commonFields(node)
        });
        this.createdIds.add(id);
    }

    addTextLabel(node) {
        const id = this.nodeId(node, 'textLabel');
        const text = String(node.text ?? node.content ?? '').trim();
        const x = numberFrom(node.x ?? 0);
        const y = numberFrom(node.y ?? 0);
        if (!text || !Number.isFinite(x) || !Number.isFinite(y)) {
            this.warn(`Text label "${id}" skipped because text and x/y are required.`);
            return;
        }
        this.addOperation({
            op: 'create',
            id,
            type: 'textLabel',
            text,
            x,
            y,
            ...(node.align ? { align: node.align } : {}),
            ...commonFields(node)
        });
        this.createdIds.add(id);
    }

    addPrism(node) {
        const id = this.nodeId(node, 'prism');
        const baseVertexIds = refsFrom(firstValue(node, ['baseVertexIds', 'baseVertices', 'base']));
        const topVertexIds = refsFrom(firstValue(node, ['topVertexIds', 'topVertices', 'top']));
        if (baseVertexIds.length < 3 || topVertexIds.length !== baseVertexIds.length) {
            this.warn(`Prism "${id}" skipped because base/top vertices must have matching lengths of at least three.`);
            return;
        }
        this.addOperation({
            op: 'create',
            id,
            type: 'prism',
            baseVertexIds,
            topVertexIds,
            ...commonFields(node)
        });
        this.createdIds.add(id);
    }

    addPyramid(node) {
        const id = this.nodeId(node, 'pyramid');
        const baseVertexIds = refsFrom(firstValue(node, ['baseVertexIds', 'baseVertices', 'base']));
        const apexId = ref(firstValue(node, ['apexId', 'apex', 'top']));
        if (baseVertexIds.length < 3 || !apexId) {
            this.warn(`Pyramid "${id}" skipped because base vertices and apex are required.`);
            return;
        }
        this.addOperation({
            op: 'create',
            id,
            type: 'pyramid',
            baseVertexIds,
            apexId,
            ...commonFields(node)
        });
        this.createdIds.add(id);
    }

    addRelationObject(relation, type, refAliases, extraFields = {}) {
        const id = this.nodeId(relation, type);
        const fields = {};
        for (const [field, aliases] of Object.entries(refAliases)) {
            fields[field] = ref(firstValue(relation, aliases));
            if (!fields[field]) {
                this.warn(`${type} "${id}" skipped because ${field} is missing.`);
                return;
            }
        }

        this.addOperation({
            op: 'create',
            id,
            type,
            ...fields,
            ...dropUndefined(extraFields),
            ...commonFields(relation)
        });
        this.createdIds.add(id);
    }

    addOperation(operation) {
        this.operations.push(dropUndefined(operation));
    }

    nodeId(item, fallbackKind) {
        const explicit = ref(item.id ?? item.nodeId ?? item.name);
        if (explicit) return explicit;
        this.idCounter += 1;
        const id = `${fallbackKind}_${this.idCounter}`;
        this.warn(`${fallbackKind} scene item had no id; generated "${id}".`);
        return id;
    }

    addUnsupportedWarning(item, source) {
        const kind = typeof item === 'string'
            ? item
            : (item?.kind ?? item?.type ?? item?.name ?? 'unknown');
        const id = typeof item === 'object' && item?.id ? ` "${item.id}"` : '';
        this.warn(`Unsupported scene item${id} from ${source}: "${kind}" is not a first-class GraphA primitive yet.`);
    }

    warn(message) {
        this.warnings.push(message);
    }
}

export function compileSceneGraph(scene, options = {}) {
    return new SceneGraphCompiler(options).compile(scene, options);
}

function normalizeNodeKind(kind) {
    return NODE_KIND_ALIASES.get(normalizeKey(kind)) || '';
}

function normalizeRelationKind(kind) {
    return RELATION_KIND_ALIASES.get(normalizeKey(kind)) || '';
}

function normalizeKey(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '');
}

function firstValue(object, aliases) {
    for (const alias of aliases) {
        if (object?.[alias] !== undefined && object?.[alias] !== null) {
            return object[alias];
        }
    }
    return undefined;
}

function firstString(object, aliases) {
    const value = firstValue(object, aliases);
    return typeof value === 'string' ? value.trim() : '';
}

function ref(value) {
    if (typeof value === 'string' || typeof value === 'number') {
        const normalized = String(value).trim();
        return normalized || '';
    }
    if (value && typeof value === 'object') {
        return ref(value.id ?? value.nodeId ?? value.name ?? value.label);
    }
    return '';
}

function refsFrom(value) {
    if (!Array.isArray(value)) return [];
    return value.map(item => ref(item)).filter(Boolean);
}

function numberFrom(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : NaN;
    }
    return NaN;
}

function commonFields(source) {
    const fields = {};
    for (const field of COMMON_FIELDS) {
        if (source?.[field] !== undefined) {
            fields[field] = cloneValue(source[field]);
        }
    }
    return fields;
}

function copyAllowedUpdateFields(source) {
    const fields = commonFields(source);
    for (const field of [
        'x',
        'y',
        'expression',
        'mode',
        't',
        'angle',
        'start',
        'end',
        'step',
        'showArrows',
        'tickHeight',
        'customMarks'
    ]) {
        if (source?.[field] !== undefined) {
            fields[field] = cloneValue(source[field]);
        }
    }
    return fields;
}

function normalizeFunctionExpression(value) {
    const expression = String(value || '').trim();
    if (!expression) return '';
    const match = expression.match(/^y\s*=\s*(.+)$/i);
    return match ? match[1].trim() : expression;
}

function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function dropUndefined(value) {
    const cleaned = {};
    for (const [key, item] of Object.entries(value || {})) {
        if (item !== undefined && item !== null) {
            cleaned[key] = item;
        }
    }
    return cleaned;
}

function cloneValue(value) {
    if (value === null || value === undefined) return value;
    if (typeof structuredClone === 'function') return structuredClone(value);
    if (typeof value === 'object') return JSON.parse(JSON.stringify(value));
    return value;
}

export default SceneGraphCompiler;
