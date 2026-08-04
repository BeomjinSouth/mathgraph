import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
    AI_COMMAND_MODE,
    AIService,
    GRAPH_IMAGE_BINDINGS_RESPONSE_FORMAT,
    GRAPH_IMAGE_OPERATIONS_RESPONSE_FORMAT,
    PROBLEM_DIAGRAM_GRAPH_GUIDANCE,
    PROBLEM_SITUATION_GRAPH_GUIDANCE
} from '../js/ai/AIService.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { SemanticValidator } from '../js/ai/SemanticValidator.js';
import { enhanceDiagramQuality } from '../js/ai/DiagramQualityEnhancer.js';

const EXAMPLE_ID = 'graph_parameterized_exponential_vertical_maps';

function loadExample() {
    const source = readFileSync(
        new URL('../.agents/skills/mathgraph-drawing/references/synthetic-drawing-data.jsonl', import.meta.url),
        'utf8'
    );
    const records = source.trim().split(/\r?\n/).map(line => JSON.parse(line));
    return records.find(record => record.id === EXAMPLE_ID);
}

function assertClose(actual, expected, tolerance = 1e-9) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `expected ${actual} to be within ${tolerance} of ${expected}`
    );
}

test('problem-diagram prompts require a non-degenerate representative parameter', () => {
    assert.match(PROBLEM_DIAGRAM_GRAPH_GUIDANCE, /non-degenerate representative/);
    assert.match(PROBLEM_DIAGRAM_GRAPH_GUIDANCE, /function-function intersection/);
    assert.ok(PROBLEM_SITUATION_GRAPH_GUIDANCE.includes('\uBE44\uD1F4\uD654 \uB300\uD45C\uAC12'));
});

