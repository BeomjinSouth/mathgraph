# Progress Log

## 2026-06-15

### Local solid fallback for nested rectangular prism request

#### Work completed

- Diagnosed why the AI chat returned `요청을 이해하지 못했습니다` for `직육면체 ABCD EFGH 내부에 정육면체가 작게 있는거 그려줘`.
- Added deterministic local fallback support for rectangular-prism/cube wording in `AIService`.
- Added nested-solid handling so an outer labeled rectangular prism plus a smaller inner cube are created as first-class `prism` objects.
- Added focused tests for the exact Korean prompt and a single labeled rectangular prism prompt.
- Updated `.agent/local_solid_fallback.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, `.agents/skills/mathgraph-drawing/references/feature-manual.json`, and `docs/ai-reference.md`.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-url-inventory.yaml`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, `docs/progress-log.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.
- Workflow skills: `.agents/skills/mathgraph-drawing/SKILL.md`, Playwright CLI skill, and Vercel deployments/verification guidance.
- Runtime/reference files: `js/ai/AIService.js`, `tests/ai-flow.test.js`, `.agents/skills/mathgraph-drawing/references/feature-manual.json`, and `docs/ai-reference.md`.

#### Verification

- Ran `node --check js\ai\AIService.js`; passed.
- Ran `node -e` JSON parse check for `.agents/skills/mathgraph-drawing/references/feature-manual.json`; passed.
- Ran `node --test tests\ai-flow.test.js`; passed with 41 tests.
- Ran `npm.cmd test`; passed with 171 tests.
- Ran `npm.cmd run vercel-build`; passed.
- Ran `git diff --check`; passed with line-ending warnings only.
- Local Playwright smoke on `http://127.0.0.1:4195/` confirmed the exact prompt creates 16 points and 2 prisms with no fallback failure text, console issues, or failed requests.
- Ran `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_Dtrvq375pkY1kES3g1626ESmr2vG` was created at `https://mathgraph-q5vqpqww0-beomjinsouths-projects.vercel.app`.
- Ran `npx.cmd vercel inspect https://mathgraph-q5vqpqww0-beomjinsouths-projects.vercel.app`; target was `production`, status was `Ready`, and `https://mathgraph-five.vercel.app` was attached.
- Checked `https://mathgraph-five.vercel.app/`; returned HTTP 200.
- Playwright production smoke on `https://mathgraph-five.vercel.app/` confirmed `window.app`, the exact prompt creates 16 points and 2 prisms, visible outer labels are `A` through `H`, and there are 0 console issues / 0 failed requests.

#### Deployment / Vercel

- Production alias: `https://mathgraph-five.vercel.app`.
- Production deployment URL: `https://mathgraph-q5vqpqww0-beomjinsouths-projects.vercel.app`.
- Vercel deployment ID: `dpl_Dtrvq375pkY1kES3g1626ESmr2vG`.
- No Vercel environment variables or project settings were changed.

#### Git / GitHub

- This entry is included in the local solid fallback commit for the task.
- Push target: `codex/ai-fallback-recovery`.
- Existing untracked `.agent/ai_reference_validation_retry.md` was left untouched.

## 2026-06-07

### Axis arrow reference-style refinement

#### Work completed

- Refined x/y coordinate-axis arrowheads to better match the user's textbook-style reference.
- Added `js/utils/AxisArrowStyle.js` so canvas axes, SVG export axes, and drag-area PNG overlay axes share one arrow metric set.
- Changed the arrowhead shape to a slimmer, longer filled tip placed one CSS pixel from the canvas or crop edge.
- Stopped each axis shaft at the arrowhead base so the line does not visually protrude through the filled head.
- Moved the `y` label slightly farther left to avoid crowding the arrowhead.
- Updated focused tests for canvas arrow draw calls and crop-edge export geometry.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, and `.agent/axis_number_math_labels.md`.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, `docs/progress-log.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, and `.agent/axis_number_math_labels.md`.
- Runtime files: `js/core/Canvas.js`, `js/main.js`, `js/utils/ExportArea.js`, `js/utils/AxisArrowStyle.js`, `tests/area-export.test.js`, and `tests/axis-label-settings.test.js`.
- Browser testing context: Browser plugin skill `control-in-app-browser`; Playwright was used for screenshot/download proof after the in-app Browser page-health check succeeded but tab screenshot capture timed out.

#### Verification

- Ran `node --check js\utils\AxisArrowStyle.js`; passed.
- Ran `node --check js\utils\ExportArea.js`; passed.
- Ran `node --check js\core\Canvas.js`; passed.
- Ran `node --check js\main.js`; passed.
- Ran `node --test tests\area-export.test.js tests\axis-label-settings.test.js`; passed with 13 tests.
- Ran `npm.cmd test`; passed with 169 tests.
- Ran `npm.cmd run vercel-build`; passed.
- Ran `git diff --check`; passed with line-ending warnings only.
- In-app Browser loaded `http://127.0.0.1:4194/`, confirmed title `그래프A Mk2.1`, app shell, canvas metrics, and 0 console warning/error logs; tab screenshot capture timed out.
- Playwright local smoke on `http://127.0.0.1:4194/` captured refined x/y arrow crops, dragged an area, downloaded a `230x235` PNG, confirmed crop-edge x/y arrow pixels, and reported 0 relevant console issues / 0 failed requests.
- Ran `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_GKw1cKu2vVLjKe3NpUkoNwCBMbyD` was created at `https://mathgraph-ovoenuvao-beomjinsouths-projects.vercel.app`.
- Ran `npx.cmd vercel inspect https://mathgraph-ovoenuvao-beomjinsouths-projects.vercel.app`; target was `production`, status was `Ready`, and `https://mathgraph-five.vercel.app` was attached.
- Checked `https://mathgraph-five.vercel.app/`; returned HTTP 200.
- Playwright production smoke on `https://mathgraph-five.vercel.app/` confirmed `window.app`, canvas presence, refined x/y arrow pixels, downloaded a `230x235` PNG with crop-edge arrow pixels, and reported 0 console issues / 0 failed requests.
- On 2026-06-07, reran `node --test tests\area-export.test.js tests\axis-label-settings.test.js`; passed with 13 tests.
- On 2026-06-07, reran `git diff --check`; passed with line-ending warnings only.
- On 2026-06-07, reran `npx.cmd vercel inspect https://mathgraph-five.vercel.app`; alias still resolved to production deployment `dpl_GKw1cKu2vVLjKe3NpUkoNwCBMbyD`, target `production`, status `Ready`.
- On 2026-06-07, rechecked `https://mathgraph-five.vercel.app/`; returned HTTP 200.

#### Deployment / Vercel

- Production alias: `https://mathgraph-five.vercel.app`.
- Production deployment URL: `https://mathgraph-ovoenuvao-beomjinsouths-projects.vercel.app`.
- Vercel deployment ID: `dpl_GKw1cKu2vVLjKe3NpUkoNwCBMbyD`.
- No Vercel environment variables or project settings were changed.

#### Git / GitHub

- This entry is included in the implementation/docs commit for the task.
- Push target: `codex/ai-fallback-recovery`.

## 2026-06-04

### Drag-area export axis arrowheads

#### Work completed

- Fixed drag-area export so cropped PNGs redraw x/y axis arrowheads and italic axis labels at the selected area's right/top edges when those axes cross the selected rectangle.
- Updated SVG area export so vector x/y axis endpoints are calculated against the crop viewBox instead of the full canvas bounds.
- Added a shared crop-axis geometry helper that omits crop-edge arrows for axes outside the exported area.
- Added focused regression coverage for crop-edge axis-arrow geometry.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, and `.agent/axis_number_math_labels.md`.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, `docs/progress-log.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, and `.agent/axis_number_math_labels.md`.
- Runtime files: `js/main.js`, `js/utils/ExportArea.js`, `tests/area-export.test.js`, `index.html`, and `js/tools/AreaExportTool.js`.
- Browser testing context: Browser plugin skill `control-in-app-browser`; Playwright was used for download verification because Codex In-app Browser does not support download-event interception.

#### Verification

- Ran `node --check js\utils\ExportArea.js`; passed.
- Ran `node --check js\main.js`; passed.
- Ran `node --test tests\area-export.test.js`; passed with 7 tests.
- Ran `npm.cmd test`; passed with 169 tests.
- Ran `npm.cmd run vercel-build`; passed.
- Ran `git diff --check`; passed with line-ending warnings only.
- In-app Browser loaded `http://127.0.0.1:4193/`, confirmed title `그래프A Mk2.1`, confirmed the app shell was present, captured screenshot evidence, and reported 0 console warning/error logs.
- Playwright local smoke on `http://127.0.0.1:4193/` dragged an export area, downloaded a `230x236` PNG, confirmed crop-edge x/y arrow pixels, confirmed SVG crop-edge arrow paths, returned to select mode, and reported 0 console issues / 0 failed requests.
- Ran `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_8kRi1ww7qGnRZqBAqjbRy4Tj8ePe` was created at `https://mathgraph-56oywn7xo-beomjinsouths-projects.vercel.app`.
- Ran `npx.cmd vercel inspect https://mathgraph-56oywn7xo-beomjinsouths-projects.vercel.app`; target was `production`, status was `Ready`, and `https://mathgraph-five.vercel.app` was attached.
- Checked `https://mathgraph-five.vercel.app/`; returned HTTP 200.
- Playwright production smoke on `https://mathgraph-five.vercel.app/` dragged an export area, downloaded a `230x236` PNG, confirmed crop-edge x/y arrow pixels, confirmed SVG crop-edge arrow paths, returned to select mode, and reported 0 console issues / 0 failed requests.

#### Deployment / Vercel

- Production alias: `https://mathgraph-five.vercel.app`.
- Production deployment URL: `https://mathgraph-56oywn7xo-beomjinsouths-projects.vercel.app`.
- Vercel deployment ID: `dpl_8kRi1ww7qGnRZqBAqjbRy4Tj8ePe`.
- No Vercel environment variables or project settings were changed.

#### Git / GitHub

- This entry is included in the implementation/docs commit for the task.
- Push target: `codex/ai-fallback-recovery`.

### Vercel production alias access check

#### Work completed

- Investigated a report that the Vercel-hosted site did not open.
- Confirmed the primary production alias `https://mathgraph-five.vercel.app/` returns HTTP 200 and serves `index.html`, `js/main.js`, `css/styles.css`, and `favicon.svg`.
- Confirmed the in-app Browser can load the production alias, render the first screen, and show no console warnings or errors.
- Identified that the latest direct deployment URL `https://mathgraph-1nitg9odn-beomjinsouths-projects.vercel.app/`, the project alias `https://mathgraph-beomjinsouths-projects.vercel.app/`, and the branch/team alias `https://mathgraph-beomjinsouth-beomjinsouths-projects.vercel.app/` return HTTP 401.
- Conclusion: the public URL to use is the primary production alias, while direct/team deployment URLs currently require Vercel authorization.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-url-inventory.yaml`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, and `docs/progress-log.md`.
- Local deployment files: `package.json`, `vercel.json`, and `.vercel/project.json`.
- Workflow skills: Build Web Apps frontend testing/debugging, Browser plugin control, and Vercel deployment/verification guidance.

#### Verification

- Ran `Invoke-WebRequest https://mathgraph-five.vercel.app/`; returned HTTP 200.
- Ran `Invoke-WebRequest https://mathgraph-five.vercel.app/js/main.js`; returned HTTP 200.
- Ran `Invoke-WebRequest https://mathgraph-five.vercel.app/css/styles.css`; returned HTTP 200.
- Ran `Invoke-WebRequest https://mathgraph-five.vercel.app/favicon.svg`; returned HTTP 200.
- Ran `npx.cmd vercel inspect https://mathgraph-five.vercel.app`; deployment `dpl_5vtm66WoSiA1AZsYa241aPF6GnjB` was `Ready`, target `production`, with the primary alias attached.
- Ran `npx.cmd vercel ls mathgraph`; recent deployments were listed as `Ready`.
- Ran in-app Browser smoke on `https://mathgraph-five.vercel.app/`; title was `그래프A Mk2.1`, the first screen rendered, and console warning/error count was 0.
- Ran standalone Playwright production smoke on `https://mathgraph-five.vercel.app/`; confirmed `window.app`, `prepareImageForAI`, canvas presence, 0 failed requests, and 0 console issues.
- Ran `Invoke-WebRequest` against direct/project/branch Vercel URLs; each returned HTTP 401.
- Attempted `npx.cmd vercel logs https://mathgraph-1nitg9odn-beomjinsouths-projects.vercel.app`; command timed out after 64 seconds without usable log output.

#### Deployment / Vercel

- No Vercel settings, environment variables, aliases, or deployments were changed.
- Public production alias remains `https://mathgraph-five.vercel.app/`.
- Direct/team Vercel URLs currently require authorization and should not be used as the public access URL unless deployment protection settings are changed in Vercel.

#### Git / GitHub

- This entry records the Vercel access diagnosis for the task.
- Push target: `codex/ai-fallback-recovery`.

## 2026-06-03

### Drag-area export and textbook-style fixed-grid axes

#### Work completed

- Added a toolbar `영역 저장` action and export-modal `영역 지정` action.
- Added `AreaExportTool`, which lets users drag a rectangle on the canvas and save only that screen area, then returns to the select tool.
- Added crop helpers that normalize/clamp drag rectangles and scale them for high-resolution PNG export.
- Reused the existing export settings for PNG/SVG format, PNG scale, background, grid, and axes.
- Updated canvas and SVG axis rendering to use filled arrowheads and italic serif `x`/`y` labels near the arrow tips.
- Changed fixed `축 숫자 간격` behavior so a numeric interval also fixes grid spacing while zooming; automatic mode remains zoom-adaptive.
- Added focused tests for area-export rectangle math, area-export tool completion, fixed grid spacing, and axis arrow/label rendering.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, `docs/progress-log.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, and `.agent/axis_number_math_labels.md`.
- Runtime files: `js/core/Canvas.js`, `js/main.js`, `js/tools/Tool.js`, `js/tools/AreaExportTool.js`, `js/utils/ExportArea.js`, `js/ui/CommandPalette.js`, `js/ui/IconRenderer.js`, `index.html`, and `css/styles.css`.
- Browser testing context: Browser plugin skill `control-in-app-browser`; Playwright fallback was used for download verification because Codex In-app Browser does not support download events.

#### Verification

- Ran `node --check js\core\Canvas.js`; passed.
- Ran `node --check js\main.js`; passed.
- Ran `node --check js\tools\AreaExportTool.js`; passed.
- Ran `node --check js\utils\ExportArea.js`; passed.
- Ran `node --check js\tools\Tool.js`; passed.
- Ran `node --check js\ui\CommandPalette.js`; passed.
- Ran `node --check js\ui\IconRenderer.js`; passed.
- Ran `node --test tests\axis-label-settings.test.js`; passed with 6 tests.
- Ran `node --test tests\area-export.test.js`; passed with 5 tests.
- Ran `node --test tests\function-label-drag.test.js tests\function-parser.test.js`; passed with 10 tests.
- Ran `npm.cmd test`; passed with 167 tests.
- Ran `npm.cmd run vercel-build`; passed.
- Ran `git diff --check`; passed with line-ending warnings only.
- In-app Browser loaded `http://127.0.0.1:4192/` with title `그래프A Mk2.1` and 0 console warning/error logs, but download events are not supported by Codex In-app Browser.
- Playwright local smoke on `http://127.0.0.1:4192/` set `축 숫자 간격` to `1`, zoomed in/out, confirmed `gridGap=1` and `axisGap=1`, sampled filled x/y arrowhead pixels, downloaded a dragged-area crop PNG `185x157`, returned to select mode, and had 0 failed requests.
- Ran `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_5vtm66WoSiA1AZsYa241aPF6GnjB` was created at `https://mathgraph-1nitg9odn-beomjinsouths-projects.vercel.app`.
- Ran `npx.cmd vercel inspect https://mathgraph-1nitg9odn-beomjinsouths-projects.vercel.app`; target was `production`, status was `Ready`, and `https://mathgraph-five.vercel.app` was attached.
- Checked `https://mathgraph-five.vercel.app/`; returned HTTP 200.
- Playwright production smoke on `https://mathgraph-five.vercel.app/` confirmed `window.app`, fixed interval `1`, `gridGap=1`, `axisGap=1`, area-export download `128x131`, return to select mode, 0 console issues, and 0 failed requests.

#### Deployment / Vercel

- Production alias: `https://mathgraph-five.vercel.app`.
- Production deployment URL: `https://mathgraph-1nitg9odn-beomjinsouths-projects.vercel.app`.
- Vercel deployment ID: `dpl_5vtm66WoSiA1AZsYa241aPF6GnjB`.
- No Vercel environment variables or project settings were changed.

#### Git / GitHub

- This entry is included in the implementation/docs commit for the task.
- Push target: `codex/ai-fallback-recovery`.

### Function input accepts y=

#### Work completed

