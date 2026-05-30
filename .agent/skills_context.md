# Skills and Context

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The request is about turning a clicked enclosed geometry area into editable MathGraph vector objects.
- Skill: Browser / Playwright
- Why it matters:
  - The visible acceptance bar is whether the canvas responds like a paint bucket while preserving vector geometry.

## Current Task Notes

- User concern:
  - Existing object fill was not enough; they want the area enclosed by curves or segments to become colored when clicked.
- Root correction:
  - Keep fill vector-based, not raster-based.
  - Infer a closed segment loop under the click and create a persisted filled region object.
  - Infer a two-circle overlap under the click and create a `lensRegion` automatically.
  - Leave arbitrary function-bounded/implicit regions as a documented follow-up unless a safe runtime primitive exists.
- Verification target:
  - Focused unit tests for loose segment-loop fill, auto lens fill, existing polygon/circle fill, undo, and save/load.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The root fix now lives in the GraphA generation pipeline, where app-owned code can correct common diagram-quality defects before operations reach the canvas.
- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - Model output still uses strict Structured Outputs, but the app no longer depends on prompt compliance alone for known visual layout rules.
- Skill: Browser / Playwright
- Why it matters:
  - The quality bar remains the rendered canvas; tests and render checks should continue to catch cases the enhancer cannot safely normalize.

## Current Task Notes

- User concern:
  - A validator-only fix was not enough; similar requests should come out correctly without the user needing to ask for label offsets, larger angle aids, or better solid projection every time.
- Root cause:
  - The pipeline treated model-authored GraphA as the final answer too early. Validators could reject bad output, but there was no deterministic correction step for recurring presentation failures.
- Fix direction:
  - Add `js/ai/DiagramQualityEnhancer.js` as an app-owned post-generation pass.
  - Run it from `AIService.processCommand` for API and local fallback command results.
  - Run it for image recreate analysis before semantic intent validation; skip it for selected-object patch mode.
  - Respect explicit coordinate-heavy prompts so precise constructions are not rewritten.
- Implemented result:
  - Tangent labels like `T2` and Euler-line labels like `O/G/H` receive screen-space `labelOffset` values when missing.
  - Right-angle requests can gain a larger hidden-label `angleDimension` aid when a default `rightAngleMarker` would be hard to see.
  - Rectangular-prism cross-section requests are widened and their section polygon is normalized to a substantial middle slice.
  - Triangular-pyramid-inside-triangular-prism requests are expanded/recentered so the inner solid reads inside the outer projection with visible margins.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The fix turns human visual review findings into GraphA-aware semantic validators for future OpenAI drawing runs.
- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - The live path uses Responses API structured outputs, but this root-cause pass should rely on saved-result revalidation unless a key is safely present.
- Skill: Browser / Playwright
- Why it matters:
  - The target quality bar is the rendered canvas, so local reference rendering remains part of verification.

## Current Task Notes

- User concern:
  - Prevent a repeat of accepting generated-but-weak drawings as successful.
- Root cause:
  - The smoke test was strong on schema, references, runtime rendering, and object-family semantics, but too weak on human-visible layout: label offsets, right-angle readability, and solid projection proportions.
- Fix direction:
  - Add opt-in `expect` checks for required label offsets and minimum visible label spacing.
  - Validate `rightAngleMarker` geometry so marker rays are resolvable, long enough, and close to perpendicular.
  - Add solid projection checks for outer prism width/height/aspect, cross-section polygon area/span, and inner solid size/margins.
  - Revalidate the saved `tmp/live-openai-csat-drawing-smoke-20260530/live-openai-random-results.json` file and require the old weak outputs to fail.
- Implemented result:
  - Saved-result revalidation now rejects 5 previously accepted weak outputs.
  - Strengthened local reference targets render under `tmp/live-openai-csat-reference-rootfix-20260530/` with 0 failures and 0 browser console errors.
  - Focused smoke tests now cover label offsets, visible right-angle aids, prism projection size, cross-section scale, and inner-solid margins.
- Secret handling:
  - No live API call is needed for the root-cause fix. Do not write or echo the user-provided key.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The live audit must judge OpenAI output against GraphA-supported object families and prompt-local semantic validators, not just a raw screenshot.
- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - The run uses OpenAI Responses API structured output with `OPENAI_API_KEY` supplied only as a process-scoped environment variable.
- Skill: Browser / Playwright
- Why it matters:
  - The actual acceptance evidence is the rendered MathGraph canvas contact sheet and screenshot set.

## Current Task Notes

- User concern:
  - Draw varied graph and diagram types useful for CSAT/mock-exam materials, then compare actual outputs with request prompts to confirm whether the OpenAI drawing path works.
- Prompt set selected:
  - `stress_novel`, because it covers logistic/asymptote/tangent, parabola focus/directrix, absolute-value region, inequality feasible region, concentric circle/sector, external tangents, Euler line, regular pentagon/pentagram, prism cross-section, and nested triangular solid diagrams.
- Final evidence:
  - Local reference contact sheet: `tmp/live-openai-csat-reference-20260530/contact-sheet.png`.
  - Live OpenAI contact sheet: `tmp/live-openai-csat-drawing-smoke-20260530/contact-sheet.png`.
  - Live report: `tmp/live-openai-csat-drawing-smoke-20260530/live-openai-random-report.md`.
  - Audit note: `docs/live-openai-csat-drawing-audit.md`.
- Result:
  - 10/10 live outputs passed schema/reference/intent/runtime/semantic validation and browser rendering.
  - Stricter visual review: 5 direct passes, 3 minor readability issues, 2 solid-diagram results that are structurally created but not print-ready.
  - `gpt-5.5-mini` is not visible to the supplied API key; `gpt-5.5` and `gpt-5.4-mini` both work in tiny Responses calls.
- Secret handling:
  - The provided API key was used only as a process environment variable and was not written to repository files or reports.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The broad audit must use valid GraphA `operations[]` with first-class `prism` and `pyramid` objects, not hand-authored segment approximations.
- Skill: Browser / Playwright
- Why it matters:
  - The user-visible acceptance bar is the actual canvas: every generated solid case must render without console errors, and the screenshot should show solid front edges and dashed hidden rear edges.

## Current Task Notes

- User concern:
  - Try many varied solid figures again and make sure there are no errors in every case.
- Expanded acceptance:
  - Cover rectangular, triangular, pentagonal, and hexagonal prisms with several rear-face shifts.
  - Cover triangular, square, pentagonal, and hexagonal pyramids with varied apex positions.
  - Include nested/composite solid scenes and a prism with cross-section/diagonal support geometry.
  - Assert prism base/front edges are never hidden after the convention fix.
  - Assert each shifted prism still has hidden rear/top or depth edges so dashed hidden-line rendering is actually exercised.
  - Save browser screenshots and a contact sheet under `tmp/solid3d-case-matrix/`.
- Secret handling:
  - The pasted OpenAI key must not be stored or echoed. This pass does not need live OpenAI calls.
- Final evidence:
  - `tools/render-solid3d-case-matrix.mjs` renders 24 local GraphA solid cases in Playwright.
  - `tmp/solid3d-case-matrix/contact-sheet.png` shows all cases as PASS.
  - `tmp/solid3d-case-matrix/solid3d-case-matrix-report.md` records hidden-edge classifications for every case.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The fix keeps solid geometry inside first-class `prism` and `pyramid` objects instead of hand-authored dashed/solid segment bundles.
- Skill: Browser / Playwright
- Why it matters:
  - The user-visible acceptance bar is whether rendered front edges are solid and rear edges are dashed on the actual canvas.

## Current Task Notes

- User concern:
  - Draw several solid figures such as rectangular prisms and pyramids, then verify hidden/back edges are dashed and visible/front edges are solid.
- Initial local audit:
  - A multi-solid browser render was saved at `tmp/solid3d-edge-audit-before/solid3d-edge-audit-before.png`.
  - `pyramid` behavior reads correctly in the sampled forms: rear base/lateral edges are dashed.
  - `prism` currently treats the shifted top face as viewer-facing, which can dash front/base edges in ordinary `ABCD-A'B'C'D'` textbook-style prism drawings.
- Root correction:
  - Keep the first-class solid object path.
  - Treat `prism.baseVertexIds` as the near/front face and `prism.topVertexIds` as the shifted/rear face for dashed hidden-edge classification.
  - Add render-call tests so this cannot regress silently.
