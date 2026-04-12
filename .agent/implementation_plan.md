# 그래프A Mk.2 구현 계획

## 개요
GeoGebra 스타일의 수학 도형/함수 그래프 편집 웹 애플리케이션 - Mk.2 확장 버전

### Mk.2 핵심 목표
1. **사용성 개선**: 정수 좌표 스냅, 좌표 표시/편집, 패닝, 커서 피드백
2. **표현력 확장**: 호/부채꼴/활꼴, 색 채우기, 치수(각도/길이) 표시 및 값 수정
3. **편집 생산성**: 다중 선택, 일괄 삭제, 복사/붙여넣기, Shift 평행이동
4. **AI 신뢰성**: 구조화 출력 강제, 적용 파이프라인 검증, 실패 원인 표시
5. **대수식 입력**: 텍스트 기반 객체 생성

---

## 기술 스택
- **Core**: Vanilla HTML5 + CSS3 + JavaScript (ES6+)
- **Rendering**: Canvas 2D API
- **Export**: Canvas → PNG, SVG 직접 생성
- **AI Integration**: OpenAI API (GPT-4o with Vision)
- **Storage**: LocalStorage (JSON)

---

## Mk.2 프로젝트 구조 (확장)
```
mathGraph/
├── index.html              # 메인 HTML (Mk.2 UI 확장)
├── css/
│   └── styles.css          # 전체 스타일 (Mk.2 테마)
├── js/
│   ├── main.js             # 앱 진입점 (Mk.2 기능 통합)
│   ├── core/
│   │   ├── Canvas.js       # 캔버스 관리 + 패닝 개선
│   │   ├── ObjectManager.js # 객체 관리 + 다중 선택/복사/붙여넣기
│   │   ├── HistoryManager.js # 되돌리기/다시하기
│   │   ├── EventHandler.js  # 마우스/키보드 + 패닝 + Shift 이동
│   │   └── SelectionManager.js # [NEW] 다중 선택/드래그 선택 관리
│   ├── objects/
│   │   ├── GeoObject.js    # 기본 기하 객체 클래스
│   │   ├── Point.js        # 점 + 정수 스냅 지원
│   │   ├── Line.js         # 직선/선분/반직선
│   │   ├── Circle.js       # 원 + 컴퍼스 원
│   │   ├── Arc.js          # [NEW] 호
│   │   ├── Sector.js       # [NEW] 부채꼴
│   │   ├── CircularSegment.js # [NEW] 활꼴
│   │   ├── Function.js     # 함수 그래프
│   │   ├── Vector.js       # 벡터
│   │   ├── Marker.js       # 표식 (직각, 같은길이)
│   │   ├── AngleDimension.js # [NEW] 각도 치수
│   │   ├── LengthDimension.js # [NEW] 길이 치수
│   │   └── Solid3D.js      # 투영 입체도형
│   ├── tools/
│   │   ├── Tool.js         # 도구 기본 클래스
│   │   ├── SelectTool.js   # 선택/이동 + 다중 선택 + 드래그 선택
│   │   ├── PointTool.js    # 점 도구 + 정수 스냅
│   │   ├── LineTool.js     # 직선/선분/반직선 도구
│   │   ├── CircleTool.js   # 원 도구
│   │   ├── CompassTool.js  # [NEW] 컴퍼스 도구
│   │   ├── ArcTool.js      # [NEW] 호 도구
│   │   ├── SectorTool.js   # [NEW] 부채꼴 도구
│   │   ├── CircularSegmentTool.js # [NEW] 활꼴 도구
│   │   ├── ConstructionTools.js # 교점, 중점, 평행선, 수선 등
│   │   ├── FunctionTool.js # 함수 그래프 도구
│   │   ├── TangentTool.js  # 접선 도구
│   │   ├── AngleDimensionTool.js # [NEW] 각도 치수 도구
│   │   ├── LengthDimensionTool.js # [NEW] 길이 치수 도구
│   │   ├── MarkerTool.js   # 표식 도구 + 각도같음 표시
│   │   ├── FillTool.js     # [NEW] 색 채우기 도구
│   │   └── Solid3DTool.js  # 투영 입체도형 도구
│   ├── ui/
│   │   ├── Sidebar.js      # 왼쪽 사이드바 + 좌표 표시/편집
│   │   ├── Toolbar.js      # 상단 도구막대 + 도구 유목화
│   │   ├── PropertyPanel.js # 오른쪽 속성 패널
│   │   ├── ChatPanel.js    # AI 채팅 패널 + 오류 표시
│   │   ├── CommandPalette.js # [NEW] 명령 팔레트 (Ctrl+K)
│   │   └── AlgebraInput.js # [NEW] 대수식 입력창
│   ├── export/
│   │   ├── PNGExporter.js  # PNG 내보내기
│   │   └── SVGExporter.js  # SVG 내보내기
│   ├── ai/
│   │   ├── AIAgent.js      # AI 에이전트 + 구조화 출력 강제
│   │   ├── SchemaValidator.js # [NEW] JSON 스키마 검증
│   │   └── PatchApplier.js # [NEW] 패치 적용 파이프라인
│   └── utils/
│       ├── MathUtils.js    # 수학 유틸리티
│       ├── Parser.js       # 함수 파서 + 대수식 파서
│       └── Geometry.js     # 기하 연산
└── docs/
    └── ai-reference.md     # AI 참고 문서 (Mk.2 확장)
```

