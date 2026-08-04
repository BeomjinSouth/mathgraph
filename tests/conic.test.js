import assert from 'node:assert/strict';
import test from 'node:test';

import { Vec2 } from '../js/utils/Geometry.js';
import { Ellipse, Hyperbola, Parabola } from '../js/objects/Conic.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { compileSceneGraph } from '../js/ai/SceneGraphCompiler.js';
import { GRAPH_OPERATIONS_JSON_SCHEMA } from '../js/ai/AIService.js';

const BOUNDS = { minX: -12, maxX: 12, minY: -9, maxY: 9 };

function createCanvasRecorder() {
    const polylines = [];
    return {
        polylines,
        getVisibleBounds() { return BOUNDS; },
        drawPolyline(points, options) { polylines.push({ points, options }); },
        drawMathLabel() {},
        toMathLength(value) { return value / 50; }
    };
}

function createHistoryStub() {
    return {
        recordCreate() {},
        recordDelete() {},
        recordPropertyChange() {},
        createSnapshot() { return null; },
        restoreSnapshot() {}
    };
}

test('ellipse, hyperbola, and parabola sample their defining equations', () => {
    const ellipse = new Ellipse(5, 3, { x: 1, y: -2, showLabel: false });
    for (const point of ellipse.getPolylines(BOUNDS, 48)[0]) {
        const u = point.x - 1;
        const v = point.y + 2;
        assert.ok(Math.abs((u * u) / 25 + (v * v) / 9 - 1) < 1e-9);
    }

    const hyperbola = new Hyperbola(2, 3, { orientation: 'horizontal', showLabel: false });
    for (const branch of hyperbola.getPolylines(BOUNDS, 40)) {
        for (const point of branch) {
            assert.ok(Math.abs((point.x * point.x) / 4 - (point.y * point.y) / 9 - 1) < 1e-8);
        }
    }

    const parabola = new Parabola(1.5, { orientation: 'up', showLabel: false });
    for (const point of parabola.getPolylines(BOUNDS, 60)[0]) {
        assert.ok(Math.abs(point.x * point.x - 6 * point.y) < 1e-8);
    }
});

test('conics render as first-class polylines and hit-test their curves', () => {
    const ellipse = new Ellipse(4, 2, { showLabel: false });
    const hyperbola = new Hyperbola(2, 1.5, { orientation: 'vertical', showLabel: false });
    const parabola = new Parabola(1, { orientation: 'left', showLabel: false });
    const canvas = createCanvasRecorder();

    ellipse.render(canvas);
    hyperbola.render(canvas);
    parabola.render(canvas);

    assert.equal(canvas.polylines.length, 4);
    assert.equal(canvas.polylines[0].options.closed, true);
    assert.equal(canvas.polylines[1].options.closed, false);
    assert.equal(ellipse.hitTest(new Vec2(4, 0), 8, canvas), true);
    assert.equal(ellipse.hitTest(new Vec2(0, 0), 8, canvas), false);
    assert.equal(hyperbola.hitTest(new Vec2(0, 2), 8, canvas), true);
    assert.equal(parabola.hitTest(new Vec2(-1, 2), 8, canvas), true);
});

test('conics preserve rotation and parameters through drag and JSON restore', () => {
    const manager = new ObjectManager();
    const ellipse = manager.createEllipse(5, 3, { x: 1, y: 2, rotation: Math.PI / 6 });
    const hyperbola = manager.createHyperbola(2, 4, { x: -3, y: 1, orientation: 'vertical', rotation: 0.2 });
    const parabola = manager.createParabola(1.25, { x: 2, y: -1, orientation: 'down', rotation: -0.15 });

    ellipse.startDrag(new Vec2(1, 2));
    ellipse.drag(new Vec2(4, 5));
    ellipse.endDrag();

    const restored = new ObjectManager();
    restored.fromJSON(manager.toJSON());

    const restoredEllipse = restored.getObject(ellipse.id);
    const restoredHyperbola = restored.getObject(hyperbola.id);
    const restoredParabola = restored.getObject(parabola.id);
    assert.ok(restoredEllipse instanceof Ellipse);
    assert.ok(restoredHyperbola instanceof Hyperbola);
    assert.ok(restoredParabola instanceof Parabola);
    assert.deepEqual(restoredEllipse.getPosition(), new Vec2(4, 5));
    assert.equal(restoredEllipse.rotation, Math.PI / 6);
    assert.equal(restoredHyperbola.orientation, 'vertical');
    assert.equal(restoredHyperbola.b, 4);
    assert.equal(restoredParabola.orientation, 'down');
    assert.equal(restoredParabola.p, 1.25);
});

