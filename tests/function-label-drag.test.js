import assert from 'node:assert/strict';
import test from 'node:test';

import { ObjectManager } from '../js/core/ObjectManager.js';
import { Canvas } from '../js/core/Canvas.js';
import { SelectTool } from '../js/tools/SelectTool.js';
import { Vec2 } from '../js/utils/Geometry.js';

function makeRecordingContext() {
    return {
        set font(value) {},
        measureText(text) {
            return { width: String(text).length * 8 };
        }
    };
}

function makeCanvas() {
    const canvas = Object.create(Canvas.prototype);
    canvas.ctx = makeRecordingContext();
    canvas.scale = 50;
    canvas.width = 500;
    canvas.height = 500;
    canvas.offset = new Vec2(0, 0);
    canvas.toScreen = point => new Vec2(
        canvas.width / 2 + point.x * canvas.scale,
        canvas.height / 2 - point.y * canvas.scale
    );
    canvas.toMath = point => new Vec2(
        (point.x - canvas.width / 2) / canvas.scale,
        -(point.y - canvas.height / 2) / canvas.scale
    );
    canvas.toMathLength = value => value / canvas.scale;
    canvas.getVisibleBounds = () => ({
        minX: -5,
        maxX: 5,
        minY: -5,
        maxY: 5
    });
    return canvas;
}

function makeApp(objectManager, canvas) {
    return {
        objectManager,
        canvas,
        showHiddenObjects: false,
        canvasElement: { style: {} },
        historyManager: {
            startCount: 0,
            endCount: 0,
            startDrag() {
                this.startCount += 1;
            },
            endDrag() {
                this.endCount += 1;
            }
        },
        render() {},
        updatePropertyPanel() {},
        updateSidebar() {},
        showToast() {}
    };
}

function makeMouseEvent(overrides = {}) {
    return {
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        ...overrides
    };
}

test('select tool drags a function formula label from its rendered bounds', () => {
    const objectManager = new ObjectManager();
    const func = objectManager.createFunction('2*x^2', { label: 'f', showLabel: true });
    const canvas = makeCanvas();
    const app = makeApp(objectManager, canvas);
    const tool = new SelectTool();

    const anchor = func.getLabelPosition(canvas);
    const bounds = func.getLabelBounds(canvas);
    const labelScreenPoint = new Vec2(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    const labelMathPoint = canvas.toMath(labelScreenPoint);

    tool.onMouseDown(labelMathPoint, labelScreenPoint, makeMouseEvent(), app);

    assert.equal(tool.isDragging, true);
    assert.equal(app.historyManager.startCount, 1);

    const targetMathPoint = labelMathPoint.add(new Vec2(0.5, 0.25));
    const targetScreenPoint = canvas.toScreen(targetMathPoint);
    tool.onMouseMove(targetMathPoint, targetScreenPoint, new Vec2(0.5, 0.25), makeMouseEvent(), app);
    tool.onMouseUp(targetMathPoint, targetScreenPoint, makeMouseEvent(), app);

    assert.equal(tool.isDragging, false);
    assert.equal(app.historyManager.endCount, 1);
    assert.ok(Math.abs(func._labelMathPos.x - (anchor.x + 0.5)) < 1e-9);
    assert.ok(Math.abs(func._labelMathPos.y - (anchor.y + 0.25)) < 1e-9);
});

test('select tool does not start a no-op function drag when clicking only the curve', () => {
    const objectManager = new ObjectManager();
    const func = objectManager.createFunction('x^2', { label: 'f', showLabel: true });
    const canvas = makeCanvas();
    const app = makeApp(objectManager, canvas);
    const tool = new SelectTool();
    const curveMathPoint = new Vec2(1, 1);
    const curveScreenPoint = canvas.toScreen(curveMathPoint);

    tool.onMouseDown(curveMathPoint, curveScreenPoint, makeMouseEvent(), app);

    assert.equal(func.selected, true);
    assert.equal(tool.isDragging, false);
    assert.equal(app.historyManager.startCount, 0);
});
