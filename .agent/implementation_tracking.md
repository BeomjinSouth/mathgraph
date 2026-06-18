# Implementation Tracking

## Status

- Task: Zero-size point invisibility
- State: Done
- Last updated: 2026-06-18

## Plan

1. Record the zero-size point behavior before implementation.
2. Move `drawPoint()` zero-radius exit ahead of selected/highlight rendering.
3. Strengthen focused tests for selected zero-size and selected positive-size points.
4. Update docs/progress notes and run focused/full verification.
5. Commit, push, and deploy or record any blocker.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Keep using `pointSize: 0` as the invisible point-body contract.
- Reason: Existing UI controls, AI output, save/load, and label-only behavior already rely on `pointSize`.
- Decision: Suppress selected/highlight point feedback only when the point body radius is zero.
- Reason: The user wants zero-size points fully invisible, while positive-size points should still show normal editing feedback.

## Verification

- Completed:
  - `node --check js\core\Canvas.js`; passed.
  - `node --test tests\point-label-only.test.js`; passed with 6 tests.
  - `npm.cmd test`; passed with 180 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - Local Playwright pixel smoke confirmed selected `pointSize:0` produced `zeroDelta:0`, while a selected positive-size point produced `positiveDelta:323`; no failed requests.
  - `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_3RcgUBszAPN7mfKumVAJLLZPdRx1` created at `https://mathgraph-j4oo5i9qa-beomjinsouths-projects.vercel.app`.
  - `npx.cmd vercel inspect https://mathgraph-j4oo5i9qa-beomjinsouths-projects.vercel.app`; target `production`, status `Ready`, primary alias attached.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Production Playwright pixel smoke on `https://mathgraph-five.vercel.app/` confirmed `zeroDelta:0`, `positiveDelta:323`, `window.app`, and no failed requests.

## Handoff

- Current status:
  - `pointSize:0` now suppresses the point body, border, selected halo, and highlighted expansion.
  - Labels still render through each point object's normal `showLabel` path.
  - Positive-size points retain normal selected feedback.

---

## Status

- Task: Live Vercel OpenAI proxy diagram QA
- State: Done
- Last updated: 2026-06-16

## Plan

1. Configure Vercel Production secrets without committing values.
2. Verify owner login and `/api/openai-responses` on the production alias.
3. Compare live OpenAI-rendered outputs for the prior 9/10-style prompts and nested-prism prompt.
4. Fix recurring prompt/result mismatches in app-owned cleanup code.
5. Run focused/full/deploy/browser verification, update docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Keep `OPENAI_API_KEY` and `MATHGRAPH_LOGIN_SECRET` only as encrypted Vercel Production environment variables.
- Reason: Owner-mode OpenAI calls need a server-side key, but the client bundle and repository must not contain secret values.
- Decision: Do not configure `MATHGRAPH_OWNER_NAME` in Vercel Production.
- Reason: A shell-injected Korean env value can be encoding-mangled; the source default owner name is already UTF-8 safe.
- Decision: Serve runtime copies of drawing reference files from `runtime/mathgraph-drawing/references/`.
- Reason: `.agents/` is not served in Vercel production, so the AI prompt reference fetch needs a public runtime path.
- Decision: Fix the 9/10-style visual issues in `DiagramQualityEnhancer`.
- Reason: Live OpenAI can create the right object families while still leaving helper dots or labels visible; the app should normalize those recurring exam-diagram presentation issues.

## Verification

- Completed:
  - `npx.cmd vercel env ls`; confirmed encrypted Production `OPENAI_API_KEY` and `MATHGRAPH_LOGIN_SECRET`.
  - `node --check js\ai\DiagramQualityEnhancer.js`; passed.
  - `node --test tests\ai-flow.test.js`; passed with 49 tests.
  - `npm.cmd test`; passed with 179 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_HUdQoHPYE7KNQNRqLPYX5owaR7Cw` created at `https://mathgraph-4bsjzbe51-beomjinsouths-projects.vercel.app`.
  - `npx.cmd vercel inspect https://mathgraph-4bsjzbe51-beomjinsouths-projects.vercel.app`; target `production`, status `Ready`, primary alias attached.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Production Playwright live OpenAI smoke confirmed runtime references 200, owner login 200, all three proxy calls 200, no console issues, no failed requests, and visually correct outputs for three-circle lenses, square-pyramid midsection, and nested prism.

## Handoff

- Current status:
  - The production site can call OpenAI through the owner proxy.
  - The latest production alias is `https://mathgraph-five.vercel.app`.
  - The final deployment is `dpl_HUdQoHPYE7KNQNRqLPYX5owaR7Cw`.
  - 9번 and 10번 were both rechecked visually after the cleanup; the previously suspicious helper dots/labels are no longer visible.
  - Secret values are not stored in the repository.

---

## Status

- Task: Landing login and default OpenAI proxy
- State: Done
- Last updated: 2026-06-16

## Plan

1. Record the login/proxy behavior change before implementation.
2. Add first-load login state and a polished landing overlay.
3. Add Vercel API proxy endpoints for owner OpenAI calls.
4. Route `AIService` OpenAI text/image requests through the proxy in owner mode while preserving guest BYOK.
5. Add focused tests, update docs, verify in browser, deploy, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Use a same-origin Vercel API proxy for the `박범진` flow.
- Reason: The app is a public static frontend and must not expose a default OpenAI API key in shipped client assets.
- Decision: Keep guest mode on the existing BYOK flow.
- Reason: The user explicitly requested direct API entry for guest use, and this preserves the current provider configuration surface.
- Decision: Treat name login as a convenience gate rather than strong authentication.
- Reason: The requested input is only a name; a true private/public boundary would need a real auth secret or account system.

## Verification

- Completed:
  - `node --check js\ai\AIService.js`; passed.
  - `node --check js\main.js`; passed.
  - `node --check api\login.js`; passed.
  - `node --check api\openai-responses.js`; passed.
  - `node --test tests\ai-flow.test.js`; passed with 46 tests.
  - `npm.cmd test`; passed with 176 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - In-app Browser owner-flow smoke on `http://127.0.0.1:4196/`; passed.
  - Isolated Playwright initial/owner/guest/mobile smoke on `http://127.0.0.1:4196/`; passed with 0 console errors and 0 failed requests.
  - Local owner proxy missing-env check; returned a clear 500 setup error.
  - `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_9DFsZijPBTySUu7MY1sdYJ9KdfBR` created at `https://mathgraph-qsc02lwab-beomjinsouths-projects.vercel.app`.
  - `npx.cmd vercel inspect https://mathgraph-qsc02lwab-beomjinsouths-projects.vercel.app`; target `production`, status `Ready`, primary alias attached, and `api/login` plus `api/openai-responses` functions present.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Production Playwright smoke on `https://mathgraph-five.vercel.app/`; initial, owner, and guest flows passed with `window.app`, 0 console errors, and 0 failed requests.
  - Production owner proxy missing-env check; returned a clear 500 setup error because Vercel has no `OPENAI_API_KEY`.

## Handoff

- Current status:
  - Login landing, owner proxy routing, guest BYOK mode, local verification, production deployment, and production smoke are complete.
  - `OPENAI_API_KEY` and `MATHGRAPH_LOGIN_SECRET` are now configured as encrypted Production Vercel environment variables.
  - Owner login plus `/api/openai-responses` was verified through `vercel curl`; the proxy returned an OpenAI `OK` response.

---

## Status

- Task: Vercel direct prompt fallback for prior CSAT prompts
- State: Done
- Last updated: 2026-06-16

## Plan

