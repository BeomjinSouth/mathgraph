# AI Reference Validation Retry

## Task

Diagnose and reduce AI chat failures where GraphA `operations[]` contains `update` or `delete` operations for ids that are not present on the current canvas.

## Problem

The UI currently rejects model output when `SchemaValidator.validateReferences()` sees an operation id that is neither an existing canvas object nor a temporary id created earlier in the same batch. This is correct, but the OpenAI text path can still produce stale or invented ids such as `obj_...`, especially when prior response state is carried forward.

## Plan

1. Keep the validator strict so invalid references are not applied to the canvas.
2. Stop normal text drawing requests from automatically sending `previous_response_id`; each request already includes the current canvas context.
3. Add one text-command repair pass when schema or reference validation fails.
4. Update tests for the new request-state and repair behavior.
5. Run focused AI tests, full tests, build and whitespace checks, then record the result.

## Acceptance Criteria

- Normal OpenAI text drawing requests do not include stale `previous_response_id` by default.
- Callers can still pass an explicit previous response id for repair flows.
- A text command response with invalid `update` ids is repaired once before the UI applies it.
- Existing image repair behavior remains unchanged.

## Result

- Normal OpenAI text command requests now omit `previous_response_id` unless a caller passes one explicitly.
- `AIService.processCommand()` now validates model JSON against schema and current canvas references before returning it to the UI.
- If OpenAI text output uses stale or invented ids such as `obj_*` in `update/delete`, the service sends one repair request with the exact validation errors and previous JSON.
- The repair prompt tells the model to use `create` for new drawings and `update/delete` only for ids in the current canvas context.

## Verification

- `node --check js\ai\AIService.js`: passed.
- `node --test tests\ai-flow.test.js`: passed with 42 tests.
- `npm.cmd test`: passed with 172 tests.
- `npm.cmd run vercel-build`: passed.
- `git diff --check`: passed with line-ending warnings only.
