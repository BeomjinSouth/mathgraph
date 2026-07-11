import assert from 'node:assert/strict';
import test from 'node:test';

import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';

function createStack() {
    const objectManager = new ObjectManager();
    const historyManager = new HistoryManager(objectManager);
    return { objectManager, historyManager };
}

test('point-on-segment drag records t and round-trips through undo/redo', () => {
    const { objectManager: om, historyManager: history } = createStack();
    const p1 = om.createPoint(0, 0);
    const p2 = om.createPoint(10, 0);
    const segment = om.createSegment(p1.id, p2.id);
    const constrained = om.createPointOnLine(segment.id, 0.2);
    om.updateAll();

    history.startDrag([constrained]);
    constrained.t = 0.8;
    om.updateAll();
    history.endDrag([constrained]);

    assert.equal(history.undoStack.length, 1, 'drag must be recorded');

    history.undo();
    assert.equal(constrained.t, 0.2);
    assert.ok(Math.abs(constrained.getPosition().x - 2) < 1e-9, 'position must be recomputed from t');

    history.redo();
    assert.equal(constrained.t, 0.8);
    assert.ok(Math.abs(constrained.getPosition().x - 8) < 1e-9);
});

test('point-on-circle drag records angle and round-trips through undo/redo', () => {
    const { objectManager: om, historyManager: history } = createStack();
    const center = om.createPoint(0, 0);
    const rim = om.createPoint(5, 0);
    const circle = om.createCircle(center.id, rim.id);
    const constrained = om.createPointOnCircle(circle.id, 0);
    om.updateAll();

    history.startDrag([constrained]);
    constrained.angle = Math.PI / 2;
    om.updateAll();
    history.endDrag([constrained]);

    assert.equal(history.undoStack.length, 1, 'drag must be recorded');

    history.undo();
    assert.equal(constrained.angle, 0);
    assert.ok(Math.abs(constrained.getPosition().x - 5) < 1e-9);
    assert.ok(Math.abs(constrained.getPosition().y) < 1e-9);

    history.redo();
    assert.equal(constrained.angle, Math.PI / 2);
    assert.ok(Math.abs(constrained.getPosition().y - 5) < 1e-9);
});

test('number line drag records y and round-trips through undo/redo', () => {
    const { objectManager: om, historyManager: history } = createStack();
    const numberLine = om.createNumberLine({ start: -5, end: 5, step: 1, y: 0 });
    om.updateAll();

    history.startDrag([numberLine]);
    numberLine.y = 2;
    history.endDrag([numberLine]);

    assert.equal(history.undoStack.length, 1, 'number line drag must be recorded');

    history.undo();
    assert.equal(numberLine.y, 0);

    history.redo();
    assert.equal(numberLine.y, 2);
});

test('snapshot captures and restores transaction depth and buffer', () => {
    const { historyManager: history } = createStack();

    history.beginTransaction();
    history.record({ type: 'create', objectData: { id: 'draft-1' } });

    const snapshot = history.createSnapshot();
    assert.equal(snapshot.transactionDepth, 1);
    assert.equal(snapshot.transactionBuffer.length, 1);

    history.abortTransaction();
    assert.equal(history.transactionDepth, 0);

    history.restoreSnapshot(snapshot);
    assert.equal(history.transactionDepth, 1);
    assert.equal(history.transactionBuffer.length, 1);

    history.commitTransaction();
    assert.equal(history.undoStack.length, 1);
});

test('position undo routes through setPosition and keeps Vec2 behavior', () => {
    const { objectManager: om, historyManager: history } = createStack();
    const point = om.createPoint(1, 2);

    point.setPosition(5, 6);
    history.recordPropertyChange(point.id, 'position', { x: 1, y: 2 }, { x: 5, y: 6 });

    history.undo();
    assert.equal(point.position.x, 1);
    assert.equal(point.position.y, 2);
    assert.equal(typeof point.position.clone, 'function', 'position must stay a Vec2 after undo');

    history.redo();
    assert.equal(point.position.x, 5);
    assert.equal(point.position.y, 6);
    assert.equal(typeof point.position.clone, 'function', 'position must stay a Vec2 after redo');
});

test('expression undo rebuilds parser state through setExpression', () => {
    const { objectManager: om, historyManager: history } = createStack();
    const fn = om.createFunction('y = x^2');
    const oldExpression = fn.expression;

    fn.setExpression('x + 1');
    history.recordPropertyChange(fn.id, 'expression', oldExpression, fn.expression);

    history.undo();
    assert.equal(fn.expression, oldExpression);
    assert.equal(fn.getFunction()(2), 4, 'undo must rebuild the parsed x^2 function');

    history.redo();
    assert.equal(fn.getFunction()(2), 3, 'redo must rebuild the parsed x+1 function');
});
