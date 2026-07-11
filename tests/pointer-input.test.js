import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { EventHandler } from '../js/core/EventHandler.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { SelectTool } from '../js/tools/SelectTool.js';
import { Vec2 } from '../js/utils/Geometry.js';

function fakeClassList() {
    const classes = new Set();
    return {
        add: name => classes.add(name),
        remove: name => classes.delete(name),
        contains: name => classes.has(name),
        toggle(name, force) {
            const enabled = force === undefined ? !classes.has(name) : Boolean(force);
            if (enabled) classes.add(name);
            else classes.delete(name);
            return enabled;
        }
    };
}

function createPointerHarness() {
    const canvasListeners = new Map();
    const documentListeners = new Map();
    const captures = [];
    const released = [];

    const canvasElement = {
        addEventListener(type, handler) {
            if (!canvasListeners.has(type)) canvasListeners.set(type, []);
            canvasListeners.get(type).push(handler);
        },
        getBoundingClientRect() {
            return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 };
        },
        classList: fakeClassList(),
        setPointerCapture(pointerId) {
            captures.push(pointerId);
        },
        releasePointerCapture(pointerId) {
            released.push(pointerId);
        },
        style: {}
    };

    const previousDocument = globalThis.document;
    globalThis.document = {
        addEventListener(type, handler) {
            if (!documentListeners.has(type)) documentListeners.set(type, []);
            documentListeners.get(type).push(handler);
        },
        getElementById: () => null
    };

    const calls = { down: [], move: [], up: [], cancel: 0 };
    const tool = {
        onMouseDown(mathPos, screenPos, event) {
            calls.down.push({ mathPos, screenPos, event });
        },
        onMouseMove(mathPos, screenPos, delta, event) {
            calls.move.push({ mathPos, screenPos, event });
        },
        onMouseUp(mathPos, screenPos, event) {
            calls.up.push({ mathPos, screenPos, event });
        },
        cancel() {
            calls.cancel += 1;
        }
    };

    const objects = new Map();
    const objectManager = {
        updateAllCount: 0,
        getObject: id => objects.get(id) || null,
        updateAll() {
            this.updateAllCount += 1;
        },
        clearHighlight() {},
        clearSelection() {},
        findPointAt: () => null,
        findObjectAt: () => null,
        getSelectedObjects: () => []
    };
    const historyManager = new HistoryManager(objectManager);

    const app = {
        canvas: {
            toMath: pos => pos.clone(),
            pan() {},
            zoom() {}
        },
        canvasElement,
        objectManager,
        historyManager,
        settingsManager: { magnetEnabled: false },
        toolManager: { getCurrentTool: () => tool, setTool() {} },
        render() {},
        updateZoomDisplay() {},
        updatePropertyPanel() {}
    };

    const handler = new EventHandler(app);
    // 유령(호환) 마우스 억제 창을 결정론적으로 검증하기 위해 시계를 주입한다.
    const clock = { now: 100000 };
    handler.getNow = () => clock.now;

    const dispatch = (listeners, type, event) => {
        for (const registered of listeners.get(type) || []) {
            registered(event);
        }
    };

    return {
        handler,
        app,
        tool,
        calls,
        objects,
        historyManager,
        canvasElement,
        captures,
        released,
        clock,
        advanceClock: ms => { clock.now += ms; },
        dispatchCanvas: (type, event) => dispatch(canvasListeners, type, event),
        dispatchDocument: (type, event) => dispatch(documentListeners, type, event),
        restore() {
            if (previousDocument === undefined) delete globalThis.document;
            else globalThis.document = previousDocument;
        }
    };
}

function pointerEvent(overrides = {}) {
    const event = {
        pointerId: 7,
        pointerType: 'touch',
        isPrimary: true,
        clientX: 100,
        clientY: 100,
        button: 0,
        buttons: 1,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        defaultPrevented: false,
        preventDefault() {
            this.defaultPrevented = true;
        }
    };
    return Object.assign(event, overrides);
}

function mouseEvent(overrides = {}) {
    const event = pointerEvent(overrides);
    delete event.pointerId;
    delete event.pointerType;
    delete event.isPrimary;
    return event;
}

test('primary touch registers once and compatibility mouse events are ignored during the pointer', () => {
    const harness = createPointerHarness();
    try {
        const down = pointerEvent();
        harness.dispatchCanvas('pointerdown', down);

        assert.equal(harness.calls.down.length, 1);
        assert.equal(down.defaultPrevented, true);
        assert.deepEqual(harness.captures, [7]);
        assert.equal(harness.handler.activePointerId, 7);

        // 같은 제스처에서 브라우저가 만들어내는 호환 마우스 이벤트는 무시해야 한다.
        harness.dispatchCanvas('mousedown', mouseEvent());
        assert.equal(harness.calls.down.length, 1);

        harness.dispatchDocument('pointermove', pointerEvent({ clientX: 150, clientY: 150 }));
        assert.equal(harness.calls.move.length, 1);

        harness.dispatchCanvas('mousemove', mouseEvent({ clientX: 160, clientY: 160 }));
        assert.equal(harness.calls.move.length, 1);

        harness.dispatchDocument('pointerup', pointerEvent({ clientX: 150, clientY: 150 }));
        assert.equal(harness.calls.up.length, 1);
        assert.equal(harness.handler.activePointerId, null);

        // 포인터가 끝난 직후의 마우스 이벤트는 유령 이벤트일 수 있어 억제 창 안에서는 무시된다.
        harness.dispatchCanvas('mousemove', mouseEvent({ clientX: 170, clientY: 170 }));
        assert.equal(harness.calls.move.length, 1);

        // 억제 창이 지나면 일반 마우스 경로가 다시 동작해야 한다.
        harness.advanceClock(800);
        harness.dispatchCanvas('mousemove', mouseEvent({ clientX: 190, clientY: 190 }));
        assert.equal(harness.calls.move.length, 2);
    } finally {
        harness.restore();
    }
});

