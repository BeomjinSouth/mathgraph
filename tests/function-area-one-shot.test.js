import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '../js/ai/AIService.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { Vec2 } from '../js/utils/Geometry.js';

const service = () => new AIService({ provider: 'local', apiKey: '' });

test('a single Korean area command creates both graphs and the shaded interval offline', async () => {
    const result = await service().processCommand('함수 f(x)=x^2, g(x)=1에 대하여 x=-1부터 1까지 두 그래프 사이의 넓이를 색칠해줘.');
    assert.equal(result.success, true, result.error);
    assert.deepEqual(result.json.operations.map(op => op.type), ['function', 'function', 'functionRegion']);
    assert.deepEqual([result.json.operations[2].xMin, result.json.operations[2].xMax], [-1, 1]);
    const manager = new ObjectManager();
    const applied = new PatchApplier(manager, new HistoryManager(manager)).apply(result.json);
    assert.equal(applied.success, true);
    assert.equal(manager.getAllObjects()[2].valid, true);
});

test('a whole problem statement creates the x-axis bounded sine region in one request', async () => {
    const prompt = '다음 좌표평면에서 함수 f(x)=sin(x)의 그래프와 x축으로 둘러싸인 부분 중 x=0부터 3.141592653589793까지의 넓이를 색칠하여 나타내시오. 다른 선택지나 답을 그림에 쓰지 마시오.';
    const result = await service().processCommand(prompt);
    assert.equal(result.success, true, result.error);
    assert.equal(result.json.operations.at(-1).type, 'functionRegion');
    assert.equal(result.json.operations.at(-1).baselineY, 0);
});

test('a shaded area request without endpoints does not invent its x interval', async () => {
    const result = await service().processCommand('f(x)=x^2, g(x)=1 사이의 넓이를 색칠해줘.');
    assert.equal(result.success, false);
    assert.match(result.error, /범위|구간/);
});

test('a combined area-and-tangent request does not silently omit the tangent', async () => {
    const result = await service().processCommand(
        'f(x)=x^2, g(x)=1, x=-1부터 1까지 두 그래프 사이를 색칠하고 x=0에서의 접선을 그려줘.');
    assert.equal(result.success, false);
    assert.match(result.error, /접선/);
});

test('an explicit area-and-tangent request creates the shaded region and the named tangent together', async () => {
    const result = await service().processCommand(
        'f(x)=x^2, g(x)=1, x=-1부터 1까지 두 그래프 사이를 색칠하고 f(x)의 x=0.5에서의 접선을 그려줘.');
    assert.equal(result.success, true, result.error);
    assert.deepEqual(result.json.operations.map(op => op.type),
        ['function', 'function', 'functionRegion', 'tangentFunction']);
    const manager = new ObjectManager();
    assert.equal(new PatchApplier(manager, new HistoryManager(manager)).apply(result.json).success, true);
    const tangent = manager.getAllObjects().find(o => o.type === 'tangentFunction');
    assert.equal(tangent.valid, true);
    assert.ok(Math.abs(tangent._slope - 1) < 1e-9);
    assert.equal(manager.getAllObjects().find(o => o.type === 'functionRegion').valid, true);
});

test('five distinct function families create the requested selectable area in one command', async () => {
    const examples = [
        ['f(x)=4-x^2, g(x)=x+2, x=-2부터 1까지 두 그래프 사이 넓이를 색칠해줘.', [0, 3]],
        ['f(x)=2^x, g(x)=1, x=0부터 2까지 두 함수 사이 넓이를 색칠해줘.', [1, 1.5]],
        ['f(x)=1/x, x=1부터 4까지 x축과 그래프 사이 넓이를 색칠해줘.', [2, 0.25]],
        ['f(x)=2.5*(x^3-x), x=-1부터 1까지 x축과 그래프 사이 넓이를 색칠해줘.', [-0.5, 0.4]],
        ['f(x)=sqrt(x), g(x)=0.5*x, x=0부터 4까지 두 함수 사이 넓이를 색칠해줘.', [1, 0.75]]
    ];
    for (const [prompt, inside] of examples) {
        const result = await service().processCommand(prompt);
        assert.equal(result.success, true, prompt + ': ' + result.error);
        assert.equal(result.json.operations.at(-1).type, 'functionRegion', prompt);
        const manager = new ObjectManager();
        assert.equal(new PatchApplier(manager, new HistoryManager(manager)).apply(result.json).success, true, prompt);
        const area = manager.getAllObjects().at(-1);
        assert.equal(area.valid, true, prompt);
        assert.equal(area.hitTest(new Vec2(...inside)), true, prompt);
    }
});

