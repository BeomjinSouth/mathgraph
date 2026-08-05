import assert from 'node:assert/strict';
import test from 'node:test';

import { enhanceDiagramQuality } from '../js/ai/DiagramQualityEnhancer.js';
import { FunctionGraph } from '../js/objects/Function.js';
import { Vec2 } from '../js/utils/Geometry.js';

function reportedInverseFunctionOperations() {
    return [
        { op: 'create', id: 'f', type: 'function', expression: 'sqrt(x-2)', label: 'f', xMin: 2, xMax: 8 },
        { op: 'create', id: 'inverse', type: 'function', expression: 'x^2+2', label: 'f^-1', xMin: 0, xMax: 4 },
        { op: 'create', id: 'lineStart', type: 'point', x: 0, y: 4, visible: false, showLabel: false },
        { op: 'create', id: 'lineEnd', type: 'point', x: 4, y: 0, visible: false, showLabel: false },
        { op: 'create', id: 'line', type: 'line', point1Id: 'lineStart', point2Id: 'lineEnd', label: 'l' },
        { op: 'create', id: 'P', type: 'intersection', object1Id: 'f', object2Id: 'line', branch: 0, label: 'P' },
        { op: 'create', id: 'Q', type: 'intersection', object1Id: 'inverse', object2Id: 'line', branch: 0, label: 'Q' }
    ];
}

test('AI quality pass moves function formulas away from named function-line intersections', () => {
    const enhanced = enhanceDiagramQuality({ operations: reportedInverseFunctionOperations() });
    const functions = enhanced.operations.filter(operation => operation.type === 'function');
    const pointP = { x: 3, y: 1 };
    const pointQ = { x: 1, y: 3 };

    assert.equal(functions.length, 2);
    for (const operation of functions) {
        assert.ok(Number.isFinite(operation.labelMathPos?.x));
        assert.ok(Number.isFinite(operation.labelMathPos?.y));
        assert.ok(Math.hypot(operation.labelMathPos.x - pointP.x, operation.labelMathPos.y - pointP.y) > 1.2);
        assert.ok(Math.hypot(operation.labelMathPos.x - pointQ.x, operation.labelMathPos.y - pointQ.y) > 1.2);
    }
    assert.ok(
        Math.hypot(
            functions[0].labelMathPos.x - functions[1].labelMathPos.x,
            functions[0].labelMathPos.y - functions[1].labelMathPos.y
        ) > 1.2,
        'function labels should not reuse the same crowded anchor'
    );
});

test('AI quality pass preserves a deliberately pinned function label', () => {
    const pinned = { x: -4, y: 5 };
    const enhanced = enhanceDiagramQuality({
        operations: [
            { op: 'create', id: 'f', type: 'function', expression: 'x^2', label: 'f', labelMathPos: pinned },
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, label: 'A' }
        ]
    });
    assert.deepEqual(enhanced.operations[0].labelMathPos, pinned);
});

test('automatic function anchors do not disable labelOffset or become pinned state', () => {
    const fn = new FunctionGraph('x^2', {
        label: 'f',
        labelOffset: { x: 24, y: -16 }
    });
    const canvas = {
        getVisibleBounds: () => ({ minX: -5, maxX: 5, minY: -5, maxY: 5 }),
        toScreen: point => new Vec2(250 + point.x * 50, 250 - point.y * 50),
        ctx: {
            measureText: text => ({ width: String(text).length * 8 })
        }
    };

    const position = fn.getLabelPosition(canvas);
    const bounds = fn.getLabelBounds(canvas);

    assert.ok(Number.isFinite(position.x));
    assert.ok(Number.isFinite(position.y));
    assert.equal(fn._labelMathPos, null);
    assert.ok(bounds.x > 250, 'positive labelOffset.x should move the automatic label right');
});

test('automatic function labels find a visible domain point when the viewport center is undefined', () => {
    const fn = new FunctionGraph('sqrt(x-2)', { label: 'f' });
    const canvas = {
        getVisibleBounds: () => ({ minX: -8, maxX: 8, minY: -5, maxY: 5 })
    };

    const position = fn.getLabelPosition(canvas);

    assert.ok(position);
    assert.ok(position.x >= 2);
    assert.ok(Number.isFinite(position.y));
});
