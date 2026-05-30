import assert from 'node:assert/strict';
import test from 'node:test';

import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { FillTool } from '../js/tools/FillTool.js';
import { ObjectType } from '../js/objects/GeoObject.js';
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

test('FillTool infers and fills a closed region from loose segments', () => {
    const objectManager = new ObjectManager();
    const historyManager = new HistoryManager(objectManager);
    const A = objectManager.createPoint(0, 0);
    const B = objectManager.createPoint(4, 0);
    const C = objectManager.createPoint(0, 3);
    const AB = objectManager.createSegment(A.id, B.id);
    const BC = objectManager.createSegment(B.id, C.id);
    const CA = objectManager.createSegment(C.id, A.id);
    const tool = new FillTool();
    app = createApp(objectManager, historyManager, '#f97316', 0.4);

    tool.onMouseDown(new Vec2(0.75, 0.75), null, null, app);

    const region = objectManager.getAllObjects().find(object => object.type === ObjectType.CLOSED_REGION);
    assert.ok(region);
    assert.equal(region.fillColor, '#f97316');
    assert.equal(region.fillOpacity, 0.4);
    assert.deepEqual(new Set(region.boundaryObjectIds), new Set([AB.id, BC.id, CA.id]));
    assert.equal(historyManager.undoStack.length, 1);
    assert.equal(historyManager.undoStack[0].type, 'create');
    assert.equal(app.returnedToSelect, true);

    B.setPosition(5, 0);
    objectManager.updateObject(B.id);
    assert.equal(region.vertices[1].x, 5);

    const restored = new ObjectManager();
    restored.fromJSON(objectManager.toJSON());
    const restoredRegion = restored.getAllObjects().find(object => object.type === ObjectType.CLOSED_REGION);
    assert.ok(restoredRegion);
    assert.equal(restoredRegion.valid, true);
    assert.equal(restoredRegion.vertexIds.length, 3);

    historyManager.undo();
    assert.equal(objectManager.getAllObjects().some(object => object.type === ObjectType.CLOSED_REGION), false);
    historyManager.redo();
    assert.equal(objectManager.getAllObjects().some(object => object.type === ObjectType.CLOSED_REGION), true);
});

test('FillTool infers a two-circle lens before filling a whole circle', () => {
    const objectManager = new ObjectManager();
    const historyManager = new HistoryManager(objectManager);
    const O1 = objectManager.createPoint(-1, 0);
    const R1 = objectManager.createPoint(1, 0);
    const O2 = objectManager.createPoint(1, 0);
    const R2 = objectManager.createPoint(-1, 0);
    const c1 = objectManager.createCircle(O1.id, R1.id);
    const c2 = objectManager.createCircle(O2.id, R2.id);
    const tool = new FillTool();
    app = createApp(objectManager, historyManager, '#a855f7', 0.5);

    tool.onMouseDown(new Vec2(0, 0), null, null, app);

    const lens = objectManager.getAllObjects().find(object => object.type === ObjectType.LENS_REGION);
    assert.ok(lens);
    assert.equal(lens.fillColor, '#a855f7');
    assert.equal(lens.fillOpacity, 0.5);
    assert.equal(lens.hitTest(new Vec2(0, 0), 8, app.canvas), true);
    assert.equal(c1.fillOpacity, 0);
    assert.equal(c2.fillOpacity, 0);
    assert.equal(historyManager.undoStack.length, 1);
    assert.equal(historyManager.undoStack[0].type, 'create');
});
