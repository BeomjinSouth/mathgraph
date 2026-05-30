# Implementation Tracking

## Status

- Task: Live OpenAI CSAT-style drawing audit
- State: Done
- Last updated: 2026-05-30

## Plan

1. Read project rules, prior audit context, and MathGraph drawing references.
2. Select an existing diverse prompt set that fits CSAT/mock-exam-style graph and diagram needs.
3. Render local reference targets for comparison.
4. Run the live OpenAI Responses API drawing smoke and browser rendering path.
5. Compare prompts with actual contact-sheet results and record caveats.
6. Run verification, secret scan, update docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5
- [x] Step 6

## Decisions

- Decision: Reuse `LIVE_AI_PROMPT_SET=stress_novel` for this audit.
- Reason: It already covers non-overlapping function, analytic-geometry, circle, construction, polygon, and solid cases, with local reference targets and prompt-local validators.
- Decision: Use the supplied OpenAI key only as a process-scoped `OPENAI_API_KEY`.
- Reason: The user explicitly asked for live API checking, but the key must not be written to repo files, reports, or persistent environment settings.
- Decision: Treat the contact sheet as the final human-facing evidence.
- Reason: The user asked whether results match prompts, and the browser-rendered canvas is the source of truth beyond JSON validation.

## Blockers

- Blocker: None. The live API run completed successfully.

## Verification

- Completed:
  - Local reference render with `LIVE_AI_PROMPT_SET=stress_novel`, `LIVE_AI_RENDER_REFERENCE_TARGETS=1`, and `LIVE_AI_OUTPUT_DIR=tmp/live-openai-csat-reference-20260530`; passed with 10 targets, 0 failures, and 0 browser console errors.
  - Live OpenAI run with `LIVE_AI_PROMPT_SET=stress_novel`, `LIVE_AI_OUTPUT_DIR=tmp/live-openai-csat-drawing-smoke-20260530`, `LIVE_AI_MAX_OUTPUT_TOKENS=14000`, and `LIVE_AI_MAX_ATTEMPTS=4`; selected `gpt-5.4-mini` and passed with 10 outputs, 0 failures, and 0 browser console errors.
  - Visual inspection of the reference and live contact sheets.
  - Secret-pattern scan for actual `sk-proj-...` values outside `node_modules` and `.git`; no matches.
  - `npm.cmd test` passed with 100 tests.
  - `git diff --check` passed with line-ending warnings only.

## Handoff

- Current status:
  - Live output evidence is under `tmp/live-openai-csat-drawing-smoke-20260530/`.
  - Prompt/result comparison is documented in `docs/live-openai-csat-drawing-audit.md`.
  - Follow-up stricter visual review found that `gpt-5.5-mini` is not visible to the supplied key; `gpt-5.5` and `gpt-5.4-mini` both respond to tiny Responses calls.
  - Strict one-by-one visual review marks 5 direct passes, 3 minor readability issues, and 2 solid-diagram outputs that need rerun or stronger projection prompts.

---

## Status

- Task: Solid 3D broad case matrix and zero-error audit
- State: Done
- Last updated: 2026-05-29

## Plan

1. Record the broader case-matrix acceptance bar before implementation.
2. Add table-driven Solid3D coverage for multiple prism rear-face shifts.
3. Add a Playwright browser matrix tool that creates varied GraphA solid cases, renders each case, inspects runtime solids, and saves screenshots/reports.
4. Run focused tests, browser matrix verification, full tests, whitespace check, and secret-pattern scan.
5. Update progress docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Keep the audit local and deterministic.
- Reason: The current request is about runtime geometry correctness, and the pasted API key should not be used directly from chat text.
- Decision: Treat browser rendering plus internal solid hidden-edge state as the acceptance boundary.
- Reason: Pixel output proves the canvas did not fail, while `_hiddenEdges` proves whether the runtime classified front and rear prism edges correctly.
- Decision: Keep generated screenshots and reports under `tmp/`.
- Reason: They are verification artifacts, not source files.

## Blockers

- Blocker: None for local GraphA/runtime verification.

## Verification

- Planned:
  - `node --test tests\solid3d-hidden-edges.test.js`
  - `node --check tools\render-solid3d-case-matrix.mjs`
  - `node tools\render-solid3d-case-matrix.mjs`
  - `npm.cmd test`
  - `git diff --check`
  - secret-pattern scan for actual `sk-*` key values outside ignored/generated folders
- Completed:
  - `node --check tools\render-solid3d-case-matrix.mjs` passed.
  - `node --test tests\solid3d-hidden-edges.test.js` passed with 6 tests.
  - `node tools\render-solid3d-case-matrix.mjs` rendered 24 cases with 0 failures, 0 case console errors, and 0 invalid objects; contact sheet saved at `tmp/solid3d-case-matrix/contact-sheet.png`.
  - `npm.cmd test` passed with 100 tests.
  - `git diff --check` passed with line-ending warnings only.
  - Secret-pattern scan for actual `sk-*` key values outside `tmp`, `node_modules`, and `.git` found no matches.

## Handoff

- Current status:
  - Broad Solid3D matrix coverage is implemented and verified.
  - The generated report is `tmp/solid3d-case-matrix/solid3d-case-matrix-report.md`.

---

## Status

- Task: Solid 3D visible/hidden edge audit and prism correction
- State: Done
- Last updated: 2026-05-28

## Plan

