# 사각기둥 투영 보정

## 문제

- 이미지 재현 결과에서 `prism`의 앞면과 뒷면 대응 꼭짓점이 서로 다른 2차원 이동량을 사용하면, 같은 방향이어야 할 옆모서리가 제각각 기울어진다.
- 현재 런타임은 꼭짓점 배열 길이와 참조만 확인하므로, 이 작은 좌표 흔들림을 그대로 그린다.

## 목표와 범위

1. AI 명령 및 이미지 재현 결과의 `prism`을 대상으로, 대응하는 앞면·뒷면 꼭짓점이 하나의 공통 2차원 이동 벡터를 사용하도록 보정한다.
2. 보정 전 앞면의 점과 라벨, 음영·단면 등 다른 객체 참조는 유지한다.
3. 사용자가 세 개 이상 좌표를 직접 지정한 요청과 선택 객체 부분 수정 모드에는 보정을 적용하지 않는다.

## 완료 기준

- [ ] 흔들린 사각기둥의 네 옆모서리가 모두 평행하게 렌더링된다.
- [ ] 삼각기둥을 포함한 일반 `prism`도 같은 꼭짓점 순서와 공통 평행이동을 유지한다.
- [ ] 명시 좌표 요청과 부분 수정 요청은 기존 좌표를 유지한다.
- [ ] 관련 단위 테스트, 전체 테스트, 정적 검사, 빌드 및 공백 검사를 통과한다.

## 검증 계획

- `tests/ai-flow.test.js`에 흔들린 사각기둥 보정과 명시 좌표 보존 회귀 검사를 추가한다.
- 기존 `tests/solid3d-hidden-edges.test.js`와 전체 `npm.cmd test`를 실행한다.
- 실제 캔버스에서 보정 전후 투영을 확인하는 로컬 브라우저 점검을 수행한다.

## 진행

- 2026-08-05: 이미지 재현 경로가 `DiagramQualityEnhancer`를 거치지만, 공통 깊이 벡터 보정은 없음을 확인했다.
- 2026-08-05: Implemented the deterministic prism rear-face translation normalization and focused regression tests.
- 2026-08-05: Verified focused AI flow tests, solid hidden-edge tests, the full suite, Vercel static build, and a local browser canvas application with zero browser errors.
