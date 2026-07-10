import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeHtml, escapeRegExp } from '../js/utils/Html.js';

test('escapeHtml neutralizes attribute-breaking payloads', () => {
    const payload = '"><img src=x onerror=alert(1)>';
    const escaped = escapeHtml(payload);
    assert.ok(!escaped.includes('<img'));
    assert.ok(!escaped.includes('">'));
    assert.equal(escaped, '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;');
});

test('escapeHtml escapes all HTML-significant characters', () => {
    assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('escapeHtml returns an empty string for null/undefined', () => {
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
});

test('escapeHtml stringifies non-string values', () => {
    assert.equal(escapeHtml(42), '42');
    assert.equal(escapeHtml(0), '0');
});

test('escapeRegExp neutralizes regex metacharacters', () => {
    assert.equal(escapeRegExp('a+b?(c)[d]'), 'a\\+b\\?\\(c\\)\\[d\\]');
});