1. Render several current prism/pyramid forms and record the hidden-edge classifications.
2. Fix the prism visibility convention so the base face is front/solid and the shifted top face supplies rear dashed edges.
3. Add focused tests for render-time dashed flags and preserve pyramid wrap-around coverage.
4. Re-render the browser audit image, run focused/full tests, and update progress docs.
5. Commit and push the completed change.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Keep using first-class `prism` and `pyramid` objects for solid hidden-line rendering.
- Reason: Previous AI smoke work already established that hand-drawn dashed/solid segment bundles are inconsistent and should not own solid visibility.
- Decision: Treat prism `baseVertexIds` as the near/front face for textbook-style `ABCD-A'B'C'D'` drawings.
- Reason: The current renderer can dash front/base edges in ordinary rectangular-prism projections, which makes the visible/hidden convention read backwards.
- Decision: Leave pyramid visibility under the existing convention unless the audit exposes a concrete mismatch.
- Reason: The sampled pyramid forms already dash the rear base/lateral edges as expected.

## Blockers

- Blocker: `OPENAI_API_KEY` is not available in process, user, or machine environment. Live external OpenAI drawing is blocked unless the key is supplied through the environment; local GraphA/browser rendering can still verify the runtime behavior.

## Verification

- Planned:
  - `node --test tests\solid3d-hidden-edges.test.js`
  - browser-rendered multi-solid screenshot audit
  - `npm.cmd test`
  - `git diff --check`
- Completed:
  - Initial browser audit before the fix saved `tmp/solid3d-edge-audit-before/solid3d-edge-audit-before.png`; it showed prism front/base edges could be dashed.
  - `node --check js\objects\Solid3D.js`
  - `node --check js\ai\AIService.js`
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs`
  - JSON parse check for `.agents\skills\mathgraph-drawing\references\feature-manual.json` and `retrieval-index.json`.
  - `node --test tests\solid3d-hidden-edges.test.js` passed with 3 tests.
  - Browser audit after the fix saved `tmp/solid3d-edge-audit-after/solid3d-edge-audit-after.png`; it rendered 53 objects, 18,688 non-white pixels, and 0 console errors.
  - Local reference target render with `LIVE_AI_PROMPT_SET=stress_novel`, `LIVE_AI_RENDER_REFERENCE_TARGETS=1`, and `LIVE_AI_OUTPUT_DIR=tmp/solid3d-reference-after`; passed with 10 rendered targets, 0 failures, and 0 browser console errors.
  - `npm.cmd test` passed with 97 tests.
  - `git diff --check` passed with line-ending warnings only.
  - Secret-pattern scan for actual `sk-*` key values outside `tmp`, `node_modules`, and `.git` found no matches.

## Handoff

- Current status:
  - `prism` now treats `baseVertexIds` as the near/front face and `topVertexIds` as the shifted rear face for hidden-edge classification.
  - AI prompt guidance, the MathGraph drawing skill, and the feature manual now document the same convention.
  - Live external OpenAI drawing was not run because no `OPENAI_API_KEY` is present in the environment; the pasted key was not written to files or command strings.

---

- Task: Novel OpenAI drawing stress set and reference visual targets
- State: Done with live OpenAI blocked
- Last updated: 2026-05-28

## Plan

1. Add a non-overlapping `stress_novel` prompt set with 10 new drawing targets.
2. Add deterministic reference payloads and a no-API reference render mode so intended targets can be shown and compared.
3. Add semantic validators/tests for new visual-intent invariants.
4. Run local syntax, focused tests, and reference rendering; run live OpenAI only if `OPENAI_API_KEY` is safely present.
5. Update audit/progress docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Use `OPENAI_API_KEY` only from process/user/machine environment, not from pasted chat text.
- Reason: The API key is a secret and should not appear in shell history, committed files, or generated reports.
- Decision: Add a reference-render mode to the existing live smoke runner.
- Reason: The user needs to see the intended visual target, and previous recursive loops benefited from comparing live output against a stable local target sheet.
- Decision: Keep the new prompts inside currently supported GraphA objects.
- Reason: The user asked for diagrams that can be iteratively improved to visual parity; unsupported primitives should be documented as future candidates instead of silently approximated as exact.
- Decision: Treat exact annular-sector fill as unsupported in this pass.
- Reason: The reference target can show an outer sector plus inner circle outline, but a true ring-sector cutout needs a future first-class primitive to avoid a misleading approximation.

## Blockers

- Blocker: `OPENAI_API_KEY` is missing from the current process, user, and machine environment, so live external OpenAI calls were not run. A live attempt stopped with `OPENAI_API_KEY is required.`

## Verification

- Planned:
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs`
  - `node --test tests\live-openai-random-smoke.test.js`
  - reference target render with `LIVE_AI_PROMPT_SET=stress_novel` and `LIVE_AI_RENDER_REFERENCE_TARGETS=1`
  - live external OpenAI run only if `OPENAI_API_KEY` is available through the environment
  - `git diff --check`
