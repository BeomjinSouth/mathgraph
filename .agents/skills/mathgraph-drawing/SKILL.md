---
name: mathgraph-drawing
description: Create, revise, or verify editable MathGraph drawings from Korean requests, including exam figures, solid geometry, and shaded function graphs. Use for MathGraph GraphA operations and AI drawing workflows; not for a plain math solution without a drawing.
---

# MathGraph Drawing

Use this skill to plan or generate MathGraph drawing JSON without loading every schema and example into context.

## Quick Workflow

1. Read `references/retrieval-index.json` first.
2. Select the smallest matching reference chunks by `tags`, `objectTypes`, and `loadWhen`.
3. Read only the needed parts of `references/feature-manual.json`.
4. Read only matching records from `references/synthetic-drawing-data.jsonl` when an example pattern is useful.
5. For image/PDF recreation, prefer a high-level scene graph first, then compile it through the app-owned scene graph compiler.
6. Emit GraphA JSON as `{ "operations": [...] }` when the caller needs a drawable patch.
7. For monochrome exam diagrams or teacher calibration work, read [references/exam-diagram-layout.md](references/exam-diagram-layout.md). Its rules reflect observed teacher revisions, not a fixed template for every figure.
8. For a natural-language one-shot request, check that the returned GraphA and the actual app render include every stated condition. A partial diagram is a failure. The confirmed patterns and unverified boundaries are recorded in `docs/시험-도형-복합요소-검수결과.md`; do not generalize the 20 checked app prompts to arbitrary exam problems.
9. For newly generated exam drawings, use the rendered preparation path and strict layout check in that reference before delivery. It produces corrected GraphA, editable project files and actual PNG evidence; direct PatchApplier calls do not run the AIService layout step. Preserve explicit teacher offsets and inspect unresolved issues instead of suppressing them.

## Reference Selection

- Plane figures: load core contract, point/line/polygon/textLabel objects, construction objects, marker/dimension objects, and examples tagged `plane`.
- Circles and curved regions: load circle, circleThreePoints, pointOnCircle, tangentCircle, arc, sector, circularSegment, lensRegion, and examples tagged `circle`.
- Solids: load prism/pyramid plus first-class cylinder/cone/sphere projections, base/top/apex point patterns, and examples tagged `solid`.
- Graphs/functions: load function, functionRegion, tangentFunction, intersection, line/segment, numberLine, and examples tagged `graph`.
- Statistical or chart-like requests: report them as explicitly excluded from the standard teacher generation workflow. Do not imply first-class support for bar/pie charts, histograms, frequency polygons, box plots, dot plots, or scatter plots.
- API integration prompts: load `api_prompting`, `operationContract`, and `validationWorkflow` from the feature manual.
- Image reference or patching prompts: load `api_prompting`, `operationContract`, `validationWorkflow`, known gaps, and only the object chunks relevant to the pasted image/instruction.

## Output Rules

