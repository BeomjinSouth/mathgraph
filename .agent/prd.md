# PRD

## Summary

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