1. Reproduce direct production UI behavior for representative prior prompts.
2. Add narrowly scoped deterministic fallback builders for the failed prompt families.
3. Add regression tests for object types, labels, and hidden helper points.
4. Run focused/full verification and production UI smoke.
5. Deploy, commit, push, and record remaining limits.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Keep this in local fallback instead of changing OpenAI prompts.
- Reason: The reproduced failure is the API-free production UI path.
- Decision: Add exact builders for the previously audited CSAT prompt families rather than a broad parser.
- Reason: The goal is reliable production behavior for known representative prompts without widening unintended fallback matches.

## Verification

- Completed:
  - `node --check js\ai\AIService.js`; passed.
  - `node --test tests\ai-flow.test.js`; passed with 45 tests.
  - `npm.cmd test`; passed with 175 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_5J2eAU3WZbAzGK2tSRuGqAGQbo6f` created at `https://mathgraph-dqu3op50k-beomjinsouths-projects.vercel.app`.
  - `npx.cmd vercel inspect https://mathgraph-dqu3op50k-beomjinsouths-projects.vercel.app`; target `production`, status `Ready`, primary alias attached.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Production UI direct prompt smoke on `https://mathgraph-five.vercel.app/`; nested prism, hyperbola/asymptotes, three-circle lenses, and square-pyramid midsection all created the requested object families with no failed requests.

## Handoff

- Current status:
  - Direct production UI now handles the prior representative prompts in local/no-key mode.
  - The three-circle prompt renders labels `O,P,Q` outside the circles without visible anchor dots.

---

## Status

- Task: Local solid fallback for nested rectangular prism request
- State: Done
- Last updated: 2026-06-15

## Plan

1. Confirm the failing path from the screenshot prompt.
2. Add deterministic rectangular-prism/cube fallback before legacy fallback examples.
3. Add focused regression tests for the exact nested prompt and a single labeled rectangular prism.
4. Update AI reference docs and project task notes.
5. Run focused/full/browser/deployment verification, deploy, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Represent both the outer rectangular prism and inner cube with first-class `prism` objects.
- Reason: `prism` is the existing supported solid primitive and owns hidden-edge rendering.
- Decision: Hide helper labels/points for the inner cube while keeping the outer `A` through `H` labels visible.
- Reason: The user asked for a small inner solid, not a second labeled vertex set; visible labels should stay readable.
- Decision: Keep the fix in local fallback rather than changing provider prompts.
- Reason: The screenshot failure happens when the API path is unavailable or falls back locally.

## Verification

- Completed:
  - `node --check js\ai\AIService.js`; passed.
  - `node --test tests\ai-flow.test.js`; passed with 41 tests.
  - `npm.cmd test`; passed with 171 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - Local Playwright smoke on `http://127.0.0.1:4195/`; exact prompt created 16 points and 2 prisms with no failure text, console issues, or failed requests.
  - `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_Dtrvq375pkY1kES3g1626ESmr2vG` created.
  - `npx.cmd vercel inspect https://mathgraph-q5vqpqww0-beomjinsouths-projects.vercel.app`; target `production`, status `Ready`, primary alias attached.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Production Playwright smoke on `https://mathgraph-five.vercel.app/`; exact prompt created 16 points and 2 prisms, visible outer labels `A` through `H`, no failure text, console issues, or failed requests.

## Handoff

- What changed:
  - Added deterministic solid fallback generation for rectangular-prism/cube prompts.
  - Added nested-solid handling for a small cube inside a labeled outer rectangular prism.
  - Updated AI reference/manual notes and focused regression tests.
- What remains:
  - Curved solids still require future first-class primitives or explicit approximation.

---

## Status

- Task: Axis arrow reference-style refinement
- State: Done
- Last updated: 2026-06-07

## Plan

1. Record the visual refinement before implementation.
2. Centralize axis-arrow shape metrics.
3. Apply the refined style to canvas, SVG, and cropped PNG area-export overlays.
4. Add focused regression coverage for the new arrow geometry.
5. Run focused/full/rendered verification, update docs, deploy, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Make the arrowhead longer and narrower than the previous filled triangle.
- Reason: The provided reference uses a sharper textbook-like arrowhead rather than a broad triangular marker.
- Decision: Put the arrow tip one CSS pixel from the outer edge and stop the shaft at the arrow base.
- Reason: This keeps the endpoint visually at the canvas/crop edge while avoiding a shaft that protrudes through the filled head.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\utils\AxisArrowStyle.js`; passed.
  - `node --check js\utils\ExportArea.js`; passed.
  - `node --check js\core\Canvas.js`; passed.
  - `node --check js\main.js`; passed.
  - `node --test tests\area-export.test.js tests\axis-label-settings.test.js`; passed with 13 tests.
  - `npm.cmd test`; passed with 169 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - In-app Browser loaded `http://127.0.0.1:4194/`, confirmed title `그래프A Mk2.1`, app shell, canvas metrics, and 0 console warning/error logs; tab screenshot capture timed out, so Playwright was used for image/download proof.
  - Playwright local smoke on `http://127.0.0.1:4194/` captured refined x/y arrow crops, dragged an area, downloaded a `230x235` PNG, confirmed crop-edge x/y arrow pixels, and reported 0 relevant console issues / 0 failed requests.
  - `npx.cmd vercel deploy --prod --yes`; deployed production `dpl_GKw1cKu2vVLjKe3NpUkoNwCBMbyD` at `https://mathgraph-ovoenuvao-beomjinsouths-projects.vercel.app`.
  - `npx.cmd vercel inspect https://mathgraph-ovoenuvao-beomjinsouths-projects.vercel.app`; target was `production`, status was `Ready`, and `https://mathgraph-five.vercel.app` was attached.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Playwright production smoke on `https://mathgraph-five.vercel.app/` confirmed `window.app`, canvas presence, refined x/y arrow pixels, downloaded a `230x235` PNG with crop-edge arrow pixels, and reported 0 console issues / 0 failed requests.
  - On 2026-06-07, reran focused tests, `git diff --check`, `npx.cmd vercel inspect https://mathgraph-five.vercel.app`, and HTTP 200 check; alias still resolved to production deployment `dpl_GKw1cKu2vVLjKe3NpUkoNwCBMbyD`.

## Handoff

- Current status:
  - Refined slimmer x/y axis arrowheads are implemented and deployed to Vercel production.
  - Canvas, SVG, and drag-area PNG overlays share the same arrow metrics.

---

## Status

- Task: Drag-area export axis arrowheads
- State: Done
- Last updated: 2026-06-04

## Plan

1. Record the crop-edge axis-arrow behavior before implementation.
2. Add a shared area-export axis geometry helper.
3. Overlay crop-edge axis arrows for PNG area export when axes cross the selected rectangle.
4. Make SVG area export draw axes to the crop viewBox edges.
5. Run focused/full/rendered verification, update docs, deploy, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Treat the dragged rectangle as the visual viewport for area export axis endpoints.
- Reason: The exported crop should be usable as a standalone worksheet image even when the full-canvas arrow tip was outside the dragged area.
- Decision: Only draw a crop-edge arrow for an axis that actually crosses the crop.
- Reason: A crop away from the x-axis or y-axis should not introduce misleading axis marks.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\utils\ExportArea.js`; passed.
  - `node --check js\main.js`; passed.
  - `node --test tests\area-export.test.js`; passed with 7 tests.
  - `npm.cmd test`; passed with 169 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - In-app Browser loaded `http://127.0.0.1:4193/`, confirmed the app shell/title, captured a screenshot, and reported 0 console warning/error logs.
  - Playwright local drag/download smoke on `http://127.0.0.1:4193/` downloaded a `230x236` PNG with x/y crop-edge arrow evidence, returned to select mode, confirmed SVG crop-edge arrow paths, and reported 0 console issues / 0 failed requests.
  - `npx.cmd vercel deploy --prod --yes`; deployed production `dpl_8kRi1ww7qGnRZqBAqjbRy4Tj8ePe` at `https://mathgraph-56oywn7xo-beomjinsouths-projects.vercel.app`.
  - `npx.cmd vercel inspect https://mathgraph-56oywn7xo-beomjinsouths-projects.vercel.app`; target was `production`, status was `Ready`, and `https://mathgraph-five.vercel.app` was attached.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Playwright production drag/download smoke on `https://mathgraph-five.vercel.app/` downloaded a `230x236` PNG with x/y crop-edge arrow evidence, returned to select mode, confirmed SVG crop-edge arrow paths, and reported 0 console issues / 0 failed requests.

