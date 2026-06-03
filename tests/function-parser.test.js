import assert from 'node:assert/strict';
import test from 'node:test';

import { ObjectManager } from '../js/core/ObjectManager.js';
import { FunctionGraph } from '../js/objects/Function.js';
import { AlgebraInput } from '../js/ui/AlgebraInput.js';
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

test('FunctionGraph accepts y equals input while storing the right-hand side', () => {
    const func = new FunctionGraph('y = x^2 - 2*x + 1');

    assert.equal(func.valid, true);
    assert.equal(func.expression, 'x^2 - 2*x + 1');
    assert.equal(func.label, 'y = x^2 - 2*x + 1');
    assert.equal(func.getLabelText(), 'y = x^2 - 2*x + 1');
    assert.equal(func.evaluate(2), 1);
});

test('FunctionGraph accepts named function equation input', () => {
    const func = new FunctionGraph('g(x)=2x+1');

    assert.equal(func.valid, true);
    assert.equal(func.expression, '2x+1');
    assert.equal(func.label, 'g');
    assert.equal(func.getLabelText(), 'g(x) = 2x+1');
    assert.equal(func.evaluate(3), 7);
});

test('FunctionGraph setExpression can switch to y equals notation', () => {
    const func = new FunctionGraph('x^2');

    func.setExpression('y = x + 1');
    assert.equal(func.valid, true);
    assert.equal(func.expression, 'x + 1');
    assert.equal(func.label, 'y = x + 1');

    func.setExpression('x^2 + 3');
    assert.equal(func.expression, 'x^2 + 3');
    assert.equal(func.label, 'y = x^2 + 3');
});

test('AlgebraInput keeps y equals labels for created functions', () => {
    const objectManager = new ObjectManager();
    const algebraInput = new AlgebraInput(objectManager);

    const result = algebraInput.parse('y=x^2');

    assert.equal(result.success, true);
    assert.equal(result.object.expression, 'x^2');
    assert.equal(result.object.label, 'y = x^2');
    assert.equal(result.object.valid, true);
});
