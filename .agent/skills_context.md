# Skills and Context

## Relevant Skills

- Skill: Frontend Testing Debugging
- Why it matters:
  - The user is reacting to a visual canvas/export mismatch, so code changes need rendered evidence and download verification.
- Skill: Browser plugin / Playwright fallback
- Why it matters:
  - The in-app Browser is preferred for page health and screenshots; Playwright may still be needed for download interception.

## Current Task Notes

- User request:
  - The coordinate-axis arrowheads are still visually different from the provided reference.
- Finding:
  - Existing arrows are filled, but the head is broad and the tip is inset from the outer edge.
  - Canvas axes, SVG axes, and area-export PNG overlays currently repeat the arrow metrics separately.
- Implementation direction:
  - Introduce shared axis-arrow metrics.
  - Use a slimmer, longer arrowhead whose tip sits closer to the canvas/crop edge.
  - Apply the same metrics to canvas, SVG, and dragged-area export overlays.
- Verification target:
  - Focused geometry/rendering tests, full test suite, build/whitespace checks, local rendered smoke with download inspection, Vercel deploy/inspect, and production smoke.
- Completed result:
  - Added shared axis-arrow metrics for canvas, SVG, and crop-edge PNG overlays.
  - Changed the arrowhead to a slimmer, longer filled shape with the tip closer to the canvas/crop edge.
  - Moved the `y` label slightly farther left so it does not sit on the arrowhead.
  - Local and production Playwright smokes confirmed refined arrow pixels and cropped PNG edge arrows.

---

## Relevant Skills

- Skill: Frontend Testing Debugging
- Why it matters:
  - The reported issue is a rendered canvas/export workflow and needs real browser drag/download verification.
- Skill: Browser plugin / Playwright fallback
- Why it matters:
  - Page health can be checked in the in-app Browser, while download interception may require Playwright if the in-app Browser cannot capture downloads.

## Current Task Notes

- User request:
  - When saving only a dragged area, coordinate-axis arrows are missing.
  - If an axis crosses the dragged area, the axis arrowhead should appear at the edge of that selected area.
- Finding:
  - PNG area export currently renders the full scene, then crops it.
  - The full-scene axis arrowheads sit at the full canvas right/top edges, so they are cropped out unless the user selects those exact edges.
  - SVG area export uses a cropped viewBox but still builds axis endpoints from the full canvas dimensions.
- Implementation direction:
  - Add a small helper that computes x/y crop-relative axis endpoint geometry from `screenRect`, origin screen position, and export scale.
  - After PNG cropping, draw a final axis overlay only for axes that cross the selected rectangle.
  - Pass `cropRect` into SVG axis markup so vector axes terminate at the crop viewBox right/top edges.
- Verification target:
  - Focused area-export geometry tests, full test suite, build/whitespace checks, local browser health check, Playwright drag/download smoke, production deploy and smoke.
- Completed result:
  - PNG area export now overlays x/y axis arrowheads and italic labels at the selected crop's right/top edges when those axes cross the crop.
  - SVG area export now passes `cropRect` into axis markup so vector x/y arrowheads terminate at the crop viewBox edges.
  - The geometry helper omits crop-edge arrows for axes outside the selected rectangle.
  - Focused tests, full tests, local Browser health check, local/prod Playwright drag-download smokes, and Vercel production deployment passed.

---

## Relevant Skills

- Skill: Frontend Testing Debugging
- Why it matters:
  - The requested behavior is a rendered modal/input workflow and should be verified in the real app after focused tests.

## Current Task Notes

- User request:
  - Functions currently feel limited to names like `f(x)` and `g(x)`; allow plain `y=...` input too.
- Finding:
  - `AlgebraInput` already accepts `y=...`, but the function modal and function expression edit path send raw text to `FunctionGraph`.
  - `FunctionGraph` currently parses the expression exactly as stored, so a leading `y=` makes the function invalid.
  - AI/GraphA validation intentionally rejects `y=` inside operation expressions and should stay RHS-only.
- Implementation direction:
  - Add a shared function-input normalizer near `FunctionGraph`.
  - Strip leading `y=` before parsing/storing and set the visible label to `y = ...` when no explicit label is supplied.
  - Also keep named inputs such as `g(x)=...` working by normalizing to label `g` plus RHS expression.
