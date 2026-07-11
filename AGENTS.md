# AGENTS.md

이 문서는 `C:\Users\pbj95\Desktop\cursor (2)\cursor (2) (2)\Math\mathGraph` 작업 시 모든 에이전트와 작업자가 공통으로 따라야 하는 운영 기준이다.

## 기본 원칙

1. 매 작업이 끝날 때마다 GitHub에 푸시한다.
2. 모든 프로젝트는 Vercel에 자동으로 연동되도록 유지한다.
3. 신규 기능 또는 신규 프로젝트 작업 전에는 사전 문서를 먼저 작성한다.
4. 작업 중에는 사전 문서를 계속 참고한다.
5. 작업이 끝난 뒤에는 사전 문서에 진행 상황과 변경 사항을 반영한다.

## 작업 전 필수 문서

신규 기능이나 신규 프로젝트를 시작할 때는 아래 항목을 먼저 준비한다.

- PRD
- implementation 문서
- 필요한 skills 정리
- 작업 범위, 목표, 제약사항, 완료 기준

가능하면 위 문서는 `.agent/` 또는 `docs/` 아래에 일관된 이름으로 보관하고, 실제 구현 전에 먼저 초안을 만든다.

## 작업 중 체크리스트

- 현재 문서와 실제 구현이 어긋나지 않는지 확인한다.
- 새로 추가한 기능, 설정, 도구, 배포 방식이 문서에 반영되어 있는지 확인한다.
- GitHub 푸시와 Vercel 연동 가능 상태를 항상 함께 점검한다.

## 작업 후 업데이트

- PRD 진행 상태 업데이트
- implementation 문서 업데이트
- 필요한 skills 변경 사항 업데이트
- 작업 결과, 남은 이슈, 다음 작업 메모 기록

## 현재 워크스페이스 점검 메모

- GitHub 푸시 규칙을 지키려면 이 워크스페이스가 Git 저장소로 연결되어 있어야 한다.
- Vercel 자동 연동 규칙을 지키려면 프로젝트 루트에 배포 연결 상태를 확인할 수 있어야 한다.
- 위 두 항목이 아직 준비되지 않았다면 다음 작업 전에 먼저 설정 여부를 확인한다.


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

- Vercel project linkage is present in `.vercel/project.json`.
- Vercel project: `mathgraph`.
- Vercel project ID: `prj_72kqKNP31NaiZ86JHAhyRGF6kXIw`.
- Vercel org/team ID: `team_IisUu66EBjsNE4JkX4qO2UAZ`.
- Primary production alias: `https://mathgraph-five.vercel.app`.
- Current direct-deploy branch used by Codex: `codex/ai-fallback-recovery`.
- Environment variables:
  - `OPENAI_API_KEY` is required for the `박범진` owner default OpenAI proxy to call OpenAI.
  - `MATHGRAPH_LOGIN_SECRET` is **required**. Owner-session tokens are signed with it and the server now fails closed (503) when it is missing — there is no hardcoded fallback secret.
  - `MATHGRAPH_OWNER_PASSWORD` is **required** for owner login. Owner login now checks name **and** this password; if it is unset, owner login is disabled (503) and only guest mode (bring-your-own-key) works.
  - `MATHGRAPH_OWNER_NAME` is optional and defaults to `박범진`.
  - `MATHGRAPH_OWNER_TOKEN_TTL_MS` is optional and controls owner-session token lifetime.
  - `MATHGRAPH_PROXY_ALLOWED_MODELS` is optional (comma-separated). Overrides the OpenAI proxy model allow-list without a code deploy; defaults to `gpt-5.5, gpt-5.5-pro, gpt-5.4, gpt-5.4-mini, gpt-5.4-nano`.
  - `MATHGRAPH_PROXY_MAX_BODY_BYTES` is optional and caps the proxy request body size (default 10 MB).
  - `MATHGRAPH_PROXY_RATE_WINDOW_MS` / `MATHGRAPH_PROXY_RATE_MAX` are optional and tune the per-token proxy rate limit (default 30 requests / 60 s, enforced per serverless instance).
  - `MATHGRAPH_LOGIN_RATE_WINDOW_MS` / `MATHGRAPH_LOGIN_RATE_MAX` are optional and tune the login attempt rate limit (default 10 tries / 15 min per client address + name).
  - `MATHGRAPH_PROXY_MAX_OUTPUT_TOKENS` is optional and caps the forced `max_output_tokens` on proxied Responses requests (default 16384).
  - `MATHGRAPH_PROXY_TIMEOUT_MS` is optional and bounds the upstream OpenAI request time (default 120000 ms; the proxy returns 504 on timeout).
- Current Vercel environment check on 2026-06-16: `OPENAI_API_KEY` and `MATHGRAPH_LOGIN_SECRET` are configured as encrypted Production environment variables. `MATHGRAPH_OWNER_NAME` is intentionally not configured in Production, so the UTF-8 source default owner name is used. Preview branch env setup is unavailable until the Vercel project is connected to a Git repository, and Vercel does not allow Sensitive variables in Development.
- Production deploy command: `npx.cmd vercel deploy --prod --yes`.
- Deployment verification steps:
  - Run `npm.cmd test`.
  - Run `npm.cmd run vercel-build`.
  - Run `git diff --check`.
  - Run `npx.cmd vercel inspect <deployment-url>` and confirm `target` is `production`, `status` is `Ready`, and the production alias is attached.
  - Check `https://mathgraph-five.vercel.app/` returns HTTP 200.
  - For runtime smoke, load the production URL in Playwright and confirm `window.app` exists with no console errors or failed requests.
