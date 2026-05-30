# PRD

## Summary

- Task: Live OpenAI CSAT-style drawing audit
- Owner: Codex
- Date: 2026-05-30
- Related files:
  - `tools/run-live-openai-random-drawing-smoke.mjs`
  - `docs/live-openai-csat-drawing-audit.md`
  - `docs/progress-log.md`

## Problem

- The user supplied an OpenAI API key and asked to draw varied graph/diagram types that would be useful for CSAT or mock-exam materials.
- Previous local and live runs had shown that schema-valid GraphA output can still be visually or mathematically weak, so this check must compare rendered output against the requested prompt.
- The supplied key must not be stored in source files, reports, screenshots, or committed documentation.

## Goals

- Run a live OpenAI drawing smoke pass over a diverse, non-overlapping exam-style prompt set.
- Render a local reference target contact sheet for comparison.
- Render the live OpenAI outputs in the real MathGraph browser canvas.
- Compare each prompt against the actual rendered output and record pass/caveat judgements.
- Record verification, secret-handling, and remaining limitations in durable project docs.

## Non-Goals

- Do not add new drawing primitives in this pass.
- Do not store or echo the API key.
- Do not claim exact native support for unsupported targets such as annular sectors, native chart objects, or full 3D containment.

## Acceptance Criteria

- [x] At least 10 varied exam-style graph/diagram prompts are checked through live OpenAI generation.
- [x] Each live result passes GraphA schema/reference/intent/runtime/semantic validation or is documented as failed.
- [x] Each live result renders in the browser canvas with no console errors or is documented as failed.
- [x] Prompt/result comparison is recorded in a dedicated audit note.
- [x] The repository is scanned to confirm no actual `sk-proj-...` key was written.

---

## Summary

- Task: Solid 3D broad case matrix and zero-error audit
- Owner: Codex
- Date: 2026-05-29
- Related files:
  - `tools/render-solid3d-case-matrix.mjs`
  - `tests/solid3d-hidden-edges.test.js`
  - `js/objects/Solid3D.js`
  - `docs/progress-log.md`

## Problem

- The user asked to try "many different things again" and expects every solid-geometry case to avoid errors.
- The previous fix corrected a representative rectangular-prism convention, but regression coverage still needs broader shape, vertex-count, and projection-direction coverage.
- Schema-valid GraphA operations are not enough; the actual canvas must render without console errors and without front prism edges being dashed.

## Goals

- Add a repeatable browser-rendered matrix for many first-class `prism` and `pyramid` cases.
- Cover rectangular, triangular, pentagonal, and hexagonal prisms; square, triangular, pentagonal, and hexagonal pyramids; nested solid compositions; and cross-section/diagonal support geometry.
- Assert that prism `base`/front edges stay solid while shifted `top`/rear hidden edges can be dashed.
- Assert that every case creates valid objects, renders non-empty canvas pixels, and produces no browser console errors.
- Save a contact-sheet screenshot and machine-readable report under `tmp/` for visual review.

## Non-Goals

- Do not add unsupported curved solid primitives such as cylinders, cones, or spheres.
- Do not use or store the pasted OpenAI API key; this pass is local GraphA/runtime verification.
- Do not replace first-class solids with manual segment bundles.

## Acceptance Criteria

- [x] At least 20 varied solid cases render in a real browser canvas.
- [x] Every case reports zero console errors and zero invalid runtime objects.
- [x] Prism cases report no hidden `base` edges.
- [x] Prism cases include at least one hidden rear/top or depth edge when a shifted rear face is present.
- [x] Focused Solid3D tests, the browser matrix tool, full tests, whitespace check, and secret-pattern scan pass.

---

## Summary

- Task: Solid 3D visible/hidden edge audit and prism correction
- Owner: Codex
- Date: 2026-05-28
- Related files:
  - `js/objects/Solid3D.js`
  - `tests/solid3d-hidden-edges.test.js`
  - `docs/progress-log.md`

## Problem

- The user asked to draw several rectangular-prism/prism and pyramid forms and confirm that back edges render dashed while front edges render solid.
- A browser audit of multiple current solids showed that `pyramid` mostly follows the expected textbook convention, but `prism` treats the shifted top face as the viewer-facing face.
- In common `ABCD-A'B'C'D'` style prism drawings, the base/front face should remain solid while the shifted/rear face contributes the hidden dashed edges.

