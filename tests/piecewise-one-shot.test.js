import test from 'node:test';
import assert from 'node:assert/strict';
import { AIService } from '../js/ai/AIService.js';
import { SemanticValidator } from '../js/ai/SemanticValidator.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { Vec2 } from '../js/utils/Geometry.js';

const graphPrompt = '구간별 함수 f(x)=x+1 (-2<=x<0), f(x)=x^2 (0<=x<=2)의 그래프를 그려줘.';
const areaPrompt = '구간별 함수 f(x)={x+1 (-2<=x<0); x^2 (0<=x<=2)}와 y=1/2 사이의 넓이를 색칠해줘.';
const create = prompt => new AIService({ provider: 'local', apiKey: '' }).processCommand(prompt);

test('piecewise graph keeps both intervals and the two distinct open/closed values at a jump', async () => {
    const result = await create(graphPrompt);
    assert.equal(result.success, true, result.error);
    const manager = new ObjectManager();
    assert.equal(new PatchApplier(manager, new HistoryManager(manager)).apply(result.json).success, true);
    const graphs = manager.getAllObjects().filter(o => o.type === 'function');
    assert.deepEqual(graphs.map(o => [o.xMin, o.xMax]), [[-2, 0], [0, 2]]);
    assert.deepEqual(graphs.map(o => o.evaluate(0)), [1, 0]);
    assert.equal(graphs[0].isPointWithinVisibleRange(1, 2), false);
    const endpoints = manager.getAllObjects().filter(o => o.type === 'point');
    assert.deepEqual(endpoints.map(o => [o.position.x, o.position.y, o.pointStyle]),
        [[-2, -1, 'closed'], [0, 1, 'open'], [0, 0, 'closed'], [2, 4, 'closed']]);
    assert.ok(endpoints.every(o => o.showLabel === false && o.pointSize > 0));
});

test('piecewise shaded area uses each branch and the fractional horizontal line', async () => {
    const result = await create(areaPrompt);
    assert.equal(result.success, true, result.error);
    const manager = new ObjectManager();
    assert.equal(new PatchApplier(manager, new HistoryManager(manager)).apply(result.json).success, true);
    const areas = manager.getAllObjects().filter(o => o.type === 'functionRegion');
    assert.equal(areas.length, 2);
    assert.ok(areas.every(o => o.valid && o.baselineY === 0.5));
    assert.equal(areas[0].hitTest(new Vec2(-1.5, 0)), true);
    assert.equal(areas[0].hitTest(new Vec2(-1.5, 0.9)), false);
    assert.equal(areas[1].hitTest(new Vec2(1.5, 1.4)), true);
    assert.equal(areas[1].hitTest(new Vec2(1.5, -0.3)), false);
});

test('continuous shared endpoints consolidate according to the union of inclusion conditions', async () => {
    for (const [left, right, expected] of [['<', '<=', 'closed'], ['<', '<', 'open'], ['<=', '<=', 'closed']]) {
        const result = await create(`구간별 함수 f(x)={x (-2<=x${left}0); -x (0${right}x<=2)}의 그래프를 그려줘.`);
        assert.equal(result.success, true, result.error);
        const shared = result.json.operations.filter(o => o.type === 'point' && o.x === 0);
        assert.equal(shared.length, 1);
        assert.equal(shared[0].pointStyle, expected);
    }
});

test('three nonlinear branches retain symbolic endpoints, gaps and a narrower shading interval', async () => {
    const result = await create('구간별 함수 f(x)={sin(x) (-pi<=x<0); sqrt(x) (0<=x<=1); 1/x (2<x<=4)}와 x축 사이에서 x=-pi/2부터 3까지의 넓이를 색칠해줘.');
    assert.equal(result.success, true, result.error);
    const areas = result.json.operations.filter(o => o.type === 'functionRegion');
    assert.deepEqual(areas.map(o => [o.xMin, o.xMax]), [[-Math.PI / 2, 0], [0, 1], [2, 3]]);
    const endpoints = result.json.operations.filter(o => o.type === 'point');
    assert.ok(endpoints.some(o => o.x === 2 && o.y === 0.5 && o.pointStyle === 'open'));
});

