# Teacher Exam-Diagram Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a canvas-first teacher workflow with portable projects, print-sized export, missing exam-diagram primitives, AI support warnings, and accessible non-overlapping controls.

**Architecture:** Add small pure utility and UI modules around the existing vanilla-JavaScript application, then integrate new objects through the existing ObjectManager/AI pipeline. Preserve current geometry behavior and local autosave; validate every new contract before it mutates the canvas.

**Tech Stack:** Vanilla ES modules, HTML canvas, Node test runner, Playwright browser verification, Vercel static deployment.

## Global Constraints

- Do not add first-class statistical chart objects.
- Preserve existing dark navy, white canvas, purple accent, and Noto Sans KR visual language.
- Default diagram strokes and fills remain monochrome black.
- Keep current local autosave, PNG/SVG export, history transactions, and existing object JSON compatible.
- Do not add runtime dependencies.
- The 1280 × 720 viewport must keep canvas, AI prompt, primary action, and export control visible.
- Project import must validate before mutating the current canvas.
- Every production behavior follows a red-green-refactor test cycle.

---

### Task 1: Portable project and physical export foundations

**Files:**
- Create: `js/utils/ProjectFile.js`
- Create: `js/utils/TeacherExport.js`
- Create: `tests/project-file.test.js`
- Create: `tests/teacher-export.test.js`
- Modify: `js/main.js`
- Modify: `index.html`

**Interfaces:**
- Produces: `createProjectEnvelope({ name, savedAt, view, objects })`
- Produces: `validateProjectEnvelope(value)`
- Produces: `parseProjectFile(text)`
- Produces: `getPhysicalExportPlan({ widthMm, dpi, sourceWidth, sourceHeight, maxPixels })`
- Consumes: `ObjectManager.toJSON()`, `ObjectManager.fromJSON()`, canvas offset and scale.

- [ ] **Step 1: Write failing project-envelope tests**

```js
test('project envelope round-trips a named document', () => {
  const envelope = createProjectEnvelope({
    name: '수학 모의고사 12번',
    savedAt: '2026-07-10T00:00:00.000Z',
    view: { offset: { x: 1, y: 2 }, scale: 50 },
    objects: [{ id: 'A', type: 'point', x: 0, y: 0 }]
  });
  assert.equal(validateProjectEnvelope(envelope).valid, true);
  assert.equal(parseProjectFile(JSON.stringify(envelope)).name, '수학 모의고사 12번');
});

test('project parsing rejects unknown versions before returning objects', () => {
  assert.throws(
    () => parseProjectFile('{"format":"mathgraph-project","version":2,"objects":[]}'),
    /지원하지 않는 프로젝트 버전/
  );
});
```

- [ ] **Step 2: Run project tests and verify RED**

Run: `node --test tests/project-file.test.js`

Expected: FAIL because `js/utils/ProjectFile.js` does not exist.

- [ ] **Step 3: Implement the project envelope**

```js
export const PROJECT_FORMAT = 'mathgraph-project';
export const PROJECT_VERSION = 1;

export function createProjectEnvelope({ name, savedAt = new Date().toISOString(), view, objects }) {
  const envelope = {
    format: PROJECT_FORMAT,
    version: PROJECT_VERSION,
    name: String(name || '이름 없는 프로젝트').trim() || '이름 없는 프로젝트',
    savedAt,
    view: {
      offset: { x: Number(view?.offset?.x) || 0, y: Number(view?.offset?.y) || 0 },
      scale: Number(view?.scale) || 50
    },
    objects: Array.isArray(objects) ? objects : []
  };
  const result = validateProjectEnvelope(envelope);
  if (!result.valid) throw new Error(result.errors.join('\n'));
  return envelope;
}
```

- [ ] **Step 4: Write failing physical-export tests**

