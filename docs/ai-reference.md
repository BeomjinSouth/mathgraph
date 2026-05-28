# GraphA AI Reference

## Purpose
This document defines the JSON contract the AI should emit for the current runtime.
The app expects JSON only. Do not wrap the result in prose unless the caller explicitly asks for explanation.

## 0. Token-Efficient Reference Skill

For future GPT/OpenAI API orchestration, start with the project-local skill:

- `.agents/skills/mathgraph-drawing/SKILL.md`
- `.agents/skills/mathgraph-drawing/references/retrieval-index.json`
- `.agents/skills/mathgraph-drawing/references/feature-manual.json`
- `.agents/skills/mathgraph-drawing/references/synthetic-drawing-data.jsonl`

Load `retrieval-index.json` first, then fetch only the feature chunks and synthetic examples matching the user's Korean request. This keeps complex drawing prompts from carrying every schema and example on every API call.

The browser AI service now uses the same idea at runtime: before OpenAI text/image requests, it tries to load `retrieval-index.json` and `feature-manual.json`, selects the relevant object types from the user instruction and selected canvas objects, and injects a compact manual summary into the prompt. If those files are unavailable in a deployment, the API call still runs with the built-in prompt, but fidelity may be weaker.

## 1. Runtime Contract

The current runtime consumes an `operations` array.

Preferred shape:

```json
{
  "operations": [
    { "op": "create", "id": "tmp_1", "type": "point", "label": "A", "x": 0, "y": 0 }
  ]
}
```

Supported input forms in code are slightly more permissive, but AI output should use `operations[]` because that is the contract the validator and patch applier are built around.

Legacy `action / changes / objects` examples are outdated and should not be used for new prompts.

## 1.1 OpenAI Request Contract

The OpenAI-backed path should use the Responses API with Structured Outputs rather than legacy JSON mode.

Current request defaults:

- Endpoint: `POST https://api.openai.com/v1/responses`
- Default model: `gpt-5.5`
- Text format: `json_schema` named `graph_operations`
- Strict schema: enabled
- Store responses: `false`
- Reasoning effort: configured per app setting, default `low`
- Text verbosity: configured per app setting, default `low`

The strict schema represents optional graph fields as nullable values because Structured Outputs requires all schema fields to be required. The app strips `null` fields before running `SchemaValidator` and `PatchApplier`.

## 1.2 Image Reference And Targeted Patching

The chat image workflow uses the same Responses API and strict `operations[]` output contract. Images are sent as `input_image` content with a text instruction. The app then validates and applies the returned graph-object patch through `SchemaValidator` and `PatchApplier`.

Modes:

- Image-only paste/upload: recreate the visible math diagram as new GraphA objects.
- Image plus text instruction: treat the image as a reference and return only the requested `update`, `delete`, or targeted `create` operations.

Context sent with image requests:

- Current canvas objects, including ids, labels, coordinates when available, dependencies, and selected-object ids.
- Selected objects are treated as the preferred edit target for partial-change requests.

Important boundary:

- This is vector-object reconstruction and patching. It is not pixel-level image editing or mask-based raster inpainting.
- True raster edits would require a separate Images API edit workflow and, for precise local changes, a mask UI with same-size alpha-channel masks.
- Patch-mode responses run semantic intent validation after schema/reference validation:
  - If selected ids exist and the instruction asks to mutate the selected part, at least one selected id must be updated or deleted.
  - Strict selected-object edits such as "only this point" cannot create new objects or mutate unselected ids.
  - OpenAI image analysis retries once with the semantic validation errors before failing.
- Image recreation has an operation budget of 45 operations. Dense textbook grids, page text, and decorative elements should be simplified or ignored unless explicitly requested.

## 1.2.1 Scene Graph Reconstruction Direction

The root architecture for image/PDF reconstruction is moving away from direct model-authored GraphA operations.

Preferred pipeline for recreate-mode image/PDF work:

