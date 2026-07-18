import assert from 'node:assert/strict';
import test from 'node:test';

import { NumberLine } from '../js/objects/NumberLine.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';

function createRecordingCanvas() {
    const calls = [];
    const ctx = {
        strokeStyle: '#000000',
        fillStyle: '#000000',
        lineWidth: 1,
        font: '',
        textAlign: '',
        textBaseline: '',
        beginPath() { calls.push(['beginPath']); },
        moveTo(x, y) { calls.push(['moveTo', x, y]); },
        lineTo(x, y) { calls.push(['lineTo', x, y]); },
        arc(x, y, radius, start, end) { calls.push(['arc', x, y, radius, start, end]); },
        stroke() { calls.push(['stroke']); },
        fill() { calls.push(['fill']); },
        fillText(text, x, y) { calls.push(['fillText', text, x, y]); }
    };

    return {
        ctx,
        calls,
        toScreen(point) { return { x: point.x * 10, y: point.y * -10 }; },
        toScreenLength(length) { return length * 10; }
    };
}

test('NumberLine renders open endpoints hollow and closed endpoints filled', () => {
    const line = new NumberLine({
        start: -2,
        end: 2,
        step: 1,
        showArrows: false,
        customMarks: [
            { value: -1, endpoint: 'open' },
            { value: 1, endpoint: 'closed' }
        ]
    });
    const canvas = createRecordingCanvas();

    line.render(canvas);

    const arcs = canvas.calls.filter(call => call[0] === 'arc');
    const fills = canvas.calls.filter(call => call[0] === 'fill');
    assert.equal(arcs.length, 2);
    assert.equal(fills.length, 1);
    assert.deepEqual(line.toJSON().customMarks, [
        { value: -1, endpoint: 'open' },
        { value: 1, endpoint: 'closed' }
    ]);
});

test('SchemaValidator rejects unsupported number-line endpoint values', () => {
    const validator = new SchemaValidator();
    const valid = validator.parseAndValidate({
        operations: [{
            op: 'create', type: 'numberLine', start: -2, end: 2, step: 1, y: 0,
            customMarks: [{ value: -1, endpoint: 'open' }, { value: 1, endpoint: 'closed' }]
        }]
    });
    assert.equal(valid.valid, true, valid.errors.join('\n'));

    const invalid = validator.parseAndValidate({
        operations: [{
            op: 'create', type: 'numberLine', start: -2, end: 2, step: 1, y: 0,
            customMarks: [{ value: 0, endpoint: 'half-open' }]
        }]
    });
    assert.equal(invalid.valid, false);
    assert.match(invalid.errors.join('\n'), /endpoint/);
});