- Added user-facing function input normalization so `y=x^2` is accepted in the function modal, algebra input, and function expression edit path.
- The runtime now stores the normalized right-hand-side expression such as `x^2`, while functions created from `y=...` display a `y = ...` label.
- Preserved named function inputs such as `g(x)=2x+1` and ordinary RHS-only expressions.
- Updated the function modal label, placeholder, and hint text so users can enter `y=...`, `f(x)=...`, or only the right-hand-side expression.
- Kept the AI/GraphA schema rule that provider-generated function expressions must omit `y=`.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, `docs/progress-log.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.
- Local workflow skills: Frontend Testing Debugging and Playwright.
- No OpenAI API behavior, model routing, Vercel settings, or external source facts were changed.

#### Verification

- Ran `node --check js\objects\Function.js`; passed.
- Ran `node --check js\ui\AlgebraInput.js`; passed.
- Ran `node --test tests\function-parser.test.js`; passed with 8 tests.
- Ran `npm.cmd test`; passed with 160 tests.
- Ran `npm.cmd run vercel-build`; passed.
- Ran `git diff --check`; passed with line-ending warnings only.
- Browser plugin tool discovery was attempted first, but the in-app Browser control tool was not exposed in this session; Playwright was used as fallback.
- Ran Playwright local smoke on `http://127.0.0.1:4191/`; the function modal accepted `y=x^2`, created one valid function with stored expression `x^2`, visible label `y = x^2`, selected state true, value at `x=2` equal to 4, 0 console issues, and 0 failed requests.
- Saved screenshot evidence at `C:\Users\pbj95\AppData\Local\Temp\mathgraph-y-equals-function-smoke.png`.

#### Deployment / Vercel

- Manual production deploy was not run from this dirty workspace because unrelated in-progress area-export/UI files are currently present and `npx.cmd vercel deploy --prod --yes` would deploy the full working tree, not only this scoped function-input fix.
- No Vercel settings or environment variables were changed.

#### Git / GitHub

- This entry is included in the scoped function-input commit for the task.
- Push target: `codex/ai-fallback-recovery`.

### Axis numbers render through math-label path

#### Work completed

- Changed coordinate-axis numeric labels and the origin `O` to render through the existing canvas math-label parser/renderer instead of plain `ctx.fillText()` UI text.
- Preserved fixed/automatic axis-number interval behavior, axis-number show/hide behavior, and tick-mark rendering.
- Added focused regression coverage that axis labels use the math font path and mathematical minus glyph rather than ASCII hyphen-minus.
- Added `.agent/axis_number_math_labels.md` as the scoped planning/result note for this behavior fix.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, `docs/progress-log.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.
- Local workflow skills: Frontend Testing Debugging, Playwright, and Browser plugin guidance.
- No OpenAI API behavior or external model facts were changed.

#### Verification

- Ran `node --check js\core\Canvas.js`; passed.
- Ran `node --test tests\axis-label-settings.test.js`; passed with 4 tests.
- Ran `node --test tests\math-label-rendering.test.js`; passed with 6 tests.
- Browser plugin path was checked first, but the required Node REPL JavaScript execution tool was not exposed in this session; Playwright was used as fallback.
- Ran Playwright local smoke on `http://127.0.0.1:4191/`; page title was `그래프A Mk2.1`, `window.app` was ready, axis labels rendered through the `Times New Roman` math font path, math minus code `8722` was present, ASCII hyphen code `45` was absent, origin `O` rendered through the math font path, and there were 0 console issues / 0 failed requests.
- Saved screenshot evidence at `C:\Users\pbj95\AppData\Local\Temp\mathgraph-axis-math-labels.png`.
- Ran `npm.cmd test`; passed with 160 tests.
- Ran `npm.cmd run vercel-build`; passed.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran `npx.cmd vercel inspect https://mathgraph-five.vercel.app`; production deployment `dpl_14iiHaoC4MGXCYxbWNks5ptXj7ad` was `Ready` with the primary alias attached.
- Checked `https://mathgraph-five.vercel.app/`; returned HTTP 200.
- Ran Playwright production smoke on `https://mathgraph-five.vercel.app/`; axis labels rendered through the math font path, math minus code `8722` was present, ASCII hyphen code `45` was absent, origin `O` rendered through the math font path, and there were 0 console issues / 0 failed requests.

#### Deployment / Vercel

- Production alias: `https://mathgraph-five.vercel.app`.
- Observed production deployment URL: `https://mathgraph-bc3cnd4qq-beomjinsouths-projects.vercel.app`.
- Observed production deployment ID: `dpl_14iiHaoC4MGXCYxbWNks5ptXj7ad`.
- Manual production deploy was not run from this task turn, but the Vercel production alias was inspected after the branch update and the live site contains the axis-number math-label behavior.
- No Vercel settings or environment variables were changed.

#### Git / GitHub

- This entry is included in the scoped axis-number math-label commit for the task.
- Push target: `codex/ai-fallback-recovery`.

### Function formula label dragging on Vercel

#### Work completed

- Confirmed the current Vercel production alias is deployed and `Ready`.
- Fixed function formula label dragging so the select tool only starts object dragging when the clicked object accepts the drag start.
- Updated function-label hit testing to use the rendered math-label measurement path when available, including fraction-aware bounds.
- Added focused regression coverage for dragging a function formula label and for clicking only the curve without entering a no-op drag state.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, `docs/progress-log.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.
- Browser plugin skill: `C:\Users\pbj95\.codex\plugins\cache\openai-bundled\browser\26.527.60818\skills\control-in-app-browser\SKILL.md`.

#### Verification

- Ran `npx.cmd vercel inspect https://mathgraph-five.vercel.app`; current production deployment was `Ready` with the primary alias attached before the fix.
- Ran `node --check js\objects\Function.js`; passed.
- Ran `node --check js\tools\SelectTool.js`; passed.
- Ran `node --test tests\function-label-drag.test.js`; passed with 2 tests.
- Ran `npm.cmd test`; passed with 156 tests.
- Ran `npm.cmd run vercel-build`; passed.
- Ran `git diff --check`; passed with line-ending warnings only.
- Browser plugin workflow was checked, but the required Node REPL execution tool was not exposed in this session; Playwright was used as the fallback browser verification path.
- Ran Playwright local smoke on `http://127.0.0.1:4188/`; the rendered function formula label moved from `(0, 0)` to `(2.4, 1.6)`, with 0 console issues and 0 failed requests.
- Ran `npx.cmd vercel deploy --prod --yes`; final production deployment `dpl_GsraWaC9WPUtvAKZm3jF8fbsB3uH` was created at `https://mathgraph-cgnkase6s-beomjinsouths-projects.vercel.app`.
- Ran `npx.cmd vercel inspect https://mathgraph-cgnkase6s-beomjinsouths-projects.vercel.app`; target was `production`, status was `Ready`, and `https://mathgraph-five.vercel.app` was attached.
- Checked `https://mathgraph-five.vercel.app/`; returned HTTP 200.
- Ran Playwright production smoke on `https://mathgraph-five.vercel.app/`; the rendered function formula label moved from `(0, 0)` to `(2.4, 1.6)`, with 0 console issues and 0 failed requests.

#### Deployment / Vercel

- Production alias: `https://mathgraph-five.vercel.app`.
- Final production deployment URL: `https://mathgraph-cgnkase6s-beomjinsouths-projects.vercel.app`.
- Final Vercel deployment ID: `dpl_GsraWaC9WPUtvAKZm3jF8fbsB3uH`.
- No Vercel environment variables or project settings were changed.

#### Git / GitHub

- This entry is included in the implementation/docs commit for the task.
- Push target: `codex/ai-fallback-recovery`.

### AI result model disclosure in chat

#### Work completed

- Added optional chat-message metadata rendering so AI drawing results can show the actual model used as a small secondary line.
- Connected successful text-command API results to the recorded request model.
- Connected successful image-analysis results to the accepted model metadata, including `initialModel -> model` when semantic repair escalation happens.
- Kept ordinary chat messages unchanged when no metadata is provided.
- Added low-emphasis `.message-meta` styling.
- Added focused coverage that `processCommand()` returns the actual OpenAI model on a successful API result.
- Updated `docs/ai-reference.md`, the MathGraph drawing feature manual, `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-url-inventory.yaml`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, `docs/progress-log.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, `.agents/skills/openai-vibecoding-context/SKILL.md`, `.agents/skills/mathgraph-drawing/SKILL.md`, and `docs/ai-reference.md`.
- Browser testing context: `C:\Users\pbj95\.codex\plugins\cache\openai-bundled\browser\26.527.60818\skills\control-in-app-browser\SKILL.md`.
- No OpenAI API schema or model-routing behavior was changed beyond surfacing the model metadata already returned by the app code.

#### Verification

- Ran `node --check js\main.js`; passed.
- Ran `node --check js\ai\AIService.js`; passed.
- Ran `node --test tests\ai-flow.test.js`; passed with 39 tests.
- Ran JSON parse validation for `.agents\skills\mathgraph-drawing\references\feature-manual.json`; passed.
- Ran in-app Browser smoke on `http://127.0.0.1:4187/`; page title was `그래프A Mk2.1`, the chat container was present, and console warning/error count was 0.
- Ran Playwright local smoke on `http://127.0.0.1:4187/`; `모델: gpt-5.4-mini -> gpt-5.5` rendered as a 10px metadata line, ordinary messages did not get metadata, and there were 0 console issues and 0 failed requests.
- Ran `npm.cmd test`; passed with 154 tests.
- Ran `npm.cmd run vercel-build`; passed.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_5heRB9Mp1k6aXCYdvnWjdp14jLFg` was created at `https://mathgraph-c46eexs7c-beomjinsouths-projects.vercel.app`.
- Ran `npx.cmd vercel inspect https://mathgraph-c46eexs7c-beomjinsouths-projects.vercel.app`; target was `production`, status was `Ready`, and `https://mathgraph-five.vercel.app` was attached.
- Checked `https://mathgraph-five.vercel.app/`; returned HTTP 200.
- Ran Playwright production smoke on `https://mathgraph-five.vercel.app/`; the model metadata line rendered, ordinary messages remained unchanged, and there were 0 console issues and 0 failed requests.

#### Deployment / Vercel

- Production alias: `https://mathgraph-five.vercel.app`.
- Production deployment URL: `https://mathgraph-c46eexs7c-beomjinsouths-projects.vercel.app`.
- Vercel deployment ID: `dpl_5heRB9Mp1k6aXCYdvnWjdp14jLFg`.
- No Vercel environment variables or project settings were changed.

#### Git / GitHub

- This entry is included in the implementation/docs commit for the task.
- Push target: `codex/ai-fallback-recovery`.

## 2026-06-02

### AI image preprocessing and model routing cost controls

#### Work completed

- Added safe image preprocessing for AI upload/paste requests.
- The app now keeps the original image for the visible chat preview, but sends a preprocessed image to OpenAI image analysis.
- Added conservative background-like margin trimming, with suspicious tiny crops rejected to avoid losing readable math context.
- Added oversized-image downscaling with a 1800 px long-edge target and a 1200 px readability floor; small/readable images are not upscaled or shrunk.
- Kept OpenAI image `detail: high` because exact graph/diagram reconstruction depends on small labels, ticks, axes, and thin strokes.
- Routed first OpenAI image attempts to `gpt-5.4-mini` and semantic repair/escalation to the configured stronger model or `gpt-5.5`.
- Added focused tests for preprocessing plans, non-shrink behavior, tiny-crop rejection, first-attempt model routing, and repair model escalation.
- Updated `docs/ai-reference.md`, the MathGraph drawing feature manual, `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-url-inventory.yaml`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, `docs/progress-log.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, `.agents/skills/openai-vibecoding-context/SKILL.md`, `.agents/skills/mathgraph-drawing/SKILL.md`, and `docs/ai-reference.md`.
- Official OpenAI docs:
  - `https://developers.openai.com/api/docs/guides/images-vision/`
  - `https://developers.openai.com/api/docs/guides/cost-optimization/`
  - `https://developers.openai.com/api/docs/models/`
  - `https://openai.com/api/pricing/`

#### Verification

- Ran `node --check js\ai\AIService.js`; passed.
- Ran `node --check js\main.js`; passed.
- Ran `node --test tests\ai-flow.test.js`; passed with 38 tests.
- Ran JSON parse validation for `.agents\skills\mathgraph-drawing\references\feature-manual.json` and `retrieval-index.json`; passed.
- Ran Browser plugin smoke on `http://127.0.0.1:4186/`; page title was `그래프A Mk2.1`, screenshot was captured, and console warning/error count was 0.
- Browser plugin could not execute the canvas-based preprocessing function because its evaluate surface is read-only for `document.createElement`; fallback Playwright covered that interaction.
- Ran Playwright local smoke on `http://127.0.0.1:4186/`; `window.app.prepareImageForAI()` processed a generated 3200x2400 diagram image into a cropped/resized 1800x1277 JPEG with 0 console issues and 0 failed requests.
- Ran `npm.cmd test`; passed with 153 tests.
- Ran `npm.cmd run vercel-build`; passed.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_HE1fF5dKKYi6tjnA8e1H19Lzff5D` was created at `https://mathgraph-gncgvbq52-beomjinsouths-projects.vercel.app`.
- Ran `npx.cmd vercel inspect https://mathgraph-gncgvbq52-beomjinsouths-projects.vercel.app`; target was `production`, status was `Ready`, and `https://mathgraph-five.vercel.app` was attached.
- Checked `https://mathgraph-five.vercel.app/`; returned HTTP 200.
- Ran Playwright production smoke on `https://mathgraph-five.vercel.app/`; `window.app` and `prepareImageForAI()` existed, a generated 3200x2400 image processed to 1800x1277, and there were 0 console issues and 0 failed requests.

#### Deployment / Vercel

- Production alias: `https://mathgraph-five.vercel.app`.
- Production deployment URL: `https://mathgraph-gncgvbq52-beomjinsouths-projects.vercel.app`.
- Vercel deployment ID: `dpl_HE1fF5dKKYi6tjnA8e1H19Lzff5D`.
- No Vercel environment variables or project settings were changed.

#### Git / GitHub

- Committed and pushed implementation/docs as `5f40a22` (`Add AI image cost controls`) on `codex/ai-fallback-recovery`.
- This Git/GitHub completion note is being recorded in a follow-up documentation commit.

### AI problem-situation graphing and full-photo diagram recreation

#### Work completed

- Added problem-statement detection in `AIService` so long textbook-style Korean problem text receives a problem-situation graphing instruction before the model call.
- Added guidance that full-problem text should generate a useful supporting graph/diagram without solving the problem or copying dense prose/answer choices.
- Strengthened image-only recreate prompts so whole photos can be used directly; the prompt now prioritizes the visible math diagram/graph/figure, relative geometry, labels, axes/ticks, intersections, tangencies, shading, and dashed/solid strokes.
- Kept image-plus-text as targeted patch mode, preserving selected-object/current-canvas priority.
- Updated AI chat greeting, input placeholder, upload tooltip, and recreate-mode loading/result messages.
- Updated `docs/ai-reference.md` plus the project-local MathGraph drawing reference files for problem-situation and full-photo modes.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-url-inventory.yaml`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, `docs/progress-log.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, `.agent/image_reference_patching.md`, `.agent/scene_graph_pipeline.md`, `docs/ai-reference.md`, and `.agents/skills/mathgraph-drawing/SKILL.md`.
- Official OpenAI docs:
  - `https://developers.openai.com/api/docs/guides/images-vision/`
  - `https://developers.openai.com/api/reference/resources/responses/methods/create`

#### Verification

- Ran `node --check js\ai\AIService.js`; passed.
- Ran `node --check js\main.js`; passed.
- Ran JSON parse validation for `.agents\skills\mathgraph-drawing\references\feature-manual.json` and `.agents\skills\mathgraph-drawing\references\retrieval-index.json`; passed.
- Ran `node --test tests\ai-flow.test.js`; passed with 35 tests.
- Ran in-app Browser smoke on `http://127.0.0.1:4185/`; page title was `그래프A Mk2.1`, AI chat opened, updated greeting/placeholder/upload title were present, screenshot was captured, and console warning/error count was 0.
- Ran `npm.cmd test`; passed with 150 tests.
- Ran `npm.cmd run vercel-build`; passed.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran `npx.cmd vercel deploy --prod --yes`; production deployment `dpl_AZRSRUJTGhA4UeznG1VcnfaPvXwj` was created at `https://mathgraph-nh3gffekl-beomjinsouths-projects.vercel.app`.
- Ran `npx.cmd vercel inspect https://mathgraph-nh3gffekl-beomjinsouths-projects.vercel.app`; target was `production`, status was `Ready`, and `https://mathgraph-five.vercel.app` was attached.
- Checked `https://mathgraph-five.vercel.app/`; returned HTTP 200.
- Ran Playwright production smoke on `https://mathgraph-five.vercel.app/`; `window.app` existed, AI chat toggled open, updated AI chat text was present, and there were 0 console issues and 0 failed requests.

#### Deployment / Vercel

- Production alias: `https://mathgraph-five.vercel.app`.
- Production deployment URL: `https://mathgraph-nh3gffekl-beomjinsouths-projects.vercel.app`.
- Vercel deployment ID: `dpl_AZRSRUJTGhA4UeznG1VcnfaPvXwj`.
- No Vercel environment variables or project settings were changed.

#### Git / GitHub

- Committed and pushed implementation/docs as `b85537a` (`Add AI problem and photo graphing modes`) on `codex/ai-fallback-recovery`.
- This Git/GitHub completion note is being recorded in a follow-up documentation commit.