- Verification target:
  - Focused function tests, full test suite, build/whitespace checks, and a browser smoke through the function modal.
- Completed result:
  - `FunctionGraph` now normalizes `y=...` and named `g(x)=...` style inputs before parsing.
  - `y=...` functions store only the right-hand side internally and display `y = ...` as the visible label.
  - The function modal copy now invites `y=...`, `f(x)=...`, or RHS-only input.
  - Focused tests, full test suite, build check, whitespace check, and Playwright modal smoke passed.

---

## Relevant Skills

- Skill: Frontend Testing Debugging
- Why it matters:
  - The axis-arrow and grid-spacing request changes visible canvas rendering and must be checked in a browser.

## Current Task Notes

- User request:
  - Change x/y axis arrowheads and labels to match the provided solid-arrow, italic-label reference.
  - If the axis interval is fixed to `1`, the grid should also remain at one-unit spacing while zooming.
- Implementation direction:
  - Add `Canvas.getGridGap()` and let it reuse the fixed axis-number interval when present.
  - Keep automatic mode using the old zoom-adaptive gap.
  - Draw filled triangular axis arrowheads and italic serif `x`/`y` labels in both canvas and SVG export paths.
- Verification target:
  - Focused axis-label settings tests, full tests, local rendered smoke, Vercel deploy/inspect, and production smoke.

---

## Relevant Skills

- Skill: Frontend Testing Debugging
- Why it matters:
  - The requested feature is a canvas interaction that must be verified in a rendered browser flow.
- Skill: Browser plugin / Playwright fallback
- Why it matters:
  - Area export needs drag input, download interception, and console-health checks in a real page.

## Current Task Notes

- User request:
  - Add a feature to drag over only the desired area and save that area.
- Implementation direction:
  - Add a temporary area-export canvas tool with a dashed rectangle preview.
  - Add a toolbar and command-palette entry to enter area-export mode.
  - Reuse the existing export modal settings for format, scale, background, grid, and axes.
  - Render the full scene to an offscreen canvas, then crop the selected screen rectangle into the downloaded output.
- Verification target:
  - Focused crop helper tests, full test suite, build/whitespace checks, local browser drag/download smoke, Vercel deploy/inspect, HTTP check, and production smoke.

---

## Relevant Skills

- Skill: Frontend Testing Debugging
- Why it matters:
  - The reported issue is a deployed canvas interaction: moving a rendered function formula label.
- Skill: MathGraph Drawing
- Why it matters:
  - Function labels are part of the editable graph object behavior and should preserve GraphA/runtime semantics.

## Current Task Notes

- User request:
  - Confirm whether the current work is deployed to Vercel.
  - Fix the Vercel behavior where a function's displayed formula cannot be moved.
- Finding:
  - `npx.cmd vercel inspect https://mathgraph-five.vercel.app` reports production deployment `dpl_5heRB9Mp1k6aXCYdvnWjdp14jLFg` is `Ready`, with the primary alias attached.
  - `FunctionGraph` has label dragging support, but `SelectTool` treats the function as draggable whenever it has a visible label. If `startDrag()` returns false because the click was on the curve instead of the label, the tool still enters dragging mode.
  - `FunctionGraph.getLabelBounds()` estimates label width by character count instead of using the math-label renderer's measurement path.
- Implementation direction:
  - Measure label bounds through `canvas.parseMathExpression()` and `canvas.measureMathExpression()` when available.
  - Let `SelectTool` begin object dragging only when `startDrag()` does not reject the clicked point.
  - Add focused tests for label-click drag success and curve-click no-op prevention.
- Verification target:
  - Focused drag regression test, full tests, local browser smoke, Vercel production deploy and smoke.

---

## Relevant Skills

- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - The UI is surfacing OpenAI model-routing metadata from the image analysis result without changing the underlying Responses API call.
- Skill: MathGraph Drawing
- Why it matters:
  - The feature sits in the AI diagram creation flow and must not change GraphA validation/application behavior.
- Skill: Frontend Testing Debugging
- Why it matters:
  - The model label is visible chat UI, so it should be verified in a rendered browser.

## Current Task Notes

- User request:
  - Show which model was actually used somewhere small in the result.
