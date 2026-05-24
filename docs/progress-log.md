# Progress Log

## 2026-05-25

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
