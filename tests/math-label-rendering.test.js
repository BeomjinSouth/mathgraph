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
        set textAlign(value) {
            calls.push(['textAlign', value]);
        },
        set textBaseline(value) {
            calls.push(['textBaseline', value]);
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
