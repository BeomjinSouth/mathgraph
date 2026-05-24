# Live OpenAI PDF Text-Prompt Drawing Audit

Date: 2026-05-24

## Purpose

PDF-derived MathGraph drawing samples were sent to an external OpenAI API directly, using clean Korean prompts. The returned GraphA `operations[]` were validated and rendered in the current MathGraph runtime.

## Live API Setup

- Model discovery: `GET https://api.openai.com/v1/models`
- Generation endpoint: `POST https://api.openai.com/v1/responses`
- Model used: `gpt-4.1-mini`
- Key handling: supplied through `OPENAI_API_KEY` only; not written to repository files or reports.
- Runner: `tools/run-live-openai-pdf-ai-samples.mjs`

## Evidence Files

- Full prompt/output report: `tmp/live-openai-pdf-ai-samples/live-openai-prompt-output-report.md`
- Sanitized JSON result file: `tmp/live-openai-pdf-ai-samples/live-openai-results.json`
- Screenshots: `tmp/live-openai-pdf-ai-samples/screenshots/*.png`

## Prompt And Result Summary

| Sample | Clean Korean prompt | Attempts | Result |
| --- | --- | ---: | --- |
| `math3_p0127_radical_number_line` | 수직선에 0, 1, √2를 표시하고, 밑변과 높이가 각각 1인 직각삼각형과 반지름 √2인 원호를 이용해 √2의 위치를 보여줘. | 1 | 9 operations, rendered |
| `math1_p0150_parallel_transversal_angles` | 평행한 두 직선과 한 직선의 횡단선을 그리고, 두 교점에서 같은 위치의 각을 같은 표시로 나타내 평행선에서 생기는 각의 관계를 보여줘. | 1 | 13 operations, rendered |
| `math1_p0156_circle_sector` | 중심 O인 원에서 반지름 OA, OB와 작은 호 AB를 그리고, 부채꼴 AOB를 연하게 칠한 뒤 중심각을 표시해줘. | 1 | 9 operations, rendered |
| `math1_p0227_rectangular_prism` | 직육면체를 그리고 가로, 세로, 높이 모서리를 표시해줘. 같은 페이지의 원기둥, 원뿔, 구는 현재 지원 범위 밖이라 직육면체 중심으로 표현해줘. | 1 | 24 operations, rendered |
| `math1_p0638_histogram_frequency_polygon` | 계급 0-2, 2-4, 4-6, 6-8의 히스토그램 막대를 그리고, 각 막대 가운데를 이은 도수분포다각형을 함께 그려줘. | 2 | 18 operations, rendered |
| `math2_p0290_linear_graph_intersection` | 좌표평면에서 두 직선 y=0.5x+1, y=-x+4를 그리고 두 직선의 교점 P를 표시해줘. | 1 | 7 operations, rendered |
| `math2_p0404_triangle_incircle` | 삼각형 ABC의 내접원처럼 보이도록 내부의 점 I를 중심으로 원을 그리고, 각 변의 접점 D, E, F와 반지름 IE를 표시해줘. | 2 | 14 operations, rendered |
| `math2_p0437_similarity_triangles` | 서로 닮은 두 삼각형 ABC와 DEF를 나란히 그리고, 대응하는 변과 각을 같은 표시로 나타내줘. | 1 | 21 operations, rendered |
| `math3_p0291_quadratic_function` | 이차함수 y=x^2-2x-3의 그래프, 대칭축 x=1, 꼭짓점 V, x축과의 교점 하나를 표시해줘. | 2 | 10 operations, rendered |
| `math3_p0354_trig_right_triangle` | 직각삼각형 ABC에서 ∠B=90°, ∠A=30°가 보이도록 그리고 빗변과 높이 관계를 표시해줘. | 2 | 12 operations, rendered |
| `math3_p0443_distribution_curves` | 평균은 같고 산포도가 다른 두 종 모양 곡선을 좌표평면에 겹쳐 그려줘. | 1 | 23 operations, rendered |
| `math3_p0442_scatter_plot` | 좌표평면에 오른쪽 위로 올라가는 산점도를 여러 점으로 찍고, 대략적인 추세선을 그려줘. | 1 | 13 operations, rendered |

## Verification

- Final live run timestamp: `2026-05-24T15:08:12.361Z`
- Final failures: `0`
- All final payloads passed GraphA schema validation.
- All final payloads passed reference validation.
- All final payloads rendered to screenshots with non-white pixels.

## Findings

- The external OpenAI API call path works for text-prompt GraphA generation.
- Exact field-name prompting is necessary; earlier raw attempts produced invalid aliases such as `p1`, `p2`, or missing `op`.
- Validation-repair retries are useful and should stay in the live runner.
- The outputs are structurally similar, not pixel-identical, to PDF textbook figures.