## 2026-06-01

### Function unary-minus exponent precedence

#### Work completed

- Fixed the function parser so `-x^2` follows standard math precedence as `-(x^2)` instead of `(-x)^2`.
- Preserved explicit negative bases such as `(-x)^2` and negative exponents such as `2^-2`.
- Added focused parser regression coverage for the reported expression, explicit parentheses, negative exponents, and implicit multiplication with negative coefficients.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Verification

- Ran `node --check js\utils\Parser.js`; passed.
- Ran `node --test tests\function-parser.test.js`; passed with 4 tests.
- Ran `npm.cmd test`; passed with 148 tests.
- In-app Browser loaded `http://127.0.0.1:4184/`, created `-x^2 + 4` through the function tool UI, rendered a downward-opening parabola with label `f(x) = -x^2 + 4`, and reported 0 console warnings/errors.
- Ran `git diff --check`; passed with CRLF normalization warnings only.

#### Git / GitHub

- Parser and focused test changes are included in pushed commit `92ca060` (`Prepare MathGraph updates for deployment`).
- This documentation completion update is being committed separately.

#### Deployment / Vercel

- No Vercel settings or environment variables were changed for this bug fix.
- The current production alias remains `https://mathgraph-five.vercel.app`.

### Vercel production deployment for current updates

#### Work completed

- Consolidated the current MathGraph working-tree updates, including axis-number controls, function x/y range controls, point-size controls, math-label rendering updates, parser unary precedence handling, and related regression tests.
- Confirmed the local Vercel project link points to project `mathgraph` (`prj_72kqKNP31NaiZ86JHAhyRGF6kXIw`) under org/team `team_IisUu66EBjsNE4JkX4qO2UAZ`.
- Deployed the current production build to Vercel and aliased it to `https://mathgraph-five.vercel.app`.
- Updated `AGENTS.md` with the current Vercel linkage, production alias, environment-variable status, and deployment verification steps.
- Redeployed after the `AGENTS.md` update so the final non-ignored repository files are represented in production.

#### Verification

- Ran `npm.cmd test`; passed with 148 tests.
- Ran `npm.cmd run vercel-build`; passed (`Static site build step not required`).
- Ran `git diff --check`; passed with CRLF normalization warnings only.
- Ran targeted parser/function/fill/selection checks after an initial full-test parser-state failure; targeted checks passed with 13 tests and final full suite passed.
- Ran `npx.cmd vercel inspect https://mathgraph-k4g42o0vb-beomjinsouths-projects.vercel.app`; deployment `dpl_6dUDQJwh2bCnBvVRhoR7pf9eVHQE` was `Ready`.
- Checked `https://mathgraph-five.vercel.app/`; returned HTTP 200 with title `그래프A Mk2.1`.
- Checked `https://mathgraph-five.vercel.app/js/utils/Parser.js`; returned HTTP 200 and included `parseUnary`.
- Ran Vercel error-log scans with `npx.cmd vercel logs --level error --since 1h --environment production --no-branch --limit 20` and `npx.cmd vercel logs dpl_6dUDQJwh2bCnBvVRhoR7pf9eVHQE --no-follow --level error --limit 20`; no logs found.
- Ran a Playwright production smoke on `https://mathgraph-five.vercel.app/`; `window.app` was ready, 98 generated icon SVGs rendered, and there were 0 console issues and 0 failed requests.

#### Git / GitHub

- Committed the current app/test/documentation updates as `92ca060` (`Prepare MathGraph updates for deployment`).
- Committed the Vercel linkage documentation update as `cca3236` (`Record Vercel production deployment`).
- Pushed `codex/ai-fallback-recovery` to GitHub.

#### Deployment / Vercel

- Production alias: `https://mathgraph-five.vercel.app`.
- Production deployment URL: `https://mathgraph-k4g42o0vb-beomjinsouths-projects.vercel.app`.
- Vercel deployment ID: `dpl_6dUDQJwh2bCnBvVRhoR7pf9eVHQE`.
- No Vercel environment variables or project settings were changed.

### Function-axis inferred fill regions

#### Work completed

- Extended the fill tool so clicks inside a region bounded by one visible function graph, the x-axis, and the y-axis can create a filled vector region.
- Added stored-vertex support to `ClosedRegion`, allowing sampled function-axis fills to persist without creating hidden helper point objects.
- Kept existing direct fills, loose segment-loop inference, and two-circle lens inference behavior intact.
- Added focused regression coverage for the first- and second-quadrant regions of `y=-3/8x^2+6`.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Verification

- Ran `node --check js\tools\FillTool.js`; passed.
- Ran `node --check js\objects\ClosedRegion.js`; passed.
- Ran `node --test tests\fill-tool.test.js`; passed with 6 tests.
- In-app Browser loaded `http://127.0.0.1:4183/` with title `그래프A Mk2.1` and no console warnings/errors; screenshot capture timed out and text entry was blocked by the Browser virtual clipboard.
- Ran a Playwright fallback on `http://127.0.0.1:4183/`; created `y=-3/8x^2+6`, clicked the first-quadrant function-axis region, and confirmed one valid `closedRegion` with 34 stored sample vertices containing the clicked point.
- Screenshot evidence: `C:\Users\pbj95\AppData\Local\Temp\mathgraph-function-axis-fill.png`.
- Ran `npm.cmd test`; passed with 144 tests.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Git / GitHub

- Committed the fill-region code/test files only with `git commit --only js/objects/ClosedRegion.js js/tools/FillTool.js tests/fill-tool.test.js -m "Add function-axis fill inference"` (`aa2a302`).
- Pushed `codex/ai-fallback-recovery` to GitHub.
- This progress-log/documentation update remains unstaged because unrelated staged and unstaged documentation/UI changes already exist in the workspace.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Point size controls for default, bulk, and individual edits

#### Work completed

- Added style-panel point-size sliders for the default new-point size and all existing point-like objects.
- Added selection-panel point-size sliders for a single selected point-like object and selected point-like groups.
- Preserved `pointSize: 0` as the label-only point-body state while allowing visible points to be resized directly.
- Added `SettingsManager` helpers to normalize point sizes and apply batch point-size changes only to point-like objects.
- Added focused test coverage for default point size and bulk point-size application.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Verification

- Ran `node --check js\core\SettingsManager.js`; passed.
- Ran `node --check js\main.js`; passed.
- Ran `node --test tests\point-label-only.test.js`; passed with 5 tests.
- Ran `npm.cmd test`; passed with 144 tests.
- Browser plugin verification on `http://127.0.0.1:4180/` confirmed default size 8 for newly created points, bulk size 12 for point-like objects, selected point size 5, and 0 console warnings/errors.
- Browser plugin screenshot capture failed with `Page.captureScreenshot` timeout, so a Playwright fallback reproduced the flow and saved `C:\Users\pbj95\AppData\Local\Temp\mathgraph-point-size-qa.png`.
- Ran `git diff --check`; passed with CRLF normalization warnings only.

#### Git / GitHub

- Checked `git status --short --branch` and `git diff --cached --name-status`.
- Commit and push were not performed from this task turn because the workspace already contains unrelated staged and unstaged changes for axis labels, function range limits, function-axis fill regions, drag-box selection, and other tests.
- `git commit` / `git push` were intentionally skipped to avoid bundling unrelated staged work into the point-size change.
- Next action: commit or shelve unrelated work separately, then stage this point-size change intentionally and push.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Drag-box selection coverage for functions and solids

#### Work completed

- Replaced the drag-box selection path in `SelectTool` with geometry-aware rectangle intersection checks.
- Added selection coverage for visible function graph samples, crossing segments, infinite lines, rays, circles, polygons, and projected prism/pyramid edges.
- Preserved hidden-object behavior, shift-add selection, and existing click/drag flows.
- Added focused regression coverage for function graph, crossing segment, prism edge, and pyramid edge drag-box selection.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Verification

- Ran `node --check js\tools\SelectTool.js`; passed.
- Ran `node --test tests\select-tool-box-selection.test.js`; passed with 4 tests.
- Ran `npm.cmd test`; passed with 144 tests.
- In-app Browser loaded `http://127.0.0.1:4177/`, confirmed title `그래프A Mk2.1`, saw no console warnings/errors, and verified function click-selection. Browser CUA drag replay did not reliably trigger the drag-box path, so rendered drag verification used Playwright.
- Playwright fallback on `http://127.0.0.1:4177/` created `x^2` and a prism, then verified drag-box selection for the function graph and a prism edge with 0 console issues. Screenshot evidence: `C:\Users\pbj95\AppData\Local\Temp\mathgraph-drag-box-selection-qa.png`.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran scoped `git diff --check` for this task's files; passed with line-ending warnings only.

#### Git / GitHub

- Committed and pushed the isolated code/test change as `b54fd0e` (`Improve drag-box selection coverage`) on `codex/ai-fallback-recovery`.
- Pre-existing unrelated staged and unstaged changes were left untouched. The project docs are updated in the working tree, but not included in the pushed commit to avoid mixing those unrelated in-progress changes.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Axis numbers and function y-range controls

#### Work completed

- Added a settings-panel `축 숫자` toggle so coordinate-axis numbers can be hidden while axes and tick marks remain visible.
- Added `축 숫자 간격` with automatic spacing plus fixed intervals including `0.1`, `0.2`, `0.5`, `1`, `2`, `5`, and `10`.
- Added `yMin`/`yMax` function range limits alongside the existing `xMin`/`xMax` property controls.
- Applied `yMin`/`yMax` to canvas rendering, function hit testing, SVG export path generation, and JSON save/load.
- Added focused tests for fixed axis intervals, hidden axis numbers, y-range clipping, and function range persistence.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Verification

- Ran `node --check` for `js\core\Canvas.js`, `js\core\SettingsManager.js`, `js\objects\Function.js`, and `js\main.js`; all passed.
- Ran `node --test tests\axis-label-settings.test.js tests\function-range-limits.test.js`; passed with 7 tests.
- Ran `npm.cmd test`; passed with 141 tests.
- Browser plugin smoke on `http://127.0.0.1:4182/` confirmed the app title, settings controls, axis-number toggle, fixed interval selection, selected-function `x 범위`/`y 범위` rows, and 0 console error/warn logs.
- Browser plugin screenshot capture returned no data, so a Playwright screenshot fallback reproduced the same flow and saved `C:\Users\pbj95\AppData\Local\Temp\mathgraph-axis-function-range-qa.png`.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Stacked fraction rendering for function labels

#### Work completed

- Added fraction tokens to the canvas math-label parser for simple slash fractions such as `3/8` and LaTeX-style `\frac{...}{...}` groups.
- Rendered fraction tokens as centered numerator/denominator text with a horizontal fraction bar instead of drawing `/`.
- Preserved the stored function expression and evaluation path, so inputs such as `-3/8x^2+6` remain ASCII-friendly while the visible label becomes textbook-style.
- Kept the existing mathematical minus and exponent/subscript rendering behavior.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Verification

- Ran `node --check js\core\Canvas.js`; passed.
- Ran `node --test tests\math-label-rendering.test.js`; passed with 6 tests.
- Ran `npm.cmd test`; passed with 138 tests.
- In-app Browser loaded `http://127.0.0.1:4181/` and exercised the function tool, but screenshot capture failed with a CDP timeout.
- Ran a Playwright fallback smoke on `http://127.0.0.1:4181/`; created `-3/8x^2+6`, confirmed parsed display parts include a `fraction` token and no slash text, captured `C:\Users\pbj95\AppData\Local\Temp\mathgraph-fraction-label-smoke.png`, and saw 0 console warnings/errors.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Git / GitHub

- Commit and push were not performed because the workspace already contains unrelated staged and unstaged changes across docs, UI, settings, fill, selection, and point-size work. Next action: commit or shelve those unrelated changes separately, then stage this fraction-rendering change intentionally.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Math label minus sign rendering polish

#### Work completed

- Fixed the canvas math-label tokenization path so display-time ASCII hyphen-minus characters render as the mathematical minus glyph.
- Kept stored function expressions and label text unchanged, preserving parser, save/load, AI schema, and GraphA behavior.
- Added focused regression coverage for unary minus, subtraction, negative superscripts, and canvas text rendering.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Verification

- Ran `node --check js\core\Canvas.js`; passed.
- Ran `node --test tests\math-label-rendering.test.js`; passed with 3 tests.
- Ran `npm.cmd test`; passed with 142 tests.
- Ran browser/Playwright visual verification on `http://127.0.0.1:4177/`; `y = -(x+2)^2 + 3` rendered with `\u2212`, no ASCII hyphen-minus in parsed display parts, and 0 console warnings/errors.
- Saved visual evidence to `tmp/math-label-minus-visual.png`.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

## 2026-05-31

### Label-only point body default option

#### Work completed

- Fixed zero-sized point rendering so `pointSize: 0` suppresses both the point body and border while labels still render.
- Preserved `pointSize: 0` through point constructors and SVG export instead of falling back to visible radii.
- Added a persisted style-panel option, `새 점은 이름만 표시`, so new point-like objects can default to label-only rendering.
- Wired the existing "hide all points" state into future point creation and made that state persist.
- Added a selected-object point-body toggle for existing point-like objects.
- Added focused unit coverage for label-only defaults and canvas rendering.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Verification

- Ran `node --check` for `js\objects\GeoObject.js`, `js\objects\Point.js`, `js\core\Canvas.js`, `js\core\ObjectManager.js`, `js\core\SettingsManager.js`, and `js\main.js`; all passed.
- Ran `node --test tests\point-label-only.test.js`; passed with 4 tests.
- Ran `npm.cmd test`; passed with 124 tests.
- Ran a Playwright browser check on `http://127.0.0.1:4176/`; with the new default enabled, a new point had `pointSize: 0`, the point-center pixel-diff count was 0, and the label-area pixel-diff count was 163.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Vercel production deployment recovery for generated icons

#### Work completed

- Confirmed the generated icon commit had been pushed, but Vercel had not produced a recent production deployment.
- Ran `npx.cmd vercel ls` and found the previous production deployment was 47 days old.
- Tried `npx.cmd vercel deploy --prod --yes`; the first attempt failed because local-only artifacts made the upload about 665 MB, exceeding Vercel's 100 MB file size limit.
- Added `.vercelignore` to exclude local dependencies, VCS data, PDFs, tmp output, docs, tests, root tools, and agent workspace folders from Vercel upload.
- Fixed the ignore rules by anchoring root-only entries such as `/tools/`; the first unanchored `tools/` pattern also excluded runtime `js/tools/` modules.
- Redeployed production successfully and aliased it to `https://mathgraph-five.vercel.app`.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Findings

- Vercel was not changing because no automatic deployment had run from the pushed branch.
- Direct deploy needed `.vercelignore` because the repository root contains large local PDFs, `node_modules/`, `.git/`, and generated tmp artifacts.
- The first successful deploy still rendered no icon change because `js/tools/*.js` returned 404; anchoring `/tools/` fixed the browser module graph.

#### Verification

- Ran `npx.cmd vercel deploy --prod --yes`; succeeded with production URL `https://mathgraph-lrd67ir7t-beomjinsouths-projects.vercel.app`.
- Ran `npx.cmd vercel inspect https://mathgraph-lrd67ir7t-beomjinsouths-projects.vercel.app`; deployment `dpl_42sqfKgzJwd95a23Yavr4srBfVit` was Ready and aliased to `https://mathgraph-five.vercel.app`.
- Checked `https://mathgraph-five.vercel.app/js/tools/Tool.js`; returned 200 after anchoring the ignore rule.
- Browser/Playwright production smoke confirmed 98 icon placeholders, 98 generated SVG icons, 0 missing SVG icons, and 0 Material Symbols font links.
- Production interaction proof passed: the functions submenu became active, the left panel toggle changed from `left_panel_close` to `left_panel_open`, and no console/page/request errors were captured.
- Ran `npm.cmd test`; passed with 120 tests.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Deployment / Vercel

- Latest production alias: `https://mathgraph-five.vercel.app`.
- Latest production deployment: `https://mathgraph-lrd67ir7t-beomjinsouths-projects.vercel.app`.
- No Vercel project linkage or environment variables were changed.

### Generated MathGraph UI icon system

#### Work completed

- Replaced the external Google Material Symbols icon-font dependency with a project-owned generated inline-SVG icon renderer.
- Added `js/ui/IconRenderer.js` with MathGraph-toned icons built from points, strokes, axes, curves, panels, solids, and construction marks.
- Hydrated existing `material-symbols-outlined` placeholders in place so current HTML/CSS selectors and button states remain compatible.
- Updated dynamic icon paths for active tool display, sidebar panel toggles, hidden-point toggle, object list rows, and command-palette category icons.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Findings

- The existing UI used generic Material Symbols across toolbar, sidebars, canvas controls, modals, manual cards, object list, and command palette.
- Keeping the existing class as a compatibility hook avoided a broad markup rewrite while still removing the external icon font.
- Generated SVG icons inherit `currentColor`, so category colors, hover states, active glow, and dark glass theme styling remain consistent.

#### Verification

