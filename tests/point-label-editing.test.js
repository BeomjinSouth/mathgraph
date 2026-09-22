import assert from 'node:assert/strict';
import test from 'node:test';

import { FreePoint, IntersectionPoint, Midpoint, PointOnLine } from '../js/objects/Point.js';
import { Vec2 } from '../js/utils/Geometry.js';

function createCanvasStub() {
    return {
        toScreen: point => new Vec2(point.x, point.y),
        drawPoint() {},
        drawLabel(position, text, options) {
            return {
                x: position.x + options.offsetX,
                y: position.y + options.offsetY - options.fontSize,
                w: 24,
                h: options.fontSize + 2
            };
        }
    };
}

test('free-point label uses its rendered box for hit testing and dragging', () => {
    const point = new FreePoint(0, 0, { label: 'A', pointSize: 0, fontSize: 27, labelOffset: { x: 10, y: -10 } });
    const canvas = createCanvasStub();
    point.render(canvas);

    const labelClick = new Vec2(15, -20);
    assert.equal(point.hitTest(labelClick, 8, canvas), true);
    assert.equal(point._hitPart, 'label');
    point.startDrag(labelClick, canvas);
    point.drag(new Vec2(20, -13), new Vec2(5, 7), canvas);

    assert.deepEqual(point.toJSON().labelOffset, { x: 15, y: -3 });
    assert.deepEqual(point.getPosition(), new Vec2(0, 0));
});

test('intersection and midpoint labels move without moving their dependent points', () => {
    const canvas = createCanvasStub();
    const objects = [
        new IntersectionPoint('line1', 'line2', null, { label: 'O', pointSize: 0, labelOffset: { x: 10, y: -10 } }),
        new Midpoint('segment1', { label: 'M', pointSize: 0, labelOffset: { x: 10, y: -10 } })
    ];

    for (const object of objects) {
        object.valid = true;
        object.position = new Vec2(0, 0);
        object.render(canvas);
        const labelClick = new Vec2(15, -20);
        assert.equal(object.hitTest(labelClick, 8, canvas), true);
        object.startDrag(labelClick, canvas);
        object.drag(new Vec2(21, -16), new Vec2(6, 4), canvas);
        assert.deepEqual(object.getPosition(), new Vec2(0, 0));
        assert.deepEqual(object.toJSON().labelOffset, { x: 16, y: -6 });
    }
});

test('point-on-line label drag changes only its screen offset', () => {
    const canvas = createCanvasStub();
    const point = new PointOnLine('segment1', 0.6, { label: 'H', pointSize: 0, labelOffset: { x: 10, y: -10 } });
    point.valid = true;
    point.position = new Vec2(0, 0);
    point.render(canvas);
    const labelClick = new Vec2(15, -20);
    point.hitTest(labelClick, 8, canvas);
    point.startDrag(labelClick, canvas);
    point.drag(new Vec2(18, -15), new Vec2(3, 5), canvas, { getObject: () => null });

    assert.equal(point.t, 0.6);
    assert.deepEqual(point.toJSON().labelOffset, { x: 13, y: -5 });
});
