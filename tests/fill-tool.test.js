import assert from 'node:assert/strict';
import test from 'node:test';

import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { FillTool } from '../js/tools/FillTool.js';
import { Vec2 } from '../js/utils/Geometry.js';

function createApp(objectManager, historyManager, fillColor = '#ef4444', fillOpacity = 0.5) {
    return {
        objectManager,
        historyManager,
        currentFillColor: fillColor,
        currentFillOpacity: fillOpacity,
        canvas: { toMathLength: value => value / 100 },
        renderCount: 0,
        returnedToSelect: false,
        showToast() { },
        render() {
            this.renderCount += 1;
        },
        toolManager: {
            returnToSelect: () => {
                app.returnedToSelect = true;
            }
        }
    };
}

let app;

test('FillTool fills polygons and records a single undoable batch', () => {
    const objectManager = new ObjectManager();
    const historyManager = new HistoryManager(objectManager);
    const A = objectManager.createPoint(0, 0);
    const B = objectManager.createPoint(3, 0);
    const C = objectManager.createPoint(0, 3);
    const polygon = objectManager.createPolygon([A.id, B.id, C.id]);
    const tool = new FillTool();
    app = createApp(objectManager, historyManager, '#22c55e', 0.45);

    tool.onMouseDown(new Vec2(0.5, 0.5), null, null, app);

    assert.equal(polygon.fillColor, '#22c55e');
    assert.equal(polygon.fillOpacity, 0.45);
    assert.equal(historyManager.undoStack.length, 1);
    assert.equal(historyManager.undoStack[0].type, 'batch');
    assert.equal(app.returnedToSelect, true);

    historyManager.undo();
    assert.equal(polygon.fillColor, '#000000');
    assert.equal(polygon.fillOpacity, 0.12);
});

test('FillTool fills circle interiors without changing normal circle hit testing', () => {
    const objectManager = new ObjectManager();
    const historyManager = new HistoryManager(objectManager);
    const O = objectManager.createPoint(0, 0);
    const A = objectManager.createPoint(2, 0);
    const circle = objectManager.createCircle(O.id, A.id);
    const tool = new FillTool();
    app = createApp(objectManager, historyManager, '#3b82f6', 0.35);

    assert.equal(circle.hitTest(new Vec2(0, 0), 8, app.canvas), false);

    tool.onMouseDown(new Vec2(0, 0), null, null, app);

    assert.equal(circle.fillColor, '#3b82f6');
    assert.equal(circle.fillOpacity, 0.35);
    assert.equal(historyManager.undoStack.length, 1);
});
