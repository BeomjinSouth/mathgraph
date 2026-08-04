/**
 * ProblemScenePipeline.js
 *
 * A compact, source-grounded boundary between vision and GraphA operations.
 * The model describes what must be drawn; MathGraph owns compilation and
 * coverage validation.
 */

import { compileSceneGraph } from './SceneGraphCompiler.js';

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
        referencePrompt
    ].filter(Boolean).join('\n\n');
}

export function compileProblemScenePayload(payload) {
    const scene = payload?.scene || payload || {};
    const compiled = compileSceneGraph(scene, { compact: true });
    return {
        ...compiled,
        sourceBindings: Array.isArray(scene.sourceBindings) ? scene.sourceBindings : [],
        scene
    };
}

export function validateProblemSceneCoverage(scene, compiled) {
    const errors = [];
    const operations = Array.isArray(compiled?.operations) ? compiled.operations : [];
    const operationIds = new Set(operations.map(operation => operation?.id).filter(Boolean));
    const sceneIds = new Set([
        ...(Array.isArray(scene?.nodes) ? scene.nodes : []),
        ...(Array.isArray(scene?.relations) ? scene.relations : [])
    ].map(item => item?.id).filter(Boolean));
    const mustDraw = Array.isArray(scene?.mustDraw) ? scene.mustDraw : [];

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
        if (/skipped|unresolved/i.test(String(warning))) {
            errors.push(String(warning));
        }
    }

    return { valid: errors.length === 0, errors };
}
