import assert from 'node:assert/strict';
import test from 'node:test';

import { ObjectManager } from '../js/core/ObjectManager.js';
import { SelectTool } from '../js/tools/SelectTool.js';
import { Vec2 } from '../js/utils/Geometry.js';

function makeCanvas() {
    return {
        toMathLength(value) {
            return value / 100;
        },
        getVisibleBounds() {
            return {
                minX: -10,
                maxX: 10,
                minY: -10,
                maxY: 10
            };
        },
        toScreen(point) {
            return new Vec2(point.x * 50, -point.y * 50);
        }
    };
}

function makeApp(objectManager) {
    return {
        objectManager,
        canvas: makeCanvas()
    };
}

function selectIds(objectManager) {
    return objectManager.getSelectedObjects().map(object => object.id);
}

test('drag-box selection includes a function graph crossing the rectangle', () => {
    const objectManager = new ObjectManager();
    const func = objectManager.createFunction('x^2', { label: 'f', showLabel: false });
    const tool = new SelectTool();
    const rect = tool.getSelectionRect(new Vec2(-0.4, -0.1), new Vec2(0.4, 0.3));

    const count = tool.selectObjectsInBox(makeApp(objectManager), rect);

    assert.equal(count, 1);
    assert.deepEqual(selectIds(objectManager), [func.id]);
});

test('drag-box selection includes a segment crossing the rectangle even when endpoints are outside', () => {
    const objectManager = new ObjectManager();
    const a = objectManager.createPoint(-2, 0);
    const b = objectManager.createPoint(2, 0);
    const segment = objectManager.createSegment(a.id, b.id);
    const tool = new SelectTool();
    const rect = tool.getSelectionRect(new Vec2(-0.2, -0.2), new Vec2(0.2, 0.2));

    tool.selectObjectsInBox(makeApp(objectManager), rect);

    assert.equal(selectIds(objectManager).includes(segment.id), true);
    assert.equal(selectIds(objectManager).includes(a.id), false);
    assert.equal(selectIds(objectManager).includes(b.id), false);
});

test('drag-box selection includes a prism edge crossing the rectangle', () => {
    const objectManager = new ObjectManager();
    const a = objectManager.createPoint(-3, 0);
    const b = objectManager.createPoint(3, 0);
    const c = objectManager.createPoint(3, 2);
    const d = objectManager.createPoint(-3, 2);
    const ap = objectManager.createPoint(-2, 1);
    const bp = objectManager.createPoint(4, 1);
    const cp = objectManager.createPoint(4, 3);
    const dp = objectManager.createPoint(-2, 3);
    const prism = objectManager.createPrism(
        [a.id, b.id, c.id, d.id],
        [ap.id, bp.id, cp.id, dp.id],
        { showLabel: false }
    );
    const tool = new SelectTool();
    const rect = tool.getSelectionRect(new Vec2(-0.2, -0.2), new Vec2(0.2, 0.2));

    tool.selectObjectsInBox(makeApp(objectManager), rect);

    assert.equal(selectIds(objectManager).includes(prism.id), true);
    assert.equal(selectIds(objectManager).includes(a.id), false);
    assert.equal(selectIds(objectManager).includes(b.id), false);
});

test('drag-box selection includes a pyramid edge crossing the rectangle', () => {
    const objectManager = new ObjectManager();
    const a = objectManager.createPoint(-3, -1);
    const b = objectManager.createPoint(3, -1);
    const c = objectManager.createPoint(2, 1);
    const d = objectManager.createPoint(-2, 1);
    const apex = objectManager.createPoint(0, 4);
    const pyramid = objectManager.createPyramid(
        [a.id, b.id, c.id, d.id],
        apex.id,
        { showLabel: false }
    );
    const tool = new SelectTool();
    const rect = tool.getSelectionRect(new Vec2(-0.2, -1.2), new Vec2(0.2, -0.8));

    tool.selectObjectsInBox(makeApp(objectManager), rect);

    assert.equal(selectIds(objectManager).includes(pyramid.id), true);
    assert.equal(selectIds(objectManager).includes(a.id), false);
    assert.equal(selectIds(objectManager).includes(b.id), false);
});