- Finding:
  - `AIService.analyzeImage()` already returns `model` for accepted first attempts and `initialModel` plus `model` for repaired attempts.
  - `AIService.processCommand()` can also return the model used for successful text-based API drawing requests.
  - `addChatMessage()` currently renders only one text body and has no metadata slot.
- Implementation direction:
  - Extend `addChatMessage(content, type, options)` with an optional metadata line.
  - Format successful AI drawing metadata as `모델: gpt-5.4-mini` or `모델: gpt-5.4-mini -> gpt-5.5`.
  - Keep ordinary chat messages unchanged when no metadata is provided.
- Verification target:
  - Focused DOM/unit-style tests for metadata rendering and model label formatting.
  - Browser smoke for the AI chat model badge.
  - Full tests, build check, whitespace check, deploy/inspect/HTTP/production smoke.
- Completed result:
  - `AIService` records the actual request model for OpenAI and Gemini text calls and returns it on successful text drawing results.
  - Image analysis result metadata is passed through the final applied-result chat message.
  - `main.js` renders optional message metadata as a secondary line, and CSS keeps it small and low-emphasis.
  - Repaired image analysis displays the route from initial model to accepted model, for example `모델: gpt-5.4-mini -> gpt-5.5`.
  - Focused tests, full tests, local Browser/Playwright smoke, Vercel deployment, inspect, HTTP, and production Playwright smoke all passed.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - Image preprocessing must preserve labels, axes, ticks, intersections, and relative geometry so the resulting GraphA operations remain faithful.
- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - The work changes OpenAI vision request cost behavior and model choice, so current official docs for image tokens, Responses API, and model pricing were checked.
- Skill: Frontend Testing Debugging
- Why it matters:
  - The resize/trim path runs in the browser through `Image` and `canvas`, so it needs rendered-page smoke coverage in addition to unit tests.

## Current Task Notes

- User request:
  - Apply cost-reduction options 2 and 3 first.
  - For option 2, avoid shrinking photos so much that GPT can no longer recognize the diagram.
- Finding:
  - `handleImageUpload()` currently sends the original data URL directly to `AIService.analyzeImage()`.
  - `AIService.callOpenAIImageAnalysis()` currently uses `detail: high` and the configured model for every image call.
  - OpenAI image token cost is driven by size and detail; OpenAI model docs recommend smaller variants for lower-cost/latency workloads, while pricing shows `gpt-5.4-mini` is much cheaper than `gpt-5.5`.
- Implementation direction:
  - Add a pure preprocessing plan helper with safe max long edge and minimum readable long edge constraints.
  - Use browser canvas to conservatively trim whitespace-like margins and downscale only oversized images before the API request.
  - Keep `detail: high` for exact diagram reconstruction.
  - Route first image attempts through `gpt-5.4-mini`; use the configured stronger model for validation repair.
- Verification target:
  - Unit tests for preprocessing plan and OpenAI image model routing.
  - Browser smoke that calls the preprocessing helper on a generated oversized image.
  - Full project tests, build check, whitespace check, deploy/inspect/HTTP/production smoke.
- Completed result:
  - `AIService` now exports image preprocessing constants and a pure `chooseImagePreprocessPlan()` helper.
  - `main.js` prepares image uploads/pastes in the browser before API submission, while preserving the original image preview and storing preprocessing metadata in `lastImageReference`.
  - Oversized images are downscaled to a 1800 px long-edge target, with a 1200 px downscale floor and no upscaling of small images.
  - Background-like margin trimming is conservative and rejects tiny crops that could make GPT lose readable context.
  - OpenAI image analysis uses `gpt-5.4-mini` first and escalates repair to the configured stronger model or `gpt-5.5`.
  - `detail: high` stays enabled because exact diagram reconstruction depends on small labels, ticks, and thin strokes.
  - Focused tests, full tests, local Browser/Playwright smoke, Vercel deployment, inspect, HTTP, and production Playwright smoke all passed.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - Whole problem text and whole-photo diagram recreation both need valid GraphA operations, supported object types, reference ordering, and exam-style visual guardrails.
- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - The feature sits on OpenAI Responses API multimodal input and strict Structured Outputs, so current official docs and the local OpenAI routing context matter.
- Skill: Frontend Testing Debugging
- Why it matters:
  - The chat input/upload wording is visible UI, and image/text flows should be smoke-tested in the browser when possible.

## Current Task Notes