test('quality enhancer removes a duplicate named point when the original already lies on the segment', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'P', type: 'point', x: 2.8, y: 0.8, label: 'P' },
            { op: 'create', id: 'Q', type: 'point', x: -0.2, y: -2.2, label: 'Q' },
            { op: 'create', id: 'PQ', type: 'segment', point1Id: 'P', point2Id: 'Q' },
            { op: 'create', id: 'focus_F', type: 'point', x: 2, y: 0, label: 'F' },
            { op: 'create', id: 'duplicate_F', type: 'pointOnLine', lineId: 'PQ', t: 1 / 3, label: 'F' },
            { op: 'create', id: 'support', type: 'segment', point1Id: 'duplicate_F', point2Id: 'P' }
        ]
    };

    const enhanced = enhanceDiagramQuality(payload, 'F가 선분 PQ 위에 있다.');
    assert.equal(enhanced.operations.some(operation => operation.id === 'duplicate_F'), false);
    assert.equal(enhanced.operations.find(operation => operation.id === 'support').point1Id, 'focus_F');
    assert.equal(enhanced.operations.filter(operation => operation.label === 'F').length, 1);
});
test('quality enhancer rebuilds a parabola-line diameter-circle diagram with shared A and B', () => {
    const enhanced = enhanceDiagramQuality({
        operations: [
            { op: 'create', id: 'f', type: 'function', expression: 'x^2', label: 'y=f(x)' },
            { op: 'create', id: 'g', type: 'function', expression: '2', label: 'y=g(x)' },
            { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
            { op: 'create', id: 'A1', type: 'point', x: -1, y: 1, label: 'A' },
            { op: 'create', id: 'B1', type: 'point', x: 4, y: 16, label: 'B' },
            { op: 'create', id: 'P', type: 'point', x: -3, y: 9, label: 'P' },
            { op: 'create', id: 'A2', type: 'point', x: -5, y: 0, label: 'A' },
            { op: 'create', id: 'B2', type: 'point', x: 7, y: 0, label: 'B' },
            { op: 'create', id: 'C2', type: 'point', x: 0, y: -2, label: 'C' },
            { op: 'create', id: 'circle', type: 'circleThreePoints', point1Id: 'A2', point2Id: 'B2', point3Id: 'C2' }
        ]
    });

    const byLabel = label => enhanced.operations.find(operation => operation.label === label && operation.type === 'point');
    const a = byLabel('A');
    const b = byLabel('B');
    const o = byLabel('O');
    const p = byLabel('P');
    const circle = enhanced.operations.find(operation => operation.type === 'circle');
    const center = enhanced.operations.find(operation => operation.id === circle.centerId);
    assertClose(a.y, 0.5 * a.x * a.x);
    assertClose(b.y, 0.5 * b.x * b.x);
    assertClose(a.y, (0.6 * a.x) + 2);
    assertClose(b.y, (0.6 * b.x) + 2);
    assertClose((a.x - o.x) * (b.x - o.x) + (a.y - o.y) * (b.y - o.y), 0);
    const radius = Math.hypot(a.x - center.x, a.y - center.y);
    assertClose(Math.hypot(p.x - center.x, p.y - center.y), radius);
    assertClose(p.y, 0.5 * p.x * p.x);
    assert.equal(enhanced.operations.filter(operation => operation.label === 'A').length, 1);
    assert.equal(enhanced.operations.filter(operation => operation.label === 'B').length, 1);
});

test('quality enhancer reconnects a named EFGH section instead of an ABFE stand-in', () => {
    const operations = [
        { op: 'create', id: 'A', type: 'point', x: -2, y: -1, label: 'A' },
        { op: 'create', id: 'B', type: 'point', x: 2, y: -1, label: 'B' },
        { op: 'create', id: 'C', type: 'point', x: 3, y: 1, label: 'C' },
        { op: 'create', id: 'D', type: 'point', x: -1, y: 1, label: 'D' },
        { op: 'create', id: 'O', type: 'point', x: 0, y: 4, label: 'O' },
        { op: 'create', id: 'OA', type: 'segment', point1Id: 'O', point2Id: 'A' },
        { op: 'create', id: 'OB', type: 'segment', point1Id: 'O', point2Id: 'B' },
        { op: 'create', id: 'OC', type: 'segment', point1Id: 'O', point2Id: 'C' },
        { op: 'create', id: 'OD', type: 'segment', point1Id: 'O', point2Id: 'D' },
        { op: 'create', id: 'E', type: 'pointOnLine', lineId: 'OA', t: 0.4, label: 'E' },
        { op: 'create', id: 'F', type: 'pointOnLine', lineId: 'OB', t: 0.4, label: 'F' },
        { op: 'create', id: 'G', type: 'pointOnLine', lineId: 'OC', t: 0.4, label: 'G' },
        { op: 'create', id: 'H', type: 'pointOnLine', lineId: 'OD', t: 0.4, label: 'H' },
        { op: 'create', id: 'wrong', type: 'polygon', vertexIds: ['A', 'B', 'F', 'E'], label: 'ABFE', fillOpacity: 0.2 },
        { op: 'create', id: 'pyramid', type: 'pyramid', baseVertexIds: ['A', 'B', 'C', 'D'], apexId: 'O', label: 'O-ABCD' }
    ];

    const enhanced = enhanceDiagramQuality({ operations }, '', { mode: 'problem_diagram' });
    assert.equal(enhanced.operations.some(operation => operation.type === 'pyramid'), false);
    assert.equal(enhanced.operations.some(operation => operation.id === 'wrong'), false);
    assert.deepEqual(
        enhanced.operations.filter(operation => operation.type === 'pointOnLine').map(operation => [operation.label, operation.lineId]),
        [['E', 'OA'], ['F', 'OB'], ['G', 'OC'], ['H', 'OD']]
    );
    assert.equal(enhanced.operations.find(operation => operation.id === 'OD').dashed, true);
    assert.equal(enhanced.operations.find(operation => operation.id === 'GH').dashed, true);
    const references = new SchemaValidator().validateReferences(enhanced, new Set());
    assert.equal(references.valid, true, references.errors.join('\n'));
});
test('quality enhancer rebuilds a line-based O-ABCD response as a finite EFGH pyramid section', () => {
    const labels = ['O', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const operations = labels.map((label, index) => ({
        op: 'create', id: `raw_${label}`, type: 'point', x: index, y: index, label
    }));
    operations.push(
        { op: 'create', id: 'a', type: 'line', point1Id: 'raw_O', point2Id: 'raw_A' },
        { op: 'create', id: 'b', type: 'line', point1Id: 'raw_O', point2Id: 'raw_B' },
        { op: 'create', id: 'c', type: 'line', point1Id: 'raw_O', point2Id: 'raw_C' },
        { op: 'create', id: 'd', type: 'line', point1Id: 'raw_O', point2Id: 'raw_D' },
        { op: 'create', id: 'c1', type: 'polygon', vertexIds: ['raw_A', 'raw_B', 'raw_C', 'raw_D'] },
        { op: 'create', id: 'c2', type: 'polygon', vertexIds: ['raw_E', 'raw_F', 'raw_G', 'raw_H'] }
    );

    const enhanced = enhanceDiagramQuality({ operations }, '', { mode: 'problem_diagram' });
    assert.equal(enhanced.operations.some(operation => operation.type === 'line'), false);
    assert.deepEqual(
        enhanced.operations.filter(operation => operation.type === 'pointOnLine').map(operation => [operation.label, operation.lineId]),
        [['E', 'OA'], ['F', 'OB'], ['G', 'OC'], ['H', 'OD']]
    );
    assert.equal(enhanced.operations.find(operation => operation.id === 'GH').dashed, true);
    assert.equal(enhanced.operations.find(operation => operation.id === 'HE').dashed, true);
    const references = new SchemaValidator().validateReferences(enhanced, new Set());
    assert.equal(references.valid, true, references.errors.join('\n'));
});
test('quality enhancer resolves display-name line references before validation', () => {
    const enhanced = enhanceDiagramQuality({
        operations: [
            { op: 'create', id: 'apex', type: 'point', x: 0, y: 4, label: 'O' },
            { op: 'create', id: 'base_a', type: 'point', x: -2, y: -1, label: 'A' },
            { op: 'create', id: 'edge_1', type: 'segment', point1Id: 'apex', point2Id: 'base_a' },
            { op: 'create', id: 'E', type: 'pointOnLine', lineId: 'oa', t: 0.4, label: 'E' }
        ]
    });

    assert.equal(enhanced.operations.find(operation => operation.id === 'E').lineId, 'edge_1');
    const references = new SchemaValidator().validateReferences(enhanced, new Set());
    assert.equal(references.valid, true, references.errors.join('\n'));
});
test('quality enhancer rebuilds the ellipse focus chord with F inside PQ and the stated ratios', () => {
    const enhanced = enhanceDiagramQuality({
        operations: [
            { op: 'create', id: 'ellipse', type: 'ellipse', x: 0, y: 0, radiusX: 3, radiusY: 2, label: 'E' },
            { op: 'create', id: 'F', type: 'point', x: 2, y: 0, label: 'F' },
            { op: 'create', id: 'Fp', type: 'point', x: -2, y: 0, label: "F'" },
            { op: 'create', id: 'P', type: 'point', x: 1.4, y: 1.2, label: 'P' },
            { op: 'create', id: 'Q', type: 'point', x: 3.4, y: -1.6, label: 'Q' },
            { op: 'create', id: 'PQ', type: 'segment', point1Id: 'P', point2Id: 'Q' },
            { op: 'create', id: 'ratio1', type: 'textLabel', text: 'PF/QF = 1/2', x: 0, y: -3 },
            { op: 'create', id: 'ratio2', type: 'textLabel', text: "PF/FF' = sqrt(6)/16", x: 0, y: -3.5 }
        ]
    });

    const point = label => enhanced.operations.find(operation => operation.type === 'point' && operation.label === label);
    const p = point('P');
    const f = point('F');
    const fp = point("F'");
    const q = point('Q');
    const cross = (f.x - p.x) * (q.y - p.y) - (f.y - p.y) * (q.x - p.x);
    assertClose(cross, 0);
    const pf = Math.hypot(p.x - f.x, p.y - f.y);
    const qf = Math.hypot(q.x - f.x, q.y - f.y);
    const ffp = Math.hypot(f.x - fp.x, f.y - fp.y);
    assertClose(pf / qf, 0.5);
    assertClose(pf / ffp, Math.sqrt(6) / 16);
    assertClose((p.x * p.x) / 6 + (p.y * p.y) / 2, 1);
    assertClose((q.x * q.x) / 6 + (q.y * q.y) / 2, 1);
    assert.ok(f.x >= Math.min(p.x, q.x) && f.x <= Math.max(p.x, q.x));
    assert.equal(enhanced.operations.filter(operation => operation.label === 'F').length, 1);
});
test('parameterized exponential example satisfies every stated graph relation', () => {
    const example = loadExample();
    assert.ok(example, `missing synthetic example: ${EXAMPLE_ID}`);

    const validator = new SchemaValidator();
    const validation = validator.validate({ operations: example.operations });
    assert.equal(validation.valid, true, validation.errors.join('\n'));

    const objects = new Map(example.operations.map(operation => [operation.id, operation]));
    const curveA = objects.get('curve_mixed');
    const curveB = objects.get('curve_exp');
    const tLine = objects.get('line_t');
    const pointP = objects.get('P');
    const pointQ = objects.get('Q');
    const pointF = objects.get('P_on_exp');
    const pointG = objects.get('Q_on_mixed');
    const verticalP = objects.get('vertical_P');
    const verticalQ = objects.get('vertical_Q');

    assert.equal(curveA.expression, 'exp(2*x)-exp(-x)+1');
    assert.equal(curveB.expression, 'exp(2*x)');
    assert.equal(tLine.expression, '0.2');

    const t = Number(tLine.expression);
    assert.ok(t > 0);
    assert.ok(Math.abs(t - 1) > 0.1, 'representative t must not collapse P and Q at t=1');

    const mixed = x => Math.exp(2 * x) - Math.exp(-x) + 1;
    const exp = x => Math.exp(2 * x);

    assertClose(pointP.y, t);
    assertClose(pointQ.y, t);
    assertClose(mixed(pointP.x), t);
    assertClose(exp(pointQ.x), t);
    assert.ok(Math.abs(pointP.x - pointQ.x) > 0.4, 'P and Q should be visibly separated');

    assertClose(pointF.x, pointP.x);
    assertClose(pointF.y, exp(pointP.x));
    assertClose(pointG.x, pointQ.x);
    assertClose(pointG.y, mixed(pointQ.x));

    assert.equal(verticalP.point1Id, 'P');
    assert.equal(verticalP.point2Id, 'P_on_exp');
    assert.equal(verticalQ.point1Id, 'Q');
    assert.equal(verticalQ.point2Id, 'Q_on_mixed');

    const labels = example.operations
        .filter(operation => operation.type === 'textLabel')
        .map(operation => operation.text);
    assert.ok(labels.includes('f(t)'));
    assert.ok(labels.includes('g(t)'));
});


test('quality enhancer separates collapsed points on a parameter line by recomputing the function relations', () => {
    const mixed = x => Math.exp(2 * x) - Math.exp(-x) + 1;
    const exp = x => Math.exp(2 * x);
    const collapsedP = Math.log(2) / 2;
    const collapsedQ = 0.276;
    const payload = {
        sourceBindings: [
            {
                pointLabel: 'P',
                onObjectLabels: ['y=t', 'y=e^{2x}-e^{-x}+1'],
                verticalTargetLabel: 'f(t)',
                verticalTargetOnObjectLabel: 'y=e^{2x}'
            },
            {
                pointLabel: 'Q',
                onObjectLabels: ['y=t', 'y=e^{2x}'],
                verticalTargetLabel: 'g(t)',
                verticalTargetOnObjectLabel: 'y=e^{2x}-e^{-x}+1'
            }
        ],
        operations: [
            { op: 'create', id: 'curve_mixed', type: 'function', expression: 'exp(2*x)-exp(-x)+1', xMin: -1.2, xMax: 0.8 },
            { op: 'create', id: 'curve_exp', type: 'function', expression: 'exp(2*x)', xMin: -1.2, xMax: 0.8 },
            { op: 'create', id: 'H1', type: 'point', x: -1.2, y: 2, visible: false },
            { op: 'create', id: 'H2', type: 'point', x: 0.8, y: 2, visible: false },
            { op: 'create', id: 'line_t', type: 'line', point1Id: 'H1', point2Id: 'H2', label: 'y=t' },
            { op: 'create', id: 'P', type: 'point', x: collapsedP, y: 2, label: 'P' },
            { op: 'create', id: 'Q', type: 'point', x: collapsedQ, y: 2, label: 'Q' },
            { op: 'create', id: 'F', type: 'point', x: collapsedP, y: mixed(collapsedP), label: 'f(t)' },
            { op: 'create', id: 'G', type: 'point', x: collapsedQ, y: exp(collapsedQ), label: 'g(t)' },
            { op: 'create', id: 'vertical_P', type: 'segment', point1Id: 'P', point2Id: 'F' },
            { op: 'create', id: 'vertical_Q', type: 'segment', point1Id: 'Q', point2Id: 'G' }
        ]
    };

    const enhanced = enhanceDiagramQuality(payload);
    const objects = new Map(enhanced.operations.map(operation => [operation.id, operation]));
    const pointP = enhanced.operations.find(operation => operation.label === 'P');
    const pointQ = enhanced.operations.find(operation => operation.label === 'Q');
    const pointF = enhanced.operations.find(operation => operation.label === 'f(t)');
    const pointG = enhanced.operations.find(operation => operation.label === 'g(t)');
    const helper1 = objects.get('mg_parameter_left');
    const helper2 = objects.get('mg_parameter_right');

    assert.ok(Math.abs(pointP.x - pointQ.x) >= 0.25);
    assertClose(pointP.y, pointQ.y);
    assertClose(helper1.y, pointP.y);
    assertClose(helper2.y, pointP.y);
    assertClose(mixed(pointP.x), pointP.y, 1e-5);
    assertClose(exp(pointQ.x), pointQ.y, 1e-5);
    assertClose(pointF.x, pointP.x);
    assertClose(pointF.y, exp(pointP.x), 1e-5);
    assertClose(pointG.x, pointQ.x);
    assertClose(pointG.y, mixed(pointQ.x), 1e-5);
    const functionLabelPositions = enhanced.operations.filter(operation => operation.type === 'function').map(operation => operation.labelMathPos);
    assert.equal(functionLabelPositions.length, 2);
    assert.notDeepEqual(functionLabelPositions[0], functionLabelPositions[1]);
    const ids = new Set(enhanced.operations.map(operation => operation.id));
    for (const operation of enhanced.operations) {
        for (const field of ['point1Id', 'point2Id']) {
            if (operation[field]) assert.ok(ids.has(operation[field]), 'missing ' + operation[field]);
        }
    }
});


test('image response schema carries source-grounded named-point bindings', () => {
    const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
        save() { }
    });
    const body = service.buildOpenAIRequestBodyFromInput([
        { role: 'user', content: 'image' }
    ], { responseFormat: GRAPH_IMAGE_OPERATIONS_RESPONSE_FORMAT });
    assert.equal(body.text.format.name, 'graph_image_operations');
    assert.ok(body.text.format.schema.required.includes('sourceBindings'));
});


