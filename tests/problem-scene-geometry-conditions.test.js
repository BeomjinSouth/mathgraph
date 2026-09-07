import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';

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

function lineRelationScene(kind, secondEnd = [5, 3], throughPoint = false) {
    const payload = scenePayload([
        item('A', 'point', { numbers: [0, 0] }),
        item('B', 'point', { numbers: [4, 0] }),
        item('C', 'point', { numbers: [1, 3] }),
        item('D', 'point', { numbers: secondEnd }),
        item('AB', 'segment', { refs: ['A', 'B'] }),
        item('CD', 'segment', { refs: ['C', 'D'] })
    ], [item('relation', kind, { refs: ['AB', throughPoint ? 'C' : 'CD'] })]);
    payload.scene.mustDraw = [{ id: 'line-condition', description: kind,
        nodeIds: ['AB', 'CD'], relationIds: ['relation'], required: true }];
    return payload;
}

test('two existing parallel segments apply without treating a segment as a point or adding a line', () => {
    const payload = lineRelationScene('parallel');
    const compiled = compileProblemScenePayload(payload);
    const manager = new ObjectManager();
    const result = new PatchApplier(manager, new HistoryManager(manager)).apply(compiled);
    assert.equal(result.success, true, result.message);
    assert.equal(validateProblemSceneCoverage(payload.scene, compiled).valid, true);
    assert.equal(manager.getAllObjects().length, 6);
    assert.ok(manager.getAllObjects().every(object => object.valid));
});

test('two existing perpendicular segments are checked without creating another line', () => {
    const payload = lineRelationScene('perpendicular', [1, -2]);
    const compiled = compileProblemScenePayload(payload);
    assert.equal(validateProblemSceneCoverage(payload.scene, compiled).valid, true);
    const manager = new ObjectManager();
    assert.equal(new PatchApplier(manager, new HistoryManager(manager)).apply(compiled).success, true);
    assert.equal(manager.getAllObjects().length, 6);
});

test('line conditions that disagree with resolved coordinates are rejected before drawing', () => {
    for (const [kind, end] of [['parallel', [5, 5]], ['perpendicular', [5, 3]], ['parallel', [1, 3]]]) {
        const payload = lineRelationScene(kind, end);
        const validation = validateProblemSceneCoverage(payload.scene, compileProblemScenePayload(payload));
        assert.equal(validation.valid, false, `${kind}: ${end}`);
        assert.match(validation.errors.join(' '), /relation/);
    }
});

test('parallel and perpendicular constructions through a point still create valid editable lines', () => {
    for (const kind of ['parallel', 'perpendicular']) {
        const payload = lineRelationScene(kind, [5, 3], true);
        const compiled = compileProblemScenePayload(payload);
        assert.equal(validateProblemSceneCoverage(payload.scene, compiled).valid, true);
        const manager = new ObjectManager();
        assert.equal(new PatchApplier(manager, new HistoryManager(manager)).apply(compiled).success, true);
        assert.equal(manager.getAllObjects().length, 7);
        assert.ok(manager.getAllObjects().every(object => object.valid));
    }
});

test('a line construction cannot use a non-line base or non-point through reference', () => {
    const payload = lineRelationScene('parallel', [5, 3], true);
    payload.scene.relations[0].refs = ['A', 'C'];
    const validation = validateProblemSceneCoverage(payload.scene, compileProblemScenePayload(payload));
    assert.equal(validation.valid, false);
    assert.match(validation.errors.join(' '), /baseLineId/);
});

test('source length labels become dotted-arc dimensions while names and hidden helpers stay quiet', () => {
    const payload = lineRelationScene('parallel');
    payload.scene.nodes[4].label = '8';
    payload.scene.nodes[5].label = 'x';
    payload.scene.nodes.push(item('AC', 'segment', { refs: ['A', 'C'] }));
    payload.scene.nodes.push(item('BD', 'segment', { refs: ['B', 'D'], label: 'helper', showLabel: false }));
    const compiled = compileProblemScenePayload(payload);
    const manager = new ObjectManager();
    assert.equal(new PatchApplier(manager, new HistoryManager(manager)).apply(compiled).success, true);
    const segments = manager.getAllObjects().filter(object => object.type === 'segment');
    const dimensions = manager.getAllObjects().filter(object => object.type === 'lengthDimension');
    assert.equal(segments.filter(object => object.showLabel).length, 0);
    assert.deepEqual(dimensions.map(object => object.customText).sort(), ['8', 'x']);

    const dashes = [];
    const curves = [];
    const text = [];
    const context = {
        setLineDash(value) { dashes.push(value); }, beginPath() {}, moveTo() {},
        quadraticCurveTo(...args) { curves.push(args); }, stroke() {},
        measureText(value) { return { width: String(value).length * 8 }; },
        fillRect() {}, fillText(value) { text.push(value); }
    };
    dimensions[0].render({
        ctx: context, scale: 20,
        toScreen(point) { return { x: point.x * 20, y: -point.y * 20 }; }
    });
    assert.deepEqual(dashes, [[4, 4], []]);
    assert.equal(curves.length, 1);
    assert.deepEqual(text, [dimensions[0].customText]);
});

