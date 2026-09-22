import test from 'node:test';
import assert from 'node:assert/strict';
import { toHwpEquationLabel } from '../js/utils/HwpDiagram.js';

test('point labels are sent to Hancom as upright equations while variables remain italic', () => {
    assert.equal(toHwpEquationLabel('A'), '\\mathrm{A}');
    assert.equal(toHwpEquationLabel("A'"), "\\mathrm{A'}");
    assert.equal(toHwpEquationLabel('x', { italic: true }), 'x');
    assert.equal(toHwpEquationLabel('AB+x'), 'AB+x');
});
