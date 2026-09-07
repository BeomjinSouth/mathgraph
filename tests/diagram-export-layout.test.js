import test from 'node:test';
import assert from 'node:assert/strict';
import { createInkMap, layoutDiagramLabels } from '../js/utils/DiagramExportLayout.js';

function raster(width, height, pixels) {
    const data = new Uint8ClampedArray(width * height * 4).fill(255);
    for (const [x, y] of pixels) data.set([0, 0, 0, 255], (y * width + x) * 4);
    return createInkMap({ width, height, data });
}

test('crop encloses geometry and labels while removing unused viewport', () => {
    const ink = raster(1000, 600, [[350, 250], [650, 400]]);
    const result = layoutDiagramLabels(ink, [{ text: 'A', x: 335, y: 225, fontSize: 14, width: 10 }], { width: 1000, height: 600 });
    assert.ok(result.crop.width < 350);
    assert.ok(result.crop.height < 210);
    assert.ok(result.crop.x < 335 && result.crop.y < 225);
    assert.ok(result.crop.x + result.crop.width > 650);
    assert.ok(result.crop.y + result.crop.height > 400);
});

test('label on a diagonal moves off the stroke and other labels', () => {
    const ink = raster(200, 200, Array.from({ length: 160 }, (_, i) => [i + 20, i + 20]));
    const input = [0, 1].map(() => ({ text: 'A', x: 90, y: 90, width: 12, fontSize: 16 }));
    const { labels } = layoutDiagramLabels(ink, input, { width: 200, height: 200 });
    for (const label of labels) {
        assert.equal(ink.count(label.box), 0);
        assert.ok(label.x !== 90 || label.y !== 90);
    }
    const [a, b] = labels.map(label => label.box);
    assert.ok(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
    assert.equal(input[0].x, 90, 'export must not move the editable scene');
});

test('empty canvas fails, geometry without labels crops, edge labels stay inside', () => {
    const empty = raster(100, 100, []);
    assert.throws(() => layoutDiagramLabels(empty, [], { width: 100, height: 100 }), /출력할 그림/);
    const { crop } = layoutDiagramLabels(raster(100, 100, [[40, 40], [60, 60]]), [], { width: 100, height: 100 });
    assert.ok(crop.width < 40);
    const { labels } = layoutDiagramLabels(empty, [{ text:'B', x:-2, y:0, width:10, fontSize:14 }], { width:100, height:100 });
    assert.ok(labels[0].x >= 0 && labels[0].y >= 0);
});