- Ran `node --check js\ui\IconRenderer.js`; passed.
- Ran `node --check js\main.js`; passed.
- Ran `node --check js\ui\CommandPalette.js`; passed.
- Ran `npm.cmd test`; passed with 120 tests.
- Browser visual smoke on `http://127.0.0.1:4174/` passed: app loaded with title `그래프A Mk2.1`, 98 icon placeholders hydrated to 98 generated SVGs, 0 Material icon font links, 0 visible raw icon-name texts, and 0 console errors/warnings.
- Browser interaction proof passed: the functions category activated the functions submenu, and the left panel toggle changed the generated icon state from `left_panel_open` to `left_panel_close` and back.
- Playwright mobile-width check at 390x844 passed: after opening the command palette, 108 generated SVG icons rendered, including 10 command-palette icons, with 0 missing SVG icons and 0 console errors/warnings.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.
- Local visual QA used an existing non-project server on 4173 as a negative check, then started this project on `http://127.0.0.1:4174/` for the actual verification.

### Fresh CSAT output 9/10 visual correction

#### Work completed

- Accepted the user's visual review that the previous 9th and 10th final outputs were not good enough despite passing schema/render validation.
- Strengthened `three_circle_pairwise_lenses` so center support points are hidden and O/P/Q labels are placed outside the circles through tiny label anchors.
- Added prompt-local validation for hidden support-point windows, external visible-label windows, and maximum visible label-anchor point size.
- Strengthened `square_pyramid_midsection` with exact rhombus-base and section point windows so it renders as a clean pyramid instead of a boxy projection.
- Reran local reference rendering for prompts 9 and 10 under `tmp/live-openai-fresh-csat-reference-20260531-9-10-v3`.
- Reran live OpenAI generation for prompts 9 and 10 under `tmp/live-openai-fresh-csat-drawing-smoke-20260531-9-10-rerun1`.
- Regenerated the final 10-image contact sheet under `tmp/live-openai-fresh-csat-drawing-smoke-20260531-final-contact-sheet-v2.png`.

#### Findings

- The previous 9th output was visually wrong because the center labels/dots sat inside the overlap region.
- The previous 10th output was visually weak because the projection read too much like a rectangular box under the pyramid.
- The corrected 9th output now hides support centers and keeps only external O/P/Q labels visible.
- The corrected 10th output now uses a rhombus-like base and a clearer internal section.

#### Verification

- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Ran `node --test tests\live-openai-random-smoke.test.js`; passed with 59 tests.
- Local reference rerender for prompts 9 and 10 passed with 2 targets, 0 failures, and 0 browser console errors.
- Live OpenAI rerun for prompts 9 and 10 passed with 2 targets, 0 failures, and 0 browser console errors.
- Opened the corrected 9/10 contact sheet and individual screenshots for manual visual comparison.
- Ran `npm.cmd test`; passed with 120 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran narrowed secret scans for actual long `sk-...` tokens and the supplied key prefix outside `node_modules` and `.git`; no matches.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

## 2026-05-30

### Fresh CSAT-style drawing prompt set

#### Work completed

- Added `fresh_csat` as a new selectable prompt set in `tools/run-live-openai-random-drawing-smoke.mjs`.
- Added 10 fresh reference targets covering rational functions, cubic extrema, crossed chords, altitude similarity, interval/ray number lines, piecewise area graphs, box-plot approximation, unit-circle projection, pairwise Venn lenses, and pyramid cross-sections.
- Rendered the fresh local reference contact sheet under `tmp/live-openai-fresh-csat-reference-20260530-final`.
- Ran live OpenAI sliced generation for all 10 fresh prompts with `gpt-5.4-mini`.
- Opened the contact sheets and individual PNGs for visual comparison, not just render-presence checks.
- Found two visual/semantic issues in the initial box-plot live result: duplicated `numberLine.customMarks`/point labels and a zero-length median segment.
- Added validator coverage for `numberLine.customMarks` labels and required nondegenerate vertical marker segments, then reran the box plot successfully under `tmp/live-openai-fresh-csat-drawing-smoke-20260530-boxplot-rerun2`.
- Added `docs/fresh-csat-drawing-audit.md` with prompt/live-result comparisons, evidence paths, the root-cause fix, and remaining approximation gaps.

#### Findings

- All 10 fresh local reference targets passed schema/reference/intent/runtime/semantic validation and browser rendering.
- All 10 final live OpenAI outputs passed schema/reference/intent/runtime/semantic validation and browser rendering.
- The visible live set is useful for additional CSAT/mock-exam categories beyond the previous `stress_novel` set.
- The chart-like outputs remain approximations because native box-plot primitives, exact open/closed endpoint styling, and exact three-circle common-region fills are not first-class yet.
- The supplied API key was used only as a process-scoped environment variable and was not written to repository files, generated reports, screenshots, or persistent environment settings.

#### Verification

- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Ran `node --test tests\live-openai-random-smoke.test.js`; passed with 56 tests.
- Ran `LIVE_AI_PROMPT_SET=fresh_csat` with `LIVE_AI_RENDER_REFERENCE_TARGETS=1`; passed with 10 targets, 0 failures, and 0 browser console errors.
- Ran live OpenAI generation in slices:
  - `tmp/live-openai-fresh-csat-drawing-smoke-20260530-part1`
  - `tmp/live-openai-fresh-csat-drawing-smoke-20260530-part2`
  - `tmp/live-openai-fresh-csat-drawing-smoke-20260530-part3`
  - `tmp/live-openai-fresh-csat-drawing-smoke-20260530-part4`
  - `tmp/live-openai-fresh-csat-drawing-smoke-20260530-boxplot-rerun2`
- Final live result: 10 outputs, 0 final validation failures, 0 browser console errors.
- Ran `npm.cmd test`; passed with 117 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran narrowed secret scans for actual long `sk-...` tokens outside `node_modules`, `tmp`, and `.git`; no matches.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### CSAT drawing audit final verification replay

#### Work completed

- Re-read the live OpenAI CSAT-style drawing audit, implementation notes, and saved render artifacts.
- Opened the saved live contact sheet and individual screenshots for all 10 `stress_novel` prompts.
- Rechecked that the weak saved live outputs are now rejected by the strengthened visual-intent gates instead of being accepted as merely rendered.
- Rendered a fresh local reference target sheet under `tmp/live-openai-csat-reference-rootfix-verify-20260530`.

#### Findings

- Direct visual passes: logistic midpoint/asymptotes, parabola focus/directrix/latus rectum, absolute-value cap region, feasible triangle, and pentagon/pentagram.
- The saved live concentric-sector, tangent, Euler-line, prism cross-section, and nested-solid outputs are drawable but visually weak, and the current validator correctly rejects those saved outputs.
- The current generation-side quality enhancer and prompt-local gates cover the observed root causes: label offsets, larger right-angle aids, broad cross-sections, and centered inner-solid projection.
- No additional source-code change was needed in this replay.

#### Verification

- Ran saved-result revalidation for `tmp/live-openai-csat-drawing-smoke-20260530/live-openai-random-results.json`; expected failure count 5 confirmed.
- Ran fresh local reference rendering for `LIVE_AI_PROMPT_SET=stress_novel`; passed with 10 targets, 0 failures, and 0 browser console errors.
- Ran `node --test tests\live-openai-random-smoke.test.js tests\ai-flow.test.js`; passed with 85 tests.
- Ran `npm.cmd test`; passed with 113 tests.
- Ran `git diff --check`; passed.
- Ran narrowed secret-pattern scans for actual long `sk-...` tokens outside `node_modules` and `.git`; no matches.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Click-to-fill inferred vector regions

#### Work completed

- Added `ClosedRegion` as a persisted runtime object for filled regions inferred from existing closed segment loops.
- Wired `ClosedRegion` into object type metadata, save/load restoration, dependency updates, render ordering, and SVG export.
- Extended the fill tool so a click inside a loose segment loop creates and fills a vector region automatically.
- Extended the fill tool so a click inside a two-circle overlap creates and fills a `lensRegion` before falling back to whole-circle fill.
- Preserved existing direct fill behavior for polygons, circles, sectors, circular segments, and existing lens regions.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, and `docs/ai-reference.md`.

#### Findings

- The previous fill implementation was already vector-based, but only for existing closed objects.
- The new behavior still avoids raster flood fill; created regions remain editable/persistent MathGraph objects.
- General function-bounded/implicit region solving remains out of scope for this pass and should become a dedicated first-class primitive/solver task.

#### Verification

- Ran `node --check js\tools\FillTool.js`; passed.
- Ran `node --check js\objects\ClosedRegion.js`; passed.
- Ran `node --check js\core\ObjectManager.js`; passed.
- Ran `node --check js\main.js`; passed.
- Ran `node --test tests\fill-tool.test.js tests\lens-region.test.js`; passed with 6 tests.
- Ran `npm.cmd test`; passed with 113 tests.
- Ran browser visual smoke through a temporary local server; screenshot `tmp/click-fill-visual-smoke/click-fill-smoke.png`, 0 console errors, `closedRegionValid:true`, `lensRegionValid:true`, fill colors `#f97316` and `#22c55e`.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Generation-side AI diagram quality enhancer

#### Work completed

- Added `js/ai/DiagramQualityEnhancer.js` as a deterministic post-generation pass for recurring textbook-diagram readability failures.
- Wired command-mode AI results through the enhancer in `AIService.processCommand`, including API and local fallback results.
- Wired recreate-mode image analysis results through the enhancer before semantic intent validation for OpenAI and Gemini image flows.
- Preserved selected-object patch behavior by bypassing the enhancer in patch mode.
- Encoded automatic corrections for crowded tangent/Euler labels, weak right-angle visibility, undersized prism cross-sections, and cramped triangular-pyramid-inside-triangular-prism layouts.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, `docs/ai-reference.md`, `docs/live-openai-csat-drawing-audit.md`, and the MathGraph drawing feature manual.

#### Findings

- The previous validator pass was a safety gate, not a generation fix: it could reject bad outputs but did not make common requests produce better diagrams automatically.
- The safer root boundary is now: model GraphA output -> app-owned diagram quality enhancer -> semantic/schema/render validation -> canvas application.
- Exact coordinate-heavy prompts are intentionally not projection-normalized, because user-supplied coordinates should remain authoritative.

#### Verification

- Ran `node --check js\ai\DiagramQualityEnhancer.js`; passed.
- Ran `node --check js\ai\AIService.js`; passed.
- Ran `node --test tests\ai-flow.test.js`; passed with 33 tests.
- Parsed `.agents/skills/mathgraph-drawing/references/feature-manual.json` and `retrieval-index.json`; passed.
- Ran `npm.cmd test`; passed with 111 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran a secret-pattern scan for actual `sk-proj-...` values outside `node_modules` and `.git`; no matches.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Root-cause fix for live OpenAI drawing visual false positives

#### Work completed

- Traced the strict visual-audit failures to missing prompt-local visual quality gates rather than API/model availability or canvas rendering failures.
- Strengthened `stress_novel` prompts for:
  - label offsets on crowded tangent and Euler-line labels,
  - a larger `angleDimension` aid for crowded right-angle marking,
  - broad prism projection proportions,
  - minimum cross-section polygon area/span,
  - inner solid projection size and margin inside an outer prism.
- Added prompt-local smoke validators for required `labelOffset`, visible right-angle marker geometry, minimum `angleDimension.arcRadius`, first-prism projection size/aspect, cross-section polygon scale, and inner-solid projection margins.
- Added regression tests that reject the exact classes of false positives observed in the saved live run.
- Updated the MathGraph drawing skill, feature manual, AI reference, and live audit note so future API prompts receive the same visual guardrails.

#### Findings

- The previous `prism_diagonal_cross_section` live output had an outer prism projection of 4.5 by 4.5 math units and a cross-section area ratio of about 0.08, so object presence alone was too weak.
- The previous `triangular_pyramid_inside_triangular_prism` live output had a narrow outer prism projection and a minimum inner-pyramid margin ratio of about 0.13, so containment alone was too weak.
- The previous concentric, tangent, and Euler-line outputs were structurally correct but lacked the explicit angle/label layout information needed for print-ready readability.

#### Verification

- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Ran `node --test tests\live-openai-random-smoke.test.js`; passed with 52 tests.
- Revalidated `tmp/live-openai-csat-drawing-smoke-20260530/live-openai-random-results.json`; expected failure count 5 confirmed for the previously weak saved outputs.
- Rendered strengthened local reference targets with `LIVE_AI_PROMPT_SET=stress_novel`, `LIVE_AI_RENDER_REFERENCE_TARGETS=1`, and `LIVE_AI_OUTPUT_DIR=tmp/live-openai-csat-reference-rootfix-20260530`; passed with 10 targets, 0 failures, and 0 browser console errors.
- Parsed `.agents/skills/mathgraph-drawing/references/feature-manual.json` and `retrieval-index.json`; passed.
- Ran `npm.cmd test`; passed with 108 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran a secret-pattern scan for actual `sk-proj-...` values outside `node_modules` and `.git`; no matches.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Live OpenAI CSAT-style drawing audit

#### Work completed

- Rendered local reference targets for the existing `stress_novel` prompt set as a comparison baseline for CSAT/mock-exam-style diagrams.
- Ran the real OpenAI Responses API drawing smoke path with the user-supplied key supplied only as process-scoped `OPENAI_API_KEY`.
- Rendered the live outputs in the MathGraph browser canvas and inspected the live contact sheet against the reference contact sheet.
- Added `docs/live-openai-csat-drawing-audit.md` with prompt/result comparisons, pass/caveat judgements, evidence paths, and remaining primitive/layout limitations.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Findings

- The live run selected `gpt-5.4-mini` from the API-visible model list.
- All 10 live outputs passed schema validation, reference validation, intent validation, runtime readability, semantic validation, and browser rendering.
- Browser rendering produced 0 console errors.
- Visual review accepted all 10 generated diagrams.
- Two production-quality caveats remain:
  - `external_point_two_tangents` is mathematically correct, but a worksheet that wants infinite tangent lines should say so explicitly because finite tangent segments are also a natural rendering.
  - `prism_diagonal_cross_section` and `triangular_pyramid_inside_triangular_prism` are valid and readable, but print-ready textbook proportions may need stronger aspect/projection wording.
- The pasted OpenAI API key was not stored in repository files, generated reports, screenshots, or docs.

#### Verification

- Ran local reference rendering:
  - `LIVE_AI_PROMPT_SET=stress_novel`
  - `LIVE_AI_RENDER_REFERENCE_TARGETS=1`
  - `LIVE_AI_OUTPUT_DIR=tmp/live-openai-csat-reference-20260530`
  - Result: 10 targets rendered, 0 failures, 0 browser console errors.
- Ran live OpenAI rendering:
  - `LIVE_AI_PROMPT_SET=stress_novel`
  - `LIVE_AI_OUTPUT_DIR=tmp/live-openai-csat-drawing-smoke-20260530`
  - `LIVE_AI_MAX_OUTPUT_TOKENS=14000`
  - `LIVE_AI_MAX_ATTEMPTS=4`
  - Result: 10 live outputs rendered, 0 failures, 0 browser console errors.
- Inspected:
  - `tmp/live-openai-csat-reference-20260530/contact-sheet.png`
  - `tmp/live-openai-csat-drawing-smoke-20260530/contact-sheet.png`
- Ran a secret-pattern scan for actual `sk-proj-...` values outside `node_modules` and `.git`; no matches.
- Ran `npm.cmd test`; passed with 100 tests.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Strict one-by-one visual re-audit and model availability check

#### Work completed

- Queried the live API model list for the supplied key and checked exact `gpt-5.5-mini` availability.
- Ran tiny `/v1/responses` calls for the available `gpt-5.5` and `gpt-5.4-mini` model IDs to confirm they are callable, not merely listed.
- Opened the 10 live rendered PNG outputs one by one and rejudged whether each drawing was actually made in a prompt-faithful, visually readable way.
- Updated `docs/live-openai-csat-drawing-audit.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md` with the stricter judgement.

#### Findings

- Exact `gpt-5.5-mini` is not visible in `/v1/models` for the supplied key, so it should be treated as unavailable.
- Visible `gpt-5.5` family models include `gpt-5.5`, `gpt-5.5-2026-04-23`, `gpt-5.5-pro`, and `gpt-5.5-pro-2026-04-23`.
- `gpt-5.5` and `gpt-5.4-mini` both succeeded on tiny Responses calls.
- Strict visual judgement:
  - Direct pass: `logistic_midpoint_asymptotes`, `parabola_focus_directrix_latus`, `absolute_plateau_cap_region`, `three_inequality_feasible_region`, `pentagon_pentagram_diagonals`.
  - Minor readability issues: `concentric_quarter_sector_wedge` has a hard-to-see right-angle marker, `external_point_two_tangents` has cramped `T2` label placement, and `triangle_euler_line` has crowded `O/G/H` labels.
  - Needs rerun or prompt strengthening: `prism_diagonal_cross_section` and `triangular_pyramid_inside_triangular_prism` are structurally created but not visually strong enough for print-ready textbook diagrams.

#### Verification

- API model list check completed without writing the key to files.
- Tiny Responses calls completed for `gpt-5.5` and `gpt-5.4-mini`.
- Opened and inspected all 10 live PNG screenshots under `tmp/live-openai-csat-drawing-smoke-20260530/screenshots/`.
- Ran `npm.cmd test`; passed with 100 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran a secret-pattern scan for actual `sk-proj-...` values outside `node_modules` and `.git`; no matches.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

## 2026-05-29