test('offline one-shot request refuses an interval containing an undrawn pole', async () => {
    const result = await service().processCommand('f(x)=1/(x-sqrt(2)), x=1부터 2까지 x축과 그래프 사이 넓이를 색칠해줘.');
    assert.equal(result.success, false);
    assert.match(result.error, /정의되지|경계/);
});

test('a closed inequality interval keeps its stated endpoints', async () => {
    const result = await service().processCommand('f(x)=x^2, g(x)=1, -1 ≤ x ≤ 1에서 두 함수 사이 넓이를 색칠해줘.');
    assert.equal(result.success, true, result.error);
    assert.deepEqual([result.json.operations.at(-1).xMin, result.json.operations.at(-1).xMax], [-1, 1]);
});

test('a decimal horizontal boundary is not silently changed into the x-axis', async () => {
    const result = await service().processCommand(
        'f(x)=sin(x), y=0.5, x=0부터 3.141592653589793까지 두 그래프 사이 넓이를 색칠해줘.');
    assert.equal(result.success, true, result.error);
    assert.equal(result.json.operations.at(-1).baselineY, 0.5);
    const manager = new ObjectManager();
    assert.equal(new PatchApplier(manager, new HistoryManager(manager)).apply(result.json).success, true);
    const area = manager.getAllObjects().at(-1);
    assert.equal(area.hitTest(new Vec2(Math.PI / 2, 0.75)), true);
    assert.equal(area.hitTest(new Vec2(Math.PI / 2, 0.25)), false);
});

test('a positive or negative horizontal boundary is kept and ambiguous boundaries are rejected', async () => {
    for (const [prompt, expected] of [
        ['f(x)=x^2, y=2, x=-1부터 1까지 함수와 직선 사이 넓이를 색칠해줘.', 2],
        ['f(x)=x^2, y=-1, x=-1부터 1까지 함수와 직선 사이 넓이를 색칠해줘.', -1]
    ]) {
        const result = await service().processCommand(prompt);
        assert.equal(result.success, true, result.error);
        assert.equal(result.json.operations.at(-1).baselineY, expected);
    }
    for (const prompt of [
        'f(x)=x^2, y=1, y=2, x=-1부터 1까지 넓이를 색칠해줘.',
        'f(x)=x^2, y=1, x=-1부터 1까지 x축과 직선 사이 넓이를 색칠해줘.',
        'f(x)=x^2, y=a, x=-1부터 1까지 함수와 직선 사이 넓이를 색칠해줘.',
        'f(x)=x^2, y=1/0, x=-1부터 1까지 함수와 직선 사이 넓이를 색칠해줘.'
    ]) {
        const result = await service().processCommand(prompt);
        assert.equal(result.success, false, prompt);
    }
    const axesVisible = await service().processCommand(
        'f(x)=x^2, g(x)=1, x=-1부터 1까지 두 함수 사이 넓이를 색칠하고 x축도 보여줘.');
    assert.equal(axesVisible.success, true, axesVisible.error);
});

test('constant expressions preserve fractional, radical and pi area boundaries', async () => {
    for (const [prompt, expected] of [
        ['f(x)=sin(x), y=1/2, x=0부터 pi까지 함수와 직선 사이 넓이를 색칠해줘.', [0, Math.PI, 0.5]],
        ['f(x)=x^2, y=1+2, -sqrt(2) ≤ x ≤ sqrt(2)에서 함수와 직선 사이를 색칠해줘.', [-Math.SQRT2, Math.SQRT2, 3]],
        ['f(x)=max(x,0), y=-1/2, x=-3/2부터 3/2까지 함수와 직선 사이를 색칠해줘.', [-1.5, 1.5, -0.5]]
    ]) {
        const result = await service().processCommand(prompt);
        assert.equal(result.success, true, result.error);
        const area = result.json.operations.find(op => op.type === 'functionRegion');
        assert.deepEqual([area.xMin, area.xMax, area.baselineY], expected);
    }
    for (const boundary of ['0.5.1', '1/0', 'x+1', 'a', 'sqrt(-1)']) {
        const result = await service().processCommand(`f(x)=x^2, y=${boundary}, x=-1부터 1까지 색칠해줘.`);
        assert.equal(result.success, false, boundary);
    }
});
