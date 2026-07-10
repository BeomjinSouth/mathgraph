import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeDrawingSupport } from '../js/ai/SupportPreflight.js';

test('statistical chart requests are explicitly excluded', () => {
    const result = analyzeDrawingSupport('상자그림과 산점도를 그려줘');
    assert.equal(result.status, 'excluded');
    assert.deepEqual(result.excluded, ['boxPlot', 'scatterPlot']);
    assert.match(result.message, /지원하지/);
});

test('curved solid requests are supported', () => {
    const result = analyzeDrawingSupport('원기둥과 원뿔을 그려줘');
    assert.equal(result.status, 'supported');
    assert.deepEqual(result.supported, ['cylinder', 'cone']);
    assert.deepEqual(result.excluded, []);
});

test('known approximations are disclosed before generation', () => {
    const result = analyzeDrawingSupport('두 원 사이의 고리 부채꼴을 그려줘');
    assert.equal(result.status, 'approximated');
    assert.deepEqual(result.approximated, ['annularSector']);
    assert.match(result.message, /근사/);
});
