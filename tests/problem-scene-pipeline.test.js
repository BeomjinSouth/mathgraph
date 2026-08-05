import test from 'node:test';
import assert from 'node:assert/strict';

import {
    AI_COMMAND_MODE,
    AIService,
    DEFAULT_OPENAI_MODEL,
    OPENAI_IMAGE_FAST_MODEL
} from '../js/ai/AIService.js';
import {
    PROBLEM_SCENE_RESPONSE_FORMAT,
    compileProblemScenePayload,
    validateProblemSceneCoverage
} from '../js/ai/ProblemScenePipeline.js';

const emptyStyle = () => ({
    color: null,
    lineWidth: null,
    dashed: null,
    fillColor: null,
    fillOpacity: null,
    visible: null,
    pointStyle: null,
    labelOffset: []
});

const node = (id, kind, overrides = {}) => ({
    id,
    kind,
    label: null,
    refs: [],
    groups: [],
    numbers: [],
    text: '',
    style: emptyStyle(),
    ...overrides
});

function scenePayload(overrides = {}) {
    return {
        scene: {
            diagramType: 'plane_geometry',
            sourceHasPrintedFigure: false,
            constructionSummary: 'Place P and Q, draw PQ, then place F on PQ.',
            confidence: 0.9,
            nodes: [
                node('PQ', 'segment', { refs: ['P', 'Q'] }),
                node('F', 'pointOnLine', { label: 'F', refs: ['PQ'], numbers: [0.4] }),
                node('P', 'point', { label: 'P', numbers: [-2, 0] }),
                node('Q', 'point', { label: 'Q', numbers: [3, 0] })
            ],
            relations: [],
            mustDraw: [
                {
                    id: 'fact-pqf',
                    description: 'F lies on segment PQ.',
                    nodeIds: ['P', 'Q', 'PQ', 'F'],
                    relationIds: [],
                    required: true,
                    evidence: '점 F가 선분 PQ 위에 있다.'
                }
            ],
            sourceBindings: [],
            unsupported: [],
            ...overrides
        }
    };
}

test('compact problem scene schema stays much narrower than GraphA operations output', () => {
    const sceneSchema = PROBLEM_SCENE_RESPONSE_FORMAT.schema.properties.scene;
    const nodeProperties = sceneSchema.properties.nodes.items.properties;

    assert.deepEqual(Object.keys(nodeProperties), [
        'id', 'kind', 'label', 'refs', 'groups', 'numbers', 'text', 'style'
    ]);
    assert.equal(PROBLEM_SCENE_RESPONSE_FORMAT.name, 'math_problem_scene');
});

test('problem scenes resolve dependencies and preserve point-on-segment construction', () => {
    const compiled = compileProblemScenePayload(scenePayload());

    assert.deepEqual(compiled.operations.map(operation => operation.id), ['P', 'Q', 'PQ', 'F']);
    assert.equal(compiled.operations.at(-1).type, 'pointOnLine');
    assert.equal(compiled.operations.at(-1).lineId, 'PQ');
    assert.equal(compiled.operations.at(-1).t, 0.4);
    assert.deepEqual(validateProblemSceneCoverage(scenePayload().scene, compiled), { valid: true, errors: [] });
});

test('coverage rejects a required source item that was not compiled', () => {
    const payload = scenePayload({
        mustDraw: [{
            id: 'shaded-acf',
            description: 'Shaded triangle ACF',
            nodeIds: ['ACF'],
            relationIds: [],
            required: true,
            evidence: 'The printed figure shades triangle ACF.'
        }]
    });
    const compiled = compileProblemScenePayload(payload);
    const validation = validateProblemSceneCoverage(payload.scene, compiled);

    assert.equal(validation.valid, false);
    assert.match(validation.errors.join('\n'), /ACF/);
});