```js
test('80 mm at 300 dpi produces a 945 pixel wide export', () => {
  const plan = getPhysicalExportPlan({
    widthMm: 80,
    dpi: 300,
    sourceWidth: 1600,
    sourceHeight: 900
  });
  assert.equal(plan.width, 945);
  assert.equal(plan.height, 532);
});

test('physical export rejects an unsafe pixel budget', () => {
  assert.throws(
    () => getPhysicalExportPlan({
      widthMm: 1000,
      dpi: 1200,
      sourceWidth: 1600,
      sourceHeight: 900,
      maxPixels: 20_000_000
    }),
    /내보내기 크기가 너무 큽니다/
  );
});
```

- [ ] **Step 5: Run export tests and verify RED**

Run: `node --test tests/teacher-export.test.js`

Expected: FAIL because `js/utils/TeacherExport.js` does not exist.

- [ ] **Step 6: Implement physical-export planning**

```js
export const TEACHER_EXPORT_PRESETS = Object.freeze({
  hwpCompact: { label: 'HWP용 · 80 mm · 300 dpi', widthMm: 80, dpi: 300 },
  hwpWide: { label: 'HWP용 넓게 · 120 mm · 300 dpi', widthMm: 120, dpi: 300 },
  printHigh: { label: '고해상도 · 160 mm · 600 dpi', widthMm: 160, dpi: 600 }
});

export function getPhysicalExportPlan(options) {
  const width = Math.round(options.widthMm / 25.4 * options.dpi);
  const height = Math.round(width * options.sourceHeight / options.sourceWidth);
  const maxPixels = options.maxPixels ?? 40_000_000;
  if (![width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error('올바른 출력 크기와 DPI를 입력하세요.');
  }
  if (width * height > maxPixels) throw new Error('내보내기 크기가 너무 큽니다.');
  return { width, height, scale: width / options.sourceWidth };
}
```

- [ ] **Step 7: Integrate project import/export and HWP preset controls**

Add `projectNameInput`, `projectExportBtn`, hidden `projectImportInput`, and `teacherExportPreset` to `index.html`. Wire them in `main.js` so import validation completes before `ObjectManager.fromJSON()`.

- [ ] **Step 8: Run focused and full tests**

Run: `node --test tests/project-file.test.js tests/teacher-export.test.js tests/area-export.test.js`

Expected: PASS.

Run: `npm.cmd test`

Expected: all tests pass.

- [ ] **Step 9: Commit**

```powershell
git add js/utils/ProjectFile.js js/utils/TeacherExport.js tests/project-file.test.js tests/teacher-export.test.js js/main.js index.html
git commit -m "Add teacher project and print export foundations"
```

### Task 2: Standalone text and number-line endpoint semantics

**Files:**
- Create: `js/objects/TextLabel.js`
- Create: `js/tools/TextTool.js`
- Create: `tests/text-label.test.js`
- Modify: `js/objects/GeoObject.js`
- Modify: `js/objects/NumberLine.js`
- Modify: `js/core/ObjectManager.js`
- Modify: `js/ai/SchemaValidator.js`
- Modify: `js/ai/PatchApplier.js`
- Modify: `js/main.js`
- Modify: `index.html`
- Modify: `tests/number-line-ai-parity.test.js`

**Interfaces:**
- Produces object type `textLabel` with `position`, `text`, `fontSize`, `align`.
- Extends number-line `customMarks[]` with nullable `endpoint`.

- [ ] **Step 1: Write failing text-label serialization/render contract tests**

```js
test('standalone text serializes position and content', () => {
  const label = new TextLabel(new Vec2(2, 3), '단위: cm', { fontSize: 16 });
  assert.deepEqual(label.toJSON(), {
    id: label.id,
    type: 'textLabel',
    text: '단위: cm',
    position: { x: 2, y: 3 },
    fontSize: 16,
    align: 'left',
    color: '#000000',
    visible: true,
    locked: false
  });
});
```

- [ ] **Step 2: Verify text-label RED**

Run: `node --test tests/text-label.test.js`

Expected: FAIL because `TextLabel` is missing.

