# PRD

## Summary

- Task: Zero-size point invisibility
- Owner: Codex
- Date: 2026-06-18
- Related files:
  - `js/core/Canvas.js`
  - `tests/point-label-only.test.js`
  - `docs/ai-reference.md`
  - `docs/progress-log.md`

## Problem

- When a point's size is set to `0`, the point body is hidden but the selected-point halo can still render as a visible purple circle.
- Users expect a point size of `0` to make the point itself completely invisible, especially for helper points and label-only diagrams.

## Goals

- Make `pointSize: 0` suppress the point body, border, selected halo, and highlighted radius expansion.
- Preserve labels when `showLabel` is enabled.
- Keep visible points with positive `pointSize` unchanged.

## Non-Goals

- Do not change graph geometry, object schemas, saved-data fields, or label rendering.
- Do not hide selected outlines for non-point objects.

## Acceptance Criteria

- [x] A selected point with `pointSize: 0` draws no point-body pixels or selection halo.
- [x] A point with positive `pointSize` still draws selected feedback normally.
- [x] Focused tests, full tests/build, docs, commit, push, and deployment outcome are recorded.

---

## Summary

- Task: Landing login and default OpenAI proxy
- Owner: Codex
- Date: 2026-06-16
- Related files:
  - `index.html`
  - `css/styles.css`
  - `js/main.js`
  - `js/ai/AIService.js`
  - `api/login.js`
  - `api/openai-responses.js`
  - `.agent/landing_login_api_proxy.md`
  - `docs/ai-reference.md`

## Problem

- The app currently opens directly into the editor and requires API-key entry for provider-backed AI use.
- The user wants a first-run login landing screen where entering `박범진` enables OpenAI usage without direct key entry.
- Guest users should still be able to continue, but they must provide their own API key for OpenAI/Gemini.
- A default API key cannot be embedded in the static frontend without exposing it.

## Goals

- Add a polished first-load login landing screen.
- Add an owner session mode for `박범진`.
- Route owner OpenAI requests through a same-origin Vercel API proxy that reads `OPENAI_API_KEY` server-side.
- Preserve existing guest BYOK settings and local deterministic fallback.

## Non-Goals

- Do not store or hardcode an OpenAI API key in the repository.
- Do not add a full account system, password flow, database, or billing controls in this pass.
- Do not change GraphA operation schemas or drawing semantics.
- Do not change Gemini behavior beyond keeping it BYOK for guests.

## Acceptance Criteria

- [x] First load shows a landing login before the editor is available.
- [x] `박범진` login starts owner mode with OpenAI default proxy usage.
- [x] `게스트로 진행` starts guest mode and keeps direct API-key input required.
- [x] OpenAI text and image calls in owner mode use `/api/openai-responses`.
- [x] Missing server `OPENAI_API_KEY` produces a clear error instead of falling back silently.
- [x] Focused tests, full tests/build, browser smoke, deploy, commit, and push are recorded.

## Implementation Notes

- Added `api/login.js` and `api/openai-responses.js` so the owner path can use a server-side OpenAI key without exposing it to the browser.
- Added local session mode handling in `js/main.js`; owner mode locks OpenAI provider settings and hides the API-key field, while guest mode keeps direct key entry available.
- Added `AIService` transport selection so owner OpenAI text/image calls use the same-origin proxy and guest calls preserve the existing BYOK path.
- Current Vercel Production environment has encrypted `OPENAI_API_KEY` and `MATHGRAPH_LOGIN_SECRET` values, so live owner OpenAI calls are enabled on Production.
- Production deployment `dpl_9DFsZijPBTySUu7MY1sdYJ9KdfBR` is `Ready` and aliased to `https://mathgraph-five.vercel.app`.

---

## Summary

- Task: Vercel direct prompt fallback for prior CSAT prompts
- Owner: Codex
- Date: 2026-06-16
- Related files:
  - `js/ai/AIService.js`
  - `tests/ai-flow.test.js`
  - `.agent/vercel_direct_prompt_fallback.md`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`

## Problem

- Direct production UI testing showed a split between "objects were created" and "the requested diagram was created."
- The recent nested rectangular-prism prompt works on Vercel without an API key, but prior audited CSAT prompts fall through to generic local fallback:
  - the `2/x` hyperbola prompt creates only a weak function object and can render blank after parser errors;
  - the three-circle lens prompt creates only one circle instead of three pairwise lenses;
  - the square-pyramid midsection prompt creates only a quadrilateral instead of a first-class pyramid.

## Goals

- Make those prior representative prompts deterministic in API-free production mode.
- Preserve the OpenAI-backed path and BYOK settings unchanged.
- Use existing GraphA primitives only.

## Non-Goals

- Do not add broad natural-language parsing for every CSAT-style prompt.
- Do not add new chart, Venn, or solid primitives.
- Do not move API keys to a server-side proxy in this pass.

## Acceptance Criteria

- [x] Hyperbola/asymptote prompt creates `function`, dashed `line` asymptotes, and labeled points `A` through `D`.
- [x] Three-circle lens prompt creates three `circle` objects, three `lensRegion` objects, hidden centers/radius points, and only external `O,P,Q` labels with no visible anchor dots.
- [x] Square-pyramid midsection prompt creates a first-class `pyramid`, a shaded `polygon` midsection, and a dashed height `segment`.
- [x] Focused tests, full tests/build, production deploy, and production UI smoke are recorded.

---

## Summary

- Task: Local solid fallback for nested rectangular prism request
- Owner: Codex
- Date: 2026-06-15
- Related files:
  - `js/ai/AIService.js`
  - `tests/ai-flow.test.js`
  - `.agent/local_solid_fallback.md`
  - `.agents/skills/mathgraph-drawing/references/feature-manual.json`
  - `docs/ai-reference.md`
  - `docs/progress-log.md`

## Problem

- The AI chat can show `요청을 이해하지 못했습니다` for `직육면체 ABCD EFGH 내부에 정육면체가 작게 있는거 그려줘` when the app is using local/API-free fallback.
- The runtime already supports first-class `prism` objects, but the deterministic fallback only handled functions, circles, equations, number lines, and a few legacy generic shape words.

## Goals

- Recognize rectangular-prism/cube wording in deterministic fallback.
- Preserve requested outer labels `A` through `H`.
- Create a smaller inner cube as a second `prism` when the prompt asks for a nested solid.
- Keep the implementation inside existing GraphA `point` and `prism` operations.

## Non-Goals

- Do not add new solid primitives.
- Do not approximate curved solids such as cylinders, cones, or spheres.
- Do not change provider-backed OpenAI/Gemini request schemas.

## Acceptance Criteria

- [x] The exact Korean prompt succeeds in local fallback mode.
- [x] The exact prompt creates two prism objects and sixteen dependency points.
- [x] A single `직육면체 ABCD EFGH 그려줘` prompt creates one labeled rectangular prism.
- [x] Full tests, Vercel build, whitespace check, local browser smoke, and production smoke pass.

---

## Summary

- Task: Axis arrow reference-style refinement
- Owner: Codex
- Date: 2026-06-05
- Related files:
  - `js/core/Canvas.js`
  - `js/main.js`
  - `js/utils/AxisArrowStyle.js`
  - `js/utils/ExportArea.js`
  - `tests/area-export.test.js`
  - `tests/axis-label-settings.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `.agent/axis_number_math_labels.md`
  - `docs/progress-log.md`