1. Ask the model to describe the source crop as a high-level scene graph: nodes, relations, unsupported elements, and uncertainty.
2. Compile that scene graph into GraphA operations with app-owned deterministic code.
3. Validate the compiled operations with `SchemaValidator`, reference checks, semantic validators, and rendered canvas checks.

The first compiler foundation is `js/ai/SceneGraphCompiler.js`. It accepts scene nodes such as `point`, `segment`, `circle`, `arc`, `sector`, `lensRegion`, `polygon`, `function`, `numberLine`, `prism`, and `pyramid`, plus relations such as `intersection`, `midpoint`, `parallel`, `perpendicular`, `rightAngle`, `equalLength`, `angleDimension`, and `lengthDimension`.

Unsupported scene nodes such as `cylinder`, `cone`, `sphere`, native `histogram`, native `scatterPlot`, and independent `textLabel` are returned as warnings instead of invalid GraphA. That is intentional: exact textbook parity for those features requires new first-class runtime primitives.

## 1.3 PDF Sample Semantic Validation

PDF-derived samples use one more gate beyond schema/reference/render checks: `js/ai/SemanticValidator.js`.

The validator checks category-specific math structure before a live OpenAI result is accepted:

- radical number-line construction: real `numberLine`, sqrt(2) location, right triangle, and sqrt(2)-radius circle;
- circle sector: circle, arc, sector, and central-angle marker;
- histogram/frequency polygon: rectangular bars on a common baseline plus connected frequency segments;
- incircle: contact points on triangle sides with perpendicular radius segments;
- similarity, linear graph, quadratic graph, trigonometry, distribution curves, scatter, and prism categories each have matching structure checks.

`tools/run-live-openai-pdf-ai-samples.mjs` now injects the JSON manual reference into the live prompt, optionally attaches available source page/crop images from `tmp/pdf-ai-audit/`, and retries when schema/reference/intent/semantic validation fails. `tools/validate-live-openai-pdf-results.mjs` can recheck a saved live result file and writes `tmp/live-openai-pdf-ai-samples/semantic-validation-report.json`.

## 2. Operation Schema

Each operation uses:

```json
{
  "op": "create",
  "id": "optional-but-recommended",
  "type": "point"
}
```

Rules:

- `op` must be one of `create`, `update`, or `delete`.
- `type` is required for `create`.
- `id` is required for `update` and `delete`.
- If a later operation references an object created earlier in the same payload, put the creator first.
- The patch applier is sequential, but it now restores the previous canvas state if any operation in the batch fails.

## 3. Supported Create Types

These object types are currently supported by the AI validator and runtime patching flow:

- `point`
- `pointOnLine`
- `pointOnCircle`
- `circleCenterPoint`
- `segment`
- `line`
- `ray`
- `circle`
- `circleThreePoints`
- `intersection`
- `midpoint`
- `parallel`
- `perpendicular`
- `perpendicularBisector`
- `angleBisector`
- `tangentCircle`
- `tangentFunction`
- `function`
- `vector`
- `rightAngleMarker`
- `equalLengthMarker`
- `angleDimension`
- `lengthDimension`
- `arc`
- `sector`
- `circularSegment`
- `lensRegion`
- `polygon`
- `prism`
- `pyramid`
- `numberLine`

Important:

- Use `tangentCircle` and `tangentFunction`, not a generic `tangent` type.
- `rightAngleMarker`, `equalLengthMarker`, `angleDimension`, and `lengthDimension` are supported in the current runtime.
- `arc`, `sector`, and `circularSegment` are supported in the current runtime.
- Use `lensRegion` for the exact filled overlap of two intersecting circles.
- Use `polygon` for triangles, quadrilaterals, and straight-edged filled plane regions that are defined by existing point IDs.
- `prism` and `pyramid` are supported in the current runtime.
- `numberLine` is supported in the validated AI patch flow with numeric `start`, `end`, `step`, and `y` fields.

## 4. Runtime Features Outside The AI Schema

