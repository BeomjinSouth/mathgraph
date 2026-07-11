# Teacher Site Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the current MathGraph teacher editor as a secure, reference-safe, mobile-usable release with reliable undo and a real deployment gate.

**Architecture:** Preserve the current vanilla HTML/CSS/ES-module architecture. Add small pure utilities for security, object-reference remapping, responsive state, and property-history boundaries; keep UI integration thin. Deliver and review security, copy integrity, responsive input, undo, and release verification as separate commits.

**Tech Stack:** Vanilla JavaScript ES modules, Canvas 2D, Node `node:test`, Vercel Functions, Codex in-app Browser, built-in Image Generation.

## Global Constraints

- Preserve every existing uncommitted July change unless a focused test proves it must change.
- Do not expose, print, commit, or screenshot any secret value.
- Keep GPT-5.5 as the default; GPT-5.6 remains disabled while official docs call it limited partner preview.
- Preserve desktop 1280×720 layout and mouse behavior.
- At 390×844, the canvas must be nonzero/full-width, horizontal overflow must be absent, and side panels must be usable overlay drawers.
- Every production-code behavior change requires a failing regression test observed before implementation.
- Use the in-app Browser first for rendered validation.
- Do not deploy until `OPENAI_API_KEY`, `MATHGRAPH_LOGIN_SECRET`, and `MATHGRAPH_OWNER_PASSWORD` are confirmed in Vercel Production.

---

### Task 0: Preserve the Verified July Groundwork

**Files:**
- Commit existing changes in: `AGENTS.md`, `api/login.js`, `api/openai-responses.js`, `docs/progress-log.md`, `index.html`, `js/ai/AIService.js`, `js/ai/PatchApplier.js`, `js/core/EventHandler.js`, `js/core/HistoryManager.js`, `js/main.js`, `js/ui/CommandPalette.js`, `js/utils/Parser.js`, `js/utils/Html.js`, `lib/ownerAuth.js`, `tests/ai-flow.test.js`, `tests/function-parser.test.js`, `tests/history-transaction.test.js`, `tests/html-escape.test.js`, `tests/owner-auth.test.js`
- Do not stage: `docs/design-references/teacher-workflow/*.png`

**Interfaces:**
- Consumes: the current authoritative dirty worktree and the 219-test green baseline.
- Produces: a clean, reviewable commit that subsequent red-green tasks can diff against.

- [ ] **Step 1: Re-run syntax checks for the existing July runtime/server files**

Run:

```powershell
node --check api/login.js
node --check api/openai-responses.js
node --check lib/ownerAuth.js
node --check js/ai/AIService.js
node --check js/ai/PatchApplier.js
node --check js/core/EventHandler.js
node --check js/core/HistoryManager.js
node --check js/main.js
node --check js/ui/CommandPalette.js
node --check js/utils/Html.js
node --check js/utils/Parser.js
```

Expected: every command exits 0.

- [ ] **Step 2: Re-run the full baseline**

Run: `npm.cmd test` outside the sandbox when Node workers hit `spawn EPERM`.

Expected: `219` passed, `0` failed.

- [ ] **Step 3: Review the exact staged scope**

Run:

```powershell
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors; only the listed July files are selected for the groundwork commit.

- [ ] **Step 4: Commit the groundwork without screenshots**

```powershell
git add AGENTS.md api/login.js api/openai-responses.js docs/progress-log.md index.html js/ai/AIService.js js/ai/PatchApplier.js js/core/EventHandler.js js/core/HistoryManager.js js/main.js js/ui/CommandPalette.js js/utils/Parser.js js/utils/Html.js lib/ownerAuth.js tests/ai-flow.test.js tests/function-parser.test.js tests/history-transaction.test.js tests/html-escape.test.js tests/owner-auth.test.js
git commit -m "Integrate July security and history groundwork"
```

### Task 1: Close Command-Palette and Owner-Login Findings

**Files:**
- Modify: `js/utils/Html.js`
- Modify: `js/ui/CommandPalette.js`
- Modify: `lib/ownerAuth.js`
- Modify: `api/login.js`
- Modify: `tests/html-escape.test.js`
- Modify: `tests/owner-auth.test.js`
- Create: `tests/login-handler.test.js`

**Interfaces:**
- Consumes: `escapeHtml(value)`, `checkRateLimit(key, options)`, and owner login JSON `{name,password}`.
- Produces: `escapeRegExp(value)`, `getClientAddress(req)`, `getLoginRateOptions()`, `resetRateLimitKey(key)`, and a rate-limited login handler.

- [ ] **Step 1: Write failing palette and utility tests**

Add to `tests/html-escape.test.js`:

```js
import { escapeHtml, escapeRegExp } from '../js/utils/Html.js';

