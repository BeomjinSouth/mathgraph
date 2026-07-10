import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCurvedSolidInput } from '../js/utils/CurvedSolidInput.js';

test('curved solid input normalizes the teacher dialog values', () => {
    assert.deepEqual(buildCurvedSolidInput({
        kind: 'cone',
        x: '1.5',
        y: '-2',
        width: '4',
        height: '7',
        ellipseRatio: '0.3',
        showHiddenLines: true
    }), {
        kind: 'cone',
        x: 1.5,
        y: -2,
        width: 4,
        height: 7,
        ellipseRatio: 0.3,
        showHiddenLines: true
    });
});

test('curved solid input rejects unknown kinds and non-positive dimensions', () => {
    assert.throws(
        () => buildCurvedSolidInput({ kind: 'torus', x: 0, y: 0, width: 4, height: 4 }),
        /지원하지 않는 곡면 입체/
    );
    assert.throws(
        () => buildCurvedSolidInput({ kind: 'sphere', x: 0, y: 0, width: 0, height: 4 }),
        /너비와 높이/
    );
});