test('missing parameter bindings use a focused extraction instead of full regeneration', async () => {
    const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
        save() { }
    });
    service.callOpenAIImageAnalysis = async (_image, _prompt, options) => {
        assert.equal(options.responseFormat, GRAPH_IMAGE_BINDINGS_RESPONSE_FORMAT);
        return {
            json: {
                sourceBindings: [
                    {
                        pointLabel: 'P',
                        onObjectLabels: ['y=t', 'y=e^{2x}-e^{-x}+1'],
                        verticalTargetLabel: 'f(t)',
                        verticalTargetOnObjectLabel: 'y=e^{2x}'
                    },
                    {
                        pointLabel: 'Q',
                        onObjectLabels: ['y=t', 'y=e^{2x}'],
                        verticalTargetLabel: 'g(t)',
                        verticalTargetOnObjectLabel: 'y=e^{2x}-e^{-x}+1'
                    }
                ]
            },
            content: 'bindings',
            requestBody: { model: 'gpt-5.4-mini' }
        };
    };

    const failedJson = {
        sourceBindings: [],
        operations: [
            { op: 'create', id: 'curve_mixed', type: 'function', expression: 'exp(2*x)-exp(-x)+1' },
            { op: 'create', id: 'curve_exp', type: 'function', expression: 'exp(2*x)' },
            { op: 'create', id: 'L', type: 'point', x: -1, y: 2, visible: false },
            { op: 'create', id: 'R', type: 'point', x: 1, y: 2, visible: false },
            { op: 'create', id: 'line_t', type: 'line', point1Id: 'L', point2Id: 'R', label: 'y=t' },
            { op: 'create', id: 'P_bad', type: 'intersection', object1Id: 'line_t', object2Id: 'curve_exp', label: 'P' },
            { op: 'create', id: 'Q_bad', type: 'intersection', object1Id: 'line_t', object2Id: 'curve_mixed', label: 'Q' }
        ]
    };
    const result = await service.recoverMissingProblemImageSourceBindings(
        'data:image/png;base64,test',
        failedJson,
        ['sourceBindings must preserve each named parameter-line point.'],
        { mode: AI_COMMAND_MODE.PROBLEM_DIAGRAM, instruction: '', context: null },
        { requestBody: { model: 'gpt-5.4-mini' } }
    );

    assert.equal(result.success, true);
    assert.equal(result.sourceBindingRecovered, true);
    assert.ok(result.json.operations.some(operation => operation.label === 'f(t)'));
    assert.ok(result.json.operations.some(operation => operation.label === 'g(t)'));
    assert.equal(result.json.operations.length, 12);
});


