# OpenAI Vibe Coding Guide

Last updated: 2026-04-25

Use this as the compact working context for building with OpenAI. It intentionally favors decision rules over copied documentation.

For source discovery, start with `docs/openai-url-inventory.yaml`. For detailed synthesized context, read `docs/openai-core-summaries.md`. This guide only captures operating defaults.

## Default Architecture Rules

1. Start new API work with the Responses API unless a legacy constraint forces Chat Completions or Assistants.
2. Put stable developer instructions, schemas, examples, and tool definitions at the beginning of prompts. Put user-specific or request-specific data later to improve prompt caching.
3. Use structured outputs for typed final answers. Use function calling when the model needs to call app-owned code, fetch private data, or perform actions.
4. Use built-in tools before building custom infrastructure when they fit: web search, file search, image generation, computer use, code interpreter, shell, MCP/connectors.
5. Add evals before tuning prompts deeply, fine-tuning, or shipping behavior that matters.
6. Treat model choice, pricing, limits, and tool support as volatile. Re-check official docs before committing a design.

## Prompt Shape For Codex And Agents

Use this shape for substantial tasks:

- Goal: what outcome should exist when the task is done.
- Context: relevant files, docs, product constraints, user assumptions, and examples.
- Constraints: what must not change, safety boundaries, dependency limits, style rules, and compatibility needs.
- Completion criteria: tests, screenshots, docs, commits, deployment, or review evidence.

## Model Selection Heuristic

- Complex coding, architecture, long-running reasoning, multi-step synthesis: start with the current flagship model listed in the Models guide. As of this map update, the docs recommend `gpt-5.5` for complex reasoning and coding.
- Cost/latency-sensitive coding or subagent work: consider the current smaller frontier models. As of this map update, the docs mention `gpt-5.4-mini` and `gpt-5.4-nano` for lower-cost or lower-latency work.
- Simple extraction, routing, classification, or rewrite: use lower reasoning effort and a cheaper model after evals show quality is sufficient.
- Do not encode model IDs as permanent facts in app logic without a config layer.

## Responses API Pattern

- Prefer a single Responses request that includes instructions, input, tools, and state controls.
- Use `previous_response_id` for stateful continuation when appropriate, but remember prior input tokens in the chain still count for billing.
- Use `store: false` when you must avoid default response storage, after checking feature compatibility.
- Use background mode for long-running reasoning where polling is acceptable; check ZDR and retention implications first.
- Use WebSocket mode for low-latency bidirectional applications.

## Reasoning, Verbosity, And Deployment Levers

- Tune `reasoning.effort` by task: low for simple extraction/routing, medium or high for debugging, planning, synthesis, and code reasoning, xhigh only when evals justify the latency.
- Use `text.verbosity` to control answer density when supported.
- Use `tool_search` when there are many functions or large schemas and only a subset is relevant per turn.
- Use compaction and prompt caching for long or repeated workflows.
- Use `prompt_cache_key` for high-throughput apps with shared prefixes after checking the latest docs.

## Tools And Data Access

- Web search: use for fresh information and require citations in user-facing answers.
- File search/retrieval: use vector stores for uploaded knowledge bases; separate source files, embeddings, and generated answers in your mental model.
- MCP/connectors: use when external capabilities can be exposed through a standard server or OpenAI-maintained connector.
- Shell/code interpreter: use for analysis, execution, file transforms, and reproducible computation in isolated environments.
- Computer Use: use only when an interface cannot be reached through a stable API. Run in an isolated browser/container, keep domain and action allowlists, and require human confirmation for purchases, authenticated flows, destructive actions, sensitive data transmission, or hard-to-reverse steps.

## Agents And Multiagent Work

- Use direct OpenAI client libraries for straightforward model calls.
- Use Agents SDK when the app owns orchestration, tool execution, approvals, handoffs, state, observability, or multi-agent flow.
- Add guardrails where failures matter: input filtering, output validation, tool-call validation, and human review before side effects.
- Choose handoffs when a specialist should own the conversation branch.
- Choose "agents as tools" when a manager should keep control and call specialists as bounded capabilities.
- In Codex, use subagents for read-heavy parallel work such as exploration, test/log analysis, documentation synthesis, and independent research.
- Be careful with parallel write-heavy work. Assign disjoint files or modules and make final integration explicit.
- Keep the main thread focused on requirements, decisions, and final synthesis. Ask subagents to return summaries, not raw logs.

## Codex Project Context

- Keep durable rules in `AGENTS.md`.
- Use `.agents/skills/<skill-name>/SKILL.md` for repeatable workflows. Skill descriptions should be specific enough for implicit activation.
- Use this repository's `openai-vibecoding-context` skill when building with OpenAI APIs, Codex, Agents, Apps SDK, Computer Use, Realtime, evals, or model optimization.
- Use `docs/openai-url-inventory.yaml` to find the current official source URL and whether it is readable, failed, excluded, or inventory-only.
- Use `docs/openai-core-summaries.md` for the implementation-focused summary of the major public docs.
- For every substantial task, update `docs/progress-log.md` with the document sources checked, verification run, and unresolved issues.

## Apps SDK Pattern

- Build a ChatGPT app as three separate pieces: MCP server, iframe UI bundle, and model-facing tool metadata.
- Let the MCP server define tools, enforce auth, return structured data, and point tools to UI resources.
- Let the UI render structured tool results and communicate over the MCP Apps bridge.
- Prefer the MCP Apps standard bridge for portability. Use `window.openai` only for ChatGPT-specific features.
- Apply least privilege, explicit consent, server-side validation, audit logs, and prompt-injection testing.

## Realtime Pattern

- Use Realtime API for low-latency multimodal apps with audio, images, and text.
- Use WebRTC for browser/client voice agents.
- Use WebSocket for server-side low-latency middle tiers.
- Use SIP for telephony.
- Track session lifecycle, server controls, tool calls, guardrails, and cost management from the Realtime docs.

## Evals And Optimization

- Write evals against realistic production-like inputs before prompt tuning or fine-tuning.
- Keep datasets dynamic: add edge cases and blind spots as they appear.
- Use graders where possible for repeatable quality signals.
- Fine-tune only after baseline prompts and evals show the need. Start with a small but high-quality dataset and hold out representative data for evals.
- Treat optimization as a loop: eval -> prompt/model/tool change -> eval -> data or prompt update -> repeat.

## Safety And Production

- Use the deployment checklist before launch.
- Run moderation or safety checks when user-generated content, public output, sensitive domains, or policy-sensitive workflows are involved.
- Check OpenAI usage policies for general product behavior and commerce policies for shopping/merchant flows.
- Protect API keys and use project/org permissions deliberately.
- Log enough for debugging, but redact PII and avoid raw prompt storage unless required.
- Re-check data retention, ZDR, regional inference, cache retention, and background-mode behavior before promising compliance properties.

## Platform Dashboard Boundary

`https://platform.openai.com/home` is account-specific and may require login. Do not assume dashboard state from public docs. Ask for permission before account actions such as creating keys, changing settings, uploading sensitive files, or submitting forms.
