# PRD

## Summary

- Task: Monochrome default drawing output
- Owner: Codex
- Date: 2026-05-24
- Related files:
  - `js/objects/GeoObject.js`
  - `js/core/SettingsManager.js`
  - `js/core/Canvas.js`
  - `js/ai/AIService.js`
  - `.agents/skills/mathgraph-drawing/`
  - `tests/fixtures/pdf-ai-drawing-samples.json`

## Problem

- Runtime defaults, AI examples, and synthetic references still contain mixed blue, green, orange, purple, and red colors.
- As a result, Korean natural-language drawing requests and reference-based tests can keep producing multi-color diagrams even when the desired baseline is a black exam-style figure.
- Existing browser localStorage may also preserve legacy default colors.

## Goals

- Make black (`#000000`) the default stroke/fill color for newly created MathGraph objects.
- Keep explicit color support available when a user intentionally asks for a specific color.
- Normalize AI prompt examples, skill references, synthetic data, and PDF sample fixtures so default examples render in black.
- Migrate legacy saved default style colors to black so old browser settings do not keep reintroducing colored defaults.

## Non-Goals

- Do not remove color controls or explicit color fields from the schema.
- Do not change grid, axes, selection highlight, or other UI feedback colors unless they are object default output colors.
- Do not add new drawing primitives.

## Acceptance Criteria

- [x] Runtime constructors and canvas primitive fallback colors use black by default.
- [x] Settings and color picker defaults start from black, including legacy setting migration.
- [x] AI/skill reference examples no longer teach multi-color defaults.
- [x] Tests confirm synthetic/PDF reference operation colors are black by default.
- [x] Browser rendering verification passes with the updated sample set.

## Risks and Open Questions

- Existing saved drawings with explicit colors should remain colored because those colors are part of the saved document, not defaults.
- Selection and hover colors may still appear during editing; the exported/generated object baseline should be black.

---

## Summary

- Task: Teacher-guide PDF diagram sampling and MathGraph AI drawing parity check
- Owner: Codex
- Date: 2026-05-24
- Related files:
  - `.agent/pdf_ai_drawing_audit.md`
  - `docs/pdf-ai-drawing-sample-audit.md`
  - `tests/fixtures/pdf-ai-drawing-samples.json`
  - `tests/pdf-ai-drawing-samples.test.js`
  - `tools/render-pdf-ai-drawing-samples.mjs`

## Problem

- The local teacher-guide PDFs contain many diagram styles across number lines, geometry, functions, solids, and statistics.
- MathGraph needs an evidence-based check of whether AI-generated GraphA patches can reproduce representative diagrams from those PDFs.
- The important distinction is between exact PDF image cloning and editable vector reconstruction of the same mathematical structure.

## Goals

- Pick representative, non-overlapping sample categories from the three PDFs.
- Convert each sample into a Korean AI drawing request plus GraphA `operations[]`.
- Validate every sample against the current AI schema and reference rules.
- Render every sample in the browser canvas and record pass/fail evidence.
- Document which categories match, which are structural matches, which are approximations, and which remain gaps.

## Non-Goals

- Do not build a full automatic PDF-to-diagram extraction pipeline.
- Do not require pixel-perfect reproduction of textbook artwork.
- Do not add new runtime primitives in this pass.
- Do not call external OpenAI/Gemini APIs without an available user API key.

## Acceptance Criteria

- [x] At least several non-overlapping diagram categories are sampled from the PDFs.
- [x] Each sample has a Korean prompt and valid GraphA operations fixture.
- [x] Samples validate through current `SchemaValidator` and reference checks.
- [x] Samples render in a browser canvas with non-empty visual output.
- [x] A report records parity results and remaining gaps.

## Risks and Open Questions

- Curved solids and statistical charts still require first-class primitives before exact parity can be expected.
- Independent explanatory text labels are not first-class objects, so textbook instruction layouts remain approximate.
- API-backed quality may differ by model prompt quality, but the local schema/render contract now has repeatable coverage.

---

## Summary

- Task: Token-efficient MathGraph AI drawing reference skill
- Owner: Codex
- Date: 2026-05-24
- Related files:
  - `.agents/skills/mathgraph-drawing/SKILL.md`
  - `.agents/skills/mathgraph-drawing/references/feature-manual.json`
  - `.agents/skills/mathgraph-drawing/references/synthetic-drawing-data.jsonl`
  - `.agents/skills/mathgraph-drawing/references/retrieval-index.json`
  - `docs/ai-reference.md`

## Problem

