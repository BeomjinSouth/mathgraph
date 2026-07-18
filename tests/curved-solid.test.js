import assert from 'node:assert/strict';
import test from 'node:test';

import { CurvedSolid } from '../js/objects/CurvedSolid.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { compileSceneGraph } from '../js/ai/SceneGraphCompiler.js';
import { GRAPH_OPERATIONS_JSON_SCHEMA } from '../js/ai/AIService.js';

function createRecordingCanvas() {
    const calls = [];
    const ctx = {
        strokeStyle: '#000000',
        fillStyle: '#000000',
        lineWidth: 1,
        beginPath() { calls.push(['beginPath']); },
        moveTo(x, y) { calls.push(['moveTo', x, y]); },
        lineTo(x, y) { calls.push(['lineTo', x, y]); },
        ellipse(x, y, rx, ry, rotation, start, end) { calls.push(['ellipse', x, y, rx, ry, start, end]); },
        arc(x, y, radius, start, end) { calls.push(['arc', x, y, radius, start, end]); },
        stroke() { calls.push(['stroke']); },
        fill() { calls.push(['fill']); },
        setLineDash(pattern) { calls.push(['dash', ...pattern]); }
    };
    return {
        ctx,
        calls,
        toScreen(point) { return { x: point.x * 10, y: point.y * -10 }; },
        toScreenLength(length) { return length * 10; },
        toMathLength(length) { return length / 10; },
        drawLabel() {}
    };
}

test('CurvedSolid renders textbook projections with hidden curved edges', () => {
    const cylinder = new CurvedSolid('cylinder', { x: 1, y: 2, width: 4, height: 6, ellipseRatio: 0.25 });
    const cone = new CurvedSolid('cone', { x: -2, y: 0, width: 5, height: 7 });
    const sphere = new CurvedSolid('sphere', { x: 0, y: 0, width: 4, height: 4 });

    const cylinderCanvas = createRecordingCanvas();
    cylinder.render(cylinderCanvas);
    assert.ok(cylinderCanvas.calls.filter(call => call[0] === 'ellipse').length >= 3);
    assert.ok(cylinderCanvas.calls.some(call => call[0] === 'dash' && call.length > 1));

    const coneCanvas = createRecordingCanvas();
    cone.render(coneCanvas);
    assert.ok(coneCanvas.calls.some(call => call[0] === 'lineTo'));
    assert.ok(coneCanvas.calls.some(call => call[0] === 'ellipse'));

    const sphereCanvas = createRecordingCanvas();
    sphere.render(sphereCanvas);
    assert.ok(sphereCanvas.calls.some(call => call[0] === 'arc'));
    assert.ok(sphereCanvas.calls.some(call => call[0] === 'ellipse'));
});

test('Curved solids serialize, restore, and remain draggable', () => {
    const manager = new ObjectManager();
    const created = manager.createCurvedSolid('cylinder', {
        x: 2,
        y: -1,
        width: 5,
        height: 8,
        ellipseRatio: 0.3
    });
    created.drag({ x: 4, y: 3 });
    const position = created.getPosition();
    assert.notEqual(position, created.position);
    assert.deepEqual(position, created.position);
    assert.equal(created.containsPoint({ x: 4, y: 3 }), true);
    assert.equal(created.containsPoint({ x: 20, y: 20 }), false);

    const restored = new ObjectManager();
    restored.fromJSON(manager.toJSON());
    const solid = restored.getObject(created.id);

    assert.ok(solid instanceof CurvedSolid);
    assert.equal(solid.type, 'cylinder');
    assert.equal(solid.position.x, 4);
    assert.equal(solid.position.y, 3);
    assert.equal(solid.width, 5);
    assert.equal(solid.height, 8);
    assert.equal(solid.ellipseRatio, 0.3);
});

test('AI schema and patch applier create and update curved solids', () => {
    const operations = [
        { op: 'create', id: 'cyl', type: 'cylinder', x: 0, y: 0, width: 4, height: 6 },
        { op: 'update', id: 'cyl', width: 5, ellipseRatio: 0.35 }
    ];
    const validator = new SchemaValidator();
    const validation = validator.validate({ operations });
    assert.equal(validation.valid, true, validation.errors.join('\n'));

    const manager = new ObjectManager();
    const history = {
        recordCreate() {}, recordDelete() {}, recordPropertyChange() {},
        createSnapshot() { return null; }, restoreSnapshot() {}
    };
    const result = new PatchApplier(manager, history).apply({ operations });
    assert.equal(result.success, true, result.error);
    const [solid] = manager.getAllObjects();
    assert.equal(solid.type, 'cylinder');
    assert.equal(solid.width, 5);
    assert.equal(solid.ellipseRatio, 0.35);
});

test('scene compiler and strict OpenAI schema expose curved solids and text labels', () => {
    const compiled = compileSceneGraph({
        nodes: [
            { id: 'cyl', kind: 'cylinder', x: -4, y: 0, width: 3, height: 5 },
            { id: 'cone', kind: 'cone', x: 0, y: 0, width: 4, height: 6 },
            { id: 'sphere', kind: 'sphere', x: 4, y: 0, width: 4, height: 4 },
            { id: 'note', kind: 'textLabel', text: 'r = 2', x: 4, y: -3 }
        ]
    });

    assert.deepEqual(compiled.operations.map(op => op.type), ['cylinder', 'cone', 'sphere', 'textLabel']);
    assert.equal(compiled.warnings.length, 0);
    const typeEnum = GRAPH_OPERATIONS_JSON_SCHEMA.properties.operations.items.properties.type.enum;
    assert.ok(typeEnum.includes('cylinder'));
    assert.ok(typeEnum.includes('cone'));
    assert.ok(typeEnum.includes('sphere'));
    assert.ok(typeEnum.includes('textLabel'));
});
