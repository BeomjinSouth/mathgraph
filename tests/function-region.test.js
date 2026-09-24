import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { remapObjectReferences } from '../js/utils/ObjectReferences.js';
import { Vec2 } from '../js/utils/Geometry.js';
import { compileSceneGraph } from '../js/ai/SceneGraphCompiler.js';
import { GRAPH_OPERATIONS_JSON_SCHEMA } from '../js/ai/AIService.js';
import { compileProblemScenePayload, validateProblemSceneCoverage } from '../js/ai/ProblemScenePipeline.js';

function apply(operations) {
    const manager = new ObjectManager();
    const data = { operations };
    const validation = new SchemaValidator().validate(data);
    assert.equal(validation.valid, true, validation.errors.join('; '));
    const result = new PatchApplier(manager, new HistoryManager(manager)).apply(data);
    assert.equal(result.success, true, result.errors.join('; '));
    return manager;
}

test('function region follows two editable curves and survives a project round trip', () => {
    const manager = apply([
        { op: 'create', type: 'function', id: 'f', expression: '1-x^2', xMin: -1, xMax: 1 },
        { op: 'create', type: 'function', id: 'g', expression: '0', xMin: -1, xMax: 1 },
        { op: 'create', type: 'functionRegion', id: 'area', function1Id: 'f', function2Id: 'g',
            xMin: -1, xMax: 1, fillOpacity: 0.2 }
    ]);
    let [f, g, region] = manager.getAllObjects();
    assert.equal(region.valid, true);
    assert.equal(region.hitTest(new Vec2(0, 0.5)), true);
    assert.equal(region.hitTest(new Vec2(0, 1.3)), false);
    assert.equal(region.hitTest(new Vec2(1.5, 0.1)), false);
    assert.equal(region.toJSON().function2Id, g.id);
    manager.fromJSON(JSON.parse(JSON.stringify(manager.toJSON())));
    [f, g, region] = manager.getAllObjects();
    assert.equal(region.valid, true);
    assert.equal(region.hitTest(new Vec2(0, 0.5)), true);
    f.setExpression('2-x^2');
    manager.updateObject(f.id);
    assert.equal(region.hitTest(new Vec2(0, 1.5)), true);
});

test('function region uses an exact horizontal baseline and rejects invalid spans', () => {
    const manager = apply([
        { op: 'create', type: 'function', id: 'f', expression: 'x+2', xMin: -1, xMax: 1 },
        { op: 'create', type: 'functionRegion', id: 'area', function1Id: 'f', xMin: -1, xMax: 1,
            baselineY: 1, fillOpacity: 0.2 }
    ]);
    const region = manager.getAllObjects()[1];
    assert.equal(region.valid, true);
    assert.equal(region.hitTest(new Vec2(0, 1.5)), true);
    assert.equal(region.hitTest(new Vec2(0, 0.5)), false);
    assert.equal(region.hitTest(new Vec2(0, 2.5)), false);

    region.xMin = -2;
    manager.updateObject(region.id);
    assert.equal(region.valid, false);
    region.xMin = -1;
    region.xMax = -1;
    manager.updateObject(region.id);
    assert.equal(region.valid, false);
});

test('both lobes of a sign-changing function area remain selectable', () => {
    const manager = apply([
        { op: 'create', type: 'function', id: 'f', expression: '3*(x^3-x)', xMin: -1, xMax: 1 },
        { op: 'create', type: 'functionRegion', id: 'area', function1Id: 'f', xMin: -1, xMax: 1 }
    ]);
    const area = manager.getAllObjects()[1];
    assert.equal(area.valid, true);
    assert.equal(area.hitTest(new Vec2(-0.5, 0.55)), true);
    assert.equal(area.hitTest(new Vec2(0.5, -0.55)), true);
    assert.equal(area.hitTest(new Vec2(0.5, 0.55)), false);
});

