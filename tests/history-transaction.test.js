import assert from 'node:assert/strict';
import test from 'node:test';

import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { CommandPalette } from '../js/ui/CommandPalette.js';
import { AlgebraInput } from '../js/ui/AlgebraInput.js';

function createStack() {
    const objectManager = new ObjectManager();
    const historyManager = new HistoryManager(objectManager);
    const patchApplier = new PatchApplier(objectManager, historyManager);
    return { objectManager, historyManager, patchApplier };
}

// CommandPalette 생성자는 DOM을 만들므로, DOM 없이 대수식 실행 로직만 검증하기 위해
// executeAlgebra를 가짜 팔레트 컨텍스트로 직접 호출한다.
function createAlgebraStack() {
    const { objectManager, historyManager } = createStack();
    const app = {
        algebraInput: new AlgebraInput(objectManager),
        objectManager,
        historyManager,
        render() {},
        updateSidebar() {},
        showToast() {}
    };
    const palette = { app, close() {} };
    const runAlgebra = expression => CommandPalette.prototype.executeAlgebra.call(palette, expression);
    return { objectManager, historyManager, runAlgebra };
}

// PatchApplier는 임시 id(A/B/C/tri)를 실제 생성 id(obj_...)로 매핑하므로
// 테스트에서는 apply()가 돌려주는 createdObjects의 실제 id를 사용합니다.
function trianglePatch() {
    return {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 4, y: 0, label: 'B' },
            { op: 'create', id: 'C', type: 'point', x: 2, y: 3, label: 'C' },
            { op: 'create', id: 'tri', type: 'polygon', vertexIds: ['A', 'B', 'C'] }
        ]
    };
}

test('a multi-object AI patch is a single undo step', () => {
    const { objectManager, historyManager, patchApplier } = createStack();

    const result = patchApplier.apply(trianglePatch());
    assert.equal(result.success, true);
    assert.equal(objectManager.getAllObjects().length, 4);

    // 4개 객체를 만들었지만 undo 스택에는 배치 1개만 있어야 합니다.
    assert.equal(historyManager.undoStack.length, 1);
    assert.equal(historyManager.undoStack[0].type, 'batch');
    assert.equal(historyManager.undoStack[0].actions.length, 4);
});

test('undo removes every object created by the patch at once', () => {
    const { objectManager, historyManager, patchApplier } = createStack();
    patchApplier.apply(trianglePatch());

    assert.equal(historyManager.undo(), true);
    assert.equal(objectManager.getAllObjects().length, 0);
    assert.equal(historyManager.canUndo(), false);
    assert.equal(historyManager.canRedo(), true);
});

test('redo restores every object created by the patch at once', () => {
    const { objectManager, historyManager, patchApplier } = createStack();
    patchApplier.apply(trianglePatch());
    historyManager.undo();

    assert.equal(historyManager.redo(), true);
    assert.equal(objectManager.getAllObjects().length, 4);

    const polygons = objectManager.getObjectsByType('polygon');
    assert.equal(polygons.length, 1);
    assert.equal(polygons[0].vertexIds.length, 3);
});

test('a batch can mix create and delete and still undo/redo as one step', () => {
    const { objectManager, historyManager, patchApplier } = createStack();
    const triangle = patchApplier.apply(trianglePatch());
    const polygonId = triangle.createdObjects.find(obj => obj.type === 'polygon').id;
    const undoBefore = historyManager.undoStack.length;

    // 기존 폴리곤(실제 id)을 지우고 새 점을 만드는 혼합 패치.
    const mixed = patchApplier.apply({
        operations: [
            { op: 'delete', id: polygonId },
            { op: 'create', id: 'D', type: 'point', x: 5, y: 5, label: 'D' }
        ]
    });
    assert.equal(mixed.success, true, mixed.message);
    assert.equal(historyManager.undoStack.length, undoBefore + 1);

    const createdPointId = mixed.createdObjects[0].id;
    assert.equal(objectManager.getObject(polygonId), undefined);
    assert.ok(objectManager.getObject(createdPointId));

    // 한 번의 undo로 삭제 복원 + 생성 취소가 함께 일어나야 합니다.
    historyManager.undo();
    assert.ok(objectManager.getObject(polygonId));
    assert.equal(objectManager.getObject(createdPointId), undefined);

    // 한 번의 redo로 다시 적용.
    historyManager.redo();
    assert.equal(objectManager.getObject(polygonId), undefined);
    assert.ok(objectManager.getObject(createdPointId));
});

test('point algebra creation records exactly one create action', () => {
    const { objectManager, historyManager, runAlgebra } = createAlgebraStack();

    runAlgebra('A=(2,0)');

    assert.equal(objectManager.getAllObjects().length, 1);
    assert.equal(historyManager.undoStack.length, 1);
    assert.equal(historyManager.undoStack[0].type, 'create');

    historyManager.undo();
    assert.equal(objectManager.getAllObjects().length, 0);
});

test('function algebra creation records exactly one create action', () => {
    const { objectManager, historyManager, runAlgebra } = createAlgebraStack();

    runAlgebra('y=x^2');

    assert.equal(objectManager.getAllObjects().length, 1);
    assert.equal(historyManager.undoStack.length, 1);
    assert.equal(historyManager.undoStack[0].type, 'create');

    historyManager.undo();
    assert.equal(objectManager.getAllObjects().length, 0);
});

test('circle algebra creation is one atomic batch of helper points and circle', () => {
    const { objectManager, historyManager, runAlgebra } = createAlgebraStack();

    runAlgebra('(x-2)^2+(y-3)^2=25');

    assert.equal(objectManager.getAllObjects().length, 3, 'center + rim point + circle');
    assert.equal(historyManager.undoStack.length, 1, 'must be a single undo step');
    assert.equal(historyManager.undoStack[0].type, 'batch');
    assert.equal(historyManager.undoStack[0].actions.length, 3);

    historyManager.undo();
    assert.equal(objectManager.getAllObjects().length, 0);

    historyManager.redo();
    assert.equal(objectManager.getAllObjects().length, 3);
    assert.equal(objectManager.getObjectsByType('circle').length, 1);
});

test('failed algebra parse leaves history and transaction state untouched', () => {
    const { objectManager, historyManager, runAlgebra } = createAlgebraStack();

    runAlgebra('@@nonsense@@');

    assert.equal(objectManager.getAllObjects().length, 0);
    assert.equal(historyManager.undoStack.length, 0);
    assert.equal(historyManager.transactionDepth, 0);
    assert.equal(historyManager.transactionBuffer, null);
});

test('a single-operation patch records a plain action, not a batch wrapper', () => {
    const { objectManager, historyManager, patchApplier } = createStack();

    const result = patchApplier.apply({
        operations: [
            { op: 'create', id: 'solo', type: 'point', x: 1, y: 1, label: 'S' }
        ]
    });
    const soloId = result.createdObjects[0].id;

    assert.equal(historyManager.undoStack.length, 1);
    assert.equal(historyManager.undoStack[0].type, 'create');

    historyManager.undo();
    assert.equal(objectManager.getObject(soloId), undefined);
});