- Secret handling:
  - The pasted OpenAI key must not be stored or echoed. Live OpenAI runs require `OPENAI_API_KEY` to be supplied through the environment.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The new prompt batch must use only supported GraphA objects while making the intended geometry explicit enough for visual parity checks.
- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - The live path uses OpenAI Responses API structured output, but secrets must be supplied only through environment variables.
- Skill: Browser / Playwright
- Why it matters:
  - The acceptance bar is a rendered contact sheet that can be compared against the requested target, not only JSON validation.

## Current Task Notes

- New requested batch should not duplicate prior prompt families:
  - avoid earlier exp/log intersection, quartic tangents, rational slant asymptote, damped wave envelopes, two-circle lens, hexagon web, transversal grid, and previous prism/pyramid nestings;
  - avoid default/extended cases such as triangle incircle, simple sector, basic quadratic-line intersection, histogram, and lone triangular prism.
- Candidate new targets:
  - logistic graph with horizontal asymptotes and midpoint tangent,
  - parabola with focus/directrix/latus rectum,
  - absolute-value plateau graph,
  - feasible region from three boundary inequalities,
  - concentric-circle sector wedge,
  - external point tangent pair to a circle,
  - Euler-line triangle construction,
  - pentagon/pentagram construction,
  - prism with internal diagonal and cross-section,
  - triangular pyramid nested in a triangular prism.
- Root context to provide in prompts:
  - exact coordinates for named construction points,
  - `showLabel:false` and `visible:false` for helper geometry,
  - exact line equations for dashed reference lines,
  - exact circle centers/radii when tangency or concentricity matters,
  - explicit prism/pyramid vertex counts and base/top ordering,
  - projected containment for nested solids.
- Current blocker:
  - `OPENAI_API_KEY` is not available in the environment. Live calls must wait for a safe environment variable; local reference rendering can still proceed.
- Implemented context update:
  - `stress_novel` now has deterministic local reference payloads and can render a target contact sheet with `LIVE_AI_RENDER_REFERENCE_TARGETS=1`.
  - Additional validators cover exact function expressions, named segment endpoints, fixed circle radii, concentric circle radii, and collinear named points.
  - Exact annular-sector cutouts remain unsupported; prompts should request an outer sector plus inner circle outline unless a future `annularSector` primitive is added.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - `lensRegion` must become a valid GraphA primitive and scene-graph target so generated diagrams stop relying on polygon approximations for two-circle overlaps.
- Skill: Browser / Playwright
- Why it matters:
  - The acceptance bar is visual parity: the lens must render as two circular arcs with no internal chord, and the fill tool must visibly change objects on the real canvas.

## Current Task Notes

- User concern:
  - A previous lens-like fifth output looked wrong because the intended curved overlap was represented with lower-level approximations.
  - The user also asked whether paint-program-style color filling can be provided.
- Root correction:
  - Add a first-class `lensRegion(circle1Id, circle2Id)` object for exact two-circle intersections.
  - Keep arbitrary function-bounded regions as future work unless they can be compiled into existing primitives.
  - Add vector fill tooling for closed objects: `circle`, `polygon`, `sector`, `circularSegment`, and `lensRegion`.
- Visual acceptance:
  - Two-circle lens shows only the two curved outer boundaries of the overlap and a filled interior.
  - Fill tool changes color/opacity without converting geometry to pixels.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The recursive loop must judge GraphA objects by whether the rendered geometry matches the intended Korean drawing request.
- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - The OpenAI path remains strict Structured Outputs plus app-owned validation and retry feedback.
- Skill: Playwright
- Why it matters:
  - Visual parity must be checked against actual canvas screenshots, not only JSON operations.

## Current Task Notes

- New visual-review failures after the latest `stress_extra` live run:
  - `exp_log_two_curve_window`: two point labels passed, but point A was a same-x comparison sample rather than the left intersection.
  - `two_circle_lens_region`: direct A/B endpoints existed, but helper points remained visible as extra dots.
  - `two_transversals_angle_grid`: angleDimension count passed, but not all markers were visually renderable.
  - `hexagon_diagonal_angle_web`: polygon default fill created a shaded region even though the requested figure was a construction-style hexagon.
  - nested internal solids: containment passed, but two inner solids can still be too overlapped to read separately.
  - `double_pyramid_inside_box`: a pyramid can reuse `apexId` inside `baseVertexIds` unless apex validity is checked.
