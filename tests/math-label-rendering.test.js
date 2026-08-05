import assert from 'node:assert/strict';
import test from 'node:test';

import { Canvas } from '../js/core/Canvas.js';

function createCanvasFacade() {
    return Object.create(Canvas.prototype);
}

function createRecordingContext() {
    const calls = [];

    return {
        calls,
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
        },
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
        measureText(text) {
            return { width: String(text).length || 1 };
        }
    };
}

test('math label parsing uses a mathematical minus glyph for display', () => {
    const canvas = createCanvasFacade();
    const parts = canvas.parseMathExpression('y = -(x+2)^2 + 3');

    assert.deepEqual(parts, [
        { type: 'normal', text: 'y = \u2212(x+2)' },
        { type: 'super', text: '2' },
        { type: 'normal', text: ' + 3' }
    ]);
});

test('minus normalization also applies inside superscripts and subtraction', () => {
    const canvas = createCanvasFacade();
    const parts = canvas.parseMathExpression('x^{-2} - 4');

    assert.deepEqual(parts, [
        { type: 'normal', text: 'x' },
        { type: 'super', text: '\u22122' },
        { type: 'normal', text: ' \u2212 4' }
    ]);
});

test('math label rendering never draws ASCII hyphen-minus for minus signs', () => {
    const canvas = createCanvasFacade();
    const ctx = createRecordingContext();
    const parts = canvas.parseMathExpression('y=-(x+2)');

    canvas.renderMathExpression(parts, ctx, 0, 0, 30, '#000000');

    const renderedText = ctx.calls
        .filter(call => call[0] === 'fillText')
        .map(call => call[1]);

    assert.ok(renderedText.includes('\u2212'));
    assert.equal(renderedText.includes('-'), false);
});

test('math label parsing turns slash coefficient fractions into fraction parts', () => {
    const canvas = createCanvasFacade();
    const parts = canvas.parseMathExpression('y=-3/8x^2+6');

    assert.deepEqual(parts, [
        { type: 'normal', text: 'y=\u2212' },
        {
            type: 'fraction',
            numerator: [{ type: 'normal', text: '3' }],
            denominator: [{ type: 'normal', text: '8' }]
        },
        { type: 'normal', text: 'x' },
        { type: 'super', text: '2' },
        { type: 'normal', text: '+6' }
    ]);
});

test('math label parsing supports latex frac groups', () => {
    const canvas = createCanvasFacade();
    const parts = canvas.parseMathExpression('y=\\frac{x^2+1}{x-1}');

    assert.deepEqual(parts, [
        { type: 'normal', text: 'y=' },
        {
            type: 'fraction',
            numerator: [
                { type: 'normal', text: 'x' },
                { type: 'super', text: '2' },
                { type: 'normal', text: '+1' }
            ],
            denominator: [{ type: 'normal', text: 'x\u22121' }]
        }
    ]);
});

test('math label rendering draws a fraction bar instead of slash text', () => {
    const canvas = createCanvasFacade();
    const ctx = createRecordingContext();
    const parts = canvas.parseMathExpression('y=-3/8x^2+6');

    canvas.renderMathExpression(parts, ctx, 0, 0, 30, '#000000');

    const renderedText = ctx.calls
        .filter(call => call[0] === 'fillText')
        .map(call => call[1]);

    assert.equal(renderedText.includes('/'), false);
    assert.ok(renderedText.includes('3'));
    assert.ok(renderedText.includes('8'));
    assert.ok(ctx.calls.some(call => call[0] === 'lineTo'));
});

test('math label parsing turns sqrt syntax into a radical part', () => {
    const canvas = createCanvasFacade();
    const parts = canvas.parseMathExpression('f(x)=sqrt(x-2)');

    assert.deepEqual(parts, [
        { type: 'normal', text: 'f(x)=' },
        {
            type: 'radical',
            radicand: [{ type: 'normal', text: 'x\u22122' }]
        }
    ]);
});

test('math label rendering draws one continuous radical path and never prints sqrt', () => {
    const canvas = createCanvasFacade();
    const ctx = createRecordingContext();
    const parts = canvas.parseMathExpression('f(x)=sqrt(x-2)');

    canvas.renderMathExpression(parts, ctx, 0, 0, 30, '#000000');

    const renderedText = ctx.calls
        .filter(call => call[0] === 'fillText')
        .map(call => call[1]);
    assert.equal(renderedText.includes('\u221a'), false, 'do not splice a font glyph onto a separate overbar');
    assert.equal(renderedText.some(text => String(text).toLowerCase().includes('sqrt')), false);
    assert.ok(
        ctx.calls.filter(call => call[0] === 'lineTo').length >= 4,
        'radical hook and overbar should be a single continuous path'
    );
});

test('latex sqrt groups use the same radical rendering structure', () => {
    const canvas = createCanvasFacade();
    const parts = canvas.parseMathExpression('y=\\sqrt{x+1}');

    assert.equal(parts[1].type, 'radical');
    assert.deepEqual(parts[1].radicand, [{ type: 'normal', text: 'x+1' }]);
});