### Solid 3D broad case matrix and zero-error audit

#### Work completed

- Added `tools/render-solid3d-case-matrix.mjs`, a Playwright browser verification tool that creates varied local GraphA solid cases, renders each case in the real MathGraph canvas, inspects runtime solid objects, and saves screenshots/reports.
- The matrix currently covers 24 cases:
  - rectangular prisms in all four rear-face shift quadrants,
  - wide, tall, and skinny rectangular prisms,
  - triangular, pentagonal, and hexagonal prisms,
  - triangular, square, pentagonal, and hexagonal pyramids with varied apex positions,
  - a prism with diagonal/cross-section support geometry,
  - nested and separated multi-solid compositions.
- Extended `tests/solid3d-hidden-edges.test.js` so quick unit coverage checks all four rectangular-prism shift quadrants, polygonal prisms, and varied pyramids.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md` with the broader zero-error audit scope and evidence.

#### Findings

- The expanded matrix found no new Solid3D runtime errors after the previous prism convention fix.
- Every prism in the matrix kept `base`/front edges out of `_hiddenEdges`; hidden classifications were on rear/top or depth edges.
- Every browser-rendered case produced non-empty canvas output, no case console errors, and no invalid runtime objects.
- The pasted OpenAI API key was not used, stored, or echoed; this task was fully local runtime verification.

#### Verification

- Ran `node --check tools\render-solid3d-case-matrix.mjs`; passed.
- Ran `node --test tests\solid3d-hidden-edges.test.js`; passed with 6 tests.
- Ran `node tools\render-solid3d-case-matrix.mjs`; passed with 24 cases, 0 failures, 0 case console errors, and 0 invalid objects.
- Browser evidence:
  - Contact sheet: `tmp/solid3d-case-matrix/contact-sheet.png`.
  - Report: `tmp/solid3d-case-matrix/solid3d-case-matrix-report.md`.
- Ran `npm.cmd test`; passed with 100 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran a secret-pattern scan for actual `sk-*` key values outside `tmp`, `node_modules`, and `.git`; no matches.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

## 2026-05-28

### Solid 3D visible/hidden edge audit and prism correction

#### Work completed

- Rendered multiple local solid forms before and after the change: rectangular prisms with different rear-face shifts, a triangular prism, square pyramids, and a pentagonal pyramid.
- Found that `prism` was treating the shifted top face as viewer-facing, so ordinary textbook-style `ABCD-A'B'C'D'` rectangular prisms could show front/base edges as dashed.
- Updated `js/objects/Solid3D.js` so `prism.baseVertexIds` is the near/front face and `prism.topVertexIds` is the shifted rear face for hidden-edge classification.
- Kept existing `pyramid` behavior, which already dashed rear base/lateral edges in the sampled forms.
- Added render-call regression coverage in `tests/solid3d-hidden-edges.test.js` to confirm front/base prism edges render solid and rear/top hidden edges render dashed.
- Updated `docs/ai-reference.md`, `js/ai/AIService.js`, `tools/run-live-openai-random-drawing-smoke.mjs`, `.agents/skills/mathgraph-drawing/SKILL.md`, `.agents/skills/mathgraph-drawing/references/feature-manual.json`, `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Findings

- The issue was not line dash rendering itself; `canvas.drawSegment` correctly honored dashed options.
- The root cause was the prism visibility convention: face-front detection used the same view direction as pyramids, which made the shifted top face front-facing for prism notation.
- The user-pasted OpenAI API key was not used, stored, or echoed. Live external OpenAI drawing remains blocked until a key is supplied safely through `OPENAI_API_KEY`.

#### Verification

- Ran `node --check js\objects\Solid3D.js`; passed.
- Ran `node --check js\ai\AIService.js`; passed.
- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Parsed `.agents/skills/mathgraph-drawing/references/feature-manual.json` and `retrieval-index.json`; passed.
- Ran `node --test tests\solid3d-hidden-edges.test.js`; passed with 3 tests.
- Browser audit before fix: `tmp/solid3d-edge-audit-before/solid3d-edge-audit-before.png`.
- Browser audit after fix: `tmp/solid3d-edge-audit-after/solid3d-edge-audit-after.png`, 53 objects, 18,688 non-white pixels, 0 console errors.
- Rendered `LIVE_AI_PROMPT_SET=stress_novel` reference targets into `tmp/solid3d-reference-after`; passed with 10 rendered targets, 0 failures, and 0 browser console errors.
- Ran `npm.cmd test`; passed with 97 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran a secret-pattern scan for actual `sk-*` key values outside `tmp`, `node_modules`, and `.git`; no matches.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Novel stress OpenAI drawing set and reference targets

#### Work completed

- Added a third 10-prompt live smoke set named `stress_novel` to `tools/run-live-openai-random-drawing-smoke.mjs`.
- The new set avoids earlier prompt families and covers:
  - logistic curve with asymptotes and midpoint tangent,
  - parabola focus/directrix/latus rectum,
  - absolute-value plateau with capped region,
  - triangular feasible region from three inequalities,
  - concentric circles with outer quarter-sector fill,
  - two tangents from an external point to a circle,
  - triangle Euler line with circumcircle,
  - pentagon/pentagram diagonals,
  - rectangular prism with internal diagonal and cross-section,
  - triangular pyramid inside a triangular prism.
- Added deterministic `referencePayload` targets and `LIVE_AI_RENDER_REFERENCE_TARGETS=1` mode so intended visual targets can be rendered without an API call.
- Added prompt-local semantic validators for exact function expressions, required named segments, fixed circle radii, concentric circle radii, and collinear named construction points.
- Updated `docs/stress-novel-openai-drawing-audit.md`, `docs/ai-reference.md`, `.agents/skills/mathgraph-drawing/SKILL.md`, `.agents/skills/mathgraph-drawing/references/feature-manual.json`, `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Findings

- The current shell, user environment, and machine environment do not have `OPENAI_API_KEY`, so the live external OpenAI generation step is blocked unless the key is supplied safely through the environment.
- The user-pasted key was not written to repository files or command strings.
- The first local reference render exposed two self-check issues before final acceptance:
  - `absolute_plateau_cap_region` expected too many support points for its actual target.
  - `concentric_quarter_sector_wedge` wording could imply an exact ring-sector cutout, but MathGraph has no first-class `annularSector`.
- The prompt and docs now explicitly treat the concentric-sector case as "outer sector fill plus inner circle outline"; exact annular sectors remain a future feature candidate.

#### Verification

- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Ran `node --test tests\live-openai-random-smoke.test.js`; passed with 44 tests.
- Parsed `.agents/skills/mathgraph-drawing/references/feature-manual.json` and `retrieval-index.json`; passed.
- Ran local reference target rendering with `LIVE_AI_PROMPT_SET=stress_novel`, `LIVE_AI_RENDER_REFERENCE_TARGETS=1`, and `LIVE_AI_OUTPUT_DIR=tmp/live-openai-stress-novel-reference-targets`; passed with 10 rendered targets, 0 failures, and 0 browser console errors.
- Attempted the live external run with `LIVE_AI_PROMPT_SET=stress_novel`; blocked before API call with `OPENAI_API_KEY is required.`
- Ran `npm.cmd test`; passed with 96 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran a secret-pattern scan for `sk-proj-`, inline `OPENAI_API_KEY` values, and `Bearer sk-` outside `tmp`, `node_modules`, and `.git`; no matches.
- Reference contact sheet: `tmp/live-openai-stress-novel-reference-targets/contact-sheet.png`.
- Reference report: `tmp/live-openai-stress-novel-reference-targets/reference-target-report.md`.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### First-class lens region and vector fill tool

#### Work completed

- Added `lensRegion` as a first-class object for the exact filled overlap of two intersecting circles.
- Wired `lensRegion` into ObjectManager JSON restore, GraphA schema validation, AI patch application, scene graph compilation, SVG export, AI reference docs, and the MathGraph drawing skill manual.
- Added a vector fill tool with toolbar controls for fill color and opacity.
- Added circle fill rendering so the fill tool can fill circle interiors while normal circle selection still hits the boundary.
- Added batch history actions so one fill click can undo both color and opacity changes together.

#### Findings

- The earlier lens mismatch came from using polygon/circular-segment workarounds for a curved region.
- A true lens object needs the two source circle ids as context; the app can then recompute the two intersections and choose the inside arc from each circle.
- Paint-bucket behavior should stay vector-based in MathGraph. Raster flood fill would not preserve editable geometry, AI patchability, SVG export, or undo semantics.

#### Verification

- Ran `node --test tests\lens-region.test.js`; passed.
- Ran `node --test tests\fill-tool.test.js`; passed.
- Ran `node --test tests\scene-graph-compiler.test.js`; passed.
- Ran `node --test tests\ai-flow.test.js`; passed.
- Parsed `.agents/skills/mathgraph-drawing/references/feature-manual.json` and `retrieval-index.json`; passed.
- Ran browser visual smoke through a temporary local server; screenshot `tmp/lens-fill-visual-smoke/lens-fill-smoke-clean.png`, 0 console errors, `lensValid:true`, `lensPathPoints:129`, fill applied as `#22c55e` at opacity `0.55`, undo action type `batch`.
- Ran `node --check js\main.js`, `node --check js\ai\SceneGraphCompiler.js`, and `node --check js\ai\PatchApplier.js`; passed.
- Ran `npm.cmd test`; passed with 91 tests.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Recursive visual parity loop for stress-extra drawings

#### Work completed

- Rejudged the saved `tmp/live-openai-stress-extra-drawing-smoke-fixed2/` screenshots by visual intent rather than the previous all-pass validation status.
- Added `LIVE_AI_REVALIDATE_RESULTS` support to `tools/run-live-openai-random-drawing-smoke.mjs` so saved live result files can be checked against the current prompt-local expectations without another API call.
- Tightened the `stress_extra` prompt expectations for:
  - actual exponential/log intersection coordinate windows,
  - hidden lens helper points,
  - equal-radius lens circles and non-self-crossing/bounded lens polygons,
  - exact rational asymptote line equations,
  - renderable `angleDimension` helper rays,
  - unfilled construction-only polygons,
  - projected separation between multiple inner solids,
  - valid pyramid apex/base geometry and square-pyramid base counts,
  - true 3/3 triangular-prism vertex counts,
  - readable prism base/top projection order.
- Added visual guardrails to `js/ai/AIService.js`, `.agents/skills/mathgraph-drawing/references/feature-manual.json`, `.agents/skills/mathgraph-drawing/SKILL.md`, and `docs/ai-reference.md`.
- Added regression tests for the new visual-intent failure modes.
- Rendered a local target-reference contact sheet at `tmp/stress-extra-visual-target/reference-contact-sheet.png` for human comparison. This reference render is not a live OpenAI result.
- Updated `docs/stress-extra-openai-drawing-audit.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Findings

- The previous `fixed2` live run is not visually accepted under the stricter bar.
- Saved-result revalidation checked 10 outputs and rejected 6:
  - `exp_log_two_curve_window`: wrong left intersection point,
  - `two_circle_lens_region`: visible helper points,
  - `hexagon_diagonal_angle_web`: unintended polygon fill,
  - `two_transversals_angle_grid`: non-renderable angle marker,
  - `box_with_pyramid_and_inner_prism`: overlapping inner solids,
  - `double_pyramid_inside_box`: degenerate pyramid apex/base reuse.
- Recursive live reruns then found and fixed additional mismatches:
  - `two_circle_lens_region`: unequal circle radii, then self-crossing/out-of-bounds lens fill,
  - `quartic_double_well_tangents`: missing `x` on `tangentFunction`,
  - `rational_slant_asymptote`: two dashed lines existed but the vertical `x=2` line equation was wrong,
  - `double_pyramid_inside_box`: triangular pyramids appeared where square pyramids were requested,
  - `box_with_pyramid_and_inner_prism`: a prism could use twisted base/top vertex order.
- The final accepted live output is `tmp/live-openai-stress-extra-drawing-smoke-parity6/`.

#### Verification

- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Ran `node --test tests\live-openai-random-smoke.test.js`; passed with 39 tests.
- Ran saved-result revalidation with `LIVE_AI_REVALIDATE_RESULTS=tmp/live-openai-stress-extra-drawing-smoke-fixed2/live-openai-random-results.json`; expected failure result confirmed 6 rejected outputs and wrote `tmp/live-openai-stress-extra-drawing-smoke-fixed2/live-openai-random-revalidation.json`.
- Rendered the local visual target reference; all 10 payloads passed the strengthened local validators and browser-rendered with non-white pixels.
- Ran recursive external OpenAI live outputs through `tmp/live-openai-stress-extra-drawing-smoke-parity1/` to `tmp/live-openai-stress-extra-drawing-smoke-parity6/`; final `parity6` run selected `gpt-5.4-mini`, rendered all 10 outputs, and reported 0 failures / 0 browser console errors.
- Ran `npm.cmd test`; passed with 85 tests.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Additional stress OpenAI drawing audit and containment validation

#### Work completed

- Added a `stress_extra` prompt set to `tools/run-live-openai-random-drawing-smoke.mjs` with 10 additional complex drawing cases:
  - exponential/log function window,
  - quartic double-well graph with two tangents,
  - rational graph with vertical and slant asymptotes,
  - damped wave with envelope curves,
  - two-circle lens region,
  - hexagon diagonal/angle web,
  - two parallel lines cut by two transversals,
  - prism containing a pyramid and smaller prism,
  - double pyramid inside a prism,
  - triangular prism inside a square pyramid.
- Audited the saved live prompt/result evidence and added `docs/stress-extra-openai-drawing-audit.md`.
- Added prompt-local smoke validators for:
  - direct upper/lower lens endpoint points instead of duplicate generic circle-circle intersections,
  - inner solid vertices staying inside the first outer prism/pyramid projection.
- Strengthened nested-solid containment from axis-aligned bounds to a convex-hull projection check.
- Updated `docs/ai-reference.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Findings

- Schema/reference/render success was still too weak for branch-specific geometry and nested-solid intent.
- The two-circle lens case needs either direct endpoint points or a future first-class circle-circle intersection branch selector.
- Nested solids should be checked as 2D projection diagrams; a bounding box is too permissive for slanted prisms and pyramids.
- The hexagon case showed that validators can be over-strict when they demand explicit segment edges that are already owned by a first-class `polygon`.
- Dense drawings still require explicit label budgets and `showLabel:false` for helper objects.

#### Verification

- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Ran `node --test tests\live-openai-random-smoke.test.js`; passed.
- Ran `node tools\run-live-openai-random-drawing-smoke.mjs` with `LIVE_AI_PROMPT_SET=stress_extra`, `LIVE_AI_OUTPUT_DIR=tmp/live-openai-stress-extra-drawing-smoke-fixed2`, `LIVE_AI_MAX_OUTPUT_TOKENS=14000`, and `LIVE_AI_MAX_ATTEMPTS=4`; passed.
- The final live run selected `gpt-5.4-mini` and returned real response IDs:
  - `resp_0ebd1ab13c51b0f0016a171e5f89b4819a9fe2eb221fa0dd47`
  - `resp_0fba69a823e7ef56016a171e73c08c819a96f0c1dfec8a4187`
  - `resp_0c47a172267085dc016a171e7d4ca0819992f679975c6102de`
  - `resp_027ea2c9e559de3d016a171e88cc80819b84dee6a78f175981`
  - `resp_0c0bedfd2ac7b86b016a171e8deab8819b9b810876f8ee6643`
  - `resp_0c9c32c9a71ade13016a171ee36500819992ba28cc0d6b8303`
  - `resp_03a1b0766a750740016a171f207ab88198b0e2b80f632bef9d`
  - `resp_0f2becc1854b2b98016a171f3eba9c819899cc473882f78748`
  - `resp_042fa4ce6cc150f7016a171f615a84819ba95f196f3bc1041c`
  - `resp_04ac0aad26255582016a171f9189ec8199b6cd6baf38e260dd`
- Final live run failures: 0.
- Browser render console errors: 0.
- Visible-label counts by prompt order: 2, 3, 2, 0, 4, 6, 0, 0, 0, 0.
- Ran `npm.cmd test`; passed.
- Ran `git diff --check`; passed with line-ending warnings only.
- Output report: `tmp/live-openai-stress-extra-drawing-smoke-fixed2/live-openai-random-report.md`.
- Contact sheet: `tmp/live-openai-stress-extra-drawing-smoke-fixed2/contact-sheet.png`.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

## 2026-05-27

### Stress visual validation and label-overlap correction

#### Work completed

- Re-audited the 10 saved stress screenshots from `tmp/live-openai-stress-drawing-smoke-fixed/` against the rendered result, not just schema/semantic pass flags.
- Identified the common root cause: GraphA auto-generates labels for point/function/circle/arc/sector/polygon objects unless `showLabel:false` is set, so the previous checker undercounted labels when the model omitted an explicit `label` field.
- Tightened the stress prompts to hide helper labels and keep dense diagrams to short essential labels.
- Added prompt-local checks for:
  - maximum runtime-visible label count,
  - maximum visible label text length,
  - dashed asymptote lines,
  - required tangent x-values,
  - non-collapsed sector span.