test('escapeRegExp neutralizes regex metacharacters', () => {
    assert.equal(escapeRegExp('a+b?(c)[d]'), 'a\\+b\\?\\(c\\)\\[d\\]');
});
```

Create `tests/command-palette-security.test.js`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAlgebraHintMarkup, highlightCommandMatch } from '../js/ui/CommandPalette.js';

test('algebra hint escapes attacker-controlled query text', () => {
    const markup = buildAlgebraHintMarkup('<img src=x onerror="globalThis.pwned=1">');
    assert.doesNotMatch(markup, /<img\b/i);
    assert.match(markup, /&lt;img/);
});

test('command highlighting treats regex syntax as literal text', () => {
    assert.equal(highlightCommandMatch('a+b command', 'a+b'), '<mark>a+b</mark> command');
});
```

- [ ] **Step 2: Run the palette tests and verify RED**

Run: `node --test tests/html-escape.test.js tests/command-palette-security.test.js`

Expected: FAIL because `escapeRegExp`, `buildAlgebraHintMarkup`, and `highlightCommandMatch` do not exist.

- [ ] **Step 3: Implement safe palette rendering helpers**

Add to `js/utils/Html.js`:

```js
export function escapeRegExp(value) {
    return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

In `js/ui/CommandPalette.js`, import both helpers and export:

```js
export function buildAlgebraHintMarkup(query) {
    const safeQuery = escapeHtml(query);
    return `<div class="command-item algebra-hint" data-action="algebra">
        <div class="command-icon">${iconHTML('functions')}</div>
        <div class="command-info">
            <div class="command-name">"${safeQuery}" 대수식으로 생성</div>
            <div class="command-category">Enter를 눌러 생성</div>
        </div>
    </div>`;
}

export function highlightCommandMatch(text, query) {
    const safeText = escapeHtml(text);
    if (!query) return safeText;
    return safeText.replace(new RegExp(`(${escapeRegExp(query)})`, 'gi'), '<mark>$1</mark>');
}
```

Route `renderResults()` and the instance `highlightMatch()` through these helpers.

- [ ] **Step 4: Write failing owner-auth boundary tests**

Add to `tests/owner-auth.test.js`:

```js
test('readJson enforces the byte limit for pre-parsed object bodies', async () => {
    await assert.rejects(
        readJson({ body: { value: 'x'.repeat(128) } }, { maxBytes: 16 }),
        PayloadTooLargeError
    );
});

test('resetRateLimitKey clears only the selected bucket', () => {
    resetRateLimit();
    checkRateLimit('a', { windowMs: 1000, max: 1 });
    checkRateLimit('b', { windowMs: 1000, max: 1 });
    resetRateLimitKey('a');
    assert.equal(checkRateLimit('a', { windowMs: 1000, max: 1 }).allowed, true);
    assert.equal(checkRateLimit('b', { windowMs: 1000, max: 1 }).allowed, false);
});
```

Create `tests/login-handler.test.js` with a small response recorder and these cases:

```js
test('owner login blocks the eleventh invalid attempt for one address and name', async () => {
    for (let i = 0; i < 10; i += 1) {
        assert.equal((await invokeLogin({ name: OWNER_NAME, password: 'wrong' })).statusCode, 401);
    }
    const blocked = await invokeLogin({ name: OWNER_NAME, password: 'wrong' });
    assert.equal(blocked.statusCode, 429);
    assert.ok(blocked.headers['Retry-After']);
});