test('invalid, overlapping and unhandled piecewise conditions fail without partial graphs', async () => {
    for (const prompt of [
        '구간별 함수 f(x)={x (-2<=x<=0); x+1 (0<=x<=2)}의 그래프를 그려줘.',
        '구간별 함수 f(x)={x (-2<=x<1); x^2 (0<=x<=2)}의 그래프를 그려줘.',
        '구간별 함수 f(x)={x (0<=x<0); x^2 (0<=x<=2)}의 그래프를 그려줘.',
        '구간별 함수 f(x)={x (-a<=x<0); x^2 (0<=x<=2)}의 그래프를 그려줘.',
        '구간별 함수 f(x)={x (-2<=x<0); x^2 (0<=x<=2)}와 y=x+1 사이를 색칠해줘.',
        '구간별 함수 f(x)={x (-2<=x<0); x^2 (0<=x<=2)}와 x축 사이를 색칠하고 x=1에서 접선을 그려줘.',
        '구간별 함수 f(x)={1/(x+sqrt(2)) (-2<=x<0); x^2 (0<=x<=2)}와 x축 사이를 색칠해줘.',
        '구간별 함수 f(x)={x (-2<=x<0); x^2 (0<=x<=2)}와 x축 사이에서 x=-3부터 3까지 색칠해줘.'
    ]) {
        const result = await create(prompt);
        assert.equal(result.success, false, prompt);
        assert.match(result.error, /구간별 함수 요청:/);
    }
});

test('model responses cannot drop a branch, change endpoint inclusion or shade across the wrong branch', async () => {
    const result = await create(areaPrompt);
    assert.equal(result.success, true, result.error);
    const validate = json => new SemanticValidator().validateExamAnnotationIntent(json, { prompt: areaPrompt });
    assert.equal(validate(result.json).valid, true);
    for (const mutate of [
        ops => ops.splice(ops.findIndex(o => o.type === 'function'), 1),
        ops => { ops.find(o => o.type === 'function').xMax = 1; },
        ops => { ops.find(o => o.type === 'function').expression = 'x-1'; },
        ops => { ops.find(o => o.pointStyle === 'open').pointStyle = 'closed'; },
        ops => { ops.find(o => o.type === 'point').pointSize = 0; },
        ops => { ops.find(o => o.type === 'functionRegion').baselineY = 0; },
        ops => { ops.find(o => o.type === 'functionRegion').xMax = 2; },
        ops => { ops.find(o => o.type === 'functionRegion').function1Id = ops[1].id; }
    ]) {
        const broken = structuredClone(result.json);
        mutate(broken.operations);
        assert.equal(validate(broken).valid, false, JSON.stringify(broken));
    }
});

test('an explicit empty-gap note agrees with branch domains instead of being mistaken for another formula', async () => {
    const source = '구간별 함수 f(x)={x+1 (-3<=x<-1); 2 (-1<=x<1); (x-1)^2 (2<x<=3)}와 x축 사이를 색칠해줘.';
    const result = await create(source + ' 1<=x<=2의 빈 구간을 연결하거나 색칠하지 마.');
    assert.equal(result.success, true, result.error);
    assert.deepEqual(result.json.operations.filter(op => op.type === 'functionRegion').map(op => [op.xMin,op.xMax]),
        [[-3,-1],[-1,1],[2,3]]);
    const validate = request => new SemanticValidator().validateExamAnnotationIntent(result.json, {prompt:request});
    assert.equal(validate(source + ' 1<x<2의 빈 구간을 색칠하지 마.').valid, true);
    for (const note of ['0<=x<=2의 빈 구간을 색칠하지 마.', '1<=x<=3의 빈 구간을 색칠하지 마.',
        'x<0에서는 다른 식을 사용해.', '1<=x<=2의 빈 구간. x>3에서도 그려줘.'])
        assert.equal(validate(source + ' ' + note).valid, false, note);
    const closedSource = source.replace('-1<=x<1', '-1<=x<=1');
    assert.equal((await create(closedSource + ' 1<=x<=2의 빈 구간을 색칠하지 마.')).success, false,
        'an included endpoint is not part of an empty closed gap');
    assert.equal((await create(closedSource + ' 1<x<=2의 빈 구간을 색칠하지 마.')).success, true);
});

test('each branch is a graph instruction, not an angle construction requirement', async () => {
    const original = await create(graphPrompt);
    const validator = new SemanticValidator();
    for (const phrase of ['각 조각은 정의역에서만 보여줘.', '각 식의 끝점을 표시해줘.', '각 구간의 그래프를 그려줘.'])
        assert.equal(validator.validateProblemDiagramIntent(original.json, {prompt:graphPrompt+' '+phrase}).valid, true, phrase);
    for (const phrase of ['삼각형 ABC도 그려줘.', '각도 호도 표시해줘.', '원 O도 그려줘.'])
        assert.equal(validator.validateProblemDiagramIntent(original.json, {prompt:graphPrompt+' '+phrase}).valid, false, phrase);
});