## Goals

- Keep first-class `prism`/`pyramid` objects responsible for hidden-edge dashed/solid rendering.
- Change `prism` visibility so the base face is treated as the near/front face and the shifted top face as the rear face.
- Add regression coverage that checks render-time dashed flags for front and rear prism edges, not only internal `_hiddenEdges` indices.
- Capture a browser-rendered multi-solid audit image after the fix.

## Non-Goals

- Do not add curved solid primitives such as cylinders, cones, or spheres.
- Do not use or store the pasted OpenAI API key; live external OpenAI calls require `OPENAI_API_KEY` in the environment.
- Do not replace first-class solids with hand-drawn segment bundles.

## Acceptance Criteria

- [x] Rectangular prism front/base edges render solid in the audit case.
- [x] Rectangular prism rear/top hidden edges render dashed in the audit case.
- [x] Existing pyramid hidden-edge behavior remains covered.
- [x] Focused Solid3D tests, full tests, browser screenshot validation, and whitespace check pass.

---

## Summary

- Task: Novel OpenAI drawing stress set and reference visual targets
- Owner: Codex
- Date: 2026-05-28
- Related files:
  - `tools/run-live-openai-random-drawing-smoke.mjs`
  - `tests/live-openai-random-smoke.test.js`
  - `docs/stress-novel-openai-drawing-audit.md`
  - `docs/ai-reference.md`
  - `.agents/skills/mathgraph-drawing/references/feature-manual.json`
  - `docs/progress-log.md`

## Problem

- The user requested another 10 OpenAI-generated MathGraph drawings that do not overlap the earlier `default`, `extended`, `stress`, or `stress_extra` prompt sets.
- The live API key is not currently available through `OPENAI_API_KEY`; using a pasted key directly in shell commands or files would expose a secret.
- Previous batches showed that schema, reference, and non-empty render checks can still miss visual-intent mismatches.
- Future runs need a way to show the intended target images even when the external API cannot be safely called in the current process.

## Goals

- Add a third 10-prompt stress set named `stress_novel` with new function graphs, plane figures, and nested solids.
- Add local reference payloads and a reference-render mode so the intended visual targets can be shown without an API call.
- Add prompt-local semantic gates for the new prompt families: exact function expressions, directrix/asymptote lines, circle radii/concentricity, named tangent segments, collinear construction points, and nested-solid projection constraints.
- Update prompt context and documentation with the extra geometry context that future drawing requests should include.
- Run the live OpenAI loop if `OPENAI_API_KEY` becomes available; otherwise record the blocked reason and still verify local reference targets.

## Non-Goals

- Do not store or echo pasted API keys.
- Do not add exact primitives for annular sectors, function-bounded curved fills, ellipses, cylinders, cones, or spheres in this pass.
- Do not claim a local reference render is a live OpenAI result.

## Acceptance Criteria

- [x] `LIVE_AI_PROMPT_SET=stress_novel` selects 10 non-overlapping prompts.
- [x] `LIVE_AI_RENDER_REFERENCE_TARGETS=1` renders the intended target contact sheet without `OPENAI_API_KEY`.
- [x] New semantic validators reject the most likely visual mismatches for the new prompt families.
- [x] Prompt/result or prompt/target comparison and root-cause analysis are documented.
- [x] Focused smoke tests and useful local verification pass.
- [x] A live external rerun is performed only if `OPENAI_API_KEY` is safely available through the environment; otherwise the blocked reason is recorded.

---

## Summary

- Task: First-class lens regions and vector fill tool
- Owner: Codex
- Date: 2026-05-28
- Related files:
  - `js/objects/LensRegion.js`
  - `js/core/ObjectManager.js`
  - `js/ai/SceneGraphCompiler.js`
  - `js/ai/AIService.js`
  - `js/ai/SchemaValidator.js`
  - `js/ai/PatchApplier.js`
  - `js/tools/FillTool.js`
  - `docs/ai-reference.md`
  - `.agents/skills/mathgraph-drawing/references/feature-manual.json`
  - `docs/progress-log.md`

## Problem

