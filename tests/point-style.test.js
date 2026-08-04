import assert from 'node:assert/strict';
import test from 'node:test';

import { Canvas } from '../js/core/Canvas.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { compileSceneGraph } from '../js/ai/SceneGraphCompiler.js';
import { GRAPH_OPERATIONS_JSON_SCHEMA } from '../js/ai/AIService.js';
import { Vec2 } from '../js/utils/Geometry.js';

function createDrawPointRecorder() {
    const calls = [];
    const context = {
        set fillStyle(value) {
            calls.push(['fillStyle', value]);
        },
        beginPath() {
            calls.push(['beginPath']);
        },
        arc(...args) {
            calls.push(['arc', ...args]);
        },
        fill() {
            calls.push(['fill']);
        }
    };
    const canvas = Object.create(Canvas.prototype);
    canvas.ctx = context;
    canvas.backgroundColor = '#ffffff';
    canvas.toScreen = point => point;
    return { canvas, calls };
}

function historyStub() {
    return {
        beginTransaction() {},
        commitTransaction() {},
        abortTransaction() {},
        recordCreate() {},
        recordDelete() {},
        recordPropertyChange() {},
        createSnapshot() { return null; },
        restoreSnapshot() {}
    };
}

test('drawPoint renders open points with a hollow background and closed points filled', () => {
    const openRecorder = createDrawPointRecorder();
    openRecorder.canvas.drawPoint(new Vec2(2, 3), {
        radius: 4,
        color: '#000000',
        pointStyle: 'open'
    });
    assert.deepEqual(openRecorder.calls.filter(call => call[0] === 'fillStyle'), [
        ['fillStyle', '#000000'],
        ['fillStyle', '#ffffff']
    ]);

    const closedRecorder = createDrawPointRecorder();
    closedRecorder.canvas.drawPoint(new Vec2(2, 3), {
        radius: 4,
        color: '#000000'
    });
    assert.deepEqual(closedRecorder.calls.filter(call => call[0] === 'fillStyle'), [
        ['fillStyle', '#000000'],
        ['fillStyle', '#000000']
    ]);
});

test('pointStyle defaults to closed and survives project serialization', () => {
    const manager = new ObjectManager();
    const closed = manager.createPoint(0, 0);
    const open = manager.createPoint(1, 2, { pointStyle: 'open' });

    assert.equal(closed.pointStyle, 'closed');
    assert.equal(open.pointStyle, 'open');
    assert.equal(open.toJSON().pointStyle, 'open');

    const restored = new ObjectManager();
    restored.fromJSON(manager.toJSON());
    assert.deepEqual(restored.getAllObjects().map(point => point.pointStyle), ['closed', 'open']);
});

test('AI schema, validator, patch applier, and scene compiler preserve pointStyle', () => {
    const properties = GRAPH_OPERATIONS_JSON_SCHEMA.properties.operations.items.properties;
    assert.deepEqual(properties.pointStyle.enum, ['closed', 'open', null]);

    const validator = new SchemaValidator();
    const valid = validator.validate({
        operations: [
            { op: 'create', id: 'P', type: 'point', x: -1, y: 2, pointStyle: 'open' },
            { op: 'update', id: 'P', pointStyle: 'closed' }
        ]
    });
    assert.equal(valid.valid, true, valid.errors.join('\n'));

    const invalid = validator.validate({
        operations: [
            { op: 'create', type: 'point', x: 0, y: 0, pointStyle: 'half-open' }
        ]
    });
    assert.equal(invalid.valid, false);
    assert.match(invalid.errors.join('\n'), /pointStyle/);

    const manager = new ObjectManager();
    const result = new PatchApplier(manager, historyStub()).apply({
        operations: [
            { op: 'create', id: 'P', type: 'point', x: -1, y: 2, pointStyle: 'open' },
            { op: 'update', id: 'P', pointStyle: 'closed' }
        ]
    });
    assert.equal(result.success, true, result.message);
    assert.equal(manager.getAllObjects()[0].pointStyle, 'closed');

    const compiled = compileSceneGraph({
        nodes: [
            { id: 'open_endpoint', kind: 'point', x: 1, y: 1, pointStyle: 'open' }
        ]
    });
    assert.equal(compiled.operations[0].pointStyle, 'open');
});
