import assert from 'node:assert/strict';
import test from 'node:test';

import { AI_COMMAND_MODE, AIService } from '../js/ai/AIService.js';
import {
    IMAGE_ANALYSIS_TRACE_MAX_BYTES,
    ImageAnalysisTraceStore,
    createImageAnalysisTrace,
    diffImageAnalysisOperations,
    finalizeImageAnalysisTrace,
    fitImageAnalysisTraceToSize,
    recordImageAnalysisStage
} from '../js/ai/ImageAnalysisTrace.js';

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        values,
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        },
        removeItem(key) {
            values.delete(key);
        }
    };
}

function emptyStyle() {
    return {
        color: null,
        lineWidth: null,
        dashed: null,
        fillColor: null,
        fillOpacity: null,
        visible: null,
        pointStyle: null,
        labelOffset: []
    };
}

function sceneNode(id, kind, overrides = {}) {
    return {
        id,
        kind,
        label: null,
        refs: [],
        groups: [],
        numbers: [],
        text: '',
        style: emptyStyle(),
        ...overrides
    };
}

function createSceneWithExtraDiagonal() {
    return {
        scene: {
            diagramType: 'plane_geometry',
            sourceHasPrintedFigure: true,
            constructionSummary: 'This text must be removed from persisted diagnostics.',
            confidence: 0.8,
            nodes: [
                sceneNode('A', 'point', { label: 'A', numbers: [-1, 0] }),
                sceneNode('B', 'point', { label: 'B', numbers: [1, 0] }),
                sceneNode('C', 'point', { label: 'C', numbers: [0, 1] }),
                sceneNode('AB', 'segment', { refs: ['A', 'B'] }),
                sceneNode('extra_diag', 'segment', { refs: ['A', 'C'], style: { ...emptyStyle(), dashed: true } })
            ],
            relations: [],
            mustDraw: [{
                id: 'required-base',
                description: 'Required segment AB',
                nodeIds: ['A', 'B', 'AB'],
                relationIds: [],
                required: true,
                evidence: 'Printed evidence must not be persisted.'
            }],
            sourceBindings: [],
            unsupported: []
        }
    };
}

test('operation diff identifies the stage that added, removed, or changed work', () => {
    const before = [
        { op: 'create', id: 'A', type: 'point', x: 0, y: 0 },
        { op: 'create', id: 'AB', type: 'segment', dashed: false }
    ];
    const after = [
        { op: 'create', id: 'AB', type: 'segment', dashed: true },
        { op: 'create', id: 'extra', type: 'segment', dashed: true }
    ];

    const diff = diffImageAnalysisOperations(before, after);

    assert.deepEqual(diff.added.map(item => item.key), ['extra']);
    assert.deepEqual(diff.removed.map(item => item.key), ['A']);
    assert.deepEqual(diff.changed.map(item => item.key), ['AB']);
    assert.deepEqual(diff.changed[0].fields, ['dashed']);
});

test('persisted traces remove credentials, raw images, prompts, and source evidence', () => {
    const storage = createStorage();
    const store = new ImageAnalysisTraceStore(storage);
    const trace = createImageAnalysisTrace({
        source: 'paste',
        mode: 'problem_diagram',
        input: {
            instruction: 'private user prompt',
            instructionProvided: true,
            imageDataUrl: 'data:image/png;base64,raw-source-image'
        }
    });
    recordImageAnalysisStage(trace, 'model_scene', {
        status: 'ok',
        meta: {
            apiKey: 'sk-sensitive',
            authorization: 'Bearer private-token',
            token: 'generic-private-token',
            responseId: 'resp_safe'
        },
        snapshot: {
            constructionSummary: 'private source summary',
            evidence: 'private printed evidence',
            text: 'y=x^2',
            note: 'embedded Bearer abc.def.ghi and sk-1234567890abcdef plus data:image/png;base64,embedded-image',
            image_url: 'data:image/jpeg;base64,processed-source-image'
        }
    });
    finalizeImageAnalysisTrace(trace, { success: true, outcome: 'applied' });

    const saved = store.save(trace);
    const serialized = JSON.stringify(saved);

    assert.doesNotMatch(
        serialized,
        /sk-sensitive|private-token|generic-private-token|1234567890abcdef|embedded-image|raw-source-image|processed-source-image/
    );
    assert.doesNotMatch(serialized, /private user prompt|private source summary|private printed evidence/);
    assert.match(serialized, /resp_safe/);
    assert.match(serialized, /y=x\^2/);
});