- Two-circle lens fills currently require a polygon approximation or two circular segments.
- Polygon approximations can self-cross, miss the true curved boundary, or require hidden helper points that still affect visual parity.
- Two circular segments can approximate the filled overlap, but each segment draws its chord, creating internal straight lines that are not part of the intended lens.
- Users also need a direct "paint bucket" workflow to click an existing closed vector object and change its fill color/opacity.

## Goals

- Add a first-class `lensRegion` object whose boundary is the two visible circular arcs of the intersection of two circles.
- Let GraphA operations and scene graph compilation create lens regions deterministically from two circle ids.
- Add a fill tool that applies the current fill color and opacity to supported closed objects with undo history.
- Update AI/schema/manual docs so future generated diagrams choose `lensRegion` instead of polygon workarounds for two-circle overlaps.
- Verify with focused tests and a browser-rendered visual smoke artifact.

## Non-Goals

- Do not use or store pasted API keys.
- Do not introduce raster flood fill into the canvas bitmap; this pass targets vector objects only.
- Do not add first-class general implicit-region solving for arbitrary function-bounded areas.

## Acceptance Criteria

- [x] `lensRegion` renders a filled two-circle overlap without an internal chord.
- [x] `lensRegion` serializes/deserializes, validates through GraphA schema, and can be created by `PatchApplier`.
- [x] Scene graph nodes such as `lensRegion` or `circleIntersectionRegion` compile into GraphA operations.
- [x] The toolbar includes a fill tool with fill color/opacity controls.
- [x] Clicking a supported closed object applies fill style and can be undone.
- [x] Focused tests, full tests, and browser visual smoke checks pass or blocked reasons are recorded.

---

## Summary

- Task: Recursive visual parity loop for stress-extra OpenAI drawings
- Owner: Codex
- Date: 2026-05-28
- Related files:
  - `tools/run-live-openai-random-drawing-smoke.mjs`
  - `js/ai/AIService.js`
  - `tests/live-openai-random-smoke.test.js`
  - `tests/ai-flow.test.js`
  - `docs/stress-extra-openai-drawing-audit.md`
  - `docs/ai-reference.md`
  - `docs/progress-log.md`

## Problem

- The latest `stress_extra` run passed schema, reference, semantic, and render checks, but visual review still found gaps.
- The strongest remaining mismatch is that some `angleDimension` objects exist in JSON but do not render as visible angles because a helper point can coincide with the vertex.
- The exponential/log prompt can pass with two nearby sample points even when the visual target needs the two actual intersections.
- The two-circle lens prompt can pass with helper points hidden only by label, leaving extra visible dots.
- The hexagon prompt allows a default filled `polygon`, producing a shaded hexagon even when the user asked for a construction-style outline.
- Nested solids can pass containment checks while still looking cramped or ambiguous because internal solids overlap each other visually.
- A pyramid can pass broad schema/reference checks while reusing the apex as a base vertex.
- A lens diagram can pass with unequal circle radii or a self-crossing polygon fill.
- A prism can pass by type while the base/top vertex order is visually twisted.
- An asymptote prompt can pass with two dashed lines even when the vertical line equation is wrong.

## Goals

- Treat "visually matches the requested figure" as the acceptance bar, not only `validation.valid`.
- Add prompt-local checks for renderable angle dimensions.
- Add prompt-local checks for unfilled construction polygons.
- Add prompt-local checks that inner nested solids are visually separated enough to read as distinct solids.
- Add saved-result revalidation so older "all pass" live runs can be rechecked against newer visual-intent gates without another API call.
- Add prompt-local checks for line equations, lens circle geometry, lens polygon order, pyramid base counts, and prism projection order.
- Push visual guardrails into the runtime OpenAI reference prompt and the MathGraph drawing skill context.
- Update the audit trail with the recursive visual loop decisions.

## Non-Goals

- Do not store API keys in repository files, reports, or committed documentation.
- Do not add new runtime primitives in this pass.
- Do not claim true 3D containment; nested solids remain 2D projection diagrams.

## Acceptance Criteria