- User request:
  - If a whole math problem is pasted into the AI chat, draw a graph related to the problem situation that can be used while solving or explaining it.
  - If a whole photo is pasted/uploaded, recreate the diagram or graph visible in the photo accurately as editable MathGraph/GraphA objects.
- Finding:
  - `AIService.processCommand()` already sends text requests through Responses API Structured Outputs and applies deterministic quality enhancement.
  - `AIService.analyzeImage()` already splits image-only input into recreate mode and image-plus-text into patch mode.
  - The image recreate prompt needs stronger full-photo/diagram-priority guidance, and text commands need an explicit problem-statement mode so the model does not answer the problem instead of drawing.
- Implementation direction:
  - Add problem-statement detection based on length and Korean/math problem markers.
  - Insert problem-situation drawing guidance into text requests only when the input looks like a full problem.
  - Strengthen recreate-mode image prompts for full-page photos, diagram fidelity, labels, axes, tick marks, intersections, and unsupported-feature handling.
  - Keep selected-object patch mode strict and unchanged except for clearer prompt boundaries.
- Verification target:
  - Unit tests for detection/prompt construction and OpenAI image input body.
  - Full test suite and whitespace check.
  - Browser smoke for chat placeholder/upload title and app load health.
- Completed result:
  - Full Korean problem text now triggers problem-situation graphing guidance while short drawing commands stay on the ordinary path.
  - Image-only upload/paste now asks for full-photo diagram/graph reconstruction with stronger geometry, label, axis, tick, shading, and unsupported-feature boundaries.
  - Image plus text remains targeted patch mode and still prioritizes selected/current canvas objects.
  - AI chat copy, `docs/ai-reference.md`, and the project-local MathGraph drawing references now describe the new modes.
  - Focused tests, full tests, Browser smoke, Vercel production deployment, inspect, HTTP, and production Playwright smoke all passed.

---

## Relevant Skills

- Skill: Frontend Testing Debugging
- Why it matters:
  - The symptom appears on the rendered canvas, so the parser fix should be backed by focused tests and, if practical, a rendered function-graph check.

## Current Task Notes

- User concern:
  - Entering `-x^2 + 4` draws an upward-opening graph even though the label reads like a downward-opening parabola.
- Finding:
  - `FunctionParser` currently handles unary `-` in `parsePrimary()`, so `-x^2` becomes `(-x)^2`.
  - Standard classroom/math notation treats exponentiation as higher precedence than unary negation: `-x^2` means `-(x^2)`.
- Implementation direction:
  - Move unary parsing into a level below exponentiation.
  - Let exponentiation parse its right operand through unary parsing so `2^-2` continues to work.
  - Preserve explicit parentheses: `(-x)^2` remains distinct from `-x^2`.
- Verification target:
  - Focused parser tests for `-x^2 + 4`, `(-x)^2 + 4`, negative exponents, and existing implicit multiplication behavior; then full project tests and whitespace check.
- Completed result:
  - `FunctionParser` now parses `-x^2 + 4` as `-(x^2) + 4`, so the graph opens downward.
  - `(-x)^2 + 4` still opens upward because the negative base is explicit.
  - Negative exponents such as `2^-2` and implicit multiplication such as `-3/8x^2 + 6` are covered by focused parser tests.
  - Browser verification created `-x^2 + 4` through the function tool UI and confirmed the rendered canvas shows the downward-opening parabola with no console warnings/errors.

---

## Relevant Skills

- Skill: Frontend Testing Debugging
- Why it matters:
  - The requested behavior is a visible canvas/UI edit, so the control flow should be verified in a rendered browser, not only through unit tests.

## Current Task Notes

- User concern:
  - Point size should be adjustable both in bulk and one point at a time.
- Finding:
  - `pointSize` already exists on point-like objects and `pointSize: 0` is the label-only state.
  - The UI currently exposes only point-body hide/show toggles, not a numeric size control.
- Implementation direction:
  - Add a persisted default point-size control for future points.
  - Add a style-panel batch control for all point-like objects.
  - Add selected-object controls that resize a single point-like object and selected point-like groups.
  - Preserve `pointSize: 0` as a valid size for label-only points.
- Verification target:
  - Focused settings/unit coverage, full tests, and a browser interaction check for default, all-point, and selected-point resizing.