test('trace storage keeps five recent reports and recovers from malformed data', () => {
    const storage = createStorage();
    const store = new ImageAnalysisTraceStore(storage);

    for (let index = 0; index < 7; index += 1) {
        const trace = createImageAnalysisTrace({ input: { sequence: index } });
        finalizeImageAnalysisTrace(trace, { success: true, outcome: 'applied' });
        store.save(trace);
    }

    const traces = store.getAll();
    assert.equal(traces.length, 5);
    assert.deepEqual(traces.map(trace => trace.request.sequence), [2, 3, 4, 5, 6]);

    storage.setItem(store.storageKey, JSON.stringify([{
        traceId: 'legacy-trace',
        token: 'legacy-private-token',
        request: { mode: 'problem_diagram' },
        stages: []
    }]));
    assert.doesNotMatch(JSON.stringify(store.getAll()), /legacy-private-token/);

    storage.setItem(store.storageKey, '{broken json');
    assert.deepEqual(store.getAll(), []);
    assert.equal(store.getLast(), null);
});

test('oversized stage snapshots are compacted before persistence', () => {
    const trace = createImageAnalysisTrace();
    recordImageAnalysisStage(trace, 'model_scene', {
        snapshot: {
            nodes: Array.from({ length: 120 }, (_, index) => ({
                id: `node_${index}`,
                text: 'x'.repeat(3000)
            }))
        }
    });
    finalizeImageAnalysisTrace(trace, { success: false, outcome: 'analysis_failed' });

    const fitted = fitImageAnalysisTraceToSize(trace);
    const byteLength = new TextEncoder().encode(JSON.stringify(fitted)).length;

    assert.ok(byteLength <= IMAGE_ANALYSIS_TRACE_MAX_BYTES);
    assert.equal(fitted.storageTruncated, true);
    assert.equal(fitted.stages[0].snapshot.truncated, true);
});

test('problem scene trace shows an extra diagonal already present before compilation', () => {
    const trace = createImageAnalysisTrace({ mode: AI_COMMAND_MODE.PROBLEM_DIAGRAM });
    const service = new AIService({
        provider: 'local',
        apiKey: '',
        save() { }
    });
    service.enhanceDiagramQuality = json => json;
    service.validateImageAnalysisIntent = () => ({ valid: true, errors: [] });

    const result = service.compileProblemSceneAttempt({
        json: createSceneWithExtraDiagonal(),
        requestBody: { model: 'test-model' },
        data: { id: 'resp_scene' }
    }, {
        trace,
        instruction: '',
        context: null,
        mode: AI_COMMAND_MODE.PROBLEM_DIAGRAM
    }, 1, 12);

    assert.equal(result.valid, true);
    const modelStage = trace.stages.find(stage => stage.name === 'model_scene');
    const compileStage = trace.stages.find(stage => stage.name === 'scene_compile');
    const enhancementStage = trace.stages.find(stage => stage.name === 'quality_enhancement');
    assert.ok(modelStage.snapshot.nodes.some(node => node.id === 'extra_diag'));
    assert.ok(compileStage.snapshot.operations.some(operation => operation.id === 'extra_diag'));
    assert.deepEqual(enhancementStage.changes.added, []);

    finalizeImageAnalysisTrace(trace, { success: true, outcome: 'applied' });
    assert.equal(trace.status, 'source_fidelity_unverified');
    assert.equal(trace.suspectedStage, 'source_fidelity_unverified');
});

test('the first failed stage becomes the suspected stage', () => {
    const trace = createImageAnalysisTrace();
    recordImageAnalysisStage(trace, 'model_scene', { status: 'ok' });
    recordImageAnalysisStage(trace, 'scene_compile', {
        status: 'error',
        errors: ['unknown node kind']
    });
    recordImageAnalysisStage(trace, 'canvas_apply', { status: 'not_run' });

    finalizeImageAnalysisTrace(trace, {
        success: false,
        outcome: 'analysis_failed',
        error: 'compile failed'
    });

    assert.equal(trace.status, 'failed');
    assert.equal(trace.suspectedStage, 'scene_compile');
});
