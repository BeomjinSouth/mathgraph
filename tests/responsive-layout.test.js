import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
    createAnimationFrameCoalescer,
    isCompactViewport,
    nextCompactPanelState
} from '../js/utils/ResponsiveLayout.js';

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
globalThis.document = { addEventListener() {} };
globalThis.window = {};
const { default: GraphAApp } = await import('../js/main.js');
if (originalDocument === undefined) delete globalThis.document;
else globalThis.document = originalDocument;
if (originalWindow === undefined) delete globalThis.window;
else globalThis.window = originalWindow;

function fakeElement(initialClasses = []) {
    const classes = new Set(initialClasses);
    const attributes = new Map();
    return {
        classList: {
            contains(name) {
                return classes.has(name);
            },
            toggle(name, force) {
                const enabled = force === undefined ? !classes.has(name) : Boolean(force);
                if (enabled) classes.add(name);
                else classes.delete(name);
                return enabled;
            }
        },
        querySelector() {
            return null;
        },
        setAttribute(name, value) {
            attributes.set(name, String(value));
        },
        getAttribute(name) {
            return attributes.get(name);
        }
    };
}

test('compact breakpoint includes 900px but not 901px', () => {
    assert.equal(isCompactViewport(390), true);
    assert.equal(isCompactViewport(900), true);
    assert.equal(isCompactViewport(901), false);
});

test('opening a compact drawer closes the opposite drawer', () => {
    assert.deepEqual(
        nextCompactPanelState({ toolOpen: false, propertyOpen: false }, 'openTool'),
        { toolOpen: true, propertyOpen: false }
    );
    assert.deepEqual(
        nextCompactPanelState({ toolOpen: true, propertyOpen: false }, 'openProperty'),
        { toolOpen: false, propertyOpen: true }
    );
});

test('compact drawer toggles can close the currently open drawer', () => {
    assert.deepEqual(
        nextCompactPanelState({ toolOpen: true, propertyOpen: false }, 'toggleTool'),
        { toolOpen: false, propertyOpen: false }
    );
    assert.deepEqual(
        nextCompactPanelState({ toolOpen: false, propertyOpen: true }, 'toggleProperty'),
        { toolOpen: false, propertyOpen: false }
    );
});

test('animation-frame coalescer runs one resize callback per frame', () => {
    const queuedFrames = [];
    let resizeCount = 0;
    const schedule = createAnimationFrameCoalescer(
        () => { resizeCount += 1; },
        callback => queuedFrames.push(callback)
    );

    schedule();
    schedule();

    assert.equal(queuedFrames.length, 1);
    assert.equal(resizeCount, 0);

    queuedFrames.shift()(16);
    assert.equal(resizeCount, 1);

    schedule();
    assert.equal(queuedFrames.length, 1);
});

function createResponsiveHarness() {
    const toolPanel = fakeElement();
    const propertyPanel = fakeElement(['collapsed']);
    const leftToggle = fakeElement();
    const rightToggle = fakeElement();
    const canvasContainer = fakeElement();
    const elements = new Map([
        ['tool-panel', toolPanel],
        ['property-panel', propertyPanel],
        ['toggleLeftSidebar', leftToggle],
        ['toggleRightSidebar', rightToggle],
        ['canvas-container', canvasContainer]
    ]);
    const mediaQuery = {
        matches: true,
        addEventListener(type, listener) {
            assert.equal(type, 'change');
            this.listener = listener;
        }
    };
    const state = {
        frames: [],
        observedTarget: null,
        resizeObserverCallback: null,
        resizeCount: 0,
        renderCount: 0
    };
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    const previousResizeObserver = globalThis.ResizeObserver;

    globalThis.document = {
        getElementById(id) {
            return elements.get(id) || null;
        }
    };
    globalThis.window = {
        innerWidth: 390,
        matchMedia(query) {
            assert.equal(query, '(max-width: 900px)');
            return mediaQuery;
        },
        requestAnimationFrame(callback) {
            state.frames.push(callback);
        }
    };
    globalThis.ResizeObserver = class {
        constructor(callback) {
            state.resizeObserverCallback = callback;
        }

        observe(target) {
            state.observedTarget = target;
        }
    };

    const app = Object.assign(Object.create(GraphAApp.prototype), {
        canvas: { resize() { state.resizeCount += 1; } },
        render() { state.renderCount += 1; }
    });

    const restore = () => {
        if (previousDocument === undefined) delete globalThis.document;
        else globalThis.document = previousDocument;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
        if (previousResizeObserver === undefined) delete globalThis.ResizeObserver;
        else globalThis.ResizeObserver = previousResizeObserver;
    };

    return { app, toolPanel, propertyPanel, leftToggle, rightToggle, canvasContainer, mediaQuery, state, restore };
}