test('image-only uploads use problem-diagram mode in the site flow', () => {
    const mainSource = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
    assert.match(mainSource, /const mode = instruction \? 'patch' : 'problem_diagram'/);
});

test('problem-diagram validation rejects mislabeled parameter lines and repeated vertical intersections', () => {
    const validator = new SemanticValidator();
    const invalid = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: -1, y: 2, visible: false },
            { op: 'create', id: 'B', type: 'point', x: 4, y: 0, visible: false },
            { op: 'create', id: 'line_t', type: 'line', point1Id: 'A', point2Id: 'B', label: 'y=t' },
            { op: 'create', id: 'curve_a', type: 'function', expression: 'exp(2*x)-exp(-x)+1' },
            { op: 'create', id: 'P', type: 'intersection', object1Id: 'line_t', object2Id: 'curve_a', label: 'P' },
            { op: 'create', id: 'vertical_P', type: 'perpendicular', baseLineId: 'line_t', throughPointId: 'P' },
            { op: 'create', id: 'D', type: 'intersection', object1Id: 'vertical_P', object2Id: 'curve_a', label: 'D' },
            { op: 'create', id: 'constant_t', type: 'function', expression: '2', label: 'y=t' },
            { op: 'create', id: 'Q', type: 'intersection', object1Id: 'constant_t', object2Id: 'curve_a', label: 'Q' },
            { op: 'create', id: 'H1', type: 'point', x: -1, y: 0.2, visible: false },
            { op: 'create', id: 'H2', type: 'point', x: 1, y: 0.2, visible: false },
            { op: 'create', id: 'line_s', type: 'line', point1Id: 'H1', point2Id: 'H2', label: 'y=s' },
            { op: 'create', id: 'P2', type: 'point', x: -0.3, y: 0.2, label: 'P' },
            { op: 'create', id: 'Q2', type: 'point', x: -0.2, y: 0.2, label: 'Q' }
        ]
    };

    const result = validator.validateProblemDiagramIntent(invalid);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /labeled y=.*horizontal/i);
    assert.match(result.errors.join('\n'), /repeats the perpendicular through-point/i);
    assert.match(result.errors.join('\n'), /function-function intersections are not supported/i);
    assert.match(result.errors.join('\n'), /parameter-line named points are too close/i);
});