## Problem

- The current axis arrowheads are present, but their shape is wider and more triangular than the provided textbook-style reference.
- The same arrow look must stay consistent across the live canvas, full SVG export, cropped SVG export, and cropped PNG overlay.

## Goals

- Make x/y axis arrowheads slimmer and longer, with the tip closer to the canvas or crop edge.
- Make each axis shaft meet the arrowhead base cleanly.
- Keep the italic serif `x` and `y` labels near the arrow tips.
- Centralize the arrow metrics so canvas, SVG, and area-export overlays do not drift.

## Non-Goals

- Do not change grid spacing, zoom behavior, object geometry, or save/load data.
- Do not add new user-facing settings.
- Do not change Vercel project settings or environment variables.

## Acceptance Criteria

- [x] Canvas x/y axes use the refined slimmer arrowhead style.
- [x] Full and cropped SVG export use the same refined arrowhead metrics.
- [x] Cropped PNG area export overlays the same refined crop-edge arrowheads when axes cross the crop.
- [x] Focused tests, full tests, build check, whitespace check, rendered/download smoke, deploy, commit, and push are recorded.

---

## Summary

- Task: Drag-area export axis arrowheads
- Owner: Codex
- Date: 2026-06-04
- Related files:
  - `js/main.js`
  - `js/utils/ExportArea.js`
  - `tests/area-export.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/progress-log.md`

## Problem

- Drag-area export crops the already-rendered full canvas.
- Coordinate-axis arrowheads live at the full canvas edges, so they disappear when the dragged crop contains an axis line but not the original full-canvas arrow tip.
- The saved crop should read as a standalone graph image: when an axis crosses the selected area, its arrowhead should appear at that selected area's edge.

## Goals

- For PNG area export, redraw visible x/y axis endpoints at the cropped image's right/top edges when the corresponding axis crosses the crop.
- For SVG area export, align the vector axis endpoints with the crop viewBox edges.
- Preserve full-canvas export behavior and ordinary on-canvas rendering.
- Keep the existing export settings for axes, grid, background, and scale.

## Non-Goals

- Do not change normal canvas panning, zooming, or object geometry.
- Do not add a separate crop-coordinate system or new saved-data schema.
- Do not change Vercel project settings or environment variables.

## Acceptance Criteria

- [x] A dragged crop containing the x-axis shows the x-axis arrow at the crop's right edge.
- [x] A dragged crop containing the y-axis shows the y-axis arrow at the crop's top edge.
- [x] Crops that do not contain a given axis do not invent that axis arrow.
- [x] PNG and SVG area exports use the same crop-edge axis endpoint logic.
- [x] Focused tests, full tests, build check, whitespace check, browser/download smoke, deploy, commit, and push are recorded.

---

## Summary

- Task: Function input accepts y=
- Owner: Codex
- Date: 2026-06-03
- Related files:
  - `index.html`
  - `js/objects/Function.js`
  - `js/ui/AlgebraInput.js`
  - `tests/function-parser.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/progress-log.md`

## Problem

- The function tool modal visually suggests users must enter only the right-hand side after `f(x) =`.
- If a user types a full classroom-style equation such as `y=x^2` in that modal or in a function expression edit field, the runtime parser receives the literal `y=` and rejects it.
- Teachers often think in `y=...` notation, so function entry should accept that form without weakening the AI/GraphA RHS-only operation contract.

## Goals

- Allow user-facing function input to accept `y=expression` and store the internal expression as the right-hand side.
- Display a `y = expression` label for functions created from `y=...`.
- Preserve existing `f(x)=...`, `g(x)=...`, and right-hand-side-only inputs.
- Keep AI/GraphA schema validation RHS-only so model output remains constrained.

## Non-Goals

- Do not change the function object JSON schema or AI operation schema.
- Do not add implicit equation solving for forms such as `2x + 3y = 6`.
- Do not change Vercel project settings or environment variables.

## Acceptance Criteria

