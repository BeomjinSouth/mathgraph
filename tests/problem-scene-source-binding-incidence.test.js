import test from 'node:test';
import assert from 'node:assert/strict';

import {
    compileProblemScenePayload,
    validateProblemSceneCoverage
} from '../js/ai/ProblemScenePipeline.js';

const style = {
    color: null,
    lineWidth: null,
    dashed: null,
    fillColor: null,
    fillOpacity: null,
    visible: null,
    pointStyle: null,
    labelOffset: []
};

const item = (id, kind, overrides = {}) => ({
    id,
    kind,
    label: null,
    refs: [],
    groups: [],
    numbers: [],
    text: '',
    style,
    ...overrides
});

function scenePayload(nodes, sourceBindings) {
    return {
        scene: {
            diagramType: 'coordinate-plane circle with function graphs',
            sourceHasPrintedFigure: true,
            constructionSummary: 'Circle with named points and two function graphs.',
            confidence: 0.9,
            nodes,
            relations: [],
            mustDraw: [{
                id: 'draw-all',
                description: 'Circle, graphs, and named points',
                nodeIds: nodes.map(node => node.id),
                relationIds: [],
                required: true,
                evidence: 'printed figure'
            }],
            sourceBindings,
            unsupported: []
        }
    };
}

const binding = (pointLabel, onObjectLabels) => ({
    pointLabel,
    onObjectLabels,
    verticalTargetLabel: null,
    verticalTargetOnObjectLabel: null
});

test('coverage rejects declared on-circle points that resolve off the circle', () => {
    // 2026-08-05 트레이스 재현: 모델이 O를 중심으로 한 원을 반환하면서
    // sourceBindings에는 O·P·B·C가 모두 원 위에 있다고 선언했다.
    const payload = scenePayload([
        item('pA', 'point', { label: 'A', numbers: [-0.7, 0] }),
        item('pO', 'point', { label: 'O', numbers: [0, 0] }),
        item('pP', 'point', { label: 'P', numbers: [-1.75, 1.3] }),
        item('pB', 'point', { label: 'B', numbers: [2.5, 4.3] }),
        item('pC', 'point', { label: 'C', numbers: [3.15, 2.6] }),
        item('circMain', 'circle', { refs: ['pO'], numbers: [2.5] }),
        item('graphF', 'function', {
            label: 'y=f(x)', text: '1.18*(x+0.7)^2', numbers: [-3, 0.2, -0.5, 5.2]
        }),
        item('graphG', 'function', {
            label: 'y=g(x)', text: '0.68*x^2', numbers: [-1.1, 3.05, -0.5, 5.2]
        })
    ], [
        binding('A', ['x-axis']),
        binding('O', ['x-axis', 'y-axis', 'circle']),
        binding('P', ['circle', 'y=f(x)']),
        binding('B', ['circle', 'y=g(x)']),
        binding('C', ['circle'])
    ]);

    const validation = validateProblemSceneCoverage(payload.scene, compileProblemScenePayload(payload));

    assert.equal(validation.valid, false);
    const text = validation.errors.join('\n');
    assert.match(text, /point "O" .*circle/i);
    assert.match(text, /point "P" .*circle/i);
    assert.match(text, /point "B" .*circle/i);
    assert.match(text, /point "C" .*circle/i);
});

test('coverage accepts on-circle points that satisfy the declared incidence', () => {
    // O(0,0)·P(-2.4,1.8)·B(1.8,4.4)를 지나는 원(중심 근사 (0.093,2.483), r≈2.485)
    // 대신 정확한 구성을 위해 circleThreePoints를 사용한다.
    const payload = scenePayload([
        item('pO', 'point', { label: 'O', numbers: [0, 0] }),
        item('pP', 'point', { label: 'P', numbers: [-2.4, 1.8] }),
        item('pB', 'point', { label: 'B', numbers: [1.8, 4.4] }),
        item('circMain', 'circleThreePoints', { refs: ['pO', 'pP', 'pB'] })
    ], [
        binding('O', ['circle']),
        binding('P', ['circle']),
        binding('B', ['circle'])
    ]);

    assert.deepEqual(
        validateProblemSceneCoverage(payload.scene, compileProblemScenePayload(payload)),
        { valid: true, errors: [] }
    );
});

test('coverage rejects declared axis points that resolve off the axis', () => {
    const payload = scenePayload([
        item('pA', 'point', { label: 'A', numbers: [-0.7, 0.9] })
    ], [
        binding('A', ['x-axis'])
    ]);

    const validation = validateProblemSceneCoverage(payload.scene, compileProblemScenePayload(payload));

    assert.equal(validation.valid, false);
    assert.match(validation.errors.join('\n'), /point "A" .*x-axis/i);
});

test('coverage rejects declared on-curve points far from the function graph', () => {
    const payload = scenePayload([
        item('pB', 'point', { label: 'B', numbers: [2, 0.5] }),
        item('graphG', 'function', { label: 'y=g(x)', text: 'x^2', numbers: [-3, 3, -1, 9] })
    ], [
        binding('B', ['y=g(x)'])
    ]);

    const validation = validateProblemSceneCoverage(payload.scene, compileProblemScenePayload(payload));

    assert.equal(validation.valid, false);
    assert.match(validation.errors.join('\n'), /point "B" .*y=g\(x\)/i);
});

test('coverage skips bindings it cannot resolve unambiguously', () => {
    // 원이 두 개면 "circle"이 어느 쪽인지 확정할 수 없으므로 검사하지 않는다.
    const payload = scenePayload([
        item('pP', 'point', { label: 'P', numbers: [5, 5] }),
        item('c1c', 'point', { numbers: [0, 0], style: { ...style, visible: false } }),
        item('c2c', 'point', { numbers: [3, 0], style: { ...style, visible: false } }),
        item('circA', 'circle', { refs: ['c1c'], numbers: [1] }),
        item('circB', 'circle', { refs: ['c2c'], numbers: [1] })
    ], [
        binding('P', ['circle'])
    ]);

    assert.deepEqual(
        validateProblemSceneCoverage(payload.scene, compileProblemScenePayload(payload)),
        { valid: true, errors: [] }
    );
});