- Completed:
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs`
  - `node --test tests\live-openai-random-smoke.test.js` passed with 44 tests.
  - JSON parse check for `feature-manual.json` and `retrieval-index.json`.
  - Local reference target render with `LIVE_AI_PROMPT_SET=stress_novel`, `LIVE_AI_RENDER_REFERENCE_TARGETS=1`, and `LIVE_AI_OUTPUT_DIR=tmp/live-openai-stress-novel-reference-targets`; passed with 10 rendered targets, 0 failures, 0 browser console errors.
  - Live external run attempted with `LIVE_AI_PROMPT_SET=stress_novel`; blocked before API call because `OPENAI_API_KEY` is missing.
  - `npm.cmd test` passed with 96 tests.
  - `git diff --check` passed with line-ending warnings only.
  - Secret-pattern scan for `sk-proj-`, inline `OPENAI_API_KEY` values, and `Bearer sk-` outside `tmp`, `node_modules`, and `.git` found no matches.

## Handoff

- Current status:
  - `stress_novel` is implemented with 10 prompts, reference targets, semantic validators, and audit docs.
  - The visible evidence is `tmp/live-openai-stress-novel-reference-targets/contact-sheet.png`.
  - Live OpenAI generation remains pending until the API key is supplied through `OPENAI_API_KEY`.

---

## Status

- Task: First-class lens regions and vector fill tool
- State: Done
- Last updated: 2026-05-28

## Plan

1. Record the behavior change and visual acceptance criteria in planning docs.
2. Add `lensRegion` as a runtime object, GraphA type, schema type, and scene-graph compiler target.
3. Add a toolbar fill tool that updates fill color/opacity on closed vector objects with undo support.
4. Extend tests and browser smoke rendering to confirm the drawn result matches the intended curved lens/fill behavior.
5. Update docs/progress, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Add `lensRegion` rather than representing the overlap as a polygon.
- Reason: The requested visual target has two circular-arc boundaries, and polygon point order/self-crossing was the root source of previous mismatch.
- Decision: Add a vector fill tool instead of bitmap flood fill.
- Reason: MathGraph stores editable geometry objects; vector fill preserves serialization, undo, SVG export, and AI patch compatibility.
- Decision: Let the fill tool fill circle interiors while preserving normal circle hit testing.
- Reason: Users expect a paint-bucket click inside a circle to fill it, but normal selection should still prefer the circle boundary.

## Blockers

- Blocker: None currently.

## Verification

- Planned:
  - focused unit tests for `lensRegion`, schema/patch creation, scene graph compilation, and fill tool behavior.
  - full `npm.cmd test`.
  - browser-rendered visual smoke artifact for lens region and filled objects.
- Completed:
  - `node --test tests\lens-region.test.js`
  - `node --test tests\fill-tool.test.js`
  - `node --test tests\scene-graph-compiler.test.js`
  - `node --test tests\ai-flow.test.js`
  - JSON parse check for `feature-manual.json` and `retrieval-index.json`
  - Browser visual smoke through a temporary local server; output `tmp/lens-fill-visual-smoke/lens-fill-smoke-clean.png`, 0 console errors, `lensValid:true`, `lensPathPoints:129`, fill tool wrote `#22c55e` at opacity `0.55`, undo action type `batch`.
  - `node --check js\main.js`
  - `node --check js\ai\SceneGraphCompiler.js`
  - `node --check js\ai\PatchApplier.js`
  - `npm.cmd test` passed with 91 tests.
  - `git diff --check` passed with line-ending warnings only.

## Handoff

- Current status:
  - `lensRegion` is implemented as a first-class curved overlap object and wired into GraphA schema, patch application, scene graph compilation, SVG export, AI references, and tests.
  - The toolbar includes a vector fill tool with color/opacity controls and single-step undo batching.

---

## Status

- Task: Recursive visual parity loop for stress-extra OpenAI drawings
- State: Done
- Last updated: 2026-05-28

## Plan

1. Rejudge the latest `stress_extra` screenshots against the intended visual target.
2. Identify root causes where JSON object counts pass but the rendered figure still differs.
3. Tighten prompt-local validators and prompt wording for those causes.
4. Re-run focused tests, render/live verification when possible, and visually review again.
5. Update audit/progress docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Treat renderable angle markers as a separate requirement from angleDimension object count.
- Reason: The latest parallel/transversal sample had four angleDimension objects, but a marker can be visually missing when a helper point equals the vertex.
- Decision: Make construction polygons explicitly unfilled when the prompt asks for an outline-style figure.
- Reason: Polygon defaults fill at low opacity, which makes a hexagon look like a shaded region unless `fillOpacity:0` is required.
- Decision: Require inner nested solids to be separated in projection when two different inner solids are requested.
- Reason: Containment alone can accept a visually tangled pile of vertices inside the outer prism.
- Decision: Add saved-result revalidation with `LIVE_AI_REVALIDATE_RESULTS`.
- Reason: The recursive loop needs to reject previously saved "all pass" API results after the visual-intent bar becomes stricter, without requiring an API key for every audit pass.
- Decision: Push visual guardrails into the runtime OpenAI reference prompt and MathGraph drawing skill.
- Reason: Fixes must influence future generation prompts, not only the local smoke test harness.
- Decision: Treat line equations, lens radius/order, pyramid base counts, and prism base/top ordering as visual-intent invariants.
- Reason: The recursive live reruns showed that correct object families can still produce the wrong visible figure.

## Blockers

- Blocker: None currently.

## Verification

