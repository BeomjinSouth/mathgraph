import assert from 'node:assert/strict';
import test from 'node:test';

import { Canvas } from '../js/core/Canvas.js';
import { FunctionGraph } from '../js/objects/Function.js';
import { Vec2 } from '../js/utils/Geometry.js';

function createRecordingCanvas() {
    const calls = [];
    const canvas = Object.create(Canvas.prototype);
    canvas.width = 400;
    canvas.height = 400;
    canvas.scale = 50;
    canvas.offset = new Vec2(0, 0);
    canvas.ctx = {
        calls,
        beginPath() {
            calls.push(['beginPath']);
        },
        moveTo(x, y) {
            calls.push(['point', x, y]);
        },
        lineTo(x, y) {
            calls.push(['point', x, y]);
        },
        stroke() {
            calls.push(['stroke']);
        },
        setLineDash(value) {
            calls.push(['setLineDash', value]);
        },
        set strokeStyle(value) {
            calls.push(['strokeStyle', value]);
        },
        set lineWidth(value) {
            calls.push(['lineWidth', value]);
        },
        set lineCap(value) {
            calls.push(['lineCap', value]);
        },
        set lineJoin(value) {
            calls.push(['lineJoin', value]);
        }
    };
    return canvas;
}

test('canvas function rendering clips visible samples by y range', () => {
    const canvas = createRecordingCanvas();

    canvas.drawFunction((x) => x, {
        samples: 200,
        xMin: -2,
        xMax: 2,
        yMin: 0,
        yMax: 1
    });

    const mathPoints = canvas.ctx.calls
        .filter(call => call[0] === 'point')
        .map(([, x, y]) => canvas.toMath(new Vec2(x, y)));

    assert.ok(mathPoints.length > 0);
    assert.ok(mathPoints.every(point => point.y >= -1e-9 && point.y <= 1 + 1e-9));
    assert.ok(mathPoints.every(point => point.x >= -1e-9 && point.x <= 1 + 1e-9));
});

test('FunctionGraph persists x and y range limits', () => {
    const func = new FunctionGraph('x^2', {
        xMin: -1,
        xMax: 2,
        yMin: 0,
        yMax: 3
    });

    const json = func.toJSON();
    assert.equal(json.xMin, -1);
    assert.equal(json.xMax, 2);
    assert.equal(json.yMin, 0);
    assert.equal(json.yMax, 3);

    const restored = FunctionGraph.fromJSON(json);
    assert.equal(restored.xMin, -1);
    assert.equal(restored.xMax, 2);
    assert.equal(restored.yMin, 0);
    assert.equal(restored.yMax, 3);
});

test('FunctionGraph hit testing ignores points outside y range', () => {
    const func = new FunctionGraph('x', {
        showLabel: false,
        yMin: 0,
        yMax: 1
    });
    const canvas = {
        toMathLength() {
            return 0.1;
        }
    };

    assert.equal(func.hitTest(new Vec2(0.5, 0.5), 5, canvas), true);
    assert.equal(func.hitTest(new Vec2(2, 2), 5, canvas), false);
});