- MathGraph already has a broad drawing runtime and a strict AI `operations[]` patch contract, but future GPT API calls need a compact way to find only the relevant object schemas, construction heuristics, and examples.
- Loading every manual, schema, and example into every request would waste tokens and make Korean natural-language prompts less reliable.
- Complex textbook-style requests often require multi-step planning: create support points first, build base primitives, add derived construction objects, then style or annotate the figure.

## Goals

- Inventory the current runtime, AI JSON schema, UI tools, fallback parser, export, save/load, and settings features in a machine-readable JSON manual.
- Create synthetic reference examples for complex plane figures, solid figures, function/graph situations, number lines, and mixed diagram tasks.
- Add a project-local skill that tells future agents/API orchestrators how to load only the relevant references instead of the full dataset.
- Keep the current app behavior unchanged.
- Document verification and update the progress log after the reference artifacts are created.

## Non-Goals

- Do not add new drawing primitives in this pass.
- Do not replace the existing browser-side BYOK API flow or add a server-side OpenAI proxy in this pass.
- Do not claim full statistical chart or curved-solid coverage beyond the current primitives and composition examples.

## Acceptance Criteria

- [x] A JSON feature manual covers current AI-create types, required fields, optional fields, runtime/UI features, parser/fallback features, and known gaps.
- [x] Synthetic examples include realistic Korean prompts and valid `operations[]` payloads for complex plane, solid, graph, and mixed situations.
- [x] A skill exists under `.agents/skills/` with concise loading instructions and a retrieval index for selective reference use.
- [x] JSON/JSONL artifacts parse successfully.
- [x] `npm.cmd test` and `git diff --check` are run or any skipped verification is recorded.

## Risks and Open Questions

- If future runtime schemas change, the skill references must be updated alongside `SchemaValidator`, `PatchApplier`, `AIService`, and `docs/ai-reference.md`.
- Some requested diagrams will still need approximations because histogram/box-plot/scatter primitives and cylinder/cone/sphere objects are not first-class runtime types yet.

---

## Summary

- Task: PDF-driven geometry and graph coverage improvement
- Owner: Codex
- Date: 2026-05-19
- Related files:
  - `js/objects/Polygon.js`
  - `js/core/ObjectManager.js`
  - `js/tools/PolygonTool.js`
  - `js/ai/AIService.js`
  - `js/ai/SchemaValidator.js`
  - `js/ai/PatchApplier.js`
  - `tests/ai-flow.test.js`
  - `docs/ai-reference.md`

## Problem

- The three local teacher-guide PDFs include many plane figures, graph figures, and solid figure examples.
- MathGraph already covers points, lines, circles, arcs/sectors, functions, number lines, prisms, and pyramids.
- The main visible gap from the sampled pages is a first-class polygon/filled region object. Triangles, quadrilaterals, similarity diagrams, histogram bars, and shaded regions are currently approximated as separate segments, which weakens selection, fill styling, AI schema parity, and visual comparison.
- The local no-key AI path also bypasses older shape fallbacks when `processCommand()` runs without an API key.

## Goals

- Add a real polygon runtime object with fill/stroke rendering, hit testing, JSON persistence, and UI tool creation.
- Add AI schema, validation, patch application, and documentation for `polygon`.
- Reconnect the no-key/failed-API fallback path so common PDF-style shapes still generate deterministically.
- Keep OpenAI Responses API architecture unchanged: strict Structured Outputs remains the API-backed drawing contract.
- Add focused tests for polygon AI parity and fallback behavior.

## Non-Goals

- Do not build a full OCR or automatic PDF-to-diagram extraction pipeline in this pass.
- Do not add every statistical chart or every curved 3D solid type yet.
- Do not move BYOK API keys behind a Vercel proxy in this pass.
- Do not commit the large source PDFs.

## Acceptance Criteria

- [x] Runtime can create, render, select, serialize, and restore a polygon object.
- [x] Polygon tool creates a polygon object instead of only loose segments.
- [x] AI Structured Outputs schema accepts `polygon` with `vertexIds`.
- [x] Patch applier can create polygon objects and resolve temporary vertex IDs.
- [x] Local fallback can draw triangle/quadrilateral requests through `processCommand()` without an API key.
- [x] Tests and browser validation show the app can render representative PDF-style diagrams.

## Risks and Open Questions

- A polygon object improves the broadest PDF gap, but histograms still need bar/axis ergonomics in a later pass.
- Curved solid figures such as cylinders, cones, and spheres are still not first-class objects.
- Browser-stored API keys remain acceptable only for personal/BYOK usage; public deployment should move API calls behind a server-side proxy later.

