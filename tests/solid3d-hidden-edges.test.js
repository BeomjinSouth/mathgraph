import assert from 'node:assert/strict';
import test from 'node:test';

import { Prism, Pyramid } from '../js/objects/Solid3D.js';
import { Vec2 } from '../js/utils/Geometry.js';

class MockPoint {
    constructor(id, x, y) {
        this.id = id;
        this.valid = true;
        this._position = new Vec2(x, y);
    }

    getPosition() {
        return this._position;
    }
}

class MockObjectManager {
    constructor(points) {
        this.points = new Map(points.map(point => [point.id, point]));
    }

    getObject(id) {
        return this.points.get(id) || null;
    }
}

test('pyramid keeps the closing base edge index when it is hidden', () => {
    const points = [
        new MockPoint('A', 0, 0),
        new MockPoint('B', 4, 0),
        new MockPoint('C', 2.5, -2.5),
        new MockPoint('P', -8, -8)
    ];

    const pyramid = new Pyramid(['A', 'B', 'C'], 'P');
    pyramid.update(new MockObjectManager(points));

    assert.deepEqual(pyramid._hiddenEdges, [
        { type: 'base', index: 2 }
    ]);
});

test('prism keeps the closing base edge index when it is hidden', () => {
    const points = [
        new MockPoint('A', 0, 0),
        new MockPoint('B', 4, 0),
        new MockPoint('C', 5, -2),
        new MockPoint('D', 1, -2.5),
        new MockPoint('Ap', -8, -8),
        new MockPoint('Bp', -4, -8),
        new MockPoint('Cp', -3, -10),
        new MockPoint('Dp', -7, -10.5)
    ];

    const prism = new Prism(['A', 'B', 'C', 'D'], ['Ap', 'Bp', 'Cp', 'Dp']);
    prism.update(new MockObjectManager(points));

    assert.deepEqual(prism._hiddenEdges, [
        { type: 'base', index: 2 },
        { type: 'base', index: 3 },
        { type: 'vertical', index: 3 }
    ]);
});
