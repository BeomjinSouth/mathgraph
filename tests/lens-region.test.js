import assert from 'node:assert/strict';
import test from 'node:test';

import { ObjectManager } from '../js/core/ObjectManager.js';
import { Vec2 } from '../js/utils/Geometry.js';

function createTwoCircleLens() {
    const objectManager = new ObjectManager();
    const O1 = objectManager.createPoint(-1, 0, { label: 'O1' });
    const R1 = objectManager.createPoint(1, 0, { label: 'R1' });
    const O2 = objectManager.createPoint(1, 0, { label: 'O2' });
    const R2 = objectManager.createPoint(-1, 0, { label: 'R2' });
    const c1 = objectManager.createCircle(O1.id, R1.id, { label: 'c1' });
    const c2 = objectManager.createCircle(O2.id, R2.id, { label: 'c2' });
    const lens = objectManager.createLensRegion(c1.id, c2.id, {
        id: 'lens',
        fillColor: '#2563eb',
        fillOpacity: 0.32
    });
    objectManager.updateAll();
    return { objectManager, lens };
}

test('LensRegion builds a filled two-circle overlap path', () => {
    const { lens } = createTwoCircleLens();

    assert.equal(lens.valid, true);
    assert.equal(lens.intersections.length, 2);
    assert.ok(lens.pathPoints.length > 40);
    assert.equal(lens.hitTest(new Vec2(0, 0), 8, { toMathLength: value => value / 100 }), true);
    assert.equal(lens.hitTest(new Vec2(-2.5, 0), 8, { toMathLength: value => value / 100 }), false);
    assert.equal(lens.fillColor, '#2563eb');
    assert.equal(lens.fillOpacity, 0.32);
});

test('LensRegion serializes and restores through ObjectManager JSON', () => {
    const { objectManager } = createTwoCircleLens();
    const saved = objectManager.toJSON();
    const restored = new ObjectManager();

    restored.fromJSON(saved);
    const lens = restored.getAllObjects().find(object => object.type === 'lensRegion');

    assert.ok(lens);
    assert.equal(lens.valid, true);
    assert.equal(lens.circle1Id, saved.objects.find(object => object.type === 'lensRegion').circle1Id);
    assert.ok(lens.pathPoints.length > 40);
});
