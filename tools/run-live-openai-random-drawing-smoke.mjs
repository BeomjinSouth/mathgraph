import { createServer } from 'node:http';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import {
    AIService,
    GRAPH_OPERATIONS_RESPONSE_FORMAT,
    IMAGE_RECREATE_OPERATION_BUDGET,
    extractOpenAIResponseText,
    stripNullFields
} from '../js/ai/AIService.js';
import { parseAIJSONPayload } from '../js/ai/JSONUtils.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const referenceIndexPath = path.join(repoRoot, '.agents', 'skills', 'mathgraph-drawing', 'references', 'retrieval-index.json');
const featureManualPath = path.join(repoRoot, '.agents', 'skills', 'mathgraph-drawing', 'references', 'feature-manual.json');
const outputDir = process.env.LIVE_AI_OUTPUT_DIR
    ? path.resolve(process.env.LIVE_AI_OUTPUT_DIR)
    : path.join(repoRoot, 'tmp', 'live-openai-random-drawing-smoke');
const screenshotDir = path.join(outputDir, 'screenshots');
const endpoint = 'https://api.openai.com/v1/responses';

const smokePrompts = [
    {
        id: 'triangle_circumcircle_altitude',
        title: 'Triangle, circumcircle, altitude',
        tags: 'plane triangle circle construction',
        promptKo: '삼각형 ABC를 그리고, 세 점을 지나는 외접원과 C에서 AB로 내린 높이, 높이의 발 H, 직각 표시, 변 AB의 길이 표시를 함께 그려줘.',
        showAxes: false
    },
    {
        id: 'circle_sector_tangent',
        title: 'Circle sector and tangent',
        tags: 'circle sector arc tangent',
        promptKo: '중심 O인 원 위에 점 A, B를 잡고 부채꼴 AOB를 연하게 칠해. 작은 호 AB, 현 AB, 점 A에서의 접선, 중심각 표시를 함께 그려줘.',
        showAxes: false
    },
    {
        id: 'quadratic_line_intersections',
        title: 'Quadratic graph and line',
        tags: 'graph function quadratic line intersection tangent',
        promptKo: '좌표평면에 이차함수 y=x^2-4와 직선 y=x+2를 그리고, 교점들을 표시해. 이차함수의 꼭짓점 V와 x=1에서의 접선도 함께 그려줘.',
        showAxes: true
    },
    {
        id: 'radical_number_line',
        title: 'Radical number line construction',
        tags: 'number_line radical plane construction',
        promptKo: '수직선 -1부터 4까지를 그리고 0, 1, √2를 표시해. 밑변과 높이가 각각 1인 직각삼각형과 반지름 √2에 해당하는 원호로 √2 위치를 설명하는 그림을 그려줘.',
        showAxes: false
    },
    {
        id: 'square_pyramid',
        title: 'Square pyramid',
        tags: 'solid pyramid polygon',
        promptKo: '정사각형 밑면 ABCD와 꼭짓점 V를 가진 사각뿔 V-ABCD를 그려. 보이는 모서리와 숨은 모서리, 밑면의 대각선, 높이처럼 보이는 선분을 함께 표현해줘.',
        showAxes: false
    }
];

const extendedSmokePrompts = [
    {
        id: 'triangle_incircle_contacts',
        title: 'Triangle incircle and contact radii',
        tags: 'plane triangle circle incircle tangent marker',
        promptKo: '삼각형 ABC를 A(0,0), B(6,0), C(0,8)의 유한한 세 변 segment와 polygon으로 그려줘. 내심 I는 (2,2), 접점은 D(2,0), E(0,2), F(3.6,3.2)로 직접 point를 만들어 세 변에 접하는 내접원을 표시해줘. I에서 각 접점으로 가는 반지름은 segment로 그리고, 각 접점의 직각 표시는 rightAngleMarker의 line1Id/line2Id가 반지름 segment와 해당 변 segment를 참조하게 해줘. rightAngleMarker에 segment1Id/segment2Id를 쓰지 말고, 삼각형의 변도 무한 직선 line으로 만들지 마.',
        showAxes: false
    },
    {
        id: 'parallel_transversal_angles',
        title: 'Parallel lines with transversal angles',
        tags: 'plane line parallel angle construction',
        promptKo: '서로 평행한 두 직선 l, m과 이들을 가로지르는 횡단선 t를 그리고, l,t의 교점과 m,t의 교점을 만든 뒤 그 교점을 꼭짓점으로 angleDimension을 배치해줘. 엇각 두 쌍과 동위각 한 쌍은 각 하나마다 별도 angleDimension을 만들어 총 6개의 각 표시로 보여줘. 각 표시의 보조점은 반드시 해당 직선이나 횡단선 위에 놓아줘. 같은 교점에 놓인 angleDimension들은 arcRadius를 0.35, 0.55, 0.75처럼 서로 다르게 하고 showValue:false로 두어 숫자 라벨이 겹치지 않게 해줘.',
        showAxes: false
    },
    {
        id: 'absolute_value_line_region',
        title: 'Absolute value function and shaded region',
        tags: 'graph function line intersection polygon',
        promptKo: '좌표평면에 함수 y=|x|-1과 직선 y=1을 그리고 두 교점을 표시해줘. 두 그래프와 x축 근처 꼭짓점이 만드는 가운데 영역을 연하게 칠해줘.',
        showAxes: true
    },
    {
        id: 'histogram_frequency_polygon',
        title: 'Histogram and frequency polygon approximation',
        tags: 'chart approximation histogram polygon number_line statistics',
        promptKo: '도수분포표를 설명하는 간단한 히스토그램을 5개의 직사각형 막대로 그려줘. 막대의 계급 구간은 정확히 [0,1], [1,2], [2,3], [3,4], [4,5]로 시작하고, 막대 가운데 x=0.5,1.5,2.5,3.5,4.5를 잇는 도수다각형을 함께 그려줘. 가로축 눈금은 0부터 5까지 보이게 해줘.',
        showAxes: true
    },
    {
        id: 'triangular_prism_hidden_edges',
        title: 'Triangular prism with hidden edges',
        tags: 'solid prism polygon dashed dimension',
        promptKo: '삼각기둥 ABC-A′B′C′를 prism 객체로 그려줘. baseVertexIds는 A,B,C, topVertexIds는 A′,B′,C′가 되게 하고, 숨은 모서리의 점선/보이는 모서리의 실선 처리는 prism 런타임에 맡겨줘. 길이 표시가 필요하면 별도 segment를 추가하되, 삼각기둥 전체를 손으로 그린 dashed/solid segment 묶음만으로 대체하지 마.',
        showAxes: false
    }
];

