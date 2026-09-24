import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '../js/ai/AIService.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { buildExamSolidOperations } from '../js/ai/ExamSolidFallback.js';

async function draw(prompt) {
    const service = new AIService({ provider: 'local', apiKey: '' });
    const result = await service.processCommand(prompt);
    assert.equal(result.success, true, result.error);
    assert.equal(service.validateCommandResult(result.json).valid, true);
    const manager = new ObjectManager();
    assert.equal(new PatchApplier(manager, new HistoryManager(manager)).apply(result.json).success, true);
    return { operations: result.json.operations, objects: manager.getAllObjects() };
}

function near(a, b) { return Math.abs(a - b) < 1e-9; }

test('named triangular prism keeps six requested labels, two dimensions and dashed hidden edges', async () => {
    const { operations, objects } = await draw(
        '삼각기둥 ABC-DEF에서 AB=4cm, 높이 6cm, 가려진 모서리는 점선으로 표시해줘.');
    const points = objects.filter(o => o.type === 'point');
    assert.deepEqual(points.map(o => o.label), ['A', 'B', 'C', 'D', 'E', 'F']);
    assert.ok(points.every(o => o.pointSize === 0));
    const p = Object.fromEntries(points.map(o => [o.label, o.position]));
    assert.ok(near(p.B.x - p.A.x, 4));
    for (const [a, b] of [['A', 'D'], ['B', 'E'], ['C', 'F']]) {
        assert.ok(near(p[b].x - p[a].x, p.D.x - p.A.x));
        assert.ok(near(p[b].y - p[a].y, p.D.y - p.A.y));
    }
    const prism = objects.find(o => o.type === 'prism');
    assert.ok(prism.valid);
    assert.ok(prism._hiddenEdges.length >= 1);
    assert.ok(prism._hiddenEdges.length < 9);
    assert.deepEqual(objects.filter(o => o.type === 'lengthDimension').map(o => o.customText), ['4 cm', '6 cm']);
    assert.ok(operations.filter(o => o.type === 'segment').every(o => o.visible === false));
});

