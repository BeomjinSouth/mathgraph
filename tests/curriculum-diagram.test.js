import assert from 'node:assert/strict';
import test from 'node:test';
import { AIService, GRAPH_OPERATIONS_JSON_SCHEMA } from '../js/ai/AIService.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { compileSceneGraph } from '../js/ai/SceneGraphCompiler.js';
import { CurriculumDiagram, CURRICULUM_TYPES } from '../js/objects/CurriculumDiagram.js';
import { buildCurriculumOperations, validateCurriculumIntent } from '../js/ai/CurriculumIntent.js';
import { curriculumCases, invalidCurriculumPrompts } from './fixtures/curriculum-drawing-cases.js';
import { probabilityCases } from './fixtures/curriculum-drawing-cases.js';
import { binomialProbabilities, buildProbabilityOperations, validateProbabilityIntent } from '../js/ai/ProbabilityIntent.js';
import { parseSetExpression } from '../js/objects/VennGeometry.js';
import { SelectTool } from '../js/tools/SelectTool.js';

const canvas = { toScreen: p => ({ x: p.x * 40 + 400, y: 300 - p.y * 40 }), toScreenLength: v => v * 40 };
for (const { id, prompt } of curriculumCases) {
    test(`curriculum ${id}: Korean command, apply, roundtrip, native SVG`, async () => {
        const ai = new AIService({ provider: 'local', apiKey: '', save() {} });
        const result = await ai.processCommand(prompt);
        assert.equal(result.success, true, result.error);
        assert.equal(new SchemaValidator().validate(result.json).valid, true);
        const manager = new ObjectManager(), history = new HistoryManager(manager);
        const applied = new PatchApplier(manager, history).apply(result.json);
        assert.equal(applied.success, true, applied.message);
        const diagram = applied.createdObjects.find(o => CURRICULUM_TYPES.includes(o.type));
        assert.ok(diagram?.valid);
        const saved = diagram.toJSON();
        history.undo(); assert.equal(manager.getAllObjects().length, 0);
        history.redo(); assert.deepEqual(manager.getObject(saved.id).toJSON(), saved);
        const restored = new ObjectManager(); restored.fromJSON(manager.toJSON());
        assert.deepEqual(restored.getObject(saved.id).toJSON(), saved);
        const svg = diagram.toSVG(canvas);
        assert.match(svg, /<path/); assert.doesNotMatch(svg, /NaN|Infinity|<image/);
        assert.equal((svg.match(/<text /g) || []).length, diagram.parts.filter(p => p.text !== undefined).length);
    });
}
for (const prompt of invalidCurriculumPrompts) {
    test(`reject invalid curriculum input: ${prompt}`, async () => {
        const ai = new AIService({ provider: 'local', apiKey: '', save() {} });
        const result = await ai.processCommand(prompt);
        assert.equal(result.success, false, JSON.stringify(result.json));
        assert.match(result.error, /수학 그림 요청:/);
    });
}
test('annular hole, major sector and full ring have exact opposite arc direction and hit exclusion', () => {
    const ring = new CurriculumDiagram('annularSector', { x: 0, y: 0, radius: 4, innerRadius: 2, startAngle: 0, sweepAngle: 360 });
    assert.equal(ring.containsPoint({ x: 0, y: 0 }), false);
    assert.equal(ring.containsPoint({ x: 3, y: 0 }), true);
    assert.equal(ring.containsPoint({ x: 5, y: 0 }), false);
    const arcs = ring.parts[0].commands.filter(c => c[0] === 'A');
    assert.ok(arcs[0][5] > 0 && arcs[1][5] < 0);
    assert.match(ring.toSVG(canvas), /fill-rule="evenodd"/);
});
test('unequal histogram bins preserve area proportional to frequency', () => {
    const chart = new CurriculumDiagram('statisticalChart', { x: 0, y: 0, width: 9, height: 6, chartKind: 'histogram', binEdges: [0, 5, 15, 30], dataValues: [5, 10, 15] });
    const bars = chart.parts.filter(p => p.fill);
    const heights = bars.map(p => Math.abs(p.commands[2][2] - p.commands[1][2]));
    assert.ok(heights.every(h => h === heights[0]));
    const widths = bars.map(p => Math.abs(p.commands[1][1] - p.commands[0][1]));
    assert.equal(widths[1] / widths[0], 2); assert.equal(widths[2] / widths[0], 3);
});
test('cone net arc length equals base circumference, actual height is converted to slant', () => {
    const operations = buildCurriculumOperations('반지름 3 높이 4인 원뿔 전개도').operations;
    const net = new CurriculumDiagram('solidNet', operations[0]);
    assert.equal(net.height, 5);
    const arc = net.parts[0].commands.find(c => c[0] === 'A');
    assert.ok(Math.abs(arc[3] * arc[5] - 6 * Math.PI) < 1e-9);
});
test('invalid update restores chart data and undo stack, valid update is undoable', () => {
    const manager = new ObjectManager(), history = new HistoryManager(manager), applier = new PatchApplier(manager, history);
    const made = applier.apply(buildCurriculumOperations('히스토그램 경계 [0, 1, 2] 도수 [2, 3]'));
    const id = made.createdObjects[0].id, before = manager.toJSON();
    assert.equal(applier.apply({ operations: [{ op: 'update', id, dataValues: [4] }] }).success, false);
    assert.deepEqual(manager.toJSON(), before);
    assert.equal(applier.apply({ operations: [{ op: 'update', id, dataValues: [4, 6] }] }).success, true);
    history.undo(); assert.deepEqual(manager.toJSON(), before);
    history.redo(); assert.deepEqual(manager.getObject(id).dataValues, [4, 6]);
});
test('AI and compact scene expose new objects without losing data', () => {
    const schema = GRAPH_OPERATIONS_JSON_SCHEMA.properties.operations.items.properties;
    for (const type of CURRICULUM_TYPES) assert.ok(schema.type.enum.includes(type));
    const scene = compileSceneGraph({ nodes: [{ id: 'h', kind: 'statisticalChart', numbers: [0, 0, 10, 6], text: '{"chartKind":"histogram","dataValues":[2,4],"binEdges":[0,10,20]}' }] });
    assert.equal(scene.operations[0].chartKind, 'histogram');
    assert.deepEqual(scene.operations[0].binEdges, [0, 10, 20]);
    assert.equal(new SchemaValidator().validate(scene).valid, true);
});
test('AI output with changed source frequencies is rejected', () => {
    const prompt = '원그래프 항목 [가, 나] 자료 [3, 7]';
    const data = buildCurriculumOperations(prompt);
    data.operations[0].dataValues = [5, 5];
    assert.ok(validateCurriculumIntent(data, prompt).length);
});