test('AI schema and PatchApplier create and update all conic types', () => {
    const operations = [
        { op: 'create', id: 'e', type: 'ellipse', x: 0, y: 0, radiusX: 5, radiusY: 3, rotation: 0.1 },
        { op: 'create', id: 'h', type: 'hyperbola', x: 0, y: 0, a: 2, b: 3, orientation: 'horizontal' },
        { op: 'create', id: 'p', type: 'parabola', x: -2, y: 0, p: 1.5, orientation: 'right' },
        { op: 'update', id: 'e', radiusY: 4, x: 1 }
    ];
    const validator = new SchemaValidator();
    const validation = validator.validate({ operations });
    assert.equal(validation.valid, true, validation.errors.join('\n'));

    const manager = new ObjectManager();
    const result = new PatchApplier(manager, createHistoryStub()).apply({ operations });
    assert.equal(result.success, true, result.message);
    assert.deepEqual(manager.getAllObjects().map(object => object.type), ['ellipse', 'hyperbola', 'parabola']);
    assert.equal(manager.getAllObjects()[0].radiusY, 4);
    assert.equal(manager.getAllObjects()[0].position.x, 1);

    const invalid = validator.validate({
        operations: [
            { op: 'create', type: 'ellipse', x: 0, y: 0, radiusX: -1, radiusY: 2 },
            { op: 'create', type: 'hyperbola', x: 0, y: 0, a: 2, b: 1, orientation: 'diagonal' },
            { op: 'create', type: 'parabola', x: 0, y: 0, p: 0, orientation: 'right' }
        ]
    });
    assert.equal(invalid.valid, false);
    assert.match(invalid.errors.join('\n'), /radiusX must be greater than 0/);
    assert.match(invalid.errors.join('\n'), /hyperbola orientation/);
    assert.match(invalid.errors.join('\n'), /p must be greater than 0/);
});

test('scene compiler and strict OpenAI schema expose conics', () => {
    const compiled = compileSceneGraph({
        nodes: [
            { id: 'e', kind: 'ellipse', centerX: 0, centerY: 0, radiusX: 5, radiusY: 3 },
            { id: 'h', kind: 'hyperbola', x: 0, y: 0, a: 2, b: 3, orientation: 'vertical' },
            { id: 'p', kind: 'parabola', vertexX: -2, vertexY: 0, focalLength: 1.5, orientation: 'right' }
        ]
    });

    assert.deepEqual(compiled.operations.map(operation => operation.type), ['ellipse', 'hyperbola', 'parabola']);
    assert.equal(compiled.warnings.length, 0);
    const validation = new SchemaValidator().validate({ operations: compiled.operations });
    assert.equal(validation.valid, true, validation.errors.join('\n'));

    const typeEnum = GRAPH_OPERATIONS_JSON_SCHEMA.properties.operations.items.properties.type.enum;
    assert.ok(typeEnum.includes('ellipse'));
    assert.ok(typeEnum.includes('hyperbola'));
    assert.ok(typeEnum.includes('parabola'));
});

test('SVG export emits editable paths for every conic type', async () => {
    globalThis.window = {};
    globalThis.document = { addEventListener() {} };
    const { default: GraphAApp } = await import('../js/main.js');
    const app = Object.create(GraphAApp.prototype);
    app.canvas = {
        toScreen: point => ({ x: point.x * 10, y: -point.y * 10 }),
        getVisibleBounds: () => BOUNDS
    };

    const objects = [
        new Ellipse(5, 3, { x: 0, y: 0, showLabel: false }),
        new Hyperbola(2, 1.5, { x: 0, y: 0, orientation: 'horizontal', showLabel: false }),
        new Parabola(1, { x: -2, y: 0, orientation: 'right', showLabel: false })
    ];
    objects[0].id = 'ellipse_svg';
    objects[1].id = 'hyperbola_svg';
    objects[2].id = 'parabola_svg';

    const markup = objects.map(object => app.buildSVGObjectMarkup(object));
    assert.match(markup[0], /data-type="ellipse"/);
    assert.match(markup[1], /data-type="hyperbola"/);
    assert.match(markup[2], /data-type="parabola"/);
    assert.equal((markup[0].match(/<path\b/g) || []).length, 1);
    assert.equal((markup[1].match(/<path\b/g) || []).length, 2);
    assert.equal((markup[2].match(/<path\b/g) || []).length, 1);
    assert.ok(markup.every(value => !value.includes('<polygon')));
});