- Completed so far:
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs`
  - `node --test tests\live-openai-random-smoke.test.js`
  - saved-result revalidation with `LIVE_AI_REVALIDATE_RESULTS=tmp/live-openai-stress-extra-drawing-smoke-fixed2/live-openai-random-results.json`; expected failure result: 6 of 10 saved outputs rejected by the new visual-intent gates.
  - recursive live external reruns through `tmp/live-openai-stress-extra-drawing-smoke-parity1/` through `tmp/live-openai-stress-extra-drawing-smoke-parity6/`
  - final accepted live run: `tmp/live-openai-stress-extra-drawing-smoke-parity6/` with 10/10 semantic/render pass, 0 browser console errors, and visual review accepted.
  - `npm.cmd test` passed with 85 tests.
  - `git diff --check` passed with line-ending warnings only.

## Handoff

- Current status:
  - Previous `fixed2` live output is no longer considered visually accepted; the new validator rejects the six known mismatches.
  - Recursive live reruns found and fixed additional failures: unequal lens radius, missing tangent `x`, wrong rational vertical asymptote, triangular pyramids where square pyramids were requested, self-crossing lens fill, and twisted prism projections.
  - Code, prompt context, tests, and audit docs are updated and verified.

---

## Status

- Task: Additional stress OpenAI drawing set with diverse graphs and nested solids
- State: Done
- Last updated: 2026-05-28

## Plan

1. Add a new 10-prompt `stress_extra` live smoke set that does not duplicate the previous stress prompts.
2. Cover varied function graphs, complex plane figures, and nested first-class solids while keeping label budgets explicit.
3. Run the external OpenAI Responses API path and render all 10 outputs.
4. Inspect screenshots, record prompt/output evidence, and update progress docs.
5. Run verification, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Add `LIVE_AI_PROMPT_SET=stress_extra` instead of replacing `stress`.
- Reason: The first stress set remains useful as a regression baseline for label-density and nested-solid fixes.
- Decision: Keep label-count and short-label expectations in every dense prompt.
- Reason: The previous visual failure mode was mostly caused by runtime-visible label clutter, so the new prompts should start with that guardrail.
- Decision: Require direct point objects for the two-circle lens endpoints in this prompt set.
- Reason: Duplicate generic circle-circle `intersection` objects do not identify the requested upper/lower lens endpoints clearly enough for semantic validation.
- Decision: Validate nested solids against the first outer solid's convex projection hull.
- Reason: A simple x/y bounding box can accept inner vertices that are visually outside a slanted prism or pyramid projection.

## Blockers

- Blocker: None currently.

## Verification

- Checks run:
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs`
  - `node --test tests\live-openai-random-smoke.test.js`
  - live external OpenAI stress-extra run with `LIVE_AI_PROMPT_SET=stress_extra`, `LIVE_AI_OUTPUT_DIR=tmp/live-openai-stress-extra-drawing-smoke-fixed2`, `LIVE_AI_MAX_OUTPUT_TOKENS=14000`, and `LIVE_AI_MAX_ATTEMPTS=4`
  - `npm.cmd test`
  - `git diff --check`
- Result:
  - Syntax check passed.
  - Focused live-smoke tests passed.
  - Final live stress-extra run used `gpt-5.4-mini`, rendered all 10 outputs, and reported 0 failures / 0 browser console errors.
  - Full test suite passed.
  - `git diff --check` passed with line-ending warnings only.
  - Saved live OpenAI evidence for `stress_extra` is under `tmp/live-openai-stress-extra-drawing-smoke-fixed2/`.

## Handoff

- What changed:
  - Added `LIVE_AI_PROMPT_SET=stress_extra` with 10 new complex function/geometry/solid prompts.
  - Added prompt-local validators for direct lens endpoints and nested-solid containment.
  - Tightened containment from axis-aligned bounds to a convex projection hull.
  - Added the prompt/result audit at `docs/stress-extra-openai-drawing-audit.md`.
  - Updated `docs/ai-reference.md` with dense prompt guidance.
- What remains:
  - None currently.

---

## Status

- Task: Stress OpenAI drawing visual validation and label-overlap correction
- State: Done
- Last updated: 2026-05-27

## Plan

1. Audit each saved stress output against both GraphA semantics and the rendered screenshot.
2. Identify the common failure modes behind accepted-but-visually-wrong outputs.
3. Tighten the live stress prompts and semantic validators so excessive runtime-visible labels fail.
4. Add a canvas-level label collision fallback to reduce overlap when labels are still present.
5. Re-run focused tests and the external OpenAI stress set, then record evidence, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Treat runtime-visible default labels as labels even when the GraphA operation did not explicitly provide a `label` field.
- Reason: Point, function, circle, arc, sector, and polygon objects can render generated labels by default, which caused the previous smoke gate to accept visually cluttered diagrams.
- Decision: Use prompt-local label budgets for dense stress prompts.
- Reason: Sparse labels are useful on small constructions, but nested solids and multi-graph scenes become unreadable when every helper vertex or function label is displayed.
- Decision: Add a canvas label collision fallback in addition to prompt/semantic constraints.
- Reason: AI output should avoid clutter, but user-created or legacy diagrams can still place labels near each other; the renderer now tries alternate nearby label positions before drawing.

## Blockers

- Blocker: None currently.

## Verification

- Checks run:
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs`
  - `node --check js\core\Canvas.js`
  - `node --check js\main.js`
  - `node --test tests\live-openai-random-smoke.test.js`
  - live external OpenAI stress run with `LIVE_AI_PROMPT_SET=stress`, `LIVE_AI_OUTPUT_DIR=tmp/live-openai-stress-drawing-smoke-label-fixed2`, `LIVE_AI_MAX_OUTPUT_TOKENS=14000`, and `LIVE_AI_MAX_ATTEMPTS=4`
  - `npm.cmd test`
  - `git diff --check`
- Result:
  - Syntax checks passed.
  - Focused live-smoke tests passed with 23 tests.
  - Final live stress run used `gpt-5.4-mini`, rendered all 10 outputs, and reported 0 failures / 0 browser console errors.
  - Label budgets in the final live run were satisfied: 4, 3, 2, 4, 3, 4, 4, 0, 3, 0 visible labels by prompt order.
  - Full test suite passed with 69 tests.
  - `git diff --check` passed with line-ending warnings only.

## Handoff

- What changed:
  - Tightened the stress prompt set so dense graphs and solids hide helper labels and use short labels only.
  - Added prompt-local semantic checks for runtime-visible label count, visible label text length, dashed asymptote lines, required tangent x-values, and visible sector span.
  - Added canvas-level label collision avoidance for ordinary `drawLabel` calls.
  - Final evidence is under `tmp/live-openai-stress-drawing-smoke-label-fixed2/`.
- What remains:
  - Curved regions between function graphs are still represented by `polygon` approximations because GraphA does not currently have a first-class "fill between arbitrary functions" object.

---

## Status

- Task: Stress OpenAI drawing set with complex graphs and solids
- State: Done
- Last updated: 2026-05-26

## Plan

1. Add a 10-prompt `stress` live smoke set covering multi-function graphs, complex plane geometry, and nested solids.
2. Add lightweight per-prompt type expectations so obviously incomplete outputs fail before screenshot acceptance.
3. Run the external OpenAI Responses API path and render all 10 outputs.
4. Inspect screenshots, record prompt/output evidence, and update progress docs.
5. Run verification, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Use a new `LIVE_AI_PROMPT_SET=stress` instead of replacing the previous `extended` set.
- Reason: The previous set is now a regression baseline for the specific failures already fixed.
- Decision: Use prompt-local type expectations for this exploratory batch.
- Reason: These 10 samples are intentionally varied, so lightweight expectations catch missing core objects without overfitting every diagram.

## Blockers

- Blocker: None currently.

## Verification

- Checks run:
  - syntax checks for changed scripts,
  - focused smoke tests,
  - live external OpenAI run,
  - full `npm.cmd test`,
  - `git diff --check`.
- Result:
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs` passed.
  - `node --test tests\live-openai-random-smoke.test.js` passed with 19 tests.
  - The first live stress run rendered 9/10 outputs; the remaining compound solid used pixel-style coordinates outside the default view.
  - Added a coordinate-range semantic gate and reran the live stress set.
  - The final live stress run used `gpt-5.4-mini`, rendered all 10 outputs, and reported 0 failures / 0 browser console errors.
  - `npm.cmd test` passed with 65 tests.
  - `git diff --check` passed with line-ending warnings only.