## Handoff

- Current status:
  - PNG area export overlays crop-edge x/y arrows for axes that cross the selected rectangle.
  - SVG area export draws x/y axis endpoints against the crop viewBox edges.
  - The behavior is deployed to Vercel production.

---

## Status

- Task: Function input accepts y=
- State: Done
- Last updated: 2026-06-03

## Plan

1. Record the scoped function-input behavior before implementation.
2. Normalize user-facing function input that starts with `y=` while preserving RHS-only storage.
3. Preserve named function inputs such as `f(x)=...` and `g(x)=...`.
4. Add focused regression coverage and run browser/full verification.
5. Update docs, deploy/record deployment outcome, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Treat `y=...` as a user-input alias that normalizes to the existing right-hand-side function expression.
- Reason: The function parser, saved object schema, and AI GraphA operation contract already expect RHS-only expressions.
- Decision: Set the visible label to `y = ...` only when the user created or edited a function using `y=...`.
- Reason: This matches classroom notation while preserving the existing auto labels for RHS-only entries.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\objects\Function.js`; passed.
  - `node --check js\ui\AlgebraInput.js`; passed.
  - `node --test tests\function-parser.test.js`; passed with 8 tests.
  - `npm.cmd test`; passed with 160 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - Browser plugin tool discovery was attempted first, but the in-app Browser control tool was not exposed in this session; Playwright was used as fallback.
  - Playwright local smoke on `http://127.0.0.1:4191/` opened the function modal, entered `y=x^2`, created one valid function with stored expression `x^2`, visible label `y = x^2`, value `f(2)=4`, 0 console issues, and 0 failed requests.

## Handoff

- Current status:
  - User-facing function inputs now accept `y=...` and normalize to the existing RHS-only function expression model.
  - Functions created from `y=...` display a `y = ...` label, while named `f(x)=...` / `g(x)=...` inputs still map to ordinary function labels.

---

## Status

- Task: Axis arrows and fixed grid interval
- State: Done
- Last updated: 2026-06-03

## Plan

1. Record the axis-arrow and fixed-grid behavior change before implementation.
2. Add a shared fixed/automatic grid-gap resolver in `Canvas`.
3. Update canvas and SVG axes to use filled arrowheads with italic `x`/`y` labels.
4. Add focused tests for fixed grid spacing and axis-name rendering.
5. Run rendered smoke testing, update docs, deploy, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Reuse `축 숫자 간격` as the fixed grid interval when it is numeric.
- Reason: The user expects a fixed axis interval such as `1` to mean one-unit coordinate paper, so grid and tick spacing should stay aligned while zooming.
- Decision: Keep automatic mode unchanged.
- Reason: Automatic grid spacing remains useful for broad zoom exploration.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\core\Canvas.js`; passed.
  - `node --check js\main.js`; passed.
  - `node --test tests\axis-label-settings.test.js`; passed with 6 tests.
  - `npm.cmd test`; passed with 167 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - In-app Browser loaded the local app with 0 console warning/error logs, but Codex In-app Browser does not support download events; Playwright was used for the download-specific smoke.
  - Playwright local smoke on `http://127.0.0.1:4192/` set `축 숫자 간격` to `1`, zoomed in/out, confirmed `gridGap=1` and `axisGap=1`, sampled dark pixels at the filled x/y arrowheads, and reported 0 app console issues and 0 failed requests.
  - `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_5vtm66WoSiA1AZsYa241aPF6GnjB` was created at `https://mathgraph-1nitg9odn-beomjinsouths-projects.vercel.app`.
  - `npx.cmd vercel inspect https://mathgraph-1nitg9odn-beomjinsouths-projects.vercel.app`; target was `production`, status was `Ready`, and `https://mathgraph-five.vercel.app` was attached.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Playwright production smoke on `https://mathgraph-five.vercel.app/` confirmed `window.app`, fixed interval `1`, `gridGap=1`, `axisGap=1`, area-export download, 0 console issues, and 0 failed requests.

## Handoff

- Current status:
  - Filled textbook-style x/y axis arrows and italic axis labels are live in production.
  - Fixed axis-number intervals now also fix grid spacing during zoom.

---

## Status

- Task: Drag-area export
- State: Done
- Last updated: 2026-06-03

## Plan

1. Record the scoped area-export feature before implementation.
2. Add a dedicated drag-to-export tool and toolbar/command entry point.
3. Add crop-aware PNG export that reuses the existing render pipeline and export settings.
4. Add focused unit coverage for crop rectangle normalization and output sizing.
5. Run rendered smoke testing, update docs, deploy, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Implement area export as a temporary tool instead of overloading drag-box selection.
- Reason: Selection drag and crop drag have different outcomes, and a separate tool avoids changing existing object-selection semantics.
- Decision: Use screen-pixel crop rectangles while preserving the current math viewport.
- Reason: The user is dragging over the rendered canvas, so the saved image should match exactly the visible area they framed.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\main.js`; passed.
  - `node --check js\tools\AreaExportTool.js`; passed.
  - `node --check js\utils\ExportArea.js`; passed.
  - `node --test tests\area-export.test.js`; passed with 5 tests.
  - `npm.cmd test`; passed with 167 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - In-app Browser loaded the local app and confirmed page identity/console health; download-event verification required Playwright fallback because downloads are not supported by Codex In-app Browser.
  - Playwright local smoke downloaded `graph_area_1780464691455.png` from a dragged canvas rectangle, confirmed the crop PNG dimensions were `185x157`, and returned to the select tool.
  - Playwright production smoke downloaded `graph_area_1780464830549.png`, confirmed the crop PNG dimensions were `128x131`, and returned to the select tool.

## Handoff

- Current status:
  - Users can save a dragged rectangular canvas area from the toolbar or export modal.
  - Area export reuses current export settings and returns to the select tool after download.

---

## Status

- Task: Function formula label dragging on Vercel
- State: Done
- Last updated: 2026-06-03

## Plan

1. Record the scoped function-label drag bug before implementation.
2. Make function label hit testing use the rendered math-label measurement when possible.
3. Make `SelectTool` start object dragging only when `startDrag()` accepts the click.
4. Add focused regression coverage for label clicks versus curve clicks.
5. Run verification, update docs, deploy, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Fix the existing canvas label-drag path instead of adding a separate label-position control.
- Reason: The app already advertises direct formula-label dragging and has stored `labelMathPos`; the defect is in hit testing and drag-start handling.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\objects\Function.js`; passed.
  - `node --check js\tools\SelectTool.js`; passed.
  - `node --test tests\function-label-drag.test.js`; passed with 2 tests.
  - `npm.cmd test`; passed with 156 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - Browser plugin workflow was checked, but the required Node REPL execution tool was not exposed in this session.
  - Playwright local smoke on `http://127.0.0.1:4188/` created `2*x^2`, dragged the rendered formula label from `(0, 0)` to `(2.4, 1.6)`, saved `tmp/function-label-drag-smoke.png`, and reported 0 console issues and 0 failed requests.
  - `npx.cmd vercel deploy --prod --yes`; final production deployment `dpl_GsraWaC9WPUtvAKZm3jF8fbsB3uH` was created at `https://mathgraph-cgnkase6s-beomjinsouths-projects.vercel.app`.
  - `npx.cmd vercel inspect https://mathgraph-cgnkase6s-beomjinsouths-projects.vercel.app`; target was `production`, status was `Ready`, and `https://mathgraph-five.vercel.app` was attached.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Playwright production smoke on `https://mathgraph-five.vercel.app/` created `2*x^2`, dragged the rendered formula label from `(0, 0)` to `(2.4, 1.6)`, saved `tmp/function-label-drag-production-smoke.png`, and reported 0 console issues and 0 failed requests.

