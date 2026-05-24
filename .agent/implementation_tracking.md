# Implementation Tracking

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