## Handoff

- What changed:
  - Added `LIVE_AI_PROMPT_SET=stress` with 10 complex graph/geometry/solid prompts.
  - Added prompt-local minimum object-family expectations.
  - Added a default-view coordinate-range gate to reject pixel-style coordinates that would render blank.
  - Final evidence is under `tmp/live-openai-stress-drawing-smoke-fixed/`.
- What remains:
  - Commit and push the completed changes.

---

## Status

- Task: Extended OpenAI drawing semantic correction
- State: Done
- Last updated: 2026-05-25

## Plan

1. Diagnose the angle-marker, histogram-bin, and triangular-prism hidden-edge failures from the saved live outputs.
2. Tighten the live smoke prompts and semantic validators so structurally valid but visually wrong GraphA payloads fail.
3. Add angleDimension display controls to the AI response schema and patch application path.
4. Re-run external OpenAI live smoke generation and browser rendering.
5. Record verification, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Reject triangle incircle outputs that use infinite side lines or rightAngleMarker field aliases.
- Reason: Those outputs can render but place contact/right-angle markers ambiguously or not at all.
- Decision: Reject histogram bars that start at half-offset class intervals when the prompt asks for intervals starting at 0.
- Reason: A rendered chart can still misrepresent the intended class boundaries.
- Decision: Require first-class `prism` objects for the triangular-prism smoke case.
- Reason: The runtime prism object owns hidden-edge dashed/solid classification; hand-drawn segments made that distinction inconsistent.
- Decision: Allow and apply `angleDimension` display controls, then require staggered `arcRadius` and `showValue:false` in the transversal smoke case.
- Reason: Multiple angle markers at the same vertex otherwise overlap and look inaccurate even when their references are geometrically valid.

## Blockers

- Blocker: None currently.

## Verification

- Checks run:
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs`
  - `node --check js\ai\AIService.js`
  - `node --check js\ai\SchemaValidator.js`
  - `node --check js\ai\PatchApplier.js`
  - `node --test tests\live-openai-random-smoke.test.js`
  - live external OpenAI smoke with `LIVE_AI_PROMPT_SET=extended`, `LIVE_AI_OUTPUT_DIR=tmp/live-openai-diverse-drawing-smoke-fixed5`, and the API key supplied only through the process environment
- Result:
  - Syntax checks passed.
  - Focused smoke regression tests passed with 16 tests.
  - Live external run selected `gpt-5.4-mini`, returned 5 valid/rendered outputs, and reported 0 failures / 0 browser console errors.

## Handoff

- What changed:
  - The extended smoke runner now rejects inaccurate incircle/right-angle, transversal-angle, histogram-bin, and triangular-prism representations.
  - The OpenAI structured-output schema and patch applier now pass angle-dimension display fields through to the runtime.
  - The final evidence is under `tmp/live-openai-diverse-drawing-smoke-fixed5/`.
- What remains:
  - The screenshots still use model-chosen point labels, so some labels can be visually busy; the geometry-specific failures reported in this task are now covered by semantic gates.

---

## Status

- Task: Extended live OpenAI drawing smoke run
- State: Done
- Last updated: 2026-05-25

## Plan

1. Add a selectable extended prompt set for diverse live GPT drawing checks.
2. Re-run the external OpenAI Responses API through the real GraphA validation and browser render path.
3. Preserve prompt, response, screenshot, and contact-sheet evidence under `tmp/`.
4. Record quality observations, verification, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4

## Decisions

- Decision: Add `LIVE_AI_PROMPT_SET=extended` to the existing live smoke runner instead of creating a separate script.
- Reason: The existing runner already handles model selection, strict Structured Outputs, GraphA validation, browser rendering, reports, and screenshot generation.
- Decision: Treat truncated JSON responses as retryable validation failures.
- Reason: The histogram prompt initially produced an unterminated JSON response when the output token cap was too low.

## Blockers

- Blocker: None currently.

## Verification

- Checks run:
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs`
  - `node --test tests\live-openai-random-smoke.test.js`
  - `node tools\run-live-openai-random-drawing-smoke.mjs` with `LIVE_AI_PROMPT_SET=extended`, `LIVE_AI_OUTPUT_DIR=tmp/live-openai-diverse-drawing-smoke`, and the API key supplied only through the process environment
  - `npm.cmd test`
  - `git diff --check`