## Handoff

- Current status:
  - Vercel production alias was inspected and is currently `Ready`.
  - Function formula label dragging is fixed locally and in Vercel production, with focused tests plus rendered local/production smoke.

---

## Status

- Task: AI result model disclosure in chat
- State: Done
- Last updated: 2026-06-03

## Plan

1. Record the scoped model-disclosure behavior before implementation.
2. Add chat-message metadata support and styling for low-emphasis model labels.
3. Use `AIService` text and image result metadata to show the accepted model, including repair escalation when present.
4. Add focused tests and browser smoke for the rendered model label.
5. Update docs, run verification, deploy, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Show model metadata on successful AI drawing result messages when model metadata is available.
- Reason: The user asked to see which model was actually used in the result, and both text and image API paths can expose the accepted model without changing drawing behavior.
- Decision: Render model information as a secondary line under the chat bubble.
- Reason: It should help with trust/cost visibility without competing with the main result message.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\main.js`; passed.
  - `node --check js\ai\AIService.js`; passed.
  - `node --test tests\ai-flow.test.js`; passed with 39 tests.
  - JSON parse check for `.agents\skills\mathgraph-drawing\references\feature-manual.json`; passed.
  - In-app Browser loaded `http://127.0.0.1:4187/`, confirmed the app page loaded, and reported 0 console warnings/errors.
  - Playwright local smoke on `http://127.0.0.1:4187/` confirmed `모델: gpt-5.4-mini -> gpt-5.5` renders as a 10px metadata line and ordinary messages do not get metadata.
  - `npm.cmd test`; passed with 154 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - `npx.cmd vercel deploy --prod --yes`; deployed production `dpl_5heRB9Mp1k6aXCYdvnWjdp14jLFg` at `https://mathgraph-c46eexs7c-beomjinsouths-projects.vercel.app`.
  - `npx.cmd vercel inspect https://mathgraph-c46eexs7c-beomjinsouths-projects.vercel.app`; target `production`, status `Ready`, alias `https://mathgraph-five.vercel.app` attached.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Playwright production smoke on `https://mathgraph-five.vercel.app/` confirmed the model metadata line, ordinary-message behavior, 0 console issues, and 0 failed requests.

## Handoff

- Current status:
  - Successful AI drawing result chat messages now show a small secondary model line when the API result includes model metadata.
  - Image repair/escalation results display both models, for example `모델: gpt-5.4-mini -> gpt-5.5`.
  - Ordinary chat messages remain unchanged when no metadata is passed.

---

## Status

- Task: AI image token reduction through safe preprocessing and model routing
- State: Done
- Last updated: 2026-06-02

## Plan

1. Record the scoped cost-reduction behavior before implementation.
2. Add a safe image preprocessing plan and browser-side resize/trim path that avoids shrinking readable photos too far.
3. Route first OpenAI image attempts to a cheaper mini model and reserve the configured stronger model for repair/fallback.
4. Add focused unit coverage and browser smoke for the preprocessing path.
5. Update docs, run verification, deploy, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Keep `detail: high` for image requests.
- Reason: The requested feature is exact math diagram reconstruction, and small labels/ticks/thin strokes matter more than the token savings of low-detail mode.
- Decision: Only trim background-like margins and never perform content-aware diagram cropping in this pass.
- Reason: A wrong crop can remove problem conditions or labels; safe whitespace trimming and oversized-image downscaling are lower-risk.
- Decision: Use a mini model for the first image attempt, then escalate only on repair/failure.
- Reason: OpenAI docs recommend smaller variants for lower-cost/latency workloads while preserving a stronger path for difficult or invalid outputs.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\ai\AIService.js`; passed.
  - `node --check js\main.js`; passed.
  - `node --test tests\ai-flow.test.js`; passed with 38 tests.
  - JSON parse check for `.agents\skills\mathgraph-drawing\references\feature-manual.json` and `retrieval-index.json`; passed.
  - Browser plugin loaded `http://127.0.0.1:4186/`, confirmed title `그래프A Mk2.1`, captured a screenshot, and reported 0 console warnings/errors.
  - Browser plugin could not execute the canvas-based preprocessing function because its evaluate surface is read-only for `document.createElement`; fallback Playwright was used for that specific interaction proof.
  - Playwright local smoke on `http://127.0.0.1:4186/` called `window.app.prepareImageForAI()` on a generated 3200x2400 diagram image and produced a processed 1800x1277 JPEG with crop/resize enabled, 0 console issues, and 0 failed requests.
  - `npm.cmd test`; passed with 153 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - `npx.cmd vercel deploy --prod --yes`; deployed production `dpl_HE1fF5dKKYi6tjnA8e1H19Lzff5D` at `https://mathgraph-gncgvbq52-beomjinsouths-projects.vercel.app`.
  - `npx.cmd vercel inspect https://mathgraph-gncgvbq52-beomjinsouths-projects.vercel.app`; target `production`, status `Ready`, alias `https://mathgraph-five.vercel.app` attached.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Playwright production smoke on `https://mathgraph-five.vercel.app/` confirmed `window.app`, `prepareImageForAI()`, processed 3200x2400 to 1800x1277, and reported 0 console issues and 0 failed requests.

## Handoff

- Current status:
  - Image upload/paste now keeps the visible preview as the original image but sends a safely preprocessed image to the OpenAI vision call.
  - Safe preprocessing trims only background-like margins, rejects tiny suspicious crops, downscales only oversized images, and keeps a 1200 px readability floor for downscaled input.
  - OpenAI image analysis now uses `gpt-5.4-mini` for the first attempt and escalates repair to the configured stronger model or `gpt-5.5`.
  - `detail: high` remains in place for exact math diagram reconstruction.

---

## Status

- Task: AI problem-situation graphing and full-photo diagram recreation
- State: Done
- Last updated: 2026-06-02

## Plan

1. Record the requested AI behavior before implementation.
2. Add problem-statement detection and problem-situation graphing prompt guidance.
3. Strengthen image recreate prompts for full-photo diagram reconstruction while keeping patch mode targeted.
4. Update the chat UI wording so users know they can paste whole problems or photos.
5. Add focused tests and run project verification.
6. Update progress docs, commit, push, and deploy/verify when appropriate.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5
- [x] Step 6

## Decisions

