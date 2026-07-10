import assert from 'node:assert/strict';
import test from 'node:test';

import { ObjectManager } from '../js/core/ObjectManager.js';
import { TextLabel } from '../js/objects/TextLabel.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';

test('TextLabel stores editable text, position, font size, and alignment', () => {
    const label = new TextLabel('단, x > 0', 2, -1, {
        fontSize: 18,
        align: 'center',
        color: '#111111'
    });

    assert.equal(label.type, 'textLabel');
    assert.equal(label.text, '단, x > 0');
    assert.equal(label.position.x, 2);
    assert.equal(label.position.y, -1);
    assert.equal(label.fontSize, 18);
    assert.equal(label.align, 'center');

    label.drag({ x: 4, y: 3 });
    const json = label.toJSON();
    assert.equal(json.type, 'textLabel');
    assert.equal(json.text, '단, x > 0');
    assert.equal(json.x, 4);
    assert.equal(json.y, 3);
    assert.equal(json.fontSize, 18);
    assert.equal(json.align, 'center');
});

test('ObjectManager restores standalone text labels from project JSON', () => {
    const manager = new ObjectManager();
    const created = manager.createTextLabel('그림은 축척에 맞지 않음', -2, 1, {
        fontSize: 16,
        align: 'right'
    });
    const snapshot = manager.toJSON();

    const restored = new ObjectManager();
    restored.fromJSON(snapshot);
    const label = restored.getObject(created.id);

    assert.ok(label instanceof TextLabel);
    assert.equal(label.text, '그림은 축척에 맞지 않음');
    assert.equal(label.align, 'right');
    assert.equal(label.position.x, -2);
});

test('AI schema and patch applier support standalone text labels', () => {
    const validator = new SchemaValidator();
    const validation = validator.parseAndValidate({
        operations: [
            { op: 'create', id: 'note', type: 'textLabel', text: 'x > 0', x: 1, y: 2, align: 'left' }
        ]
    });
    assert.equal(validation.valid, true, validation.errors.join('\n'));

    const manager = new ObjectManager();
    const historyManager = {
        recordCreate() {},
        recordDelete() {},
        recordPropertyChange() {},
        createSnapshot() { return null; },
        restoreSnapshot() {}
    };
    const applier = new PatchApplier(manager, historyManager);
    const result = applier.apply({
        operations: [
            { op: 'create', id: 'note', type: 'textLabel', text: 'x > 0', x: 1, y: 2, fontSize: 20 },
            { op: 'update', id: 'note', text: 'x >= 0', align: 'center' }
        ]
    });

    assert.equal(result.success, true, result.error);
    const [label] = manager.getAllObjects();
    assert.equal(label.text, 'x >= 0');
    assert.equal(label.align, 'center');
    assert.equal(label.fontSize, 20);
});