- Root correction:
  - require coordinate windows when a function prompt asks for actual intersections,
  - limit visible helper point count and require `visible:false` for region-shaping helper points,
  - add prompt-local renderability constraints for angleDimension endpoints,
  - require unfilled polygon construction when fill is not requested,
  - require minimum projected separation between inner solid centers,
  - require line-equation checks for rational asymptotes,
  - require lens circle radius, lens polygon bounds, and non-self-crossing polygon order,
  - require pyramid apex/base separation, square-pyramid base counts, triangular prism vertex counts, and readable prism base/top ordering,
  - revalidate saved live results with `LIVE_AI_REVALIDATE_RESULTS`,
  - inject visual guardrails into `AIService`'s reference prompt and the JSON feature manual.
- Final recursive evidence:
  - `tmp/live-openai-stress-extra-drawing-smoke-parity6/` is the accepted live OpenAI rerun.
  - It passed validation, browser rendering, and manual visual review against the intended drawings.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The new stress prompts must stay inside the current GraphA `operations[]` contract and use the existing object families accurately.
- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - The live drawing path uses OpenAI Responses API structured output and app-owned validation.
- Skill: Browser / Playwright
- Why it matters:
  - The saved evidence is only useful when the GraphA payload also renders correctly in the real canvas.

## Current Task Notes

- Added a second 10-case `stress_extra` prompt set covering:
  - exponential/log graphs,
  - quartic tangents,
  - rational asymptotes,
  - damped waves with envelopes,
  - two-circle lens regions,
  - hexagon angle/diagonal webs,
  - parallel-line/transversal angle grids,
  - nested prism/pyramid compositions.
- Root failures from saved runs:
  - two-circle lens prompts need direct upper/lower endpoint points when exact branches matter;
  - nested solid prompts need projection containment, not only object-family presence;
  - polygon boundaries should not be double-counted as required explicit edge segments;
  - dense prompts still need visible-label budgets.
- Current improvement:
  - `stress_extra` prompt-local expectations now include direct lens endpoints and nested-solid hull containment.
  - Future live reruns should supply `OPENAI_API_KEY` through the process environment, not by pasting the key into command text or repository files.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The root fix needs the project-local GraphA manual to constrain which scene graph nodes can become real runtime objects.
- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - The OpenAI path should use structured intermediate output, then app-owned validation and compilation.
- Skill: Browser / Playwright
- Why it matters:
  - Once live prompts are switched to scene graph mode, rendered canvas output must be compared against source crops and semantic validators.

## Current Task Notes

- The previous fix was a guardrail, not a root solution.
- Root direction:
  - image/PDF or pasted image -> high-level scene graph,
  - scene graph -> deterministic GraphA compiler,
  - GraphA operations -> existing schema/reference/semantic/render validation.
- Direct GPT-to-GraphA operations should remain useful for simple text commands and compatibility, but image/PDF reconstruction should move to scene graph mode.
- The existing JSON manual should be used as a selected capability map and compiler limit source, not only as prompt prose.
- Unsupported primitives must produce explicit warnings; otherwise the model/app can silently draw a plausible but wrong substitute.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The fix must use the project-local `feature-manual.json` and `retrieval-index.json` to constrain GPT/OpenAI prompts to supported GraphA primitives.
- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - The behavior sits on the Responses API, strict Structured Outputs, and app-owned output validation guardrails.
- Skill: Browser / Playwright
- Why it matters:
  - The visible outcome is whether pasted image requests apply valid canvas patches, and browser validation remains useful after unit coverage.

## Current Task Notes

- Live image-reference API calls proved the network/Structured Outputs path works, but the model can still return semantically wrong patches.
- Live PDF text-prompt calls also proved that schema/reference/render checks are too weak for textbook fidelity; category semantics must be checked separately.
- Patch mode should be treated as a constrained mutation workflow:
  - selected ids must be updated or deleted,
  - strict "only this part" requests must not create unrelated objects,
  - image text should not outrank the user's instruction or selection.