- Decision: Keep GraphA `operations[]` as the applied runtime contract.
- Reason: The app already has strict Structured Outputs, schema/reference/intent validation, quality enhancement, and rollback patching built around that contract.
- Decision: Add problem-situation guidance as a prompt-mode layer instead of a new UI button.
- Reason: The user wants whole problem text to work naturally when pasted into the existing AI chat.
- Decision: Treat whole-photo input as recreate mode unless the user typed an instruction with the image.
- Reason: The current upload/paste flow already uses this split, and it matches the requested "사진을 통째로" behavior.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\ai\AIService.js`; passed.
  - `node --check js\main.js`; passed.
  - JSON parse check for `.agents\skills\mathgraph-drawing\references\feature-manual.json` and `retrieval-index.json`; passed.
  - `node --test tests\ai-flow.test.js`; passed with 35 tests.
  - In-app Browser loaded `http://127.0.0.1:4185/`, opened the AI chat, confirmed the new greeting/placeholder/upload title, captured a screenshot, and reported 0 console warnings/errors.
  - `npm.cmd test`; passed with 150 tests.
  - `npm.cmd run vercel-build`; passed.
  - `git diff --check`; passed with line-ending warnings only.
  - `npx.cmd vercel deploy --prod --yes`; deployed production `dpl_AZRSRUJTGhA4UeznG1VcnfaPvXwj` at `https://mathgraph-nh3gffekl-beomjinsouths-projects.vercel.app`.
  - `npx.cmd vercel inspect https://mathgraph-nh3gffekl-beomjinsouths-projects.vercel.app`; target `production`, status `Ready`, alias `https://mathgraph-five.vercel.app` attached.
  - `https://mathgraph-five.vercel.app/`; returned HTTP 200.
  - Playwright production smoke confirmed `window.app`, AI chat toggle, updated AI chat text, 0 console issues, and 0 failed requests.

## Handoff

- Current status:
  - Whole problem text now receives problem-situation graph guidance before the model call.
  - Image-only upload/paste now prompts for full-photo diagram reconstruction while image-plus-text remains targeted patch mode.
  - UI wording, GraphA AI reference docs, and project-local drawing references have been updated.

---

## Status

- Task: Function unary-minus exponent precedence
- State: Done
- Last updated: 2026-06-01

## Plan

1. Record the scoped parser bug before implementation.
2. Refactor parser precedence so exponentiation binds before leading unary signs while preserving negative exponents.
3. Add focused parser regression coverage for `-x^2`, `(-x)^2`, and `2^-2`.
4. Run focused/full verification, update progress docs, commit, and push or record blockers.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4

## Decisions

- Decision: Fix the existing parser instead of adding a new parser dependency.
- Reason: The bug is localized to unary/exponent precedence and the app already has a compact parser contract used by functions, intersections, and tests.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\utils\Parser.js`; passed.
  - `node --test tests\function-parser.test.js`; passed with 4 tests.
  - `npm.cmd test`; passed with 148 tests.
  - In-app Browser loaded `http://127.0.0.1:4184/`, created `-x^2 + 4` through the function tool UI, rendered a downward-opening parabola with label `f(x) = -x^2 + 4`, and reported 0 console warnings/errors.
  - `git diff --check`; passed with CRLF normalization warnings only.

## Handoff

- Current status:
  - `-x^2` now follows standard mathematical precedence as `-(x^2)`.
  - Explicit parentheses such as `(-x)^2` and negative exponents such as `2^-2` remain supported.

---

## Status

- Task: Point size controls for default, bulk, and individual edits
- State: Done
- Last updated: 2026-06-01

## Plan

1. Record the point-size control scope before implementation.
2. Add settings helpers for normalized default and bulk point sizes.
3. Add style-panel controls for default point size and all-point batch resizing.
4. Add selected-point controls for individual and selected-batch resizing.
5. Run focused/full/browser verification, update progress docs, commit, and push or record blockers.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Continue using existing `pointSize` instead of adding a new size field.
- Reason: Rendering, persistence, SVG export, AI operations, and label-only behavior already use `pointSize`.
- Decision: Keep `pointSize: 0` as the label-only state.
- Reason: The current hide-point-body feature depends on zero size and should stay compatible with saved drawings.

## Blockers

- Blocker: Commit/push is not safe from this task turn because the worktree already contains unrelated staged and unstaged changes for axis labels, function ranges, fill regions, selection, and other tests.
- Checked: `git status --short --branch` and `git diff --cached --name-status`.
- Reason commit/push was skipped: `git commit` would include unrelated staged files, while this point-size work also has hunks inside files that already contain unrelated changes.

## Verification

- Completed:
  - `node --check js\core\SettingsManager.js`; passed.
  - `node --check js\main.js`; passed.
  - `node --test tests\point-label-only.test.js`; passed with 5 tests.
  - `npm.cmd test`; passed with 144 tests.
  - Browser plugin rendered check on `http://127.0.0.1:4180/`; default point size 8, bulk size 12, and selected point size 5 were reflected in the DOM/state with 0 console errors or warnings.
  - Browser plugin screenshot capture failed with `Page.captureScreenshot` timeout; fallback Playwright screenshot saved to `%TEMP%\mathgraph-point-size-qa.png`.
  - Fallback Playwright check confirmed point sizes `[8, 8]` after default creation, `[12, 12]` after bulk apply, and selected point size `[5]` after individual edit, with 0 console/page errors.
  - `git diff --check`; passed with CRLF normalization warnings only.

## Handoff

- Current status:
  - Style panel now has default and all-point point-size controls.
  - Selection panel now has point-size controls for a single selected point and selected point groups.
  - `SettingsManager` normalizes point sizes and applies batch sizing only to point-like objects.
  - Commit/push remains blocked by pre-existing unrelated staged/unstaged worktree changes.

---

## Status

- Task: Function-axis inferred fill regions
- State: Done
- Last updated: 2026-06-01

## Plan

1. Record the scoped function-axis fill behavior before implementation.
2. Extend fill inference to detect a clicked region bounded by a function graph and the coordinate axes.
3. Add focused regression coverage for first- and second-quadrant parabola-axis fills plus existing fill inference paths.
4. Run focused/full verification, update progress docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4

## Decisions

- Decision: Represent inferred function-axis fills with the existing `closedRegion` object and stored sample vertices.
- Reason: This preserves undo, save/load, and SVG export behavior without introducing a new curved-region primitive or leaving hidden helper-point objects behind.
- Decision: Limit this pass to regions using the coordinate axes and one explicit function graph.
- Reason: It directly addresses the reported x-axis/y-axis workflow while avoiding a broad and risky general region solver.

## Blockers

- Blocker: None.

## Verification

- Completed:
  - `node --check js\tools\FillTool.js`
  - `node --check js\objects\ClosedRegion.js`
  - `node --test tests\fill-tool.test.js`
  - Browser path attempted on `http://127.0.0.1:4183/`; page identity and console checks worked, but screenshot capture timed out and text entry was blocked by the Browser virtual clipboard.
  - Playwright fallback on `http://127.0.0.1:4183/`; created `y=-3/8x^2+6`, clicked the first-quadrant function-axis region, and confirmed one valid `closedRegion` with 34 stored sample vertices containing the clicked point.
  - Screenshot evidence: `C:\Users\pbj95\AppData\Local\Temp\mathgraph-function-axis-fill.png`.
  - `npm.cmd test`; passed with 144 tests.
  - `git diff --check`; passed with line-ending warnings only.

## Handoff

- Current status:
  - Function-axis fill inference is implemented for coordinate-axis regions bounded by one function graph.
  - The inferred region is stored as a sampled `closedRegion`, so undo/save/load work without creating hidden helper-point objects.

---

## Status

- Task: Stacked fraction rendering for function labels
- State: Done
- Last updated: 2026-06-01

## Plan

