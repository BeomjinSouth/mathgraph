import assert from 'node:assert/strict';
import test from 'node:test';

import { GRAPH_OPERATIONS_JSON_SCHEMA } from '../js/ai/AIService.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { compileSceneGraph } from '../js/ai/SceneGraphCompiler.js';

function historyStub() {
    return {
        recordCreate() {}, recordDelete() {}, recordPropertyChange() {},
        createSnapshot() { return null; }, restoreSnapshot() {}
    };
}

test('strict AI schema exposes function ranges, intersection branch, and length marker count', () => {
    const properties = GRAPH_OPERATIONS_JSON_SCHEMA.properties.operations.items.properties;
    for (const field of ['xMin', 'xMax', 'yMin', 'yMax', 'branch', 'tickCount']) {
        assert.ok(properties[field], `${field} missing from strict operation schema`);
    }
});

test('PatchApplier preserves equal-length tick counts', () => {
    const manager = new ObjectManager();
    const result = new PatchApplier(manager, historyStub()).apply({
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0 },
            { op: 'create', id: 'B', type: 'point', x: 4, y: 0 },
            { op: 'create', id: 'C', type: 'point', x: 0, y: 3 },
            { op: 'create', id: 'D', type: 'point', x: 4, y: 3 },
            { op: 'create', id: 'AB', type: 'segment', point1Id: 'A', point2Id: 'B' },
            { op: 'create', id: 'CD', type: 'segment', point1Id: 'C', point2Id: 'D' },
            {
                op: 'create', id: 'equal_ab_cd', type: 'equalLengthMarker',
                segment1Id: 'AB', segment2Id: 'CD', tickCount: 2
            }
        ]
    });

    assert.equal(result.success, true, result.error);
    const marker = manager.getAllObjects().find(object => object.type === 'equalLengthMarker');
    assert.equal(marker.tickCount, 2);
});

test('PatchApplier preserves function ranges and a deterministic intersection branch', () => {
    const manager = new ObjectManager();
    const applier = new PatchApplier(manager, historyStub());
    const result = applier.apply({
        operations: [
            {
                op: 'create', id: 'f', type: 'function', expression: 'x^2',
                xMin: -2, xMax: 3, yMin: 0, yMax: 5
            },
            { op: 'create', id: 'o1', type: 'point', x: -1, y: 0, visible: false },
            { op: 'create', id: 'r1', type: 'point', x: 2, y: 0, visible: false },
            { op: 'create', id: 'c1', type: 'circle', centerId: 'o1', pointOnCircleId: 'r1' },
            { op: 'create', id: 'o2', type: 'point', x: 1, y: 0, visible: false },
            { op: 'create', id: 'r2', type: 'point', x: 4, y: 0, visible: false },
            { op: 'create', id: 'c2', type: 'circle', centerId: 'o2', pointOnCircleId: 'r2' },
            { op: 'create', id: 'p', type: 'intersection', object1Id: 'c1', object2Id: 'c2', branch: 1 }
        ]
    });

    assert.equal(result.success, true, result.error);
    const objects = manager.getAllObjects();
    const fn = objects.find(object => object.type === 'function');
    const intersection = objects.find(object => object.type === 'intersection');
    assert.equal(fn.xMin, -2);
    assert.equal(fn.xMax, 3);
    assert.equal(fn.yMin, 0);
    assert.equal(fn.yMax, 5);
    assert.equal(intersection.branch, 1);
    assert.ok(intersection.position.y < 0);
});

test('SceneGraphCompiler forwards function ranges and intersection branch', () => {
    const compiled = compileSceneGraph({
        nodes: [
            { id: 'f', kind: 'function', expression: 'x^2', xMin: -2, xMax: 2, yMin: 0, yMax: 4 },
            { id: 'a', kind: 'function', expression: 'x' },
            { id: 'b', kind: 'function', expression: '-x' }
        ],
        relations: [
            { id: 'p', kind: 'intersection', object1Id: 'a', object2Id: 'b', branch: 1 }
        ]
    });

    const fn = compiled.operations.find(operation => operation.id === 'f');
    const intersection = compiled.operations.find(operation => operation.id === 'p');
    assert.equal(fn.xMin, -2);
    assert.equal(fn.xMax, 2);
    assert.equal(fn.yMin, 0);
    assert.equal(fn.yMax, 4);
    assert.equal(intersection.branch, 1);
});

test('SchemaValidator rejects invalid range bounds and branch indexes', () => {
    const validator = new SchemaValidator();
    const validation = validator.validate({
        operations: [
            { op: 'create', type: 'function', expression: 'x^2', xMin: 3, xMax: -2 },
            { op: 'create', type: 'intersection', object1Id: 'a', object2Id: 'b', branch: 3 }
        ]
    });
    assert.equal(validation.valid, false);
    assert.match(validation.errors.join('\n'), /xMin|branch/);
});

test('SchemaValidator rejects non-positive equal-length tick counts', () => {
    const validation = new SchemaValidator().validate({
        operations: [{
            op: 'create', type: 'equalLengthMarker',
            segment1Id: 'AB', segment2Id: 'CD', tickCount: 0
        }]
    });

    assert.equal(validation.valid, false);
    assert.match(validation.errors.join('\n'), /tickCount/);
});
