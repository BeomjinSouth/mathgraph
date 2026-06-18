import assert from 'node:assert/strict';
import test from 'node:test';

import { Canvas } from '../js/core/Canvas.js';
import { Vec2 } from '../js/utils/Geometry.js';
import { compileSceneGraph } from '../js/ai/SceneGraphCompiler.js';

function createCanvasFacade() {
    const canvas = Object.create(Canvas.prototype);
    canvas.ctx = createRecordingContext();
    canvas.toScreen = (point) => ({ x: point.x, y: point.y });
    canvas.getVisibleBounds = () => ({ minX: -1, maxX: 1, minY: -1, maxY: 1 });
    return canvas;
}

function createRecordingContext() {
    const calls = [];
    return {
        calls,
        set strokeStyle(value) { calls.push(['strokeStyle', value]); },
        set fillStyle(value) { calls.push(['fillStyle', value]); },
        set lineWidth(value) { calls.push(['lineWidth', value]); },
        set lineCap(value) { calls.push(['lineCap', value]); },
        beginPath() { calls.push(['beginPath']); },
        moveTo(x, y) { calls.push(['moveTo', x, y]); },
        lineTo(x, y) { calls.push(['lineTo', x, y]); },
        closePath() { calls.push(['closePath']); },
        stroke() { calls.push(['stroke']); },
        fill() { calls.push(['fill']); },
        setLineDash(pattern) { calls.push(['setLineDash', [...pattern]]); }
    };
}

test('ray canvas rendering draws a filled triangular arrowhead', () => {
    const canvas = createCanvasFacade();

    canvas.drawRay(new Vec2(0, 0), new Vec2(1, 0), { color: '#111111' });

    const calls = canvas.ctx.calls;
    assert.ok(calls.some(call => call[0] === 'stroke'));
    assert.ok(calls.some(call => call[0] === 'fill'));
    assert.deepEqual(
        calls.filter(call => call[0] === 'moveTo').at(-1),
        ['moveTo', 1, 0]
    );
    assert.ok(calls.some(call => call[0] === 'closePath'));
});

test('SVG export renders rays with the same polygon arrowhead path used for vectors', async () => {
    globalThis.window = {};
    globalThis.document = {
        addEventListener() {}
    };
    const { default: GraphAApp } = await import('../js/main.js');
    const app = Object.create(GraphAApp.prototype);
    app.canvas = {
        toScreen: (point) => ({ x: point.x, y: point.y }),
        getVisibleBounds: () => ({ minX: -1, maxX: 1, minY: -1, maxY: 1 }),
        getRayEndPoint: Canvas.prototype.getRayEndPoint
    };
    const ray = {
        id: 'ray_AB',
        type: 'ray',
        color: '#000000',
        lineWidth: 2,
        getPoint1: () => new Vec2(0, 0),
        getPoint2: () => new Vec2(1, 0)
    };

    const markup = app.buildSVGObjectMarkup(ray);

    assert.match(markup, /data-type="ray"/);
    assert.match(markup, /<line\b/);
    assert.match(markup, /x2="1\.00"/);
    assert.match(markup, /<polygon\b/);
});

test('scene graph arrow aliases compile to vector operations', () => {
    const result = compileSceneGraph({
        nodes: [
            { id: 'A', kind: 'point', x: 0, y: 0 },
            { id: 'B', kind: 'point', x: 1, y: 0 },
            { id: 'arrow_AB', kind: 'arrow', start: 'A', end: 'B' }
        ]
    });

    assert.deepEqual(result.warnings, []);
    assert.equal(result.operations.at(-1).type, 'vector');
    assert.equal(result.operations.at(-1).startPointId, 'A');
    assert.equal(result.operations.at(-1).endPointId, 'B');
});