- [ ] **Step 3: Implement `TextLabel` and object-manager parity**

Use `canvas.drawMathLabel` for text rendering, expose hit bounds, drag position, and serialize only stable fields.

- [ ] **Step 4: Write failing open/closed endpoint tests**

```js
test('number line renders open and closed endpoints distinctly', () => {
  const numberLine = new NumberLine({
    start: -3,
    end: 3,
    customMarks: [
      { value: -1, endpoint: 'open' },
      { value: 2, endpoint: 'closed' }
    ]
  });
  const calls = renderNumberLineToRecordingCanvas(numberLine);
  assert.equal(calls.hollowEndpointCount, 1);
  assert.equal(calls.filledEndpointCount, 1);
});
```

- [ ] **Step 5: Verify endpoint RED**

Run: `node --test tests/number-line-ai-parity.test.js`

Expected: FAIL because endpoints are ignored.

- [ ] **Step 6: Implement endpoint rendering and AI schema parity**

Validate only `open`, `closed`, or missing. Draw open endpoints with canvas background fill and black stroke; draw closed endpoints with black fill.

- [ ] **Step 7: Run tests and commit**

Run: `node --test tests/text-label.test.js tests/number-line-ai-parity.test.js`

Expected: PASS.

```powershell
git add js/objects/TextLabel.js js/tools/TextTool.js js/objects/GeoObject.js js/objects/NumberLine.js js/core/ObjectManager.js js/ai/SchemaValidator.js js/ai/PatchApplier.js js/main.js index.html tests/text-label.test.js tests/number-line-ai-parity.test.js
git commit -m "Add standalone text and number line endpoints"
```

### Task 3: Curved solid primitives

**Files:**
- Create: `js/objects/CurvedSolid.js`
- Create: `js/tools/CurvedSolidTool.js`
- Create: `tests/curved-solids.test.js`
- Modify: `js/objects/GeoObject.js`
- Modify: `js/core/ObjectManager.js`
- Modify: `js/ai/SchemaValidator.js`
- Modify: `js/ai/PatchApplier.js`
- Modify: `js/ai/SceneGraphCompiler.js`
- Modify: `js/ai/AIService.js`
- Modify: `js/main.js`
- Modify: `index.html`

**Interfaces:**
- Produces object types `cylinder`, `cone`, and `sphere`.
- All expose `getPosition()`, `render(canvas, objectManager)`, `containsPoint()`, and `toJSON()`.

- [ ] **Step 1: Write failing validation and serialization tests**

```js
test('curved solids validate and round-trip', () => {
  for (const type of ['cylinder', 'cone', 'sphere']) {
    const op = fixtureFor(type);
    assert.equal(SchemaValidator.validate({ operations: [op] }).valid, true);
    const restored = ObjectManager.createFromJSON({ id: type, ...op });
    assert.equal(restored.type, type);
  }
});
```

- [ ] **Step 2: Verify curved-solid RED**

Run: `node --test tests/curved-solids.test.js`

Expected: FAIL with unsupported type.

- [ ] **Step 3: Implement deterministic projections**

- Cylinder: front and rear ellipse halves, vertical sides, rear half dashed.
- Cone: base ellipse, apex sides, rear base half dashed.
- Sphere: outer ellipse/circle plus optional dashed equator.
- Use no filled construction polygon and no pixel rasterization.

- [ ] **Step 4: Add SceneGraph and AI contract support**

Remove these three types from `UNSUPPORTED_TYPES`, compile their numeric fields, and add strict nullable schema fields with local validation.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/curved-solids.test.js tests/scene-graph-compiler.test.js tests/ai-flow.test.js`

Expected: PASS.

Run: `npm.cmd test`

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add js/objects/CurvedSolid.js js/tools/CurvedSolidTool.js js/objects/GeoObject.js js/core/ObjectManager.js js/ai/SchemaValidator.js js/ai/PatchApplier.js js/ai/SceneGraphCompiler.js js/ai/AIService.js js/main.js index.html tests/curved-solids.test.js tests/scene-graph-compiler.test.js tests/ai-flow.test.js
git commit -m "Add editable curved solid projections"
```

