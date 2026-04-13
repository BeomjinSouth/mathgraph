# Solid 3D Vertex Labeling And Rotation Implementation

## Scope

- 3D 도형 생성 시 자동 라벨이 순차적으로 보이도록 정리
- 점/라벨이 항상 도형 위에 보이도록 렌더 순서 조정
- 3D 도형 본체 드래그 시 의존 점들을 함께 이동
- 3D 도형 선택 후 `Ctrl+드래그` 시 의존 점들을 함께 회전
- 히스토리와 선택 UX가 유지되도록 SelectTool 기준으로 구현

## Planned Changes

1. `js/tools/Solid3DTool.js`
   - 각기둥 윗면 점 생성 시 수동 프라임 라벨 대신 기본 자동 라벨을 사용
2. `js/tools/SelectTool.js`
   - 각기둥/각뿔 선택 시 의존 점들을 직접 드래그할 수 있는 경로 추가
   - hover 커서를 실제 드래그 가능 여부에 맞게 보정
3. `js/main.js`
   - 렌더 시 점 계열 객체를 마지막에 그려서 도형 위에 보이게 조정
   - export 렌더도 같은 순서를 사용
4. `js/objects/Solid3D.js`
   - 각기둥/각뿔의 회전 중심을 계산할 수 있는 헬퍼 추가
5. `js/main.js`
   - 입체도형 도움말에 이동/회전 제스처 안내 추가

## Constraints

- 기존 점 라벨 드래그 기능은 그대로 유지
- 일반 도형 선택/박스 선택 동작은 최대한 보존
- 3D 전용 로직이 undo/redo를 깨지 않도록 실제 이동 대상은 점 객체여야 함
- `Alt+드래그` 패닝과 충돌하지 않도록 회전은 `Ctrl+드래그`로 제한

## Progress

- 2026-04-12: 구현 설계 정리
- 2026-04-12: 각기둥 윗면 라벨을 순차 자동 라벨로 정리
- 2026-04-12: 각기둥/각뿔 본체 드래그 시 의존 점 이동 경로 추가
- 2026-04-12: 점 계열 객체를 마지막에 렌더링하도록 조정
- 2026-04-12: `npm.cmd run build` 확인 완료
- 2026-04-13: 회전 조작 요구를 반영하기 위해 문서 업데이트
- 2026-04-13: 각기둥/각뿔 `Ctrl+드래그` 회전 구현
- 2026-04-13: 회전 안내 문구 및 정적 빌드 확인 완료

- 2026-04-13: Fixed prism/pyramid hidden-edge indexing so the closing edge (`last -> first`) can be dashed correctly
- 2026-04-13: Added Solid3D hidden-edge regression tests for pyramid and prism wrap-around edges

## Follow-ups

- 필요 시 3D 회전 전용 핸들/패널 UX는 후속 작업으로 분리
