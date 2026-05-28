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

function makePolygonPoints(prefix, count, radius = 2, offsetX = 0, offsetY = 0) {
    return Array.from({ length: count }, (_, index) => {
        const angle = -Math.PI / 2 + index * 2 * Math.PI / count;
        return new MockPoint(
            `${prefix}${index}`,
            offsetX + radius * Math.cos(angle),
            offsetY + radius * Math.sin(angle)
        );
    });
}

function makePolygonPrism(count, shiftX, shiftY) {
    const basePoints = makePolygonPoints('B', count);
    const topPoints = basePoints.map((point, index) => {
        const position = point.getPosition();
        return new MockPoint(`T${index}`, position.x + shiftX, position.y + shiftY);
    });
    const prism = new Prism(
        basePoints.map(point => point.id),
        topPoints.map(point => point.id)
    );
    prism.update(new MockObjectManager([...basePoints, ...topPoints]));
    return prism;
}

function makePolygonPyramid(count, apexX, apexY) {
    const basePoints = makePolygonPoints('B', count);
    const apex = new MockPoint('V', apexX, apexY);
    const pyramid = new Pyramid(basePoints.map(point => point.id), apex.id);
    pyramid.update(new MockObjectManager([...basePoints, apex]));
    return pyramid;
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

test('rectangular prism keeps front/base edges solid for all rear-face shift quadrants', () => {
    const cases = [
        { shift: [1, 1], hidden: [{ type: 'top', index: 0 }, { type: 'top', index: 3 }, { type: 'vertical', index: 0 }] },
        { shift: [-1, 1], hidden: [{ type: 'top', index: 0 }, { type: 'top', index: 1 }, { type: 'vertical', index: 1 }] },
        { shift: [1, -1], hidden: [{ type: 'top', index: 2 }, { type: 'top', index: 3 }, { type: 'vertical', index: 3 }] },
        { shift: [-1, -1], hidden: [{ type: 'top', index: 1 }, { type: 'top', index: 2 }, { type: 'vertical', index: 2 }] }
    ];

    for (const { shift, hidden } of cases) {
        const [shiftX, shiftY] = shift;
        const points = [
            new MockPoint('A', 0, 0),
            new MockPoint('B', 4, 0),
            new MockPoint('C', 4, 2),
            new MockPoint('D', 0, 2),
            new MockPoint('Ap', shiftX, shiftY),
            new MockPoint('Bp', 4 + shiftX, shiftY),
            new MockPoint('Cp', 4 + shiftX, 2 + shiftY),
            new MockPoint('Dp', shiftX, 2 + shiftY)
        ];

        const prism = new Prism(['A', 'B', 'C', 'D'], ['Ap', 'Bp', 'Cp', 'Dp']);
        prism.update(new MockObjectManager(points));

        assert.deepEqual(prism._hiddenEdges, hidden);
        assert.equal(prism._hiddenEdges.some(edge => edge.type === 'base'), false);
    }
});

test('polygonal prisms exercise rear dashed edges without hiding the front face', () => {
    for (const sideCount of [3, 5, 6]) {
        for (const [shiftX, shiftY] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const prism = makePolygonPrism(sideCount, shiftX, shiftY);

            assert.equal(prism.valid, true);
            assert.equal(prism._hiddenEdges.some(edge => edge.type === 'base'), false);
            assert.ok(
                prism._hiddenEdges.some(edge => edge.type === 'top' || edge.type === 'vertical'),
                `${sideCount}-gon prism with shift (${shiftX}, ${shiftY}) should exercise rear hidden edges`
            );
        }
    }
});

test('varied pyramids remain valid and classify at least one hidden edge', () => {
    for (const sideCount of [3, 4, 5, 6]) {
        for (const [apexX, apexY] of [[0, 3], [-2, 2.5], [2, 2.5], [0, -3]]) {
            const pyramid = makePolygonPyramid(sideCount, apexX, apexY);

            assert.equal(pyramid.valid, true);
            assert.ok(
                pyramid._hiddenEdges.length > 0,
                `${sideCount}-gon pyramid with apex (${apexX}, ${apexY}) should classify hidden edges`
            );
            assert.equal(
                pyramid._hiddenEdges.every(edge => edge.type === 'base' || edge.type === 'lateral'),
                true
            );
        }
    }
});