- Added a canvas-level label-placement fallback that tracks labels drawn in the current frame and tries alternate offsets before drawing a new label.
- Updated the contact sheet and report generation to show the visible-label count for each output.
- Ran real external OpenAI Responses API calls using the user-provided key only through the process environment.
- Stored final evidence under `tmp/live-openai-stress-drawing-smoke-label-fixed2/`.

#### Saved-output audit

| Prompt | Previous judgement | Main issue | Final judgement |
| --- | --- | --- | --- |
| `multi_function_cubic_quadratic_line` | Partly wrong | Long point/function labels overlapped near the origin and curve intersections. | Good after short-label budget; 4 visible labels. |
| `trig_wave_family` | Partly wrong | Function labels overlapped the wave family near the origin. | Good after hiding function labels; 3 visible labels. |
| `rational_asymptote_window` | Good | Structure was already correct; label count is now checked and dashed asymptotes are enforced. | Good; 2 visible labels. |
| `absolute_parabola_shaded_region` | Partly wrong | Labels were busy and the filled lens is only a polygon approximation. | Acceptable with short labels; curved fill remains a polygon approximation. |
| `cubic_tangent_bundle` | Partly wrong | Function/contact labels crowded the tangent intersection area. | Good after short-label budget and required tangent x-values. |
| `circle_sector_chord_tangent_bundle` | Partly wrong | Runtime default labels appeared on circle/arc/sector and crowded point A. | Good after hiding non-point labels and requiring sector span. |
| `triangle_centers_and_altitude` | Mostly good | Helper labels could become crowded around H/midpoints. | Good after hiding helper labels; 4 visible labels. |
| `nested_rectangular_prisms` | Wrong | 16 vertex labels plus prism labels made the nested solid unreadable. | Good after requiring 0 visible labels. |
| `pyramid_inside_prism` | Partly wrong | Nine vertex labels cluttered the inner pyramid. | Good after limiting labels to 3. |
| `compound_nested_solid_frame` | Wrong | 19 vertex labels made the compound nested solid hard to read. | Good after requiring 0 visible labels. |

#### Verification

- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Ran `node --check js\core\Canvas.js`; passed.
- Ran `node --check js\main.js`; passed.
- Ran `node --test tests\live-openai-random-smoke.test.js`; passed with 23 tests.
- Ran `node tools\run-live-openai-random-drawing-smoke.mjs` with `LIVE_AI_PROMPT_SET=stress`, `LIVE_AI_OUTPUT_DIR=tmp/live-openai-stress-drawing-smoke-label-fixed2`, `LIVE_AI_MAX_OUTPUT_TOKENS=14000`, and `LIVE_AI_MAX_ATTEMPTS=4`; passed.
- The final live run selected `gpt-5.4-mini` and returned real response IDs:
  - `resp_0f401083e4143e9e016a1691e69d1081989780342ed8e9e43e`
  - `resp_0b476440582300dc016a1691f968c481999b55346b2bb19864`
  - `resp_0538e6a9f9308fd0016a1692034824819bb5848c7b0fd08e69`
  - `resp_0a9462f41feb06a2016a16920fc9f88198b85c955842553bd6`
  - `resp_0029533c25e40774016a169231d68c8198915c3f3531982f2b`
  - `resp_0d92a6344733e53a016a16924fa65081999a9f3d722c33cd02`
  - `resp_075ae763a85eceb1016a169277b71c819a8f82b7ecdce0e009`
  - `resp_0adb04340d898bd0016a1692a47964819b92e2c880ee725cac`
  - `resp_062cb5456d12a4f8016a1692bcdd4c819ab2a729a1e739bf5f`
  - `resp_03706ef79ab99795016a1692d6414c81988864c78d3ff0e19f`
- Final live run failures: 0.
- Browser render console errors: 0.
- Visible-label counts by prompt order: 4, 3, 2, 4, 3, 4, 4, 0, 3, 0.
- Ran `npm.cmd test`; passed with 69 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- Output report: `tmp/live-openai-stress-drawing-smoke-label-fixed2/live-openai-random-report.md`.
- Contact sheet: `tmp/live-openai-stress-drawing-smoke-label-fixed2/contact-sheet.png`.

#### Findings

- Schema/reference/render success is not enough for AI-generated math diagrams; visual usability needs prompt-local semantic gates for label density and important geometry invariants.
- Label overlap was not only a prompt problem. It came from a renderer default: many object families produce runtime labels automatically unless `showLabel:false` is set.
- The canvas fallback reduces ordinary label collisions, but dense AI-generated diagrams still need semantic limits so the model does not ask the renderer to place too many labels in the first place.
- `polygon` remains an approximation for regions bounded by function curves.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

## 2026-05-26

### Stress live OpenAI drawing set

#### Work completed

- Added a `stress` prompt set to `tools/run-live-openai-random-drawing-smoke.mjs` with 10 new live drawing cases:
  - cubic/quadratic/reference-line graph,
  - three trigonometric functions,
  - rational function with vertical/horizontal asymptotes,
  - absolute-value/parabola shaded region,
  - cubic graph with three tangents,
  - circle sector/chord/tangent/angle bundle,
  - triangle centers and altitude construction,
  - nested rectangular prisms,
  - pyramid inside a prism,
  - compound nested solid frame with two prisms and a pyramid.
- Added prompt-local `expect.minTypes` checks so each exploratory prompt can require its core object families.
- Added a live-smoke coordinate-range semantic gate to reject pixel-style point coordinates such as `120,260` that are valid GraphA but render outside the default MathGraph view.
- Added focused regression tests for prompt-local expectations and out-of-view coordinates.
- Ran real external OpenAI Responses API calls using the user-provided key only through the process environment.
- Stored final non-committed output evidence under `tmp/live-openai-stress-drawing-smoke-fixed/`.

#### Verification

- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Ran `node --test tests\live-openai-random-smoke.test.js`; passed with 19 tests.
- First live stress run with `LIVE_AI_PROMPT_SET=stress` rendered 9/10 outputs; `compound_nested_solid_frame` was schema/semantic valid but blank because generated points used pixel-style coordinates outside the default view.
- After adding the coordinate-range gate, reran `node tools\run-live-openai-random-drawing-smoke.mjs` with `LIVE_AI_PROMPT_SET=stress`, `LIVE_AI_OUTPUT_DIR=tmp/live-openai-stress-drawing-smoke-fixed`, `LIVE_AI_MAX_OUTPUT_TOKENS=14000`, and `LIVE_AI_MAX_ATTEMPTS=4`; passed.
- Ran `npm.cmd test`; passed with 65 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- The final live run selected `gpt-5.4-mini` and returned real response IDs:
  - `resp_03eed1366501c10c016a157017ca7481998b0aac896aa22d03`
  - `resp_0181691b8d7f37ef016a157029dbb8819b97e36bc1aec8d1c6`
  - `resp_0abc240be967f9dd016a157037b3a48198a10a76448626c091`
  - `resp_0a995e14545ef2be016a15704487e88199ac49882bc7211274`
  - `resp_0a0e476209c61866016a1570634f848198b49b59086f0dfe61`
  - `resp_062fff2febea9bb2016a157083ea34819996f4becfee6342a2`
  - `resp_092db428b89d54a9016a1570b4065081989d3a35c4a2a968c4`
  - `resp_0ca50f78dd4a203a016a1570c964f0819ab421ca0403149ef9`
  - `resp_0171c5a71d30047a016a1570fd9f04819ba4c29f8dd973e6a4`
  - `resp_08fe782623bdda61016a15710ebaf8819b92d9708acea62d0e`
- Final live run failures: 0.
- Browser render console errors: 0.
- Output report: `tmp/live-openai-stress-drawing-smoke-fixed/live-openai-random-report.md`.
- Contact sheet: `tmp/live-openai-stress-drawing-smoke-fixed/contact-sheet.png`.

#### Findings

- The stress set confirms the API/render path handles more complex function graphs and nested first-class solids than the earlier five-case set.
- Lightweight expectations are useful for exploratory prompt families, but they are still not a substitute for deep category-specific geometry checks.
- Some generated point labels are visually busy, especially in nested solids; the geometric objects render, but label placement is still a quality area for future UI/prompt tuning.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

## 2026-05-25

### Extended OpenAI drawing semantic correction

#### Work completed

- Re-analyzed the saved extended live OpenAI outputs after visual feedback:
  - incircle/right-angle markers were accepted even when triangle sides were infinite `line` objects or `rightAngleMarker` fields were wrong,
  - transversal angle markers were accepted with too few markers or overlapping arcs/degree labels,
  - histogram bars were accepted on half-offset intervals such as `[0.5,1.5]`,
  - the triangular prism was accepted when drawn as a hand-made dashed/solid segment set instead of a first-class `prism`.
- Tightened the extended smoke prompts for:
  - finite triangle sides and `rightAngleMarker.line1Id/line2Id`,
  - six separate angleDimension markers using true line/transversal intersections,
  - histogram bins exactly `[0,1]` through `[4,5]`,
  - triangular prisms represented by the runtime `prism` object.
- Added semantic validators for incircle contacts, parallel/transversal angles, histogram class boundaries, and triangular prism representation.
- Added angleDimension display controls (`arcRadius`, `showValue`, `markerCount`, `customText`, `labelFontSize`) to the OpenAI structured-output schema and patch application path.
- Updated the MathGraph drawing feature manual and AI reference docs for angleDimension display fields.
- Added focused regression coverage to `tests/live-openai-random-smoke.test.js`.
- Ran real external OpenAI Responses API calls using the user-provided key only through the process environment.
- Stored final non-committed output evidence under `tmp/live-openai-diverse-drawing-smoke-fixed5/`.

#### Verification

- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Ran `node --check js\ai\AIService.js`; passed.
- Ran `node --check js\ai\SchemaValidator.js`; passed.
- Ran `node --check js\ai\PatchApplier.js`; passed.
- Ran `node --test tests\live-openai-random-smoke.test.js`; passed with 16 tests.
- Ran `node tools\run-live-openai-random-drawing-smoke.mjs` with `LIVE_AI_PROMPT_SET=extended`, `LIVE_AI_OUTPUT_DIR=tmp/live-openai-diverse-drawing-smoke-fixed5`, `LIVE_AI_MAX_OUTPUT_TOKENS=14000`, and `LIVE_AI_MAX_ATTEMPTS=4`; passed.
- The final live run selected `gpt-5.4-mini` and returned real response IDs:
  - `resp_0e6781a2c7ffa167016a145f27020c8199a2a883a879be799e`
  - `resp_06f265007f6e62ca016a145f4b877c81999bd8d1f54eb4361b`
  - `resp_0dc72e979453e700016a145f86ec3081989c6f1d98193074c2`
  - `resp_0efdc3e4b8ea7dd4016a145fd8bd90819bae90904bb27542fa`
  - `resp_00bf3d79eb3d992b016a1460121f08819ab56cc518be7de6dc`
- Final live run failures: 0.
- Browser render console errors: 0.
- Output report: `tmp/live-openai-diverse-drawing-smoke-fixed5/live-openai-random-report.md`.
- Contact sheet: `tmp/live-openai-diverse-drawing-smoke-fixed5/contact-sheet.png`.

#### Findings

- The root cause was not the OpenAI API call itself; the pipeline accepted schema-valid drawings without enough category-specific semantic checks.
- The old checks did not verify whether angle markers were anchored on the actual intersection rays, whether class intervals matched the requested histogram boundary, or whether prism hidden edges were delegated to the runtime solid object.
- The patch applier also dropped newly added angleDimension display fields until this pass, so `showValue:false` and staggered `arcRadius` were not reflected on canvas before that fix.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Extended live OpenAI diverse drawing smoke run

#### Work completed

- Added an `extended` prompt set to `tools/run-live-openai-random-drawing-smoke.mjs` for diverse live GPT drawing checks:
  - triangle incircle with contact radii,
  - parallel lines with a transversal and angle markers,
  - absolute-value function plus line and shaded region,
  - histogram/frequency-polygon approximation,
  - triangular prism with hidden edges.
- Added `LIVE_AI_PROMPT_SET` support and included the prompt set in generated reports.
- Added parse-failure retry behavior so truncated or incomplete JSON responses can be resent for a shorter corrected GraphA payload.
- Ran a real external OpenAI Responses API call set using the user-provided key only through the process environment.
- Stored non-committed output evidence under `tmp/live-openai-diverse-drawing-smoke/`.

#### Verification

- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Ran `node --test tests\live-openai-random-smoke.test.js`; passed with 5 tests.
- Ran `node tools\run-live-openai-random-drawing-smoke.mjs` with `LIVE_AI_PROMPT_SET=extended`, `LIVE_AI_OUTPUT_DIR=tmp/live-openai-diverse-drawing-smoke`, and `LIVE_AI_MAX_OUTPUT_TOKENS=14000`; passed.
- Ran `npm.cmd test`; passed with 51 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- The live run selected `gpt-5.4-mini` and returned real response IDs:
  - `resp_0729d6b9e674613e016a1453dac0b0819985bc54a8317c1eec`
  - `resp_0e34cb0b4044b7bd016a14540adbe081988f6b62d0775df309`
  - `resp_07c0c373715da4ea016a14543609cc81998c7652d388f8803c`
  - `resp_03723af14415bc6d016a1454944700819ba2d60e979cdc1c09`
  - `resp_02a1d9f203dbf66c016a1454c1d79c8199ba5bdff1090c3db1`
- Final live run failures: 0.
- Browser render console errors: 0.
- Output report: `tmp/live-openai-diverse-drawing-smoke/live-openai-random-report.md`.
- Contact sheet: `tmp/live-openai-diverse-drawing-smoke/contact-sheet.png`.

#### Findings

- The same API key now authenticated and completed the live request set.
- The histogram prompt initially produced truncated JSON under the default token cap, so the rerun used a larger output token cap and the script now treats parse failures as retryable.
- All five outputs rendered. Visual quality is mixed: the histogram and triangular prism are clear, the absolute-value graph is usable, while the incircle sample uses infinite side lines and the parallel-line sample has label overlap.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Random OpenAI drawing smoke semantic recovery

#### Work completed

- Re-analyzed the saved live OpenAI random drawing evidence after user feedback that sample 2 did not visibly draw the sector and sample 3 did not draw the quadratic graph.
- Identified sample 2's root cause: the generated `pointOnCircle` used `t: 0.75`, but MathGraph runtime only uses `angle` for circle-bound points, so B fell back to angle `0`, overlapped A, and collapsed the sector to zero area.
- Identified sample 3's root cause: the generated function expression was `y=x^2-4`, but MathGraph functions require the right-hand side only, so the function parser rejected it and the parabola did not render.
- Updated `SchemaValidator` to reject `pointOnCircle.t`, `pointOnLine.angle`, and function expressions that include `y=`.
- Updated `AIService` prompt guidance so OpenAI text requests explicitly use `pointOnCircle.angle` and right-hand-side-only function expressions.
- Updated `tools/run-live-openai-random-drawing-smoke.mjs` so future live random drawing runs reject/retry degenerate circle-sector outputs and graph outputs that do not contain a real RHS-only quadratic `function` plus `tangentFunction`.
- Added `tests/live-openai-random-smoke.test.js` covering the two observed failure modes and valid corrected shapes.
- Updated `.agent/implementation_tracking.md` and `docs/ai-reference.md`.

#### Verification

- Ran `node --check js\ai\SchemaValidator.js`; passed.
- Ran `node --check js\ai\AIService.js`; passed.
- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Ran `node --test tests\live-openai-random-smoke.test.js`; passed with 5 tests.
- Ran `npm.cmd test`; passed with 51 tests.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Findings

- The earlier live run proved external API plumbing and canvas application, but the acceptance gate was still too weak for semantic math quality.
- The corrected gate now fails before screenshot acceptance when a sector exists only as a zero-area object or when a requested quadratic is represented by invalid/missing function geometry.
- A new external OpenAI rerun is still blocked until a fresh valid API key is supplied; the previously supplied key returned 401 `Incorrect API key` on the latest check.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Live OpenAI random drawing smoke test

#### Work completed

- Added `tools/run-live-openai-random-drawing-smoke.mjs` for a reusable live OpenAI Responses API smoke test that sends arbitrary Korean MathGraph drawing prompts, validates returned GraphA `operations[]`, applies them to the real browser canvas, and stores non-committed evidence under `tmp/live-openai-random-drawing-smoke/`.
- Ran a real external OpenAI API test with the API key supplied only through the process environment.
- The live model check selected `gpt-5.4-mini`.
- Sent five arbitrary drawing requests: triangle with circumcircle and altitude, circle sector with tangent, quadratic/line graph, radical number-line construction, and square pyramid.
- Stored screenshots and a local contact sheet under `tmp/live-openai-random-drawing-smoke/`.
- Tightened the smoke script after the first run so future runs reject function expressions that include `y=` and generate contact sheets without blocked local file URLs.
- On a follow-up request to rerun with different shapes, re-read the previous prompt/result evidence and attempted to verify the same user-provided key before sending new prompts.

#### Verification

- Ran `node tools\run-live-openai-random-drawing-smoke.mjs` with `OPENAI_API_KEY` supplied only through the process environment.
- `GET https://api.openai.com/v1/models` succeeded during the first run.
- `POST https://api.openai.com/v1/responses` returned real response IDs for all five requests:
  - `resp_04ab4c6dd7b88a53016a13cd552f808198ac5d57f9a408fdb9`
  - `resp_01f97150706faf06016a13cd84f7f8819aa23a6bb3c93cc4d1`
  - `resp_0da826622525f7dc016a13cd9355ac81989953cfa8393539f9`
  - `resp_04f6002445d87a56016a13cdbe2f04819abcd5359892f02599`
  - `resp_011d1efb7c22e2f6016a13cdcbc1348198963262a74443770b`
