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

class MockCanvas {
    constructor() {
        this.segments = [];
    }

    drawSegment(p1, p2, options = {}) {
        this.segments.push({ p1, p2, dashed: options.dashed === true });
    }

    drawLabel() {}
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

test('prism keeps the closing rear/top edge index when it is hidden', () => {
    const points = [
        new MockPoint('A', 0, 0),
        new MockPoint('B', 4, 0),
        new MockPoint('C', 4, 2),
        new MockPoint('D', 0, 2),
        new MockPoint('Ap', 1, 1),
        new MockPoint('Bp', 5, 1),
        new MockPoint('Cp', 5, 3),
        new MockPoint('Dp', 1, 3)
    ];

    const prism = new Prism(['A', 'B', 'C', 'D'], ['Ap', 'Bp', 'Cp', 'Dp']);
    prism.update(new MockObjectManager(points));

    assert.deepEqual(prism._hiddenEdges, [
        { type: 'top', index: 0 },
        { type: 'top', index: 3 },
        { type: 'vertical', index: 0 }
    ]);
});

test('rectangular prism renders front/base edges solid and rear/top hidden edges dashed', () => {
    const points = [
        new MockPoint('A', 0, 0),
        new MockPoint('B', 4, 0),
        new MockPoint('C', 4, 2),
        new MockPoint('D', 0, 2),
        new MockPoint('Ap', 1, 1),
        new MockPoint('Bp', 5, 1),
        new MockPoint('Cp', 5, 3),
        new MockPoint('Dp', 1, 3)
    ];

    const prism = new Prism(['A', 'B', 'C', 'D'], ['Ap', 'Bp', 'Cp', 'Dp']);
    prism.update(new MockObjectManager(points));

    const canvas = new MockCanvas();
    prism.render(canvas);

    const topEdges = canvas.segments.slice(0, 4).map(segment => segment.dashed);
    const baseEdges = canvas.segments.slice(4, 8).map(segment => segment.dashed);
    const verticalEdges = canvas.segments.slice(8, 12).map(segment => segment.dashed);

    assert.deepEqual(topEdges, [true, false, false, true]);
    assert.deepEqual(baseEdges, [false, false, false, false]);
    assert.deepEqual(verticalEdges, [true, false, false, false]);
});
