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
        closePath() {
            calls.push(['closePath']);
        },
        stroke() {
            calls.push(['stroke']);
        },
        fill() {
            calls.push(['fill']);
        },
        fillText(text, x, y) {
            calls.push(['fillText', text, x, y]);
        },
        save() {
            calls.push(['save']);
        },
        restore() {
            calls.push(['restore']);
        },
        measureText(text) {
            return { width: String(text).length || 1 };
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

test('fixed axis number interval also fixes grid spacing regardless of zoom', () => {
    const canvas = createCanvasFacade();

    canvas.axisNumberInterval = '1';
    canvas.scale = 500;
    assert.equal(canvas.getGridGap(), 1);

    canvas.scale = 5;
    assert.equal(canvas.getGridGap(), 1);

    canvas.axisNumberInterval = '0.5';
    assert.equal(canvas.getGridGap(), 0.5);
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

    const renderedText = canvas.ctx.calls
        .filter(call => call[0] === 'fillText')
        .map(call => call[1]);

    const mathFonts = canvas.ctx.calls
        .filter(call => call[0] === 'font')
        .map(call => call[1]);

    assert.ok(renderedText.includes('1'));
    assert.ok(renderedText.includes('\u2212'));
    assert.equal(renderedText.includes('-'), false);
    assert.ok(mathFonts.some(font => font.includes('"Times New Roman"')));
});

test('axes render filled arrowheads and italic axis-name labels', () => {
    const canvas = createCanvasFacade();

    canvas.drawAxes();

    const fillTexts = canvas.ctx.calls
        .filter(call => call[0] === 'fillText')
        .map(call => call[1]);
    const fonts = canvas.ctx.calls
        .filter(call => call[0] === 'font')
        .map(call => call[1]);
    const xAxisLineIndex = canvas.ctx.calls.findIndex(call => (
        call[0] === 'moveTo' &&
        call[1] === 0 &&
        call[2] === 100
    ));
    const xArrowIndex = canvas.ctx.calls.findIndex(call => (
        call[0] === 'moveTo' &&
        call[1] === 199 &&
        call[2] === 100
    ));
    const yAxisLineIndex = canvas.ctx.calls.findIndex(call => (
        call[0] === 'moveTo' &&
        call[1] === 100 &&
        call[2] === 14
    ));
    const yArrowIndex = canvas.ctx.calls.findIndex(call => (
        call[0] === 'moveTo' &&
        call[1] === 100 &&
        call[2] === 1
    ));

    assert.ok(canvas.ctx.calls.filter(call => call[0] === 'fill').length >= 2);
    assert.deepEqual(canvas.ctx.calls[xAxisLineIndex + 1], ['lineTo', 186, 100]);
    assert.deepEqual(canvas.ctx.calls.slice(xArrowIndex, xArrowIndex + 3), [
        ['moveTo', 199, 100],
        ['lineTo', 186, 95.8],
        ['lineTo', 186, 104.2]
    ]);
    assert.deepEqual(canvas.ctx.calls[yAxisLineIndex + 1], ['lineTo', 100, 200]);
    assert.deepEqual(canvas.ctx.calls.slice(yArrowIndex, yArrowIndex + 3), [
        ['moveTo', 100, 1],
        ['lineTo', 95.8, 14],
        ['lineTo', 104.2, 14]
    ]);
    assert.ok(fillTexts.includes('x'));
    assert.ok(fillTexts.includes('y'));
    assert.ok(fonts.some(font => font.includes('italic 22px')));
});