test('semicircle coverage requires an arc instead of accepting a full circle stand-in', () => {
    const nodes = [
        node('A', 'point', { label: 'A', numbers: [2, 0] }),
        node('B', 'point', { label: 'B', numbers: [-2, 0] }),
        node('O', 'point', { label: 'O', numbers: [0, 0] }),
        node('circle_AB', 'circle', { refs: ['O', 'A'] }),
        node('semicircle_AB', 'arc', { refs: ['circle_AB', 'A', 'B'], text: 'minor' })
    ];
    const validPayload = scenePayload({
        nodes,
        mustDraw: [{
            id: 'semicircle',
            description: 'Semicircle with diameter AB',
            nodeIds: ['semicircle_AB'],
            relationIds: [],
            required: true,
            evidence: 'printed semicircle'
        }]
    });
    assert.equal(
        validateProblemSceneCoverage(validPayload.scene, compileProblemScenePayload(validPayload)).valid,
        true
    );

    const invalidPayload = scenePayload({
        nodes: nodes.slice(0, 4),
        mustDraw: [{
            id: 'semicircle',
            description: 'Semicircle with diameter AB',
            nodeIds: ['circle_AB'],
            relationIds: [],
            required: true,
            evidence: 'printed semicircle'
        }]
    });
    const invalid = validateProblemSceneCoverage(
        invalidPayload.scene,
        compileProblemScenePayload(invalidPayload)
    );
    assert.equal(invalid.valid, false);
    assert.match(invalid.errors.join('\n'), /no arc operation/);
});

test('solid scenes compile a prism and a source-required shaded cross-section', () => {
    const payload = scenePayload({
        diagramType: 'solid_geometry',
        nodes: [
            node('solid', 'prism', { groups: [['E', 'F', 'G', 'H'], ['A', 'B', 'C', 'D']] }),
            node('ACF', 'polygon', {
                refs: ['A', 'C', 'F'],
                style: { ...emptyStyle(), fillColor: '#777777', fillOpacity: 0.2 }
            }),
            node('A', 'point', { label: 'A', numbers: [-2, 4] }),
            node('B', 'point', { label: 'B', numbers: [1, 3.7] }),
            node('C', 'point', { label: 'C', numbers: [2.5, 4.4] }),
            node('D', 'point', { label: 'D', numbers: [-0.7, 4.8] }),
            node('E', 'point', { label: 'E', numbers: [-2, -2] }),
            node('F', 'point', { label: 'F', numbers: [1, -2.3] }),
            node('G', 'point', { label: 'G', numbers: [2.5, -1.5] }),
            node('H', 'point', { label: 'H', numbers: [-0.7, -1.1] })
        ],
        mustDraw: [
            {
                id: 'prism',
                description: 'Rectangular prism ABCD-EFGH',
                nodeIds: ['solid'],
                relationIds: [],
                required: true,
                evidence: 'printed solid'
            },
            {
                id: 'shaded-face',
                description: 'Shaded triangle ACF',
                nodeIds: ['ACF'],
                relationIds: [],
                required: true,
                evidence: 'printed shaded cross-section'
            }
        ]
    });
    const compiled = compileProblemScenePayload(payload);
    const validation = validateProblemSceneCoverage(payload.scene, compiled);

    assert.equal(validation.valid, true, validation.errors.join('\n'));
    assert.equal(compiled.operations.find(operation => operation.id === 'solid').type, 'prism');
    assert.equal(compiled.operations.find(operation => operation.id === 'ACF').fillOpacity, 0.2);
});

test('analytic scenes compile functions, construction lines, and intersections from compact relations', () => {
    const payload = scenePayload({
        diagramType: 'analytic_geometry',
        nodes: [
            node('curve_exp', 'function', { text: 'exp(2*x)', numbers: [-2, 2] }),
            node('line_t', 'line', { refs: ['L1', 'L2'], label: 'y=t' }),
            node('L1', 'point', { numbers: [-2, 1] }),
            node('L2', 'point', { numbers: [2, 1] })
        ],
        relations: [
            node('P', 'intersection', { refs: ['line_t', 'curve_exp'], numbers: [0], label: 'P' })
        ],
        mustDraw: [{
            id: 'vertical-map',
            description: 'The stated curve, parameter line, and their intersection P',
            nodeIds: ['curve_exp', 'line_t'],
            relationIds: ['P'],
            required: true,
            evidence: 'printed function construction'
        }],
        sourceBindings: [{
            pointLabel: 'P',
            onObjectLabels: ['y=t', 'y=e^(2x)'],
            verticalTargetLabel: null,
            verticalTargetOnObjectLabel: null
        }]
    });
    const compiled = compileProblemScenePayload(payload);
    const validation = validateProblemSceneCoverage(payload.scene, compiled);

    assert.equal(validation.valid, true, validation.errors.join('\n'));
    assert.equal(compiled.operations.find(operation => operation.id === 'curve_exp').type, 'function');
    assert.equal(compiled.operations.find(operation => operation.id === 'P').type, 'intersection');
    assert.equal(compiled.sourceBindings[0].pointLabel, 'P');
});

