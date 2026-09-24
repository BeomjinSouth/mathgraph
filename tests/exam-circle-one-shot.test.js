import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '../js/ai/AIService.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { Vec2 } from '../js/utils/Geometry.js';

async function draw(prompt) {
    const ai = new AIService({ provider: 'local', apiKey: '' });
    const result = await ai.processCommand(prompt);
    assert.equal(result.success, true, result.error);
    assert.equal(ai.validateCommandResult(result.json, null, { mode: result.mode, userMessage: prompt }).valid, true);
    const manager = new ObjectManager();
    assert.equal(new PatchApplier(manager, new HistoryManager(manager)).apply(result.json).success, true);
    return { operations: result.json.operations, objects: manager.getAllObjects() };
}

test('equal-radius central-angle sector creates its radius, angle arc and shaded minor region together', async () => {
    const { operations, objects } = await draw(
        '원 O에서 반지름 OA=OB=3cm, ∠AOB=60°, 부채꼴 AOB를 색칠해줘.');
    assert.deepEqual(objects.filter(o => o.type === 'point').map(o => o.label), ['O', 'A', 'B']);
    assert.ok(objects.filter(o => o.type === 'point').every(o => o.pointSize === 0));
    assert.equal(objects.find(o => o.type === 'circle').getRadius(), 3);
    assert.equal(objects.filter(o => o.type === 'equalLengthMarker').length, 1);
    assert.ok(Math.abs(objects.find(o => o.type === 'lengthDimension').length - 3) < 1e-9);
    assert.ok(Math.abs(objects.find(o => o.type === 'angleDimension').getAngleDegrees() - 60) < 1e-9);
    const region = objects.find(o => o.type === 'sector');
    assert.equal(region.mode, 'minor');
    assert.equal(region.fillOpacity, 0.2);
    assert.equal(region.hitTest(new Vec2(1, 0.5)), true);
    assert.equal(region.hitTest(new Vec2(1, -0.5)), false);
    assert.ok(operations.every(op => op.type !== 'polygon'));
});

test('a 120-degree sector without a radius equality still shades the requested interior', async () => {
    const { objects } = await draw(
        '중심이 O이고 반지름 4cm인 원에서 중심각 ∠AOB=120°인 작은 부채꼴을 색칠해줘.');
    assert.equal(objects.find(o => o.type === 'circle').getRadius(), 4);
    assert.ok(Math.abs(objects.find(o => o.type === 'angleDimension').getAngleDegrees() - 120) < 1e-9);
    assert.equal(objects.filter(o => o.type === 'equalLengthMarker').length, 0);
    assert.equal(objects.find(o => o.type === 'sector').hitTest(new Vec2(1, 1)), true);
    assert.equal(objects.find(o => o.type === 'sector').hitTest(new Vec2(-1, -1)), false);
});

test('an arc-only request creates an arc without inventing a shaded sector', async () => {
    const { objects } = await draw('원 O에서 OA=OB=3cm, ∠AOB=60°를 표시하고 호 AB를 그려줘.');
    assert.equal(objects.filter(o => o.type === 'arc').length, 1);
    assert.equal(objects.filter(o => o.type === 'sector').length, 0);
});

test('inconsistent or extra circle conditions do not return a bare circle as success', async () => {
    const ai = new AIService({ provider: 'local', apiKey: '' });
    for (const prompt of [
        '원 O에서 OA=OB=3cm, ∠AOB=60°, 부채꼴 AOB를 색칠하고 접선도 그려줘.',
        '원 O에서 OA=OB=3cm, ∠AOB=60°, 부채꼴 BOC를 색칠해줘.',
        '원 O에서 ∠AOB=60°, 부채꼴 AOB를 색칠해줘.'
    ]) {
        const result = await ai.processCommand(prompt);
        assert.equal(result.success, false, prompt);
        assert.match(result.error, /원·부채꼴 요청:/);
    }
});
