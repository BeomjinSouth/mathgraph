import assert from 'node:assert/strict';
import test from 'node:test';

import {
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