- [x] The smoke validator rejects angle dimensions with a helper point coincident with the vertex.
- [x] The hexagon prompt requires an outline polygon rather than an unintended filled region.
- [x] The nested prism+pyramid case requires the two inner solids to be visually separable.
- [x] Saved `fixed2` results are revalidated and known visual mismatches are rejected.
- [x] A local visual target contact sheet is rendered for human comparison.
- [x] The smoke validator rejects wrong rational asymptote line equations.
- [x] The smoke validator rejects unequal-radius or self-crossing lens outputs.
- [x] The smoke validator rejects triangular pyramids when square pyramids are requested.
- [x] The smoke validator rejects twisted prism base/top vertex ordering.
- [x] Final live external rerun passes and is visually reviewed.
- [x] Focused tests and full tests pass.
- [x] Fresh live rendering is rerun if `OPENAI_API_KEY` is available; otherwise the blocked reason is recorded.

---

## Summary

- Task: Additional stress OpenAI drawing set with prompt/result audit
- Owner: Codex
- Date: 2026-05-28
- Related files:
  - `tools/run-live-openai-random-drawing-smoke.mjs`
  - `tests/live-openai-random-smoke.test.js`
  - `docs/stress-extra-openai-drawing-audit.md`
  - `docs/ai-reference.md`

## Problem

- The previous stress set proved that complex graphs and nested solids can render, but it mostly covered one batch of prompts.
- The next quality risk is broader prompt diversity: exponential/log graphs, quartic tangents, lens regions, angle webs, and multiple nested-solid compositions.
- Some saved live outputs were valid and visible but still semantically fragile: duplicate circle-intersection lens points, inner solid vertices outside the outer solid projection, and over-strict segment expectations for polygon boundaries.

## Goals

- Add a second 10-prompt live smoke set named `stress_extra`.
- Compare saved live OpenAI results with their prompts and record root causes in a durable audit note.
- Add prompt-local semantic gates for the newly observed failure modes.
- Improve nested-solid containment checking from a bounding box to a projection hull.
- Document additional prompt context needed for dense graphs, lens regions, and nested solids.

## Non-Goals

- Do not add new runtime drawing primitives in this pass.
- Do not store API keys in files, reports, or shell commands.
- Do not replace the existing direct GraphA text-command path with scene graph mode in this pass.

## Acceptance Criteria

- [x] `stress_extra` contains 10 additional prompts across functions, plane geometry, and nested solids.
- [x] Prompt/result comparison and root-cause analysis are documented.
- [x] Direct lens-point and nested-solid containment regressions are covered by tests.
- [x] Nested-solid containment uses the outer solid projection hull rather than only an axis-aligned bounding box.
- [x] Focused smoke tests and the full test suite pass.

## Risks and Open Questions

- A fresh external OpenAI rerun still requires `OPENAI_API_KEY` in the process environment. The pasted key was not injected into command history or repo files.
- Curved lens fills and function-bounded regions remain polygon approximations until a first-class curved-fill primitive exists.
- True 3D containment is still represented as a 2D screen-projection quality gate.

---

## Summary

- Task: Scene graph based image/PDF reconstruction foundation
- Owner: Codex
- Date: 2026-05-25
- Related files:
  - `.agent/scene_graph_pipeline.md`
  - `js/ai/SceneGraphCompiler.js`
  - `tests/scene-graph-compiler.test.js`
  - `.agents/skills/mathgraph-drawing/references/feature-manual.json`
  - `.agents/skills/mathgraph-drawing/references/retrieval-index.json`
  - `docs/ai-reference.md`

## Problem

- The current OpenAI image/PDF path can return schema-valid GraphA `operations[]` that still do not match the requested diagram.
- Guardrails, retries, and semantic validators catch more bad outputs, but they do not change the brittle architecture: the model is still asked to directly author low-level app operations.
- Exact or targeted image reconstruction needs an app-owned intermediate representation so MathGraph can compile, validate, and reject unsupported geometry deterministically.
- Partial edits need a stable target model: selected object ids or scene-node ids should determine what can change.

## Goals

- Add a high-level scene graph contract for image/PDF diagram understanding.
- Add a deterministic compiler from scene graph nodes/relations to current GraphA `operations[]`.
- Make unsupported textbook features explicit as warnings rather than silently approximating them as wrong geometry.
- Document how the existing JSON manual and retrieval index should guide scene graph prompting and compilation.

## Non-Goals

- Do not fully replace every live OpenAI image/PDF call in this pass.
- Do not add new chart, cylinder, cone, sphere, OCR, or raster inpainting primitives in this pass.
- Do not change the existing BYOK API-key storage model in this pass.

## Acceptance Criteria

