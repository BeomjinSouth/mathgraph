import assert from 'node:assert/strict';
import test from 'node:test';

import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';

function createNumberLineHarness() {
    const objects = new Map();
    const history = [];

    const objectManager = {
        selectedObjects: new Set(),
        highlightedObject: null,
        toJSON() {
            return { objects: Array.from(objects.values()).map(obj => obj.toJSON()) };
        },
        fromJSON() {},
        updateAll() {},
        updateObject(id) {
            return objects.get(id) || null;
        },
        getObject(id) {
            return objects.get(id) || null;
        },
        getDependents() {
            return [];
        },
        removeObject(id) {
            objects.delete(id);
        },
        clearSelection() {},
        selectObject() {},
        clearHighlight() {},
        highlightObject() {},
        createNumberLine(params = {}) {
            const obj = {
                id: 'number_line_1',
                type: 'numberLine',
                ...params,
                toJSON() {
                    return {
                        id: this.id,
                        type: this.type,
                        start: this.start,
                        end: this.end,
                        step: this.step,
                        y: this.y,
                        showArrows: this.showArrows,
                        tickHeight: this.tickHeight,
                        customMarks: this.customMarks
                    };
                }
            };
            objects.set(obj.id, obj);
            return obj;
        }
    };

    const historyManager = {
        recordCreate(object) {
            history.push(['create', object.id]);
        },
        recordDelete(objectsToDelete) {
            history.push(['delete', Array.isArray(objectsToDelete) ? objectsToDelete.length : 1]);
        },
        recordPropertyChange(objectId, property, oldValue, newValue) {
            history.push(['property', objectId, property, oldValue, newValue]);
        },
        createSnapshot() {
            return { history: [...history] };
        },
        restoreSnapshot() {}
    };

    return { objectManager, historyManager, objects, history };
}

test('SchemaValidator requires the numberLine runtime fields', () => {
    const validator = new SchemaValidator();
    const valid = validator.parseAndValidate({
        operations: [
            { op: 'create', type: 'numberLine', start: -5, end: 5, step: 1, y: 0 }
        ]
    });

    assert.equal(valid.valid, true);

    const invalid = validator.parseAndValidate({
        operations: [
            { op: 'create', type: 'numberLine', end: 5, step: 1, y: 0 }
        ]
    });

    assert.equal(invalid.valid, false);
    assert.match(invalid.errors.join('\n'), /start/);
});

test('PatchApplier creates and updates numberLine objects with parity fields', () => {
    const { objectManager, historyManager, objects } = createNumberLineHarness();
    const applier = new PatchApplier(objectManager, historyManager);

    const result = applier.apply({
        operations: [
            {
                op: 'create',
                id: 'line_input',
                type: 'numberLine',
                start: -3,
                end: 3,
                step: 1,
                y: 0,
                showArrows: true,
                tickHeight: 0.25,
                customMarks: [{ value: 0, label: 'O' }],
                color: '#2563eb'
            },
            {
                op: 'update',
                id: 'line_input',
                start: -4,
                end: 4,
                step: 2,
                y: 1,
                showArrows: false,
                tickHeight: 0.2
            }
        ]
    });

    assert.equal(result.success, true);
    const numberLine = objects.get('number_line_1');
    assert.ok(numberLine);
    assert.equal(numberLine.start, -4);
    assert.equal(numberLine.end, 4);
    assert.equal(numberLine.step, 2);
    assert.equal(numberLine.y, 1);
    assert.equal(numberLine.showArrows, false);
    assert.equal(numberLine.tickHeight, 0.2);
    assert.deepEqual(numberLine.customMarks, [{ value: 0, label: 'O' }]);
});