test('valid owner credentials still return a token within the attempt budget', async () => {
    const response = await invokeLogin({ name: OWNER_NAME, password: 'correct-password' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.mode, 'owner');
});
```

The helper sets `MATHGRAPH_LOGIN_SECRET`, `MATHGRAPH_OWNER_PASSWORD`, `x-forwarded-for`, and resets rate buckets between tests.

- [ ] **Step 5: Run owner tests and verify RED**

Run: `node --test tests/owner-auth.test.js tests/login-handler.test.js`

Expected: FAIL on parsed-object size enforcement, missing bucket reset, and missing login 429 behavior.

- [ ] **Step 6: Implement the owner security boundary**

In `lib/ownerAuth.js`:

```js
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export function safeEqual(left, right) {
    const digest = (value) => createHash('sha256').update(String(value ?? ''), 'utf8').digest();
    return timingSafeEqual(digest(left), digest(right));
}

export function getClientAddress(req) {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req.socket?.remoteAddress || 'unknown';
}

export function getLoginRateOptions() {
    const windowMs = Number(process.env.MATHGRAPH_LOGIN_RATE_WINDOW_MS) || 15 * 60 * 1000;
    const max = Number(process.env.MATHGRAPH_LOGIN_RATE_MAX) || 10;
    return { windowMs, max };
}

export function resetRateLimitKey(key) {
    rateBuckets.delete(key);
}
```

For object-valued `req.body`, serialize and measure it before returning it. In `api/login.js`, derive `login:${address}:${normalizedName}`, call the limiter before credential comparison, return 429 with `Retry-After`, and reset that bucket after successful authentication.

- [ ] **Step 7: Verify GREEN and commit**

Run:

```powershell
node --test tests/html-escape.test.js tests/command-palette-security.test.js tests/owner-auth.test.js tests/login-handler.test.js
node --check js/ui/CommandPalette.js
node --check lib/ownerAuth.js
node --check api/login.js
```

Expected: all pass.

Commit:

```powershell
git add js/utils/Html.js js/ui/CommandPalette.js lib/ownerAuth.js api/login.js tests/html-escape.test.js tests/command-palette-security.test.js tests/owner-auth.test.js tests/login-handler.test.js
git commit -m "Close owner login and command palette findings"
```

### Task 2: Constrain and Time-bound the OpenAI Proxy

**Files:**
- Modify: `lib/ownerAuth.js`
- Modify: `api/openai-responses.js`
- Modify: `js/ai/AIService.js`
- Modify: `tests/owner-auth.test.js`
- Create: `tests/openai-proxy-handler.test.js`
- Modify: `tests/ai-flow.test.js`

**Interfaces:**
- Produces: `ProxyRequestError`, `sanitizeProxyRequestBody(body)`, `getProxyTimeoutMs()`, `fetchWithTimeout(url, init, timeoutMs)`.
- Preserves: current Structured Outputs text/image bodies and owner bearer authentication.
- Migrates: legacy `graphA_ai_config.apiKey` into session-only storage and removes it from persistent storage during load.

- [ ] **Step 1: Write failing request-policy tests**

Add cases that prove:

```js
const sanitized = sanitizeProxyRequestBody({
    model: 'gpt-5.5', input: [{ role: 'user', content: 'x' }],
    reasoning: { effort: 'low' }, text: { format: { type: 'text' } }, store: true
});
assert.equal(sanitized.store, false);
assert.equal(sanitized.max_output_tokens, 16384);
assert.throws(() => sanitizeProxyRequestBody({ model: 'gpt-5.5', input: [], tools: [{ type: 'web_search' }] }), ProxyRequestError);
assert.throws(() => sanitizeProxyRequestBody({ model: 'gpt-5.5', input: [], service_tier: 'priority' }), ProxyRequestError);
```

Add a proxy handler test that signs two tokens for the same owner, exhausts the first token's budget, and confirms the second token receives `429` because the key is the verified subject.

- [ ] **Step 2: Run policy tests and verify RED**

Run: `node --test tests/owner-auth.test.js tests/openai-proxy-handler.test.js`

Expected: FAIL because the policy helpers and subject limiter do not exist.

- [ ] **Step 3: Implement server-owned request policy**

In `lib/ownerAuth.js`:

```js
const PROXY_INPUT_FIELDS = new Set(['model', 'input', 'reasoning', 'text', 'previous_response_id', 'store']);

export class ProxyRequestError extends Error {}

export function sanitizeProxyRequestBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ProxyRequestError('Invalid request body.');
    const forbidden = Object.keys(body).filter((key) => !PROXY_INPUT_FIELDS.has(key));
    if (forbidden.length) throw new ProxyRequestError(`Unsupported fields: ${forbidden.join(', ')}`);
    return {
        model: body.model,
        input: body.input,
        reasoning: body.reasoning,
        text: body.text,
        ...(body.previous_response_id && { previous_response_id: body.previous_response_id }),
        store: false,
        max_output_tokens: Number(process.env.MATHGRAPH_PROXY_MAX_OUTPUT_TOKENS) || 16384
    };
}