- Create referenced objects before the objects that refer to them.
- Midpoint and intersection relations create reusable ids. Let later lines, segments, polygons, circles, and relations reference those ids directly instead of adding a coordinate-duplicate helper point.
- Prefer stable temporary IDs such as `A`, `AB`, `poly_ABC`, or `prism_1`.
- Use only supported create `type` values from the feature manual.
- For selected-object patch requests, prefer `update`/`delete` operations on existing selected IDs. Do not create unrelated objects when the user says only this part/selected object should change.
- For image recreation, stay within the current operation budget and ignore dense page text, decorative grids, and unsupported textbook furniture unless requested.
- Use `polygon` for triangles, quadrilaterals, shaded regions, bars, and other filled plane regions.
- Keep construction and shading polygon labels hidden unless the source explicitly prints a region name. Give helper points `label:null` and `showLabel:false` or `visible:false` so runtime-generated names do not leak into the exam diagram.
- Use `lensRegion` for the exact filled overlap of two intersecting circles instead of approximating the lens with a polygon.
- If a polygon is only a construction boundary or outline, set `fillOpacity:0`; use positive fill opacity only for requested shaded regions.
- When the question directly asks for the value, maximum, or minimum of a named triangle or quadrilateral area, create that named polygon and use fillOpacity from 0.18 to 0.24. Do not shade when area is only a given condition, comparison, or ratio and another quantity is being asked.
- For focus/directrix, tangent-from-point, feasible-region, or named construction-point prompts, provide exact coordinates for the intended visible points and exact support-line equations.
- When a named point lies on a segment, create the segment first and use pointOnLine with lineId referencing that segment and t between 0 and 1.
- For internal division AP:PB=m:n, use t=m/(m+n) from A toward B; verify collinearity, between-ness, and the requested ratio before returning JSON.
- Treat same-length statements as equivalence classes. Connected equalities share one `tickCount`; independent groups use distinct positive `tickCount` values so `AB=AC` and `AD=BC` never look like all four segments are equal.
- For `∠XYZ`, use `Y` as the `angleDimension.vertexId` and keep a source-stated angle at that vertex instead of substituting a derived angle elsewhere.
- For concentric-circle or fixed-radius prompts, reuse the same center id and create radius points at the requested distance.
- There is no first-class `annularSector` yet; when a prompt accepts approximation, use a normal sector plus an inner circle outline rather than claiming a true ring-sector cutout.
- When a problem asks for area between two function graphs or a graph and a horizontal line on a stated x-interval, create `functionRegion` after its function objects. Use `function1Id`, optional `function2Id` (otherwise `baselineY`, default 0), and `xMin`/`xMax`; keep the shaded span within the visible canvas and both function domains. Inspect the fill and x-boundary strokes. The path samples the functions, so it is a visual diagram rather than an exact area calculation.
- For piecewise functions, clip every function with `xMin`/`xMax`. Mark excluded endpoints with `pointStyle:"open"` and included endpoints with `pointStyle:"closed"`; do not imitate an open endpoint with a separate circle.
- For parameterized graph problems with no fixed parameter value, choose a valid non-degenerate representative that keeps named points and construction lines distinct; avoid limit, boundary, or special values that collapse the diagram.
- Use `prism`, `pyramid`, `cylinder`, `cone`, and `sphere` for current solid support. Curved solids use editable textbook projections with optional dashed hidden curves; nets and revolution sweeps remain unsupported.
- For `prism`, put the near/front face in `baseVertexIds` and the shifted rear face in `topVertexIds` so the runtime can keep front edges solid and hidden rear edges dashed.
- For an oblique prism projection, every `topVertexIds[i]` must equal `baseVertexIds[i]` plus the same 2D depth vector. Do not preserve small perspective-like mismatches from a source image.
- For `pyramid`, keep `apexId` out of `baseVertexIds` and place the apex far enough from the base centroid to read as a real apex.
- For nested solid requests, keep inner vertices inside the outer projection and separate multiple inner solids in the screen projection so they do not visually overlap.
- For `angleDimension`, choose helper points that are distinct from the vertex, far enough from the vertex, and non-collinear so the angle arc is visible.
- When a right-angle mark would be small at a crowded vertex, add a larger `angleDimension` with `arcRadius` at least `0.7` and `showValue:false` instead of relying only on the default small `rightAngleMarker`.
- Use `labelOffset` on required labels near tangency points, angle markers, collinear construction points, or crowded intersections so the label does not sit on top of the marker or line.
- Point-label `labelOffset.y` addresses a bottom text baseline, not the glyph center. For an approximately 27px label, start near y=-4..7 above a point and y=30..38 below it; do not place upper labels at y=-20..-30 by habit.
- Treat the 48px spacing and 2.4-font-height offset thresholds as review heuristics, not teacher-approved constraints. Preserve specified geometry; inspect nearby points when labels need large displacements.
- Place angle text independently from its arc. Teacher revisions repeatedly moved angle text while retaining arc radius; assess text width, adjacent angles, and association with the intended angle before changing the arc.
- Compare teacher edits against their original files, excluding timestamps, view pans, float noise, blocked edits, and serialization losses. Distinguish screen-pixel point offsets from mathematical-coordinate dimension offsets; read the exam layout reference for repeated evidence and exceptions.
- Keep helper segments used only by midpoint, intersection, or length-dimension dependencies hidden when a visible parent segment already represents the same geometry.
- Set helper-only points to `visible:false` when they should not appear as extra dots.
- For monochrome exam diagrams, named vertices, intersections, and midpoints normally keep their labels but use `pointSize:0`; do not add filled circular markers merely because a point object exists. Preserve a visible marker only when open/closed point status or another point symbol is itself mathematical information.
- For prism cross-sections, make the outer solid projection broad enough to read and make the section polygon span a substantial middle portion of the prism, not a tiny internal square.
- For nested solids, leave visible projection margin between the inner solid and the outer prism/pyramid boundary; containment alone is not enough when the result looks cramped.
- For OpenAI Responses API prompts, keep the current strict Structured Outputs `operations[]` contract and avoid adding unsupported fields.
- For command/recreate AI flows, remember that `AIService` now runs `DiagramQualityEnhancer` after JSON parsing; prompt for good geometry, but rely on the app-owned enhancer for recurring label-offset, right-angle-aid, prism cross-section, and nested triangular-solid layout corrections.
- Default object stroke and fill color is `#000000`; omit color fields unless a user explicitly requests color, and never introduce multiple colors on your own.
- For image/PDF recreation, use first-class `cylinder`, `cone`, `sphere`, and `textLabel` nodes when visible. Emit unsupported items for native statistical charts, tables, nets, annular sectors, or exact function-bounded curved fills instead of silently guessing them.

## Quality Checks

Before returning final JSON, check:

- Root shape is exactly an object with `operations`.
- Every `create` has a supported `type`.
- Required fields for that type are present.
- An unspecified representative parameter satisfies the stated domain, keeps required intersections and segments non-degenerate, and is not presented as the answer.
- References point to existing canvas IDs or IDs created earlier in the same batch.
- `polygon.vertexIds`, `prism.baseVertexIds`, and `pyramid.baseVertexIds` contain at least three point IDs.
- `pyramid.apexId` is not one of the base vertices.
- Visible angle markers do not reuse the vertex as a helper point.
- `numberLine.start < numberLine.end` and `numberLine.step > 0`.
- `numberLine.customMarks[].endpoint`, when present, is `open` or `closed`.
- `function` range limits satisfy `xMin < xMax` and `yMin < yMax` when both bounds are present; `intersection.branch` is `0` or `1` when supplied.
- Piecewise-function endpoints use `pointStyle:"open"` or `pointStyle:"closed"` consistently with interval inclusion, and every function is clipped to its intended domain.
- `cylinder`, `cone`, and `sphere` have finite `x`, `y`, positive `width`/`height`, and a sensible `ellipseRatio`; `textLabel` has non-empty `text` and finite `x`, `y`.
- A point described as lying on a segment resolves to that segment at 0 <= t <= 1; any internal-division ratio matches the requested order.
- A named polygon whose area is the requested value, maximum, or minimum has a light fill; polygons whose area is only a given condition remain unfilled unless the source image itself is shaded.
- Styling fields are simple values: hex colors, numeric widths/opacities, booleans for toggles. Default color fields, when included, should be `#000000`.
- For exam-project JSON, run `node .agents/skills/mathgraph-drawing/scripts/check-exam-diagram-layout.mjs --strict <file>` and resolve close named points, excessive label offsets, baseline misuse, visible point markers, missing length curvature, and thin length strokes.
