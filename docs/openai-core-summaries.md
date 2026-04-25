# OpenAI Core Summaries

Last updated: 2026-04-25

This document summarizes the core public OpenAI documentation areas that should be used as vibe-coding context. It complements `docs/openai-url-inventory.yaml`, which is the full URL inventory. Re-verify volatile facts such as model IDs, pricing, context windows, tool support, data retention, and deprecation dates in the live official docs before implementing.

## Inventory Status

- Full public `developers.openai.com` sitemap was inventoried from `https://developers.openai.com/sitemap-index.xml`.
- Public `platform.openai.com` sitemap was inventoried from `https://platform.openai.com/sitemap.xml`.
- Platform account/login/dashboard areas were not crawled. Robots-disallowed account paths are recorded in `docs/openai-url-inventory.yaml`.
- Official OpenAI/help/policy links and external related links discovered from docs are inventory-only unless explicitly cited in this summary.

## API Platform

Sources:

- https://developers.openai.com/api/docs/
- https://developers.openai.com/api/docs/models/
- https://developers.openai.com/api/docs/guides/latest-model/
- https://developers.openai.com/api/docs/guides/migrate-to-responses/
- https://developers.openai.com/api/reference/resources/responses/methods/create

Use the API docs for product-level guidance and the API reference for exact endpoint shapes. New work should generally start from the Responses API because it is the central interface for multimodal inputs, typed output items, tool use, state, and agentic loops. Chat Completions and Assistants docs remain relevant for legacy migration, but should not be the default for new architecture unless a compatibility constraint requires them.

Model choice is volatile. The local inventory records current model docs, but implementers must re-check the Models and latest-model guides before selecting defaults. Keep model IDs in configuration rather than hardcoding them into reusable libraries. Tune reasoning effort, output verbosity, tool availability, and cost controls per use case rather than assuming one model setting fits all requests.

## Responses, Structured Outputs, And Function Calling

Sources:

- https://developers.openai.com/api/docs/guides/text/
- https://developers.openai.com/api/docs/guides/structured-outputs/
- https://developers.openai.com/api/docs/guides/function-calling/
- https://developers.openai.com/api/docs/guides/tools/

Use Responses for direct text generation, multimodal prompts, structured outputs, tool calls, and multi-turn workflows. Treat output as typed response items instead of assuming a single text string in complex flows.

Use Structured Outputs when the final assistant response must match a schema. Use function calling when the model needs to request app-owned actions, private data, database lookups, UI operations, or side effects. If a workflow has many functions or large schemas, evaluate `tool_search` so rarely used tools do not dominate context.

For tool designs, define narrow tool descriptions, clear schemas, server-side validation, error behavior, and confirmation boundaries. Tool output should return enough structured data for the model to continue without exposing secrets or raw internal logs.

## Tools, Retrieval, And Computer Use

Sources:

- https://developers.openai.com/api/docs/guides/tools-web-search/
- https://developers.openai.com/api/docs/guides/tools-file-search/
- https://developers.openai.com/api/docs/guides/retrieval/
- https://developers.openai.com/api/docs/guides/tools-connectors-mcp/
- https://developers.openai.com/api/docs/guides/tools-computer-use/

Use built-in tools when they match the job: web search for fresh public facts with citations, file search/retrieval for knowledge bases, MCP/connectors for external services, code interpreter/shell for execution, and image generation for visual output.

File search should be preferred over stuffing large document collections into prompts. Keep source files, vector stores, retrieval results, and generated answers conceptually separate. Use evals to validate retrieval quality and hallucination resistance.

Computer Use is a last-mile interface automation capability, not a substitute for stable APIs. Use it only when an API or deterministic automation path is not enough. Isolate browser/container state, restrict domains/actions, treat page contents as untrusted, and keep a human in the loop for purchases, authenticated flows, destructive actions, sensitive data transmission, or anything hard to reverse.

## State, Streaming, Background, And Cost Controls

Sources:

- https://developers.openai.com/api/docs/guides/conversation-state/
- https://developers.openai.com/api/docs/guides/background/
- https://developers.openai.com/api/docs/guides/streaming-responses/
- https://developers.openai.com/api/docs/guides/webhooks/
- https://developers.openai.com/api/docs/guides/prompt-caching/
- https://developers.openai.com/api/docs/guides/deployment-checklist/

