# Fresh CSAT-Style Drawing Audit

Last updated: 2026-05-30

## Scope

This note records the fresh `fresh_csat` prompt set added after the previous `stress_novel` audit. The set is meant to cover additional CSAT/mock-exam-style diagrams without reusing the earlier targets.

The pasted OpenAI API key was not written to source files, reports, screenshots, or persistent environment settings. The current shell did not have `OPENAI_API_KEY`, so the fresh live API rerun was intentionally blocked instead of placing the key literal into a command string.

## Evidence

Fresh local reference render:

```powershell
$env:LIVE_AI_PROMPT_SET='fresh_csat'
$env:LIVE_AI_RENDER_REFERENCE_TARGETS='1'
$env:LIVE_AI_OUTPUT_DIR='tmp/live-openai-fresh-csat-reference-final2-20260530'
node tools\run-live-openai-random-drawing-smoke.mjs
```

Result: 10 reference targets rendered, 0 validation failures, 0 browser console errors.

- Contact sheet: `tmp/live-openai-fresh-csat-reference-final2-20260530/contact-sheet.png`
- Report: `tmp/live-openai-fresh-csat-reference-final2-20260530/reference-target-report.md`
- Screenshots: `tmp/live-openai-fresh-csat-reference-final2-20260530/screenshots/`

Fresh live API attempt:

```powershell
$env:LIVE_AI_PROMPT_SET='fresh_csat'
$env:LIVE_AI_OUTPUT_DIR='tmp/live-openai-fresh-csat-live-20260530'
node tools\run-live-openai-random-drawing-smoke.mjs
```

Result: blocked before network call with `OPENAI_API_KEY is required.`

## Prompt / Reference Comparison

| ID | Target | Visual judgement |
| --- | --- | --- |
| `hyperbola_asymptotes_points` | Rectangular hyperbola `2/x`, dashed coordinate-axis asymptotes, four marked points. | Pass. The two branches, dashed asymptotes, and A/B/C/D point placement match the prompt. |
| `cubic_extrema_inflection_tangent` | Cubic `x^3-3*x`, extrema, inflection point, tangent at `x=0`, and segment AB. | Pass with minor label crowding near B. Structure is correct and readable. |
| `circle_crossed_chords_angle` | Circle with two intersecting chords and interior angle APD. | Pass. Chords cross at P, labels are present, and the angle marker is visible. |
| `right_triangle_altitude_similarity` | Right triangle with altitude to the hypotenuse and two shaded smaller triangles. | Pass. The altitude foot H, shaded subtriangles, and right-angle markers read correctly. |
| `number_line_interval_solution` | Number line interval/ray solution. | Pass with approximation note. The interval/ray structure renders; open endpoint styling remains approximate. |
| `speed_time_area_graph` | Piecewise speed-time graph with shaded distance area. | Pass. The polyline and shaded trapezoid area match the prompt. |
| `boxplot_approximation_number_line` | Box plot approximated with numberLine, polygon, and segments. | Pass as approximation. Coordinates were adjusted to the default viewport and labels shortened to keep the reference legible. A first-class boxPlot primitive is still a gap. |
| `unit_circle_sine_projection` | Unit-circle-style sine projection diagram. | Pass. Circle, projection segments, and angle marker are visible. |
| `three_circle_pairwise_lenses` | Three-circle Venn-style overlap using pairwise lens regions. | Pass as pairwise-lens approximation. Exact three-circle common-region fill is not first-class yet. |
| `square_pyramid_midsection` | Square pyramid with mid-height cross-section and height segment. | Pass. First-class pyramid, section polygon, and dashed height line render cleanly. |

## Findings

- The new local target set covers additional exam-style families: rational functions, cubic extrema, chord-angle geometry, altitude similarity, interval/ray number lines, area-under-graph diagrams, box-plot approximation, trigonometric projection, Venn-style overlaps, and pyramid cross-sections.
- The current GraphA/runtime path can render the intended reference targets without console errors.
- Remaining limitations are explicit: native box plots, exact open/closed endpoint styling on number lines, and exact three-circle common-region fills are still approximations with current primitives.
- No additional source-code primitive was needed, but the box-plot reference prompt was adjusted after visual inspection because the first coordinate choice made labels too cramped.

## Verification

- Ran `node --check tools\run-live-openai-random-drawing-smoke.mjs`; passed.
- Rendered `LIVE_AI_PROMPT_SET=fresh_csat` local reference targets; passed with 10 targets, 0 failures, and 0 browser console errors.
- Opened the contact sheet and the box-plot screenshot for visual comparison.
- Attempted a fresh live OpenAI run; blocked before network call because `OPENAI_API_KEY` is not present in the process environment.