export function getProxyTimeoutMs() {
    return Number(process.env.MATHGRAPH_PROXY_TIMEOUT_MS) || 120000;
}
```

In the handler, sanitize before fetch, key `checkRateLimit()` with `proxy:${tokenResult.payload.sub}:${tokenResult.payload.name}`, pass an AbortController signal, clear the timer, and return `504` for abort timeout.

- [ ] **Step 4: Write and verify the client timeout RED test**

Add to `tests/ai-flow.test.js`:

- a mocked fetch that waits for `init.signal.abort`, then assert `callOpenAI()` rejects with a Korean retryable timeout message;
- a legacy-storage test where `graphA_ai_config` contains `apiKey`, then assert `AIServiceConfig.fromStorage()` keeps the key available for the session, removes it from the rewritten local record, and does not overwrite an existing session key.

Run the focused tests and confirm they fail because no signal is supplied and the legacy key remains persisted.

- [ ] **Step 5: Implement client fetch timeout**

Add:

```js
export async function fetchWithTimeout(url, init = {}, timeoutMs = 125000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
        if (error?.name === 'AbortError') throw new Error('AI 요청 시간이 초과되었습니다. 잠시 후 다시 시도하세요.');
        throw error;
    } finally {
        clearTimeout(timer);
    }
}
```

Use it for both OpenAI text and image calls. In `AIServiceConfig.fromStorage()`, extract any legacy `apiKey` before assigning public settings, preserve an existing session key when present, otherwise copy the legacy key into session storage, and immediately rewrite `graphA_ai_config` without the secret.

- [ ] **Step 6: Verify and commit**

Run focused tests, syntax checks, then `npm.cmd test`.

Expected: all tests pass and the total exceeds 219.

Commit: `git commit -m "Constrain and time-bound the OpenAI proxy"` with only Task 2 files staged.

### Task 3: Centralize Composite Object Reference Remapping

**Files:**
- Create: `js/utils/ObjectReferences.js`
- Modify: `js/main.js`
- Modify: `js/ai/PatchApplier.js`
- Create: `tests/object-reference-remap.test.js`
- Modify: `tests/history-transaction.test.js`

**Interfaces:**
- Produces: `remapObjectReferences(data, idMap)` returning a shallow-cloned object with cloned/remapped ID arrays.

- [ ] **Step 1: Write failing table-driven tests**

Cover the complete runtime reference contract:

```js
const SINGLE_REFERENCE_FIELDS = [
    'point1Id', 'point2Id', 'point3Id', 'centerId', 'pointOnCircleId',
    'originId', 'directionPointId', 'lineId', 'circleId', 'segmentId',
    'circle1Id', 'circle2Id', 'object1Id', 'object2Id', 'baseLineId',
    'throughPointId', 'startPointId', 'endPointId', 'functionId', 'vertexId',
    'line1Id', 'line2Id', 'segment1Id', 'segment2Id', 'tangentPointId', 'apexId'
];
const ARRAY_REFERENCE_FIELDS = ['dependencies', 'vertexIds', 'baseVertexIds', 'topVertexIds', 'boundaryObjectIds'];
```

Assert every `old-*` value becomes `new-*`, unknown external IDs remain unchanged, and the source object/arrays are not mutated. Add paste integration cases for polygon, lens, prism, tangent circle, and closed region serialized data.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/object-reference-remap.test.js tests/history-transaction.test.js`

Expected: FAIL because the shared remapper does not exist and paste/redo retains original references.

- [ ] **Step 3: Implement the shared remapper**

`js/utils/ObjectReferences.js` exports the complete existing single-reference list from `PatchApplier` plus the array list above:

```js
export function remapObjectReferences(data, idMap) {
    const resolved = { ...data };
    for (const field of SINGLE_REFERENCE_FIELDS) {
        if (resolved[field] && idMap.has(resolved[field])) resolved[field] = idMap.get(resolved[field]);
    }
    for (const field of ARRAY_REFERENCE_FIELDS) {
        if (Array.isArray(resolved[field])) resolved[field] = resolved[field].map((id) => idMap.get(id) || id);
    }
    return resolved;
}
```

