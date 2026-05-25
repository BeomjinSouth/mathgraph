# Implementation Tracking

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
