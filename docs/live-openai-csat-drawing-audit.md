# Live OpenAI CSAT-Style Drawing Audit

Last updated: 2026-05-30

## Scope

This note records a live OpenAI Responses API check for CSAT/mock-exam-style MathGraph drawings. The run reused the existing `stress_novel` prompt set because it covers non-overlapping graph, analytic geometry, circle, construction, polygon, and solid-diagram cases.

The API key was supplied only through the process environment for the live command. The key is not written to reports, screenshots, docs, or committed source files.

## Evidence

Local reference targets:

```powershell
$env:LIVE_AI_PROMPT_SET='stress_novel'
$env:LIVE_AI_RENDER_REFERENCE_TARGETS='1'
$env:LIVE_AI_OUTPUT_DIR='tmp/live-openai-csat-reference-20260530'
node tools\run-live-openai-random-drawing-smoke.mjs
```

Result: 10 reference targets rendered, 0 failures, 0 browser console errors.

- Contact sheet: `tmp/live-openai-csat-reference-20260530/contact-sheet.png`
- Report: `tmp/live-openai-csat-reference-20260530/reference-target-report.md`

Live OpenAI run:

```powershell
$env:OPENAI_API_KEY='<provided process-only key>'
$env:LIVE_AI_PROMPT_SET='stress_novel'
$env:LIVE_AI_OUTPUT_DIR='tmp/live-openai-csat-drawing-smoke-20260530'
$env:LIVE_AI_MAX_OUTPUT_TOKENS='14000'
$env:LIVE_AI_MAX_ATTEMPTS='4'
node tools\run-live-openai-random-drawing-smoke.mjs
```

Result: 10 live outputs rendered, 0 validation failures, 0 browser console errors.

- Model selected by visible model list: `gpt-5.4-mini`
- Contact sheet: `tmp/live-openai-csat-drawing-smoke-20260530/contact-sheet.png`
- Report: `tmp/live-openai-csat-drawing-smoke-20260530/live-openai-random-report.md`
- Results JSON: `tmp/live-openai-csat-drawing-smoke-20260530/live-openai-random-results.json`

## Prompt / Result Comparison

| ID | Prompt target | Live result judgement | Notes |
| --- | --- | --- | --- |
| `logistic_midpoint_asymptotes` | Logistic curve, horizontal asymptotes `y=0`, `y=4`, point `M(0,2)`, tangent at `x=0`. | Pass. | Needed 3 attempts, then produced the exact function, two dashed asymptote lines, midpoint `M`, and one `tangentFunction`. |
| `parabola_focus_directrix_latus` | Parabola `0.25*x^2`, focus, vertex, dashed directrix, and latus rectum. | Pass. | Needed 2 attempts, then matched the requested focus/directrix/latus-rectum structure with 4 visible labels. |
| `absolute_plateau_cap_region` | Absolute-value plateau graph capped by a horizontal line, with shaded cap region. | Pass. | First attempt matched the function, cap line, four named points, and shaded polygon approximation. |
| `three_inequality_feasible_region` | Feasible triangle for `x>=0`, `y>=0`, `x+y<=6`. | Pass. | First attempt produced the three boundary lines and the shaded triangular feasible region. |
| `concentric_quarter_sector_wedge` | Two concentric circles plus an outer quarter-sector fill. | Pass within current primitive limits. | Result matches the supported target: outer sector fill plus inner circle outline. This is not a true annular-sector cutout because `annularSector` is not first-class yet. |
| `external_point_two_tangents` | Two tangents from an external point to a radius-3 circle, with radius segments and right-angle markers. | Pass. | The live drawing uses tangent geometry plus finite support segments; the reference target also includes full tangent lines. If a worksheet needs full infinite tangent lines, the prompt should say that explicitly. |
| `triangle_euler_line` | Triangle, circumcircle, centroid/circumcenter/orthocenter on a dashed Euler line. | Pass. | Matched the construction and kept `O`, `G`, `H` collinear on the dashed line. |
| `pentagon_pentagram_diagonals` | Regular pentagon, circumcircle, and pentagram diagonals. | Pass. | Produced an unfilled pentagon outline, circumcircle, and five star diagonals. |
| `prism_diagonal_cross_section` | Rectangular prism with internal diagonal and shaded cross-section. | Pass with visual-proportion caveat. | First-class `prism`, body diagonal, and cross-section polygon were present and rendered. The live prism is more compact/cube-like than the reference rectangular box; add aspect-ratio/projection constraints if textbook proportions matter. |
| `triangular_pyramid_inside_triangular_prism` | Triangular pyramid inside a triangular prism. | Pass with readability caveat. | First-class 3/3 triangular `prism` and triangular-base `pyramid` were present and rendered. The live result is compact; future prompts can require wider projection separation for print readability. |

## Summary

- Automated outcome: 10 of 10 live outputs passed schema validation, reference validation, intent validation, runtime readability, semantic validation, and browser rendering.
- Visual outcome: 8 of 10 are direct matches to the intended target; 2 of 10 are acceptable but should get stricter proportion/readability wording for production worksheet-style diagrams.
- No runtime code change was needed for this pass.
- The strongest remaining product gaps are still native chart primitives, exact annular sectors, richer function-bounded fills, and stronger projection/layout constraints for compact solid diagrams.

## Verification

- Ran local reference rendering for `stress_novel`; passed with 10 targets and 0 console errors.
- Ran live OpenAI drawing smoke for `stress_novel`; passed with 10 outputs, 0 failures, and 0 console errors.
- Inspected the live and reference contact sheets.
- Ran a secret-pattern scan for actual `sk-proj-...` values outside `node_modules` and `.git`; no matches.