---

## Previous Summary

- Task: OpenAI Structured Outputs alignment for AI graph generation
- Owner: Codex
- Date: 2026-04-25
- Related files:
  - `js/ai/AIService.js`
  - `index.html`
  - `tests/ai-flow.test.js`
  - `docs/ai-reference.md`

## Problem

- The current OpenAI integration uses the Responses API, but still requests the older `json_object` JSON mode.
- The app already has a validated `operations[]` contract, so OpenAI Structured Outputs can enforce the same shape before the local validator runs.
- Model defaults and UI options are behind the current OpenAI reference context.

## Goals

- Use Responses API Structured Outputs with a strict JSON Schema for graph operations.
- Refresh OpenAI model defaults/options through configuration instead of scattered literals.
- Keep local schema validation and rollback-based patch application as the app-owned safety layer.
- Preserve the API-free deterministic fallback path.

## Non-Goals

- Do not introduce the Agents SDK or function-calling orchestration for this narrow graph-generation path.
- Do not migrate API keys to a Vercel serverless proxy in this pass.
- Do not change the graph object runtime contract beyond null-stripping required by strict structured output compatibility.

## Acceptance Criteria

- [x] OpenAI text and vision requests use `text.format.type = "json_schema"` with `strict: true`.
- [x] The request body sets `store: false` and uses configured `reasoning.effort` / `text.verbosity`.
- [x] OpenAI model defaults and UI model options include current reference models.
- [x] Structured output JSON is parsed and sanitized before the existing validator/applier flow.
- [x] Unit tests cover request construction without real network calls.
- [x] `npm.cmd test` passes.

## Risks and Open Questions

- Strict Structured Outputs require all schema fields to be required; optional graph fields will be represented as nullable values and stripped locally before validation/application.
- Browser-stored API keys remain acceptable only for personal/BYOK usage; public deployment should move API calls behind a server-side proxy in a follow-up.

---

## Previous Summary

- Task: Mk2.2 usability and AI/runtime parity improvements
- Owner: Codex
- Date: 2026-04-13
- Related files:
  - `js/main.js`
  - `js/core/Canvas.js`
  - `js/ui/CommandPalette.js`
  - `js/objects/Point.js`
  - `js/ai/SchemaValidator.js`
  - `js/ai/PatchApplier.js`
  - `docs/ai-reference.md`

## Problem

- What is broken or missing?
  - SVG export is still a placeholder and does not export actual geometry.
  - Axis visibility state is handled inconsistently across canvas rendering, export, and command palette actions.
  - AI/runtime parity is incomplete: `numberLine` exists in the runtime but is not fully handled across AI validation/application/docs.
  - Function-line intersections are defined conceptually but still return no computed intersections.
- Why does this matter now?
  - These gaps sit on user-facing paths that are already visible in the UI, so they reduce trust more than a purely missing future feature.

## Goals

- Primary goal:
  - Improve reliability of visible, high-frequency features without broad refactors.
- Secondary goal:
  - Reduce mismatch between UI/runtime capabilities and AI-assisted workflows.
  - Close one important geometry correctness gap for analytic use cases.

## Non-Goals

- Out of scope:
  - Full general-purpose SVG serializer for every object type.
  - Full dimension-driving workflow UI.
  - Multi-file project management or cloud collaboration.

## Scope

- In scope:
  - Make axis toggles behave consistently in canvas rendering, export, and command palette actions.
  - Upgrade SVG export from an empty shell to a useful first-pass vector export for common 2D objects.
  - Add AI support for creating `numberLine` objects in validator, patch application, and docs.
  - Implement function-line intersection solving for graph/function workflows.
- Constraints:
  - Do not overwrite unrelated in-progress user changes in the dirty worktree.
  - Keep edits focused and incremental because several core files already contain other modifications.
- Assumptions:
  - Existing Vercel linking is already configured and only needs to remain intact.
  - GitHub push may be blocked if this repo still has no remote configured.

## Acceptance Criteria

- [x] Exporting SVG produces visible vector content for common supported objects instead of a blank file.
- [x] Axis visibility uses the same state model in normal rendering, exports, and command palette actions.
- [x] AI can create a `numberLine` object through the validated patch flow.
- [x] Function-line intersection objects resolve real intersection points when intersections exist.

## Risks and Open Questions

- Risks:
  - SVG export may still need partial fallbacks for complex objects or labels.
  - Function intersection solving can produce unstable results around vertical or tangent cases if the numeric method is weak.
- Open questions:
  - Whether `polygon` should join this AI/runtime parity pass or remain a later follow-up.
