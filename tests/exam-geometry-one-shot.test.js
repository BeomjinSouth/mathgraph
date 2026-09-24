import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '../js/ai/AIService.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';

async function create(prompt) {
    const service = new AIService({ provider: 'local', apiKey: '' });
    const result = await service.processCommand(prompt);
    assert.equal(result.success, true, result.error);
    assert.equal(service.validateCommandResult(result.json).valid, true);
    const manager = new ObjectManager();
    assert.equal(new PatchApplier(manager, new HistoryManager(manager)).apply(result.json).success, true);
    return { operations: result.json.operations, objects: manager.getAllObjects() };
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

test('isosceles one-shot keeps actual lengths and angles together with all exam markings', async () => {
    const { operations, objects } = await create(
        '삼각형 ABC에서 AB=AC, ∠B=∠C, BC=6cm, ∠A=40°를 표시해줘.');
    const p = Object.fromEntries(objects.filter(o => o.type === 'point').map(o => [o.label, o.position]));
    assert.ok(Math.abs(distance(p.A, p.B) - distance(p.A, p.C)) < 1e-9);
    assert.ok(Math.abs(distance(p.B, p.C) - 6) < 1e-9);
    const angles = objects.filter(o => o.type === 'angleDimension');
    assert.deepEqual(angles.map(o => Math.round(o.getAngleDegrees())), [70, 70, 40]);
    assert.deepEqual(angles.map(o => o.markerCount), [1, 1, 0]);
    assert.equal(objects.filter(o => o.type === 'equalLengthMarker').length, 1);
    assert.equal(objects.find(o => o.type === 'lengthDimension').customText, '6 cm');
    assert.equal(operations.find(o => o.type === 'polygon').showLabel, false);
    assert.ok(operations.filter(o => o.type === 'point').every(o => o.pointSize === 0));
    assert.ok(operations.filter(o => o.type === 'segment').every(o => o.visible === false));
});

test('parallelogram one-shot keeps two independent equal-side groups and opposite angles', async () => {
    const { objects } = await create(
        '평행사변형 ABCD에서 AB=CD, BC=DA, ∠A=∠C, AB=8cm, ∠A=70°를 표시해줘.');
    const p = Object.fromEntries(objects.filter(o => o.type === 'point').map(o => [o.label, o.position]));
    assert.ok(Math.abs(distance(p.A, p.B) - 8) < 1e-9);
    assert.ok(Math.abs(distance(p.A, p.B) - distance(p.C, p.D)) < 1e-9);
    assert.ok(Math.abs(distance(p.B, p.C) - distance(p.D, p.A)) < 1e-9);
    assert.ok(Math.abs(distance(p.A, p.B) - distance(p.B, p.C)) > 1);
    assert.deepEqual(objects.filter(o => o.type === 'equalLengthMarker').map(o => o.tickCount), [1, 2]);
    assert.deepEqual(objects.filter(o => o.type === 'angleDimension').map(o => Math.round(o.getAngleDegrees())), [70, 70]);
    assert.equal(objects.find(o => o.type === 'lengthDimension').customText, '8 cm');
});

test('unsupported geometric constraints fail instead of silently returning a bare figure', async () => {
    const service = new AIService({ provider: 'local', apiKey: '' });
    for (const prompt of [
        '삼각형 ABC에서 AB=AC, ∠B=∠C, BC=6cm, ∠A=40°, 높이 AD=4cm를 표시해줘.',
        '삼각형 ABC에서 AB=AC, ∠B=∠C, BC=6cm, ∠A=40°, 높이가 4cm인 그림을 그려줘.',
        '삼각형 ABC에서 AB=AC, ∠B=∠C만 표시해줘.',
        '평행사변형 ABCD에서 AB=CD, BC=DA, ∠A=∠C, AB=13cm, ∠A=70°를 표시해줘.'
    ]) {
        const result = await service.processCommand(prompt);
        assert.equal(result.success, false, prompt);
        assert.match(result.error, /시험 도형 요청:/);
    }
    const basic = await service.processCommand('삼각형 ABC 그려줘');
    assert.equal(basic.success, true);
});
