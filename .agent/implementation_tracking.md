# Implementation Tracking

## Status

- Task: OpenAI Structured Outputs alignment for AI graph generation
- State: Done
- Last updated: 2026-04-25

## Plan

1. Read local OpenAI reference context and verify volatile API details against official docs.
2. Update project planning/context docs before changing runtime behavior.
3. Replace OpenAI JSON mode requests with Responses API Structured Outputs.
4. Refresh model defaults/options and sanitize nullable structured-output fields before validation.
5. Add request-construction regression tests, run verification, update docs, commit, and push.

## Progress Log

- [x] Step 1
- [x] Step 2
- [x] Step 3
- [x] Step 4
- [x] Step 5

## Decisions

- Decision: Keep direct Responses API calls for this pass and do not introduce Agents SDK/function calling.
- Reason: The workflow is a single typed final response, and the app already owns validation and side-effect application.
- Decision: Use strict Structured Outputs with nullable fields plus local null stripping.
- Reason: OpenAI strict schemas require all fields to be required, while GraphA operations have type-specific optional fields.
- Decision: Set `store: false` in OpenAI requests.
- Reason: This graph-generation path does not need default response storage.

## Blockers

- Blocker: None for implementation.
- Risk: Browser-local API keys remain a public-deployment security concern.
- Next action: Add Vercel serverless proxy/BYOK split in a follow-up if this becomes a shared production service.

## Verification

- Checks run:
  - `node --check js/ai/AIService.js`
  - `node -e "const fs=require('fs'); const acorn=require('acorn'); for (const f of ['js/main.js']) { acorn.parse(fs.readFileSync(f,'utf8'), {ecmaVersion:'latest', sourceType:'module'}); } console.log('parse ok');"`
  - `node --test tests/ai-flow.test.js`
  - `npm.cmd test`
  - `git diff --check`
- Result:
  - Passed. `git diff --check` reported line-ending warnings only.

## Handoff

- What changed:
  - OpenAI Responses requests now use strict Structured Outputs with the GraphA `operations[]` JSON Schema.
  - OpenAI text and vision requests set `store: false`, use configured reasoning effort and verbosity, and reuse shared output extraction.
  - OpenAI model defaults/options now use the current reference family (`gpt-5.5`, `gpt-5.5-pro`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano`).
  - Nullable fields emitted for strict schema compatibility are stripped before local validation/application.
  - Unit tests cover OpenAI request construction and response extraction without making network calls.
- What remains:
  - Public deployments should move API calls behind a Vercel/server-side proxy rather than storing API keys in browser local storage.
- Official sources checked:
  - `https://developers.openai.com/api/docs/models`
  - `https://developers.openai.com/api/docs/guides/structured-outputs`
  - `https://developers.openai.com/api/reference/resources/responses/methods/create`