- Recreate mode should use the JSON manual to remind the model about supported primitives, known gaps, and operation budget limits.
- PDF sample validation now uses `js/ai/SemanticValidator.js` to check category-specific structure:
  - radical number-line construction,
  - rectangular histogram bars and frequency polygon segments,
  - incircle contact tangency,
  - quadratic vertex/intersection structure,
  - smooth distribution functions,
  - scatter spread rather than a perfect line.
- The manual/retrieval files are:
  - `.agents/skills/mathgraph-drawing/references/retrieval-index.json`
  - `.agents/skills/mathgraph-drawing/references/feature-manual.json`
  - `.agents/skills/mathgraph-drawing/references/synthetic-drawing-data.jsonl`

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The behavior change must update both GraphA operation examples and the selective reference skill used by GPT/API orchestration.
- Skill: Browser / Playwright
- Why it matters:
  - The user-visible fix is whether diagrams render as black defaults in the actual canvas, not only whether JSON parses.

## Current Task Notes

- New default rule:
  - MathGraph-created objects should default to black (`#000000`) for object strokes and fills.
  - AI-generated operations should omit style colors unless needed, or use `#000000` for default examples.
  - Explicit user color requests remain supported.
- Reference updates needed:
  - `.agents/skills/mathgraph-drawing/SKILL.md`
  - `.agents/skills/mathgraph-drawing/references/feature-manual.json`
  - `.agents/skills/mathgraph-drawing/references/synthetic-drawing-data.jsonl`
  - `tests/fixtures/pdf-ai-drawing-samples.json`
- Verification completed:
  - `npm.cmd test` passed with 35 tests.
  - `node tools\render-pdf-ai-drawing-samples.mjs` passed with 12 rendered samples and 0 failures.

---

## Relevant Skills

- Skill: PDF
- Why it matters:
  - The task samples local teacher-guide PDFs where rendered layout and visible diagrams matter.
- Skill: MathGraph Drawing
- Why it matters:
  - The task converts informal Korean textbook diagram requests into validated GraphA `operations[]`.
- Skill: Browser / Playwright
- Why it matters:
  - The output must be checked in the real MathGraph canvas, not only by JSON parsing.

## Current Task Notes

- Sampled 12 non-overlapping categories from the three local PDFs:
  - number-line radical construction
  - parallel-line angle relations
  - circle sector/arc
  - rectangular prism plus curved-solid gap
  - histogram/frequency polygon approximation
  - linear graph intersection
  - triangle incircle
  - similarity triangle pair
  - quadratic graph
  - trigonometric right triangle
  - distribution curves
  - scatter plot approximation
- Added fixture/test/render-helper artifacts:
  - `tests/fixtures/pdf-ai-drawing-samples.json`
  - `tests/pdf-ai-drawing-samples.test.js`
  - `tools/render-pdf-ai-drawing-samples.mjs`
  - `docs/pdf-ai-drawing-sample-audit.md`
- Verification completed:
  - `npm.cmd test` passed with 32 tests.
  - `node tools\render-pdf-ai-drawing-samples.mjs` passed with 12 rendered samples and 0 failures.
- Current conclusion:
  - First-class geometric and function categories can reproduce the same mathematical structure.
  - Chart-style diagrams, curved solids, independent text, and solver-backed construction semantics remain approximation/gap areas.

---

## Relevant Skills

- Skill: Skill Creator
- Why it matters:
  - The user asked to create a reusable skill, so the project-local skill must follow Codex skill structure with a concise `SKILL.md` and selectively loaded references.
- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - The references are intended for GPT/OpenAI API orchestration, so the local OpenAI routing docs and official Structured Outputs/tool-search guidance are relevant.
- Skill: Local MathGraph Runtime Inventory
- Why it matters:
  - The reference files must describe only features that exist today in `SchemaValidator`, `PatchApplier`, `ObjectManager`, `AIService`, UI tools, and export/save paths.

## Current Task Notes

- Build a project-local skill at `.agents/skills/mathgraph-drawing`.
- Keep `SKILL.md` small and put detailed data in reference files.
- Target token efficiency by separating:
  - `retrieval-index.json` for selecting the smallest useful reference subset.
  - `feature-manual.json` for exact feature schemas and known gaps.
  - `synthetic-drawing-data.jsonl` for example Korean prompts and `operations[]` payloads.