Use `previous_response_id` or conversation state patterns when continuity matters, but remember that retained context can still affect billing and privacy posture. For long-running tasks, use background mode and polling or webhooks when appropriate; verify compatibility with data retention and ZDR requirements.

Use streaming for responsiveness, especially when a user is waiting on visible output. Design moderation and UI states carefully because partial output may arrive before final validation.

For cost and latency, reduce unnecessary prompt length, cap output length, choose smaller models where evals allow, place stable prompt prefixes first, use prompt caching and `prompt_cache_key` where appropriate, and consider Batch/Flex for asynchronous high-volume work.

## Agents, Guardrails, And Multiagent Workflows

Sources:

- https://developers.openai.com/api/docs/guides/agents/
- https://developers.openai.com/api/docs/guides/agents/orchestration/
- https://developers.openai.com/api/docs/guides/agents/guardrails-approvals/
- https://developers.openai.com/api/docs/guides/agent-builder/
- https://developers.openai.com/api/docs/guides/chatkit/

Use direct OpenAI SDK calls for straightforward requests. Use the Agents SDK when the application owns orchestration, tool execution, approvals, handoffs, state, or observability. Use Agent Builder and ChatKit when the hosted workflow editor or embeddable chat UI is the desired product path.

Choose handoffs when a specialist should take over a conversation branch. Choose agents-as-tools when a manager should own the final response and call specialists as bounded capabilities. Add guardrails where failures matter: input checks, output checks, tool-call validation, and human review before side effects.

For multiagent work, split bounded read-heavy tasks such as exploration, test analysis, log analysis, and documentation synthesis. Avoid parallel write-heavy work unless file ownership is explicit and final integration is planned.

## Realtime And Voice

Sources:

- https://developers.openai.com/api/docs/guides/realtime/
- https://developers.openai.com/api/docs/guides/realtime-webrtc/
- https://developers.openai.com/api/docs/guides/realtime-websocket/
- https://developers.openai.com/api/docs/guides/realtime-sip/
- https://developers.openai.com/api/docs/guides/realtime-transcription/
- https://developers.openai.com/api/reference/resources/realtime

Use Realtime for low-latency multimodal interactions with audio, text, and images. WebRTC is the default path for browser/client voice agents, WebSocket fits server-side low-latency middle tiers, and SIP fits telephony. Track session lifecycle, server controls, MCP/tool event flow, transcription needs, and cost controls from the Realtime docs.

Realtime apps need tighter UX and safety design than normal request/response apps because interaction is continuous. Define interruption behavior, turn-taking, fallback text states, user confirmation moments, and logging/redaction rules up front.

## Evals, Optimization, And Fine-Tuning

Sources:

- https://developers.openai.com/api/docs/guides/evaluation-getting-started/
- https://developers.openai.com/api/docs/guides/evals/
- https://developers.openai.com/api/docs/guides/graders/
- https://developers.openai.com/api/docs/guides/model-optimization/
- https://developers.openai.com/api/docs/guides/supervised-fine-tuning/
- https://developers.openai.com/api/reference/resources/evals
- https://developers.openai.com/api/reference/resources/fine_tuning

Build evals before deep prompt tuning, model switching, or fine-tuning. Use realistic production-like inputs, keep edge cases as they are discovered, and choose graders that map to the actual quality bar.

The optimization loop is: establish an eval baseline, improve prompts/tools/retrieval/model settings, re-run evals, add new failure cases, and repeat. Fine-tuning should come after evals show that prompting/tooling is not enough and that representative examples can teach the desired behavior. Hold out data for validation and compare the tuned model against the base model.

## Specialized Models

Sources:

- https://developers.openai.com/api/docs/guides/image-generation/
- https://developers.openai.com/api/docs/guides/video-generation/
- https://developers.openai.com/api/docs/guides/text-to-speech/
- https://developers.openai.com/api/docs/guides/speech-to-text/
- https://developers.openai.com/api/docs/guides/deep-research/
- https://developers.openai.com/api/docs/guides/embeddings/
- https://developers.openai.com/api/docs/guides/moderation/