1. Record the scoped function-label fraction rendering issue before implementation.
2. Extend the canvas math-label tokenizer with a `fraction` part for simple slash fractions and `\frac{...}{...}` input.
3. Extend math-label measurement/rendering to draw numerator, bar, and denominator without changing stored expressions.
4. Add focused regression coverage for `y=-3/8x^2+6` and fraction drawing calls.
5. Run focused/full verification, update progress docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Add fraction support inside `Canvas` math-label rendering only.
- Reason: The reported problem is visual label formatting; expression parsing/evaluation and GraphA payloads should remain unchanged.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\core\Canvas.js`
  - `node --test tests\math-label-rendering.test.js`
  - `npm.cmd test`; passed with 144 tests.
  - In-app Browser loaded `http://127.0.0.1:4181/` and exercised the function tool, but screenshot capture failed with a CDP timeout.
  - Playwright fallback on `http://127.0.0.1:4181/` created `-3/8x^2+6`, confirmed parsed display parts include a `fraction` token and no slash text, captured `C:\Users\pbj95\AppData\Local\Temp\mathgraph-fraction-label-smoke.png`, and saw 0 console warnings/errors.
  - `git diff --check`; passed with line-ending warnings only.

## Handoff

- Current status:
  - Canvas math labels now render slash fractions such as `3/8` as stacked numerator/denominator fractions.
  - Function expressions, parsing, GraphA payloads, save/load, and evaluation remain unchanged.

---

## Status

- Task: Drag-box selection coverage for functions and solids
- State: Done
- Last updated: 2026-06-01

## Plan

1. Record the scoped selection behavior change before implementation.
2. Replace the drag-box selection predicate with a geometry-aware rectangle intersection check.
3. Add focused regression coverage for function, prism, pyramid, and crossing-segment selection.
4. Run focused/full verification, update progress docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4

## Decisions

- Decision: Keep the new logic inside `SelectTool` instead of changing object schemas.
- Reason: The issue is a selection predicate gap; rendering, persistence, and GraphA output should remain unchanged.

## Blockers

- Blocker: In-app Browser CUA drag replay did not reliably emit drag-box selection events, so final rendered drag verification used Playwright against the same local server.

## Verification

- Completed:
  - `node --check js\tools\SelectTool.js`
  - `node --test tests\select-tool-box-selection.test.js`
  - `npm.cmd test`; passed with 138 tests.
  - In-app Browser loaded `http://127.0.0.1:4177/`, confirmed the app title and console health, and verified click-selection of a function.
  - Playwright fallback on `http://127.0.0.1:4177/` verified drag-box selection for a function graph and for a prism edge, with no console issues.
  - `git diff --check` passed with line-ending warnings only.
  - Scoped `git diff --check` for this task's files also passed with line-ending warnings only.

## Handoff

- Current status:
  - Drag-box selection now uses geometry-aware rectangle intersection checks for visible functions, segments, lines/rays, circles, polygons, and solid projected edges.
  - Focused coverage includes a function graph, crossing segment, prism edge, and pyramid edge.

---

## Status

- Task: Axis number controls and function range limits
- State: Done
- Last updated: 2026-06-01

## Plan

1. Record the requested axis-number and function-range behavior before implementation.
2. Add canvas/settings support for axis-number visibility and fixed numeric intervals.
3. Add function `yMin`/`yMax` limits across rendering, selection UI, save/load, and SVG export.
4. Add focused regression coverage and run the useful project verification.
5. Update progress docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Keep axis visibility and axis-number visibility as separate settings.
- Reason: Teachers may want visible axes without numeric labels on exam-style diagrams.
- Decision: Treat fixed axis intervals as label/tick intervals, not as a grid-spacing redesign.
- Reason: The request is specifically about numbers on coordinate axes and existing grid behavior can remain automatic.
- Decision: Implement `yMin`/`yMax` as function range clipping.
- Reason: This matches the existing `xMin`/`xMax` domain-limiting workflow while avoiding a broader function-region feature.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\core\Canvas.js`
  - `node --check js\core\SettingsManager.js`
  - `node --check js\objects\Function.js`
  - `node --check js\main.js`
  - `node --test tests\axis-label-settings.test.js tests\function-range-limits.test.js`; passed with 7 tests.
  - `npm.cmd test`; passed with 141 tests.
  - Browser plugin smoke on `http://127.0.0.1:4182/`; app title was `그래프A Mk2.1`, settings controls were present, axis-number checkbox changed to off, fixed interval changed to `1`, function creation exposed both `x 범위` and `y 범위`, and console error/warn logs were empty.
  - Browser plugin screenshot capture returned no data, so Playwright screenshot fallback reproduced the same flow and saved `C:\Users\pbj95\AppData\Local\Temp\mathgraph-axis-function-range-qa.png`.
  - `git diff --check`; passed with line-ending warnings only.

## Handoff

- Current status:
  - Axis number visibility and fixed interval settings are implemented.
  - Function graphs now support editable and persisted `yMin`/`yMax` visible-range limits.

---

## Status

- Task: Math label minus sign rendering polish
- State: Done
- Last updated: 2026-06-01

## Plan

1. Record the scoped visual-rendering issue before implementation.
2. Normalize ASCII hyphen-minus to a mathematical minus glyph inside the canvas math-label display path.
3. Add focused regression coverage for unary/subtraction minus rendering and exponent parsing.
4. Run focused/full verification, update progress docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4

## Decisions

- Decision: Normalize only the display tokens inside `Canvas.parseMathExpression`.
- Reason: The user-visible issue is glyph rendering; stored function expressions and parser input should remain simple ASCII-compatible strings.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\core\Canvas.js`
  - `node --test tests\math-label-rendering.test.js`
  - `npm.cmd test`; passed with 142 tests.
  - Browser/Playwright visual check on `http://127.0.0.1:4177/`; rendered `y = -(x+2)^2 + 3` with math-label parts containing `\u2212`, no ASCII hyphen-minus, and no browser console messages.
  - `git diff --check`; passed with line-ending warnings only.

## Handoff

- Current status:
  - Canvas math labels now display ASCII `-` as a mathematical minus glyph while preserving stored expressions.
  - Visual evidence: `tmp/math-label-minus-visual.png`.

---

## Status

- Task: Label-only point body default option
- State: Done
- Last updated: 2026-05-31

## Plan

1. Record the label-only point scope before implementation.
2. Fix zero-sized point rendering so no point body or border is drawn.
3. Add a persisted default for newly created point bodies and wire it into point creation.
4. Add UI controls for the default and selected point body visibility.
5. Run focused/full verification, update docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Use `pointSize: 0` as the label-only representation.
- Reason: Existing save/load, GraphA operations, tests, and the global hide-points flow already understand point size, so this avoids a new object property.
- Decision: Keep labels visible when only the point body is hidden.
- Reason: The requested classroom/exam diagram behavior is "alphabet only," not full point-object invisibility.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check js\objects\GeoObject.js`
  - `node --check js\objects\Point.js`
  - `node --check js\core\Canvas.js`
  - `node --check js\core\ObjectManager.js`
  - `node --check js\core\SettingsManager.js`
  - `node --check js\main.js`
  - `node --test tests\point-label-only.test.js`; passed with 4 tests.
  - `npm.cmd test`; passed with 124 tests.
  - Browser/Playwright visual check on `http://127.0.0.1:4176/`; label-only default created a point with `pointSize: 0`, 0 changed pixels around the point body, and 163 changed pixels in the label area.
  - `git diff --check`; passed with line-ending warnings only.

## Handoff

- Current status:
  - `pointSize: 0` is now a real label-only point state.
  - The style panel has a persistent default option for label-only new points.
  - Individual point-like objects can toggle their point body from the selection properties panel.

---

## Status

- Task: Restore Vercel production deployment for generated icon update
- State: Done
- Last updated: 2026-05-31

