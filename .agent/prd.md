# PRD

## Summary

- Task: OpenAI Structured Outputs alignment for AI graph generation
- Owner: Codex
- Date: 2026-04-25
- Related files:
  - `js/ai/AIService.js`
  - `index.html`
  - `tests/ai-flow.test.js`
  - `docs/ai-reference.md`

## Problem

- The current OpenAI integration uses the Responses API, but still requests the older `json_object` JSON mode.
- The app already has a validated `operations[]` contract, so OpenAI Structured Outputs can enforce the same shape before the local validator runs.
- Model defaults and UI options are behind the current OpenAI reference context.

## Goals

- Use Responses API Structured Outputs with a strict JSON Schema for graph operations.
- Refresh OpenAI model defaults/options through configuration instead of scattered literals.
- Keep local schema validation and rollback-based patch application as the app-owned safety layer.
- Preserve the API-free deterministic fallback path.

## Non-Goals

- Do not introduce the Agents SDK or function-calling orchestration for this narrow graph-generation path.
- Do not migrate API keys to a Vercel serverless proxy in this pass.
- Do not change the graph object runtime contract beyond null-stripping required by strict structured output compatibility.

## Acceptance Criteria

- [x] OpenAI text and vision requests use `text.format.type = "json_schema"` with `strict: true`.
- [x] The request body sets `store: false` and uses configured `reasoning.effort` / `text.verbosity`.
- [x] OpenAI model defaults and UI model options include current reference models.
- [x] Structured output JSON is parsed and sanitized before the existing validator/applier flow.
- [x] Unit tests cover request construction without real network calls.
- [x] `npm.cmd test` passes.

## Risks and Open Questions

- Strict Structured Outputs require all schema fields to be required; optional graph fields will be represented as nullable values and stripped locally before validation/application.
- Browser-stored API keys remain acceptable only for personal/BYOK usage; public deployment should move API calls behind a server-side proxy in a follow-up.

---

## Previous Summary

- Task: Mk2.2 usability and AI/runtime parity improvements
- Owner: Codex
- Date: 2026-04-13
- Related files:
  - `js/main.js`
  - `js/core/Canvas.js`
  - `js/ui/CommandPalette.js`
  - `js/objects/Point.js`
  - `js/ai/SchemaValidator.js`
  - `js/ai/PatchApplier.js`
  - `docs/ai-reference.md`

## Problem

- What is broken or missing?
  - SVG export is still a placeholder and does not export actual geometry.
  - Axis visibility state is handled inconsistently across canvas rendering, export, and command palette actions.
  - AI/runtime parity is incomplete: `numberLine` exists in the runtime but is not fully handled across AI validation/application/docs.
  - Function-line intersections are defined conceptually but still return no computed intersections.
- Why does this matter now?
  - These gaps sit on user-facing paths that are already visible in the UI, so they reduce trust more than a purely missing future feature.

## Goals

- Primary goal:
  - Improve reliability of visible, high-frequency features without broad refactors.
- Secondary goal:
  - Reduce mismatch between UI/runtime capabilities and AI-assisted workflows.
  - Close one important geometry correctness gap for analytic use cases.

## Non-Goals

- Out of scope:
  - Full general-purpose SVG serializer for every object type.
  - Full dimension-driving workflow UI.
  - Multi-file project management or cloud collaboration.

## Scope

- In scope:
  - Make axis toggles behave consistently in canvas rendering, export, and command palette actions.
  - Upgrade SVG export from an empty shell to a useful first-pass vector export for common 2D objects.
  - Add AI support for creating `numberLine` objects in validator, patch application, and docs.
  - Implement function-line intersection solving for graph/function workflows.
- Constraints:
  - Do not overwrite unrelated in-progress user changes in the dirty worktree.
  - Keep edits focused and incremental because several core files already contain other modifications.
- Assumptions:
  - Existing Vercel linking is already configured and only needs to remain intact.
  - GitHub push may be blocked if this repo still has no remote configured.

## Acceptance Criteria

- [x] Exporting SVG produces visible vector content for common supported objects instead of a blank file.
- [x] Axis visibility uses the same state model in normal rendering, exports, and command palette actions.
- [x] AI can create a `numberLine` object through the validated patch flow.
- [x] Function-line intersection objects resolve real intersection points when intersections exist.

## Risks and Open Questions

- Risks:
  - SVG export may still need partial fallbacks for complex objects or labels.
  - Function intersection solving can produce unstable results around vertical or tangent cases if the numeric method is weak.
- Open questions:
  - Whether `polygon` should join this AI/runtime parity pass or remain a later follow-up.