Replace both duplicated mapping blocks with this helper.

- [ ] **Step 4: Verify independence and undo/redo GREEN**

Run focused tests. For all five composite families, move an original dependency after paste and prove the pasted object remains bound only to its copied dependency, then undo once and redo once and recheck every remapped ID.

- [ ] **Step 5: Commit**

Commit: `git commit -m "Keep copied geometry references independent"`.

### Task 4: Generate the Mobile Target and Implement Responsive Drawers

**Files:**
- Create: `docs/design-references/teacher-workflow/mobile-responsive-target-2026-07-10.png`
- Create: `js/utils/ResponsiveLayout.js`
- Modify: `css/styles.css`
- Modify: `js/main.js`
- Create: `tests/responsive-layout.test.js`

**Interfaces:**
- Produces: `isCompactViewport(width)` and `nextCompactPanelState(state, action)`.
- Preserves: desktop panel widths and existing panel IDs/classes.

- [ ] **Step 1: Generate the 16:9 target design sheet**

Use the built-in image generator with this exact prompt:

```text
Use case: ui-mockup
Asset type: responsive MathGraph teacher-editor target design sheet
Primary request: create a polished 16:9 design sheet showing two side-by-side 390×844 mobile states of the existing dark glass MathGraph editor: state 1 is canvas-first with both drawers closed; state 2 has the left tool drawer open over the canvas while the canvas remains visible.
Style/medium: realistic shippable product UI, not concept art; preserve the existing dark navy glass panels, cyan accent, monochrome math canvas, rounded controls, and compact Korean teacher-tool hierarchy.
Composition/framing: 16:9 landscape board, two full phone viewports side by side, equal scale, clear spacing.
Text (verbatim): "MathGraph", "도구", "속성", "AI 도우미", "점", "선", "원", "함수"
Constraints: render the quoted Korean text exactly; no extra slogans; no logos other than the MathGraph wordmark; no watermark; the default state must devote almost the full phone width to the coordinate canvas; drawer width must leave a visible canvas strip and an always-accessible close control.
Avoid: bottom navigation redesign, colorful illustration, fake browser chrome, tiny unreadable labels.
```

Inspect the result, confirm the two states and text, and copy the selected output into the exact workspace path above.

- [ ] **Step 2: Write failing responsive-state tests**

```js
assert.equal(isCompactViewport(390), true);
assert.equal(isCompactViewport(900), true);
assert.equal(isCompactViewport(901), false);
assert.deepEqual(nextCompactPanelState({ toolOpen: false, propertyOpen: false }, 'openTool'), { toolOpen: true, propertyOpen: false });
assert.deepEqual(nextCompactPanelState({ toolOpen: true, propertyOpen: false }, 'openProperty'), { toolOpen: false, propertyOpen: true });
```

Run and verify RED.

- [ ] **Step 3: Implement responsive state and drawer integration**

Create the pure helper, then in `main.js`:

- enter compact mode at `matchMedia('(max-width: 900px)')`;
- initialize both panels collapsed;
- opening one collapses the other;
- restore remembered desktop collapsed states when leaving compact mode;
- add a `ResizeObserver` on `#canvas-container` that schedules one `canvas.resize(); render();` per animation frame.

- [ ] **Step 4: Add final-cascade CSS at the end of `styles.css`**

Use:

```css
@media (max-width: 900px) {
    #main-content { position: relative; min-width: 0; }
    #canvas-container { min-width: 0; width: 100%; }
    #tool-panel, #property-panel {
        position: absolute;
        top: 0;
        bottom: 0;
        z-index: 240;
        width: min(320px, calc(100vw - 48px));
        max-width: calc(100vw - 48px);
        transition: transform var(--transition-normal);
    }
    #tool-panel { left: 0; }
    #property-panel { right: 0; }
    #tool-panel.collapsed { transform: translateX(-100%); }
    #property-panel.collapsed { transform: translateX(100%); }
    .sidebar-toggles { z-index: 260; }
    #chat-panel { right: 8px; width: min(var(--chat-width), calc(100vw - 16px)); }
}
```

Adjust selectors to the existing collapsed implementation without changing desktop rules.

- [ ] **Step 5: Verify unit tests and desktop/mobile rendered layout**

Run focused tests, then use the in-app Browser at 1280×720 and 390×844. Record canvas/container widths, scroll width, drawer states, chat bounds, DOM snapshot, console logs, and screenshots.

