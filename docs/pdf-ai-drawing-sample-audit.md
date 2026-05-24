# PDF AI Drawing Sample Audit

Date: 2026-05-24

## Purpose

세 교사용 PDF에서 단원/그림 범주가 겹치지 않도록 대표 그림을 고르고, 각 그림을 Korean AI drawing request와 GraphA `operations[]`로 변환해 현재 MathGraph가 같은 수학 구조를 렌더링할 수 있는지 확인했다.

## Source PDFs

- `중_수학1(김화경)_지도서.pdf`
- `중등_수학2_류희찬(15개정)_지도서.pdf`
- `중등_수학3_이준열(15개정)_지도서.pdf`

## Method

1. PyMuPDF로 PDF page count, 단원 키워드, 후보 페이지를 확인했다.
2. 후보 페이지를 `tmp/pdf-ai-audit/`에 렌더링하고 시각적으로 대표 그림을 골랐다.
3. 각 샘플마다 Korean prompt와 GraphA `operations[]`를 `tests/fixtures/pdf-ai-drawing-samples.json`에 정리했다.
4. `SchemaValidator`와 참조 검증으로 모든 샘플이 현재 AI contract를 만족하는지 확인했다.
5. `tools/render-pdf-ai-drawing-samples.mjs`로 브라우저 캔버스에 실제 적용하고 screenshot/pixel smoke check를 수행했다.

External OpenAI/Gemini API 호출은 실행하지 않았다. 이 검증은 API 모델이 반환해야 하는 동일한 최종 산출물인 strict GraphA `operations[]`를 기준으로 한 로컬 계약/렌더 검증이다.

## Result Summary

| Source | Page | Unit | Category | Parity | Render evidence |
| --- | ---: | --- | --- | --- | --- |
| Math 3 | 127 | 제곱근과 실수 | 수직선/무리수 작도 | structural_match | 11 objects, 6132 non-white pixels |
| Math 1 | 150 | 기본 도형 | 평행선과 각 | match | 13 objects, 11027 non-white pixels |
| Math 1 | 156 | 평면도형 | 원/호/부채꼴 | match | 9 objects, 15966 non-white pixels |
| Math 1 | 227 | 입체도형 | 직육면체/곡면 입체 gap | structural_match | 15 objects, 7210 non-white pixels |
| Math 1 | 638 | 통계 | 히스토그램/도수분포다각형 | approximation | 31 objects, 73372 non-white pixels |
| Math 2 | 290 | 일차함수와 그래프 | 두 직선과 교점 | match | 7 objects, 5462 non-white pixels |
| Math 2 | 404 | 사각형과 도형의 성질 | 삼각형 내접원 | structural_match | 16 objects, 7288 non-white pixels |
| Math 2 | 437 | 도형의 닮음과 피타고라스 정리 | 닮은 삼각형 쌍 | structural_match | 18 objects, 15424 non-white pixels |
| Math 3 | 291 | 이차함수와 그래프 | 포물선/축/절편 | structural_match | 9 objects, 10418 non-white pixels |
| Math 3 | 354 | 삼각비 | 직각삼각형/각도/길이 | match | 11 objects, 4609 non-white pixels |
| Math 3 | 443 | 대푯값과 산포도 | 분포 곡선 | structural_match | 6 objects, 13486 non-white pixels |
| Math 3 | 442 | 상관관계 | 산점도/추세선 | approximation | 14 objects, 7385 non-white pixels |

## Findings

- Current first-class objects reproduce most geometric textbook structures well: points, lines, intersections, angle dimensions, length dimensions, circles, sectors, polygons, functions, number lines, prisms, and pyramids.
- Pixel-perfect textbook reproduction is not expected because MathGraph reconstructs editable vector math objects rather than copying the PDF image.
- `match` cases are directly expressible by current primitives.
- `structural_match` cases preserve the mathematical relationship but lose some textbook styling, explanatory text, or automatic construction semantics.
- `approximation` cases need lower-level object composition because chart primitives are not first-class yet.

## Remaining Gaps

- Curved solids: cylinder, cone, and sphere are still not first-class solid objects.
- Statistics charts: histogram, frequency polygon, scatter plot, box plot, and chart axes are still approximated with polygons, points, lines, and number lines.
- Free text labels independent from geometry are still not first-class objects.
- Some constructions, such as incircle or radical construction, are currently coordinate-driven recreations rather than solver-backed automatic constructions.
- Function-domain and multiple-intersection selection are still limited by the current AI schema.

## Verification

- `npm.cmd test`: passed, 32 tests.
- `node tools\render-pdf-ai-drawing-samples.mjs`: passed, 12 rendered samples, 0 failures.
- Browser screenshots:
  - `tmp/browser-captures/pdf-ai-drawing-samples/contact-sheet.png`
  - `tmp/browser-captures/pdf-ai-drawing-samples/*.png`
