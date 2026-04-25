# Progress Log

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
