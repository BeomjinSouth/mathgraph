# GraphA AI Reference

## Purpose
This document defines the JSON contract the AI should emit for the current runtime.
The app expects JSON only. Do not wrap the result in prose unless the caller explicitly asks for explanation.

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
- `prism`
- `pyramid`
- `numberLine`

Important:

- Use `tangentCircle` and `tangentFunction`, not a generic `tangent` type.
- `rightAngleMarker`, `equalLengthMarker`, `angleDimension`, and `lengthDimension` are supported in the current runtime.
- `arc`, `sector`, and `circularSegment` are supported in the current runtime.
- `prism` and `pyramid` are supported in the current runtime.
- `numberLine` is supported in the validated AI patch flow with numeric `start`, `end`, `step`, and `y` fields.

## 4. Runtime Features Outside The AI Schema

The application UI also exposes some tools and view controls that are part of the runtime but are not yet part of the validated AI JSON schema.

- `polygon`
- settings and view toggles such as grid, x-axis, y-axis, hidden-object visibility, and style controls

Treat those as UI/runtime features unless the schema validator is expanded to accept them.

## 5. Common Fields

Most object types accept the following optional properties:

| Field | Type | Notes |
| --- | --- | --- |
| `label` | string | Human-readable name for the object |
| `color` | string | Hex color string |
| `visible` | boolean | Visibility flag |
| `lineWidth` | number | Stroke width |
| `pointSize` | number | Point radius/size |
| `fontSize` | number | Label size |
| `dashed` | boolean | Dashed stroke toggle |
| `fillColor` | string | Fill color for area objects |
| `fillOpacity` | number | Fill opacity between `0` and `1` |

These common style fields are applied during both `create` and `update` operations when the target runtime object supports them.

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
  "fillColor": "#22c55e",
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

### 6.6 Tangent Objects

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

### 6.7 Function

```json
{
  "op": "create",
  "type": "function",
  "label": "f1",
  "expression": "x^2 - 2*x + 1"
}
```

Use `*` for multiplication in expressions. The runtime parser also accepts common function names such as `sin`, `cos`, `tan`, `sqrt`, `abs`, `log`, `ln`, and `exp`.

### 6.8 Vector

```json
{
  "op": "create",
  "type": "vector",
  "startPointId": "A",
  "endPointId": "B"
}
```

### 6.9 Markers And Dimensions

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
  "point2Id": "C"
}
```

```json
{
  "op": "create",
  "type": "lengthDimension",
  "segmentId": "AB"
}
```

### 6.10 Number Line

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

### 6.11 3D Objects

```json
{
  "op": "create",
  "type": "prism",
  "baseVertexIds": ["A", "B", "C"],
  "topVertexIds": ["A2", "B2", "C2"]
}
```

```json
{
  "op": "create",
  "type": "pyramid",
  "baseVertexIds": ["A", "B", "C", "D"],
  "apexId": "V"
}
```

## 7. Example Payloads

### 7.1 Triangle Construction

```json
{
  "operations": [
    { "op": "create", "id": "A", "type": "point", "label": "A", "x": 0, "y": 0 },
    { "op": "create", "id": "B", "type": "point", "label": "B", "x": 4, "y": 0 },
    { "op": "create", "id": "C", "type": "point", "label": "C", "x": 2, "y": 3 },
    { "op": "create", "id": "AB", "type": "segment", "point1Id": "A", "point2Id": "B" },
    { "op": "create", "id": "BC", "type": "segment", "point1Id": "B", "point2Id": "C" },
    { "op": "create", "id": "CA", "type": "segment", "point1Id": "C", "point2Id": "A" }
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
    { "op": "update", "id": "A", "label": "A_1", "color": "#ef4444" },
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