### Task 4: AI domain parity and support preflight

**Files:**
- Create: `js/ai/SupportPreflight.js`
- Create: `tests/support-preflight.test.js`
- Modify: `js/ai/AIService.js`
- Modify: `js/ai/SchemaValidator.js`
- Modify: `js/ai/PatchApplier.js`
- Modify: `js/ai/SceneGraphCompiler.js`
- Modify: `tests/ai-flow.test.js`
- Modify: `tests/function-range-limits.test.js`
- Modify: `tests/function-line-intersection.test.js`

**Interfaces:**
- Produces `analyzeDrawingSupport(text): { status, supported, approximated, excluded, message }`.
- Extends function operations with `xMin`, `xMax`, `yMin`, `yMax`.
- Extends intersection operations with `branch`.

- [ ] **Step 1: Write failing support-preflight tests**

```js
test('statistical chart requests are explicitly excluded', () => {
  const result = analyzeDrawingSupport('상자그림과 산점도를 그려줘');
  assert.equal(result.status, 'excluded');
  assert.deepEqual(result.excluded, ['boxPlot', 'scatterPlot']);
});

test('curved solid requests are supported', () => {
  const result = analyzeDrawingSupport('원기둥과 원뿔을 그려줘');
  assert.equal(result.status, 'supported');
  assert.deepEqual(result.supported, ['cylinder', 'cone']);
});
```

- [ ] **Step 2: Verify preflight RED**

Run: `node --test tests/support-preflight.test.js`

Expected: FAIL because `SupportPreflight.js` is missing.

- [ ] **Step 3: Implement support categories and Korean messages**

Use ordered regex families. Return stable object identifiers for UI and tests. Never call charts supported.

- [ ] **Step 4: Write failing function/intersection AI parity tests**

Assert strict structured-output schema includes range fields and branch, PatchApplier updates them, and SceneGraphCompiler forwards them.

- [ ] **Step 5: Verify RED, implement parity, and rerun**

Run: `node --test tests/ai-flow.test.js tests/function-range-limits.test.js tests/function-line-intersection.test.js`

Expected before implementation: FAIL on missing fields.

Expected after implementation: PASS.

- [ ] **Step 6: Commit**

```powershell
git add js/ai/SupportPreflight.js js/ai/AIService.js js/ai/SchemaValidator.js js/ai/PatchApplier.js js/ai/SceneGraphCompiler.js tests/support-preflight.test.js tests/ai-flow.test.js tests/function-range-limits.test.js tests/function-line-intersection.test.js
git commit -m "Add AI support preflight and domain parity"
```

### Task 5: Canvas-dock teacher UI and accessibility

**Files:**
- Create: `js/ui/TeacherWorkflow.js`
- Create: `tests/teacher-workflow.test.js`
- Modify: `index.html`
- Modify: `css/styles.css`
- Modify: `js/main.js`
- Modify: `js/core/EventHandler.js`

**Interfaces:**
- Produces `TeacherWorkflow.setState(state, details)`.
- Produces `TeacherWorkflow.updateQualitySummary(objects, supportResult)`.
- Consumes `analyzeDrawingSupport`, project/export callbacks, and AI command lifecycle events.

- [ ] **Step 1: Write failing workflow state tests**

```js
test('workflow keeps prompt on errors and exposes retry', () => {
  const view = createWorkflowHarness();
  view.setPrompt('원뿔과 구를 그려줘');
  view.setState('error', { message: '응답 시간이 초과되었습니다.' });
  assert.equal(view.prompt, '원뿔과 구를 그려줘');
  assert.equal(view.retryVisible, true);
  assert.equal(view.liveMessage, '응답 시간이 초과되었습니다.');
});
```

- [ ] **Step 2: Verify UI state RED**