- Completed result:
  - The style panel includes default point-size and all-point point-size sliders.
  - The selection panel includes point-size sliders for a single selected point and for multi-selected point groups.
  - `SettingsManager` clamps point sizes to a safe UI/runtime range and only applies batch point-size changes to point-like objects.
  - Verification passed through focused tests, full tests, Browser plugin interaction checks, and a fallback Playwright screenshot after Browser screenshot capture timed out.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The user-visible failure is a graph-region construction issue, and current MathGraph guidance says function-bounded curved regions need polygon/sample-point approximation until a first-class curved fill primitive exists.
- Skill: Frontend Testing Debugging
- Why it matters:
  - The acceptance bar is whether a canvas click creates and renders a filled vector region without breaking existing fill tool behavior.

## Current Task Notes

- User concern:
  - A quadratic graph such as `y = -3/8x^2 + 6` cannot fill the area bounded by the x-axis and y-axis; the app says there is no fillable shape.
- Finding:
  - `FillTool` can target existing closed objects, infer loose segment loops, and infer two-circle lenses.
  - It does not currently treat canvas coordinate axes as boundary objects, so a function-axis region is invisible to the fill inference path.
- Implementation direction:
  - After segment-loop and lens checks, inspect visible function graphs for x-axis/y-axis intercepts in the clicked quadrant.
  - Sample the function between the origin-side axis intercepts and create a `closedRegion` from stored sample vertices.
  - Avoid hidden helper point objects; keep exact curved-region primitives as a future enhancement.
- Verification target:
  - Focused tests for first-quadrant and second-quadrant parabola-axis fill creation, plus existing segment-loop/lens tests and full project tests.
- Completed result:
  - The fill tool now infers x-axis/y-axis/function bounded regions when the click is inside the relevant quadrant.
  - `ClosedRegion` can now persist stored sample vertices, which avoids creating hidden helper-point objects for sampled curve fills.
  - Browser QA confirmed the first-quadrant region for `y=-3/8x^2+6` is filled as a valid `closedRegion`.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The visible issue appears in MathGraph's function-label surface for graph drawings.
- Skill: Frontend Testing Debugging
- Why it matters:
  - The acceptance bar is rendered canvas behavior: the label should draw a stacked fraction instead of inline slash text.

## Current Task Notes

- User concern:
  - A function label like `y=-3/8x^2+6` does not display the fractional coefficient properly.
- Finding:
  - Function labels flow through `FunctionGraph.getLabelText()` and `Canvas.drawMathLabel()`.
  - The current parser supports normal text, superscripts, subscripts, `*` suppression, and minus normalization, but `/` is treated as plain text.
- Implementation direction:
  - Add a `fraction` token to `Canvas.parseMathExpression()` for simple slash fractions and LaTeX-style `\frac{...}{...}`.
  - Render the token as centered numerator/denominator with a horizontal bar.
  - Keep the saved/evaluated expression as the user's original ASCII-friendly text.
- Verification target:
  - Focused math-label tests, full tests, rendered browser smoke, and whitespace check.
- Completed result:
  - `Canvas.parseMathExpression()` now emits `fraction` parts for simple slash fractions and `\frac{...}{...}` groups.
  - `Canvas.renderMathExpression()` centers numerator/denominator text around a horizontal fraction bar.
  - Browser verification created `-3/8x^2+6` and confirmed the displayed label path uses a fraction token without slash text.

---

## Relevant Skills

- Skill: Frontend Testing Debugging
- Why it matters:
  - The user-visible behavior is canvas drag selection, so focused unit coverage plus rendered interaction verification are useful.

## Current Task Notes

- User concern:
  - Function graphs and solid figures appear not to be selected by drag-box selection.
- Finding:
  - `SelectTool` currently checks point positions, the first two dependency points, or a center point.
  - Function graphs have no point dependencies or center, and solids can be missed when the box crosses an edge without containing the first two dependency points.
- Implementation direction:
  - Add a geometry-aware drag-box predicate that checks object points, drawn edges, function samples, circle samples, and existing `hitTest` fallback probes against the selection rectangle.
  - Keep hidden objects unselectable in normal drag-box selection.
- Verification target:
  - Focused tests for function, prism, pyramid, and crossing-segment drag-box selection, plus full tests and whitespace check.