- Result:
  - Syntax check passed.
  - Focused smoke regression tests passed with 5 tests.
  - Live extended run used `gpt-5.4-mini`, returned 5 response IDs, produced 5 rendered screenshots, and reported 0 failures / 0 console errors.
  - Full test suite passed with 51 tests.
  - `git diff --check` passed with line-ending warnings only.

## Handoff

- What changed:
  - Added five diverse prompt cases: triangle incircle contacts, parallel/transversal angles, absolute-value graph region, histogram/frequency polygon approximation, and triangular prism hidden edges.
  - Added prompt-set selection and report metadata to the live smoke runner.
  - Added parse-failure retry behavior for truncated JSON responses.
- What remains:
  - The live sketches are proof of API/render flow, not exact geometry guarantees. The incircle sample rendered but used infinite lines for triangle sides, and the parallel-angle sample has some label overlap.

---

## Status

- Task: Random OpenAI drawing smoke semantic recovery
- State: Done
- Last updated: 2026-05-25

## Plan

1. Diagnose why the previous live smoke screenshots accepted missing/invalid visible math objects.
2. Tighten GraphA validation for runtime-ignored helper fields and invalid function expressions.
3. Add smoke-level semantic gates for visible circle sectors and real quadratic function graphs.
4. Add regression tests and record the blocked live-rerun condition.
5. Run verification, update progress log, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Treat schema/reference/render success as insufficient for the random drawing smoke test.
- Reason: A valid-looking payload can still collapse a sector to zero area or create an invalid function object that renders nothing.
- Decision: Reject `pointOnCircle.t` and function expressions containing `y=` at the shared GraphA validation layer.
- Reason: `pointOnCircle.t` is ignored by the runtime and `y=` is rejected by the function parser, so both produce invisible or misleading objects after application.
- Decision: Keep this pass network-free.
- Reason: The latest verification of the user-provided API key returned 401 `Incorrect API key`; a fresh valid key is needed before another external OpenAI call.

## Blockers

- Blocker: Live OpenAI rerun is blocked until a valid API key is supplied.

## Verification