- First-run payloads all passed `SchemaValidator.validate()`, `SchemaValidator.validateReferences()`, and recreate intent operation-budget validation.
- First-run payloads all rendered as non-empty MathGraph canvas drawings with 10-17 runtime objects per sample.
- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- A second live rerun after script tightening was blocked because the supplied API key returned `Incorrect API key`; the key was not written to repository files or reports.
- Follow-up `GET https://api.openai.com/v1/models` check also returned 401 `Incorrect API key`, so no additional external GPT drawing calls were made.

#### Findings

- The external GPT/OpenAI API plumbing works end to end for arbitrary MathGraph drawing prompts when the key is valid.
- Schema/reference/render success does not guarantee mathematical quality. The first graph sample rendered but exposed a function-expression issue (`y=` included in an expression), so the new smoke script now rejects that class before browser rendering.
- The generated figures are usable smoke-test sketches, not exact mathematical proof-quality diagrams. Label overlap and approximate constructions remain visible in some outputs.
- A fresh valid API key is required before rerunning the alternate-shape smoke set.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Scene graph based image/PDF reconstruction foundation

#### Work completed

- Added `.agent/scene_graph_pipeline.md` to record the root architecture shift: image/PDF crop -> high-level math scene graph -> deterministic GraphA compiler -> schema/reference/semantic/render validation.
- Added `js/ai/SceneGraphCompiler.js` for compiling scene nodes and relations into app-owned GraphA `operations[]`.
- Added warnings for unsupported first-class scene nodes such as cylinder, cone, sphere, native histogram/scatter/box plot, and standalone text labels instead of silently emitting invalid or misleading GraphA.
- Added `tests/scene-graph-compiler.test.js` covering circle/sector scenes, graph plus number-line scenes, numeric-radius circle support points, unsupported primitives, and strict selected patch behavior.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, `.agents/skills/mathgraph-drawing/SKILL.md`, `.agents/skills/mathgraph-drawing/references/feature-manual.json`, `.agents/skills/mathgraph-drawing/references/retrieval-index.json`, and `docs/ai-reference.md`.

#### Verification

- Ran `node --check js\ai\SceneGraphCompiler.js`; passed.
- Ran `node --test tests\scene-graph-compiler.test.js`; passed with 5 tests.
- Ran JSON parse check for `feature-manual.json` and `retrieval-index.json`; passed.
- Ran `npm.cmd test`; passed with 46 tests.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Findings

- The previous guardrail work was necessary but not sufficient: it catches bad low-level operations after the model has already chosen them.
- The new root boundary is a high-level scene representation that MathGraph owns and compiles deterministically.
- This pass creates the compiler foundation but does not yet switch every live OpenAI image/PDF recreate call to scene graph mode.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### PDF/OpenAI semantic quality gate and JSON manual reuse

#### Work completed

- Added `js/ai/SemanticValidator.js` for category-specific semantic checks across the 12 PDF-derived sample categories.
- Updated `tests/pdf-ai-drawing-samples.test.js` so curated PDF fixtures must pass schema, reference, and semantic checks.
- Corrected the triangle-incircle fixture so contact points are actually tangent to the incircle.
- Updated `tools/run-live-openai-pdf-ai-samples.mjs` to inject the JSON manual/retrieval prompt reference, attach available source page/crop images from `tmp/pdf-ai-audit/`, enforce the recreate operation budget, and retry on semantic failures.
- Added `tools/validate-live-openai-pdf-results.mjs` to recheck saved live OpenAI outputs and record exact semantic failure causes.
- Updated `.agent/live_openai_pdf_quality_diagnosis.md`, `docs/live-openai-pdf-quality-diagnosis.md`, `docs/ai-reference.md`, and task planning notes.

#### Verification

- Ran `npm.cmd test`; passed with 41 tests.
- Ran `node tools\render-pdf-ai-drawing-samples.mjs`; passed with 12 rendered samples and 0 failures.
- Ran `node tools\validate-live-openai-pdf-results.mjs`; expected rejection of the previous weak live output set occurred, with 7 of 12 samples failing semantic checks and a report written to `tmp/live-openai-pdf-ai-samples/semantic-validation-report.json`.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Findings

- The previous live result failures are now concrete and reproducible: missing real number line, missing arc, non-rectangular histogram bars, non-tangent incircle points, missing triangle polygons, polygon-only distribution curves, and scatter points that are too collinear.
- The JSON manual is useful as a prompt-time compact reference. It should remain synchronized with `SchemaValidator`, `PatchApplier`, and fixture examples whenever supported GraphA operations change.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Image reference guardrails and JSON manual retrieval

#### Work completed

- Added selected-object semantic validation for image patch workflows.
- Strict selected-object edits now fail when the model creates new objects or mutates unselected ids.
- Added recreate-mode operation budget validation for image reconstruction.
- Added OpenAI image repair retry: when the first image response fails semantic validation, the app resubmits the validation errors once and accepts the corrected GraphA patch if valid.
- Wired the browser image apply path to pass mode, instruction, and selected-object context into semantic validation.
- Added runtime loading of `.agents/skills/mathgraph-drawing/references/retrieval-index.json` and `feature-manual.json` so text/image OpenAI prompts receive compact, selected GraphA manual guidance.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, `.agent/image_reference_patching.md`, `.agents/skills/mathgraph-drawing/SKILL.md`, `.agents/skills/mathgraph-drawing/references/feature-manual.json`, and `docs/ai-reference.md`.

#### Verification

- Ran `npm.cmd test`; passed with 40 tests.
- Ran reference JSON parse check for `feature-manual.json` and `retrieval-index.json`; passed.
- Ran `node tools\render-pdf-ai-drawing-samples.mjs`; passed with 12 rendered samples and 0 failures.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Findings

- The failure mode from the live image audit is now blocked locally: a selected point edit cannot be accepted if the model ignores the selected id and creates unrelated textbook objects.
- The existing JSON manual is now useful at runtime as prompt context, not only as human/agent documentation.
- Exact fidelity for curved solids, charts, and dense textbook diagrams still needs new first-class primitives and/or a dedicated simplification pipeline.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Live OpenAI PDF drawing quality diagnosis

#### Work completed

- Re-reviewed the live OpenAI PDF text-prompt drawing evidence after user feedback that many outputs looked wrong.
- Added `.agent/live_openai_pdf_quality_diagnosis.md`.
- Added `docs/live-openai-pdf-quality-diagnosis.md`.
- Created temporary diagnostic contact sheets:
  - `tmp/live-openai-pdf-ai-samples/contact-sheet-diagnosis.png`
  - `tmp/live-openai-pdf-ai-samples/source-vs-ai-contact-sheet.png`

#### Verification

- Re-read `AGENTS.md`, OpenAI context docs, `docs/progress-log.md`, project `mathgraph-drawing` skill references, and the PDF skill.
- Inspected `tmp/live-openai-pdf-ai-samples/live-openai-results.json`.
- Inspected the generated screenshots and source page renders in `tmp/pdf-ai-audit/`.
- Ran `node --check tools\run-live-openai-pdf-ai-samples.mjs`; passed.

#### Findings

- The previous live API run proved external API calls and renderability, but not PDF fidelity.
- The main failure was an overly weak acceptance gate: schema validity, reference validity, and non-empty pixels cannot catch wrong geometry.
- The live runner used text summaries rather than exact PDF figure crops, so results were concept sketches rather than true reproductions.
- Several examples require semantic validators, such as verifying √2 radius construction, rectangular histogram bars, incircle tangency, requested function intersections, and scatter/distribution shape.
- Chart and curved-solid categories remain approximation-only until MathGraph gets first-class primitives.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

## 2026-05-24

### Live OpenAI PDF text-prompt drawing verification

#### Work completed

- Added `tools/run-live-openai-pdf-ai-samples.mjs` to call the external OpenAI Responses API directly for the PDF-derived drawing samples.
- Added clean Korean prompt overrides for 12 sample categories because the existing fixture text is mojibake in this checkout.
- Added live validation-repair retry logic so invalid field aliases or broken references are resent to OpenAI with the exact GraphA validation errors.
- Added `.agent/live_openai_pdf_text_prompt_audit.md`.
- Added `docs/live-openai-pdf-text-prompt-audit.md`.
- Stored non-committed prompt/output evidence under `tmp/live-openai-pdf-ai-samples/`.

#### Verification

- Ran `node tools\run-live-openai-pdf-ai-samples.mjs` with `OPENAI_API_KEY` supplied only through the process environment.
- The script checked model availability through `GET https://api.openai.com/v1/models` and used `gpt-4.1-mini`.
- Final live run called `POST https://api.openai.com/v1/responses` for all 12 samples.
- Final failures: 0.
- All 12 final payloads passed `SchemaValidator.validate()`, `SchemaValidator.validateReferences()`, and real MathGraph canvas render smoke checks.

#### Findings

- Direct external API generation works end to end for text-prompt GraphA drawing.
- The outputs are structurally similar rather than pixel-identical to the original PDF figures.
- Strict GraphA field-name guidance and validation-repair retries are necessary; earlier raw attempts produced missing `op` fields, invalid aliases, or bad references.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Live OpenAI image reference verification

#### Work completed

- Used the user-provided GPT API key for transient live testing only; the key was not written to project files.
- Verified `GET https://api.openai.com/v1/models`; `gpt-5.5` was available.
- Ran a real browser-app image paste call against `POST https://api.openai.com/v1/responses`; the call returned HTTP 200, created 7 objects, and had no console errors.
- Ran four live `AIService.analyzeImage()` calls with textbook PDF crops:
  - circle/sector source crop,
  - selected-point partial patch request,
  - rectangular-prism/cylinder source crop,
  - linear-graph/intersection source crop.
- Added `.agent/live_api_image_reference_audit.md`.
- Added `docs/live-api-image-reference-audit.md`.
- Stored non-committed visual evidence under `tmp/image-reference-pdf-audit/`, including `live-api-contact-sheet.png` and per-sample screenshots.

#### Verification

- Live API responses returned HTTP 200 for all recorded calls.
- Returned JSON payloads passed `SchemaValidator`.
- Returned JSON payloads rendered on the real MathGraph canvas.
- Console errors: none in the completed live service run.
- Result summary:
  - Circle recreate: rendered 8 objects, but missed arc/sector semantics.
  - Partial patch: schema/reference/render valid, but semantically wrong because it created new exercise-related objects instead of updating only selected point A.
  - Solid recreate: rendered 60 objects, but was slow and heavy; cylinder remains an approximation.
  - Linear graph recreate: rendered 58 objects and captured the two lines/intersection, but overgenerated grid/axis objects.

#### Findings

- The external OpenAI API plumbing works end to end.
- The feature is not yet reliable enough for "exactly change only this part" because patch-mode prompts need stronger instruction priority and semantic post-validation.
- Recreate mode also needs an operation budget and better filtering of decorative textbook/page elements.
- Direct browser BYOK worked for this test, but a server-side proxy is still recommended before shared classroom deployment.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Live Korean OpenAI black-default prompt verification

#### Work completed

- Used the user-provided GPT API key as a transient `OPENAI_API_KEY` environment variable only; it was not written to project files or reports, and the environment variable was removed after the run.
- Ran the real MathGraph `AIService.processCommand()` path against `POST https://api.openai.com/v1/responses` using `gpt-5.5`.
- Tested three Korean prompts that match the requested hard cases:
  - complex plane geometry: triangle ABC with circumcircle, altitude, right-angle marker, angle marker, and length marker,
  - solid geometry: square pyramid V-ABCD with visible and hidden edges,
  - graph situation: quadratic function `y=x^2-2x-3`, tangent at `x=2`, and x-intercepts.
- Applied the returned `operations[]` payloads to the real browser canvas with Playwright and captured clean canvas screenshots.
- Stored non-committed evidence under `tmp/live-openai-black-default-test/`, including `korean-live-openai-results.json`, `korean-live-openai-report.md`, and per-prompt screenshots.

#### Verification

- External OpenAI Responses API calls returned real response IDs:
  - `resp_0e0c0d7a5150c774016a1313dfd560819b87c2f0ce784a0d01`
  - `resp_00ab24ab0acccf33016a1314004db4819892d9fca5269833a8`
  - `resp_0d587e789a9b266f016a13141b8570819a85a536564ade32ff`
- All three outputs passed `SchemaValidator.validate()`.
- All three outputs passed `SchemaValidator.validateReferences()`.
- All three outputs rendered as non-empty browser canvas drawings.
- Generated JSON color violations: 0.
- Runtime object color violations after canvas application: 0.
- The Korean report was checked for encoding integrity: Hangul count was non-zero and `???` runs were 0.

#### Findings

- The GPT API integration works end to end for Korean natural-language drawing requests through the app's actual AI service, schema validator, and browser renderer.
- The new black-default behavior held for generated payloads and runtime-applied objects.
- Visual quality is mostly usable, but the quadratic graph sample still shows label overlap near the tangent point; future prompt/skill guidance should prefer `labelOffset` and sparser labels for exam-style graph outputs.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

### Monochrome default drawing output

#### Work completed

- Changed runtime object defaults so newly created objects use black (`#000000`) by default across base objects, filled polygons, sectors, circular segments, canvas primitive fallbacks, SVG export fallbacks, UI color picker defaults, and tool previews.
- Added legacy settings migration so previously stored built-in palette values (`#6366f1`, `#3b82f6`, `#22c55e`, `#f97316`) are normalized to black on load.
- Updated AI prompt guidance, `docs/ai-reference.md`, and the project-local `mathgraph-drawing` skill so default GPT/API examples do not introduce multiple colors unless the user explicitly requests color.
- Normalized `.agents/skills/mathgraph-drawing/references/feature-manual.json`, `synthetic-drawing-data.jsonl`, and `tests/fixtures/pdf-ai-drawing-samples.json` so reference-generated diagrams render with black style colors by default.
- Added `tests/monochrome-defaults.test.js` to guard runtime defaults, localStorage palette migration, and reference sample style colors.

#### Verification

- Ran `npm.cmd test`; passed with 35 tests.
- Ran `node tools\render-pdf-ai-drawing-samples.mjs`; passed with 12 rendered samples and 0 failures.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Deployment / Vercel

- No Vercel configuration or deployment settings were changed.

#### Notes

- Explicit user-requested colors remain supported through `color` and `fillColor`; only the default behavior and default reference examples now prefer black.
- Editing selection/highlight colors remain as UI feedback and are not part of the generated object default.

### Teacher-guide PDF AI drawing sample audit

#### Work completed