---

## 구현 단계 (PRD 10.Mk.2 개발 단계 기준)

### Phase 1: 입력/표시/패닝/커서 (사용성 기반) [PRD 3.1-3.4] ✅ 완료
- [x] 1.1 정수 스냅 점 생성 (PointTool.js 수정)
  - 클릭 시 좌표를 가장 가까운 정수로 반올림
  - "정수 스냅" 토글 옵션 (기본 켬)
  - Shift 누르면 스냅 무시 옵션
- [x] 1.2 좌측 사이드바 좌표 표시/편집 (main.js 수정)
  - 점 객체에 (x, y) 좌표 항상 표시
  - 정수면 정수로, 소수면 설정된 자릿수로 표시
  - 직접 타이핑하여 좌표 수정 가능
  - 잠금 상태인 점은 읽기 전용
- [x] 1.3 커서 모양 변경 (EventHandler.js, CSS 수정)
  - 선택 가능 대상 호버: `pointer` (손가락)
  - 점 드래그 가능: `grab` / 드래그 중 `grabbing`
  - 선/도형 드래그: `move`
  - 좌표평면 패닝: `grab` / `grabbing`
- [x] 1.4 좌표평면 드래그 패닝 (EventHandler.js 수정)
  - 빈 배경 드래그 → 패닝 (선택 도구 사용 시)
  - 객체 위 드래그 → 객체 이동 우선
  - 스페이스바 + 드래그 → 어디서든 패닝

### Phase 2: 편집 시스템 확장 [PRD 5.8, 5.12, 5.13] ✅ 완료
- [x] 2.1 SelectionManager (기존 ObjectManager 활용)
  - 다중 선택 상태 관리
  - 선택 집합 저장/조회
- [x] 2.2 다중 선택 (SelectTool.js 수정)
  - Shift+클릭: 토글 방식 다중 선택
  - 드래그 박스: 영역 내 선택
- [x] 2.3 일괄 삭제 (기존 구현 활용)
  - Delete 키로 선택된 객체 일괄 삭제
  - "함께 삭제될 항목" 미리보기
- [x] 2.4 복사/붙여넣기 (EventHandler.js 수정)
  - Ctrl+C: 선택 집합의 의존 그래프 복제
  - Ctrl+V: 새 식별자 부여 + 위치 오프셋
  - 치수/표식 참조 재연결
- [x] 2.5 Shift+드래그 평행이동 (SelectTool.js 수정)
  - 선택된 자유 점들을 동일 벡터로 이동

### Phase 3: 치수(각도/길이)와 값 입력 구동 [PRD 5.6, 5.7] ✅ 부분 완료
- [x] 3.1 AngleDimension.js 생성 (Dimension.js에 포함)
  - 점 3개로 각도 치수 생성
  - 각도 값(도 단위) 표시
  - 동일 각도 표시선(markerCount) 지원
- [x] 3.2 LengthDimension.js 생성 (Dimension.js에 포함)
  - 선분 클릭 → 길이 치수 표시
- [x] 3.3 AngleDimensionTool.js 생성
  - 각도 치수 생성 도구
- [x] 3.4 LengthDimensionTool.js 생성
  - 길이 치수 생성 도구
- [ ] 3.5 구동 규칙 구현 (추후)
  - 값 입력 → 기하 변형

### Phase 4: 곡선/영역 도형 [PRD 5.2, 5.3, 5.4, 5.5] ✅ 부분 완료
- [x] 4.1 Arc.js 생성 (호)
  - 원 + 시작점 + 끝점으로 생성
  - 짧은 호(minor) 기본, 긴 호(major) 선택 가능
- [x] 4.2 Sector.js 생성 (부채꼴)
  - 원 + (시작점, 끝점)으로 생성
  - 채움 색/투명도 지원