function scenePayload(nodes, relations) {
    return {
        scene: {
            diagramType: 'plane_geometry',
            sourceHasPrintedFigure: false,
            constructionSummary: 'Draw the required triangle and its length conditions.',
            confidence: 0.9,
            nodes,
            relations,
            mustDraw: [{
                id: 'length-conditions',
                description: 'AB=AC and AD=BC',
                nodeIds: ['AB', 'AC', 'AD', 'BC'],
                relationIds: relations.map(relation => relation.id),
                required: true,
                evidence: 'printed equal-length conditions'
            }],
            sourceBindings: [],
            unsupported: []
        }
    };
}

test('coverage rejects equal-length markers whose resolved segment lengths differ', () => {
    const payload = scenePayload([
        item('A', 'point', { label: 'A', numbers: [8, 0] }),
        item('B', 'point', { label: 'B', numbers: [1.39, 7.88] }),
        item('C', 'point', { label: 'C', numbers: [0, 0] }),
        item('D', 'pointOnLine', { label: 'D', refs: ['AC'], numbers: [0.65] }),
        item('AB', 'segment', { refs: ['A', 'B'] }),
        item('AC', 'segment', { refs: ['A', 'C'] }),
        item('AD', 'segment', { refs: ['A', 'D'] }),
        item('BC', 'segment', { refs: ['B', 'C'] }),
        item('CD', 'segment', { refs: ['C', 'D'] })
    ], [
        item('equal_ab_cd', 'equalLengthMarker', { refs: ['AB', 'CD'] }),
        item('equal_ad_bc', 'equalLengthMarker', { refs: ['AD', 'BC'] })
    ]);

    const validation = validateProblemSceneCoverage(payload.scene, compileProblemScenePayload(payload));

    assert.equal(validation.valid, false);
    assert.match(validation.errors.join('\n'), /equalLengthMarker "equal_ab_cd"/);
    assert.match(validation.errors.join('\n'), /equalLengthMarker "equal_ad_bc"/);
    assert.match(validation.errors.join('\n'), /length AB=/);
});

test('coverage accepts equal-length markers whose resolved segment lengths agree', () => {
    const side = 10;
    const base = 2 * side * Math.sin(Math.PI / 18);
    const payload = scenePayload([
        item('A', 'point', { label: 'A', numbers: [0, 0] }),
        item('B', 'point', { label: 'B', numbers: [side - base * Math.cos((4 * Math.PI) / 9), base * Math.sin((4 * Math.PI) / 9)] }),
        item('C', 'point', { label: 'C', numbers: [side, 0] }),
        item('D', 'pointOnLine', { label: 'D', refs: ['AC'], numbers: [base / side] }),
        item('AB', 'segment', { refs: ['A', 'B'] }),
        item('AC', 'segment', { refs: ['A', 'C'] }),
        item('AD', 'segment', { refs: ['A', 'D'] }),
        item('BC', 'segment', { refs: ['B', 'C'] }),
        item('BD', 'segment', { refs: ['B', 'D'] })
    ], [
        item('equal_ab_ac', 'equalLengthMarker', { refs: ['AB', 'AC'] }),
        item('equal_ad_bc', 'equalLengthMarker', { refs: ['AD', 'BC'] })
    ]);

    assert.deepEqual(
        validateProblemSceneCoverage(payload.scene, compileProblemScenePayload(payload)),
        { valid: true, errors: [] }
    );
});

test('coverage rejects a requested angle whose required leg is absent', () => {
    const payload = scenePayload([
        item('A', 'point', { label: 'A', numbers: [0, 0] }),
        item('B', 'point', { label: 'B', numbers: [2, 3] }),
        item('C', 'point', { label: 'C', numbers: [5, 0] }),
        item('D', 'pointOnLine', { label: 'D', refs: ['AC'], numbers: [0.6] }),
        item('AB', 'segment', { refs: ['A', 'B'] }),
        item('AC', 'segment', { refs: ['A', 'C'] }),
        item('BC', 'segment', { refs: ['B', 'C'] })
    ], []);

    payload.scene.mustDraw = [{
        id: 'requested-angle',
        description: 'Find \u2220DBC',
        nodeIds: ['B', 'D', 'C', 'BC'],
        relationIds: [],
        required: true,
        evidence: 'requested angle \u2220DBC'
    }];

    const validation = validateProblemSceneCoverage(payload.scene, compileProblemScenePayload(payload));

    assert.equal(validation.valid, false);
    assert.match(validation.errors.join('\n'), /required angle \u2220DBC has no drawn leg BD/);
});