const promptSets = {
    default: smokePrompts,
    extended: extendedSmokePrompts
};

const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'application/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png']
]);

const asMarkdownPath = filePath => path.resolve(filePath).replaceAll(path.sep, '/');

function getPromptSet() {
    const name = process.env.LIVE_AI_PROMPT_SET || 'default';
    const prompts = promptSets[name];
    if (!prompts) {
        throw new Error(`Unknown LIVE_AI_PROMPT_SET="${name}". Valid sets: ${Object.keys(promptSets).join(', ')}.`);
    }
    return { name, prompts };
}

async function openAIRequest(apiKey, url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...(options.headers || {})
        }
    });
    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { raw: text };
    }
    if (!response.ok) {
        const error = new Error(data?.error?.message || text || `OpenAI HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

async function chooseModel(apiKey) {
    const preferred = [
        process.env.OPENAI_MODEL,
        'gpt-5.4-mini',
        'gpt-4.1-mini',
        'gpt-5-mini',
        'gpt-4o-mini',
        'gpt-5.5',
        'gpt-4.1',
        'gpt-4o'
    ].filter(Boolean);
    const models = await openAIRequest(apiKey, 'https://api.openai.com/v1/models', { method: 'GET' });
    const ids = new Set((models.data || []).map(model => model.id));
    for (const model of preferred) {
        if (ids.has(model)) return model;
    }
    const fallback = [...ids].find(id => /^gpt-/.test(id) && !/audio|realtime|transcribe|tts|image/i.test(id));
    if (!fallback) {
        throw new Error('No GPT text model was visible to this API key.');
    }
    return fallback;
}

async function buildReferencePrompt(prompt) {
    const [manual, index] = await Promise.all([
        readFile(featureManualPath, 'utf8').then(JSON.parse),
        readFile(referenceIndexPath, 'utf8').then(JSON.parse)
    ]);
    const service = new AIService({
        provider: 'local',
        apiKey: '',
        referenceManual: manual,
        referenceIndex: index
    });
    return service.buildDrawingReferencePromptFromManual(
        manual,
        index,
        `${prompt.tags}\n${prompt.promptKo}`,
        null,
        'recreate'
    );
}

function developerPrompt(referencePrompt = '') {
    return [
        'You convert Korean MathGraph drawing requests into GraphA operations JSON.',
        'Return only a JSON object shaped exactly as {"operations":[...]} with no prose or Markdown.',
        'Use only supported GraphA operation fields. Do not invent aliases such as p1, p2, from, to, points, vertices, center, radius, width, height, equation, or text.',
        'Every referenced id must be created earlier in the same operations array unless it already exists in the canvas context.',
        'Prefer black default geometry. Omit color fields unless a non-black color is explicitly requested.',
        `Keep the drawing at or below ${IMAGE_RECREATE_OPERATION_BUDGET} operations.`,
        'For graph/function prompts, create functions with expression strings only, such as "x^2 - 4". Never include "y=" in a function expression.',
        'For quadratic/parabola prompts, create an actual function object for the parabola; do not approximate it only with points or line segments.',
        'For pointOnCircle, use angle in radians. Do not use t for pointOnCircle.',
        'For sector/arc requests, create distinct start and end points on the circle so the shaded sector has visible area.',
        'For tangent-to-circle requests, prefer tangentCircle with circleId and tangentPointId.',
        'For tangent-to-function requests, prefer tangentFunction with functionId and x.',
        'For triangle or polygon sides, use finite segment objects for the sides. Use line only when an infinite construction line is explicitly requested.',
        'For rightAngleMarker, the fields are vertexId, line1Id, and line2Id. Never use segment1Id or segment2Id for rightAngleMarker; those fields are only for equalLengthMarker.',
        'For angleDimension, create one marker per shown angle. Use the actual intersection point as vertexId and choose point1Id/point2Id on the two rays that form that angle.',
        'For multiple angleDimension markers at the same vertex, use staggered arcRadius values and set showValue:false or customText to avoid overlapping automatic degree labels.',
        'For histograms, draw bars on the requested class-interval boundaries, such as [0,1], [1,2], not centered half-offset ranges such as [0.5,1.5] unless explicitly requested.',
        'For prism or solid prompts, prefer the first-class prism/pyramid object so hidden-edge dashed rendering is determined consistently by the runtime.',
        'For chart-like or unsupported details, approximate with points, segments, polygons, numberLine, prism, or pyramid only.',
        referencePrompt
    ].filter(Boolean).join('\n');
}

function repairPrompt(prompt, previousPayload, errors) {
    return [
        prompt.promptKo,
        '',
        '위 요청에 대한 이전 GraphA JSON이 로컬 검증에 실패했습니다.',
        '아래 오류를 모두 고쳐서 {"operations":[...]} JSON만 다시 반환하세요.',
        '',
        'If the previous response was truncated or too long, return fewer objects and omit optional labels/styles while preserving the requested main structure.',
        'Important field rule: rightAngleMarker must use line1Id and line2Id. Do not use segment1Id or segment2Id unless the type is equalLengthMarker.',
        '',
        'Validation errors:',
        errors.map(error => `- ${error}`).join('\n'),
        '',
        'Previous JSON:',
        JSON.stringify(previousPayload, null, 2)
    ].join('\n');
}

function parsePayload(data) {
    const rawText = extractOpenAIResponseText(data);
    const parsed = data.output_parsed || parseAIJSONPayload(rawText);
    const payload = stripNullFields(Array.isArray(parsed) ? { operations: parsed } : parsed);
    if (!Array.isArray(payload?.operations)) {
        throw new Error('OpenAI response did not contain operations[].');
    }
    return { rawText, payload };
}

export function validatePayload(payload, validator, prompt = null) {
    const schema = validator.validate(payload);
    const refs = validator.validateReferences(payload, new Set());
    const intent = validator.validateIntent(payload, {
        mode: 'recreate',
        maxOperations: IMAGE_RECREATE_OPERATION_BUDGET
    });
    const runtimeErrors = validateRuntimeReadablePayload(payload);
    const semanticErrors = prompt ? validateSmokeSemantics(payload, prompt) : [];
    const errors = [
        ...schema.errors,
        ...refs.errors,
        ...intent.errors,
        ...runtimeErrors,
        ...semanticErrors
    ];
    return {
        schemaValid: schema.valid,
        referencesValid: refs.valid,
        intentValid: intent.valid,
        runtimeReadable: runtimeErrors.length === 0,
        semanticValid: semanticErrors.length === 0,
        valid: schema.valid && refs.valid && intent.valid && runtimeErrors.length === 0 && semanticErrors.length === 0,
        errors,
        operationCount: payload.operations.length
    };
}

export function validateRuntimeReadablePayload(payload) {
    const operations = Array.isArray(payload?.operations) ? payload.operations : [];
    const errors = [];
    operations.forEach((operation, index) => {
        if (operation.type === 'function' && typeof operation.expression === 'string') {
            if (operation.expression.includes('=')) {
                errors.push(`operations[${index}]: function expression must omit "y=" and contain only the right-hand side.`);
            }
        }
        if (operation.type === 'pointOnCircle' && operation.t !== undefined) {
            errors.push(`operations[${index}]: pointOnCircle must use angle in radians; t is ignored by the runtime.`);
        }
    });
    return errors;
}

export function validateSmokeSemantics(payload, prompt) {
    const operations = Array.isArray(payload?.operations) ? payload.operations : [];
    const ctx = buildOperationContext(operations);
    const errors = [];

    if (prompt?.id === 'circle_sector_tangent') {
        const sectors = ctx.byType('sector');
        const arcs = ctx.byType('arc');
        if (sectors.length === 0) {
            errors.push('circle_sector_tangent: expected a sector object for the requested sector AOB.');
        }
        if (arcs.length === 0) {
            errors.push('circle_sector_tangent: expected an arc object for the requested minor arc AB.');
        }

        for (const sector of sectors) {
            const span = angularSpanForCircleRegion(ctx, sector);
            if (!Number.isFinite(span)) {
                errors.push(`circle_sector_tangent: sector "${sector.id || '(no id)'}" must reference resolvable distinct circle start/end points.`);
            } else if (span < 0.15) {
                errors.push(`circle_sector_tangent: sector "${sector.id || '(no id)'}" has near-zero angular span, so it will not appear as a visible sector.`);
            }
            if (sector.fillOpacity !== undefined && sector.fillOpacity <= 0.05) {
                errors.push(`circle_sector_tangent: sector "${sector.id || '(no id)'}" fillOpacity is too low to serve as a visible shaded sector.`);
            }
        }
    }

    if (prompt?.id === 'quadratic_line_intersections') {
        const quadraticFunctions = ctx.byType('function').filter(operation =>
            isQuadraticExpression(operation.expression) && !String(operation.expression || '').includes('=')
        );
        if (quadraticFunctions.length === 0) {
            errors.push('quadratic_line_intersections: expected an actual function object with RHS-only quadratic expression, for example "x^2 - 4".');
        }
        if (ctx.byType('tangentFunction').length === 0) {
            errors.push('quadratic_line_intersections: expected a tangentFunction object for the requested tangent at x=1.');
        }
    }

    if (prompt?.id === 'triangle_incircle_contacts') {
        validateTriangleIncircleContacts(ctx, errors);
    }

    if (prompt?.id === 'parallel_transversal_angles') {
        validateParallelTransversalAngles(ctx, errors);
    }

    if (prompt?.id === 'histogram_frequency_polygon') {
        validateHistogramFrequencyPolygon(ctx, errors);
    }

    if (prompt?.id === 'triangular_prism_hidden_edges') {
        validateTriangularPrismHiddenEdges(ctx, errors);
    }

    return errors;
}

function validateTriangleIncircleContacts(ctx, errors) {
    const triangleIds = namedPointIds(ctx, ['A', 'B', 'C']);
    const explicitTriangleSides = triangleIds
        ? triangleEdges(triangleIds).every(([a, b]) => findSegmentBetween(ctx, a, b))
        : false;
    const polygonTriangleSides = ctx.byType('polygon')
        .filter(polygon => Array.isArray(polygon.vertexIds) && polygon.vertexIds.length === 3)
        .some(polygon => triangleEdges(polygon.vertexIds).every(([a, b]) => findSegmentBetween(ctx, a, b)));

    if (!explicitTriangleSides && !polygonTriangleSides) {
        errors.push('triangle_incircle_contacts: expected finite segment sides for triangle ABC; infinite line objects make contact and right-angle markers visually ambiguous.');
    }

    if (triangleIds) {
        const infiniteSideLines = triangleEdges(triangleIds)
            .filter(([a, b]) => findLineBetween(ctx, a, b));
        if (infiniteSideLines.length > 0) {
            errors.push('triangle_incircle_contacts: triangle sides AB, BC, and CA must be finite segment objects, not infinite line objects.');
        }
    }

    if (!findNamedPointId(ctx, 'I')) {
        errors.push('triangle_incircle_contacts: expected a resolvable incenter point labeled or id "I".');
    }

    if (ctx.byType('circle').length === 0 && ctx.byType('circleThreePoints').length === 0) {
        errors.push('triangle_incircle_contacts: expected a circle object for the incircle.');
    }

    const markers = ctx.byType('rightAngleMarker');
    if (markers.length < 3) {
        errors.push('triangle_incircle_contacts: expected three rightAngleMarker objects at the contact points D, E, and F.');
    }

    const badMarkers = markers.filter(marker => !rightAngleMarkerUsesFinitePerpendicularSegments(ctx, marker));
    if (badMarkers.length > 0) {
        errors.push('triangle_incircle_contacts: each contact rightAngleMarker must reference a radius segment and a finite side segment that are perpendicular at the contact point.');
    }
}

function validateParallelTransversalAngles(ctx, errors) {
    const angleDimensions = ctx.byType('angleDimension');
    if (angleDimensions.length < 6) {
        errors.push('parallel_transversal_angles: expected at least 6 angleDimension objects, one for each angle in two alternate-interior pairs and one corresponding-angle pair.');
    }

    const setup = findParallelTransversalSetup(ctx);
    if (!setup) {
        errors.push('parallel_transversal_angles: expected two parallel line-like objects and one transversal that intersects both.');
        return;
    }

    const badAngles = angleDimensions.filter(angle => !angleDimensionUsesTransversalIntersection(ctx, setup, angle));
    if (badAngles.length > 0) {
        errors.push('parallel_transversal_angles: every angleDimension must use a line/transversal intersection as vertexId and helper points on the two rays.');
    }

    const unstaggeredVertices = angleDimensionGroupsByVertex(angleDimensions)
        .filter(group => group.length > 1)
        .filter(group => uniqueApprox(group.map(angle => Number.isFinite(angle.arcRadius) ? angle.arcRadius : 0.5), 0.04).length < group.length);
    if (unstaggeredVertices.length > 0) {
        errors.push('parallel_transversal_angles: angleDimensions sharing the same vertex must use distinct arcRadius values so the angle markers do not overlap.');
    }

    const valueLabelsShown = angleDimensions.filter(angle => angle.showValue !== false);
    if (valueLabelsShown.length > 0) {
        errors.push('parallel_transversal_angles: set showValue:false on each angleDimension so automatic degree labels do not overlap the angle markers.');
    }
}

function validateHistogramFrequencyPolygon(ctx, errors) {
    const bars = ctx.byType('polygon')
        .map(polygon => rectangleBounds(ctx, polygon))
        .filter(bounds => bounds && nearlyEqual(bounds.minY, 0, 0.1) && bounds.maxY > 0.2)
        .sort((a, b) => a.minX - b.minX);

    if (bars.length < 5) {
        errors.push('histogram_frequency_polygon: expected five rectangular histogram bar polygons.');
        return;
    }

    const firstFive = bars.slice(0, 5);
    for (let index = 0; index < firstFive.length; index += 1) {
        const bar = firstFive[index];
        const expectedMin = index;
        const expectedMax = index + 1;
        if (!nearlyEqual(bar.minX, expectedMin, 0.12) || !nearlyEqual(bar.maxX, expectedMax, 0.12)) {
            errors.push(`histogram_frequency_polygon: bar ${index + 1} should cover class interval [${expectedMin},${expectedMax}], not [${formatNumber(bar.minX)},${formatNumber(bar.maxX)}].`);
        }
    }
}

function validateTriangularPrismHiddenEdges(ctx, errors) {
    const triangularPrism = ctx.byType('prism').find(prism =>
        Array.isArray(prism.baseVertexIds) &&
        Array.isArray(prism.topVertexIds) &&
        prism.baseVertexIds.length === 3 &&
        prism.topVertexIds.length === 3
    );

    if (!triangularPrism) {
        errors.push('triangular_prism_hidden_edges: expected a first-class prism object with three base vertices and three top vertices; hand-drawn dashed/solid segment sets are rejected because hidden-edge visibility is ambiguous.');
    }
}

function buildOperationContext(operations) {
    const creates = operations.filter(operation => operation?.op === 'create');
    const byId = new Map();
    for (const operation of creates) {
        if (typeof operation.id === 'string' && operation.id) {
            byId.set(operation.id, operation);
        }
    }
    return {
        creates,
        byId,
        byType(type) {
            return creates.filter(operation => operation.type === type);
        }
    };
}

function angularSpanForCircleRegion(ctx, region) {
    const circle = ctx.byId.get(region.circleId);
    const center = resolvePoint(ctx, circle?.centerId, new Set());
    const start = resolvePoint(ctx, region.startPointId, new Set());
    const end = resolvePoint(ctx, region.endPointId, new Set());
    if (!center || !start || !end) return NaN;
    if (distance(start, end) < 0.05) return 0;
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    let span = endAngle - startAngle;
    while (span < 0) span += Math.PI * 2;
    while (span >= Math.PI * 2) span -= Math.PI * 2;
    if (region.mode === 'major') {
        return Math.PI * 2 - span;
    }
    return Math.min(span, Math.PI * 2 - span);
}

function resolvePoint(ctx, id, visited) {
    if (!id || visited.has(id)) return null;
    visited.add(id);
    const operation = ctx.byId.get(id);
    if (!operation) return null;
    if (operation.type === 'point') {
        if (!Number.isFinite(operation.x) || !Number.isFinite(operation.y)) return null;
        return { x: operation.x, y: operation.y };
    }
    if (operation.type === 'pointOnCircle') {
        if (!Number.isFinite(operation.angle)) return null;
        const circle = ctx.byId.get(operation.circleId);
        const center = resolvePoint(ctx, circle?.centerId, visited);
        const radiusPoint = resolvePoint(ctx, circle?.pointOnCircleId, visited);
        if (!center || !radiusPoint) return null;
        const radius = distance(center, radiusPoint);
        if (radius <= 0) return null;
        return {
            x: center.x + radius * Math.cos(operation.angle),
            y: center.y + radius * Math.sin(operation.angle)
        };
    }
    if (operation.type === 'pointOnLine') {
        const line = ctx.byId.get(operation.lineId);
        const endpoints = linearEndpoints(ctx, line, visited);
        if (!endpoints || !Number.isFinite(operation.t)) return null;
        return lerp(endpoints[0], endpoints[1], operation.t);
    }
    if (operation.type === 'midpoint') {
        const object = ctx.byId.get(operation.segmentId);
        const endpoints = linearEndpoints(ctx, object, visited);
        if (!endpoints) return null;
        return midpoint(endpoints[0], endpoints[1]);
    }
    if (operation.type === 'intersection') {
        const object1 = ctx.byId.get(operation.object1Id);
        const object2 = ctx.byId.get(operation.object2Id);
        const endpoints1 = linearEndpoints(ctx, object1, visited);
        const endpoints2 = linearEndpoints(ctx, object2, visited);
        if (!endpoints1 || !endpoints2) return null;
        return lineIntersection(endpoints1, endpoints2);
    }
    return null;
}

function namedPointIds(ctx, names) {
    const ids = names.map(name => findNamedPointId(ctx, name));
    return ids.every(Boolean) ? ids : null;
}

function findNamedPointId(ctx, name) {
    const normalize = value => String(value || '').replace(/\s+/g, '');
    const candidates = ctx.creates.filter(operation =>
        operation.type === 'point' ||
        operation.type === 'pointOnLine' ||
        operation.type === 'pointOnCircle' ||
        operation.type === 'midpoint' ||
        operation.type === 'intersection'
    );
    const found = candidates.find(operation =>
        normalize(operation.id) === name || normalize(operation.label) === name
    );
    return found?.id || null;
}

function triangleEdges(vertexIds) {
    return [
        [vertexIds[0], vertexIds[1]],
        [vertexIds[1], vertexIds[2]],
        [vertexIds[2], vertexIds[0]]
    ];
}

function findSegmentBetween(ctx, id1, id2) {
    return ctx.byType('segment').find(segment => sameEndpointPair(segment, id1, id2));
}

function findLineBetween(ctx, id1, id2) {
    return ctx.byType('line').find(line => sameEndpointPair(line, id1, id2));
}

function sameEndpointPair(operation, id1, id2) {
    return (operation.point1Id === id1 && operation.point2Id === id2) ||
        (operation.point1Id === id2 && operation.point2Id === id1);
}

function rightAngleMarkerUsesFinitePerpendicularSegments(ctx, marker) {
    const vertex = resolvePoint(ctx, marker.vertexId, new Set());
    const object1 = ctx.byId.get(marker.line1Id);
    const object2 = ctx.byId.get(marker.line2Id);
    if (!vertex || object1?.type !== 'segment' || object2?.type !== 'segment') return false;

    const direction1 = directionAtVertex(ctx, object1, vertex, marker.vertexId);
    const direction2 = directionAtVertex(ctx, object2, vertex, marker.vertexId);
    if (!direction1 || !direction2) return false;

    const lengths = magnitude(direction1) * magnitude(direction2);
    if (lengths <= 0) return false;
    return Math.abs(dot(direction1, direction2) / lengths) <= 0.2;
}

function directionAtVertex(ctx, operation, vertex, vertexId) {
    const endpoints = linearEndpoints(ctx, operation, new Set());
    if (!endpoints) return null;
    const [a, b] = endpoints;
    if (operation.point1Id === vertexId) return subtract(b, vertex);
    if (operation.point2Id === vertexId) return subtract(a, vertex);
    if (!pointLiesOnSegmentLine(vertex, a, b, 0.15)) return null;
    return subtract(b, a);
}

function findParallelTransversalSetup(ctx) {
    const lineLikes = ctx.creates
        .filter(operation => ['line', 'segment', 'ray'].includes(operation.type))
        .map(operation => ({ operation, endpoints: linearEndpoints(ctx, operation, new Set()) }))
        .filter(item => item.endpoints && distance(item.endpoints[0], item.endpoints[1]) > 0.1);

    for (let i = 0; i < lineLikes.length; i += 1) {
        for (let j = i + 1; j < lineLikes.length; j += 1) {
            if (!areParallel(lineLikes[i].endpoints, lineLikes[j].endpoints)) continue;
            for (const transversal of lineLikes) {
                if (transversal === lineLikes[i] || transversal === lineLikes[j]) continue;
                if (areParallel(lineLikes[i].endpoints, transversal.endpoints)) continue;
                const intersection1 = lineIntersection(lineLikes[i].endpoints, transversal.endpoints);
                const intersection2 = lineIntersection(lineLikes[j].endpoints, transversal.endpoints);
                if (intersection1 && intersection2 && distance(intersection1, intersection2) > 0.2) {
                    return {
                        parallel1: lineLikes[i],
                        parallel2: lineLikes[j],
                        transversal,
                        intersection1,
                        intersection2
                    };
                }
            }
        }
    }
    return null;
}

function angleDimensionUsesTransversalIntersection(ctx, setup, angle) {
    const vertex = resolvePoint(ctx, angle.vertexId, new Set());
    const point1 = resolvePoint(ctx, angle.point1Id, new Set());
    const point2 = resolvePoint(ctx, angle.point2Id, new Set());
    if (!vertex || !point1 || !point2) return false;

    const atFirst = distance(vertex, setup.intersection1) <= 0.2;
    const atSecond = distance(vertex, setup.intersection2) <= 0.2;
    if (!atFirst && !atSecond) return false;

    const parallelLine = atFirst ? setup.parallel1 : setup.parallel2;
    const onParallel1 = pointLiesOnLine(point1, parallelLine.endpoints, 0.15);
    const onTransversal1 = pointLiesOnLine(point1, setup.transversal.endpoints, 0.15);
    const onParallel2 = pointLiesOnLine(point2, parallelLine.endpoints, 0.15);
    const onTransversal2 = pointLiesOnLine(point2, setup.transversal.endpoints, 0.15);

    return (onParallel1 && onTransversal2) || (onTransversal1 && onParallel2);
}

function angleDimensionGroupsByVertex(angleDimensions) {
    const groups = new Map();
    for (const angle of angleDimensions) {
        if (!groups.has(angle.vertexId)) groups.set(angle.vertexId, []);
        groups.get(angle.vertexId).push(angle);
    }
    return [...groups.values()];
}

function rectangleBounds(ctx, polygon) {
    if (!Array.isArray(polygon.vertexIds) || polygon.vertexIds.length !== 4) return null;
    const points = polygon.vertexIds.map(id => resolvePoint(ctx, id, new Set()));
    if (points.some(point => !point)) return null;

    const xs = uniqueApprox(points.map(point => point.x), 0.08);
    const ys = uniqueApprox(points.map(point => point.y), 0.08);
    if (xs.length !== 2 || ys.length !== 2) return null;

    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
    };
}

function linearEndpoints(ctx, operation, visited) {
    if (!operation) return null;
    if (operation.type === 'segment' || operation.type === 'line') {
        const p1 = resolvePoint(ctx, operation.point1Id, new Set(visited));
        const p2 = resolvePoint(ctx, operation.point2Id, new Set(visited));
        return p1 && p2 ? [p1, p2] : null;
    }
    if (operation.type === 'ray') {
        const p1 = resolvePoint(ctx, operation.originId, new Set(visited));
        const p2 = resolvePoint(ctx, operation.directionPointId, new Set(visited));
        return p1 && p2 ? [p1, p2] : null;
    }
    if (operation.type === 'parallel') {
        const base = linearEndpoints(ctx, ctx.byId.get(operation.baseLineId), new Set(visited));
        const through = resolvePoint(ctx, operation.throughPointId, new Set(visited));
        if (!base || !through) return null;
        const dir = normalizeVector(subtract(base[1], base[0]));
        return dir ? [through, add(through, dir)] : null;
    }
    if (operation.type === 'perpendicular') {
        const base = linearEndpoints(ctx, ctx.byId.get(operation.baseLineId), new Set(visited));
        const through = resolvePoint(ctx, operation.throughPointId, new Set(visited));
        if (!base || !through) return null;
        const dir = normalizeVector(subtract(base[1], base[0]));
        return dir ? [through, add(through, perpendicularVector(dir))] : null;
    }
    if (operation.type === 'perpendicularBisector') {
        const segment = linearEndpoints(ctx, ctx.byId.get(operation.segmentId), new Set(visited));
        if (!segment) return null;
        const mid = midpoint(segment[0], segment[1]);
        const dir = normalizeVector(subtract(segment[1], segment[0]));
        return dir ? [mid, add(mid, perpendicularVector(dir))] : null;
    }
    if (operation.type === 'angleBisector') {
        const line1 = linearEndpoints(ctx, ctx.byId.get(operation.line1Id), new Set(visited));
        const line2 = linearEndpoints(ctx, ctx.byId.get(operation.line2Id), new Set(visited));
        if (!line1 || !line2) return null;
        const vertex = lineIntersection(line1, line2);
        if (!vertex) return null;
        const dir1 = normalizeVector(subtract(line1[1], line1[0]));
        const dir2 = normalizeVector(subtract(line2[1], line2[0]));
        if (!dir1 || !dir2) return null;
        let bisector = normalizeVector(add(dir1, dir2));
        if (!bisector) bisector = perpendicularVector(dir1);
        if (operation.exterior) bisector = perpendicularVector(bisector);
        return [vertex, add(vertex, bisector)];
    }
    return null;
}

function lineIntersection([a, b], [c, d]) {
    const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denominator) < 1e-9) return null;
    return {
        x: ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) / denominator,
        y: ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) / denominator
    };
}

function areParallel(endpoints1, endpoints2) {
    const v1 = subtract(endpoints1[1], endpoints1[0]);
    const v2 = subtract(endpoints2[1], endpoints2[0]);
    return Math.abs(cross(v1, v2)) <= 0.05 * magnitude(v1) * magnitude(v2);
}

function pointLiesOnSegmentLine(point, a, b, tolerance) {
    if (!pointLiesOnLine(point, [a, b], tolerance)) return false;
    const lengthSquared = squaredDistance(a, b);
    if (lengthSquared <= 0) return false;
    const t = dot(subtract(point, a), subtract(b, a)) / lengthSquared;
    return t >= -0.05 && t <= 1.05;
}

function pointLiesOnLine(point, [a, b], tolerance) {
    const lineLength = distance(a, b);
    if (lineLength <= 0) return false;
    return Math.abs(cross(subtract(b, a), subtract(point, a))) / lineLength <= tolerance;
}

function uniqueApprox(values, tolerance) {
    const sorted = [...values].sort((a, b) => a - b);
    const unique = [];
    for (const value of sorted) {
        if (!unique.some(existing => nearlyEqual(existing, value, tolerance))) {
            unique.push(value);
        }
    }
    return unique;
}

function nearlyEqual(a, b, tolerance) {
    return Math.abs(a - b) <= tolerance;
}

function midpoint(a, b) {
    return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
    };
}

function lerp(a, b, t) {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
    };
}

function subtract(a, b) {
    return {
        x: a.x - b.x,
        y: a.y - b.y
    };
}

function add(a, b) {
    return {
        x: a.x + b.x,
        y: a.y + b.y
    };
}

function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}

function cross(a, b) {
    return a.x * b.y - a.y * b.x;
}

function magnitude(vector) {
    return Math.hypot(vector.x, vector.y);
}

function normalizeVector(vector) {
    const length = magnitude(vector);
    if (length <= 0) return null;
    return {
        x: vector.x / length,
        y: vector.y / length
    };
}

function perpendicularVector(vector) {
    return {
        x: -vector.y,
        y: vector.x
    };
}

function squaredDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatNumber(value) {
    return Number.isFinite(value) ? Number(value.toFixed(2)).toString() : String(value);
}

function isQuadraticExpression(expression) {
    const normalized = String(expression || '').replace(/\s+/g, '').toLowerCase();
    return /x\^2|x\*\*2|x\*x|pow\(x,2\)/.test(normalized);
}

async function callPrompt(apiKey, model, prompt, validator) {
    const maxAttempts = Number(process.env.LIVE_AI_MAX_ATTEMPTS || 3);
    const referencePrompt = await buildReferencePrompt(prompt);
    let previousPayload = null;
    let errors = [];
    let lastResult = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const userText = attempt === 1
            ? prompt.promptKo
            : repairPrompt(prompt, previousPayload, errors);
        const requestBody = {
            model,
            input: [
                { role: 'developer', content: developerPrompt(referencePrompt) },
                { role: 'user', content: userText }
            ],
            store: false,
            text: {
                format: GRAPH_OPERATIONS_RESPONSE_FORMAT
            }
        };
        if (/^(gpt-5|o[1-9]|o\d)/.test(model)) {
            requestBody.reasoning = { effort: 'low' };
            requestBody.text.verbosity = 'low';
        }
        requestBody.max_output_tokens = Number(process.env.LIVE_AI_MAX_OUTPUT_TOKENS || 7000);

        const data = await openAIRequest(apiKey, endpoint, {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });
        let parsed;
        try {
            parsed = parsePayload(data);
        } catch (error) {
            errors = [`OpenAI response could not be parsed as complete GraphA JSON: ${error.message}`];
            previousPayload = null;
            lastResult = {
                prompt,
                request: {
                    endpoint,
                    model,
                    attempt,
                    userPrompt: userText,
                    developerPrompt: developerPrompt(referencePrompt)
                },
                response: {
                    id: data.id || null,
                    model: data.model || model,
                    rawText: extractOpenAIResponseText(data),
                    payload: { operations: [] }
                },
                validation: {
                    schemaValid: false,
                    referencesValid: false,
                    intentValid: false,
                    runtimeReadable: false,
                    semanticValid: false,
                    valid: false,
                    errors,
                    operationCount: 0
                }
            };
            continue;
        }
        const validation = validatePayload(parsed.payload, validator, prompt);
        lastResult = {
            prompt,
            request: {
                endpoint,
                model,
                attempt,
                userPrompt: userText,
                developerPrompt: developerPrompt(referencePrompt)
            },
            response: {
                id: data.id || null,
                model: data.model || model,
                rawText: parsed.rawText,
                payload: parsed.payload
            },
            validation
        };
        if (validation.valid) return lastResult;
        previousPayload = parsed.payload;
        errors = validation.errors;
    }

    return lastResult;
}

function startStaticServer() {
    const server = createServer(async (req, res) => {
        try {
            const rawUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const requested = rawUrl.pathname === '/' ? '/index.html' : decodeURIComponent(rawUrl.pathname);
            const filePath = path.normalize(path.join(repoRoot, requested));
            if (!filePath.startsWith(repoRoot)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }
            const info = await stat(filePath);
            if (!info.isFile()) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': mimeTypes.get(path.extname(filePath)) || 'application/octet-stream' });
            res.end(await readFile(filePath));
        } catch {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
    });
}

async function chromiumExecutable() {
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
    const root = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
    const candidates = [];
    try {
        for (const entry of await readdir(root, { withFileTypes: true })) {
            if (!entry.isDirectory() || !entry.name.startsWith('chromium')) continue;
            candidates.push(
                path.join(root, entry.name, 'chrome-win', 'chrome.exe'),
                path.join(root, entry.name, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
            );
        }
    } catch {
        return null;
    }
    candidates.sort().reverse();
    for (const candidate of candidates) {
        try {
            await access(candidate);
            return candidate;
        } catch {
            // Try the next locally installed browser.
        }
    }
    return null;
}

async function render(results) {
    await mkdir(screenshotDir, { recursive: true });
    const { server, url } = await startStaticServer();
    const executablePath = await chromiumExecutable();
    const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const consoleErrors = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        page.on('console', message => {
            if (message.type() === 'error') consoleErrors.push(message.text());
        });
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() => window.app?.objectManager && window.app?.processAIJSON);
        await page.addStyleTag({
            content: '.canvas-controls, #chat-panel { display: none !important; }'
        });
        for (const result of results) {
            const renderResult = await page.evaluate((current) => {
                const app = window.app;
                app.objectManager.clear();
                app.historyManager.clear();
                app.canvas.resetView();
                app.canvas.showGrid = current.prompt.showAxes;
                app.canvas.showXAxis = current.prompt.showAxes;
                app.canvas.showYAxis = current.prompt.showAxes;
                let applyError = null;
                try {
                    app.processAIJSON(JSON.stringify(current.response.payload), {
                        mode: 'recreate',
                        maxOperations: 45
                    });
                    app.render();
                } catch (error) {
                    applyError = error.message;
                    app.render();
                }
                const canvas = document.getElementById('mainCanvas');
                const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                let nonWhitePixels = 0;
                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i] < 248 || pixels[i + 1] < 248 || pixels[i + 2] < 248) nonWhitePixels += 1;
                }
                const objects = app.objectManager.getAllObjects();
                return {
                    applyError,
                    objectCount: objects.length,
                    visibleObjectCount: objects.filter(object => object.visible !== false).length,
                    nonWhitePixels
                };
            }, result);
            const screenshotPath = path.join(screenshotDir, `${result.prompt.id}.png`);
            await page.locator('#mainCanvas').screenshot({ path: screenshotPath });
            result.render = {
                ...renderResult,
                screenshotPath: asMarkdownPath(screenshotPath),
                rendered: !renderResult.applyError && renderResult.objectCount > 0 && renderResult.nonWhitePixels >= 100
            };
        }

        const contactSheetPath = path.join(outputDir, 'contact-sheet.png');
        const cards = await Promise.all(results.map(async result => {
            const imageData = await readFile(path.resolve(result.render.screenshotPath));
            const imageUrl = `data:image/png;base64,${imageData.toString('base64')}`;
            return `
                <figure>
                    <img src="${imageUrl}" alt="${result.prompt.id}">
                    <figcaption>${result.prompt.title}<br>${result.validation.operationCount} ops, ${result.render.objectCount} objects</figcaption>
                </figure>
            `;
        }));
        await page.setContent(`
            <!doctype html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f5f5f5; color: #111; }
                    h1 { margin: 0 0 16px; font-size: 20px; }
                    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
                    figure { margin: 0; background: #fff; border: 1px solid #ddd; padding: 8px; }
                    img { display: block; width: 100%; height: auto; border: 1px solid #eee; }
                    figcaption { padding-top: 6px; font-size: 12px; line-height: 1.35; }
                </style>
            </head>
            <body>
                <h1>Live OpenAI Random MathGraph Smoke</h1>
                <div class="grid">${cards.join('\n')}</div>
            </body>
            </html>
        `, { waitUntil: 'load' });
        await page.screenshot({ path: contactSheetPath, fullPage: true });
        return {
            contactSheetPath: asMarkdownPath(contactSheetPath),
            consoleErrors
        };
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}

function report(meta, results) {
    const lines = [
        '# Live OpenAI Random MathGraph Smoke',
        '',
        `- generatedAt: ${meta.generatedAt}`,
        `- endpoint: ${endpoint}`,
        `- model: ${meta.model}`,
        `- promptSet: ${meta.promptSet}`,
        '- apiKey: provided via OPENAI_API_KEY, not written to this report',
        `- contactSheet: ${meta.contactSheetPath}`,
        '',
        'This report records real OpenAI Responses API calls, local GraphA validation, and browser canvas render results.',
        ''
    ];
    for (const result of results) {
        lines.push(`## ${result.prompt.id}`);
        lines.push('');
        lines.push(`- title: ${result.prompt.title}`);
        lines.push(`- responseId: ${result.response.id}`);
        lines.push(`- attempt: ${result.request.attempt}`);
        lines.push(`- validation: schema=${result.validation.schemaValid}, references=${result.validation.referencesValid}, intent=${result.validation.intentValid}, runtime=${result.validation.runtimeReadable}, semantic=${result.validation.semanticValid}`);
        lines.push(`- render: rendered=${result.render?.rendered}, objects=${result.render?.objectCount}, nonWhitePixels=${result.render?.nonWhitePixels}`);
        lines.push(`- screenshot: ${result.render?.screenshotPath}`);
        if (result.validation.errors.length > 0) {
            lines.push(`- validationErrors: ${result.validation.errors.join(' | ')}`);
        }
        lines.push('');
        lines.push('### Prompt', '', '```text', result.prompt.promptKo, '```', '');
        lines.push('### Operations', '', '```json', JSON.stringify(result.response.payload, null, 2), '```', '');
    }
    return lines.join('\n');
}

async function main() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is required.');

    await mkdir(outputDir, { recursive: true });
    const validator = new SchemaValidator();
    const model = await chooseModel(apiKey);
    const promptSet = getPromptSet();
    const limit = Number(process.env.LIVE_AI_SAMPLE_LIMIT || promptSet.prompts.length);
    const selectedPrompts = promptSet.prompts.slice(0, limit);
    const results = [];

    for (const prompt of selectedPrompts) {
        console.log(`Calling OpenAI for ${prompt.id} with ${model}...`);
        results.push(await callPrompt(apiKey, model, prompt, validator));
    }

    const renderMeta = await render(results);
    const meta = {
        generatedAt: new Date().toISOString(),
        endpoint,
        model,
        promptSet: promptSet.name,
        promptCount: results.length,
        contactSheetPath: renderMeta.contactSheetPath,
        consoleErrorCount: renderMeta.consoleErrors.length,
        consoleErrors: renderMeta.consoleErrors
    };
    const resultPath = path.join(outputDir, 'live-openai-random-results.json');
    const reportPath = path.join(outputDir, 'live-openai-random-report.md');
    await writeFile(resultPath, JSON.stringify({ meta, results }, null, 2), 'utf8');
    await writeFile(reportPath, report(meta, results), 'utf8');

    const failures = results.filter(result =>
        !result.validation.valid ||
        !result.render?.rendered
    );

    console.log(JSON.stringify({
        meta,
        resultPath: asMarkdownPath(resultPath),
        reportPath: asMarkdownPath(reportPath),
        screenshotDir: asMarkdownPath(screenshotDir),
        failures: failures.map(result => result.prompt.id)
    }, null, 2));

    if (failures.length > 0 || renderMeta.consoleErrors.length > 0) {
        process.exit(1);
    }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    main().catch(error => {
        console.error(error.message);
        process.exit(1);
    });
}