- [x] 4.3 CircularSegment.js 생성 (활꼴)
  - 원 + (시작점, 끝점)으로 생성
  - "호 + 현"으로 닫힌 영역 채움
- [x] 4.4 ArcTool.js 생성
- [x] 4.5 SectorTool.js 생성
- [x] 4.6 CircularSegmentTool.js 생성
- [ ] 4.7 색 채우기 및 일괄 변경 (FillTool.js 생성)
  - 도형 클릭 → 채움 색 변경
  - 기본 스타일 변경 시 일괄 반영 옵션
  - 선택 집합에만 일괄 적용 옵션

### Phase 5: 컴퍼스 + 대수식 입력창 [PRD 5.1, 5.11] ✅ 부분 완료
- [ ] 5.1 CompassTool.js 생성 (추후)
  - 방식 A: 중심 점 → 반지름 두 점 → 원 생성
  - 방식 B: 선분 선택 → 중심 점 → 원 생성
- [x] 5.2 AlgebraInput.js 생성 (대수식 입력창)
  - 점: `A = (2, 0)`
  - 함수: `y = x`, `f(x) = x^2 - 2x`
  - 원: `center=(2,0), r=5` 또는 `(x-2)^2 + (y-0)^2 = 25`
- [x] 5.3 Parser.js (AlgebraInput에 포함)
  - 점/함수/원 표현식 파싱

### Phase 6: 표식 확장 [PRD 5.9, 5.10] ✅ 부분 완료
- [x] 6.1 각도 치수에 동일 각도 표시선 통합
  - markerCount 속성으로 1, 2, 3개 표시선 지원
- [ ] 6.2 각도 표시(선만) 옵션 (추후)
  - 호(arc)만 표시, 값 텍스트 미표시

### Phase 7: 도구 유목화 및 명령 팔레트 [PRD 4] ✅ 완료
- [x] 7.1 도구 분류 UI 업데이트 (index.html)
  - 기본 생성 / 구성 / 곡선영역 / 측정치수 / 편집 / 입체
- [x] 7.2 CommandPalette.js 생성
  - Ctrl+K → 검색창 표시
  - 도구 이름 입력 → 즉시 실행
  - 대수식 입력 지원

### Phase 8: AI 에이전트 안정화 [PRD 6] ✅ 부분 완료
- [x] 8.1 SchemaValidator.js 생성
  - JSON 파싱 성공 여부 검증
  - 필수 필드, op 이름, 참조 id 존재 검증
- [x] 8.2 PatchApplier.js 생성
  - 적용(히스토리 반영) 단계
  - 재계산(모델 갱신) 단계
  - 렌더링 갱신 단계
  - 실패 시 롤백
- [x] 8.3 main.js processAIJSON 추가
  - 출력 형식 강제: JSON 패치 처리
  - 성공 메시지는 적용 성공 후에만 출력
- [ ] 8.4 ChatPanel.js 수정 (추후 진행)
  - 실패 시 "무엇이 실패했는지" 한 줄 요약
  - "자세히 보기"로 원문과 오류 확인
  - 디버그 모드: 마지막 AI 원문, 스키마 검증 결과, 예외 메시지

### Phase 9: 자동 라벨 및 버전 업데이트 [PRD 5.14]
- [ ] 9.1 자동 이름 부여 (Point.js, ObjectManager.js 수정)
  - 새 점 생성 시 자동으로 A, B, C, … 순서로 라벨 부여
  - 이후 A₁, A₂ 등으로 확장
  - 라벨은 LaTeX 문자열로 저장, 렌더링에서 표시
- [ ] 9.2 버전 표시 업데이트 (index.html)
  - Mk.1 → Mk.2

### Phase 10: AI 참고 매뉴얼 확장 [PRD 7]
- [ ] 10.1 ai-reference.md 확장
  - 새로운 객체 타입 추가 (Arc, Sector, CircularSegment 등)
  - 새로운 연산(op) 목록과 인자 형식
  - 치수 객체와 구동 규칙 설명
  - 다중 선택/복사·붙여넣기 규칙
  - 대수식 입력 규칙(지원 문법)
  - AI 출력 지침(실패 방지 체크리스트)

### Phase 11: UI/UX 고도화 (Modern & Glass Theme) ✅ 완료
- [x] 11.1 Glassmorphism 테마 적용 (glass_theme.css)
  - 다크/블러/네온 스타일의 모던한 디자인
  - 부드러운 애니메이션 및 인터랙션 강화
