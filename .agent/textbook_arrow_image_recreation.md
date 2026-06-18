# Textbook Arrow And Image Recreation Plan

## Summary

- Task: 교과서식 화살표 지원 확인 및 이미지 재구성 품질 보강
- Owner: Codex
- Date: 2026-06-18
- Related files:
  - `js/core/Canvas.js`
  - `js/main.js`
  - `js/ai/AIService.js`
  - `js/ai/SceneGraphCompiler.js`
  - `docs/ai-reference.md`
  - `.agents/skills/mathgraph-drawing/references/feature-manual.json`
  - `runtime/mathgraph-drawing/references/feature-manual.json`

## Problem

The app has a `vector` object with a filled triangular arrowhead, but the current `ray` render path draws only an extended line with no arrowhead. The AI schema also has no separate `arrow` object, so textbook annotation arrows from an image must be represented as `vector` objects. Image-only recreation already exists, but the prompt/manual guidance is too generic for coordinate graph screenshots like the provided `y=x+2` and `y=2sqrt(x)` example.

## Goals

- Make `ray` render with an arrowhead on canvas and SVG export.
- Keep the current filled triangular arrowhead style consistent with axes and vectors.
- Teach the scene graph/manual path that `arrow`, `directionArrow`, and annotation arrows should compile to `vector`.
- Strengthen image recreate guidance for function-graph screenshots: recover axes, function expressions, point labels, connecting segments, and math labels as editable GraphA objects.

## Non-Goals

- Do not add a brand-new first-class `arrow` runtime object in this pass.
- Do not promise pixel-perfect OCR or typography matching.
- Do not change OpenAI model choices or Vercel environment variables.
- Do not implement a full scene-graph replacement for live image calls in this pass.

## Acceptance Criteria

- `ray` canvas rendering draws a filled arrowhead at its visible end.
- SVG export treats `ray` like a directed object with an arrowhead.
- Scene graph aliases for arrow-like nodes resolve to `vector`.
- AI reference docs explain that standalone textbook arrows should use `vector`.
- Tests cover arrowhead rendering/export behavior or equivalent narrow logic.