test('Venn expressions preserve complement grouping and all three-set truth values', () => {
    const lhs = parseSetExpression("(A|B)'&C", 3), rhs = parseSetExpression('!A&!B&C', 3);
    for (let i = 0; i < 8; i++) {
        const bits = [Boolean(i & 1), Boolean(i & 2), Boolean(i & 4)];
        assert.equal(lhs(bits), i === 4); assert.equal(lhs(bits), rhs(bits));
    }
    assert.equal(buildCurriculumOperations('벤 다이어그램 (A∪B)의 여집합을 색칠해줘').operations[0].setExpression, '!((A∪B))');
    assert.throws(() => parseSetExpression('A&C', 2));
    assert.throws(() => parseSetExpression('globalThis.alert(1)', 3));
});
test('binomial masses sum to one and have the requested mean and variance', () => {
    for (const [n, p] of [[1, 0], [5, 1], [10, 0.5], [100, 0.01], [100, 0.99]]) {
        const values = binomialProbabilities(n, p), mean = values.reduce((s, v, k) => s + v * k, 0);
        const variance = values.reduce((s, v, k) => s + v * (k - n * p) ** 2, 0);
        assert.ok(Math.abs(values.reduce((s, v) => s + v, 0) - 1) < 1e-10);
        assert.ok(Math.abs(mean - n * p) < 1e-9);
        assert.ok(Math.abs(variance - n * p * (1 - p)) < 1e-9);
    }
});
for (const spec of probabilityCases) {
    test(`probability command ${spec.id}: parameters and shaded interval`, async () => {
        const ai = new AIService({ provider: 'local', apiKey: '', save() {} });
        const result = await ai.processCommand(spec.prompt);
        assert.equal(result.success, true, result.error);
        const manager = new ObjectManager();
        assert.equal(new PatchApplier(manager, new HistoryManager(manager)).apply(result.json).success, true);
        assert.ok(manager.getAllObjects().every(obj => obj.valid));
    });
}
test('probability source parameters and shading cannot silently change', () => {
    const prompt = '평균 0 표준편차 1인 정규분포 -1<=x<=1 색칠';
    const data = buildProbabilityOperations(prompt);
    data.operations[0].xMin = 0;
    assert.ok(validateProbabilityIntent(data, prompt).length);
    for (const prompt of ['이항분포 B(3,-0.2)', '정규분포 평균 0 표준편차 0', '정규분포 그래프'])
        assert.ok(buildProbabilityOperations(prompt).error);
    assert.equal(buildProbabilityOperations('평균 1e2 표준편차 1인 정규분포').operations[0].mean, 100);
});
test('probability editing refuses negative values and non-unit mass', () => {
    const manager = new ObjectManager(), applier = new PatchApplier(manager, new HistoryManager(manager));
    const made = applier.apply(buildProbabilityOperations('이항분포 B(3,1/2)'));
    const id = made.createdObjects[0].id, before = manager.toJSON();
    for (const dataValues of [[-1, 2, 3, 4], [0.1, 0.2, 0.3, 0.3]]) {
        assert.equal(applier.apply({ operations: [{ op: 'update', id, dataValues }] }).success, false);
        assert.deepEqual(manager.toJSON(), before);
    }
    assert.equal(applier.apply({ operations: [{ op: 'update', id, dataValues: [0, 0, 1, 0] }] }).success, true);
    assert.equal(manager.getObject(id).label, '');
});
test('source center and net measurement labels are retained', () => {
    const source = buildCurriculumOperations('중심 (5, 6)에 고리 부채꼴 바깥 반지름 4 안쪽 반지름 2 중심각 90');
    assert.equal(source.operations[0].x, 5); assert.equal(source.operations[0].y, 6);
    source.operations[0].x = 0;
    assert.ok(validateCurriculumIntent(source, '중심 (5, 6)에 고리 부채꼴 바깥 반지름 4 안쪽 반지름 2 중심각 90').length);
    const net = new CurriculumDiagram('solidNet', buildCurriculumOperations('직육면체 전개도 가로 2 세로 3 높이 4 치수 표시').operations[0]);
    assert.deepEqual(net.parts.filter(p => p.text).map(p => p.text).sort(), ['2', '3', '4']);
});
test('new diagrams participate in multi-selection drag and undo', () => {
    const manager = new ObjectManager(), history = new HistoryManager(manager);
    const diagram = manager.createCurriculumDiagram('solidNet', { x: 1, y: 2, netKind: 'cube', width: 2, height: 2 });
    const targets = new SelectTool().collectSelectionDragTargets([diagram], { objectManager: manager });
    assert.deepEqual(targets, [diagram]);
    history.startDrag(targets); diagram.setPosition(4, 5); history.endDrag();
    history.undo(); assert.deepEqual([diagram.position.x, diagram.position.y], [1, 2]);
    history.redo(); assert.deepEqual([diagram.position.x, diagram.position.y], [4, 5]);
});
