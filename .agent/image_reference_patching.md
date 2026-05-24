# Image Reference Patching Plan

## Summary

- Task: Clipboard image reference and targeted AI graph patching
- Owner: Codex
- Date: 2026-05-24
- Related files:
  - `index.html`
  - `js/main.js`
  - `js/ai/AIService.js`
  - `tests/ai-flow.test.js`
  - `docs/ai-reference.md`

## Problem

MathGraph already supports AI drawing through the OpenAI Responses API and a strict GraphA `operations[]` contract. The image path currently depends on file upload, and image analysis always behaves like full diagram reconstruction. Users need a faster paste workflow and a clearer route for "change only this part" requests.

## Goals

- Let users paste an image into the AI chat from the clipboard.
- If an image has no text instruction, ask the model to recreate the visible math diagram as GraphA objects.
- If an image is paired with text, ask the model to apply only the requested graph-object changes.
- Include current canvas objects and selected-object IDs in image prompts so the model can reuse existing IDs.
- Keep the current Responses API, strict Structured Outputs, local validation, and rollback patching contract.

## Non-Goals

- Do not implement raster image generation or pixel-level inpainting in this pass.
- Do not add a mask drawing UI in this pass.
- Do not add a server-side OpenAI proxy in this pass.

## Acceptance Criteria

- [x] Clipboard image paste is supported in the chat.
- [x] Image-only paste/upload reconstructs the diagram.
- [x] Image plus text produces a targeted patch prompt.
- [x] Current canvas and selection context are included in image analysis.
- [x] Tests cover prompt construction and image request construction without live API calls.

## Completion Notes

- Added document-level clipboard image handling that ignores non-chat editable fields.
- Kept upload behavior automatic while letting typed instructions switch image handling into targeted patch mode.
- Added prompt builders for image recreation and partial patching.
- Verified with unit tests, full test suite, syntax checks, diff check, and Playwright CLI browser smoke checks.

## Official Source Notes

- Responses API accepts `input_image` content in model input.
- Image input docs list PNG, JPEG, WEBP, and non-animated GIF as supported input types.
- OpenAI image edit endpoints support mask-based raster edits, but this pass stays within MathGraph's vector-object patch flow.

## Risks

- Vision-to-vector conversion is approximate and cannot guarantee pixel-identical reconstruction.
- Targeted edits are most reliable when the user selects objects, references labels, or describes the target unambiguously.
- The browser-side BYOK key storage remains a personal-use compromise.

## 2026-05-25 Guardrail Update

- Patch mode now performs semantic intent validation after schema/reference validation.
- If a selected-object mutation request ignores selected IDs, the app rejects it instead of applying a schema-valid but wrong patch.
- Strict selected-object edits cannot create new objects or mutate unselected IDs.
- OpenAI image analysis retries once with the validation errors before failing.
- Image/text prompts now try to load the project JSON manual and inject compact supported-type, required-field, known-gap, and operation-budget guidance.