- Current AI contract remains strict Structured Outputs through `operations[]`; this task does not change runtime behavior.
- Official sources checked in this task:
  - `https://developers.openai.com/api/docs/guides/structured-outputs`
  - `https://developers.openai.com/api/reference/resources/responses/methods/create`
  - `https://developers.openai.com/api/docs/guides/tools-skills`
  - `https://developers.openai.com/api/docs/guides/tools-tool-search`

---

## Previous Relevant Skills

- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - This task extends the OpenAI Responses API Structured Outputs schema for AI graph generation, so local reference maps and current official docs must be checked before implementation.
- Skill: PDF
- Why it matters:
  - The task compares local teacher-guide PDFs against rendered app output, so representative pages should be rendered or visually inspected.
- Skill: Browser / Frontend Testing Debugging
- Why it matters:
  - The user explicitly asked to use computer/browser validation, and the rendered canvas must be checked with screenshots.
- Skill: Middle School Math 2026
- Why it matters:
  - The three PDFs are middle-school math teacher-guide sources from the user's 2026 math materials folder.
- Local context read:
  - `AGENTS.md`
  - `docs/openai-url-inventory.yaml`
  - `docs/openai-context-map.md`
  - `docs/openai-core-summaries.md`
  - `docs/openai-docs-map.yaml`
  - `docs/vibecoding-openai-guide.md`
  - `docs/progress-log.md`
- Official docs checked:
  - `https://developers.openai.com/api/docs/guides/structured-outputs`
  - `https://developers.openai.com/api/reference/resources/responses/methods/create`
  - `https://developers.openai.com/api/docs/guides/tools-computer-use`

## Previous Current Task Notes

- Use Responses API Structured Outputs (`text.format.type = "json_schema"`) rather than older JSON mode.
- Keep model IDs configurable; current reference default for complex reasoning/coding is `gpt-5.5`.
- Strict schemas require required fields; use nullable fields and strip `null` values before local validation/application.
- Set `store: false` for graph-generation requests unless a future product decision needs stored responses.
- Direct browser API key storage remains a personal/BYOK compromise, not ideal for public deployment.
- PDF sample coverage checked:
  - Math 1 pages 280, 284, 286, and 287: line/angle relationships, sectors, solids, and statistical graphs.
  - Math 2 pages 290, 314, 404, and 437: line-intersection graphs, linear-function graph questions, plane-figure reasoning, and triangle similarity.
  - Math 3 pages 7, 287, and 345: number-line radicals, quadratic functions, and trigonometry planning.
- Main gap selected for this pass:
  - First-class `polygon` support with fill/stroke styling and AI parity, because it underpins triangles, quadrilaterals, similarity diagrams, shaded graph regions, and histogram-style bars.
- Validation completed:
  - `npm.cmd test` passed with 27 tests.
  - `git diff --check` passed with line-ending warnings only.
  - Headless Chrome screenshots were captured in `tmp/browser-captures/`.
  - The representative coverage scene created valid polygon, sector, function, number-line, and prism objects with no browser console errors.
- Follow-up coverage still needed:
  - Statistical chart primitives such as histogram, frequency polygon, box plot, dot plot, scatter plot, and table-backed chart helpers.
  - Curved solid primitives such as cylinder, cone, sphere, net, and revolution-style diagrams.

---

## Previous Relevant Skills

- Skill: None required beyond core repo work
- Why it matters:
  - This batch stays within the existing vanilla JS app architecture and does not require a specialized external workflow.

## Repo Notes

- Project-specific conventions:
  - Update task docs before and after feature work.
  - Keep Vercel linkage intact.
  - Do not revert unrelated dirty worktree changes.
- Important directories:
  - `.agent/` for working docs
  - `docs/` for user/developer-facing references
  - `js/` for application runtime
- Known constraints:
  - Multiple core files are already modified in the current worktree.
  - Git remote is currently unset.

## Working Rules

- Do not revert other people's changes.
- Keep edits focused on the task.
- Update the tracking docs as the task evolves.
- Use `implementation_plan.md` only when a fuller roadmap is needed.

## Useful References

- Docs:
  - `docs/ai-reference.md`
  - `.agent/implementation_plan.md`
- Decisions:
  - Finish visible gaps before adding broader new surface area.
- Commands:
  - `git status --short --branch`
  - `npm test`
