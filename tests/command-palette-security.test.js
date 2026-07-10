import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAlgebraHintMarkup, highlightCommandMatch } from '../js/ui/CommandPalette.js';

test('algebra hint escapes attacker-controlled query text', () => {
    const markup = buildAlgebraHintMarkup('<img src=x onerror="globalThis.pwned=1">');
    assert.doesNotMatch(markup, /<img\b/i);
    assert.match(markup, /&lt;img/);
});

test('command highlighting treats regex syntax as literal text', () => {
    assert.equal(highlightCommandMatch('a+b command', 'a+b'), '<mark>a+b</mark> command');
});