- [x] 11.2 사이드바 아이콘 개선
  - 기능의 의미를 직관적으로 전달하는 아이콘 적용
  - 카테고리별 컬러 코딩으로 시인성 확보


---

## 핵심 설계 결정 (Mk.2)

### 1. 정수 스냅 점 생성
- 빈 공간 클릭 시 좌표를 `Math.round()`로 정수화
- 토글 옵션으로 끄기 가능

### 2. 패닝 우선순위
- 객체 위 드래그 → 객체 이동/조작
- 빈 배경 드래그 → 패닝
- 스페이스바 + 드래그 → 강제 패닝

### 3. 치수 구동 규칙
- 각도: 꼭짓점 고정, 기준 레이 고정, 타겟 레이 회전
- 길이: p1 고정, p2를 방향 유지하며 거리 조정

### 4. AI 출력 강제
- 반드시 JSON 형태로만 출력
- "성공했습니다" 메시지는 적용 후에만

### 5. 복사/붙여넣기 의존성 처리
- 선택 집합에 포함된 객체의 의존 선조(ancestors)도 함께 복제
- 새 식별자 부여 + 약간의 위치 오프셋

---

## 신규 객체 스키마 (Mk.2)

### 호 (Arc)
```json
{
  "type": "arc",
  "circleId": "circle_1",
  "startPointId": "P1",
  "endPointId": "P2",
  "mode": "minor"
}
```

### 부채꼴 (Sector)
```json
{
  "type": "sector",
  "circleId": "circle_1",
  "startPointId": "P1",
  "endPointId": "P2",
  "mode": "minor",
  "fillColor": "#22c55e",
  "fillOpacity": 0.3
}
```

### 활꼴 (CircularSegment)
```json
{
  "type": "circularSegment",
  "circleId": "circle_1",
  "startPointId": "P1",
  "endPointId": "P2",
  "mode": "minor",
  "fillColor": "#3b82f6",
  "fillOpacity": 0.3
}
```

### 컴퍼스 원
```json
{
  "type": "compassCircle",
  "centerId": "O",
  "radiusFromId": "A",
  "radiusToId": "B"
}
```

### 각도 치수
```json
{
  "type": "angleDimension",
  "pointAId": "A",
  "vertexId": "B",
  "pointCId": "C",
  "valueOverride": null,
  "driveRule": "rotateC"
}
```

### 길이 치수
```json
{
  "type": "lengthDimension",
  "segmentId": "segment_1",
  "valueOverride": null,
  "driveRule": "moveP2"
}
```

### 각도 같음 표식
```json
{
  "type": "equalAngleMarker",
  "angle1": { "A": "P1", "B": "O1", "C": "Q1" },
  "angle2": { "A": "P2", "B": "O2", "C": "Q2" },
  "styleType": "single",
  "size": 12
}
```

### 각도 호 표식 (값 없음)
```json
{
  "type": "angleMarker",
  "pointAId": "A",
  "vertexId": "B",
  "pointCId": "C",
  "size": 15,
  "strokeWidth": 2
}
```

---

## 비기능 요구 사항

### 성능
- 드래그 시 시각적 지연이 체감되지 않을 것
- 객체 수가 증가해도(수백 개 수준) 기본 편집 가능

### 수치 안정성
- 세 점 원: 세 점이 거의 일직선인 경우 오류 처리
- 교점/접선/치수: 수치적으로 불안정한 상황 예외 처리

### 호환성
- 데스크톱 웹 브라우저에서 우선 지원 (Chromium 계열 중심)

---

## 수용 기준 체크리스트

### 사용성 (Phase 1)
- [ ] 빈 공간 클릭으로 생성된 자유 점은 항상 정수 좌표
- [ ] 드래그 또는 사이드바 입력으로 소수 좌표 변경 가능
- [ ] 점 객체는 사이드바에서 좌표가 항상 표시됨
- [ ] 사이드바에서 좌표 수정 시 캔버스 점 위치 즉시 갱신
- [ ] 빈 배경 드래그로 좌표평면 이동
- [ ] 객체 드래그와 충돌하지 않음
- [ ] 선택 가능 객체 위에서 커서가 십자가가 아닌 모양

### AI 신뢰성 (Phase 8)
- [ ] "중심이 (2,0)이고 반지름이 5인 원" 요청 시 실제 원 생성
- [ ] "y=x" 요청 시 실제 함수 그래프 생성
- [ ] 실패 시 실패 원인이 화면에서 확인 가능
### 2026-04-12 Maintenance Note
- AI reference was synced to the live `operations` / `op` contract.
- `polygon`, `numberLine`, and settings/view controls are documented as runtime UI features, not AI schema types.