The application UI also exposes view controls that are part of the runtime but are not yet part of the validated AI JSON schema.

- settings and view toggles such as grid, x-axis, y-axis, hidden-object visibility, and style controls
- vector fill tool for applying fill color/opacity to circles, polygons, sectors, circular segments, and lens regions

Treat those as UI/runtime features unless the schema validator is expanded to accept them.

## 5. Common Fields

Most object types accept the following optional properties:

| Field | Type | Notes |
| --- | --- | --- |
| `label` | string | Human-readable name for the object |
| `color` | string | Hex color string. Default drawing output should use `#000000` unless the user explicitly asks for another color. |
| `visible` | boolean | Visibility flag |
| `lineWidth` | number | Stroke width |
| `pointSize` | number | Point radius/size |
| `fontSize` | number | Label size |
| `labelOffset` | object | Label offset such as `{ "x": 0.2, "y": 0.1 }` |
| `dashed` | boolean | Dashed stroke toggle |
| `fillColor` | string | Fill color for area-capable objects such as circles, polygons, sectors, circular segments, and lens regions. |
| `fillOpacity` | number | Fill opacity between `0` and `1` |

These common style fields are applied during both `create` and `update` operations when the target runtime object supports them. For token-efficient AI calls, omit color fields unless a color is requested; the runtime default is black.

Reference fields should point to existing object IDs unless the referenced object is created earlier in the same `operations` list.

## 6. Object-Specific Fields

### 6.1 Point

```json
{
  "op": "create",
  "id": "A",
  "type": "point",
  "label": "A",
  "x": 0,
  "y": 0
}
```

### 6.2 Point Helpers

`pointOnLine` uses `t`. `pointOnCircle` uses `angle` in radians. Do not send `t` for `pointOnCircle`; the runtime ignores it and can collapse arcs or sectors when the generated circle point falls back to angle `0`.

```json
{
  "op": "create",
  "type": "pointOnLine",
  "lineId": "line_1",
  "t": 0.5,
  "label": "M"
}
```

```json
{
  "op": "create",
  "type": "pointOnCircle",
  "circleId": "circle_1",
  "angle": 1.5708,
  "label": "P"
}
```

```json
{
  "op": "create",
  "type": "circleCenterPoint",
  "circleId": "circle_1",
  "label": "O"
}
```

### 6.3 Segment / Line / Ray

```json
{
  "op": "create",
  "type": "segment",
  "point1Id": "A",
  "point2Id": "B"
}
```

```json
{
  "op": "create",
  "type": "line",
  "point1Id": "A",
  "point2Id": "B"
}
```

```json
{
  "op": "create",
  "type": "ray",
  "originId": "A",
  "directionPointId": "B"
}
```

### 6.4 Circle Variants

```json
{
  "op": "create",
  "type": "circle",
  "centerId": "O",
  "pointOnCircleId": "A"
}
```

```json
{
  "op": "create",
  "type": "circleThreePoints",
  "point1Id": "A",
  "point2Id": "B",
  "point3Id": "C"
}
```

### 6.5 Arc / Sector / Circular Segment

```json
{
  "op": "create",
  "type": "arc",
  "circleId": "circle_1",
  "startPointId": "P1",
  "endPointId": "P2",
  "mode": "minor"
}
```

```json
{
  "op": "create",
  "type": "sector",
  "circleId": "circle_1",
  "startPointId": "P1",
  "endPointId": "P2",
  "mode": "minor",
  "fillColor": "#000000",
  "fillOpacity": 0.3
}
```

```json
{
  "op": "create",
  "type": "circularSegment",
  "circleId": "circle_1",
  "startPointId": "P1",
  "endPointId": "P2",
  "mode": "minor"
}
```

### 6.6 Polygon

### 6.6a Lens Region

```json
{
  "op": "create",
  "id": "lens_c1_c2",
  "type": "lensRegion",
  "circle1Id": "c1",
  "circle2Id": "c2",
  "fillColor": "#000000",
  "fillOpacity": 0.24
}
```

