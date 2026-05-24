# Live OpenAI PDF Drawing Quality Diagnosis

Date: 2026-05-25

## What Went Wrong

The previous live API run proved that external OpenAI calls can return GraphA JSON and that MathGraph can render it. It did not prove that the drawings matched the PDF figures well. The validation bar was too low: schema validity, reference validity, and non-empty canvas pixels are necessary, but they do not catch wrong geometry, missing textbook details, or poor visual fidelity.

## Evidence Reviewed

- Live result JSON: `tmp/live-openai-pdf-ai-samples/live-openai-results.json`
- Live screenshots: `tmp/live-openai-pdf-ai-samples/screenshots/*.png`
- AI-only contact sheet: `tmp/live-openai-pdf-ai-samples/contact-sheet-diagnosis.png`
- Source-vs-AI contact sheet: `tmp/live-openai-pdf-ai-samples/source-vs-ai-contact-sheet.png`
- Source page renders: `tmp/pdf-ai-audit/*.png`
- Prior audit docs:
  - `.agent/live_openai_pdf_text_prompt_audit.md`
  - `docs/live-openai-pdf-text-prompt-audit.md`
  - `docs/pdf-ai-drawing-sample-audit.md`

## Root Causes

1. **The run used text summaries, not exact PDF crops.**
   The live text-prompt runner sent simplified Korean requests such as "draw a histogram" or "draw an incircle" rather than the exact source image region.

2. **The selected figure was not tied to a stable crop.**
   Several source pages contain multiple small figures. Some source render files exist only under candidate names such as `math3_real_number_candidates_p0127.png`, not canonical names such as `math3_p0127.png`, so the comparison evidence was incomplete.

3. **Validation only checked whether the JSON was drawable.**
   `SchemaValidator` catches unsupported fields and bad references, but it does not know that a radical construction must use a radius of √2, that histogram bars must be rectangles, or that incircle radii must touch triangle sides perpendicularly.

4. **The smoke test only checked that pixels appeared.**
   A drawing with the wrong circle radius or malformed bars still passed if it created objects and non-white pixels.

5. **Several requested categories exceed current MathGraph primitives.**
   Histograms, scatter plots, distribution curves, curved solids, and independent explanatory text are approximated with low-level points/segments/polygons.

6. **The prompt repair loop optimized for syntactic validity.**
   After earlier invalid API responses, the runner added field-name and reference repair. That made the payloads valid GraphA, but it did not add semantic quality constraints.

7. **Visual evidence was polluted by UI overlays.**
   The screenshot captures include canvas overlay controls, so the evidence images are not clean figure-only comparisons.

## Sample-Level Problems

| Sample | Diagnosis |
| --- | --- |
| `math3_p0127_radical_number_line` | Wrong construction: the circle is centered at `O` through `B=(0,1)`, so its radius is 1, not √2. |
| `math1_p0150_parallel_transversal_angles` | Generic parallel-line diagram, not tied to a selected figure crop. |
| `math1_p0156_circle_sector` | Generic sector reconstruction; no proof it matches the chosen figure on the page. |
| `math1_p0227_rectangular_prism` | Reduced to a rectangular prism because curved solids are unsupported; cannot match a multi-solid page. |
| `math1_p0638_histogram_frequency_polygon` | Bars are built from frequency points, producing slanted/trapezoid shapes and weak chart axes. |
| `math2_p0290_linear_graph_intersection` | Generic line intersection, not full coordinate-grid/page reconstruction. |
| `math2_p0404_triangle_incircle` | Contact points are coordinate guesses; tangency is not verified. |
| `math2_p0437_similarity_triangles` | Structurally plausible but not crop-verified. |
| `math3_p0291_quadratic_function` | Missing explicit requested x-intersection object and has weak axis semantics. |
| `math3_p0354_trig_right_triangle` | Label and marker crowding; no legibility check. |
| `math3_p0443_distribution_curves` | Uses polygons/straight chains instead of smooth distribution curves. |
| `math3_p0442_scatter_plot` | Points nearly lie on a perfect line, so it is more a line graph than a scatter plot. |

## Required Fixes Before Claiming Quality

1. Store exact crop images and crop metadata for every sampled PDF figure.
2. Use crop images as vision input when the goal is PDF figure reproduction.
3. Keep text-only prompts for concept sketches only, and label them as such.
4. Add category-specific semantic validators before accepting output.
5. Add a visual rubric that checks source crop presence, key feature presence, label legibility, and clean screenshot capture.
6. Add first-class chart and curved-solid primitives, or explicitly mark those cases as unsupported/approximation.

## Improvement Added

The weak pass/fail gate has been replaced for this workflow with a semantic validation layer:

- `js/ai/SemanticValidator.js` checks category-specific math structure for all 12 PDF sample categories.
- `tools/run-live-openai-pdf-ai-samples.mjs` now injects the JSON manual/retrieval context, can attach available source page/crop images, enforces the recreate operation budget, and retries when semantic validation fails.
- `tools/validate-live-openai-pdf-results.mjs` rechecks saved live results and writes `tmp/live-openai-pdf-ai-samples/semantic-validation-report.json`.

Rechecking the previous live result file now correctly rejects 7 samples: radical number line, circle sector, histogram/frequency polygon, triangle incircle, similarity triangles, distribution curves, and scatter plot. The failures are no longer vague visual complaints; they name the missing or wrong mathematical structure.