test('compact integration closes both drawers, keeps them exclusive, and restores desktop state', () => {
    const harness = createResponsiveHarness();
    const { app, toolPanel, propertyPanel, leftToggle, rightToggle, canvasContainer, mediaQuery, state } = harness;
    const { frames } = state;

    try {

        GraphAApp.prototype.setupResponsiveLayout.call(app);
        assert.equal(toolPanel.classList.contains('collapsed'), true);
        assert.equal(propertyPanel.classList.contains('collapsed'), true);
        assert.equal(leftToggle.getAttribute('aria-expanded'), 'false');
        assert.equal(rightToggle.getAttribute('aria-expanded'), 'false');

        GraphAApp.prototype.toggleToolPanel.call(app);
        assert.equal(toolPanel.classList.contains('collapsed'), false);
        assert.equal(propertyPanel.classList.contains('collapsed'), true);

        GraphAApp.prototype.togglePropertyPanel.call(app);
        assert.equal(toolPanel.classList.contains('collapsed'), true);
        assert.equal(propertyPanel.classList.contains('collapsed'), false);

        assert.equal(state.observedTarget, canvasContainer);
        state.resizeObserverCallback();
        state.resizeObserverCallback();
        assert.equal(frames.length, 1);
        assert.equal(state.resizeCount, 0);
        frames.shift()(16);
        assert.equal(state.resizeCount, 1);
        assert.equal(state.renderCount, 1);

        mediaQuery.listener({ matches: false });
        assert.equal(toolPanel.classList.contains('collapsed'), false);
        assert.equal(propertyPanel.classList.contains('collapsed'), true);
        assert.equal(leftToggle.getAttribute('aria-expanded'), 'true');
        assert.equal(rightToggle.getAttribute('aria-expanded'), 'false');
    } finally {
        harness.restore();
    }
});

test('resize resyncs layout mode when media query change events are missed', () => {
    const harness = createResponsiveHarness();
    const { app, toolPanel, propertyPanel, mediaQuery, state } = harness;

    try {
        GraphAApp.prototype.setupResponsiveLayout.call(app);
        assert.equal(app.isCompactLayout, true);
        assert.equal(toolPanel.classList.contains('collapsed'), true);
        assert.equal(propertyPanel.classList.contains('collapsed'), true);

        // 임베디드 웹뷰 등에서 change 이벤트 없이 뷰포트만 커진 상황을 재현한다.
        // 모드 재동기화는 rAF가 멈춘 환경에서도 동작해야 하므로 프레임 실행 전에 검증한다.
        mediaQuery.matches = false;
        state.resizeObserverCallback();

        assert.equal(app.isCompactLayout, false);
        assert.equal(toolPanel.classList.contains('collapsed'), false);
        assert.equal(propertyPanel.classList.contains('collapsed'), true);

        // 반대로 change 이벤트 없이 다시 좁아진 경우도 복구되어야 한다.
        mediaQuery.matches = true;
        state.resizeObserverCallback();

        assert.equal(app.isCompactLayout, true);
        assert.equal(toolPanel.classList.contains('collapsed'), true);
        assert.equal(propertyPanel.classList.contains('collapsed'), true);
    } finally {
        harness.restore();
    }
});

test('mobile cascade keeps the canvas full width and panels as viewport-clamped overlay drawers', () => {
    const styles = readFileSync(new URL('../css/styles.css', import.meta.url), 'utf8');
    const compactCascade = styles.split('/* Canvas-first compact drawers */')[1] || '';

    assert.match(compactCascade, /@media\s*\(max-width:\s*900px\)/);
    assert.match(compactCascade, /#canvas-container\s*\{[^}]*width:\s*100%/s);
    assert.match(compactCascade, /#tool-panel,\s*#property-panel\s*\{[^}]*position:\s*absolute/s);
    assert.match(compactCascade, /width:\s*min\(320px,\s*calc\(100vw\s*-\s*48px\)\)/);
    assert.match(compactCascade, /#tool-panel\.collapsed\s*\{[^}]*translateX\(-100%\)/s);
    assert.match(compactCascade, /#property-panel\.collapsed\s*\{[^}]*translateX\(100%\)/s);
    assert.match(compactCascade, /#chat-panel\s*\{[^}]*calc\(100vw\s*-\s*16px\)/s);
});
