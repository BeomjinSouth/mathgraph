# Vercel Direct Prompt Fallback

## Summary

- Date: 2026-06-16
- Task: Make previously audited CSAT-style prompts behave correctly when entered directly into the production Vercel UI without an API key.
- Scope:
  - `js/ai/AIService.js`
  - `tests/ai-flow.test.js`
  - project task notes

## Problem

Production UI smoke on `https://mathgraph-five.vercel.app/` showed that the exact nested rectangular-prism request works in local fallback mode, but previously audited CSAT-style prompts collapse into weak generic fallback output when no OpenAI API key is configured:

- `2/x` hyperbola prompt produced one invalid/empty function path instead of a hyperbola with asymptotes and labeled points.
- three-circle pairwise-lens prompt produced only one circle and two visible center points.
- square-pyramid midsection prompt produced only a filled quadrilateral, not a first-class `pyramid`.

This is misleading because the chat says objects were created even when the result does not match the request.

## Implementation Plan

1. Add deterministic fallback builders before generic function/circle/solid fallback.
2. Keep each builder tightly scoped to the prior audited prompt families.
3. Use only existing GraphA primitives: `function`, `line`, `point`, `circle`, `lensRegion`, `pyramid`, `polygon`, and `segment`.
4. Add focused regression tests for the expected object families and visible-label rules.
5. Verify locally, deploy to Vercel, and run production UI smoke against the same prompts.

## Acceptance Criteria

- The hyperbola prompt creates `2/x`, two dashed asymptote lines, and visible `A,B,C,D` points.
- The three-circle prompt creates three circles, three `lensRegion` objects, hidden centers/radius points, and only external `O,P,Q` label anchors.
- The square-pyramid prompt creates a first-class `pyramid`, a shaded midsection polygon, and a dashed height segment with helper points hidden.
- Production UI direct prompts no longer silently degrade into unrelated generic shapes for these three prior cases.

## Result

- Implemented targeted local fallback builders in `AIService`.
- Added focused AI-flow tests for all three prompt families.
- Deployed to Vercel production deployment `dpl_5J2eAU3WZbAzGK2tSRuGqAGQbo6f`.
- Final production UI smoke on `https://mathgraph-five.vercel.app/` passed for the nested prism prompt plus the hyperbola, three-circle lens, and square-pyramid midsection prompts.
- The three-circle label anchors use `pointSize:0`, so labels remain outside the circles without visible anchor dots.