test('parameterized two-function diagrams require complete source bindings', () => {
    const validator = new SemanticValidator();
    const invalid = {
        sourceBindings: [],
        operations: [
            { op: 'create', id: 'curve_a', type: 'function', expression: 'exp(2*x)-exp(-x)+1' },
            { op: 'create', id: 'curve_b', type: 'function', expression: 'exp(2*x)' },
            { op: 'create', id: 'L', type: 'point', x: -1, y: 2, visible: false },
            { op: 'create', id: 'R', type: 'point', x: 1, y: 2, visible: false },
            { op: 'create', id: 'line_t', type: 'line', point1Id: 'L', point2Id: 'R', label: 'y=t' },
            { op: 'create', id: 'P', type: 'intersection', object1Id: 'line_t', object2Id: 'curve_a', label: 'P' },
            { op: 'create', id: 'Q', type: 'intersection', object1Id: 'line_t', object2Id: 'curve_b', label: 'Q' }
        ]
    };
    const result = validator.validateProblemDiagramIntent(invalid);
    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /sourceBindings must preserve/);
});


test('semantic relation repairs get focused guidance without carrying slow reasoning history', () => {
    const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-5.4-mini',
        save() { }
    });
    const errors = [
        'line labeled y=t must be horizontal; its defining points are not aligned.',
        'intersection "D" repeats the perpendicular through-point on the same function.',
        'sourceBindings must preserve each named parameter-line point.'
    ];

    assert.equal(
        service.selectImageRepairReasoningEffort(AI_COMMAND_MODE.PROBLEM_DIAGRAM, errors),
        'low'
    );
    assert.equal(
        service.selectImageRepairReasoningEffort(AI_COMMAND_MODE.PROBLEM_DIAGRAM, ['operations is empty.']),
        'low'
    );

    const prompt = service.buildImageRepairPrompt('original', { operations: [] }, errors, {
        mode: AI_COMMAND_MODE.PROBLEM_DIAGRAM
    });
    assert.match(prompt, /MATHEMATICAL_RELATION_MISMATCH/);
    assert.match(prompt, /labeled y=parameter must be horizontal/i);
    assert.match(prompt, /other stated curve/i);
    assert.match(prompt, /Populate sourceBindings/);
});


