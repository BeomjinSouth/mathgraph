# Stress Extra OpenAI Drawing Audit

Last updated: 2026-05-28

## Scope

This note compares the `stress_extra` live OpenAI drawing prompts with the rendered GraphA results. The final recursively improved live run is saved under `tmp/live-openai-stress-extra-drawing-smoke-parity6/`.

The API key is not recorded here. Live reports only state that the key was supplied through `OPENAI_API_KEY`.

## Recursive Visual Revalidation

The saved `fixed2` run originally reported 0 schema/reference/semantic/render failures. A visual review showed that this was still not the same as matching the intended drawings. The new revalidation mode reran the saved result file against the strengthened prompt-local expectations:

```powershell
$env:LIVE_AI_REVALIDATE_RESULTS='tmp/live-openai-stress-extra-drawing-smoke-fixed2/live-openai-random-results.json'
node tools\run-live-openai-random-drawing-smoke.mjs
```

Result: 10 saved outputs checked, 6 rejected by the newer visual-intent gates.

- `exp_log_two_curve_window`: A was a same-x sample near the right intersection, not the requested left intersection.
- `two_circle_lens_region`: lens helper points were visible as extra dots.
- `hexagon_diagonal_angle_web`: the construction hexagon was filled by the runtime's default polygon opacity.
- `two_transversals_angle_grid`: one `angleDimension` reused the vertex as a helper point, so the angle arc was not renderable.
- `box_with_pyramid_and_inner_prism`: the two inner solids were only 0.29 projected units apart and read as overlapped.
- `double_pyramid_inside_box`: one pyramid reused its apex as a base vertex.

The target-reference render, produced without an API call, is under `tmp/stress-extra-visual-target/reference-contact-sheet.png`. It is not a live OpenAI result; it is the local visual target used to judge whether future live reruns match the intended prompt.

After the saved-result revalidation pass, the live OpenAI path was rerun repeatedly. Each rerun was visually reviewed against the prompt target, and new mismatches were promoted into validators before the next rerun.

- `parity1`: passed automated checks, but visual review caught an unequal-radius lens circle and visible lens helper shape issues.
- `parity2`: rejected missing `x` fields on `tangentFunction`; report review also exposed a wrong rational vertical asymptote and triangular pyramids where square pyramids were requested.
- `parity3`: passed automated checks, but visual review caught a self-crossing lens fill and a twisted inner prism projection.
- `parity5`: rejected the self-crossing lens polygon after that validator was added.
- `parity6`: passed schema/reference/intent/runtime/semantic checks, browser rendering, and visual review. This is the accepted live evidence set.

## Prompt / Result Comparison

| ID | Prompt target | Observed result | Root cause / judgement | Fix or context update |
| --- | --- | --- | --- | --- |
| `exp_log_two_curve_window` | Draw `exp(0.4*x)-1` and `ln(x+5)-1`, with only two short point labels. | Two function objects rendered, but A/B were same-x comparison samples instead of the two requested intersections. | The phrase "representative near points" was mathematically ambiguous. | Prompt now asks for actual intersections near fixed coordinate windows; validator checks those windows. |
| `quartic_double_well_tangents` | Draw a quartic and tangentFunction objects at x=-1 and x=1. | One recursive rerun produced `tangentFunction` objects without `x`; final output used `x:-1` and `x:1`. | Required object type was not enough; required tangent parameter values must be checked. | Prompt now states the exact `x` fields and validator keeps `requiredTangentXs`. |
| `rational_slant_asymptote` | Draw a rational graph with vertical and slant dashed asymptote lines. | A rerun produced two dashed slant lines, one labeled `x=2`, so the visual vertical asymptote was wrong. | `minDashedLines` proved too weak because it did not check line equations. | Added required line-pattern checks for vertical `x=2` and slope/intercept `y=x+2`. |
| `damped_wave_with_envelopes` | Draw a damped sine wave and two envelope curves with no labels. | Three function objects rendered with no visible labels. | No new structural issue. | Keep function labels hidden for dense graph families. |
| `two_circle_lens_region` | Draw two equal-radius overlapping circles, direct upper/lower lens points, and a shaded lens polygon. | Recursive reruns exposed three separate issues: helper points visible as dots, one circle with radius 1 instead of 3, and a self-crossing lens fill. | The prompt named the object families but did not force circle radius, helper visibility, or polygon boundary order. | Added visible-point count, equal-radius circle, coordinate-window, simple-polygon, and lens-bounds checks. |
| `hexagon_diagonal_angle_web` | Draw a regular hexagon with polygon, circumcircle, three long diagonals, and three center angle markers. | The structure rendered, but the hexagon polygon was shaded by default. | `Polygon` defaults to `fillOpacity:0.12` when omitted. | Prompt and validator now require `fillOpacity:0` for construction-only polygons. |
| `two_transversals_angle_grid` | Draw two parallel lines, two transversals, four intersections, and hidden angle markers. | Four angle objects existed, but one was visually missing because a helper point matched the vertex. | Counting `angleDimension` objects does not guarantee a visible arc. | Added renderable-angle checks and a distinct-vertex count. |
| `box_with_pyramid_and_inner_prism` | Draw a large prism containing a pyramid and smaller prism. | Inner solids were inside the outer prism but could overlap or use twisted prism vertex order. | Containment alone does not measure readability, and a `prism` type can still have mismatched base/top ordering. | Added projected center separation, hidden vertex points, square-pyramid base count, and valid prism-projection checks. |
| `double_pyramid_inside_box` | Draw two square pyramids inside a transparent prism. | A rerun used triangular pyramids even though the prompt asked for square pyramids. | Pyramid object existence did not check base vertex count. | Added `requiredPyramidBaseVertexCounts` and `validPyramidApexes`. |
| `triangular_prism_inside_square_pyramid` | Draw a triangular prism inside a square pyramid. | The final output uses a 3/3 triangular prism inside a 4-base pyramid with hidden helper points. | A generic prism can be rectangular or twisted unless vertex count and projection order are checked. | Added `requiredPrismVertexCounts:[3]`, square-pyramid base count, valid prism projection, and hidden point checks. |

