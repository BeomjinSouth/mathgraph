---
name: mathgraph-drawing
description: Convert Korean natural-language MathGraph drawing requests into valid GraphA operations, select only the needed drawing schema references, and use synthetic examples for complex plane geometry, solid geometry, function graphs, number lines, and mixed textbook-style diagrams. Use when building or prompting GPT/OpenAI API workflows for this MathGraph project, validating AI-generated `operations[]` JSON, or planning accurate diagram construction from informal Korean prompts.
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

## Reference Selection

- Plane figures: load core contract, point/line/polygon/textLabel objects, construction objects, marker/dimension objects, and examples tagged `plane`.
- Circles and curved regions: load circle, circleThreePoints, pointOnCircle, tangentCircle, arc, sector, circularSegment, lensRegion, and examples tagged `circle`.
- Solids: load prism/pyramid plus first-class cylinder/cone/sphere projections, base/top/apex point patterns, and examples tagged `solid`.
- Graphs/functions: load function, tangentFunction, intersection, line/segment, numberLine, and examples tagged `graph`.
- Statistical or chart-like requests: report them as explicitly excluded from the standard teacher generation workflow. Do not imply first-class support for bar/pie charts, histograms, frequency polygons, box plots, dot plots, or scatter plots.
- API integration prompts: load `api_prompting`, `operationContract`, and `validationWorkflow` from the feature manual.
- Image reference or patching prompts: load `api_prompting`, `operationContract`, `validationWorkflow`, known gaps, and only the object chunks relevant to the pasted image/instruction.

## Output Rules

- Create referenced objects before the objects that refer to them.
- Prefer stable temporary IDs such as `A`, `AB`, `poly_ABC`, or `prism_1`.
- Use only supported create `type` values from the feature manual.
- For selected-object patch requests, prefer `update`/`delete` operations on existing selected IDs. Do not create unrelated objects when the user says only this part/selected object should change.
- For image recreation, stay within the current operation budget and ignore dense page text, decorative grids, and unsupported textbook furniture unless requested.
- Use `polygon` for triangles, quadrilaterals, shaded regions, bars, and other filled plane regions.
- Use `lensRegion` for the exact filled overlap of two intersecting circles instead of approximating the lens with a polygon.
- If a polygon is only a construction boundary or outline, set `fillOpacity:0`; use positive fill opacity only for requested shaded regions.
- When the question directly asks for the value, maximum, or minimum of a named triangle or quadrilateral area, create that named polygon and use fillOpacity from 0.18 to 0.24. Do not shade when area is only a given condition, comparison, or ratio and another quantity is being asked.
- For focus/directrix, tangent-from-point, feasible-region, or named construction-point prompts, provide exact coordinates for the intended visible points and exact support-line equations.
- When a named point lies on a segment, create the segment first and use pointOnLine with lineId referencing that segment and t between 0 and 1.
- For internal division AP:PB=m:n, use t=m/(m+n) from A toward B; verify collinearity, between-ness, and the requested ratio before returning JSON.
- For concentric-circle or fixed-radius prompts, reuse the same center id and create radius points at the requested distance.
- There is no first-class `annularSector` yet; when a prompt accepts approximation, use a normal sector plus an inner circle outline rather than claiming a true ring-sector cutout.
- For function-bounded curved regions, use a polygon through explicit boundary/sample points and hide helper vertices with `visible:false`; exact curved fills need future primitives.
- Use `prism`, `pyramid`, `cylinder`, `cone`, and `sphere` for current solid support. Curved solids use editable textbook projections with optional dashed hidden curves; nets and revolution sweeps remain unsupported.
- For `prism`, put the near/front face in `baseVertexIds` and the shifted rear face in `topVertexIds` so the runtime can keep front edges solid and hidden rear edges dashed.
- For `pyramid`, keep `apexId` out of `baseVertexIds` and place the apex far enough from the base centroid to read as a real apex.
- For nested solid requests, keep inner vertices inside the outer projection and separate multiple inner solids in the screen projection so they do not visually overlap.
- For `angleDimension`, choose helper points that are distinct from the vertex, far enough from the vertex, and non-collinear so the angle arc is visible.
- When a right-angle mark would be small at a crowded vertex, add a larger `angleDimension` with `arcRadius` at least `0.7` and `showValue:false` instead of relying only on the default small `rightAngleMarker`.
- Use `labelOffset` on required labels near tangency points, angle markers, collinear construction points, or crowded intersections so the label does not sit on top of the marker or line.
- Set helper-only points to `visible:false` when they should not appear as extra dots.
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
- References point to existing canvas IDs or IDs created earlier in the same batch.
- `polygon.vertexIds`, `prism.baseVertexIds`, and `pyramid.baseVertexIds` contain at least three point IDs.
- `pyramid.apexId` is not one of the base vertices.
- Visible angle markers do not reuse the vertex as a helper point.
- `numberLine.start < numberLine.end` and `numberLine.step > 0`.
- `numberLine.customMarks[].endpoint`, when present, is `open` or `closed`.
- `function` range limits satisfy `xMin < xMax` and `yMin < yMax` when both bounds are present; `intersection.branch` is `0` or `1` when supplied.
- `cylinder`, `cone`, and `sphere` have finite `x`, `y`, positive `width`/`height`, and a sensible `ellipseRatio`; `textLabel` has non-empty `text` and finite `x`, `y`.
- A point described as lying on a segment resolves to that segment at 0 <= t <= 1; any internal-division ratio matches the requested order.
- A named polygon whose area is the requested value, maximum, or minimum has a light fill; polygons whose area is only a given condition remain unfilled unless the source image itself is shaded.
- Styling fields are simple values: hex colors, numeric widths/opacities, booleans for toggles. Default color fields, when included, should be `#000000`.