test('dimensioned cube has square front face, eight labels and three hidden edges', async () => {
    const { objects } = await draw('정육면체 ABCD-EFGH에서 모서리 4cm를 표시해줘.');
    const points = objects.filter(o => o.type === 'point');
    assert.deepEqual(points.map(o => o.label), ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']);
    assert.ok(points.every(o => o.pointSize === 0));
    const p = Object.fromEntries(points.map(o => [o.label, o.position]));
    assert.ok(near(p.B.x - p.A.x, 4) && near(p.D.y - p.A.y, 4));
    assert.ok(near(p.E.x - p.A.x, p.H.x - p.D.x));
    const prism = objects.find(o => o.type === 'prism');
    assert.deepEqual(prism._hiddenEdges, [
        { type: 'top', index: 0 }, { type: 'top', index: 3 }, { type: 'vertical', index: 0 }
    ]);
    assert.equal(objects.find(o => o.type === 'lengthDimension').customText, '4 cm');
});

test('dimensioned cylinder connects its radius and true face-center height to visible and dashed curves', async () => {
    const { operations, objects } = await draw(
        '원기둥의 반지름은 3cm, 높이는 6cm이고 뒤쪽 원호는 점선으로 그려줘.');
    const cylinder = objects.find(o => o.type === 'cylinder');
    assert.equal(cylinder.valid, true);
    assert.equal(cylinder.showHiddenLines, true);
    assert.ok(near(cylinder.width, 6));
    assert.ok(near(cylinder.height - cylinder.width * cylinder.ellipseRatio, 6));
    const dimensions = objects.filter(o => o.type === 'lengthDimension');
    assert.deepEqual(dimensions.map(o => o.customText), ['3 cm', '6 cm']);
    assert.deepEqual(dimensions.map(o => o.length), [3, 6]);
    assert.ok(operations.filter(o => o.type === 'point').every(o => o.visible === false && o.pointSize === 0));
    assert.deepEqual(operations.filter(o => o.type === 'segment').map(o => o.visible), [true, false]);
});

test('quadrilateral pyramid keeps an upright measurable altitude and three hidden edges', async () => {
    const { operations, objects } = await draw(
        '사각뿔 V-ABCD에서 밑면 AB=4cm, 높이 6cm를 표시해줘.');
    const visible = objects.filter(o => o.type === 'point' && o.visible);
    assert.deepEqual(visible.map(o => o.label), ['A', 'B', 'C', 'D', 'V']);
    assert.ok(visible.every(o => o.pointSize === 0));
    const p = Object.fromEntries(visible.map(o => [o.label, o.position]));
    const center = { x: (p.A.x + p.B.x + p.C.x + p.D.x) / 4,
        y: (p.A.y + p.B.y + p.C.y + p.D.y) / 4 };
    assert.ok(near(p.B.x - p.A.x, 4) && near(p.B.y, p.A.y));
    assert.ok(near(p.V.x, center.x) && near(p.V.y - center.y, 6));
    const foot = objects.find(o => o.type === 'point' && !o.visible);
    assert.ok(foot && near(foot.position.x, center.x) && near(foot.position.y, center.y));
    const pyramid = objects.find(o => o.type === 'pyramid');
    assert.deepEqual(pyramid._hiddenEdges, [
        { type: 'base', index: 2 }, { type: 'base', index: 3 }, { type: 'lateral', index: 3 }
    ]);
    const heightLine = operations.find(o => o.id === 'height_line');
    assert.equal(heightLine.dashed, true);
    assert.deepEqual(objects.filter(o => o.type === 'lengthDimension').map(o => o.length), [4, 6]);
    assert.deepEqual(objects.filter(o => o.type === 'lengthDimension').map(o => o.customText), ['4 cm', '6 cm']);
});

test('quadrilateral pyramid dimensions remain exact for varied stated sizes', async () => {
    for (const [base, height] of [[2, 3], [3, 4], [4.5, 6.5], [5, 6], [7, 8]]) {
        const { objects } = await draw(
            `사각뿔 V-ABCD에서 밑면 AB=${base}cm, 높이 ${height}cm를 표시해줘.`);
        assert.deepEqual(objects.filter(o => o.type === 'lengthDimension').map(o => o.length), [base, height]);
        assert.ok(objects.find(o => o.type === 'pyramid')._hiddenEdges.length >= 1);
    }
});

test('cylinder dimensions stay exact across unequal, equal and decimal measurements', async () => {
    for (const [radius, height] of [[2, 4], [3, 3], [4.5, 7.25]]) {
        const { objects } = await draw(
            `원기둥의 반지름은 ${radius}cm, 높이는 ${height}cm이고 뒤쪽 원호는 점선으로 그려줘.`);
        const solid = objects.find(o => o.type === 'cylinder');
        const measured = objects.filter(o => o.type === 'lengthDimension').map(o => o.length);
        assert.ok(near(solid.width / 2, radius));
        assert.ok(near(solid.height - solid.width * solid.ellipseRatio, height));
        assert.deepEqual(measured, [radius, height]);
    }
});

test('decimal dimension punctuation does not turn a short drawing command into problem mode or an answer choice', () => {
    const ai = new AIService({ provider: 'local', apiKey: '' });
    const prompt = '원기둥의 반지름은 4.5cm, 높이는 7.25cm이고 뒤쪽 원호는 점선으로 그려줘.';
    assert.equal(ai.detectCommandMode(prompt), 'command');
});

test('the verb 구해줘 in a circle measurement request is not mistaken for a sphere', () => {
    assert.equal(buildExamSolidOperations('원의 반지름 3cm를 구해줘.'), null);
});

test('unrepresented solid measurements fail instead of returning an unlabeled generic solid', async () => {
    const service = new AIService({ provider: 'local', apiKey: '' });
    for (const prompt of [
        '사각뿔 V-ABCD에서 밑면 AB=4cm, 높이 6cm, 단면을 색칠해줘.',
        '원기둥의 반지름은 3cm, 높이는 6cm이고 부피도 함께 표시해줘.',
        '삼각기둥 ABC-DEF에서 AB=4cm, 높이 6cm, 부피 24㎤도 표시해줘.'
    ]) {
        const result = await service.processCommand(prompt);
        assert.equal(result.success, false, prompt);
        assert.match(result.error, /시험 입체도형 요청:/);
    }
});
