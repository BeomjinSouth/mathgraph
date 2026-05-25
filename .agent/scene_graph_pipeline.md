# Scene Graph Pipeline Plan

## Why This Is Needed

The previous image/PDF work proved that the OpenAI API path can return valid JSON and that MathGraph can render it. It did not prove diagram fidelity. A model can produce schema-valid `operations[]` while missing the actual math structure, overgenerating page decoration, or editing the wrong object.

The root fix is to stop treating direct model-authored GraphA operations as the primary image/PDF reconstruction strategy.

## Target Architecture

1. Image/PDF input is cropped to the relevant diagram region before model analysis whenever possible.
2. The model describes the diagram as a high-level scene graph:
   - math entities: points, segments, circles, arcs, sectors, polygons, functions, number lines, solids;
   - relations: intersection, midpoint, perpendicular, parallel, equal length, right angle, tangency, dimensions;
   - source evidence and uncertainty when an entity is ambiguous;
   - unsupported visual elements such as dense text, curved solids, tables, or chart primitives.
3. MathGraph compiles the scene graph into GraphA `operations[]` deterministically.
4. The existing `SchemaValidator`, reference checks, semantic validators, and browser rendering run after compilation.
5. Partial image edits target selected scene nodes or selected GraphA ids, then compile only the requested patch.

## Why The JSON Manual Still Matters

The existing JSON manual becomes a compiler and prompt contract rather than just a prompt hint:

- `retrieval-index.json` selects the relevant object families for the scene graph request.
- `feature-manual.json` tells the model which scene node kinds can become first-class GraphA objects today.
- Unsupported manual gaps are surfaced as compiler warnings instead of silently becoming incorrect geometry.
- When new GraphA primitives are added, the manual, schema validator, compiler, and examples should be updated together.

## Current Implementation Slice

This pass adds a deterministic scene graph compiler foundation. It does not yet replace every live OpenAI image/PDF call with scene graph mode. The goal is to create the app-owned layer needed before switching live prompts over safely.

Included now:

- scene graph node/relation normalization;
- deterministic GraphA operation generation;
- warnings for unsupported first-class requests such as cylinder, cone, sphere, text labels, and native statistical charts;
- validation tests proving compiled output passes the existing GraphA schema/reference checks.

Remaining follow-up:

- wire recreate-mode image/PDF calls to request scene graphs by default;
- add crop metadata and scene-node ids to saved evidence;
- add first-class chart and curved-solid primitives where exact textbook parity is impossible with current objects;
- add visual comparison/eval cases for source crop versus compiled render.