## Plan

1. Inspect local Vercel link and recent deployments.
2. Reproduce the deploy issue from the current branch.
3. Add `.vercelignore` for local-only dependencies, PDFs, docs, tests, root tools, and generated artifacts.
4. Redeploy to production and verify the deployed site.
5. Update logs, commit, push, and report the deployment URL.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Add `.vercelignore` instead of moving the static output directory.
- Reason: The app is a static root-hosted site today; ignore rules fix the deployment payload without restructuring runtime paths.
- Decision: Anchor root-only ignore entries such as `/tools/`.
- Reason: Unanchored `tools/` also excluded `js/tools/`, which is part of the browser module graph.

## Blockers

- Blocker: None.
- Resolved: Initial direct production deploy failed because the upload payload exceeded Vercel's 100 MB file size limit.
- Resolved: The first ignore draft excluded `js/tools/`, causing production 404s until root-only patterns were anchored.

## Verification

- Completed:
  - `npx.cmd vercel ls`; latest deployment before this task was 47 days old.
  - `npx.cmd vercel deploy --prod --yes`; failed before `.vercelignore` with `File size limit exceeded (100 MB)`.
  - `npx.cmd vercel deploy --prod --yes`; succeeded after `.vercelignore`.
  - `npx.cmd vercel inspect https://mathgraph-lrd67ir7t-beomjinsouths-projects.vercel.app`; production deployment `dpl_42sqfKgzJwd95a23Yavr4srBfVit` was Ready and aliased to `https://mathgraph-five.vercel.app`.
  - Direct asset check confirmed `https://mathgraph-five.vercel.app/js/tools/Tool.js` returns 200 after anchoring `/tools/`.
  - Browser/Playwright production smoke confirmed 98 icon placeholders hydrate to 98 generated SVG icons, 0 missing SVG icons, and 0 Material Symbols font links.
  - Interaction proof passed on production: the functions submenu became active, and the left panel toggle changed from `left_panel_close` to `left_panel_open`.
  - `npm.cmd test`; passed with 120 tests.
  - `git diff --check`; passed with line-ending warnings only.

## Handoff

- Production alias: `https://mathgraph-five.vercel.app`.
- Latest production deployment: `https://mathgraph-lrd67ir7t-beomjinsouths-projects.vercel.app`.

---

## Status

- Task: Replace borrowed UI icons with generated MathGraph icon system
- State: Done
- Last updated: 2026-05-31

## Plan

1. Document the icon-system scope and acceptance criteria.
2. Add a generated SVG icon renderer with MathGraph-specific path shapes and compatibility helpers.
3. Remove Material Symbols font loading and hydrate existing icon placeholders with generated SVG.
4. Update dynamic icon code paths and command-palette icons to use the renderer.
5. Run tests and rendered browser QA, then update docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Use generated inline SVG icons rather than raster image files.
- Reason: The application icon surface needs sharp scaling, currentColor theming, hover/active state inheritance, and deterministic layout in dense toolbars.
- Decision: Keep the existing `material-symbols-outlined` class as a compatibility hook while replacing its rendering.
- Reason: Current HTML/CSS/JS already uses that selector widely; preserving it keeps the change narrowly scoped.

## Blockers

- Blocker: None.

## Verification

- Completed:
  - `node --check js\ui\IconRenderer.js`
  - `node --check js\main.js`
  - `node --check js\ui\CommandPalette.js`
  - `npm.cmd test`; passed with 120 tests.
  - Browser visual smoke on `http://127.0.0.1:4174/`; app loaded, 98 icon placeholders hydrated to 98 generated SVGs, 0 Material icon font links, 0 visible raw icon-name texts, and 0 console errors/warnings.
  - Browser interaction proof: the functions category activated the functions submenu, and the left panel toggle changed generated icon state from `left_panel_open` back to `left_panel_close`.
  - Playwright mobile-width check at 390x844: app loaded, 108 generated SVG icons after opening the command palette, 10 command-palette icons generated, 0 missing SVG icons, and 0 console errors/warnings.
  - `git diff --check`; passed with line-ending warnings only.

## Handoff

- Custom icon renderer: `js/ui/IconRenderer.js`.
- Local verification server used for QA: `http://127.0.0.1:4174/`.
- No Vercel deployment settings were changed.

---

## Status

- Task: Correct fresh CSAT live outputs 9 and 10
- State: Done
- Last updated: 2026-05-31

## Plan

1. Re-evaluate the saved 9th and 10th live outputs against the prompt intent.
2. Strengthen the Venn-style prompt/validation so center support points are hidden and visible labels are outside the overlap.
3. Strengthen the square-pyramid prompt/reference so the base is a clean rhombus projection and the section is readable.
4. Rerender references and rerun live generation only for prompts 9 and 10.
5. Update docs, run verification, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Treat the user's visual objection as valid even though the previous semantic checks passed.
- Reason: The project quality bar is prompt/result visual parity, not just schema/render success.

## Blockers

- Blocker: None currently.

## Verification

- Completed:
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs`
  - `node --test tests\live-openai-random-smoke.test.js`; passed with 59 tests.
  - local reference rerender for prompts 9 and 10; passed with 2 targets, 0 failures, and 0 browser console errors.
  - live rerun for prompts 9 and 10; passed with 2 targets, 0 failures, and 0 browser console errors.
  - opened corrected contact sheets and individual PNGs for visual inspection.
  - `npm.cmd test`; passed with 120 tests.
  - `git diff --check`; passed with line-ending warnings only.
  - narrowed secret-pattern scans for actual long `sk-...` tokens and the supplied key prefix outside `node_modules` and `.git`; no matches.

## Handoff

- Corrected final contact sheet: `tmp/live-openai-fresh-csat-drawing-smoke-20260531-final-contact-sheet-v2.png`
- Corrected live 9/10 report: `tmp/live-openai-fresh-csat-drawing-smoke-20260531-9-10-rerun1/live-openai-random-report.md`

---

## Status

- Task: Fresh CSAT-style live OpenAI drawing set
- State: Done
- Last updated: 2026-05-30

## Plan

1. Add a new non-overlapping prompt set with reference targets and prompt-local expectations.
2. Render local reference targets for the new set.
3. Run live OpenAI generation for the new set with the key only in process scope when `OPENAI_API_KEY` is present.
4. Open the contact sheet and individual PNGs, compare prompt vs output, and record findings.
5. Run focused/full verification, update progress docs, commit, and push.

## Progress Log

- [x] Step 1 planning started
- [x] Step 1 implementation
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5 local verification and docs

## Decisions

- Decision: Use a new prompt set instead of reusing `stress_novel`.
- Reason: The user explicitly clarified that the task is to generate new drawings.
- Decision: Keep the supplied key process-scoped for the one live run.
- Reason: The project must not persist or report secrets.

## Blockers

- Blocker: None for this pass.

## Verification

- Completed:
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs`
  - `node --test tests\live-openai-random-smoke.test.js`; passed with 56 tests.
  - local reference rendering for `LIVE_AI_PROMPT_SET=fresh_csat`; passed with 10 targets, 0 failures, and 0 browser console errors.
  - live OpenAI sliced generation for `LIVE_AI_PROMPT_SET=fresh_csat`; passed with 10 final outputs, 0 validation failures, and 0 browser console errors.
  - Opened the contact sheets and individual PNGs for prompt/result visual comparison.

  - `npm.cmd test`; passed with 117 tests.
  - `git diff --check`; passed with line-ending warnings only.
  - narrowed secret-pattern scan for actual long `sk-...` tokens outside `node_modules`, `tmp`, and `.git`; no matches.

