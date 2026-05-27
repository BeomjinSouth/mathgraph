# Stress Extra OpenAI Drawing Audit

Last updated: 2026-05-28

## Scope

This note compares the `stress_extra` live OpenAI drawing prompts with the rendered GraphA results saved under `tmp/live-openai-stress-extra-drawing-smoke/` and `tmp/live-openai-stress-extra-drawing-smoke-fixed/`.

The API key is not recorded here. Live reports only state that the key was supplied through `OPENAI_API_KEY`.

## Prompt / Result Comparison

| ID | Prompt target | Observed result | Root cause / judgement | Fix or context update |
| --- | --- | --- | --- | --- |
| `exp_log_two_curve_window` | Draw `exp(0.4*x)-1` and `ln(x+5)-1`, with only two short point labels. | Two function objects rendered and labels stayed within budget. | The phrase "representative near points" is mathematically ambiguous, so the model may choose same-x samples rather than intersections. | Keep this as an ambiguity note: ask for "same x-value comparison points" or "actual intersections" explicitly. |
| `quartic_double_well_tangents` | Draw a quartic and tangentFunction objects at x=-1 and x=1. | The final output used a real function plus two `tangentFunction` objects and three short point labels. | Earlier graph checks could pass even when required tangent x-values were missing. | Keep `requiredTangentXs` as a prompt-local semantic check. |
| `rational_slant_asymptote` | Draw a rational graph with vertical and slant dashed asymptote lines. | Function and two dashed line objects rendered correctly. | Without an explicit dashed-line gate, a model can draw asymptotes as ordinary lines. | Keep `minDashedLines` and short visible labels for asymptote prompts. |
| `damped_wave_with_envelopes` | Draw a damped sine wave and two envelope curves with no labels. | Three function objects rendered with no visible labels. | No new structural issue. | Keep function labels hidden for dense graph families. |
| `two_circle_lens_region` | Draw two overlapping circles, direct upper/lower lens points, and a shaded lens polygon. | The first run accepted duplicate `intersection` objects for A and B; the fixed prompt created direct point objects. | Current smoke semantics cannot reliably disambiguate two circle-circle intersections, and a generic `intersection` can hide which point is upper or lower. | Added `requireDirectLensPoints` and prompt text requiring direct A/B points when exact upper/lower lens points matter. |
| `hexagon_diagonal_angle_web` | Draw a regular hexagon with polygon, circumcircle, three long diagonals, and three center angle markers. | The fixed run rendered the intended structure, but one intermediate validator expected nine segment objects. | The validator overcounted polygon edges as required explicit segments even though the polygon already owns the boundary. | Reduced the expectation to the three requested diagonal segments. |
| `two_transversals_angle_grid` | Draw two parallel lines, two transversals, four intersections, and hidden angle markers. | Lines, intersections, and four hidden-value angle markers rendered with no labels. | Previous dense angle prompts can fail visually through overlapping labels and unstaggered arcs. | Keep `showValue:false`, hidden labels, and angle-marker count checks. |
| `box_with_pyramid_and_inner_prism` | Draw a large prism containing a pyramid and smaller prism. | Earlier output could place inner vertices outside the outer projection while still using valid first-class solids. | The prompt did not make projection containment enforceable, and the validator only checked object families. | Added `innerWithinFirstPrism`; upgraded the check from bounding box to convex-hull projection. |
| `double_pyramid_inside_box` | Draw two pyramids inside a transparent prism. | Final structure used one prism and two pyramid objects with hidden labels. | Same containment risk as other nested solids. | Use first-class `prism`/`pyramid` and convex-hull containment for inner points. |
| `triangular_prism_inside_square_pyramid` | Draw a triangular prism inside a square pyramid. | Pyramid plus prism objects rendered with hidden labels. | A bounding-box check can miss points outside the projected pyramid face region. | Added `innerWithinFirstPyramid`; shared containment now uses the outer solid projection hull. |

## Root Causes

1. Schema validity was not enough. Valid GraphA can still be mathematically wrong when a prompt needs a specific branch, tangent x-value, dashed asymptote, label budget, or containment relation.
2. Some user intentions need extra context because current GraphA primitives are lower-level than the mathematical phrase. The clearest example is a two-circle lens: "two intersections" needs direct upper/lower points or a future circle-intersection branch selector.
3. Dense diagrams fail visually through label defaults even when the geometry exists. Prompt-local label budgets and `showLabel:false` are still necessary.
4. Nested solids are screen-projection diagrams, not true 3D containment. The useful quality gate is therefore "inner vertices stay inside the outer solid projection hull."
5. Validators can also be wrong. The hexagon case showed that semantic checks must respect first-class objects such as `polygon` instead of demanding duplicate edge segments.

## Improvements Made

- Added `LIVE_AI_PROMPT_SET=stress_extra` with 10 additional function, plane-geometry, and nested-solid prompts.
- Added prompt-local checks for direct lens points and nested solid containment.
- Strengthened nested solid containment from an axis-aligned bounding box to a convex-hull projection check.
- Added regression tests for duplicate lens intersection points and inner solid points outside the outer projection.
- Kept label budgets and short-label constraints in every dense prompt.

## Future Feature Candidates

- Add a first-class circle-circle intersection object with branch selection such as `upper`, `lower`, `left`, or `right`.
- Add a curved fill or `fillBetween` primitive for regions bounded by functions or circular arcs, instead of polygon approximation.
- Add stronger 3D scene-graph metadata for nested solids, depth ordering, and projected containment.
- Add native chart primitives and curved-solid primitives before claiming exact coverage for histograms, scatter plots, cylinders, cones, or spheres.
