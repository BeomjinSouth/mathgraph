import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeDrawingSupport } from '../js/ai/SupportPreflight.js';

test('statistical chart requests have dedicated editable support', () => {
    const result = analyzeDrawingSupport('상자그림과 산점도를 그려줘');
    assert.equal(result.status, 'supported');
    assert.ok(result.supported.includes('boxPlot') && result.supported.includes('scatterPlot'));
    assert.deepEqual(result.excluded, []);
});

test('basic statistical chart families are supported', () => {
    const result = analyzeDrawingSupport('막대그래프와 원그래프를 시험지 그림으로 만들어줘');
    assert.equal(result.status, 'supported');
    assert.ok(result.supported.includes('barChart') && result.supported.includes('pieChart'));
    assert.deepEqual(result.excluded, []);
});

test('curved solid requests are supported', () => {
    const result = analyzeDrawingSupport('원기둥과 원뿔을 그려줘');
    assert.equal(result.status, 'supported');
    assert.deepEqual(result.supported, ['cylinder', 'cone']);
    assert.deepEqual(result.excluded, []);
});

test('annular sectors are exact and sphere nets remain excluded', () => {
    const result = analyzeDrawingSupport('두 원 사이의 고리 부채꼴을 그려줘');
    assert.equal(result.status, 'supported');
    assert.ok(result.supported.includes('annularSector'));
    assert.deepEqual(result.approximated, []);
    assert.equal(analyzeDrawingSupport('구의 전개도').status, 'excluded');
});