test('coverage rejects a named point duplicated as both a helper node and an intersection', () => {
    const payload = scenePayload({
        nodes: [
            node('curve', 'function', { text: 'sqrt(x-2)', numbers: [2, 8] }),
            node('H1', 'point', { numbers: [0, 4] }),
            node('H2', 'point', { numbers: [4, 0] }),
            node('line_l', 'line', { refs: ['H1', 'H2'], label: 'l' }),
            node('P', 'point', { label: 'P', numbers: [4, 0] })
        ],
        relations: [
            node('P', 'intersection', { label: 'P', refs: ['line_l', 'curve'], numbers: [0] })
        ],
        mustDraw: [{
            id: 'intersection-p',
            description: 'P is the intersection of l and f',
            nodeIds: ['curve', 'line_l'],
            relationIds: ['P'],
            required: true,
            evidence: 'printed relation'
        }]
    });
    const compiled = compileProblemScenePayload(payload);
    const validation = validateProblemSceneCoverage(payload.scene, compiled);

    assert.equal(validation.valid, false);
    assert.match(validation.errors.join('\n'), /id "P" is duplicated/);
    assert.match(compiled.warnings.join('\n'), /relation "P".*duplicated/);
});

test('scene compiler resolves midpoint to line to second circle intersection dependencies', () => {
    const payload = scenePayload({
        nodes: [
            node('A', 'point', { label: 'A', numbers: [0, 0] }),
            node('B', 'point', { label: 'B', numbers: [3, 0] }),
            node('C', 'point', { label: 'C', numbers: [3.5, Math.sqrt(15) / 2] }),
            node('AB', 'segment', { refs: ['A', 'B'] }),
            node('BC', 'segment', { refs: ['B', 'C'] }),
            node('AC', 'segment', { refs: ['A', 'C'] }),
            node('circumcircle', 'circleThreePoints', { refs: ['A', 'B', 'C'] }),
            node('BM', 'line', { refs: ['B', 'M'] })
        ],
        relations: [
            node('M', 'midpoint', { label: 'M', refs: ['AC'] }),
            node('D', 'intersection', {
                label: 'D',
                refs: ['circumcircle', 'BM'],
                numbers: [1]
            })
        ],
        mustDraw: [{
            id: 'circumcircle-median-second-intersection',
            description: 'Triangle ABC, midpoint M, line BM, and the second circle intersection D',
            nodeIds: ['A', 'B', 'C', 'AB', 'BC', 'AC', 'circumcircle', 'BM'],
            relationIds: ['M', 'D'],
            required: true,
            evidence: 'M is the midpoint of AC and D is the other intersection of the circumcircle and line BM.'
        }]
    });

    const compiled = compileProblemScenePayload(payload);
    const validation = validateProblemSceneCoverage(payload.scene, compiled);
    const ids = compiled.operations.map(operation => operation.id);

    assert.equal(validation.valid, true, validation.errors.join('\n'));
    assert.ok(ids.indexOf('M') < ids.indexOf('BM'));
    assert.ok(ids.indexOf('BM') < ids.indexOf('D'));
    assert.equal(compiled.operations.find(operation => operation.id === 'BM').type, 'line');
    assert.equal(compiled.operations.find(operation => operation.id === 'D').type, 'intersection');
    assert.equal(compiled.operations.find(operation => operation.id === 'D').branch, 0);
});