Planned before final handoff:
  - Commit and push the completed changes.

## Handoff

- Current status:
  - `fresh_csat` is selectable from `LIVE_AI_PROMPT_SET`.
  - Local reference evidence is under `tmp/live-openai-fresh-csat-reference-20260530-final/`.
  - Live evidence is split across:
    - `tmp/live-openai-fresh-csat-drawing-smoke-20260530-part1/`
    - `tmp/live-openai-fresh-csat-drawing-smoke-20260530-part2/`
    - `tmp/live-openai-fresh-csat-drawing-smoke-20260530-part3/`
    - `tmp/live-openai-fresh-csat-drawing-smoke-20260530-part4/`
    - `tmp/live-openai-fresh-csat-drawing-smoke-20260530-boxplot-rerun2/`
  - Prompt/result comparison is documented in `docs/fresh-csat-drawing-audit.md`.
  - The supplied API key was used only as a process-scoped environment variable and was not written to source, reports, screenshots, or persistent environment settings.

---

## Status

- Task: Click-to-fill inferred vector regions
- State: Done
- Last updated: 2026-05-30

## Plan

1. Record the click-to-fill behavior scope and acceptance criteria before implementation.
2. Add a persisted vector region object for segment-loop fills.
3. Extend the fill tool so empty-area clicks infer segment loops or two-circle overlaps before falling back to whole-object fill.
4. Add focused regression tests for inferred regions, lens creation, direct fill preservation, and undo/load behavior.
5. Run verification, update progress docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Keep the feature vector-based rather than adding raster flood fill.
- Reason: MathGraph needs editable geometry, save/load, undo, SVG export, and AI/runtime compatibility.
- Decision: Scope automatic inference to visible segment loops and two-circle lens overlaps in this pass.
- Reason: These cover the common textbook-style enclosed regions while avoiding a risky general solver for arbitrary function-bounded regions.

## Blockers

- Blocker: None for local implementation.

## Verification

- Completed:
  - `node --check js\tools\FillTool.js`
  - `node --check js\objects\ClosedRegion.js`
  - `node --check js\core\ObjectManager.js`
  - `node --check js\main.js`
  - `node --test tests\fill-tool.test.js tests\lens-region.test.js`
  - Browser visual smoke at `tmp/click-fill-visual-smoke/click-fill-smoke.png`; created a filled segment-loop region and an auto lens region with 0 console errors.
  - `npm.cmd test`; passed with 113 tests.
  - `git diff --check`

## Handoff

- Current status:
  - The fill tool now creates a vector `closedRegion` when the user clicks inside a visible segment loop.
  - The fill tool now creates a `lensRegion` automatically when the user clicks inside the overlap of two intersecting circles.
  - Arbitrary function-bounded regions remain a future primitive/solver task rather than being approximated silently.

---

## Status

- Task: Generation-side root fix for AI diagram readability
- State: Done
- Last updated: 2026-05-30

## Plan

1. Move beyond validator-only rejection and add an app-owned post-generation quality pass.
2. Wire the pass into command-mode AI output and recreate-mode image analysis output without changing patch semantics.
3. Encode the known weak families: crowded labels, small right-angle markings, weak prism cross-sections, and cramped triangular solids.
4. Add focused flow tests, update durable docs, run verification, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4

## Decisions

- Decision: Add `DiagramQualityEnhancer` after model JSON parsing instead of relying only on prompt text or validators.
- Reason: The user-facing failure is a weak generated diagram, so MathGraph must own a correction step before the payload is accepted.
- Decision: Leave image patch mode unchanged.
- Reason: Selected-object patching must not create unrelated objects or move non-selected geometry while trying to improve layout.
- Decision: Respect coordinate-heavy prompts.
- Reason: When a user supplies several exact coordinates, automatic projection rewriting could violate the requested construction.

## Blockers

- Blocker: None.

## Verification

- Completed:
  - `node --check js\ai\DiagramQualityEnhancer.js`
  - `node --check js\ai\AIService.js`
  - `node --test tests\ai-flow.test.js`; passed with 33 tests.
  - JSON parse check for `.agents/skills/mathgraph-drawing/references/feature-manual.json` and `retrieval-index.json`; passed.
  - `npm.cmd test`; passed with 111 tests.
  - `git diff --check`; passed with line-ending warnings only.
  - Secret-pattern scan for actual `sk-proj-...` values outside `.git` and `node_modules`; no matches.

## Handoff

- Current status:
  - AI command results now pass through `DiagramQualityEnhancer` before returning to the UI.
  - OpenAI and Gemini recreate-mode image analysis results are enhanced before semantic intent validation.
  - Patch-mode image edits bypass the enhancer.
  - The enhancer adds label offsets for tangent/Euler-line crowding, large hidden-label `angleDimension` aids for right-angle requests, substantial prism cross-section layouts, and clearer triangular-pyramid-inside-triangular-prism projection.

---

## Status

- Task: Root-cause fix for live OpenAI drawing visual false positives
- State: Done
- Last updated: 2026-05-30

## Plan

1. Measure the saved live outputs that passed validation but failed stricter visual judgement.
2. Update the task docs with the root-cause scope and acceptance criteria.
3. Add prompt-local validators for visible label layout, right-angle marker readability, prism projection proportions, cross-section scale, and inner solid margins.
4. Add focused regression tests and revalidate the saved live result file without another API call.
5. Render local reference targets, run full verification, update docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Fix the live smoke acceptance gate instead of only rewriting the audit note.
- Reason: The root cause is that the validator accepted weak visuals; future runs need to reject and repair the same failure modes automatically.
- Decision: Keep the new checks prompt-local and opt-in through `expect`.
- Reason: Some diagrams legitimately need compact labels or small nested details, so global thresholds would create unrelated failures.
- Decision: Revalidate the saved live output file before any new API rerun.
- Reason: The user asked for root-cause prevention; proving the old false positives now fail is stronger and does not require exposing a key.

## Blockers

- Blocker: None for local validator and saved-result verification.

## Verification

- Completed:
  - `node --check tools\run-live-openai-random-drawing-smoke.mjs`
  - `node --test tests\live-openai-random-smoke.test.js`; passed with 52 tests.
  - `LIVE_AI_REVALIDATE_RESULTS=tmp/live-openai-csat-drawing-smoke-20260530/live-openai-random-results.json node tools\run-live-openai-random-drawing-smoke.mjs`; expected failure count 5 confirmed for the saved weak outputs.
  - `LIVE_AI_PROMPT_SET=stress_novel LIVE_AI_RENDER_REFERENCE_TARGETS=1 LIVE_AI_OUTPUT_DIR=tmp/live-openai-csat-reference-rootfix-20260530 node tools\run-live-openai-random-drawing-smoke.mjs`; passed with 10 targets, 0 failures, and 0 browser console errors.
  - JSON parse check for `.agents/skills/mathgraph-drawing/references/feature-manual.json` and `retrieval-index.json`; passed.
  - `npm.cmd test`; passed with 108 tests.
  - `git diff --check`; passed with line-ending warnings only.
  - Secret-pattern scan for actual `sk-proj-...` values outside `.git` and `node_modules`; no matches.

## Handoff

- Current status:
  - The saved live `prism_diagonal_cross_section` output had a prism projection of only 4.5 by 4.5 math units and a cross-section area ratio of about 0.08, so it is now rejected.
  - The saved live `triangular_pyramid_inside_triangular_prism` output placed the inner pyramid near the outer prism's left/bottom projection margins and is now rejected.
  - The saved live concentric, tangent, and Euler-line outputs are now rejected when the required angle aid or label offsets are missing.

---

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