- [x] Scene graph compiler creates valid GraphA operations for plane, circle, graph, number-line, and relation examples.
- [x] Unsupported first-class requests such as cylinder/native chart/text label produce warnings instead of invalid GraphA.
- [x] Tests validate compiler output through `SchemaValidator.validate()` and `validateReferences()`.
- [x] Project docs explain that direct GPT-to-GraphA is only a compatibility path for image/PDF reconstruction, not the root long-term design.

## Risks and Open Questions

- The live OpenAI prompt path still needs a follow-up switch to scene graph mode before this architecture affects all user-facing image/PDF recreation.
- Current GraphA lacks native chart and curved-solid primitives, so exact textbook parity remains impossible for those categories until runtime support is added.
- Scene graph extraction quality still requires evals against real PDF crops; compiler correctness alone is necessary but not sufficient.

---

## Summary

- Task: Image/PDF reference guardrails and JSON manual retrieval
- Owner: Codex
- Date: 2026-05-25
- Related files:
  - `js/ai/AIService.js`
  - `js/ai/SchemaValidator.js`
  - `js/ai/SemanticValidator.js`
  - `js/main.js`
  - `tools/run-live-openai-pdf-ai-samples.mjs`
  - `tools/validate-live-openai-pdf-results.mjs`
  - `.agents/skills/mathgraph-drawing/references/feature-manual.json`
  - `.agents/skills/mathgraph-drawing/references/retrieval-index.json`
  - `tests/ai-flow.test.js`
  - `tests/pdf-ai-drawing-samples.test.js`
  - `docs/ai-reference.md`

## Problem

- Live OpenAI image-reference verification showed that the external API call path works, but the product accepted semantically wrong patches.
- In patch mode, a model response could create new textbook-exercise objects instead of updating the selected object because the app only checked JSON shape, references, and renderability.
- The existing JSON feature manual and retrieval index document the current GraphA contract, but the runtime API prompt path does not yet use them.
- Recreate mode can overgenerate dense grids or unsupported textbook details because the prompt does not carry a compact operation budget and current primitive limitations from the manual.
- The live PDF text-prompt runner accepted outputs that were drawable but mathematically wrong for their category, such as missing number lines, trapezoid histogram bars, non-tangent incircle points, polygon-only distribution curves, and line-like scatter plots.

## Goals

- Add semantic validation for image patch mode so selected-object edits must actually update or delete selected ids.
- Reject strict selected-object patch responses that create new objects or mutate unrelated objects when the user asks to change only the selected part.
- Add an OpenAI image repair retry that resubmits semantic validation errors once before failing.
- Load the project JSON manual/retrieval references in browser API calls and inject a compact, selected GraphA reference into text and image prompts.
- Add recreate-mode guidance and validation for operation budgets and known current gaps.
- Add PDF sample semantic validation so live OpenAI results are rejected or repaired when they miss category-specific math structure.
- Let the live PDF runner use the JSON feature manual and attach available source page/crop images as visual references.

## Non-Goals

- Do not add new curved-solid or chart primitives in this pass.
- Do not add a server-side OpenAI proxy in this pass.
- Do not implement pixel-level raster inpainting or mask editing.
- Do not make API keys persistent outside the current BYOK browser settings flow.

## Acceptance Criteria

- [x] Patch-mode semantic validation fails when selected ids are ignored.
- [x] Strict selected-object edits fail when the model creates unrelated new objects.
- [x] Image analysis retries once with semantic validation errors and accepts a corrected patch.
- [x] Prompt construction includes compact reference-manual guidance selected from `feature-manual.json`.
- [x] Tests cover manual-reference prompt injection, semantic patch validation, and repair retry behavior.
- [x] PDF sample fixtures pass category semantic validation.
- [x] Previous live PDF outputs can be rechecked with a semantic validation report that identifies failing samples and causes.
- [x] `npm.cmd test` and `git diff --check` pass.

## Risks and Open Questions

- Fetching `.agents/skills/...` reference files from a deployed static site depends on those files being published with the app; if a deployment later excludes hidden directories, a public `docs` or `assets` copy may be needed.
- Operation budgets improve quality and latency but may reject legitimately complex textbook reconstructions; users may still need to crop or simplify input images.
- Exact textbook parity for cylinders, cones, spheres, charts, and independent text remains limited until the runtime gains first-class primitives.

---

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
