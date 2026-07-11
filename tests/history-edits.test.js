import assert from 'node:assert/strict';
import test from 'node:test';

import { applyRecordedPropertyChange } from '../js/utils/HistoryEdits.js';

function createHistoryStub() {
    const calls = [];
    return {
        calls,
        recordPropertyChange(objectId, property, oldValue, newValue) {
            calls.push({ objectId, property, oldValue, newValue });
        }
    };
}

test('applies the change and records old/new values once', () => {
    const history = createHistoryStub();
    const object = { id: 'o1', label: 'A' };

    const changed = applyRecordedPropertyChange({
        object,
        property: 'label',
        newValue: 'B',
        historyManager: history
    });

    assert.equal(changed, true);
    assert.equal(object.label, 'B');
    assert.deepEqual(history.calls, [
        { objectId: 'o1', property: 'label', oldValue: 'A', newValue: 'B' }
    ]);
});

test('skips apply and recording when the value is unchanged', () => {
    const history = createHistoryStub();
    const object = { id: 'o1', label: 'A' };

    const changed = applyRecordedPropertyChange({
        object,
        property: 'label',
        newValue: 'A',
        historyManager: history
    });

    assert.equal(changed, false);
    assert.equal(history.calls.length, 0);
});

test('uses the invariant-safe setter when provided', () => {
    const history = createHistoryStub();
    const applied = [];
    const object = {
        id: 'o1',
        position: { x: 1, y: 2 },
        setPosition(x, y) {
            applied.push({ x, y });
            this.position = { x, y };
        }
    };

    const changed = applyRecordedPropertyChange({
        object,
        property: 'position',
        newValue: { x: 5, y: 6 },
        historyManager: history,
        apply: (target, value) => target.setPosition(value.x, value.y)
    });

    assert.equal(changed, true);
    assert.deepEqual(applied, [{ x: 5, y: 6 }]);
    assert.deepEqual(history.calls[0].oldValue, { x: 1, y: 2 });
    assert.deepEqual(history.calls[0].newValue, { x: 5, y: 6 });
});

test('clones recorded values so later mutation does not corrupt history', () => {
    const history = createHistoryStub();
    const newValue = { x: 5, y: 6 };
    const object = { id: 'o1', position: { x: 1, y: 2 } };

    applyRecordedPropertyChange({
        object,
        property: 'position',
        newValue,
        historyManager: history,
        apply: (target, value) => {
            target.position = value;
        }
    });

    object.position.x = 99;
    newValue.y = 99;

    assert.deepEqual(history.calls[0].oldValue, { x: 1, y: 2 });
    assert.deepEqual(history.calls[0].newValue, { x: 5, y: 6 });
});

test('supports an explicit oldValue for continuous edits recorded at the end', () => {
    const history = createHistoryStub();
    // 색상 피커의 input 이벤트가 이미 라이브로 값을 바꾼 상황을 재현한다.
    const object = { id: 'o1', color: '#ff0000' };

    const changed = applyRecordedPropertyChange({
        object,
        property: 'color',
        oldValue: '#333333',
        newValue: '#ff0000',
        historyManager: history
    });

    assert.equal(changed, true);
    assert.deepEqual(history.calls, [
        { objectId: 'o1', property: 'color', oldValue: '#333333', newValue: '#ff0000' }
    ]);

    // 시작 값과 끝 값이 같으면 기록하지 않는다.
    const unchanged = applyRecordedPropertyChange({
        object,
        property: 'color',
        oldValue: '#ff0000',
        newValue: '#ff0000',
        historyManager: history
    });
    assert.equal(unchanged, false);
    assert.equal(history.calls.length, 1);
});

test('reads and writes dotted property paths', () => {
    const history = createHistoryStub();
    const object = { id: 'o1', styles: { line: { width: 2 } } };

    const changed = applyRecordedPropertyChange({
        object,
        property: 'styles.line.width',
        newValue: 4,
        historyManager: history
    });

    assert.equal(changed, true);
    assert.equal(object.styles.line.width, 4);
    assert.deepEqual(history.calls, [
        { objectId: 'o1', property: 'styles.line.width', oldValue: 2, newValue: 4 }
    ]);
});