test('ghost compatibility mouse events after a touch tap do not double-fire the tool', () => {
    const harness = createPointerHarness();
    try {
        // 실제 태블릿 탭: pointerdown → pointerup 후 브라우저가 mousedown/mouseup/click을 합성한다.
        harness.dispatchCanvas('pointerdown', pointerEvent());
        harness.dispatchDocument('pointerup', pointerEvent());
        assert.equal(harness.calls.down.length, 1, 'tap creates exactly one tool down');
        assert.equal(harness.handler.activePointerId, null);
        const downAfterTap = harness.calls.down.length;
        const upAfterTap = harness.calls.up.length;

        // 곧바로 도착하는 유령 마우스 시퀀스는 아무 것도 추가로 실행하면 안 된다(두 번째 점 생성 방지).
        harness.dispatchCanvas('mousedown', mouseEvent());
        harness.dispatchDocument('mouseup', mouseEvent());
        assert.equal(harness.calls.down.length, downAfterTap, 'ghost mousedown must not create a second down');
        assert.equal(harness.calls.up.length, upAfterTap, 'ghost mouseup must not add a second tool completion');
    } finally {
        harness.restore();
    }
});

test('a real mouse click well after a touch is not suppressed', () => {
    const harness = createPointerHarness();
    try {
        harness.dispatchCanvas('pointerdown', pointerEvent());
        harness.dispatchDocument('pointerup', pointerEvent());
        assert.equal(harness.calls.down.length, 1);

        // 억제 창을 넘긴 뒤의 실제 마우스 클릭은 정상 처리된다.
        harness.advanceClock(1000);
        harness.dispatchCanvas('mousedown', mouseEvent());
        assert.equal(harness.calls.down.length, 2);
    } finally {
        harness.restore();
    }
});

test('non-primary touch and mouse-type pointers are ignored by the bridge', () => {
    const harness = createPointerHarness();
    try {
        harness.dispatchCanvas('pointerdown', pointerEvent({ isPrimary: false, pointerId: 11 }));
        assert.equal(harness.calls.down.length, 0);
        assert.equal(harness.captures.length, 0);

        harness.dispatchCanvas('pointerdown', pointerEvent({ pointerType: 'mouse', pointerId: 12 }));
        assert.equal(harness.calls.down.length, 0);

        // 마우스는 기존 mousedown 경로로 계속 동작한다.
        harness.dispatchCanvas('mousedown', mouseEvent());
        assert.equal(harness.calls.down.length, 1);
    } finally {
        harness.restore();
    }
});

test('pen pointers reach the existing handler with modifier and button values intact', () => {
    const harness = createPointerHarness();
    try {
        // Alt+포인터는 기존 마우스 경로와 동일하게 패닝으로 이어져야 한다.
        harness.dispatchCanvas('pointerdown', pointerEvent({ pointerType: 'pen', altKey: true }));
        assert.equal(harness.handler.isPanning, true);
        assert.equal(harness.canvasElement.classList.contains('panning'), true);
        assert.equal(harness.calls.down.length, 0);

        harness.dispatchDocument('pointerup', pointerEvent({ pointerType: 'pen' }));
        assert.equal(harness.handler.isPanning, false);
        assert.equal(harness.canvasElement.classList.contains('panning'), false);

        // 수정자 없는 펜 다운은 도구에 이벤트 원본 그대로 전달된다.
        harness.dispatchCanvas('pointerdown', pointerEvent({ pointerType: 'pen', pointerId: 9, shiftKey: true }));
        assert.equal(harness.calls.down.length, 1);
        assert.equal(harness.calls.down[0].event.shiftKey, true);
        assert.equal(harness.calls.down[0].event.button, 0);
    } finally {
        harness.restore();
    }
});

