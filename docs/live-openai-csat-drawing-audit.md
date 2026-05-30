# Live OpenAI CSAT-Style Drawing Audit

Last updated: 2026-05-30

## Scope

This note records a live OpenAI Responses API check for CSAT/mock-exam-style MathGraph drawings. The run reused the existing `stress_novel` prompt set because it covers non-overlapping graph, analytic geometry, circle, construction, polygon, and solid-diagram cases.

The API key was supplied only through the process environment for the live command. The key is not written to reports, screenshots, docs, or committed source files.

## Model Availability Check

Checked through the live API model list for the supplied key on 2026-05-30:

- Exact `gpt-5.5-mini`: not visible in `/v1/models`, so this project should treat it as unavailable for this key.
- Visible `gpt-5.5` family: `gpt-5.5`, `gpt-5.5-2026-04-23`, `gpt-5.5-pro`, `gpt-5.5-pro-2026-04-23`.
- Visible mini alternatives include `gpt-5.4-mini`, `gpt-5-mini`, `gpt-4.1-mini`, and `gpt-4o-mini`.
- Tiny `/v1/responses` calls succeeded for `gpt-5.5` and `gpt-5.4-mini`; `gpt-5.5-mini` was not called because the exact model ID was not visible.

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
| `concentric_quarter_sector_wedge` | Two concentric circles plus an outer quarter-sector fill. | Pass with minor visual issue. | The circles, radii, and filled supported sector are present. The requested 90-degree marker object exists but is not easy to see because it sits at the filled center/radius intersection. |
| `external_point_two_tangents` | Two tangents from an external point to a radius-3 circle, with radius segments and right-angle markers. | Pass with label/readability issue. | Tangency, radius segments, and right-angle markers are present. The `T2` label sits too close to the marker/line, so it needs label-offset guidance for polished worksheets. |
| `triangle_euler_line` | Triangle, circumcircle, centroid/circumcenter/orthocenter on a dashed Euler line. | Pass with label/readability issue. | The triangle, circumcircle, dashed Euler line, and collinear center points are present, but `O/G/H` labels are cramped along the dashed line. |
| `pentagon_pentagram_diagonals` | Regular pentagon, circumcircle, and pentagram diagonals. | Pass. | Produced an unfilled pentagon outline, circumcircle, and five star diagonals. |
| `prism_diagonal_cross_section` | Rectangular prism with internal diagonal and shaded cross-section. | Needs rerun / prompt strengthening. | The required object families were created, but the rendered box is too cube-like and the shaded section reads as a small internal square rather than a broad middle cross-section. It is "made" structurally, but not good enough as a textbook-style target. |
| `triangular_pyramid_inside_triangular_prism` | Triangular pyramid inside a triangular prism. | Needs rerun / prompt strengthening. | The `prism` and `pyramid` objects exist, but the projection is cramped and visually ambiguous; the inner pyramid does not read cleanly as inside a larger triangular prism. |

## Root-Cause Fix

The root cause was not API connectivity or JSON parsing. The smoke validator accepted object-family presence and renderability but did not yet encode several human-visible quality rules:

- required labels near tangency points or collinear construction points need explicit `labelOffset`;
- a default small `rightAngleMarker` can be technically present but visually weak at a crowded center point;
- solid diagrams need projection-size and aspect checks, not only `prism`/`pyramid` object counts;
- cross-section polygons need minimum area/span ratios against the outer prism;
- inner solids need visible projection margins, not only containment.

The live smoke runner now has prompt-local validators for those cases. Revalidating the saved live result file without another API call now rejects 5 outputs:

```powershell
$env:LIVE_AI_REVALIDATE_RESULTS='tmp/live-openai-csat-drawing-smoke-20260530/live-openai-random-results.json'
node tools\run-live-openai-random-drawing-smoke.mjs
```

Expected result after the fix: failure count 5. The rejected IDs are `concentric_quarter_sector_wedge`, `external_point_two_tangents`, `triangle_euler_line`, `prism_diagonal_cross_section`, and `triangular_pyramid_inside_triangular_prism`.

Follow-up generation-side fix: `js/ai/DiagramQualityEnhancer.js` now runs after AI JSON parsing for command/recreate flows. It adds the missing label offsets and larger right-angle aids, and normalizes weak prism cross-section and triangular-prism/pyramid projection layouts before the result reaches semantic validation or the canvas. Selected-object patch mode is intentionally excluded.

The strengthened local reference targets still render successfully:

```powershell
$env:LIVE_AI_PROMPT_SET='stress_novel'
$env:LIVE_AI_RENDER_REFERENCE_TARGETS='1'
$env:LIVE_AI_OUTPUT_DIR='tmp/live-openai-csat-reference-rootfix-20260530'
node tools\run-live-openai-random-drawing-smoke.mjs
```

Result: 10 reference targets rendered, 0 failures, 0 browser console errors.

## Summary

- Automated outcome: 10 of 10 live outputs passed schema validation, reference validation, intent validation, runtime readability, semantic validation, and browser rendering.
- Strict visual outcome:
  - 5 direct passes: logistic, parabola, absolute-value region, feasible region, pentagon/pentagram.
  - 3 passes with minor readability issues: concentric sector angle marker, external tangents label placement, Euler-line center-label crowding.
  - 2 need rerun or stricter prompt constraints: rectangular prism cross-section, triangular pyramid inside triangular prism.
- Follow-up outcome: the validator and prompt set now reject those 5 weak saved outputs instead of accepting them as all-pass.
- The strongest remaining product gaps are still native chart primitives, exact annular sectors, richer function-bounded fills, and first-class curved solid primitives.

## Verification

- Ran local reference rendering for `stress_novel`; passed with 10 targets and 0 console errors.
- Ran live OpenAI drawing smoke for `stress_novel`; passed with 10 outputs, 0 failures, and 0 console errors.
- Inspected the live and reference contact sheets, then opened the 10 live screenshots one by one for stricter visual review.
- Queried `/v1/models` and ran tiny `/v1/responses` checks for available `gpt-5.5` and `gpt-5.4-mini` models.
- Revalidated the saved live result file after the root-cause fix; expected failure count 5 confirmed.
- Rendered the strengthened local reference targets under `tmp/live-openai-csat-reference-rootfix-20260530/`; passed with 10 targets and 0 console errors.
- Ran a secret-pattern scan for actual `sk-proj-...` values outside `node_modules` and `.git`; no matches.