- [ ] **Step 6: Commit**

Commit: `git commit -m "Add canvas-first mobile editor drawers"`.

### Task 5: Add Primary Touch and Pen Input

**Files:**
- Modify: `js/core/EventHandler.js`
- Modify: `css/styles.css`
- Create: `tests/pointer-input.test.js`

**Interfaces:**
- Produces: `activePointerId`, touch/pen bridge handlers, and pointer-cancel cleanup.
- Preserves: all existing mouse listeners and shortcuts.

- [ ] **Step 1: Write failing fake-DOM pointer tests**

Test that primary touch registers once, compatibility mouse is ignored during that pointer, non-primary touch is ignored, modifiers/button values reach the existing handler, and `pointercancel` clears `isDragging`, `isPanning`, `dragStartPos`, `draggedObject`, and `activePointerId`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/pointer-input.test.js`.

Expected: FAIL because pointer listeners and state do not exist.

- [ ] **Step 3: Implement the bridge**

Register `pointerdown` on the canvas and `pointermove`, `pointerup`, `pointercancel` on `document`. Only handle `isPrimary && (pointerType === 'touch' || pointerType === 'pen')`; call `preventDefault()`, capture the pointer where supported, and delegate to existing mouse-path methods. Set `#mainCanvas { touch-action: none; }`.

- [ ] **Step 4: Verify GREEN and browser interaction**

Run focused/full tests. In the in-app Browser, dispatch one touch-like pointer to create exactly one point, drag it, cancel a second drag, and prove internal state cleanup. Recheck desktop mouse click, drag, right/middle/Alt/Space pan, wheel, and double-click.

- [ ] **Step 5: Commit**

Commit: `git commit -m "Support primary touch and pen drawing"`.

### Task 6: Close Priority Undo Consistency Gaps

**Files:**
- Modify: `js/core/HistoryManager.js`
- Modify: `js/main.js`
- Modify: `js/ui/CommandPalette.js`
- Create: `js/utils/HistoryEdits.js`
- Modify: `tests/history-transaction.test.js`
- Create: `tests/history-state.test.js`
- Create: `tests/history-edits.test.js`

**Interfaces:**
- Produces: authoritative drag state for point-on-line `t`, point-on-circle `angle`, and number-line `y`; complete transaction snapshots; invariant-safe property restoration; `applyRecordedPropertyChange(...)`.

- [ ] **Step 1: Write failing history-state tests**

Cover:

- point-on-segment `t: 0.2 → 0.8 → undo → 0.2 → redo → 0.8`;
- point-on-circle angle round trip;
- number-line `y` drag round trip;
- snapshot/restore of `transactionDepth` and `transactionBuffer`;
- point/function algebra creation produces one create action;
- circle algebra creation produces one atomic batch containing both helper points and the circle;
- point coordinate undo preserves its `Vec2`/`setPosition()` behavior and function-expression undo rebuilds parser state through `setExpression()`.

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/history-transaction.test.js tests/history-state.test.js tests/history-edits.test.js`.

- [ ] **Step 3: Implement authoritative state capture**

Use this ordering:

```js
getObjectState(obj) {
    if (obj.type === 'pointOnLine' && obj.t !== undefined) return { t: obj.t };
    if (obj.type === 'pointOnCircle' && obj.angle !== undefined) return { angle: obj.angle };
    if (obj.type === 'numberLine' && obj.y !== undefined) return { y: obj.y };
    if (obj.position) return { x: obj.position.x, y: obj.position.y };
    if (obj.x !== undefined || obj.y !== undefined) return { x: obj.x, y: obj.y };
    return {};
}
```

Restore the matching fields and call `objectManager.updateAll()`. Include transaction depth/buffer in snapshot and restore. Do not treat every object with an `angle` property as a constrained point because dimensions use angle-like display state for different behavior.

- [ ] **Step 4: Implement recorded property edits**

`applyRecordedPropertyChange()` clones old/new values, skips equality, applies through an optional invariant-safe setter, and calls `historyManager.recordPropertyChange(object.id, property, oldValue, newValue)`. Route property-panel label, color, point size, line width, coordinates, function expression/ranges, and dimension text/format controls through it. Capture continuous range/color edits at focus/start and record once on change/end. In `HistoryManager.setPropertyValue()`, route position restoration through `setPosition()` and expression restoration through `setExpression()` instead of replacing runtime `Vec2` or parser state with plain values.

In `CommandPalette.executeAlgebra()`, capture object IDs before parsing, begin a transaction, then record every object added by a successful parse. Commit the delta so point/function creation stays one action and circle creation (center, radius point, circle) is one atomic batch; abort the transaction on failure.

- [ ] **Step 5: Verify GREEN and browser undo flows**

Run focused/full tests. Browser-check label edit, color edit, coordinate edit, function expression edit, point/function/circle algebra creation, constrained-point drag, number-line drag, AI batch, and paste batch, each with one undo/redo cycle. Record specialized composite/label/dimension drag adapters not covered by the named release paths as explicit follow-up rather than claiming universal undo coverage.

- [ ] **Step 6: Commit**

Commit: `git commit -m "Make teacher edits consistently undoable"`.

### Task 7: Replace the No-op Build Gate and Synchronize Documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/ai-reference.md`
- Modify: `AGENTS.md`
- Modify: `.agent/prd.md`
- Modify: `.agent/implementation_tracking.md`
- Modify: `.agent/skills_context.md`
- Modify: `docs/progress-log.md`
- Modify: `docs/teacher-site-readiness-audit-2026-07-10.md`

