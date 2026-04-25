# OpenAI GuideLine Project Instructions

## Project purpose

This repository is a local context hub for OpenAI developer documentation. Use it to route future coding, product, and architecture work to the right official OpenAI sources before implementation.

## Required reading at the start of every task

1. Read this `AGENTS.md`.
2. Read `docs/openai-url-inventory.yaml` when the task needs exact current source coverage.
3. Read `docs/openai-context-map.md`.
4. Read `docs/openai-core-summaries.md`.
5. Read `docs/openai-docs-map.yaml`.
6. Read `docs/vibecoding-openai-guide.md`.
7. Read `docs/progress-log.md` for recent decisions, verification notes, and unresolved setup issues.

## Source of truth

- Treat current official OpenAI documentation as the source of truth.
- Prefer the OpenAI Developer Docs MCP if available.
- If that MCP is unavailable, browse only official OpenAI sources such as:
  - `https://developers.openai.com/`
  - `https://platform.openai.com/`
  - `https://openai.com/`
  - `https://help.openai.com/`
- Re-verify volatile facts before relying on them: model availability, prices, rate limits, API schemas, deprecations, product names, policy guidance, and release status.
- Do not treat the local notes as frozen API documentation. They are a routing layer and working memory.

## Before changing behavior or structure

- For new features, new projects, behavior changes, architecture changes, or major document restructuring, update or create the relevant plan/context note first.
- Keep routing information in `docs/openai-docs-map.yaml`.
- Keep human-readable synthesis in `docs/openai-context-map.md` and `docs/vibecoding-openai-guide.md`.

## Verification

- For documentation-only changes, run `git diff --check` when possible.
- For inventory changes, run `powershell -ExecutionPolicy Bypass -File tools\check-openai-docs-inventory.ps1`.
- For scripts or generated artifacts, run the narrowest useful validation command and record the result in `docs/progress-log.md`.
- If verification is skipped or blocked, record the reason in `docs/progress-log.md`.

## Completion rules

- At the end of each task, update `docs/progress-log.md` with what changed, what was verified, and any blocked follow-up.
- Commit completed changes locally.
- Push to GitHub when a remote is configured. If push is impossible, record the attempted command, failure reason, and next action in `docs/progress-log.md`.

## Deployment

- This project currently has no Vercel deployment configuration.
- If Vercel is later added, document the project ID, target branch, environment variables, and deployment verification steps here instead of hardcoding them in prompts.