test('scene compiler reuses an intersection in later area polygons without visible helper labels', () => {
    const payload = scenePayload({
        nodes: [
            node('A', 'point', { label: 'A', numbers: [2.16, 6.66] }),
            node('B', 'point', { label: 'B', numbers: [0, 0] }),
            node('C', 'point', { label: 'C', numbers: [9, 0] }),
            node('AB', 'segment', { refs: ['A', 'B'] }),
            node('BC', 'segment', { refs: ['B', 'C'] }),
            node('AC', 'segment', { refs: ['A', 'C'] }),
            node('D', 'pointOnLine', { label: 'D', refs: ['BC'], numbers: [1 / 3] }),
            node('E', 'pointOnLine', { label: 'E', refs: ['AC'], numbers: [1 / 2] }),
            node('AD', 'segment', { refs: ['A', 'D'] }),
            node('BE', 'segment', { refs: ['B', 'E'] }),
            node('region_BDF', 'polygon', {
                refs: ['B', 'D', 'F'],
                style: { ...emptyStyle(), fillOpacity: 0.2 }
            }),
            node('region_FDCE', 'polygon', {
                refs: ['F', 'D', 'C', 'E'],
                style: { ...emptyStyle(), fillOpacity: 0.18 }
            }),
            node('helper', 'point', {
                numbers: [-1, -1],
                style: { ...emptyStyle(), visible: false }
            })
        ],
        relations: [
            node('F', 'intersection', { label: 'F', refs: ['AD', 'BE'], numbers: [0] })
        ],
        mustDraw: [{
            id: 'area-ratio-regions',
            description: 'The two requested area regions BDF and FDCE',
            nodeIds: ['D', 'E', 'AD', 'BE', 'region_BDF', 'region_FDCE'],
            relationIds: ['F'],
            required: true,
            evidence: 'F is the intersection of AD and BE.'
        }]
    });

    const compiled = compileProblemScenePayload(payload);
    const validation = validateProblemSceneCoverage(payload.scene, compiled);
    const ids = compiled.operations.map(operation => operation.id);
    const regions = compiled.operations.filter(operation => operation.type === 'polygon');

    assert.equal(validation.valid, true, validation.errors.join('\n'));
    assert.ok(ids.indexOf('F') < ids.indexOf('region_BDF'));
    assert.ok(ids.indexOf('F') < ids.indexOf('region_FDCE'));
    assert.ok(regions.every(operation => operation.showLabel === false));
    assert.equal(compiled.operations.find(operation => operation.id === 'helper').showLabel, false);
    assert.equal(compiled.operations.find(operation => operation.id === 'F').showLabel, true);
});

test('image-only problem diagrams use one Luna scene call and local compilation on success', async () => {
    const service = new AIService({
        provider: 'openai',
        model: DEFAULT_OPENAI_MODEL,
        save() { }
    });
    service.config.authMode = 'owner';
    service.config.proxyToken = 'owner-token';
    service.config.proxyTokenExpiresAt = Date.now() + 60_000;
    let calls = 0;
    let capturedOptions = null;
    service.callOpenAIProblemSceneAnalysis = async (_image, _prompt, options) => {
        calls += 1;
        capturedOptions = options;
        return {
            json: scenePayload(),
            content: JSON.stringify(scenePayload()),
            requestBody: { model: OPENAI_IMAGE_FAST_MODEL },
            data: { usage: { input_tokens: 1000, output_tokens: 500 } }
        };
    };

    const result = await service.analyzeImage('data:image/png;base64,SCENE', {
        instruction: '',
        mode: AI_COMMAND_MODE.PROBLEM_DIAGRAM,
        context: null
    });

    assert.equal(DEFAULT_OPENAI_MODEL, 'gpt-5.6-luna');
    assert.equal(OPENAI_IMAGE_FAST_MODEL, 'gpt-5.6-luna');
    assert.equal(calls, 1);
    assert.equal(capturedOptions.detail, 'original');
    assert.equal(capturedOptions.reasoningEffort, 'medium');
    assert.equal(result.success, true);
    assert.equal(result.sceneCompiled, true);
    assert.equal(result.json.operations.at(-1).type, 'pointOnLine');
    assert.deepEqual(result.usage, { input_tokens: 1000, output_tokens: 500 });
});
