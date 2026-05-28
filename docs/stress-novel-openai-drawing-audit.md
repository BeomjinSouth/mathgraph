# Stress Novel OpenAI Drawing Audit

Last updated: 2026-05-28

## Scope

This note defines and audits the new `stress_novel` drawing set. It intentionally avoids duplicating the previous `default`, `extended`, `stress`, and `stress_extra` prompt families.

The live API key is not recorded here. A live OpenAI run is blocked in the current shell because `OPENAI_API_KEY` is not available through the process, user, or machine environment.

## Evidence

Local reference targets were rendered without an API call:

```powershell
$env:LIVE_AI_PROMPT_SET='stress_novel'
$env:LIVE_AI_RENDER_REFERENCE_TARGETS='1'
$env:LIVE_AI_OUTPUT_DIR='tmp/live-openai-stress-novel-reference-targets'
node tools\run-live-openai-random-drawing-smoke.mjs
```

Result: 10 reference targets validated and rendered, 0 failures, 0 browser console errors.

- Contact sheet: `tmp/live-openai-stress-novel-reference-targets/contact-sheet.png`
- Report: `tmp/live-openai-stress-novel-reference-targets/reference-target-report.md`

Attempting the live external path without an environment key stops before any API call:

```text
OPENAI_API_KEY is required.
```

## Prompt / Target Comparison

| ID | Prompt target | Reference target judgement | Root cause / risk | Fix or context update |
| --- | --- | --- | --- | --- |
| `logistic_midpoint_asymptotes` | Logistic curve with two horizontal asymptotes, midpoint, and tangent. | Matches: one function, two dashed horizontal lines, point M, tangent at x=0. | A model can draw generic samples instead of exact asymptotes/tangent x. | Added exact function-expression, line-pattern, point-window, and tangent-x checks. |
| `parabola_focus_directrix_latus` | Parabola with focus, vertex, directrix, and latus rectum. | Matches: directrix is dashed y=-1, F/V/L/R are visible. | Focus/directrix prompts fail when line equations or named points are implicit. | Prompt now supplies exact coordinates and line equation; validator checks them. |
| `absolute_plateau_cap_region` | Absolute-value plateau with capped shaded region. | Matches after correction: function, y=6 line, A/B/L/R, filled trapezoid. | Initial expectation over-counted support points; curved function-bounded fills are only polygon approximations. | Relaxed point count to the actual target and documented polygon approximation limits. |
| `three_inequality_feasible_region` | Feasible triangle for x>=0, y>=0, x+y<=6. | Matches: three boundary lines and shaded OAB region. | Boundary lines can visually pass while equations are wrong. | Validator checks x=0, y=0, and slope/intercept for x+y=6. |
| `concentric_quarter_sector_wedge` | Two concentric circles plus an outer quarter-sector fill. | Matches after wording correction: outer sector is filled, inner circle remains an outline. | Original wording could imply an exact ring-sector cutout, but `annularSector` is not supported. | Prompt and docs now state the current approximation; `annularSector` remains a future primitive. |
| `external_point_two_tangents` | Two tangents from P to a radius-3 circle, with radius segments and right angles. | Matches: two tangent lines/segments and T1/T2 right-angle markers. | Tangency diagrams can drift if the circle radius or tangent-point coordinates are not fixed. | Added radius, point-window, and named segment checks. |
| `triangle_euler_line` | Triangle with circumcircle and collinear O/G/H Euler-line points. | Matches: O, G, H are on one dashed line. | Object existence alone does not prove the three named centers are collinear. | Added collinear named-point validation. |
| `pentagon_pentagram_diagonals` | Regular pentagon with five star diagonals. | Matches: unfilled pentagon outline, circumcircle, pentagram segments. | Polygon defaults can create unintended fill; diagonals can be omitted. | Validator requires fillOpacity 0 and named diagonal segments. |
| `prism_diagonal_cross_section` | Rectangular prism with internal diagonal and shaded cross-section. | Matches: first-class prism, body diagonal, internal cross-section polygon. | Cross-section helper points can drift outside the prism projection. | Reuses prism projection and inner-point containment checks. |
| `triangular_pyramid_inside_triangular_prism` | Triangular pyramid inside a triangular prism. | Matches: 3/3 outer prism and 3-base inner pyramid. | A model may use rectangular prisms or degenerate pyramid bases. | Validator requires triangular prism counts, triangular pyramid base, apex validity, and containment. |

## Improvements Made

- Added `LIVE_AI_PROMPT_SET=stress_novel` with 10 new non-overlapping prompts.
- Added deterministic `referencePayload` targets for all 10 prompts.
- Added `LIVE_AI_RENDER_REFERENCE_TARGETS=1` so intended targets can be rendered and shown without `OPENAI_API_KEY`.
- Removed the coordinate overlay and corrected the contact-sheet title for local reference renders.
- Added prompt-local checks for exact function expressions, named support segments, fixed circle radii, concentric circle radii, and collinear named points.
- Added prompt/context guidance for focus/directrix diagrams, fixed-radius tangency, feasible regions, concentric circles, annular-sector limitations, and function-bounded polygon approximations.

## Remaining Live Step

Run this after setting `OPENAI_API_KEY` safely in the process environment:

```powershell
$env:LIVE_AI_PROMPT_SET='stress_novel'
$env:LIVE_AI_OUTPUT_DIR='tmp/live-openai-stress-novel-drawing-smoke'
$env:LIVE_AI_MAX_OUTPUT_TOKENS='14000'
$env:LIVE_AI_MAX_ATTEMPTS='4'
node tools\run-live-openai-random-drawing-smoke.mjs
```

The expected recursive loop is the same as the earlier accepted stress batches: reject any payload that fails the prompt-local gates, rerun with repair feedback, compare screenshots against the local target sheet, then promote any newly observed visual mismatch into a validator or prompt-context rule.