- [ ] **Step 1: Make build commands real**

Change scripts to:

```json
"build": "node --test",
"test": "node --test",
"vercel-build": "node --test"
```

- [ ] **Step 2: Update environment and user documentation**

Document `MATHGRAPH_LOGIN_RATE_WINDOW_MS`, `MATHGRAPH_LOGIN_RATE_MAX`, `MATHGRAPH_PROXY_MAX_OUTPUT_TOKENS`, and `MATHGRAPH_PROXY_TIMEOUT_MS`; correct name-only login/session-storage notes; describe responsive drawers, touch/pen scope, copy integrity, and undo behavior.

- [ ] **Step 3: Close planning checklists with evidence only**

Mark an acceptance item complete only after its focused and full verification has passed. Add official OpenAI source URLs for Models, Responses create, production best practices, and rate limits.

- [ ] **Step 4: Run documentation/build verification**

Run:

```powershell
npm.cmd test
npm.cmd run vercel-build
git diff --check
```

Expected: both suites pass with the same test count; no whitespace errors.

- [ ] **Step 5: Commit**

Commit: `git commit -m "Enforce release verification and update teacher docs"`.

### Task 8: Final Review, GitHub Push, Vercel Deployment, and Production QA

**Files:**
- No source changes unless reviewers find a defect.
- Update: `docs/progress-log.md` only when recording final external outcomes.

- [ ] **Step 1: Run the complete local gate fresh**

Run full tests, Vercel build, syntax checks for all changed JS files, `git diff --check`, and `git status --short`.

- [ ] **Step 2: Run broad code and security review**

Review the full branch diff against the design. Fix every Critical/Important finding with focused tests and re-review.

- [ ] **Step 3: Run in-app Browser QA**

Check desktop 1280×720, mobile 390×844, tablet 768×1024, and landscape 1024×768. Verify page identity, meaningful DOM, no overlay, console health, screenshots, guest flow, manual drawing, AI panel, copy/undo, drawers, chat bounds, touch/pen, and desktop input regression.

- [ ] **Step 4: Confirm production prerequisites**

Run `npx.cmd vercel env ls` and confirm the three required variable names without exposing values. If `MATHGRAPH_OWNER_PASSWORD` is missing, do not deploy until it is safely added through Vercel's secret prompt or the user-controlled dashboard.

- [ ] **Step 5: Push the verified branch**

```powershell
git push origin codex/ai-fallback-recovery
```

- [ ] **Step 6: Deploy and inspect**

Run `npx.cmd vercel deploy --prod --yes`, inspect the returned URL, confirm `target=production`, `status=Ready`, primary alias attachment, and HTTP 200.

- [ ] **Step 7: Repeat production browser smoke**

Repeat the desktop/mobile core flows against `https://mathgraph-five.vercel.app`, including owner login only when the required password is available without exposing it.

- [ ] **Step 8: Record final outcome and close the goal**

Update `docs/progress-log.md`, commit and push the final log, verify branch synchronization, and mark the goal complete only when every design acceptance criterion has authoritative evidence or the strict repeated external-blocker rule is satisfied.