- Completed result:
  - `SelectTool` now uses object geometry instead of only stored positions for drag-box selection.
  - Function graphs are sampled within their visible range, solids are selected by projected edges, and segment-like objects are selected when an edge crosses the rectangle.
  - Browser plugin loaded the app and verified console health/click selection; Playwright fallback verified actual drag-box function and prism selection because Browser CUA drag replay was unreliable.

---

## Relevant Skills

- Skill: Frontend Testing Debugging
- Why it matters:
  - The request changes rendered canvas controls and the right-side settings/properties UI, so browser validation is part of the acceptance bar.
- Skill: Image Generation
- Why it matters:
  - Project rules ask for a target screen before vibe-coding webapp UI changes; a 16:9 target mockup was generated for this session.

## Current Task Notes

- User concern:
  - Axis numbers should be separately showable/hideable.
  - Axis numbers should optionally stay at fixed intervals such as `0.1`, `1`, or `2` regardless of zoom.
  - Function graphs should support visible-range limits based on `y` values, not only `x` values.
- Finding:
  - Axis labels and ticks are rendered in `Canvas.drawAxisLabels()` using an automatic zoom-based gap.
  - View toggles already live in the right settings panel.
  - Function `xMin`/`xMax` exists in `FunctionGraph` and the selection property panel, but persistence/export support is incomplete and there is no `yMin`/`yMax`.
- Implementation direction:
  - Add `showAxisNumbers` and `axisNumberInterval` settings, with `auto` retaining the current zoom-derived behavior.
  - Keep axes visible even when numeric labels are hidden.
  - Add `yMin`/`yMax` to function rendering, hit testing, save/load, and SVG path generation.
- Verification target:
  - Focused unit tests for axis interval resolution and function y-range clipping, plus full tests, browser smoke, and whitespace check.
- Completed result:
  - The settings panel now has `축 숫자` and `축 숫자 간격` controls.
  - Axis-number interval can stay automatic or fixed at values such as `0.1`, `1`, and `2`.
  - Function properties now show both `x 범위` and `y 범위`.
  - Canvas rendering, hit testing, SVG export, and JSON save/load now honor `yMin`/`yMax`.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The visible issue appears in MathGraph's formula label surface for a graph drawing.
- Skill: Frontend Testing Debugging
- Why it matters:
  - The acceptance bar is a rendered visual detail in the canvas math-label path, so focused rendering-token tests and a browser smoke are useful.

## Current Task Notes

- User concern:
  - In `y = -(x+2)^2 + 3`, only the `-` looks unlike a clean LaTeX/math minus.
- Finding:
  - Function labels use `Canvas.drawMathLabel()` and a custom canvas renderer.
  - ASCII `-` is drawn directly, which can render as a short text hyphen instead of a mathematical minus.
- Implementation direction:
  - Normalize display-time `-` tokens to `\u2212` inside the math-label tokenization path.
  - Preserve the source expression and GraphA payloads as ASCII-compatible strings.
- Verification target:
  - Focused tests for minus normalization plus existing full tests and whitespace check.
- Completed result:
  - Math label tokenization now converts display-time ASCII `-` to `\u2212`.
  - The source expression still remains ASCII-compatible, so function parsing and saved GraphA data are unchanged.
  - Browser evidence confirmed `y = -(x+2)^2 + 3` renders with a proper mathematical minus glyph.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - This change affects how point objects and helper vertices render while building ordinary geometric figures.
- Skill: Frontend Testing Debugging
- Why it matters:
  - The acceptance bar is visible canvas behavior: point bodies must disappear while labels remain.

## Current Task Notes

- User concern:
  - When a point is created, they want an option to remove the point marker and leave only the alphabetic point name.
  - They also want a default option so points created while drawing shapes are transparent/borderless.
- Implementation direction:
  - Treat `pointSize: 0` as the label-only state.
  - Fix render/export paths that currently fall back to a visible dot or border when point size is zero.
  - Add a persistent "new points label-only" default and wire it into `ObjectManager.createPoint`.
  - Keep explicit labels and explicit point sizes available for cases where a visible dot is needed.
- Verification target:
  - Focused tests for zero-sized point preservation/defaults, plus full test suite and whitespace check.
