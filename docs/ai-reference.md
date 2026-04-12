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
- `arc`
- `sector`
- `circularSegment`
- `prism`
- `pyramid`

Important:

- Use `tangentCircle` and `tangentFunction`, not a generic `tangent` type.
- `arc`, `sector`, and `circularSegment` are supported in the current runtime.
- `prism` and `pyramid` are supported in the current runtime.

## 4. Runtime Features Outside The AI Schema

The application UI also exposes some tools and view controls that are part of the runtime but are not yet part of the validated AI JSON schema.

- `polygon`
- `numberLine`
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

### 6.2 Segment / Line / Ray

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

### 6.3 Circle Variants

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

### 6.4 Arc / Sector / Circular Segment

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

### 6.5 Tangent Objects

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

### 6.6 Function

```json
{
  "op": "create",
  "type": "function",
  "label": "f1",
  "expression": "x^2 - 2*x + 1"
}
```

Use `*` for multiplication in expressions. The runtime parser also accepts common function names such as `sin`, `cos`, `tan`, `sqrt`, `abs`, `log`, `ln`, and `exp`.

### 6.7 Vector

```json
{
  "op": "create",
  "type": "vector",
  "startPointId": "A",
  "endPointId": "B"
}
```

### 6.8 Markers And 3D

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
