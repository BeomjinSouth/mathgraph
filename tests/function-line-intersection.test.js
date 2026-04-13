import assert from 'node:assert/strict';
import test from 'node:test';

import { IntersectionPoint } from '../js/objects/Point.js';
import { Vec2 } from '../js/utils/Geometry.js';
import { ObjectType } from '../js/objects/GeoObject.js';

function createIntersectionPoint() {
    return new IntersectionPoint('function_1', 'line_1');
}

test('function-line intersection resolves a vertical line segment', () => {
    const intersectionPoint = createIntersectionPoint();
    const funcObj = {
        getFunction() {
            return (x) => x * x;
        },
        xMin: null,
        xMax: null
    };
    const lineObj = {
        type: ObjectType.SEGMENT,
        getPoint1() {
            return new Vec2(2, 0);
        },
        getPoint2() {
            return new Vec2(2, 6);
        }
    };

    const intersections = intersectionPoint.functionLineIntersection(funcObj, lineObj);

    assert.equal(intersections.length, 1);
    assert.equal(intersections[0].x, 2);
    assert.equal(intersections[0].y, 4);
});

test('function-line intersection finds both crossings for a horizontal line', () => {
    const intersectionPoint = createIntersectionPoint();
    const funcObj = {
        getFunction() {
            return (x) => x * x;
        },
        xMin: null,
        xMax: null
    };
    const lineObj = {
        type: ObjectType.LINE,
        getPoint1() {
            return new Vec2(-2, 1);
        },
        getPoint2() {
            return new Vec2(2, 1);
        }
    };

    const intersections = intersectionPoint.functionLineIntersection(funcObj, lineObj);

    assert.equal(intersections.length, 2);
    assert.ok(Math.abs(intersections[0].x + 1) < 1e-4 || Math.abs(intersections[1].x + 1) < 1e-4);
    assert.ok(Math.abs(intersections[0].x - 1) < 1e-4 || Math.abs(intersections[1].x - 1) < 1e-4);
    assert.ok(intersections.every(point => Math.abs(point.y - 1) < 1e-4));
});