- Sampled the three local teacher-guide PDFs for 12 non-overlapping diagram categories across number lines, plane geometry, circles, solids, functions, trigonometry, and statistics.
- Added `.agent/pdf_ai_drawing_audit.md` to record scope, method, parity scale, and follow-up notes.
- Added `docs/pdf-ai-drawing-sample-audit.md` with page/category results and parity findings.
- Added reusable fixture `tests/fixtures/pdf-ai-drawing-samples.json` with Korean AI drawing prompts and GraphA `operations[]`.
- Added `tests/pdf-ai-drawing-samples.test.js` to validate sample uniqueness, schema validity, reference validity, and required category coverage.
- Added `tools/render-pdf-ai-drawing-samples.mjs` to launch a local static server, apply each sample in the real canvas, capture screenshots, and fail on empty render output.
- Added `playwright` as a dev dependency for repeatable local render checks.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, this progress log, `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, and `docs/ai-reference.md`.
- Project skill references: `.agents/skills/mathgraph-drawing/SKILL.md`, `retrieval-index.json`, `feature-manual.json`, and `synthetic-drawing-data.jsonl`.
- Source PDFs:
  - `중_수학1(김화경)_지도서.pdf`
  - `중등_수학2_류희찬(15개정)_지도서.pdf`
  - `중등_수학3_이준열(15개정)_지도서.pdf`

#### Verification

- Ran `npm.cmd test`; passed with 32 tests.
- Ran `node tools\render-pdf-ai-drawing-samples.mjs`; passed with 12 rendered samples and 0 failures.
- Browser screenshot contact sheet saved to `tmp/browser-captures/pdf-ai-drawing-samples/contact-sheet.png`.
- Attempted temporary `npx --yes -p playwright node ...`; blocked because the temporary package was not resolvable as a local ESM import on Windows/npm, so Playwright was added as a dev dependency.
- `npm install --save-dev playwright` completed; npm audit currently reports 33 vulnerabilities inherited in the dev tree. No audit fix was applied because that would be unrelated and potentially broad.

#### Deployment / Vercel

- No runtime deployment settings or Vercel configuration were changed.
- Existing Vercel project link remains present.

#### Findings

- Direct-match categories: parallel-line angle relations, circle sector/arc, linear graph intersection, and trigonometric right triangle.
- Structural-match categories: radical number-line construction, rectangular prism, triangle incircle, similarity triangles, quadratic graph, and distribution curves.
- Approximation categories: histogram/frequency polygon and scatter plot.
- Remaining gaps: first-class chart primitives, curved solid primitives, independent text labels, stronger construction solvers, function-domain schema support, and multiple-intersection disambiguation.

### Token-efficient MathGraph AI drawing reference skill

#### Work completed

- Created project-local skill `.agents/skills/mathgraph-drawing/SKILL.md` for future GPT/API drawing orchestration.
- Added `.agents/skills/mathgraph-drawing/references/retrieval-index.json` so API prompts can select only relevant feature chunks and examples by Korean prompt tags.
- Added `.agents/skills/mathgraph-drawing/references/feature-manual.json` covering the current operation contract, AI-create types, common fields, UI/runtime tools, algebra input, fallback parser, export/save behavior, validation flow, and known gaps.
- Added `.agents/skills/mathgraph-drawing/references/synthetic-drawing-data.jsonl` with 12 Korean synthetic drawing examples for complex plane figures, circles, solids, function graphs, number lines, shaded regions, and chart approximations.
- Linked the new skill from `docs/ai-reference.md`.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, and `.agent/skills_context.md`.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-url-inventory.yaml`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, `docs/progress-log.md`, `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, and `docs/ai-reference.md`.
- Local runtime/schema files: `js/ai/SchemaValidator.js`, `js/ai/PatchApplier.js`, `js/ai/AIService.js`, `js/core/ObjectManager.js`, `js/objects/*.js`, `js/tools/*.js`, `js/main.js`, `index.html`, `js/ui/CommandPalette.js`, `js/ui/AlgebraInput.js`, and `js/core/EventHandler.js`.
- Official docs:
  - `https://developers.openai.com/api/docs/guides/structured-outputs`
  - `https://developers.openai.com/api/reference/resources/responses/methods/create`
  - `https://developers.openai.com/api/docs/guides/tools-skills`
  - `https://developers.openai.com/api/docs/guides/tools-tool-search`

#### Verification

- Ran inline Node JSON/JSONL parsing plus `SchemaValidator` and reference validation for all synthetic examples; passed with 12 validated examples.
- Ran `py C:\Users\pbj95\.codex\skills\.system\skill-creator\scripts\quick_validate.py .agents\skills\mathgraph-drawing`; passed with `Skill is valid!`.
- Ran `npm.cmd test`; passed with 29 tests.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Deployment / Vercel

- No runtime or Vercel configuration changes were made.
- Existing Vercel static configuration remains in place.

#### Notes

- This task does not add new primitives. Histogram/box-plot/scatter and cylinder/cone/sphere-style requests are documented as current approximations using existing polygon, line, number-line, prism, and pyramid primitives.
- Existing non-skill dirty worktree files were not modified or reverted by this task.

### Clipboard image reference and targeted graph patching

#### Work completed

- Added a dedicated planning note at `.agent/image_reference_patching.md`.
- Added clipboard image paste handling for the AI chat.
- Changed image upload/paste behavior so image-only input asks the vision path to recreate the diagram as GraphA objects, while image plus chat text asks for a targeted graph-object patch.
- Added current canvas and selected-object context to image analysis prompts.
- Added AIService prompt builders for image recreation versus partial patching.
- Updated the chat placeholder and upload tooltip for the new image-reference workflow.
- Documented the boundary between MathGraph vector-object patching and separate raster image-editing workflows in `docs/ai-reference.md`.
- Added unit coverage for image prompt construction and OpenAI image-input request construction without live API calls.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-url-inventory.yaml`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, and this progress log.
- Official docs:
  - `https://developers.openai.com/api/docs/guides/image-generation`
  - `https://developers.openai.com/api/docs/guides/images-vision`
  - `https://developers.openai.com/api/reference/resources/responses/methods/create`

#### Verification

- Ran `node --check js\ai\AIService.js`; passed.
- Ran `node --check js\main.js`; passed.
- Ran `node --test tests\ai-flow.test.js`; passed with 23 tests.
- Ran `npm.cmd test`; passed with 29 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- In-app Browser attempt for `http://127.0.0.1:4173/` was blocked by `ERR_BLOCKED_BY_CLIENT`, so Playwright CLI was used as fallback.
- Started a local static server at `http://127.0.0.1:4173/`.
- Ran Playwright CLI checks:
  - page loaded with title `그래프A Mk2.1`.
  - console error count was 0.
  - chat placeholder and image-upload title matched the new workflow.
  - `window.app` existed and exposed `handleClipboardPaste`, `getClipboardImageFile`, `buildAIContext`, and image prompt helpers.
  - viewport screenshot saved to `tmp/browser-captures/image-reference-chat-ui.png`.

#### Deployment / Vercel

- Existing Vercel configuration remains unchanged.
- This change does not alter deployment settings or require new environment variables.
- Direct browser API-key storage remains a BYOK/personal-use compromise; a server-side proxy is still recommended before shared public OpenAI API use.

#### Follow-up

- Add a dedicated mask UI and server-side image edit endpoint only if the product needs true raster inpainting.
- Add stronger UX for delayed "paste first, type instruction later" flows if classroom usage shows that pattern is common.

## 2026-05-19

### PDF-driven geometry and graph coverage improvement

#### Work completed

- Sampled the three local teacher-guide PDFs for representative diagram pressure:
  - `중_수학1(김화경)_지도서.pdf`: plane geometry, sectors, solids, and statistical graphs.
  - `중등_수학2_류희찬(15개정)_지도서.pdf`: simultaneous-equation graphs, linear-function questions, plane-figure reasoning, and triangle similarity.
  - `중등_수학3_이준열(15개정)_지도서.pdf`: number-line radicals, quadratic functions, and trigonometry planning.
- Added first-class `polygon` support across runtime creation, rendering, hit testing, JSON persistence, object restoration, SVG export, and the manual polygon tool.
- Added AI parity for `polygon` in the strict Structured Outputs operation schema, local validator, patch applier, AI prompt examples, and `docs/ai-reference.md`.
- Reconnected `processCommand()` no-key and failed-API paths to the broader local fallback so API-free requests still reach legacy shape generation instead of stopping at the narrower deterministic parser.
- Added tests for polygon validation, too-few-vertex rejection, temporary ID resolution through the patch applier, and local no-key fallback dispatch.
- Kept the large PDF source files and temporary render/capture artifacts out of Git via `.gitignore`.

#### Multiagent / audit notes

- Used one explorer subagent to audit remaining PDF-style diagram gaps after polygon support.
- Remaining high-value follow-ups:
  - Statistical chart primitives: histogram, frequency polygon, box plot, dot plot, scatter plot, and table-backed chart helpers.
  - Function-teaching helpers: vertex/intercept/domain/range annotations and graph-family templates.
  - Geometry relation helpers: similarity/congruence markers, shaded subregions, diagonal/parallel markers.
  - Curved solid primitives: cylinder, cone, sphere, nets, and revolution diagrams.

#### Sources checked

- Local context: `AGENTS.md`, `docs/openai-url-inventory.yaml`, `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, and this progress log.
- Official docs:
  - `https://developers.openai.com/api/docs/guides/structured-outputs`
  - `https://developers.openai.com/api/reference/resources/responses/methods/create`
  - `https://developers.openai.com/api/docs/guides/tools-computer-use`

#### Verification

- Ran `npm.cmd test`; passed with 27 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran `node --check js\objects\Polygon.js; node --check js\ai\AIService.js; node --check js\main.js; node --check js\tools\PolygonTool.js`; passed.
- Started a local static server at `http://127.0.0.1:4173/`.
- Ran headless Chrome/Playwright-core capture for a representative scene; output `tmp/browser-captures/02-ai-polygon-coverage-scene.png`.
  - Result: 18 valid objects, including polygon, sector, function, number line, and prism; 0 invalid objects; 0 console errors; SVG output included `<polygon>`.
- Ran chat JSON patch capture through the visible AI assistant panel; output `tmp/browser-captures/03-chat-json-polygon.png`.
  - Result: 4 created objects, including 1 valid polygon; 0 invalid objects; 0 console errors.

#### Deployment / Vercel

- Existing Vercel configuration remains present: `vercel.json` uses `npm run vercel-build`, output directory `.`, and `.vercel/project.json` exists locally.
- This change does not alter deployment settings or require new environment variables.
- Direct browser API-key storage remains a BYOK/personal-use compromise; a server-side proxy is still recommended before shared public OpenAI API use.

#### Follow-up

- Add first-class statistical chart objects before claiming full textbook graph coverage.
- Add cylinder/cone/sphere/net primitives for full solid-geometry coverage.
- Add a server-side OpenAI proxy if this app is deployed for shared classroom use.

## 2026-04-25

### OpenAI Structured Outputs alignment for MathGraph

#### Work completed

- Updated MathGraph's OpenAI Responses API path to use strict Structured Outputs with a GraphA `operations[]` JSON Schema.
- Added shared OpenAI model option constants and refreshed defaults/options to the current reference family: `gpt-5.5`, `gpt-5.5-pro`, `gpt-5.4`, `gpt-5.4-mini`, and `gpt-5.4-nano`.
- Added `store: false` to OpenAI text and vision requests, and wired configured `reasoning.effort` / `text.verbosity` into request construction.
- Added nullable-field stripping so strict structured output payloads become the existing sparse GraphA patch format before validation.
- Added unit coverage for request-body construction, output extraction, and null stripping without real API calls.
- Updated `.agent/prd.md`, `.agent/implementation_tracking.md`, `.agent/skills_context.md`, and `docs/ai-reference.md`.

#### Sources checked

- Local context: `docs/openai-context-map.md`, `docs/openai-core-summaries.md`, `docs/openai-docs-map.yaml`, `docs/vibecoding-openai-guide.md`, and `docs/openai-url-inventory.yaml`.
- Official docs:
  - `https://developers.openai.com/api/docs/models`
  - `https://developers.openai.com/api/docs/guides/structured-outputs`
  - `https://developers.openai.com/api/reference/resources/responses/methods/create`

#### Verification

- Ran `node --check js/ai/AIService.js`; passed.
- Ran `node -e "const fs=require('fs'); const acorn=require('acorn'); for (const f of ['js/main.js']) { acorn.parse(fs.readFileSync(f,'utf8'), {ecmaVersion:'latest', sourceType:'module'}); } console.log('parse ok');"`; passed.
- Ran `node --test tests/ai-flow.test.js`; passed.
- Ran `npm.cmd test`; passed with 23 tests.
- Ran `git diff --check`; passed with line-ending warnings only.

#### Follow-up

- Consider a Vercel/server-side API proxy before treating the deployed app as a shared public OpenAI integration, because API keys are still stored client-side for the current BYOK flow.

### Work completed

- Created project-level `AGENTS.md` so future tasks load the local OpenAI documentation context.
- Created `docs/openai-context-map.md` as a human-readable routing map.
- Created `docs/openai-docs-map.yaml` as a machine-readable source map for future agents.
- Created `docs/vibecoding-openai-guide.md` as compact build guidance for API, Agents, Codex, Apps SDK, Computer Use, Realtime, evals, optimization, and production work.
- Created `.agents/skills/openai-vibecoding-context/SKILL.md` for automatic context loading in future OpenAI-related tasks.

### Official sources checked

- `https://developers.openai.com/`
- `https://platform.openai.com/home`
- API docs for Models, latest model, prompt guidance, Responses API, text generation, Structured Outputs, function calling, tools, web search, MCP/connectors, file search, conversation state, background mode, prompt caching, Agents SDK, orchestration, Computer Use, evals, model optimization, fine-tuning, Realtime, image generation, video generation, embeddings, moderation, production, and deployment.
- Codex docs for AGENTS.md, Skills, and Subagents.
- Apps SDK docs for overview, MCP Apps compatibility, MCP server, ChatGPT UI, and security/privacy.
- Commerce docs for overview, get started, and best practices.

### Tooling notes

- Tried to install OpenAI Developer Docs MCP with `codex mcp add openaiDeveloperDocs --url https://developers.openai.com/mcp`.
- Result: blocked by local `codex.exe` access denied error.
- Tried in-app browser / Computer Use via Browser plugin.
- Result: blocked by missing Codex app-server path (`failed to start codex app-server: 지정된 경로를 찾을 수 없습니다. (os error 3)`).
- Used official OpenAI web pages as the fallback source.
- Spawned three explorer subagents for parallel official-doc investigation across API, Agents/Codex/Computer Use, and Apps SDK/Realtime/Evals/specialized areas.
- Integrated subagent findings into the local maps: API references, policy links, guardrails, Agent Builder/ChatKit, Codex best practices, in-app browser, and approvals/security.

### Verification

- Ran `git diff --check`.
- Result: passed with no whitespace errors.
- Inspected generated file list and confirmed the expected context, map, guide, log, and skill files exist.
- After commit, ran `git show --check --oneline --stat HEAD`; passed.
- Ran `git status --porcelain=v1`; working tree clean.

### Git/GitHub

- Initial `git status --short --branch` failed because this folder was not a Git repository.
- Ran `git init`; repository initialized on local `master`.
- Ran `git remote -v`; no remote is configured.
- First `git commit -m "Add OpenAI docs context map"` failed because Git author identity was not configured.
- Set repository-local `user.name=Codex` and `user.email=codex@local`.
- Committed local changes with message `Add OpenAI docs context map`.
- Ran `git push`.
- Result: failed because no remote is configured (`fatal: No configured push destination`).
- Next action: add a GitHub remote with `git remote add origin <url>` and push with `git push -u origin master` when the target repository URL is available.

### Deployment

- No Vercel configuration exists for this project.

## 2026-04-25 OpenAI official docs inventory rebuild

### Work completed

- Rebuilt the OpenAI public documentation scope from official HTTP sources instead of relying on a hand-selected page list.
- Added `tools/build-openai-docs-inventory.ps1` to collect `developers.openai.com` sitemap URLs, `platform.openai.com` public sitemap URLs, official OpenAI/help/policy links, and external related links.
- Added `tools/check-openai-docs-inventory.ps1` to validate required files, duplicate inventory URLs, required OpenAI URLs, robots exclusion patterns, docs-map sections, core summary source URLs, and related-link coverage.
- Generated `docs/openai-url-inventory.yaml` with 7,460 inventory entries: 3,305 developer sitemap URLs, 1 public Platform sitemap URL, 3,313 readable official entries, 2 failed official entries, 4,144 linked related entries, and 48 core-summary entries.
- Added `docs/openai-core-summaries.md` for detailed summaries of API, Responses, Structured Outputs, tools, Computer Use, Agents, Realtime, Evals, fine-tuning, Codex, Apps SDK, Commerce, safety, data, and production guidance.
- Added `docs/openai-related-links.md` for linked GitHub, YouTube, community, status, help, policy, and other external references that should remain inventory-only unless separately requested.
- Updated `docs/openai-docs-map.yaml`, `docs/openai-context-map.md`, `docs/vibecoding-openai-guide.md`, `AGENTS.md`, and `.agents/skills/openai-vibecoding-context/SKILL.md` so future OpenAI/API/Codex/App SDK work starts from the inventory and core summaries.

### Scope and exclusions

- Included the full public `developers.openai.com` sitemap and the public `platform.openai.com` sitemap.
- Included official OpenAI/help/policy links and external links as inventory records with source context.
- Excluded external GitHub, YouTube, Discord, community, and status pages from body summarization unless they are official OpenAI/help/policy pages.
- Did not crawl Platform account or login pages. `https://platform.openai.com/login` is marked `excluded_platform_account_or_login`.
- Recorded Platform robots exclusions for `/settings/*`, `/finetune/*`, `/assistants/*`, `/threads/*`, `/batches/*`, `/usage/*`, `/api-keys/*`, `/chat-completions/*`, and `/evaluations/*`.

### Tooling notes

- OpenAI Developer Docs MCP was not available through the current tool registry, so the implementation used official sitemaps, robots files, and HTTP fetches.
- Browser/Computer Use was not used for account pages because the approved scope excludes sensitive API keys, billing, usage, eval data, organization settings, and account-specific screens.
- Existing multiagent research from the same OpenAI documentation task was used as seed context, while the final source of truth is the generated sitemap-based inventory.

### Known failures and exclusions

- `https://developers.openai.com/dev/ui-kit-test/` was present in the developer sitemap but returned 404 and is marked `fetch_failed`.
- `https://platform.openai.com/tokenizer` was the only Platform public sitemap URL but returned 403 to the automated HTTP fetch and is marked `fetch_failed`.

### Verification

- Ran `powershell -ExecutionPolicy Bypass -File tools\build-openai-docs-inventory.ps1 -Concurrency 20 -TimeoutSeconds 20`; completed and regenerated inventory artifacts.
- Ran `powershell -ExecutionPolicy Bypass -File tools\check-openai-docs-inventory.ps1`; passed with 7,460 inventory entries, 2 failed official entries, and 3,991 external related entries.
- Parsed `docs/openai-url-inventory.yaml` and `docs/openai-docs-map.yaml` with PyYAML in a temporary virtual environment; both parsed successfully.
- Ran `git diff --check`; passed with line-ending warnings only.

### Git/GitHub

- Committed the inventory rebuild locally with `git commit -m "Rebuild OpenAI docs inventory"` (`81fde44`).
- Ran `git remote -v`; no remote is configured.
- Ran `git push`; failed with `fatal: No configured push destination`.
- Next action: add a GitHub remote with `git remote add origin <url>` and push with `git push -u origin master`.