test('problem-image recovery starts fresh after empty and invalid JSON responses', async () => {
    const originalFetch = globalThis.fetch;
    const capturedBodies = [];
    globalThis.fetch = async (_url, options) => {
        const body = JSON.parse(options.body);
        capturedBodies.push(body);
        const attempt = capturedBodies.length;
        const operations = attempt < 3
            ? []
            : [
                {
                    op: 'create',
                    id: 'curve_mixed',
                    type: 'function',
                    expression: 'exp(2*x)-exp(-x)+1',
                    xMin: -1.2,
                    xMax: 0.65,
                    showLabel: false
                },
                {
                    op: 'create',
                    id: 'curve_exp',
                    type: 'function',
                    expression: 'exp(2*x)',
                    xMin: -1.2,
                    xMax: 0.65,
                    showLabel: false
                }
            ];

        return {
            ok: true,
            async json() {
                return {
                    id: `resp_problem_image_${attempt}`,
                    output: [{
                        type: 'message',
                        content: [{
                            type: 'output_text',
                            text: attempt === 2 ? 'unable to provide structured JSON' : JSON.stringify({ operations })
                        }]
                    }]
                };
            }
        };
    };

    try {
        const service = new AIService({
            provider: 'openai',
            apiKey: 'test-key',
            model: 'gpt-5.4-mini',
            save() { }
        });
        const options = service.normalizeImageAnalysisOptions({
            mode: AI_COMMAND_MODE.PROBLEM_DIAGRAM,
            context: { objects: [], selectedObjectIds: [] }
        });
        assert.equal(options.mode, AI_COMMAND_MODE.PROBLEM_DIAGRAM);

        const result = await service.analyzeImage('data:image/png;base64,PROBLEM_TEXT_ONLY', options);

        assert.equal(result.success, true);
        assert.equal(result.mode, AI_COMMAND_MODE.PROBLEM_DIAGRAM);
        assert.equal(result.recovered, true);
        assert.equal(capturedBodies.length, 3);
        assert.match(capturedBodies[0].input[1].content[0].text, /problem_diagram/);
        assert.equal(capturedBodies[0].reasoning.effort, 'low');
        assert.equal('previous_response_id' in capturedBodies[1], false);
        assert.equal(capturedBodies[1].reasoning.effort, 'low');
        assert.equal('previous_response_id' in capturedBodies[2], false);
        assert.equal(capturedBodies[2].reasoning.effort, 'medium');
        assert.match(capturedBodies[2].input[1].content[0].text, /fresh independent recovery/i);
        assert.match(capturedBodies[2].input[1].content[0].text, /must not be empty/i);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