test('function region rejects a pole and remaps both graph references', () => {
    const manager = apply([
        { op: 'create', type: 'function', id: 'f', expression: '1/x' },
        { op: 'create', type: 'functionRegion', id: 'area', function1Id: 'f', xMin: -1, xMax: 1 }
    ]);
    assert.equal(manager.getAllObjects()[1].valid, false);
    const offGridPole = apply([
        { op: 'create', type: 'function', id: 'f', expression: '1/(x-sqrt(2))' },
        { op: 'create', type: 'functionRegion', id: 'area', function1Id: 'f', xMin: 1, xMax: 2 }
    ]);
    assert.equal(offGridPole.getAllObjects()[1].valid, false);
    const squaredPole = apply([
        { op: 'create', type: 'function', id: 'f', expression: '1/(x-sqrt(2))^2' },
        { op: 'create', type: 'functionRegion', id: 'area', function1Id: 'f', xMin: 1, xMax: 2 }
    ]);
    assert.equal(squaredPole.getAllObjects()[1].valid, false);
    assert.deepEqual(remapObjectReferences({ function1Id: 'f', function2Id: 'g' }, new Map([['f', 'new-f'], ['g', 'new-g']])),
        { function1Id: 'new-f', function2Id: 'new-g' });
    assert.equal(new SchemaValidator().validate({ operations: [
        { op: 'create', type: 'functionRegion', function1Id: 'f', xMin: 2, xMax: 1 }
    ] }).valid, false);
});

test('function area scene compiles through the same strict GraphA schema used for one-shot AI output', () => {
    const compiled = compileSceneGraph({ nodes: [
        { id: 'f', kind: 'function', expression: 'x^2', xMin: -1, xMax: 1 },
        { id: 'g', kind: 'function', expression: '1', xMin: -1, xMax: 1 },
        { id: 'area', kind: 'functionRegion', function1Id: 'g', function2Id: 'f',
            xMin: -1, xMax: 1, fillOpacity: 0.2 }
    ] });
    assert.deepEqual(compiled.warnings, []);
    assert.deepEqual(compiled.operations.map(op => op.type), ['function', 'function', 'functionRegion']);
    assert.equal(new SchemaValidator().validate(compiled).valid, true);
    assert.ok(GRAPH_OPERATIONS_JSON_SCHEMA.properties.operations.items.properties.function1Id);
    assert.ok(GRAPH_OPERATIONS_JSON_SCHEMA.properties.operations.items.properties.function2Id);
    assert.ok(GRAPH_OPERATIONS_JSON_SCHEMA.properties.operations.items.required.includes('baselineY'));
    assert.equal(new SchemaValidator().validateReferences({ operations: [
        { op: 'create', type: 'functionRegion', id: 'area', function1Id: 'missing', xMin: -1, xMax: 1 }
    ] }, new Set()).valid, false);
});

test('compact problem scene accepts a function-bounded shaded mustDraw item', () => {
    const scene = { nodes: [
        { id: 'f', kind: 'function', text: 'x^2', numbers: [-1, 1] },
        { id: 'g', kind: 'function', text: '1', numbers: [-1, 1] },
        { id: 'area', kind: 'functionRegion', refs: ['g', 'f'], numbers: [-1, 1],
            style: { fillColor: '#000000', fillOpacity: 0.2 } }
    ], relations: [], mustDraw: [{ id: 'shade', description: 'Shade the area between f and g',
        nodeIds: ['f', 'g', 'area'], relationIds: [], required: true, evidence: '색칠된 영역의 넓이' }] };
    const compiled = compileProblemScenePayload({ scene });
    assert.deepEqual(compiled.warnings, []);
    assert.equal(compiled.operations.at(-1).type, 'functionRegion');
    assert.equal(compiled.operations.at(-1).function1Id, 'g');
    assert.equal(compiled.operations.at(-1).function2Id, 'f');
    assert.equal(compiled.operations.at(-1).fillOpacity, 0.2);
    assert.deepEqual(validateProblemSceneCoverage(scene, compiled), { valid: true, errors: [] });
});
