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

## 2026-08-05 Live Problem-Image Activation

The production failures confirmed the architectural gap described above. The live image-only path still asked a vision model to author the final, wide `operations[]` schema directly. Valid JSON therefore did not imply that the source relationships were preserved, and every retry resent the expensive image.

This implementation activates the scene boundary for `problem_diagram` requests:

1. GPT-5.6 Luna reads the image once and returns a compact scene with source-grounded `mustDraw` items.
2. `SceneGraphCompiler` resolves node dependencies and compiles the scene locally.
3. A coverage gate checks that every required source item maps to compiled operation ids.
4. Only invalid scenes use a bounded image retry; successful scenes do not pay for a second model call.
5. Patch and generic image-recreate behavior remain on the existing operation contract.

The model migration is tier-aware. Luna replaces the former low-cost image worker and becomes the app default requested by the owner; older models remain available in the picker. The migration also makes image detail and reasoning explicit and raises the proxy/client timeout without enabling Pro mode or other optional GPT-5.6 features.

## 2026-08-05 진단 관측 계층

장면 파이프라인의 각 경계가 요청별 `traceId`에 기록된다.

1. 모델이 반환한 장면 노드와 응답 식별자
2. 장면 컴파일 결과
3. `mustDraw` 필수 요소 검사
4. 결정적 품질 보정 전후 작업 차이
5. 의미 검증 결과
6. 캔버스 스키마·참조·의미·패치 적용 결과

이 기록은 내부 변환이 시작된 지점을 좁히기 위한 것이다. 원본 이미지와 최종 렌더를 자동 비교하지 않으므로, 모든 단계가 통과해도 최종 상태는 `source_fidelity_unverified`이다. 원본 이미지, 원문 지시, API 키와 인증 토큰은 기록하지 않는다.
