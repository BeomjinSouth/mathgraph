import assert from 'node:assert/strict';
import test from 'node:test';

import {
    getAreaExportAxisOverlayGeometry,
    normalizeExportAreaRect,
    scaleExportAreaRect
} from '../js/utils/ExportArea.js';
import { AreaExportTool } from '../js/tools/AreaExportTool.js';
import { Vec2 } from '../js/utils/Geometry.js';

test('normalizes drag direction into a positive export rectangle', () => {
    const rect = normalizeExportAreaRect(
        new Vec2(320, 260),
        new Vec2(120, 80),
        { width: 500, height: 400 }
    );

    assert.deepEqual(rect, {
        x: 120,
        y: 80,
        width: 200,
        height: 180
    });
});

test('clamps an export rectangle to the visible canvas bounds', () => {
    const rect = normalizeExportAreaRect(
        new Vec2(-30, 50),
        new Vec2(540, 430),
        { width: 500, height: 400 }
    );

    assert.deepEqual(rect, {
        x: 0,
        y: 50,
        width: 500,
        height: 350
    });
});

test('rejects tiny area export drags', () => {
    const rect = normalizeExportAreaRect(
        new Vec2(100, 100),
        new Vec2(105, 106),
        { width: 500, height: 400 }
    );

    assert.equal(rect, null);
});

test('scales export rectangles for high-resolution PNG output', () => {
    const rect = scaleExportAreaRect(
        { x: 10.2, y: 20.4, width: 100.3, height: 50.6 },
        3
    );

    assert.deepEqual(rect, {
        x: 31,
        y: 61,
        width: 301,
        height: 152
    });
});

test('positions crop-edge axis arrows when axes cross an exported area', () => {
    const geometry = getAreaExportAxisOverlayGeometry(
        { x: 100, y: 80, width: 200, height: 160 },
        new Vec2(150, 120),
        2
    );

    assert.equal(geometry.xAxis.arrow[0].x, 398);
    assert.equal(geometry.xAxis.arrow[0].y, 80);
    assert.equal(geometry.xAxis.line.x2, geometry.xAxis.arrow[1].x);
    assert.equal(geometry.xAxis.arrow[1].x, 372);
    assert.equal(geometry.xAxis.arrow[1].y, 71.6);
    assert.equal(geometry.xAxis.arrow[2].y, 88.4);
    assert.equal(geometry.xAxis.label.text, 'x');
    assert.equal(geometry.xAxis.label.x, 374);
    assert.equal(geometry.yAxis.arrow[0].x, 100);
    assert.equal(geometry.yAxis.arrow[0].y, 2);
    assert.equal(geometry.yAxis.line.y1, geometry.yAxis.arrow[1].y);
    assert.equal(geometry.yAxis.arrow[1].x, 91.6);
    assert.equal(geometry.yAxis.arrow[2].x, 108.4);
    assert.equal(geometry.yAxis.label.text, 'y');
    assert.equal(geometry.yAxis.label.x, 70);
});

test('omits crop-edge axis arrows for axes outside an exported area', () => {
    const geometry = getAreaExportAxisOverlayGeometry(
        { x: 100, y: 80, width: 200, height: 160 },
        new Vec2(20, 40),
        1
    );

    assert.equal(geometry.xAxis, null);
    assert.equal(geometry.yAxis, null);
});

test('area export tool saves a dragged screen rectangle and returns to select', () => {
    const tool = new AreaExportTool();
    let exportedRect = null;
    let selectedTool = null;

    const app = {
        canvas: { width: 500, height: 400 },
        objectManager: { clearHighlight() {} },
        toolManager: {
            setTool(name) {
                selectedTool = name;
            }
        },
        exportAreaFromScreenRect(rect) {
            exportedRect = rect;
        },
        render() {},
        showToast() {}
    };

    tool.onMouseDown(null, new Vec2(300, 280), { button: 0 }, app);
    tool.onMouseUp(null, new Vec2(120, 80), {}, app);

    assert.deepEqual(exportedRect, {
        x: 120,
        y: 80,
        width: 180,
        height: 200
    });
    assert.equal(selectedTool, 'select');
    assert.equal(tool.isDragging, false);
});
