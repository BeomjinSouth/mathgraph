# Fresh CSAT-Style Drawing Audit

Last updated: 2026-05-30

## Scope

This note records the fresh `fresh_csat` prompt set added after the previous `stress_novel` audit. The set covers additional CSAT/mock-exam-style graphs and diagrams and was checked against rendered PNGs, not only against JSON validity.

The supplied OpenAI API key was used only as a process-scoped environment variable for live calls. It was not written to source files, generated reports, screenshots, or persistent environment settings.

## Evidence

Fresh local reference render:

```powershell
$env:LIVE_AI_PROMPT_SET='fresh_csat'
$env:LIVE_AI_RENDER_REFERENCE_TARGETS='1'
$env:LIVE_AI_OUTPUT_DIR='tmp/live-openai-fresh-csat-reference-20260530-final'
node tools\run-live-openai-random-drawing-smoke.mjs
```

Result: 10 reference targets rendered, 0 validation failures, 0 browser console errors.

- Contact sheet: `tmp/live-openai-fresh-csat-reference-20260530-final/contact-sheet.png`
- Report: `tmp/live-openai-fresh-csat-reference-20260530-final/reference-target-report.md`
- Screenshots: `tmp/live-openai-fresh-csat-reference-20260530-final/screenshots/`

Fresh live OpenAI evidence:

- Part 1: `tmp/live-openai-fresh-csat-drawing-smoke-20260530-part1/`
- Part 2: `tmp/live-openai-fresh-csat-drawing-smoke-20260530-part2/`
- Part 3: `tmp/live-openai-fresh-csat-drawing-smoke-20260530-part3/`
- Part 4: `tmp/live-openai-fresh-csat-drawing-smoke-20260530-part4/`
- Final box-plot rerun: `tmp/live-openai-fresh-csat-drawing-smoke-20260530-boxplot-rerun2/`

Result: 10 final live outputs rendered, 0 final validation failures, 0 browser console errors.

## Prompt / Live Result Comparison

| ID | Prompt intent | Visual judgement |
| --- | --- | --- |
| `hyperbola_asymptotes_points` | Draw `2/x`, dashed asymptotes `x=0`, `y=0`, and A/B/C/D on the curve. | Pass. Both branches, dashed asymptotes, and four marked points match the prompt. |
| `cubic_extrema_inflection_tangent` | Draw `x^3-3*x`, extrema A/B, inflection O, tangent at `x=0`, and segment AB. | Pass. The cubic, tangent, and requested labels are present. This required repair attempts before the final valid output. |
| `circle_crossed_chords_angle` | Draw a radius-4 circle, crossed chords AB/CD, intersection P, and angle APD. | Pass. Chords cross at P and the angle marker is visibly nondegenerate. |
| `right_triangle_altitude_similarity` | Draw right triangle ABC, altitude foot H, shaded ACH/BCH, and right-angle markers. | Pass with visual note. Geometry is correct, but helper infinite lines used for markers make the live render a little busier than the reference. |
| `number_line_interval_solution` | Draw `-3 < x <= 1` or `x >= 3` on a number line with labels `-3,1,3`. | Pass with approximation note. Segment/ray and labels are correct; true open endpoint styling remains approximated by a small point. |
| `speed_time_area_graph` | Draw A-B-C-D speed-time polyline and shade the trapezoid area. | Pass. Polyline, point placement, and shaded area match the prompt. |
| `boxplot_approximation_number_line` | Approximate a box plot with numberLine, polygon, whisker segments, and a real median segment. | Final pass after root-cause fix. Initial live outputs duplicated custom mark labels and then created a zero-length median segment; the final rerun has five labels and a real median segment. |
| `unit_circle_sine_projection` | Draw radius-3 circle, point P, projections H/V, segments, and angle POH. | Pass. Projection structure and angle marker are visible and label count matches the prompt. |
| `three_circle_pairwise_lenses` | Draw three overlapping circles and shade pairwise lens regions. | Pass as pairwise-lens approximation. Exact triple-overlap fill is still not a first-class primitive. |
| `square_pyramid_midsection` | Draw first-class square pyramid, mid-height section polygon, and dashed height segment. | Pass. Pyramid, internal section, and height segment render cleanly with no labels. |

## Fixes Made

- Added `LIVE_AI_SAMPLE_OFFSET` and `LIVE_AI_SAMPLE_LIMIT` so paid live runs can be sliced and rerun one prompt at a time.
- Added the new `fresh_csat` prompt set and deterministic reference payloads.
- Counted `numberLine.customMarks` labels as runtime-visible labels so duplicated chart labels are caught by semantic validation.
- Added `requiredVerticalSegments` validation so a median marker or similar vertical marker cannot pass as a zero-length segment from a point to itself.
- Strengthened the developer prompt and box-plot prompt to avoid duplicated custom mark labels and degenerate median segments.

## Remaining Limitations

- Native `boxPlot` objects are still not first-class; the current result is a composed approximation.
- Number-line open endpoints are still approximate because there is no explicit open-circle endpoint primitive.
- Exact three-circle common-region filling is not first-class; pairwise `lensRegion` objects cover the requested pairwise lenses.

## Verification

- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Ran `node --test tests\live-openai-random-smoke.test.js`; passed with 56 tests.
- Rendered `LIVE_AI_PROMPT_SET=fresh_csat` local reference targets; passed with 10 targets, 0 failures, and 0 browser console errors.
- Ran live OpenAI sliced generation for the 10 final outputs; passed with 0 final validation failures and 0 browser console errors.
- Opened the contact sheets and individual PNGs for prompt/result visual comparison.
- Ran `npm.cmd test`; passed with 117 tests.
- Ran `git diff --check`; passed with line-ending warnings only.
- Ran a narrowed secret-pattern scan for actual long `sk-...` tokens outside `node_modules`, `tmp`, and `.git`; no matches.
