import assert from 'node:assert/strict';
import test from 'node:test';

import { FunctionParser } from '../js/utils/Parser.js';

test('function parser treats -x^2 as the negated square', () => {
    const fn = FunctionParser.parse('-x^2 + 4');

    assert.equal(fn(0), 4);
    assert.equal(fn(2), 0);
    assert.equal(fn(-2), 0);
});

test('function parser preserves explicit parentheses around negative bases', () => {
    const fn = FunctionParser.parse('(-x)^2 + 4');

    assert.equal(fn(0), 4);
    assert.equal(fn(2), 8);
    assert.equal(fn(-2), 8);
});

test('function parser still supports negative exponents', () => {
    const fn = FunctionParser.parse('2^-2 + x^-1');

    assert.equal(fn(2), 0.75);
});

test('function parser keeps implicit multiplication with negative coefficients', () => {
    const fn = FunctionParser.parse('-3/8x^2 + 6');

    assert.equal(fn(0), 6);
    assert.equal(fn(2), 4.5);
});
