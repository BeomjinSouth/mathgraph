# OpenAI Context Map

Last updated: 2026-04-25

This map turns the OpenAI docs into a practical routing layer for future "vibe coding" work. It is not a replacement for the official docs. Use it to decide what to read first, then verify current details in the official source.

## Coverage Status

- `docs/openai-url-inventory.yaml` is the full public inventory generated from `developers.openai.com` sitemap, `platform.openai.com` public sitemap, discovered official OpenAI/help/policy links, and external related links.
- `docs/openai-core-summaries.md` contains detailed summaries for the core implementation-relevant docs.
- `docs/openai-related-links.md` records external and adjacent official links as inventory-only unless explicitly summarized elsewhere.
- `platform.openai.com` account/login/dashboard paths are not crawled. Public sitemap currently contributes only public platform URLs, and robots-disallowed account paths are recorded as exclusions.
- Status label for this repository: `inventory_verified_core_summarized`, not "every linked page fully summarized."

## Entry Points

| Area | Start here | Use when |
| --- | --- | --- |
| OpenAI developer hub | https://developers.openai.com/ | You need the current top-level map across API, Codex, Apps SDK, Commerce, Learn, Cookbook, and changelogs. |
| API docs | https://developers.openai.com/api/docs | You are building API features, choosing models, using tools, streaming, evals, fine-tuning, safety, or production patterns. |
| API reference | https://developers.openai.com/api/reference/overview | You need endpoint-level parameters, response shapes, object schemas, pagination, or error details. |
| Platform dashboard | https://platform.openai.com/home | You need account-specific settings, keys, projects, logs, eval datasets, fine-tuning jobs, usage, or billing. This may require user login. |
| Codex docs | https://developers.openai.com/codex | You are configuring Codex, AGENTS.md, skills, subagents, approvals, in-app browser, automation, or GitHub workflows. |
| Apps SDK | https://developers.openai.com/apps-sdk | You are building ChatGPT apps with an MCP server and iframe UI. |
| Commerce | https://developers.openai.com/commerce | You are integrating product feeds or Agentic Commerce Protocol. |
| Learn and Cookbook | https://developers.openai.com/learn and https://developers.openai.com/cookbook | You need worked examples, demos, prompting examples, or topic collections. |

## Current High-Level Findings

- New API projects should start with the Responses API. The migration guide describes Responses as the recommended API for new projects and lists built-in tools, stateful context, multimodal support, and agentic tool loops as core benefits.
- The Models page currently recommends `gpt-5.5` as the flagship starting point for complex reasoning and coding, with smaller variants such as `gpt-5.4-mini` and `gpt-5.4-nano` for lower-latency or lower-cost workloads. Verify this before each new model decision.
- The API deployment checklist emphasizes Responses API, `reasoning.effort`, `text.verbosity`, assistant `phase`, `tool_search`, built-in tools, compaction, `prompt_cache_key`, encrypted reasoning, background mode, and WebSocket mode as high-value production levers.
- The Agents SDK is appropriate when the application owns orchestration, tool execution, approvals, and state. Use direct OpenAI client libraries for simpler model requests.
- Multi-agent workflows should split bounded work across specialists when that avoids context pollution. In Codex, subagents are not automatic; use them only when explicitly requested or when project rules authorize them.
- Good Codex prompts should make the goal, relevant context, constraints, and completion criteria explicit. Keep reusable workflow expectations in AGENTS.md or Skills instead of retyping them every time.
- Computer Use should be treated as a security boundary. Run it in isolation, use allowlists, and keep a human in the loop for authenticated, destructive, financial, purchasing, or hard-to-reverse actions.
- Guardrails should cover input validation, output validation, and tool-call validation. Approval points should be placed before side effects such as file changes, shell commands, cancellations, MCP writes, or irreversible actions.
- Apps SDK apps have three main parts: an MCP server, an iframe UI bundle that uses the MCP Apps bridge, and model-facing tool metadata. Use the MCP Apps standard bridge by default and layer `window.openai` only for ChatGPT-specific capabilities.
- Evals should come before fine-tuning. Fine-tuning is useful when examples define desired behavior, but it needs holdout data and repeatable evals to prove improvement.

## Task Routing

