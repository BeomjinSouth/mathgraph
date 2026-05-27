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

- Plane figures: load core contract, point/line/polygon objects, construction objects, marker/dimension objects, and examples tagged `plane`.
- Circles and curved regions: load circle, circleThreePoints, pointOnCircle, tangentCircle, arc, sector, circularSegment, and examples tagged `circle`.
- Solids: load prism/pyramid, base/top/apex point patterns, and examples tagged `solid`.
- Graphs/functions: load function, tangentFunction, intersection, line/segment, numberLine, and examples tagged `graph`.
- Statistical or chart-like requests: load polygon, numberLine, line/segment, and examples tagged `chart_approximation`; mention that chart primitives are not first-class yet.
- API integration prompts: load `api_prompting`, `operationContract`, and `validationWorkflow` from the feature manual.
- Image reference or patching prompts: load `api_prompting`, `operationContract`, `validationWorkflow`, known gaps, and only the object chunks relevant to the pasted image/instruction.

## Output Rules

- Create referenced objects before the objects that refer to them.
- Prefer stable temporary IDs such as `A`, `AB`, `poly_ABC`, or `prism_1`.
- Use only supported create `type` values from the feature manual.
- For selected-object patch requests, prefer `update`/`delete` operations on existing selected IDs. Do not create unrelated objects when the user says only this part/selected object should change.
- For image recreation, stay within the current operation budget and ignore dense page text, decorative grids, and unsupported textbook furniture unless requested.
- Use `polygon` for triangles, quadrilaterals, shaded regions, bars, and other filled plane regions.
- If a polygon is only a construction boundary or outline, set `fillOpacity:0`; use positive fill opacity only for requested shaded regions.
- Use `prism` and `pyramid` for current solid support. Approximate cylinders, cones, spheres, nets, box plots, histograms, and scatter plots with current primitives and state the limitation when needed.
- For `pyramid`, keep `apexId` out of `baseVertexIds` and place the apex far enough from the base centroid to read as a real apex.
- For nested solid requests, keep inner vertices inside the outer projection and separate multiple inner solids in the screen projection so they do not visually overlap.
- For `angleDimension`, choose helper points that are distinct from the vertex, far enough from the vertex, and non-collinear so the angle arc is visible.
- Set helper-only points to `visible:false` when they should not appear as extra dots.
- For OpenAI Responses API prompts, keep the current strict Structured Outputs `operations[]` contract and avoid adding unsupported fields.
- Default object stroke and fill color is `#000000`; omit color fields unless a user explicitly requests color, and never introduce multiple colors on your own.
- For image/PDF recreation, do not silently approximate unsupported first-class nodes such as cylinder, cone, sphere, native histogram/scatter/box plot, or standalone text. Emit a scene graph unsupported item or compiler warning unless the user explicitly accepts approximation.

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
- Styling fields are simple values: hex colors, numeric widths/opacities, booleans for toggles. Default color fields, when included, should be `#000000`.
