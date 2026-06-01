import assert from 'node:assert/strict';
import test from 'node:test';

import { Canvas } from '../js/core/Canvas.js';
import { Vec2 } from '../js/utils/Geometry.js';

function createCanvasFacade() {
    const calls = [];
    const canvas = Object.create(Canvas.prototype);
    canvas.width = 200;
    canvas.height = 200;
    canvas.scale = 50;
    canvas.offset = new Vec2(0, 0);
    canvas.showXAxis = true;
    canvas.showYAxis = true;
    canvas.showAxisNumbers = true;
    canvas.axisNumberInterval = 'auto';
    canvas.ctx = {
        calls,
        beginPath() {
            calls.push(['beginPath']);
        },
        moveTo(x, y) {
            calls.push(['moveTo', x, y]);
        },
        lineTo(x, y) {
            calls.push(['lineTo', x, y]);
        },
        stroke() {
            calls.push(['stroke']);
        },
        fillText(text, x, y) {
            calls.push(['fillText', text, x, y]);
        },
        set font(value) {
            calls.push(['font', value]);
        },
        set fillStyle(value) {
            calls.push(['fillStyle', value]);
        },
        set strokeStyle(value) {
            calls.push(['strokeStyle', value]);
        },
        set lineWidth(value) {
            calls.push(['lineWidth', value]);
        },
        set textAlign(value) {
            calls.push(['textAlign', value]);
        },
        set textBaseline(value) {
            calls.push(['textBaseline', value]);
        }
    };
    return canvas;
}

test('axis number interval can stay fixed regardless of zoom', () => {
    const canvas = createCanvasFacade();

    canvas.scale = 500;
    canvas.axisNumberInterval = '1';
    assert.equal(canvas.getAxisNumberGap(), 1);

    canvas.scale = 5;
    canvas.axisNumberInterval = '0.1';
    assert.equal(canvas.getAxisNumberGap(), 0.1);
});

test('automatic axis number interval still follows zoom scale', () => {
    const canvas = createCanvasFacade();

    canvas.axisNumberInterval = 'auto';
    canvas.scale = 50;
    assert.equal(canvas.getAxisNumberGap(), 2);

    canvas.scale = 250;
    assert.equal(canvas.getAxisNumberGap(), 0.5);
});

test('axis numbers can be hidden while axis tick marks remain', () => {
    const canvas = createCanvasFacade();
    canvas.axisNumberInterval = '1';
    canvas.showAxisNumbers = false;

    canvas.drawAxisLabels();

    assert.equal(canvas.ctx.calls.some(call => call[0] === 'fillText'), false);
    assert.ok(canvas.ctx.calls.some(call => call[0] === 'stroke'));
});

test('axis numbers render with the selected fixed interval', () => {
    const canvas = createCanvasFacade();
    canvas.axisNumberInterval = '1';

    canvas.drawAxisLabels();

    const labels = canvas.ctx.calls
        .filter(call => call[0] === 'fillText')
        .map(call => call[1]);

    assert.ok(labels.includes('1'));
    assert.ok(labels.includes('-1'));
});