| Task | Read first | Then check |
| --- | --- | --- |
| Choose a model | API Models, Latest model guide | Pricing, model-specific pages, deployment checklist |
| Build new API feature | Responses API migration/overview, text generation | API reference, streaming/background/webhooks as needed |
| Return JSON or typed data | Structured Outputs | Function calling if the schema triggers actions or tool calls |
| Connect app actions/data | Function calling, Using tools | Tool search, MCP/connectors, API reference |
| Add web-aware answers | Web search tool | Citations, search mode tradeoffs, production safety |
| Add RAG or document search | File search, Retrieval | Vector stores, embeddings, data retention |
| Build agent workflow | Agents SDK overview | Running agents, orchestration, guardrails, results/state, observability |
| Use hosted agent UX | Agent Builder, ChatKit | Agent Builder safety, ChatKit widgets/actions/theming |
| Split work across agents | Agents orchestration, Codex subagents | Project write-conflict rules and final-answer ownership |
| Automate browser/computer tasks | Computer use tool, Codex Computer Use | Human confirmation, domain allowlists, isolation, prompt-injection handling |
| Build a ChatGPT app | Apps SDK overview | MCP server, ChatGPT UI, auth, state, security/privacy, submission |
| Build low-latency voice/audio | Realtime API | WebRTC, WebSocket, SIP, Realtime prompting, costs |
| Improve output quality | Model optimization | Evals, prompt engineering, graders, fine-tuning |
| Customize a model | Supervised fine-tuning | Evals, holdout data, model support, safety checks |
| Generate images | Image generation | Responses image tool for multi-turn flows, Image API for one-shot generation/editing |
| Generate video | Video generation | Deprecations page before starting new Sora/Videos API work |
| Moderate user content | Moderation | Safety best practices and policy docs |
| Prepare production release | Deployment checklist | Production best practices, latency/cost/accuracy/safety docs |
| Work with Codex rules | Codex AGENTS.md | Skills, subagents, approvals/security, hooks, MCP |
| Check policies | Terms and policies, usage policies | Commerce policies, data controls, app submission rules |

## Volatile Facts To Re-Verify

- Model IDs, model families, context windows, knowledge cutoffs, prices, supported tool sets.
- Product status such as beta/GA/deprecated.
- Rate limits, batch limits, file size limits, retention windows, privacy features, and ZDR compatibility.
- Safety, policy, commerce, and app submission requirements.
- Platform dashboard features that may differ by account or organization.

## Official Source Notes Used For This Map

- Developer hub navigation: https://developers.openai.com/
- Models: https://developers.openai.com/api/docs/models
- Latest model guide: https://developers.openai.com/api/docs/guides/latest-model
- Prompt guidance: https://developers.openai.com/api/docs/guides/prompt-guidance
- Responses migration: https://developers.openai.com/api/docs/guides/migrate-to-responses
- Text generation: https://developers.openai.com/api/docs/guides/text
- Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Function calling: https://developers.openai.com/api/docs/guides/function-calling
- Tools: https://developers.openai.com/api/docs/guides/tools
- Web search: https://developers.openai.com/api/docs/guides/tools-web-search
- MCP/connectors: https://developers.openai.com/api/docs/guides/tools-connectors-mcp
- File search: https://developers.openai.com/api/docs/guides/tools-file-search
- Conversation state: https://developers.openai.com/api/docs/guides/conversation-state
- Background mode: https://developers.openai.com/api/docs/guides/background
- Prompt caching: https://developers.openai.com/api/docs/guides/prompt-caching
- Agents SDK: https://developers.openai.com/api/docs/guides/agents
- Agents orchestration: https://developers.openai.com/api/docs/guides/agents/orchestration
- Agent guardrails and approvals: https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
- Agent Builder: https://developers.openai.com/api/docs/guides/agent-builder
- ChatKit: https://developers.openai.com/api/docs/guides/chatkit
- Computer use: https://developers.openai.com/api/docs/guides/tools-computer-use
- Evals: https://developers.openai.com/api/docs/guides/evaluation-getting-started
- Model optimization: https://developers.openai.com/api/docs/guides/model-optimization
- Fine-tuning: https://developers.openai.com/api/docs/guides/supervised-fine-tuning
- Realtime: https://developers.openai.com/api/docs/guides/realtime
- Image generation: https://developers.openai.com/api/docs/guides/image-generation
- Video generation: https://developers.openai.com/api/docs/guides/video-generation
- Embeddings: https://developers.openai.com/api/docs/guides/embeddings
- Moderation: https://developers.openai.com/api/docs/guides/moderation
- Production best practices: https://developers.openai.com/api/docs/guides/production-best-practices
- Deployment checklist: https://developers.openai.com/api/docs/guides/deployment-checklist
- Codex AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Codex Skills: https://developers.openai.com/codex/skills
- Codex Subagents: https://developers.openai.com/codex/concepts/subagents
- Codex best practices: https://developers.openai.com/codex/learn/best-practices
- Codex in-app browser: https://developers.openai.com/codex/app/browser
- Codex approvals/security: https://developers.openai.com/codex/agent-approvals-security
- Apps SDK: https://developers.openai.com/apps-sdk
- Apps SDK MCP compatibility: https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt
- Apps SDK MCP server: https://developers.openai.com/apps-sdk/build/mcp-server
- Apps SDK ChatGPT UI: https://developers.openai.com/apps-sdk/build/chatgpt-ui
- Apps SDK security/privacy: https://developers.openai.com/apps-sdk/guides/security-privacy
- Commerce: https://developers.openai.com/commerce
- OpenAI usage policies: https://openai.com/policies/usage-policies/
- OpenAI commerce policies: https://openai.com/policies/commerce-policies/