Required fields: `circle1Id` and `circle2Id`.

Use `lensRegion` when the intended drawing is the filled overlap of two intersecting circles. It follows the two circular-arc boundaries directly and avoids the internal chord lines or self-crossing point order that can appear when the same shape is approximated with polygons or paired circular segments.

```json
{
  "op": "create",
  "id": "poly_ABC",
  "type": "polygon",
  "vertexIds": ["A", "B", "C"],
  "fillColor": "#000000",
  "fillOpacity": 0.12
}
```

Required field: `vertexIds`, an array of at least three point IDs created earlier in the same operation list or already present on the canvas.

### 6.7 Tangent Objects

```json
{
  "op": "create",
  "type": "tangentCircle",
  "circleId": "circle_1",
  "tangentPointId": "P"
}
```

```json
{
  "op": "create",
  "type": "tangentFunction",
  "functionId": "f1",
  "x": 1
}
```

### 6.8 Function

```json
{
  "op": "create",
  "type": "function",
  "label": "f1",
  "expression": "x^2 - 2*x + 1"
}
```

Use `*` for multiplication in expressions. The runtime parser also accepts common function names such as `sin`, `cos`, `tan`, `sqrt`, `abs`, `log`, `ln`, and `exp`.

Function expressions must be right-hand-side expressions only. Use `"x^2 - 4"`, not `"y=x^2-4"`; including `y=` makes the function invalid and prevents the graph from rendering.

### 6.9 Vector

```json
{
  "op": "create",
  "type": "vector",
  "startPointId": "A",
  "endPointId": "B"
}
```

### 6.10 Markers And Dimensions

```json
{
  "op": "create",
  "type": "rightAngleMarker",
  "vertexId": "I",
  "line1Id": "L1",
  "line2Id": "L2"
}
```

```json
{
  "op": "create",
  "type": "equalLengthMarker",
  "segment1Id": "S1",
  "segment2Id": "S2"
}
```

```json
{
  "op": "create",
  "type": "angleDimension",
  "vertexId": "B",
  "point1Id": "A",
  "point2Id": "C",
  "arcRadius": 0.5,
  "showValue": false
}
```

Optional `angleDimension` display fields include `arcRadius`, `showValue`, `markerCount`, `customText`, `labelFontSize`, and `labelOffset`. When several angle markers share one vertex, stagger `arcRadius` values to keep the arcs legible.

```json
{
  "op": "create",
  "type": "lengthDimension",
  "segmentId": "AB"
}
```

### 6.11 Number Line

```json
{
  "op": "create",
  "type": "numberLine",
  "start": -5,
  "end": 5,
  "step": 1,
  "y": 0,
  "showArrows": true
}
```

Required fields for `numberLine` are `start`, `end`, `step`, and `y`.
Optional fields are `showArrows`, `tickHeight`, `customMarks`, and the shared style fields from Section 5.

`numberLine` also supports the shared style fields, plus optional `tickHeight` and `customMarks` when you need finer runtime control.

```json
{
  "op": "update",
  "id": "number_line_1",
  "start": -10,
  "end": 10,
  "step": 2,
  "y": 1,
  "showArrows": false,
  "tickHeight": 0.2,
  "customMarks": [
    { "value": 0, "label": "O" },
    { "value": 4, "label": "4" }
  ]
}
```

### 6.12 3D Objects

```json
{
  "op": "create",
  "type": "prism",
  "baseVertexIds": ["A", "B", "C"],
  "topVertexIds": ["A2", "B2", "C2"]
}
```

For `prism`, treat `baseVertexIds` as the near/front face and `topVertexIds` as the shifted rear face. The runtime keeps front/base edges solid and dashes hidden rear/top edges.

```json
{
  "op": "create",
  "type": "pyramid",
  "baseVertexIds": ["A", "B", "C", "D"],
  "apexId": "V"
}
```

### 6.13 Dense Prompt Guidance

For complex live OpenAI drawing prompts, include the following context when it matches the request:

- Function expressions must be right-hand-side only, with no `y=`.
- Hide helper labels with `showLabel:false`; dense graph families and nested solids should use a small explicit visible-label budget.
- Hide helper points with `visible:false` when they only shape a region or construction and should not appear as extra dots.
- For two-circle lens regions, use `lensRegion` for the filled overlap. Add direct upper/lower point objects only when A and B must be distinct visible lens endpoints.
- For construction-only polygons that should look like outlines, set `fillOpacity:0`; use positive `fillOpacity` only when the prompt requests a shaded region.
- For `angleDimension`, make `point1Id` and `point2Id` distinct from `vertexId`, far enough from the vertex to render an arc, and non-collinear.
- For focus/directrix, tangent-from-point, feasible-region, or named construction-point prompts, include exact coordinates for the intended visible points and the exact equations for reference lines.
- For concentric circles or fixed-radius tangency diagrams, state the shared center id and numeric radii. Current GraphA has no first-class `annularSector`; use a normal `sector` plus an inner circle outline unless a future primitive is added.
- For curved regions bounded by functions, use a polygon through explicit boundary/sample points and hide helper points; do not claim exact curved fill unless a first-class region primitive exists.
- For nested solids, use first-class `prism` and `pyramid` objects rather than hand-drawn segment bundles. For prisms, put the near/front face in `baseVertexIds` and the shifted rear face in `topVertexIds`; put every inner-solid vertex inside the outer solid's screen-projection region, and separate multiple inner solids so their projected centers do not overlap.
- For `pyramid`, `apexId` must not appear in `baseVertexIds`, and the apex should be visually separated from the base centroid.
- For polygon-owned boundaries, do not require duplicate segment edges unless the user explicitly asks for separate selectable edge segments.
- The live smoke runner can render deterministic target sheets without an API call by setting `LIVE_AI_RENDER_REFERENCE_TARGETS=1`. Use this to compare intended visuals against live OpenAI outputs.

## 7. Example Payloads

### 7.1 Triangle Construction

```json
{
  "operations": [
    { "op": "create", "id": "A", "type": "point", "label": "A", "x": 0, "y": 0 },
    { "op": "create", "id": "B", "type": "point", "label": "B", "x": 4, "y": 0 },
    { "op": "create", "id": "C", "type": "point", "label": "C", "x": 2, "y": 3 },
    { "op": "create", "id": "poly_ABC", "type": "polygon", "vertexIds": ["A", "B", "C"], "fillColor": "#000000", "fillOpacity": 0.12 }
  ]
}
```

### 7.2 Function With Tangent

```json
{
  "operations": [
    { "op": "create", "id": "f", "type": "function", "label": "f", "expression": "x" },
    { "op": "create", "type": "tangentFunction", "functionId": "f", "x": 1 }
  ]
}
```

### 7.3 Update And Delete

```json
{
  "operations": [
    { "op": "update", "id": "A", "label": "A_1", "color": "#000000" },
    { "op": "delete", "id": "old_circle" }
  ]
}
```

## 8. Output Safety Checklist

- Output JSON only.
- Use `operations[]` as the root shape.
- Use only supported `op` values.
- Use only validated create `type` values.
- Prefer concrete object IDs and keep references in creation order.
- Avoid unsupported legacy shapes like `action`, `changes`, or a generic `tangent` type.

## 9. Maintenance Notes

### 2026-04-13 Recovery And Fallback Revalidation

- `js/ai/AIService.js` was restored to a parse-valid baseline after a broken intermediate edit and reconnected to the shared `parseAIJSONPayload()` helper.
- Deterministic local fallback is revalidated for delete-safety, circle center/radius prompts, graph-function prompts, midpoint requests, tangent-to-function prompts, standard-form circle equations, and linear equations.
- The AI request context now includes richer serialized object data (`id`, coordinates, expressions, dependencies, and number-line fields) so provider-backed natural-language requests can reference existing objects more reliably.