- [x] The function modal accepts `y=x^2` and creates a valid function whose stored expression is `x^2`.
- [x] The created graph label displays as `y = x^2` rather than forcing `f(x) = ...`.
- [x] Existing `f(x)=...` / `g(x)=...` and RHS-only inputs still work.
- [x] Focused tests, full tests, build check, whitespace check, browser smoke, commit, push, and deployment outcome are recorded.

---

## Summary

- Task: Axis arrows and fixed grid interval
- Owner: Codex
- Date: 2026-06-03
- Related files:
  - `js/core/Canvas.js`
  - `js/main.js`
  - `tests/axis-label-settings.test.js`
  - `.agent/axis_number_math_labels.md`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/progress-log.md`

## Problem

- The current x/y axis arrowheads are open strokes and do not match textbook-style solid arrow references.
- Fixed `축 숫자 간격` currently fixes tick labels, but the grid still changes spacing as the user zooms.

## Goals

- Draw x/y axes with filled arrowheads and italic serif `x`/`y` labels near the arrow tips.
- When axis-number interval is fixed, keep grid spacing fixed at the same math-unit interval during zoom.
- Keep automatic mode zoom-adaptive.
- Keep canvas rendering and SVG export aligned.

## Non-Goals

- Do not add a separate grid interval setting.
- Do not change object geometry, AI schema, or save/load data.

## Acceptance Criteria

- [x] Fixed interval `1` keeps the grid at one math unit while zooming in or out.
- [x] Automatic interval keeps the previous zoom-adaptive grid behavior.
- [x] Canvas axes render filled arrowheads and italic `x`/`y` labels.
- [x] SVG export uses the same fixed grid gap and axis arrow style.

---

## Summary

- Task: Drag-area export
- Owner: Codex
- Date: 2026-06-03
- Related files:
  - `index.html`
  - `js/main.js`
  - `js/tools/AreaExportTool.js`
  - `js/ui/CommandPalette.js`
  - `css/styles.css`
  - `tests/area-export.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/progress-log.md`

## Problem

- Current export saves the full visible canvas.
- Users sometimes need only a cropped portion of a graph or diagram for worksheets, slides, or chat sharing.
- A crop workflow should not disturb current object selection, object geometry, save/load data, or existing SVG/PNG export options.

## Goals

- Add a user-facing mode that lets users drag a rectangular area on the canvas and save only that area.
- Reuse the existing export settings for format, PNG scale, background, grid, and axes.
- Show clear drag feedback while choosing the area.
- Return to the normal select tool after the area is saved or cancelled.
- Verify the crop math with focused tests and render the interaction in a browser smoke test.

## Non-Goals

- Do not add arbitrary polygon/lasso crop support.
- Do not change object geometry or MathGraph save/load serialization.
- Do not change Vercel project settings or environment variables.

## Acceptance Criteria

- [x] A toolbar action and command-palette action can enter area-export mode.
- [x] Dragging a canvas rectangle downloads only the selected rectangle as PNG by default.
- [x] Existing export modal options still apply to area export where relevant.
- [x] Very small drags do not download a broken file and show a useful message.
- [x] Focused tests, full tests, build check, whitespace check, local browser smoke, Vercel deployment checks, and production smoke pass or blockers are recorded.

---

## Summary

- Task: Function formula label dragging on Vercel
- Owner: Codex
- Date: 2026-06-03
- Related files:
  - `js/objects/Function.js`
  - `js/tools/SelectTool.js`
  - `tests/function-label-drag.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/progress-log.md`

## Problem

- Vercel production is deployed, but function formula labels can be hard or impossible to move after creating a function.
- `FunctionGraph` supports label dragging, but the select tool can start a function drag even when the click was on the curve rather than the label.
- Function label hit testing estimates text width from character count, which is brittle for rendered math labels such as fractions and exponents.

## Goals

- Let users drag the visible function formula label directly on the canvas.
- Prevent clicks on the graph curve from starting a no-op function drag.
- Keep the curve selectable and keep the existing reset-label-position control.
- Verify the fix locally and redeploy to Vercel production.

## Non-Goals

- Do not add a new label-editing UI.
- Do not change function parsing, plotting, or GraphA schema behavior.
- Do not change Vercel project settings or environment variables.

## Acceptance Criteria

- [x] Clicking inside the formula label starts label dragging and updates the stored label math position.
- [x] Clicking only on the function curve selects the function but does not start a no-op drag.
- [x] Focused tests, full tests, build check, whitespace check, Vercel deploy/inspect, HTTP check, and production smoke pass or blockers are recorded.

---

## Summary

- Task: AI result model disclosure in chat
- Owner: Codex
- Date: 2026-06-03
- Related files:
  - `js/main.js`
  - `js/ai/AIService.js`
  - `css/styles.css`
  - `tests/ai-flow.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/ai-reference.md`
  - `docs/progress-log.md`

## Problem

- AI drawing requests can now use a configured model, a cheaper first-attempt model, or a stronger repair model depending on the path.
- The user can see whether the drawing succeeded, but cannot see which model actually produced the accepted result.
- For cost and trust, the final result message should expose the actual model used without making the chat noisy.

## Goals

- Show the actual model used for successful AI drawing results in a small, low-emphasis line under the result message.
- If repair/escalation happened, show both the initial and final models compactly.
- Keep the model display separate from the main response text so it does not distract from the drawing result.
- Preserve existing GraphA application behavior and model routing.

## Non-Goals

- Do not add a full usage/cost dashboard in this pass.
- Do not call provider billing or usage APIs.
- Do not change model selection or fallback routing behavior.
- Do not expose API keys or raw request bodies.

## Acceptance Criteria

- [x] Successful AI drawing result messages include a small model metadata line when model metadata is available.
- [x] Repaired image analysis shows initial model -> final model.
- [x] Ordinary chat messages remain unchanged when no model metadata is provided.
- [x] Focused tests, browser smoke, docs, commit, push, and deployment verification pass or blockers are recorded.

---

## Summary

- Task: AI image token reduction through safe preprocessing and model routing
- Owner: Codex
- Date: 2026-06-02
- Related files:
  - `js/ai/AIService.js`
  - `js/main.js`
  - `tests/ai-flow.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/ai-reference.md`
  - `docs/progress-log.md`

## Problem

- Whole-photo diagram recreation sends the original pasted/uploaded image to the vision model, so large phone photos can cost more image tokens than necessary.
- Reducing image size too aggressively can make small labels, axis numbers, ticks, and geometry unreadable to the vision model.
- The current image-analysis path always uses the configured OpenAI model for the first vision attempt, even when a cheaper model could handle the normal case.

## Goals

- Preprocess image uploads/pastes before the OpenAI call by trimming only safe whitespace-like margins and downscaling only oversized images.
- Keep a readability floor so small or moderately sized photos are not upscaled/downscaled into blurry input.
- Keep `detail: high` for image analysis because exact math diagrams depend on labels, ticks, and thin strokes.
- Route the first OpenAI image-analysis attempt through a cheaper vision-capable model, then use the configured stronger model for semantic repair/fallback.
- Add tests that protect the resize floor and model routing behavior.

## Non-Goals

- Do not add a server-side image proxy in this pass.
- Do not perform OCR, object detection, or risky content-aware cropping beyond safe margin trimming.
- Do not switch to `detail: low` for whole-photo diagram reconstruction.
- Do not change GraphA operation schemas or add new drawing primitives.

## Acceptance Criteria

- [x] Oversized images are reduced before API submission while preserving a long-edge readability floor.
- [x] Images already at a safe size are not shrunk.
- [x] Safe margin trimming is conservative and rejects suspicious tiny crops.
- [x] OpenAI image analysis uses a mini model for the first attempt and escalates to the configured stronger model for repair.
- [x] Focused tests, full tests, browser smoke, docs, commit, push, and deployment verification pass or blockers are recorded.

---

## Summary

- Task: AI problem-situation graphing and full-photo diagram recreation
- Owner: Codex
- Date: 2026-06-02
- Related files:
  - `js/ai/AIService.js`
  - `js/main.js`
  - `index.html`
  - `tests/ai-flow.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/ai-reference.md`
  - `docs/progress-log.md`

## Problem

- The AI chat can already turn short drawing requests into GraphA objects, but a full textbook-style problem statement can make the model solve or summarize the problem instead of extracting a useful graph/diagram.
- Image-only upload/paste already enters recreation mode, but the prompt does not strongly distinguish a full-page photo from a cropped diagram.
- Teachers need two high-friction inputs to work naturally:
  - paste the whole problem text and get a graph or diagram that can be used for that situation;
  - paste/upload the whole photo and get the math diagram or graph in the photo reconstructed as editable GraphA objects.

## Goals

- Detect full-problem text requests and add a problem-situation graphing instruction before the model call.
- In problem-situation mode, ask the model to extract conditions, variables, axes, points, labels, functions, inequalities, regions, or geometric relations and draw a usable supporting graph without solving the problem.
- Strengthen image recreate mode so full-page photos prioritize the visible math diagram/graph/figure, preserve labels and geometry, and ignore dense problem prose unless it is needed for the figure.
- Keep the existing Responses API, strict GraphA Structured Outputs, BYOK browser flow, schema validation, semantic validation, and rollback patch application.

## Non-Goals

- Do not add a server-side API proxy in this pass.
- Do not implement OCR-to-text extraction as a separate feature outside the current vision prompt.
- Do not add new runtime primitives such as native histogram, scatter plot, cylinder, cone, sphere, or standalone text labels.
- Do not change Vercel project settings unless deployment verification exposes a link/config issue.

## Acceptance Criteria

- [x] Full Korean problem text triggers problem-situation graphing guidance in the OpenAI request.
- [x] Short drawing commands continue to use the ordinary drawing prompt.
- [x] Image-only recreate prompts explicitly handle full-page photos and exact diagram reconstruction priorities.
- [x] Image plus text remains targeted patch mode and continues to prioritize selected/current canvas objects.
- [x] Unit tests cover problem-mode detection, prompt construction, and image request construction.
- [x] Focused tests, full tests, whitespace checks, docs, commit, and push are handled or blockers are recorded.

---

## Summary

- Task: Function unary-minus exponent precedence
- Owner: Codex
- Date: 2026-06-01
- Related files:
  - `js/utils/Parser.js`
  - `tests/function-parser.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/progress-log.md`

## Problem

- A function entered as `-x^2 + 4` is rendered as an upward-opening parabola.
- Standard math notation interprets `-x^2` as `-(x^2)`, but the current parser treats it like `(-x)^2`.
- This makes the graph disagree with the label and with classroom expectations for quadratic functions.

## Goals

- Parse unary minus with lower precedence than exponentiation for expressions such as `-x^2`.
- Preserve explicit parentheses, so `(-x)^2` still renders as an upward-opening graph.
- Preserve negative exponents such as `2^-2` and existing arithmetic behavior.

## Non-Goals

- Do not replace the full parser or add a third-party math parser in this pass.
- Do not change label rendering semantics beyond making the evaluated graph match the entered expression.
- Do not alter Vercel deployment settings.

## Acceptance Criteria

- [x] `-x^2 + 4` evaluates to `0` at `x=2` and `4` at `x=0`.
- [x] `(-x)^2 + 4` still evaluates to `8` at `x=2`.
- [x] Negative exponents and existing parser behavior remain covered by tests.
- [x] Focused parser tests, relevant full tests, browser verification, and whitespace checks pass or blockers are recorded.

---

## Summary

- Task: Point size controls for default, bulk, and individual edits
- Owner: Codex
- Date: 2026-06-01
- Related files:
  - `index.html`
  - `js/core/SettingsManager.js`
  - `js/main.js`
  - `tests/point-label-only.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/progress-log.md`

## Problem

- Users can hide point bodies through `pointSize: 0`, but there is no direct UI to choose a visible point radius.
- Existing point-size edits are only possible through generated/AI payloads or indirect hide/show controls.
- Teachers need both fast batch resizing for all or selected points and precise per-point resizing for individual diagram cleanup.

## Goals

- Add a default point-size control for newly created points.
- Add a bulk point-size control that updates all existing point-like objects.
- Add a selected-point control so individual point-like objects can be resized directly.
- Preserve `pointSize: 0` as the label-only state and keep the existing point-body toggle behavior.

## Non-Goals

- Do not change point labels, point coordinates, or geometry dependencies.
- Do not change GraphA schema fields; continue using existing `pointSize`.
- Do not alter Vercel deployment configuration.

## Acceptance Criteria

- [x] New points use the configured default point size unless label-only defaults or hide-all-points are active.
- [x] Existing point-like objects can be resized in one batch from the style panel.
- [x] A selected point-like object can be resized independently from the selection panel.
- [x] `pointSize: 0` still hides only the point body while preserving labels.
- [x] Focused tests, full tests, browser verification, docs, commit, and push are handled or blockers are recorded.

---

## Summary

- Task: Function-axis inferred fill regions
- Owner: Codex
- Date: 2026-06-01
- Related files:
  - `js/tools/FillTool.js`
  - `tests/fill-tool.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/progress-log.md`

## Problem

- The fill tool can fill existing closed objects, loose segment loops, and two-circle lens regions.
- A common graphing workflow still fails: clicking the area bounded by a function graph and the coordinate axes reports that no fillable shape exists.
- In examples such as `y = -3/8x^2 + 6`, the first-quadrant region bounded by the x-axis, y-axis, and the parabola should be fillable even though the axes are canvas primitives rather than MathGraph objects.

## Goals

- Let the fill tool infer a vector fill region when the clicked point is inside a region bounded by a visible function graph, the x-axis, and the y-axis.
- Create the inferred region from stored sample vertices so it remains persistent in the current `closedRegion` object model without leaving hidden helper-point objects behind.
- Prefer the smallest matching function-axis region under the click and preserve existing segment-loop, lens, polygon, and circle fill behavior.

## Non-Goals

- Do not add a new first-class curved-region primitive in this pass.
- Do not implement arbitrary function-function or function-line bounded region solving.
- Do not change Vercel deployment settings.

## Acceptance Criteria

- [x] Clicking inside the first-quadrant area bounded by `y = -3/8x^2 + 6`, the x-axis, and the y-axis creates a filled closed region.
- [x] The same inference works for the symmetric second-quadrant region when clicked there.
- [x] Existing segment-loop and two-circle lens inference behavior remains unchanged.
- [x] Focused tests, full tests, browser QA, and whitespace checks pass.
- [x] Progress docs are updated, and the completed code/test change is committed and pushed.

---

## Summary

- Task: Stacked fraction rendering for function labels
- Owner: Codex
- Date: 2026-06-01
- Related files:
  - `js/core/Canvas.js`
  - `tests/math-label-rendering.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/progress-log.md`

## Problem

- Function labels use MathGraph's canvas-based math renderer.
- Slash fractions such as `y=-3/8x^2+6` are currently drawn inline as `3/8`, so the expression does not look like a proper textbook/LaTeX-style fraction.
- The graph expression parser should remain ASCII-compatible, but the visible label needs a stacked numerator/denominator form.

## Goals

- Render simple slash fractions such as `3/8` as stacked fractions in canvas math labels.
- Keep adjacent implicit multiplication readable, so `-3/8x^2` displays as minus, stacked `3/8`, then `x^2`.
- Preserve existing superscript/subscript and mathematical minus rendering.
- Keep stored function expressions, GraphA schemas, save/load, and function evaluation unchanged.

## Non-Goals

- Do not replace the custom canvas math renderer with full KaTeX DOM rendering.
- Do not change the function parser or require users to enter LaTeX.
- Do not alter Vercel deployment configuration.

## Acceptance Criteria

- [x] `y=-3/8x^2+6` tokenizes into a stacked `3/8` fraction followed by `x^2`.
- [x] Fraction rendering draws a horizontal fraction bar and does not draw `/` as text.
- [x] Existing minus and exponent rendering tests still pass.
- [x] Focused tests, full tests, and whitespace checks pass or any blocker is recorded.
- [x] Progress docs are updated; commit/push is blocked by unrelated pre-existing staged and unstaged work in this workspace.

---

## Summary

- Task: Drag-box selection coverage for functions and solids
- Owner: Codex
- Date: 2026-06-01
- Related files:
  - `js/tools/SelectTool.js`
  - `tests/select-tool-box-selection.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/progress-log.md`

## Problem

- The select tool's drag box currently relies mostly on object positions or the first two dependency points.
- Function graphs do not expose a simple point position, so a drag box crossing a visible curve may not select the function.
- Prism and pyramid objects can also be missed when the drag box crosses a visible edge but does not contain the first dependency points.

## Goals

- Make drag-box selection include function curves when the selected rectangle intersects the visible graph.
- Make drag-box selection include prism and pyramid objects when the rectangle intersects their visible projected edges.
- Preserve existing click selection, shift-add selection, dragging selected objects, and hidden-object behavior.
- Keep the change local to selection hit coverage instead of changing object persistence or drawing semantics.

## Non-Goals

- Do not change how functions, prisms, or pyramids are rendered.
- Do not add new object types or GraphA schema fields.
- Do not alter Vercel deployment configuration.

## Acceptance Criteria

- [x] A drag box crossing a function graph selects that function.
- [x] A drag box crossing a prism or pyramid edge selects that solid.
- [x] Existing point/segment/polygon-style drag-box selection remains supported.
- [x] Focused tests, full tests, and whitespace checks pass, with Git line-ending warnings only.
- [x] Progress docs are updated; commit and push are handled at task close or any blocker is recorded.

---

## Summary

- Task: Axis number controls and function range limits
- Owner: Codex
- Date: 2026-06-01
- Related files:
  - `index.html`
  - `js/core/Canvas.js`
  - `js/core/SettingsManager.js`
  - `js/objects/Function.js`
  - `js/main.js`
  - `tests/axis-label-settings.test.js`
  - `tests/function-range-limits.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/progress-log.md`

## Problem

- Axis numeric labels are always shown whenever the corresponding axis is visible.
- Axis label spacing is automatically recalculated from zoom level, so teachers cannot force labels at a fixed interval such as `0.1`, `1`, or `2`.
- Function graphs can be limited by `xMin`/`xMax`, but there is no matching `yMin`/`yMax` range limit.

## Goals

- Add a view setting to show or hide coordinate-axis numeric labels independently from axis visibility.
- Add an axis-number interval setting that can stay automatic or force a fixed math-unit interval regardless of zoom.
- Add function `yMin`/`yMax` range limits alongside the existing `xMin`/`xMax` controls.
- Persist range values through save/load and keep SVG export aligned with canvas rendering.

## Non-Goals

- Do not redesign the whole property panel.
- Do not add a general implicit/function-bounded region solver.
- Do not alter Vercel deployment settings in this pass.

## Acceptance Criteria

- [x] Settings UI can toggle axis numbers without hiding the axes themselves.
- [x] Settings UI can select automatic or fixed axis-number intervals including `0.1`, `1`, and `2`.
- [x] Function graph rendering honors `yMin`/`yMax` as well as `xMin`/`xMax`.
- [x] Function range settings are editable in the selected-function property panel and survive JSON save/load.
- [x] Focused tests, full tests, browser QA, and whitespace checks pass or any blocker is recorded.

---

## Summary

- Task: Math label minus sign rendering polish
- Owner: Codex
- Date: 2026-06-01
- Related files:
  - `js/core/Canvas.js`
  - `tests/math-label-rendering.test.js`
  - `.agent/implementation_tracking.md`
  - `.agent/skills_context.md`
  - `docs/progress-log.md`

## Problem

- Function labels are rendered by MathGraph's canvas-based math label renderer, not by KaTeX DOM output.
- The renderer currently draws ASCII hyphen-minus characters directly, so unary/subtraction minus signs can look like a short text hyphen in formulas such as `y = -(x+2)^2 + 3`.
- This weakens the expected LaTeX-like appearance of classroom graph labels.

## Goals

- Normalize display-time math minus signs to the mathematical minus glyph.
- Keep the stored function expression and label text unchanged.
- Keep the fix scoped to math label rendering so geometry, parsing, AI schema, and save/load behavior remain unchanged.

## Non-Goals

- Do not replace the canvas math renderer with full KaTeX rendering in this pass.
- Do not change function expression parsing or GraphA operation schemas.
- Do not alter Vercel deployment configuration.

## Acceptance Criteria

- [x] Canvas math-label parsing turns ASCII `-` into Unicode mathematical minus for visible rendering.
- [x] Superscript/subscript parsing still works for labels such as `y = -(x+2)^2 + 3`.
- [x] Focused tests, full tests, and whitespace checks pass.
- [x] Progress docs are updated, and the completed change is committed and pushed.

---

## Summary

- Task: Label-only point body default option
- Owner: Codex
- Date: 2026-05-31
- Related files:
  - `js/objects/GeoObject.js`
  - `js/objects/Point.js`
  - `js/core/Canvas.js`
  - `js/core/ObjectManager.js`
  - `js/core/SettingsManager.js`
  - `js/main.js`
  - `index.html`
  - `tests/monochrome-defaults.test.js`
  - `docs/progress-log.md`

## Problem

- The existing "hide all points" control uses `pointSize = 0`, but zero-sized points still render a border because point rendering falls back to the border radius.
- New points created while drawing segments, circles, polygons, prisms, or pyramids still appear as filled dots by default.
- Teachers often need exam-style diagrams where vertex names remain visible but the point markers themselves are invisible.

## Goals

- Make `pointSize: 0` render as no visible point body or border while preserving labels.
- Add a persistent default option for newly created points to use label-only rendering.
- Apply the default to manually created points and helper vertices created by drawing tools.
- Keep explicit visible points and AI/user-specified `pointSize` values supported.

## Non-Goals

- Do not remove point labels or point selection behavior.
- Do not change line, circle, polygon, or solid object geometry.
- Do not alter Vercel deployment settings in this pass.

## Acceptance Criteria

- [x] A point with `pointSize: 0` renders no dot and no border on canvas/SVG, but its label can still render.
- [x] A UI setting can make newly created points label-only by default.
- [x] Existing "hide all points" behavior hides point bodies without hiding labels and persists its state.
- [x] Focused tests and full tests pass, docs are updated, and the change is committed/pushed.

---

## Summary

- Task: Restore Vercel production deployment for generated icon update
- Owner: Codex
- Date: 2026-05-31
- Related files:
  - `.vercelignore`
  - `vercel.json`
  - `docs/progress-log.md`

## Problem

- GitHub push to `codex/ai-fallback-recovery` did not produce a visible Vercel site change.
- `vercel ls` showed the latest Vercel deployment was 47 days old.
- A direct production deploy failed because Vercel tried to upload about 665 MB, exceeding the 100 MB file size limit.
- The project root contains local-only PDFs, `tmp/`, `node_modules/`, and agent/test/docs artifacts that should not be deployed as static runtime files.
- The first `.vercelignore` draft used an unanchored `tools/` pattern, which also excluded the runtime `js/tools/` modules and caused production 404s.

## Goals

- Add deployment ignore rules so only runtime-relevant static files are uploaded.
- Redeploy the current icon-system commit to Vercel production.
- Verify the deployed site shows the generated icon system and has no console errors.
- Record deployment result and remaining Vercel notes.

## Non-Goals

- Do not change app behavior beyond deployment packaging.
- Do not add server-side functions or environment variables.
- Do not move the static site into a new output directory in this pass.

## Acceptance Criteria

- [x] `.vercelignore` excludes large local-only artifacts from Vercel upload without excluding runtime `js/tools/` modules.
- [x] `vercel deploy --prod --yes` succeeds.
- [x] Deployed production URL loads with generated SVG icons and no Material Symbols font link.
- [x] Deployment result is documented and pushed.

---

## Summary

- Task: Replace borrowed UI icons with generated MathGraph icon system
- Owner: Codex
- Date: 2026-05-31
- Related files:
  - `index.html`
  - `js/ui/IconRenderer.js`
  - `js/ui/CommandPalette.js`
  - `js/main.js`
  - `css/styles.css`
  - `css/glass_theme.css`
  - `docs/progress-log.md`

## Problem

- The UI currently relies on generic Material Symbols and a few emoji-like command icons, which makes the site feel assembled from stock icon pieces.
- Icon meanings need to remain recognizable for repeated math-tool workflows, but the visual language should match the existing dark glass MathGraph tone.

## Goals

- Remove the external Material Symbols icon-font dependency.
- Add a project-owned generated SVG icon renderer that keeps the existing icon-name contract stable for current HTML and JS.
- Replace command-palette emoji icons with the same generated icon language.
- Preserve current layout, colors, tool selection behavior, and accessibility labels.

## Non-Goals

- Do not redesign the full application shell.
- Do not change drawing tools, graph behavior, AI drawing behavior, or persistence.
- Do not introduce a new third-party icon package.

## Acceptance Criteria

- [x] Toolbar, sidebars, canvas controls, object list, AI chat controls, modals, manual cards, and command palette render generated SVG icons instead of Material Symbols/emoji.
- [x] Dynamic icon state changes still work for sidebar toggles, hidden-point toggle, object list visibility, and object type rows.
- [x] App renders without framework/runtime console errors.
- [x] Focused syntax checks, full tests, and visual browser smoke are recorded.

---

## Summary

- Task: Correct fresh CSAT live outputs 9 and 10
- Owner: Codex
- Date: 2026-05-31
- Related files:
  - `tools/run-live-openai-random-drawing-smoke.mjs`
  - `tests/live-openai-random-smoke.test.js`
  - `docs/fresh-csat-drawing-audit.md`
  - `docs/progress-log.md`

## Problem

- The user correctly pointed out that the final sheet's 9th Venn-style output has awkward visible center dots/labels inside the overlap region.
- The 10th square-pyramid output reads too much like a boxy projection and does not look like a clean exam-style square pyramid with a midsection.
- The prior validation accepted these because it checked object presence and basic renderability, not label-anchor placement or exact solid projection shape.

## Goals

- Regenerate outputs 9 and 10 with cleaner exam-style visuals.
- Strengthen prompt-local checks so center support points can be hidden while visible labels are placed outside the circles.
- Constrain the square-pyramid example to a diamond/rhombus base projection with a substantial internal section.
- Update the audit record to mark the previous judgement as corrected.

## Acceptance Criteria

- [x] 9th output has hidden circle centers and O/P/Q labels outside the circle interiors/overlap.
- [x] 10th output has a clean first-class pyramid with a rhombus-like base projection and readable cross-section.
- [x] Local reference and live rerun evidence for prompts 9 and 10 are visually checked.
- [x] Focused/full verification and docs are updated.

---

## Summary

- Task: Fresh CSAT-style live OpenAI drawing set
- Owner: Codex
- Date: 2026-05-30
- Related files:
  - `tools/run-live-openai-random-drawing-smoke.mjs`
  - `docs/fresh-csat-drawing-audit.md`
  - `docs/progress-log.md`

## Problem

- The user asked to generate new examples, not only re-audit the previously saved `stress_novel` outputs.
- Prior checks proved that rendered output alone is not enough; the new batch still needs prompt/result visual review and prompt-local validation.
- The OpenAI API key must remain process-scoped and must not be written to source, reports, screenshots, or persistent environment settings.

## Goals

- Add a fresh, non-overlapping prompt set for CSAT/mock-exam-style graphs and diagrams.
- Render deterministic local reference targets for that fresh set.
- Run a live OpenAI generation pass against the fresh set when `OPENAI_API_KEY` is safely present in the process environment.
- Compare the rendered PNGs one by one against the prompt/reference intent.
- Record verification, findings, and any root-cause follow-up in durable docs.

## Non-Goals

- Do not reuse `stress_novel` as the main evidence for this pass.
- Do not add first-class unsupported primitives in this pass.
- Do not store or echo the supplied API key.

## Acceptance Criteria

- [x] A new prompt set exists and is selectable independently from earlier prompt sets.
- [x] Local reference targets render successfully.
- [x] Live OpenAI outputs render through the real MathGraph browser canvas.
- [x] Each local reference and live output result is judged against the prompt, not only against render presence.
- [x] Verification and docs are updated.

---

## Summary

- Task: Click-to-fill inferred vector regions
- Owner: Codex
- Date: 2026-05-30
- Related files:
  - `js/tools/FillTool.js`
  - `js/objects/ClosedRegion.js`
  - `js/core/ObjectManager.js`
  - `tests/fill-tool.test.js`
  - `docs/progress-log.md`

## Problem

- The current fill tool can fill existing closed vector objects such as polygons, circles, sectors, circular segments, and lens regions.
- It does not yet complete the paint-bucket expectation where a user clicks an empty region enclosed by separately drawn boundary objects.
- Raster flood fill would lose MathGraph's editable vector geometry, save/load semantics, undo behavior, and SVG export quality.

## Goals

- When a user clicks inside a region enclosed by visible segment boundaries, create a first-class vector filled region from that closed loop.
- When a user clicks inside the overlap of two circles and no lens region already exists, create and fill a `lensRegion` automatically.
- Preserve existing direct fill behavior for existing closed objects.
- Record creation/fill as undoable history actions and keep saved drawings restorable.

## Non-Goals

- Do not implement general implicit/function-bounded region solving in this pass.
- Do not introduce bitmap/raster flood fill.
- Do not change OpenAI API behavior or GraphA generation contracts beyond documentation notes.

## Acceptance Criteria

- [x] Clicking inside a triangle made from separate segment objects creates a filled vector region.
- [x] The inferred segment-loop region serializes/deserializes and follows moved boundary points.
- [x] Clicking inside a two-circle overlap auto-creates a filled lens region instead of filling a whole circle.
- [x] Existing fills for direct polygon and circle targets still work.
- [x] Focused tests and useful project verification pass, and progress docs are updated.

---

## Summary

- Task: Generation-side root fix for AI diagram readability
- Owner: Codex
- Date: 2026-05-30
- Related files:
  - `js/ai/DiagramQualityEnhancer.js`
  - `js/ai/AIService.js`
  - `tests/ai-flow.test.js`
  - `docs/ai-reference.md`
  - `docs/progress-log.md`

## Problem

- The validator-only fix correctly rejected weak saved outputs, but it did not make ordinary user requests automatically produce better drawings.
- Similar future requests should not depend on the model remembering every visual detail for label offsets, large right-angle aids, cross-section scale, or nested-solid projection spacing.
- The root product boundary needs an app-owned quality pass after model output parsing and before operations are applied or semantically accepted.

## Goals

- Add a deterministic post-generation enhancer for GraphA `operations[]`.
- Apply the enhancer to command-mode AI results and recreate-mode image analysis results, while preserving selected-object patch semantics.
- Automatically add readable label offsets, large right-angle angle aids, broad prism cross-section layouts, and clear triangular-pyramid-inside-triangular-prism layouts for the known weak request families.
- Keep all changes inside the existing GraphA operation contract.

## Non-Goals

- Do not invent unsupported primitives such as native curved solids or annular-sector cutouts.
- Do not override explicit coordinate-heavy prompts where the user has deliberately specified the geometry.
- Do not run another paid live API pass just to prove local post-processing behavior.

## Acceptance Criteria

- [x] Command-mode AI output is enhanced before returning to the caller.
- [x] Recreate-mode image analysis output is enhanced before semantic intent validation; patch-mode output is left unchanged.
- [x] Focused tests prove the enhancer adds label offsets, large right-angle aids, stronger prism cross-sections, and clearer nested triangular-solid projection.
- [x] Full tests, whitespace check, and secret-pattern scan pass.

---

## Summary

- Task: Root-cause fix for live OpenAI drawing visual false positives
- Owner: Codex
- Date: 2026-05-30
- Related files:
  - `tools/run-live-openai-random-drawing-smoke.mjs`
  - `tests/live-openai-random-smoke.test.js`
  - `docs/live-openai-csat-drawing-audit.md`
  - `docs/progress-log.md`

## Problem

- The strict one-by-one visual audit found that several saved live outputs were structurally generated but still not print-ready.
- The existing smoke validator caught schema errors, missing object families, invalid references, and broad semantic mismatches, but it did not model enough human-visible quality constraints.
- Specific missed issues included crowded required labels, hard-to-see right-angle markings, a too-small prism cross-section, cube-like prism proportions, and an inner triangular pyramid cramped near the edge of its containing prism.

## Goals

- Convert the observed visual false positives into deterministic prompt-local validation failures.
- Strengthen the `stress_novel` prompts so future repair attempts receive actionable feedback instead of accepting weak renders.
- Revalidate the saved live output file without another API call and confirm the previously weak outputs are no longer accepted.
- Keep the fix inside the current GraphA contract; do not add new drawing primitives.

## Non-Goals

- Do not rerun paid live OpenAI calls unless a safe `OPENAI_API_KEY` is provided through the environment.
- Do not store or echo the API key.
- Do not claim exact 3D containment beyond the current 2D projection-based quality checks.

## Acceptance Criteria

- [x] Saved `stress_novel` live results that had visual issues fail under the strengthened validators.
- [x] Local reference targets for `stress_novel` still pass the new checks and render successfully.
- [x] Focused smoke tests cover label offset/spacing, right-angle marker renderability, prism projection proportions, cross-section scale, and inner-solid layout.
- [x] Full tests, whitespace check, and secret-pattern scan pass.

---

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
- [x] Exact `gpt-5.5-mini` API availability is checked against the supplied key.
- [x] Each live screenshot is opened and judged one by one for real visual/prompt fidelity.

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