## Root Causes

1. Schema validity was not enough. Valid GraphA can still be mathematically wrong when a prompt needs a specific branch, tangent x-value, dashed asymptote, label budget, or containment relation.
2. Some user intentions need extra context because current GraphA primitives are lower-level than the mathematical phrase. The clearest example is a two-circle lens: "two intersections" needs direct upper/lower points or a future circle-intersection branch selector.
3. Dense diagrams fail visually through label defaults even when the geometry exists. Prompt-local label budgets and `showLabel:false` are still necessary.
4. Nested solids are screen-projection diagrams, not true 3D containment. The useful quality gate is therefore "inner vertices stay inside the outer solid projection hull."
5. Validators can also be wrong. The hexagon case showed that semantic checks must respect first-class objects such as `polygon` instead of demanding duplicate edge segments.
6. Visual object existence is not enough. An angle object with a zero-length ray, a filled construction polygon, or a degenerate pyramid can all pass broad schema checks while being visibly wrong.

## Improvements Made

- Added `LIVE_AI_PROMPT_SET=stress_extra` with 10 additional function, plane-geometry, and nested-solid prompts.
- Added prompt-local checks for direct lens points and nested solid containment.
- Strengthened nested solid containment from an axis-aligned bounding box to a convex-hull projection check.
- Added revalidation mode for saved live result files with `LIVE_AI_REVALIDATE_RESULTS`.
- Added prompt-local checks for coordinate windows, visible helper points, equal-radius lens circles, simple lens polygons, lens bounds, required line equations, renderable angles, unfilled construction polygons, pyramid apex validity, pyramid base counts, prism projection consistency, inner-solid separation, and triangular-prism vertex counts.
- Added regression tests for duplicate lens intersection points, visible helper points, unequal-radius lens circles, self-crossing/out-of-bounds lens polygons, wrong asymptote lines, renderable angles, filled construction polygons, degenerate pyramids, triangular-vs-square pyramids, twisted prisms, and inner-solid overlap.
- Added visual guardrails to the runtime OpenAI reference prompt, JSON feature manual, and MathGraph drawing skill.
- Kept label budgets and short-label constraints in every dense prompt.

## Future Feature Candidates

- Add a first-class circle-circle intersection object with branch selection such as `upper`, `lower`, `left`, or `right`.
- Add a curved fill or `fillBetween` primitive for regions bounded by functions or circular arcs, instead of polygon approximation.
- Add stronger 3D scene-graph metadata for nested solids, depth ordering, and projected containment.
- Add native chart primitives and curved-solid primitives before claiming exact coverage for histograms, scatter plots, cylinders, cones, or spheres.
