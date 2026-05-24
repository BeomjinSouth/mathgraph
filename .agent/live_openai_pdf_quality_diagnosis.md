# Live OpenAI PDF Drawing Quality Diagnosis

## Scope

- Date: 2026-05-25
- Task: diagnose why many live OpenAI PDF-derived drawing outputs looked wrong despite passing the previous validation run.
- Evidence reviewed:
  - `tmp/live-openai-pdf-ai-samples/live-openai-results.json`
  - `tmp/live-openai-pdf-ai-samples/screenshots/*.png`
  - `tmp/live-openai-pdf-ai-samples/contact-sheet-diagnosis.png`
  - `tmp/live-openai-pdf-ai-samples/source-vs-ai-contact-sheet.png`
  - `tmp/pdf-ai-audit/*.png`
  - `docs/live-openai-pdf-text-prompt-audit.md`
  - `docs/pdf-ai-drawing-sample-audit.md`

## Root Causes

1. The previous pass validated syntax, references, and non-empty canvas pixels, not mathematical or visual correctness.
2. The live API prompts were text summaries, not the actual PDF crops or exact page-region references.
3. Several source pages contain many small figures, but the audit did not preserve exact crop coordinates for the selected figure.
4. Source render artifacts were not standardized; several selected samples did not resolve to a canonical `math*_pNNNN.png` source image in the comparison script.
5. MathGraph lacks first-class primitives for several textbook diagram families, especially chart axes, histograms, smooth distribution curves, scatter plots, cylinders, cones, spheres, and independent free text.
6. The prompt runner optimized for valid GraphA field names after earlier API failures, which improved schema validity but did not enforce semantic geometry constraints.
7. The screenshot smoke check counted non-white pixels and object counts, so incorrect drawings such as wrong-radius circles or malformed histograms still passed.
8. Canvas screenshots included UI overlay controls, which made the visual evidence less clean.

## Sample-Level Diagnosis

| Sample | Main issue |
| --- | --- |
| `math3_p0127_radical_number_line` | The model created `B=(0,1)` and a circle centered at `O` through `B`, giving radius 1 instead of √2. It also used a short segment rather than a real number line. This is a semantic geometry failure that schema validation cannot catch. |
| `math1_p0150_parallel_transversal_angles` | Structurally plausible, but generated from a generic text prompt while the source page contains multiple small figures. No exact crop means no exact target. |
| `math1_p0156_circle_sector` | Mostly structural, but the source page has multiple circle problems and the live result is a generic sector reconstruction, not a confirmed figure match. |
| `math1_p0227_rectangular_prism` | The prompt intentionally reduced a multi-solid page to a rectangular prism because curved solids are unsupported. It cannot be treated as matching the page. |
| `math1_p0638_histogram_frequency_polygon` | The model reused frequency points as bar vertices, creating slanted/trapezoid bars and no proper chart axes. Current primitives and validation do not enforce histogram geometry. |
| `math2_p0290_linear_graph_intersection` | The output is a generic two-line intersection and lacks full coordinate-grid/page fidelity. The page-level source has multiple diagrams. |
| `math2_p0404_triangle_incircle` | The contact points are manually guessed coordinates; not all are guaranteed tangent to the incircle. There is no semantic tangency validation. |
| `math2_p0437_similarity_triangles` | Structural similarity markers are present, but not an exact reconstruction of a selected PDF crop. |
| `math3_p0291_quadratic_function` | The result does not explicitly create the requested x-axis intersection object, and one axis helper is geometrically suspicious. Function graph semantic checks were missing. |
| `math3_p0354_trig_right_triangle` | The geometry is small and labels/markers overlap; the smoke check does not evaluate legibility or label placement. |
| `math3_p0443_distribution_curves` | Curves were approximated as polygons/straight chains, not smooth function curves. This is a primitive/prompt selection failure. |
| `math3_p0442_scatter_plot` | Points lie almost perfectly on a line, so it communicates correlation but not a realistic scatter plot. Chart semantics are not validated. |

## Fix Direction

1. Preserve exact source crop images and crop metadata for every selected PDF figure.
2. Use vision input for crop-to-GraphA generation when comparing to PDF figures; use text prompts only for concept-level generation.
3. Replace the current pass/fail gate with semantic checks per category:
   - radical construction: verify hypotenuse/circle radius matches √2;
   - histogram: verify each bar is rectangular and class intervals share a common baseline;
   - incircle: verify contact points lie on sides and radii are perpendicular to sides;
   - function graphs: verify equations, axes, requested intersections, and labels;
   - scatter/distribution: verify appropriate primitive choice and spread shape.
4. Add a visual review rubric: source crop present, target feature present, no severe overlap, no UI overlay in evidence screenshot.
5. Add missing primitives or declare hard limitations before claiming parity for charts and curved solids.

## Implemented Improvement

- Added `js/ai/SemanticValidator.js` with category-specific checks for the 12 PDF sample categories.
- Updated `tests/pdf-ai-drawing-samples.test.js` so the curated fixture set must pass semantic checks, not only schema/reference checks.
- Corrected the triangle-incircle fixture contact points so its radii are perpendicular to the triangle sides.
- Updated `tools/run-live-openai-pdf-ai-samples.mjs` so live API runs:
  - inject the compact JSON manual reference from `feature-manual.json` / `retrieval-index.json`;
  - attach available source page/crop images from `tmp/pdf-ai-audit/` unless `LIVE_AI_USE_SOURCE_IMAGE=0`;
  - enforce the 45-operation recreate budget;
  - retry on schema, reference, intent, or semantic validation failures.
- Added `tools/validate-live-openai-pdf-results.mjs` to recheck saved live outputs.

## Recheck Result On Previous Live Outputs

Running `node tools\validate-live-openai-pdf-results.mjs` against the prior live result file now fails 7 of 12 samples, which is the intended behavior for the previous weak output set:

| Failed sample | New caught cause |
| --- | --- |
| `math3_p0127_radical_number_line` | Missing real `numberLine` object. |
| `math1_p0156_circle_sector` | Missing `arc` object. |
| `math1_p0638_histogram_frequency_polygon` | Fewer than four axis-aligned rectangular bars. |
| `math2_p0404_triangle_incircle` | Contact points/radii do not satisfy side tangency. |
| `math2_p0437_similarity_triangles` | Missing two triangle polygons. |
| `math3_p0443_distribution_curves` | Missing two smooth function curves and bell-shaped expressions. |
| `math3_p0442_scatter_plot` | Data points are too collinear for a scatter plot. |
