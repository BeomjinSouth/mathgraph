import assert from 'node:assert/strict';
import test from 'node:test';

import { FunctionGraph } from '../js/objects/Function.js';
import { AngleDimension, LengthDimension } from '../js/objects/Dimension.js';
import { Vec2 } from '../js/utils/Geometry.js';

test('function with a dragged label survives save/load as a Vec2 (no clone crash)', () => {
    const fn = new FunctionGraph('y = x^2');
    fn._labelMathPos = new Vec2(2.5, 3.5);

    // 저장 → JSON 직렬화/역직렬화 왕복
    const json = JSON.parse(JSON.stringify(fn.toJSON()));
    const restored = FunctionGraph.fromJSON(json);

    // getLabelPosition은 내부에서 clone()을 호출하므로 평범한 객체면 던진다.
    let position;
    assert.doesNotThrow(() => { position = restored.getLabelPosition(); });
    assert.equal(typeof restored._labelMathPos.clone, 'function', 'label pos must be a Vec2 after load');
    assert.equal(position.x, 2.5);
    assert.equal(position.y, 3.5);
});

test('function without a dragged label round-trips to null label position', () => {
    const fn = new FunctionGraph('y = x^2');
    const json = JSON.parse(JSON.stringify(fn.toJSON()));
    const restored = FunctionGraph.fromJSON(json);
    assert.equal(restored._labelMathPos, null);
});

test('angle dimension label offset survives load as a Vec2 (drag does not crash)', () => {
    const dim = new AngleDimension('v', 'p1', 'p2', { labelOffset: new Vec2(4, -6) });
    const json = JSON.parse(JSON.stringify(dim.toJSON()));
    const restored = new AngleDimension(json.vertexId, json.point1Id, json.point2Id, json);

    assert.equal(typeof restored.labelOffset.clone, 'function', 'labelOffset must be a Vec2 after load');
    assert.equal(restored.labelOffset.x, 4);
    assert.equal(restored.labelOffset.y, -6);
    assert.doesNotThrow(() => restored.labelOffset.clone());
});

test('length dimension label offset survives load as a Vec2 (drag does not crash)', () => {
    const dim = new LengthDimension('seg', { label: 'x', curvature: -28, labelOffset: new Vec2(-3, 8) });
    const json = JSON.parse(JSON.stringify(dim.toJSON()));
    const restored = new LengthDimension(json.segmentId, json);

    assert.equal(typeof restored.labelOffset.clone, 'function', 'labelOffset must be a Vec2 after load');
    assert.equal(restored.labelOffset.x, -3);
    assert.equal(restored.labelOffset.y, 8);
    assert.equal(restored.customText, 'x');
    assert.equal(restored.curvature, -28);
    assert.doesNotThrow(() => restored.labelOffset.clone());
});