- Checks run:
  - `node --check js\ai\SchemaValidator.js`
  - `node --check js\ai\AIService.js`
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs`
  - `node --test tests\live-openai-random-smoke.test.js`
  - `npm.cmd test`
  - `git diff --check`
- Result:
  - Syntax checks passed.
  - Focused regression tests passed with 5 tests.
  - Full test suite passed with 51 tests.
  - `git diff --check` passed with line-ending warnings only.

## Handoff

- What changed:
  - `SchemaValidator` now rejects `pointOnCircle` payloads that use `t` and function expressions that include `y=`.
  - `AIService` prompt guidance now states the same `pointOnCircle.angle` and RHS-only function-expression rules explicitly.
  - `tools/run-live-openai-random-drawing-smoke.mjs` now retries/rejects sector prompts when the sector has no resolvable visible angle and graph prompts when no real quadratic function/tangentFunction exists.
  - Added `tests/live-openai-random-smoke.test.js` to keep these two observed failures from being accepted again.
- What remains:
  - Rerun the live external OpenAI smoke set with a fresh valid API key and compare the new screenshots.

---

## Status

- Task: Scene graph based image/PDF reconstruction foundation
- State: Done
- Last updated: 2026-05-25

## Plan

1. Record the root architecture shift in planning docs.
2. Add a deterministic scene graph to GraphA compiler.
3. Add tests proving compiled output passes current schema/reference validation.
4. Update the JSON manual/retrieval notes so they guide scene graph prompts and compiler limits.
5. Run verification, update progress log, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Introduce scene graph as the image/PDF reconstruction boundary before changing every live API call.
- Reason: Direct GPT-authored `operations[]` can be valid JSON while still wrong, and an app-owned compiler is needed to make unsupported or ambiguous structures explicit.
- Decision: Keep current GraphA operations as the runtime application contract.
- Reason: `PatchApplier`, rendering, save/export, and existing tests already depend on `operations[]`; scene graph should compile into that contract rather than replacing the runtime model.

## Blockers

- Blocker: None currently.

## Verification

- Checks run:
  - `node --check js\ai\SceneGraphCompiler.js`
  - `node --test tests\scene-graph-compiler.test.js`
  - JSON parse check for `feature-manual.json` and `retrieval-index.json`
  - `npm.cmd test`
  - `git diff --check`
- Result:
  - Scene graph compiler syntax check passed.
  - Focused compiler tests passed with 5 tests.
  - Reference JSON parse check passed.
  - Full test suite passed with 46 tests.
  - `git diff --check` passed with line-ending warnings only.

## Handoff

- What changed:
  - Added `.agent/scene_graph_pipeline.md` to document the root image/PDF reconstruction architecture.
  - Added `js/ai/SceneGraphCompiler.js` to compile high-level scene nodes and relations into deterministic GraphA operations.
  - Added `tests/scene-graph-compiler.test.js` for circle-sector scenes, graph/number-line scenes, radius support points, unsupported primitive warnings, and strict selected patch behavior.
  - Updated the MathGraph drawing skill and JSON manual/retrieval references to describe scene graph prompting and compiler limits.
- What remains:
  - Wire live image/PDF recreate-mode OpenAI prompts to request scene graphs by default.
  - Add first-class chart and curved-solid primitives before claiming exact textbook parity for those categories.
  - Add source-crop visual evals that compare compiled renders against PDF crops.

---

## Status

- Task: Image/PDF reference guardrails and JSON manual retrieval
- State: Done
- Last updated: 2026-05-25

## Plan

1. Record the behavior change in planning docs.
2. Add selected-object patch semantic validation to the local GraphA validation layer.
3. Load and summarize the JSON feature manual/retrieval index for text and image OpenAI prompts.
4. Add image-analysis repair retry when semantic validation fails.
5. Wire intent validation into the browser image apply path.
6. Add PDF category semantic validation for live OpenAI sample results.
7. Update docs/tests, run verification, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5
- [x] Step 6
- [x] Step 7

## Decisions

- Decision: Treat selected-object patching as an app-owned contract, not only a prompt preference.
- Reason: Live API output can be schema-valid and still ignore the selected object.
- Decision: Use the existing JSON manual as a compact prompt reference rather than embedding the full manual every time.
- Reason: The retrieval index and feature manual already describe supported types, required fields, known gaps, and current approximation rules.
- Decision: Treat PDF sample acceptance as a category-specific semantic gate rather than a render smoke test.
- Reason: The failed live outputs were often valid GraphA JSON but had wrong math structure.

## Blockers

- Blocker: None currently.

## Verification

- Checks run:
  - `npm.cmd test`
  - `node tools\render-pdf-ai-drawing-samples.mjs`
  - `node tools\validate-live-openai-pdf-results.mjs` with expected non-zero result converted to success for the old weak live output set
  - `git diff --check`
- Result:
  - Unit/schema tests passed with 41 tests.
  - Browser render helper produced 12 sample screenshots and 0 failures.
  - Saved live-result semantic validation intentionally rejected 7 previous weak outputs and wrote `tmp/live-openai-pdf-ai-samples/semantic-validation-report.json`.
  - `git diff --check` passed with line-ending warnings only.

## Handoff

- What changed:
  - Added prompt-time JSON manual loading and compact reference selection for OpenAI text/image requests.
  - Added selected-object patch semantic validation and image recreate operation-budget validation.
  - Added one OpenAI image repair retry when semantic validation rejects the first response.
  - Wired image patch/recreate intent validation through the browser apply path.
  - Added `SemanticValidator` category gates for the 12 PDF sample categories.
  - Updated the live OpenAI PDF runner to inject the JSON manual, optionally attach available source page/crop images, and retry on semantic failures.
  - Added a report tool that rechecks prior live results and records exact semantic failure causes.
- What remains:
  - Curved solids/charts still need first-class primitives for true textbook parity.
  - Exact PDF crops and crop metadata should be preserved for future vision-based reruns.
  - Server-side API proxy remains a separate production hardening follow-up.

---

## Status

- Task: Monochrome default drawing output
- State: Done
- Last updated: 2026-05-24

## Plan

1. Record the behavior change in the project planning docs.
2. Change runtime constructors, canvas primitive fallbacks, settings defaults, and UI color input defaults to black.
3. Update AI prompt examples and project-local drawing skill guidance to prefer black unless a color is explicitly requested.
4. Normalize synthetic/PDF sample operations so reference-generated diagrams render in black.
5. Add focused tests for monochrome defaults and run unit/browser render verification.
6. Update progress log, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5
- [x] Step 6

## Decisions

- Decision: Preserve explicit color support while changing defaults and examples.
- Reason: Users may still ask for red/blue highlights intentionally, but the default exam-style output should not introduce colors on its own.
- Decision: Treat legacy stored default palette values as stale defaults and migrate them to black on load.
- Reason: Otherwise the app could keep showing colored output on browsers that had opened earlier builds.

## Blockers

- Blocker: None currently.

## Verification

- Checks run:
  - `npm.cmd test`
  - `node tools\render-pdf-ai-drawing-samples.mjs`
  - `git diff --check`
- Result:
  - Unit/schema/render contract tests passed with 35 tests.
  - Browser render helper produced 12 sample screenshots and 0 failures.
  - `git diff --check` passed with line-ending warnings only.

## Handoff

- What changed:
  - Runtime object defaults, canvas primitive fallbacks, tool previews, AI prompt examples, skill references, synthetic data, and PDF fixtures now default style colors to `#000000`.
  - Added `tests/monochrome-defaults.test.js` to guard runtime defaults, legacy palette migration, and reference sample colors.
- What remains:
  - Explicit user-requested colors remain supported by the schema and update flow.

---

## Status

- Task: Teacher-guide PDF diagram sampling and MathGraph AI drawing parity check
- State: Done
- Last updated: 2026-05-24

## Plan

1. Read project operating docs, MathGraph drawing skill references, and PDF/browser workflow guidance.
2. Inspect the three local teacher-guide PDFs and render candidate sample pages.
3. Select non-overlapping diagram categories by unit/source.
4. Create Korean AI drawing prompts plus GraphA `operations[]` fixtures.
5. Validate fixtures with `SchemaValidator` and reference checks.
6. Render all fixtures in a real browser canvas, record results, update docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5
- [x] Step 6

## Decisions

- Decision: Validate the same final `operations[]` contract instead of calling an external paid API.
- Reason: No API key is available in this environment, and MathGraph's app-owned quality boundary is the strict GraphA patch after model output parsing.
- Decision: Keep source PDF renders and browser screenshots under `tmp/`.
- Reason: They are local verification artifacts and the source PDFs/screenshots should not be committed.
- Decision: Add Playwright as a dev dependency.
- Reason: The render helper needs a normal Node-importable browser automation package for repeatable local canvas checks.

## Blockers

- Blocker: None for local contract/render verification.
- Risk: Exact pixel parity with textbook images remains out of scope because the app reconstructs editable vector math objects.

## Verification

- Checks run:
  - `npm.cmd test`
  - `node tools\render-pdf-ai-drawing-samples.mjs`
- Result:
  - Unit/schema tests passed with 32 tests.
  - Browser render helper produced 12 screenshots and 0 failures.

## Handoff

