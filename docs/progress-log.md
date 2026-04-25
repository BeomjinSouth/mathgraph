# Progress Log

## 2026-04-25

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
