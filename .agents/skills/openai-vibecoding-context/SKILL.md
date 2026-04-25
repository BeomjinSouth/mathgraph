---
name: openai-vibecoding-context
description: Use when building with OpenAI APIs, Codex, Agents SDK, Computer Use, Apps SDK, Realtime, evals, model optimization, or when asked to use this OpenAI GuideLine repository as vibe-coding context.
---

# OpenAI Vibe Coding Context

Use this skill to load the local OpenAI documentation routing context before designing or changing OpenAI-based software.

## Required local context

Read these files first:

1. `AGENTS.md`
2. `docs/openai-url-inventory.yaml` for exact source coverage and read/exclusion state
3. `docs/openai-context-map.md`
4. `docs/openai-core-summaries.md`
5. `docs/openai-docs-map.yaml`
6. `docs/vibecoding-openai-guide.md`
7. `docs/progress-log.md`

## Source of truth

- Treat the local files as a map, not the final authority.
- Use current official OpenAI docs for decisions.
- Prefer the OpenAI Developer Docs MCP if available.
- If the MCP is unavailable, browse only official OpenAI sources:
  - `https://developers.openai.com/`
  - `https://platform.openai.com/`
  - `https://openai.com/`
  - `https://help.openai.com/`

## Workflow

1. Identify the task area: API, model selection, tools, agents, Codex, Apps SDK, Realtime, evals, fine-tuning, safety, or production.
2. Search `docs/openai-url-inventory.yaml` for the exact current official URL and read state.
3. Open the matching section in `docs/openai-docs-map.yaml`.
4. Read the relevant local guidance in `docs/openai-core-summaries.md` and `docs/vibecoding-openai-guide.md`.
5. Verify volatile details against official docs before implementation.
6. For new features or behavior changes, update the relevant context document before or alongside the implementation.
7. After the task, update `docs/progress-log.md` with sources checked, changes made, verification run, and blocked follow-up.

## Design defaults

- New API projects default to the Responses API.
- Use structured outputs for typed final responses.
- Use function calling for app-owned actions and data access.
- Use Agents SDK when the app owns orchestration, tool execution, approvals, state, or handoffs.
- Use multiagent/subagent workflows for bounded parallel exploration, testing, log analysis, or documentation synthesis.
- Use Computer Use only when an API or stable automation surface is not enough; keep isolation, allowlists, and human confirmation for risky actions.
- Add evals before fine-tuning or major prompt/model changes.

## Never assume without re-checking

- Current best model
- Model prices
- Tool support by model
- Context windows
- Rate limits
- Deprecation dates
- Data retention and ZDR compatibility
- App submission or commerce access requirements