- What changed:
  - Added `.agent/pdf_ai_drawing_audit.md`.
  - Added `docs/pdf-ai-drawing-sample-audit.md`.
  - Added `tests/fixtures/pdf-ai-drawing-samples.json`.
  - Added `tests/pdf-ai-drawing-samples.test.js`.
  - Added `tools/render-pdf-ai-drawing-samples.mjs`.
  - Added `playwright` as a dev dependency.
- What remains:
  - First-class chart primitives, curved solids, independent text labels, and stronger construction solvers are needed for closer textbook parity.

---

## Status

- Task: Token-efficient MathGraph AI drawing reference skill
- State: Done
- Last updated: 2026-05-24

## Plan

1. Read project operating docs, local OpenAI context, and existing AI/runtime code.
2. Inventory the current feature surface from validator, patch applier, object manager, UI tools, fallback parser, and docs.
3. Update planning docs before creating new reference artifacts.
4. Create a JSON feature manual, synthetic drawing data, and retrieval index.
5. Create a project-local skill that points agents/API orchestration to the smallest needed reference file.
6. Validate JSON/JSONL plus existing tests, update progress log, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5
- [x] Step 6

## Decisions

- Decision: Put the new drawing skill under `.agents/skills/mathgraph-drawing`.
- Reason: The skill is project-specific and should travel with this repository rather than becoming a global Codex skill.
- Decision: Keep detailed examples in JSON/JSONL references rather than in `SKILL.md`.
- Reason: Future API prompts should load only matching examples by tag, scenario, or object type.
- Decision: Keep examples inside the current validated `operations[]` contract.
- Reason: This avoids adding new runtime behavior while giving GPT calls reliable composition patterns.

## Blockers

- Blocker: None currently.
- Risk: Direct browser API-key storage remains a BYOK/personal-use compromise and is not changed by this documentation/reference task.

## Verification

- Checks run:
  - Inline Node JSON/JSONL parse and `SchemaValidator`/reference validation for all synthetic examples.
  - `py C:\Users\pbj95\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents\skills\mathgraph-drawing`
  - `npm.cmd test`
  - `git diff --check`
- Result:
  - Passed. The synthetic validator checked 12 examples.
  - Skill validation reported `Skill is valid!`.
  - Unit tests reported 29 passing tests.
  - `git diff --check` passed with line-ending warnings only.

## Handoff

- What changed:
  - Added `.agents/skills/mathgraph-drawing/SKILL.md`.
  - Added `feature-manual.json`, `retrieval-index.json`, and `synthetic-drawing-data.jsonl` references.
  - Linked the new skill from `docs/ai-reference.md`.
- What remains:
  - Future runtime/schema changes must update the new references.
  - Existing non-skill dirty files in the worktree were left untouched.

---

## Previous Status

- Task: PDF-driven geometry and graph coverage improvement
- State: Done
- Last updated: 2026-05-19

## Plan

1. Read project operating docs, local OpenAI context, and relevant PDF/browser skills.
2. Sample the three local teacher-guide PDFs for representative diagram needs.
3. Update planning docs before runtime/schema changes.
4. Add first-class polygon runtime and AI schema parity.
5. Reconnect deterministic fallback for no-key/failed-API shape generation.
6. Run unit tests, render browser screenshots, update docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5
- [x] Step 6

## Decisions

- Decision: Prioritize first-class polygon support.
- Reason: The sampled PDF pages repeatedly use triangles, quadrilaterals, similarity figures, graph regions, and histogram-like bars; a filled/selectable polygon closes the widest runtime and AI parity gap.
- Decision: Keep direct Responses API calls and strict Structured Outputs unchanged.
- Reason: This pass extends the graph operation contract but does not need new OpenAI orchestration or server-side behavior.
- Decision: Keep large teacher-guide PDFs out of Git.
- Reason: Each source PDF exceeds normal GitHub file-size limits and is local analysis input rather than app source.
- Decision: Validate the browser path with local structured JSON instead of a live external API call.
- Reason: No user API key was available in this environment; the same validated `operations[]` contract is used after OpenAI Responses output parsing.

## Blockers

- Blocker: None.
- Risk: Browser-local API keys remain a public-deployment security concern.
- Next action: Add Vercel serverless proxy/BYOK split in a follow-up if this becomes a shared production service.

## Verification

- Checks run:
  - `npm.cmd test`
  - `git diff --check`
  - `node --check js\objects\Polygon.js; node --check js\ai\AIService.js; node --check js\main.js; node --check js\tools\PolygonTool.js`
  - Headless Chrome/Playwright-core screenshot validation against `http://127.0.0.1:4173/`
- Result:
  - Passed. Unit tests reported 27 passing tests.
  - Browser validation produced `tmp/browser-captures/02-ai-polygon-coverage-scene.png` with 18 valid objects and no console errors.
  - Chat JSON validation produced `tmp/browser-captures/03-chat-json-polygon.png` with 1 valid polygon and no console errors.

## Handoff

- What changed:
  - Added first-class polygon runtime, tool creation, AI schema validation, AI patch application, SVG export, fallback examples, docs, and tests.
- What remains:
  - Follow-up chart/solid coverage still needed for histogram/frequency polygon/box plots and cylinder/cone/sphere style solids.
- Official sources checked:
  - `https://developers.openai.com/api/docs/guides/structured-outputs`
  - `https://developers.openai.com/api/reference/resources/responses/methods/create`
  - `https://developers.openai.com/api/docs/guides/tools-computer-use`

---

## Previous Task Snapshot

- Task: OpenAI Structured Outputs alignment for AI graph generation
- State: Done
- Completed: 2026-04-25
- Verification: `node --check js/ai/AIService.js`, targeted parse check, `node --test tests/ai-flow.test.js`, `npm.cmd test`, and `git diff --check` all passed.
