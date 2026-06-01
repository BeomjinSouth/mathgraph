import assert from 'node:assert/strict';
import test from 'node:test';

import { Canvas } from '../js/core/Canvas.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { SettingsManager } from '../js/core/SettingsManager.js';
import { Vec2 } from '../js/utils/Geometry.js';
import { GeoObject, ObjectType } from '../js/objects/GeoObject.js';
import { CircleCenterPoint } from '../js/objects/Point.js';

function withMockStorage(initialValue, fn) {
    const previousLocalStorage = globalThis.localStorage;
    const storage = initialValue === undefined ? {} : { graphA_settings: initialValue };

    globalThis.localStorage = {
        getItem(key) {
            return storage[key] ?? null;
        },
        setItem(key, value) {
            storage[key] = value;
        }
    };

    try {
        return fn(storage);
    } finally {
        if (previousLocalStorage === undefined) {
            delete globalThis.localStorage;
        } else {
            globalThis.localStorage = previousLocalStorage;
        }
    }
}

test('pointSize zero is preserved for point-like objects', () => {
    assert.equal(new GeoObject(ObjectType.POINT, { pointSize: 0 }).pointSize, 0);
    assert.equal(new CircleCenterPoint('circle_1', { pointSize: 0 }).pointSize, 0);
});

test('ObjectManager applies label-only default to new point-like creations', () => {
    const objectManager = new ObjectManager();
    objectManager.setDefaultPointParams({ pointSize: 0, color: '#000000', fontSize: 14 });

    const point = objectManager.createPoint(1, 2);
    assert.equal(point.pointSize, 0);
    assert.equal(point.showLabel, true);

    const explicitPoint = objectManager.createPoint(3, 4, { pointSize: 7 });
    assert.equal(explicitPoint.pointSize, 7);
});

test('SettingsManager persists label-only new-point default separately from show-all', () => {
    withMockStorage(undefined, (storage) => {
        const settings = new SettingsManager();

        assert.equal(settings.hideNewPointBodies, false);
        assert.deepEqual(settings.getDefaultPointParams(), {
            pointSize: 4,
            color: '#000000'
        });

        settings.setHideNewPointBodies(true);
        assert.equal(settings.getDefaultPointParams().pointSize, 0);

        const saved = JSON.parse(storage.graphA_settings);
        assert.equal(saved.hideNewPointBodies, true);
    });
});

test('SettingsManager controls default and bulk point size without touching non-points', () => {
    withMockStorage(undefined, () => {
        const settings = new SettingsManager();
        const objectManager = new ObjectManager();

        settings.setDefaultPointSize(9);
        objectManager.setDefaultPointParams(settings.getDefaultPointParams());

        const pointA = objectManager.createPoint(0, 0);
        const pointB = objectManager.createPoint(1, 0);
        const segment = objectManager.createSegment(pointA.id, pointB.id);

        assert.equal(pointA.pointSize, 9);
        assert.equal(pointB.pointSize, 9);
        assert.equal(settings.normalizePointSize(-4), 0);
        assert.equal(settings.normalizePointSize(40), 30);

        const changedCount = settings.applyPointSizeToAll(objectManager, 12);

        assert.equal(changedCount, 2);
        assert.equal(pointA.pointSize, 12);
        assert.equal(pointB.pointSize, 12);
        assert.equal(segment.pointSize, 6);
    });
});

test('drawPoint does not draw a point body or border for radius zero', () => {
    const calls = [];
    const fakeContext = {
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
    canvas.ctx = fakeContext;
    canvas.toScreen = (point) => point;

    canvas.drawPoint(new Vec2(1, 2), { radius: 0, color: '#000000' });
    assert.deepEqual(calls, []);
});