Use Image API for direct one-shot image generation/editing and the Responses image tool for conversational or multi-step image workflows. Use Video/Sora docs only after checking deprecations and current availability. Use embeddings for search, recommendation, clustering, and RAG indexing. Use moderation for user-generated content, public outputs, and policy-sensitive workflows.

Speech-to-text and text-to-speech docs should be paired with Realtime docs when low latency matters. Deep Research and MCP for deep research are relevant for source-grounded investigation workflows.

## Codex

Sources:

- https://developers.openai.com/codex/
- https://developers.openai.com/codex/guides/agents-md/
- https://developers.openai.com/codex/skills/
- https://developers.openai.com/codex/concepts/subagents/
- https://developers.openai.com/codex/app/browser/
- https://developers.openai.com/codex/app/computer-use/
- https://developers.openai.com/codex/agent-approvals-security/
- https://developers.openai.com/codex/learn/best-practices/

Use `AGENTS.md` for durable project rules and `.agents/skills` for reusable workflows. Prompts should provide goal, context, constraints, and completion criteria. Keep noisy exploration out of the main thread when subagents are appropriate.

Codex browser and Computer Use are useful for UI inspection and browser tasks, but they carry the same safety boundaries as other browser automation. Account actions, sensitive data, destructive operations, and third-party submissions require explicit confirmation or handoff depending on risk.

## Apps SDK And ChatGPT Apps

Sources:

- https://developers.openai.com/apps-sdk/
- https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt/
- https://developers.openai.com/apps-sdk/build/mcp-server/
- https://developers.openai.com/apps-sdk/build/chatgpt-ui/
- https://developers.openai.com/apps-sdk/guides/security-privacy/
- https://developers.openai.com/apps-sdk/app-submission-guidelines/
- https://developers.openai.com/apps-sdk/reference/

Build ChatGPT apps as three parts: MCP server, iframe UI bundle, and model-facing tool metadata. The MCP server defines tools, enforces auth, returns structured data, and points tools to UI resources. The iframe UI renders structured results and communicates with the host through the MCP Apps bridge.

Prefer the MCP Apps standard bridge for portability. Use `window.openai` only for ChatGPT-specific capabilities. Security defaults should include least privilege, explicit user consent, server-side validation, audit logs, prompt-injection testing, and careful handling of secrets and PII.

## Commerce

Sources:

- https://developers.openai.com/commerce/
- https://developers.openai.com/commerce/guides/get-started/
- https://developers.openai.com/commerce/guides/best-practices/
- https://developers.openai.com/commerce/specs/file-upload/overview/
- https://developers.openai.com/commerce/specs/api/overview/
- https://openai.com/policies/commerce-policies/

Use Commerce and Agentic Commerce Protocol docs for product feeds and merchant/shopping integrations. Start with structured product feeds, keep product descriptions factual, validate URL fields, and check access requirements because partner availability and submission rules may change.

Commerce work must also check current commerce policies and any product/category restrictions. Payment, checkout, account linking, and write actions need explicit confirmation and careful auditability.

## Safety, Data, And Production

Sources:

- https://developers.openai.com/api/docs/guides/production-best-practices/
- https://developers.openai.com/api/docs/guides/deployment-checklist/
- https://developers.openai.com/api/docs/guides/safety-best-practices/
- https://developers.openai.com/api/docs/guides/safety-checks/
- https://developers.openai.com/api/docs/guides/your-data/
- https://developers.openai.com/api/docs/guides/rate-limits/
- https://developers.openai.com/api/docs/deprecations/
- https://openai.com/policies/usage-policies/

Before launch, check production best practices, deployment checklist, safety docs, data controls, rate limits, and deprecations. Use environment-specific projects/secrets, budget/rate controls, monitoring, retries, error handling, and abuse/safety checks appropriate to the application.

Do not promise privacy, retention, ZDR, residency, or compliance properties from memory. Verify the current data-control docs and the exact API features being used, especially background mode, stored responses, prompt caching, file uploads, and logs.