test('inside and outside pointer moves are each delivered to the tool exactly once', () => {
    const harness = createPointerHarness();
    try {
        harness.dispatchCanvas('pointerdown', pointerEvent());
        assert.equal(harness.calls.down.length, 1);

        harness.dispatchDocument('pointermove', pointerEvent({ clientX: 200, clientY: 200 }));
        assert.equal(harness.calls.move.length, 1);

        // 캔버스 밖 (rect: 0,0~800,600) 이동도 한 번만 전달돼야 한다.
        harness.dispatchDocument('pointermove', pointerEvent({ clientX: 900, clientY: 700 }));
        assert.equal(harness.calls.move.length, 2);

        // 무관한 포인터 ID는 무시된다.
        harness.dispatchDocument('pointermove', pointerEvent({ pointerId: 99, clientX: 300, clientY: 300 }));
        assert.equal(harness.calls.move.length, 2);
    } finally {
        harness.restore();
    }
});

test('pointercancel rolls back the pending drag, cancels the tool, and stays idempotent', () => {
    const harness = createPointerHarness();
    try {
        const point = {
            id: 'p1',
            position: { x: 0, y: 0 }
        };
        harness.objects.set('p1', point);

        harness.dispatchCanvas('pointerdown', pointerEvent());
        harness.historyManager.startDrag([point]);
        point.position.x = 5;
        point.position.y = -3;

        harness.dispatchDocument('pointercancel', pointerEvent());

        assert.equal(point.position.x, 0, 'pending drag position must be restored');
        assert.equal(point.position.y, 0);
        assert.equal(harness.historyManager.pendingAction, null);
        assert.equal(harness.calls.cancel, 1, 'tool cancel path must run once');
        assert.equal(harness.calls.up.length, 0, 'cancel must never complete like mouse-up');
        assert.equal(harness.handler.activePointerId, null);
        assert.equal(harness.handler.dragStartPos, null);
        assert.equal(harness.canvasElement.classList.contains('panning'), false);

        // 캡처 소실 통지가 이어져도 두 번 취소되지 않는다.
        harness.dispatchCanvas('lostpointercapture', pointerEvent());
        assert.equal(harness.calls.cancel, 1);

        // 취소 후 히스토리에는 아무것도 기록되지 않는다.
        assert.equal(harness.historyManager.canUndo(), false);
    } finally {
        harness.restore();
    }
});

test('HistoryManager.cancelPendingDrag restores start state and clears the pending action', () => {
    const point = { id: 'p1', position: { x: 1, y: 2 } };
    const objectManager = {
        updateAllCount: 0,
        getObject: id => (id === 'p1' ? point : null),
        updateAll() {
            this.updateAllCount += 1;
        }
    };
    const history = new HistoryManager(objectManager);

    history.startDrag([point]);
    point.position.x = 9;
    point.position.y = 9;

    assert.equal(history.cancelPendingDrag({ restore: true }), true);
    assert.equal(point.position.x, 1);
    assert.equal(point.position.y, 2);
    assert.equal(history.pendingAction, null);
    assert.equal(objectManager.updateAllCount, 1);

    // 이미 취소된 뒤에는 아무 일도 하지 않는다.
    assert.equal(history.cancelPendingDrag({ restore: true }), false);

    // restore:false는 상태를 되돌리지 않고 보류 액션만 버린다.
    history.startDrag([point]);
    point.position.x = 4;
    assert.equal(history.cancelPendingDrag({ restore: false }), true);
    assert.equal(point.position.x, 4);
    assert.equal(history.pendingAction, null);
});

test('SelectTool.cancel ends per-object drags and clears every gesture flag', () => {
    const tool = new SelectTool();
    let endDragCount = 0;
    const draggedObject = {
        endDrag() {
            endDragCount += 1;
        }
    };

    tool.isDragging = true;
    tool.isRotating = true;
    tool.isBoxSelecting = true;
    tool.isShiftDragging = true;
    tool.isMultiDrag = true;
    tool.multiDragStart = new Vec2(1, 1);
    tool.dragStartPositions = new Map([['p1', new Vec2(0, 0)]]);
    tool.draggedObjects = [draggedObject];
    tool.clickStartPos = new Vec2(2, 2);
    tool.clickStartMathPos = new Vec2(2, 2);
    tool.clickStartTime = Date.now();
    tool.emptySpaceClick = true;
    tool.boxStart = new Vec2(0, 0);
    tool.boxEnd = new Vec2(1, 1);

    const app = {
        objectManager: { clearSelection() {} },
        canvasElement: { style: {} },
        render() {}
    };

    tool.cancel(app);

    assert.equal(endDragCount, 1);
    assert.equal(tool.isDragging, false);
    assert.equal(tool.isRotating, false);
    assert.equal(tool.isBoxSelecting, false);
    assert.equal(tool.isShiftDragging, false);
    assert.equal(tool.isMultiDrag, false);
    assert.equal(tool.multiDragStart, null);
    assert.equal(tool.dragStartPositions, null);
    assert.deepEqual(tool.draggedObjects, []);
    assert.equal(tool.clickStartPos, null);
    assert.equal(tool.clickStartMathPos, null);
    assert.equal(tool.clickStartTime, null);
    assert.equal(tool.emptySpaceClick, false);
    assert.equal(tool.boxStart, null);
    assert.equal(tool.boxEnd, null);
});

test('main canvas disables browser touch gestures via touch-action none', () => {
    const styles = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
    assert.match(styles, /#mainCanvas\s*\{[^}]*touch-action:\s*none/s);
});