Run: `node --test tests/teacher-workflow.test.js`

Expected: FAIL because `TeacherWorkflow` is missing.

- [ ] **Step 3: Implement the UI controller and wire lifecycle states**

Map command lifecycle to `checking`, `generating`, `repairing`, `complete`, `warning`, and `error`. Keep prompt contents until the user clears them.

- [ ] **Step 4: Rebuild layout to match selected target**

- Keep the canvas as the largest surface.
- Place prompt, image button, primary generation button, and status in a bottom dock.
- Keep the right inspector visible and add an exam QA section.
- Collapse the left rail below 1360 px.
- Remove the floating chat overlay from the core teacher path while preserving existing chat message history in the dock.

- [ ] **Step 5: Add keyboard and live-region behavior**

Set `tabindex="0"` and `aria-describedby="canvasKeyboardHelp"` on the canvas. Add `role="status"` for progress and `role="alert"` for failures. Preserve existing shortcuts.

- [ ] **Step 6: Run focused and full tests**

Run: `node --test tests/teacher-workflow.test.js tests/ai-flow.test.js`

Expected: PASS.

Run: `npm.cmd test`

Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git add js/ui/TeacherWorkflow.js tests/teacher-workflow.test.js index.html css/styles.css js/main.js js/core/EventHandler.js
git commit -m "Add canvas-first teacher production workspace"
```

### Task 6: References, design QA, deployment, and progress record

**Files:**
- Modify: `.agents/skills/mathgraph-drawing/SKILL.md`
- Modify: `.agents/skills/mathgraph-drawing/references/feature-manual.json`
- Modify: `runtime/mathgraph-drawing/references/feature-manual.json`
- Modify: `docs/ai-reference.md`
- Modify: `docs/progress-log.md`
- Create: `design-qa.md`

**Interfaces:**
- Documents the same object names and field contracts shipped by the runtime.

- [ ] **Step 1: Update feature references**

Move cylinder/cone/sphere and textLabel out of known unsupported nodes. Document chart exclusion, endpoint semantics, physical export presets, project files, function ranges, and intersection branches.

- [ ] **Step 2: Run reference validation**

Run: `node -e "JSON.parse(require('fs').readFileSync('.agents/skills/mathgraph-drawing/references/feature-manual.json','utf8')); JSON.parse(require('fs').readFileSync('runtime/mathgraph-drawing/references/feature-manual.json','utf8'))"`

Expected: exit 0.

- [ ] **Step 3: Run full verification**

Run: `npm.cmd test`

Expected: all tests pass.

Run: `npm.cmd run vercel-build`

Expected: exit 0.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Browser verification**

Capture 1600 × 900 and 1280 × 720 states. Verify:

- project name and HWP preset visible;
- bottom AI dock does not cover canvas;
- support warning appears for chart requests;
- curved-solid and standalone-text tools are present;
- canvas receives keyboard focus;
- project JSON import rejects invalid input without changing objects;
- no failed requests or console errors.

- [ ] **Step 5: Design QA**

Compare `docs/design-references/teacher-workflow/selected-canvas-dock-target.png` with the implemented 1600 × 900 capture. Record issues in `design-qa.md`, fix P0/P1/P2 differences, recapture, and finish only when `final result: passed`.

- [ ] **Step 6: Update progress and commit**

```powershell
git add .agents/skills/mathgraph-drawing/SKILL.md .agents/skills/mathgraph-drawing/references/feature-manual.json runtime/mathgraph-drawing/references/feature-manual.json docs/ai-reference.md docs/progress-log.md design-qa.md
git commit -m "Document teacher diagram workflow coverage"
```

- [ ] **Step 7: Push and deploy**

Run: `git push -u origin codex/teacher-workflow-20260710`

Run: `npx.cmd vercel deploy --prod --yes`

Inspect the resulting production URL, confirm status `Ready`, verify `https://mathgraph-five.vercel.app/` returns HTTP 200, and run the production browser smoke.