- Completed result:
  - `pointSize: 0` now suppresses the point dot and border while labels remain visible.
  - The style panel includes a persistent "새 점은 이름만 표시" option for future point-like objects.
  - The selected-object properties panel includes a point-body visibility toggle for existing point-like objects.
  - Browser verification confirmed the point center pixels do not change while the label region does.

---

## Relevant Skills

- Skill: Vercel Deployments & CI/CD
- Why it matters:
  - The user reported that Vercel did not reflect the pushed icon-system change, so the current deployment state and production deploy path need direct verification.
- Skill: Vercel CLI
- Why it matters:
  - The project is linked through `.vercel/project.json`, and CLI commands can inspect deployments and retry production deploys from the current workspace.

## Current Task Notes

- User concern:
  - Vercel still shows no change after the generated icon commit was pushed.
- Finding:
  - `npx.cmd vercel ls` showed no recent deployments; latest listed deployment was 47 days old.
  - Direct `vercel deploy --prod --yes` initially failed because the upload payload was about 665 MB and exceeded the 100 MB limit.
  - The first `.vercelignore` draft excluded root `tools/` but the unanchored pattern also excluded runtime files under `js/tools/`, which caused production module 404s and prevented the generated icon hydration from completing.
- Fix direction:
  - Add `.vercelignore` for local dependencies, PDFs, tmp render output, tests, docs, root tools, and agent workspace files.
  - Anchor root-only ignore patterns such as `/tools/` so runtime subdirectories remain deployable.
  - Retry production deployment and verify the deployed URL.
- Completed result:
  - Production deployment is Ready and aliased to `https://mathgraph-five.vercel.app`.
  - `js/tools/Tool.js` now returns 200 on the production alias.
  - Browser/Playwright smoke confirmed all 98 icon placeholders hydrate to generated SVGs with no Material Symbols font link.

---

## Relevant Skills

- Skill: Frontend Testing Debugging
- Why it matters:
  - This is a rendered frontend visual-system change, so the acceptance bar includes seeing the app load with the new icon language and checking console health.
- Skill: Image Generation
- Why it matters:
  - The user asked for generative-AI-made icons. For this dense UI, the project-bound deliverable should be generated vector SVG rather than raster bitmaps so it remains crisp, themeable, and layout-stable.

## Current Task Notes

- User concern:
  - The app's icons feel like arbitrary free icon-font picks and should be replaced with generated icons that preserve the existing tone and manner.
- Implementation direction:
  - Remove the Material Symbols icon font dependency.
  - Add a project-owned generated SVG renderer that maps existing icon names to MathGraph-style strokes, points, curves, grids, and panels.
  - Hydrate current icon placeholders in place so existing HTML structure and CSS states continue to work.
  - Update dynamic icon updates and command-palette icon output to use the same renderer.
- Verification target:
  - App shell loads with generated icons, no raw icon-name text visible in primary controls, no console errors, and tests still pass.
- Completed result:
  - Added a generated inline-SVG icon renderer and removed the external Material Symbols font dependency.
  - Browser QA confirmed generated SVG hydration for the app shell and dynamic sidebar icon states.
  - Playwright mobile-width QA confirmed command-palette icons render through the same generated SVG system.

---

## Relevant Skills

- Skill: MathGraph Drawing
- Why it matters:
  - The fresh CSAT-style prompt set needs valid GraphA operations, prompt-local expectations, and visual reference targets for exam-style diagrams.
- Skill: Browser / Playwright
- Why it matters:
  - The acceptance bar is the rendered canvas contact sheet, not just JSON schema validity.
- Skill: OpenAI Vibe Coding Context
- Why it matters:
  - Live API calls must use process-scoped `OPENAI_API_KEY` and strict Structured Outputs without persisting secrets.

## Current Task Notes

- Added `fresh_csat` as a selectable prompt set in `tools/run-live-openai-random-drawing-smoke.mjs`.
- Local reference rendering passed for 10 fresh targets with 0 validation failures and 0 browser console errors.
- The fresh live OpenAI call is blocked until `OPENAI_API_KEY` exists in the process environment; do not paste the key into command text or repo files.
- Visual review found the box-plot approximation needed shorter labels and viewport-friendly coordinates, so the reference prompt/payload now uses `L,Q1,M,Q3,U` on a `-5..5` number line.
- Remaining approximation gaps: native box plots, exact open/closed number-line endpoint styling, and exact three-circle common-region fills.

---

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
