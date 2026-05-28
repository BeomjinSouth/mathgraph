import { createServer } from 'node:http';
import { access, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import {
    AIService,
    GRAPH_OPERATIONS_RESPONSE_FORMAT,
    IMAGE_RECREATE_OPERATION_BUDGET,
    extractOpenAIResponseText,
    stripNullFields
} from '../js/ai/AIService.js';
import { parseAIJSONPayload } from '../js/ai/JSONUtils.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const referenceIndexPath = path.join(repoRoot, '.agents', 'skills', 'mathgraph-drawing', 'references', 'retrieval-index.json');
const featureManualPath = path.join(repoRoot, '.agents', 'skills', 'mathgraph-drawing', 'references', 'feature-manual.json');
const outputDir = process.env.LIVE_AI_OUTPUT_DIR
    ? path.resolve(process.env.LIVE_AI_OUTPUT_DIR)
    : path.join(repoRoot, 'tmp', 'live-openai-random-drawing-smoke');
const screenshotDir = path.join(outputDir, 'screenshots');
const endpoint = 'https://api.openai.com/v1/responses';

const smokePrompts = [
    {
        id: 'triangle_circumcircle_altitude',
        title: 'Triangle, circumcircle, altitude',
        tags: 'plane triangle circle construction',
        promptKo: '삼각형 ABC를 그리고, 세 점을 지나는 외접원과 C에서 AB로 내린 높이, 높이의 발 H, 직각 표시, 변 AB의 길이 표시를 함께 그려줘.',
        showAxes: false
    },
    {
        id: 'circle_sector_tangent',
        title: 'Circle sector and tangent',
        tags: 'circle sector arc tangent',
        promptKo: '중심 O인 원 위에 점 A, B를 잡고 부채꼴 AOB를 연하게 칠해. 작은 호 AB, 현 AB, 점 A에서의 접선, 중심각 표시를 함께 그려줘.',
        showAxes: false
    },
    {
        id: 'quadratic_line_intersections',
        title: 'Quadratic graph and line',
        tags: 'graph function quadratic line intersection tangent',
        promptKo: '좌표평면에 이차함수 y=x^2-4와 직선 y=x+2를 그리고, 교점들을 표시해. 이차함수의 꼭짓점 V와 x=1에서의 접선도 함께 그려줘.',
        showAxes: true
    },
    {
        id: 'radical_number_line',
        title: 'Radical number line construction',
        tags: 'number_line radical plane construction',
        promptKo: '수직선 -1부터 4까지를 그리고 0, 1, √2를 표시해. 밑변과 높이가 각각 1인 직각삼각형과 반지름 √2에 해당하는 원호로 √2 위치를 설명하는 그림을 그려줘.',
        showAxes: false
    },
    {
        id: 'square_pyramid',
        title: 'Square pyramid',
        tags: 'solid pyramid polygon',
        promptKo: '정사각형 밑면 ABCD와 꼭짓점 V를 가진 사각뿔 V-ABCD를 그려. 보이는 모서리와 숨은 모서리, 밑면의 대각선, 높이처럼 보이는 선분을 함께 표현해줘.',
        showAxes: false
    }
];

const extendedSmokePrompts = [
    {
        id: 'triangle_incircle_contacts',
        title: 'Triangle incircle and contact radii',
        tags: 'plane triangle circle incircle tangent marker',
        promptKo: '삼각형 ABC를 A(0,0), B(6,0), C(0,8)의 유한한 세 변 segment와 polygon으로 그려줘. 내심 I는 (2,2), 접점은 D(2,0), E(0,2), F(3.6,3.2)로 직접 point를 만들어 세 변에 접하는 내접원을 표시해줘. I에서 각 접점으로 가는 반지름은 segment로 그리고, 각 접점의 직각 표시는 rightAngleMarker의 line1Id/line2Id가 반지름 segment와 해당 변 segment를 참조하게 해줘. rightAngleMarker에 segment1Id/segment2Id를 쓰지 말고, 삼각형의 변도 무한 직선 line으로 만들지 마.',
        showAxes: false
    },
    {
        id: 'parallel_transversal_angles',
        title: 'Parallel lines with transversal angles',
        tags: 'plane line parallel angle construction',
        promptKo: '서로 평행한 두 직선 l, m과 이들을 가로지르는 횡단선 t를 그리고, l,t의 교점과 m,t의 교점을 만든 뒤 그 교점을 꼭짓점으로 angleDimension을 배치해줘. 엇각 두 쌍과 동위각 한 쌍은 각 하나마다 별도 angleDimension을 만들어 총 6개의 각 표시로 보여줘. 각 표시의 보조점은 반드시 해당 직선이나 횡단선 위에 놓아줘. 같은 교점에 놓인 angleDimension들은 arcRadius를 0.35, 0.55, 0.75처럼 서로 다르게 하고 showValue:false로 두어 숫자 라벨이 겹치지 않게 해줘.',
        showAxes: false
    },
    {
        id: 'absolute_value_line_region',
        title: 'Absolute value function and shaded region',
        tags: 'graph function line intersection polygon',
        promptKo: '좌표평면에 함수 y=|x|-1과 직선 y=1을 그리고 두 교점을 표시해줘. 두 그래프와 x축 근처 꼭짓점이 만드는 가운데 영역을 연하게 칠해줘.',
        showAxes: true
    },
    {
        id: 'histogram_frequency_polygon',
        title: 'Histogram and frequency polygon approximation',
        tags: 'chart approximation histogram polygon number_line statistics',
        promptKo: '도수분포표를 설명하는 간단한 히스토그램을 5개의 직사각형 막대로 그려줘. 막대의 계급 구간은 정확히 [0,1], [1,2], [2,3], [3,4], [4,5]로 시작하고, 막대 가운데 x=0.5,1.5,2.5,3.5,4.5를 잇는 도수다각형을 함께 그려줘. 가로축 눈금은 0부터 5까지 보이게 해줘.',
        showAxes: true
    },
    {
        id: 'triangular_prism_hidden_edges',
        title: 'Triangular prism with hidden edges',
        tags: 'solid prism polygon dashed dimension',
        promptKo: '삼각기둥 ABC-A′B′C′를 prism 객체로 그려줘. baseVertexIds는 A,B,C, topVertexIds는 A′,B′,C′가 되게 하고, 숨은 모서리의 점선/보이는 모서리의 실선 처리는 prism 런타임에 맡겨줘. 길이 표시가 필요하면 별도 segment를 추가하되, 삼각기둥 전체를 손으로 그린 dashed/solid segment 묶음만으로 대체하지 마.',
        showAxes: false
    }
];

const stressSmokePrompts = [
    {
        id: 'multi_function_cubic_quadratic_line',
        title: 'Cubic, quadratic, and reference line',
        tags: 'graph function cubic quadratic line intersection',
        promptKo: '좌표평면에 함수 x^3 - 3*x, x^2 - 1, 그리고 x축 기준선 y=0을 함께 그려줘. 두 함수의 주요 교점과 각 함수의 대표 꼭짓점/극값 근처 점을 point로 표시하되, 함수와 기준선 라벨은 showLabel:false로 숨기고 화면에 보이는 라벨은 A,B,C,D처럼 2글자 이하의 짧은 핵심 점 4개 이하만 남겨줘. 전체는 45개 operations 이내로 간결하게 만들어줘.',
        showAxes: true,
        expect: { minTypes: { function: 2, line: 1, point: 4 }, maxVisibleLabels: 4, maxLabelTextLength: 2 }
    },
    {
        id: 'trig_wave_family',
        title: 'Three trigonometric waves',
        tags: 'graph function trigonometry multiple',
        promptKo: '좌표평면에 sin(x), cos(x), 0.5*sin(2*x) 세 개의 삼각함수 그래프를 동시에 그리고, x=-π, 0, π 위치를 점이나 수직 기준선으로 표시해줘. 세 함수 객체는 showLabel:false로 두고, 보이는 라벨은 -π, 0, π 세 개만 남겨줘. 함수 expression에는 y=를 넣지 말고 operations는 45개 이하로 유지해줘.',
        showAxes: true,
        expect: { minTypes: { function: 3, point: 3 }, maxVisibleLabels: 3, maxLabelTextLength: 2 }
    },
    {
        id: 'rational_asymptote_window',
        title: 'Rational function with asymptotes',
        tags: 'graph function rational asymptote line',
        promptKo: '좌표평면에 유리함수 1/(x - 1) + 2를 그리고, 점선 수직점근선 x=1과 점선 수평점근선 y=2를 함께 표시해줘. 점근선은 각각 두 점과 line으로 만들고 dashed:true로 해줘. 보조점은 visible:false 또는 showLabel:false로 숨기고 화면에 보이는 라벨은 함수/점근선 3개 이하만 남겨줘.',
        showAxes: true,
        expect: { minTypes: { function: 1, line: 2, point: 4 }, minDashedLines: 2, maxVisibleLabels: 3, maxLabelTextLength: 8 }
    },
    {
        id: 'absolute_parabola_shaded_region',
        title: 'Absolute value and parabola shaded lens',
        tags: 'graph function absolute quadratic polygon region',
        promptKo: '좌표평면에 abs(x)-1과 0.25*x^2 그래프를 그리고, 교점 (-2,1), (2,1)과 아래쪽 꼭짓점 (0,-1), 위쪽 점 (0,0)을 표시해줘. 함수 라벨은 showLabel:false로 숨기고, 보이는 라벨은 A,B,C,D처럼 2글자 이하의 네 점만 남겨줘. 두 그래프 사이 가운데 렌즈 모양 영역은 polygon으로 연하게 칠해줘.',
        showAxes: true,
        expect: { minTypes: { function: 2, polygon: 1, point: 4 }, maxVisibleLabels: 4, maxLabelTextLength: 2 }
    },
    {
        id: 'cubic_tangent_bundle',
        title: 'Cubic with three tangents',
        tags: 'graph function cubic tangent tangentFunction',
        promptKo: '함수 x^3 - 3*x를 그리고 x=-1, x=0, x=1에서의 접선을 tangentFunction 세 개로 표시해줘. 함수와 접선 라벨은 showLabel:false로 숨기고, 세 접점 라벨만 보이게 해줘. 자동 각/길이 치수는 넣지 말아줘.',
        showAxes: true,
        expect: { minTypes: { function: 1, tangentFunction: 3, point: 3 }, requiredTangentXs: [-1, 0, 1], maxVisibleLabels: 3, maxLabelTextLength: 1 }
    },
    {
        id: 'circle_sector_chord_tangent_bundle',
        title: 'Circle with sector, chord, tangent, and angle',
        tags: 'circle sector arc chord tangent angle',
        promptKo: '중심 O, 반지름 4인 원을 그리고 A(4,0), B(0,4), C(-4,0)을 잡아줘. 부채꼴 AOB, 작은 호 AB, 현 AC, A에서의 접선, 중심각 AOB 표시를 함께 그려줘. 원/호/부채꼴/접선 라벨은 showLabel:false로 숨기고, 화면에는 O,A,B,C 네 점 라벨만 보이게 해줘.',
        showAxes: false,
        expect: { minTypes: { circle: 1, sector: 1, arc: 1, segment: 1, tangentCircle: 1, angleDimension: 1 }, minSectorSpan: 0.3, maxVisibleLabels: 4, maxLabelTextLength: 1 }
    },
    {
        id: 'triangle_centers_and_altitude',
        title: 'Triangle centers and altitude construction',
        tags: 'plane triangle midpoint altitude circle marker',
        promptKo: '삼각형 ABC를 A(-3,0), B(4,0), C(1,5)로 그리고 세 변 segment와 polygon을 만들어줘. AB와 BC의 중점, C에서 AB로 내린 높이와 발 H, 직각 표시, 세 꼭짓점을 지나는 외접원을 함께 그려줘. 중점/보조선/외접원 라벨은 showLabel:false로 숨기고 화면에는 A,B,C,H 네 라벨만 보이게 해줘.',
        showAxes: false,
        expect: { minTypes: { polygon: 1, segment: 4, midpoint: 2, perpendicular: 1, intersection: 1, rightAngleMarker: 1, circleThreePoints: 1 }, maxVisibleLabels: 4, maxLabelTextLength: 1 }
    },
    {
        id: 'nested_rectangular_prisms',
        title: 'Small rectangular prism inside large rectangular prism',
        tags: 'solid prism nested rectangular',
        promptKo: '큰 직육면체를 prism 객체로 그리고, 그 안쪽에 더 작은 직육면체도 prism 객체로 배치해줘. 두 입체가 서로 다른 크기임이 보이도록 모든 꼭짓점을 point로 만들고, 숨은선 처리는 prism 런타임에 맡겨줘. 모든 꼭짓점과 prism 객체는 showLabel:false로 두어 라벨이 하나도 보이지 않게 해줘.',
        showAxes: false,
        expect: { minTypes: { prism: 2, point: 16 }, maxVisibleLabels: 0 }
    },
    {
        id: 'pyramid_inside_prism',
        title: 'Pyramid inside a prism',
        tags: 'solid prism pyramid nested',
        promptKo: '투명한 상자처럼 보이는 직육면체 prism 안에 사각뿔 pyramid가 들어 있는 모습을 그려줘. 바깥 직육면체는 prism, 안쪽 사각뿔은 pyramid 객체를 사용하고, 사각뿔 밑면은 상자 바닥 안쪽에 놓이게 해줘. 보이는 라벨은 사각뿔 꼭짓점과 기준점 등 3개 이하만 남기고 나머지 point/prism/pyramid는 showLabel:false로 숨겨줘.',
        showAxes: false,
        expect: { minTypes: { prism: 1, pyramid: 1, point: 9 }, maxVisibleLabels: 3, maxLabelTextLength: 1 }
    },
    {
        id: 'compound_nested_solid_frame',
        title: 'Compound nested solid frame',
        tags: 'solid prism pyramid nested triangular rectangular',
        promptKo: '큰 직육면체 prism 안에 작은 삼각기둥 prism을 넣고, 그 위쪽에는 작은 사각뿔 pyramid가 얹힌 것처럼 보이는 복합 입체를 그려줘. 모든 입체는 first-class prism/pyramid 객체를 사용하고 손그림 dashed segment 묶음으로 대체하지 마. 복잡한 입체가 겹치므로 모든 point/prism/pyramid 라벨은 showLabel:false로 숨겨 라벨이 하나도 보이지 않게 해줘.',
        showAxes: false,
        expect: { minTypes: { prism: 2, pyramid: 1, point: 13 }, maxVisibleLabels: 0 }
    }
];

const stressExtraSmokePrompts = [
    {
        id: 'exp_log_two_curve_window',
        title: 'Exponential and logarithm curves',
        tags: 'graph function exponential logarithm intersection',
        promptKo: '좌표평면에 exp(0.4*x)-1과 ln(x+5)-1 두 함수 그래프를 함께 그려줘. "가까운 샘플점"이 아니라 실제 두 교점을 point로 표시해줘. 왼쪽 교점은 A(-3.75,-0.78) 근처, 오른쪽 교점은 B(1.58,0.88) 근처에 두고, 함수 라벨은 showLabel:false로 숨겨줘. 보이는 라벨은 A,B 2개만 남기고 expression에는 y=를 넣지 마.',
        showAxes: true,
        expect: {
            minTypes: { function: 2, point: 2 },
            requiredPointWindows: [
                { name: 'A', xMin: -4.05, xMax: -3.45, yMin: -1.05, yMax: -0.5 },
                { name: 'B', xMin: 1.25, xMax: 1.9, yMin: 0.6, yMax: 1.15 }
            ],
            maxVisibleLabels: 2,
            maxLabelTextLength: 1
        }
    },
    {
        id: 'quartic_double_well_tangents',
        title: 'Quartic double-well with tangents',
        tags: 'graph function quartic tangent tangentFunction',
        promptKo: '좌표평면에 0.2*x^4 - x^2 형태의 사차함수 그래프를 그리고 x=-1과 x=1에서의 접선을 tangentFunction 두 개로 표시해줘. tangentFunction 객체에는 functionId와 숫자 필드 x를 반드시 넣어야 하며, 첫 접선은 "x":-1, 둘째 접선은 "x":1이어야 해. 접점과 원점 근처 기준점만 point로 표시하고, 함수/접선 라벨은 showLabel:false로 숨겨줘. 보이는 라벨은 A,B,C처럼 1글자 3개 이하만 써줘.',
        showAxes: true,
        expect: { minTypes: { function: 1, tangentFunction: 2, point: 3 }, requiredTangentXs: [-1, 1], maxVisibleLabels: 3, maxLabelTextLength: 1 }
    },
    {
        id: 'rational_slant_asymptote',
        title: 'Rational function with vertical and slant asymptotes',
        tags: 'graph function rational asymptote line',
        promptKo: '좌표평면에 유리함수 (x^2 - 1)/(x - 2)를 그리고, 점선 수직점근선 x=2와 점선 사선점근선 y=x+2를 line 객체로 함께 표시해줘. 수직점근선은 숨긴 두 점 (2,-6), (2,6)을 잇는 line이어야 하고, 사선점근선은 숨긴 두 점 (-4,-2), (4,6)을 잇는 line이어야 해. 두 점근선은 모두 dashed:true이고, 점근선을 만드는 보조점은 visible:false 또는 showLabel:false로 숨겨줘. 화면에 보이는 라벨은 점근선 이름 2개 이하만 남겨줘.',
        showAxes: true,
        expect: {
            minTypes: { function: 1, line: 2, point: 4 },
            minDashedLines: 2,
            requiredLinePatterns: [
                { kind: 'vertical', x: 2, dashed: true },
                { kind: 'slopeIntercept', slope: 1, intercept: 2, dashed: true }
            ],
            maxVisibleLabels: 2,
            maxLabelTextLength: 6
        }
    },
    {
        id: 'damped_wave_with_envelopes',
        title: 'Damped wave with two envelope curves',
        tags: 'graph function trigonometry rational envelope',
        promptKo: '좌표평면에 sin(2*x)/(1+0.15*x^2)와 위쪽 포락선 1/(1+0.15*x^2), 아래쪽 포락선 -1/(1+0.15*x^2)를 동시에 그려줘. 함수 라벨은 모두 showLabel:false로 숨기고, 불필요한 point는 만들지 마.',
        showAxes: true,
        expect: { minTypes: { function: 3 }, maxVisibleLabels: 0 }
    },
    {
        id: 'two_circle_lens_region',
        title: 'Two-circle lens with chord markers',
        tags: 'circle polygon segment lens plane',
        promptKo: '중심 O(-2,0), P(2,0), 반지름 3인 두 원이 겹치는 렌즈 모양 도형을 그려줘. 첫 번째 원은 centerId O와 반지름점 (1,0), 두 번째 원은 centerId P와 반지름점 (5,0)을 써서 두 원의 반지름이 모두 정확히 3이 되게 해줘. 중심을 잇는 segment, 위쪽 교점 A(0,2.24), 아래쪽 교점 B(0,-2.24)를 intersection 객체가 아니라 직접 point로 만들어줘. 렌즈 채움 polygon은 자기교차가 없어야 하며 꼭짓점 순서를 A -> (0.60,1.50) -> (1,0) -> (0.60,-1.50) -> B -> (-0.60,-1.50) -> (-1,0) -> (-0.60,1.50) -> A처럼 렌즈 경계를 한 바퀴 도는 순서로 둬. polygon을 만들기 위한 보조점과 반지름 보조점은 visible:false로 숨겨 화면에 점으로 찍히지 않게 하고, 화면에는 O,P,A,B 네 점만 보이게 해줘.',
        showAxes: false,
        expect: {
            minTypes: { circle: 2, segment: 1, polygon: 1, point: 6 },
            requiredPointWindows: [
                { name: 'O', xMin: -2.1, xMax: -1.9, yMin: -0.1, yMax: 0.1 },
                { name: 'P', xMin: 1.9, xMax: 2.1, yMin: -0.1, yMax: 0.1 },
                { name: 'A', xMin: -0.15, xMax: 0.15, yMin: 2.05, yMax: 2.4 },
                { name: 'B', xMin: -0.15, xMax: 0.15, yMin: -2.4, yMax: -2.05 }
            ],
            requireDirectLensPoints: true,
            lensCircleRadius: 3,
            requireSimpleLensPolygon: true,
            lensPolygonBounds: { xMin: -1.05, xMax: 1.05, yMin: -2.38, yMax: 2.38 },
            maxVisiblePointCount: 4,
            maxVisibleLabels: 4,
            maxLabelTextLength: 1
        }
    },
    {
        id: 'hexagon_diagonal_angle_web',
        title: 'Hexagon with diagonals and angle markers',
        tags: 'plane polygon circle segment angle hexagon',
        promptKo: '정육각형 ABCDEF를 원 위에 놓인 것처럼 그리고 polygon, 외접원, 긴 대각선 AD, BE, CF, 그리고 중심 O에서 보이는 각 표시 3개를 함께 만들어줘. hexagon polygon은 채움 영역이 아니라 외곽선이어야 하므로 fillOpacity:0으로 만들어줘. 각 표시는 angleDimension으로 만들되 showValue:false로 하고, 외접원/대각선/각 라벨은 숨겨줘. 보이는 라벨은 A,B,C,D,E,F 여섯 점만 허용해줘.',
        showAxes: false,
        expect: { minTypes: { polygon: 1, circle: 1, segment: 3, angleDimension: 3, point: 7 }, maxVisibleLabels: 6, maxLabelTextLength: 1, maxPolygonFillOpacity: 0, requireRenderableAngles: true }
    },
    {
        id: 'two_transversals_angle_grid',
        title: 'Parallel lines cut by two transversals',
        tags: 'plane line parallel angle construction',
        promptKo: '서로 평행한 두 직선 l,m을 그리고 서로 다른 기울기의 횡단선 t,u 두 개가 둘 다 l,m을 가로지르게 해줘. 네 교점 각각에 angleDimension 1개씩 총 4개를 배치해줘. 각 angleDimension의 point1Id와 point2Id는 꼭짓점과 같은 점이면 안 되고, 꼭짓점에서 0.7 이상 떨어진 보조점이어야 실제 각 호가 보인다. showValue:false로 하고, 모든 point/line/angleDimension 라벨은 showLabel:false 또는 showValue:false로 숨겨서 라벨이 보이지 않게 해줘.',
        showAxes: false,
        expect: { minTypes: { line: 4, point: 8, angleDimension: 4 }, maxVisibleLabels: 0, requireRenderableAngles: true, minDistinctAngleVertices: 4 }
    },
    {
        id: 'box_with_pyramid_and_inner_prism',
        title: 'Box containing a pyramid and smaller prism',
        tags: 'solid prism pyramid nested rectangular',
        promptKo: '큰 직육면체 prism 안에 작은 사각뿔 pyramid와 더 작은 직육면체 prism이 함께 들어 있는 모습을 그려줘. 모든 입체는 first-class prism/pyramid 객체로 만들고, 손그림 segment 묶음으로 대체하지 마. prism의 topVertexIds는 baseVertexIds와 같은 순서의 평행 이동 복사본이어야 해서 대응 모서리가 뒤틀리거나 교차하면 안 돼. 안쪽 pyramid와 작은 prism의 모든 꼭짓점은 화면상 바깥 prism의 투영 영역 안에 놓이게 하고, 두 내부 입체는 서로 겹쳐 보이지 않도록 화면상 중심이 충분히 떨어지게 배치해줘. 모든 꼭짓점 point는 visible:false 및 showLabel:false로 숨기고, prism/pyramid 라벨도 showLabel:false로 숨겨줘.',
        showAxes: false,
        expect: { minTypes: { prism: 2, pyramid: 1, point: 17 }, innerWithinFirstPrism: true, innerSolidMinCenterDistance: 1.5, validPrismProjections: true, requiredPyramidBaseVertexCounts: [{ count: 4, min: 1 }], validPyramidApexes: true, maxVisiblePointCount: 0, maxVisibleLabels: 0 }
    },
    {
        id: 'double_pyramid_inside_box',
        title: 'Two pyramids inside a transparent box',
        tags: 'solid prism pyramid nested double',
        promptKo: '투명한 직육면체 prism 안에 사각뿔 두 개가 위아래로 마주 보는 모양을 그려줘. 바깥 상자는 prism, 안쪽 두 입체는 각각 pyramid 객체로 만들고, 두 pyramid 모두 baseVertexIds가 4개인 사각뿔이어야 해. prism의 topVertexIds는 baseVertexIds와 같은 순서의 평행 이동 복사본이어야 해. 각 pyramid의 apexId는 baseVertexIds에 포함되면 안 된다. 두 pyramid의 모든 꼭짓점은 화면상 바깥 prism의 투영 영역 안에 놓이게 해줘. 모든 꼭짓점 point는 visible:false 및 showLabel:false로 숨겨줘.',
        showAxes: false,
        expect: { minTypes: { prism: 1, pyramid: 2, point: 14 }, innerWithinFirstPrism: true, validPrismProjections: true, requiredPyramidBaseVertexCounts: [{ count: 4, min: 2 }], validPyramidApexes: true, maxVisiblePointCount: 0, maxVisibleLabels: 0 }
    },
    {
        id: 'triangular_prism_inside_square_pyramid',
        title: 'Triangular prism inside a square pyramid',
        tags: 'solid prism pyramid nested triangular square',
        promptKo: '큰 사각뿔 pyramid 내부에 작은 삼각기둥 prism이 들어 있는 복합 입체를 그려줘. 사각뿔과 삼각기둥은 first-class pyramid/prism 객체를 사용하고, 작은 삼각기둥 prism은 baseVertexIds 3개와 topVertexIds 3개만 갖는 진짜 삼각기둥이어야 해. prism의 topVertexIds는 baseVertexIds와 같은 순서의 평행 이동 복사본이어야 해서 대응 모서리가 뒤틀리면 안 돼. 작은 삼각기둥의 모든 꼭짓점은 화면상 큰 사각뿔의 투영 영역 안에 놓이게 해줘. 숨은선 처리는 런타임에 맡기고, 모든 꼭짓점 point는 visible:false 및 showLabel:false로 숨기며 prism/pyramid 라벨도 showLabel:false로 숨겨줘.',
        showAxes: false,
        expect: { minTypes: { pyramid: 1, prism: 1, point: 11 }, innerWithinFirstPyramid: true, requiredPrismVertexCounts: [3], validPrismProjections: true, requiredPyramidBaseVertexCounts: [{ count: 4, min: 1 }], validPyramidApexes: true, maxVisiblePointCount: 0, maxVisibleLabels: 0 }
    }
];

const stressNovelSmokePrompts = [
    {
        id: 'logistic_midpoint_asymptotes',
        title: 'Logistic curve with asymptotes and midpoint tangent',
        tags: 'graph function logistic asymptote tangent',
        promptKo: '좌표평면에 logistic 함수 4/(1+exp(-x))를 그리고, 점선 수평점근선 y=0과 y=4를 line 객체로 표시해줘. 함수의 중심점 M(0,2)를 point로 표시하고 x=0에서의 접선은 tangentFunction으로 그려줘. 함수와 점근선 라벨은 showLabel:false로 숨기고, 화면에는 M 라벨만 보이게 해줘.',
        showAxes: true,
        expect: {
            minTypes: { function: 1, line: 2, point: 5, tangentFunction: 1 },
            requiredFunctionExpressions: ['4/(1+exp(-x))'],
            requiredLinePatterns: [
                { kind: 'slopeIntercept', slope: 0, intercept: 0, dashed: true },
                { kind: 'slopeIntercept', slope: 0, intercept: 4, dashed: true }
            ],
            requiredTangentXs: [0],
            requiredPointWindows: [
                { name: 'M', xMin: -0.1, xMax: 0.1, yMin: 1.9, yMax: 2.1 }
            ],
            maxVisibleLabels: 1,
            maxLabelTextLength: 1
        },
        referencePayload: {
            operations: [
                { op: 'create', id: 'f', type: 'function', expression: '4/(1+exp(-x))', showLabel: false },
                { op: 'create', id: 'A0', type: 'point', x: -7, y: 0, visible: false, showLabel: false },
                { op: 'create', id: 'B0', type: 'point', x: 7, y: 0, visible: false, showLabel: false },
                { op: 'create', id: 'A4', type: 'point', x: -7, y: 4, visible: false, showLabel: false },
                { op: 'create', id: 'B4', type: 'point', x: 7, y: 4, visible: false, showLabel: false },
                { op: 'create', id: 'asym0', type: 'line', point1Id: 'A0', point2Id: 'B0', dashed: true, showLabel: false },
                { op: 'create', id: 'asym4', type: 'line', point1Id: 'A4', point2Id: 'B4', dashed: true, showLabel: false },
                { op: 'create', id: 'M', type: 'point', x: 0, y: 2, label: 'M' },
                { op: 'create', id: 'tan_M', type: 'tangentFunction', functionId: 'f', x: 0, showLabel: false }
            ]
        }
    },
    {
        id: 'parabola_focus_directrix_latus',
        title: 'Parabola focus, directrix, and latus rectum',
        tags: 'graph function parabola focus directrix segment',
        promptKo: '좌표평면에 포물선 0.25*x^2를 그리고, 초점 F(0,1), 꼭짓점 V(0,0), 준선 y=-1을 점선 line으로 표시해줘. 초점을 지나는 현인 latus rectum의 양 끝 L(-2,1), R(2,1)을 point로 만들고 선분 LR을 그려줘. 함수와 준선 라벨은 숨기고 F,V,L,R 네 라벨만 보이게 해줘.',
        showAxes: true,
        expect: {
            minTypes: { function: 1, line: 1, point: 6, segment: 1 },
            requiredFunctionExpressions: ['0.25*x^2'],
            requiredLinePatterns: [
                { kind: 'slopeIntercept', slope: 0, intercept: -1, dashed: true }
            ],
            requiredPointWindows: [
                { name: 'F', xMin: -0.1, xMax: 0.1, yMin: 0.9, yMax: 1.1 },
                { name: 'V', xMin: -0.1, xMax: 0.1, yMin: -0.1, yMax: 0.1 },
                { name: 'L', xMin: -2.1, xMax: -1.9, yMin: 0.9, yMax: 1.1 },
                { name: 'R', xMin: 1.9, xMax: 2.1, yMin: 0.9, yMax: 1.1 }
            ],
            requiredSegmentsBetween: [['L', 'R']],
            maxVisibleLabels: 4,
            maxLabelTextLength: 1
        },
        referencePayload: {
            operations: [
                { op: 'create', id: 'f', type: 'function', expression: '0.25*x^2', showLabel: false },
                { op: 'create', id: 'D1', type: 'point', x: -6, y: -1, visible: false, showLabel: false },
                { op: 'create', id: 'D2', type: 'point', x: 6, y: -1, visible: false, showLabel: false },
                { op: 'create', id: 'directrix', type: 'line', point1Id: 'D1', point2Id: 'D2', dashed: true, showLabel: false },
                { op: 'create', id: 'F', type: 'point', x: 0, y: 1, label: 'F' },
                { op: 'create', id: 'V', type: 'point', x: 0, y: 0, label: 'V' },
                { op: 'create', id: 'L', type: 'point', x: -2, y: 1, label: 'L' },
                { op: 'create', id: 'R', type: 'point', x: 2, y: 1, label: 'R' },
                { op: 'create', id: 'LR', type: 'segment', point1Id: 'L', point2Id: 'R' }
            ]
        }
    },
    {
        id: 'absolute_plateau_cap_region',
        title: 'Absolute-value plateau with capped region',
        tags: 'graph function absolute line polygon region',
        promptKo: '좌표평면에 함수 abs(x-2)+abs(x+2)를 그리고, 평평한 바닥 구간의 양 끝 L(-2,4), R(2,4)를 표시해줘. 수평선 y=6을 line으로 그리고 A(-3,6), B(3,6)을 잡아 A-B-R-L 순서의 사다리꼴 영역을 연하게 칠해줘. 함수와 수평선 라벨은 숨기고 A,B,L,R 네 라벨만 보이게 해줘.',
        showAxes: true,
        expect: {
            minTypes: { function: 1, line: 1, polygon: 1, point: 4 },
            requiredFunctionExpressions: ['abs(x-2)+abs(x+2)'],
            requiredLinePatterns: [
                { kind: 'slopeIntercept', slope: 0, intercept: 6 }
            ],
            requiredPointWindows: [
                { name: 'L', xMin: -2.1, xMax: -1.9, yMin: 3.9, yMax: 4.1 },
                { name: 'R', xMin: 1.9, xMax: 2.1, yMin: 3.9, yMax: 4.1 },
                { name: 'A', xMin: -3.1, xMax: -2.9, yMin: 5.9, yMax: 6.1 },
                { name: 'B', xMin: 2.9, xMax: 3.1, yMin: 5.9, yMax: 6.1 }
            ],
            maxVisibleLabels: 4,
            maxLabelTextLength: 1
        },
        referencePayload: {
            operations: [
                { op: 'create', id: 'f', type: 'function', expression: 'abs(x-2)+abs(x+2)', showLabel: false },
                { op: 'create', id: 'A', type: 'point', x: -3, y: 6, label: 'A' },
                { op: 'create', id: 'B', type: 'point', x: 3, y: 6, label: 'B' },
                { op: 'create', id: 'L', type: 'point', x: -2, y: 4, label: 'L' },
                { op: 'create', id: 'R', type: 'point', x: 2, y: 4, label: 'R' },
                { op: 'create', id: 'h6', type: 'line', point1Id: 'A', point2Id: 'B', showLabel: false },
                { op: 'create', id: 'cap', type: 'polygon', vertexIds: ['A', 'B', 'R', 'L'], fillOpacity: 0.16, showLabel: false }
            ]
        }
    },
    {
        id: 'three_inequality_feasible_region',
        title: 'Triangular feasible region from three boundary lines',
        tags: 'graph line polygon feasible region inequality',
        promptKo: '좌표평면에 부등식 x>=0, y>=0, x+y<=6의 가능영역을 그려줘. 경계선 x=0, y=0, x+y=6을 line 객체로 만들고, 꼭짓점 O(0,0), A(6,0), B(0,6)을 point로 표시한 뒤 삼각형 OAB를 연하게 칠해줘. 보이는 라벨은 O,A,B 세 점만 남겨줘.',
        showAxes: true,
        expect: {
            minTypes: { line: 3, polygon: 1, point: 6 },
            requiredLinePatterns: [
                { kind: 'vertical', x: 0 },
                { kind: 'slopeIntercept', slope: 0, intercept: 0 },
                { kind: 'slopeIntercept', slope: -1, intercept: 6 }
            ],
            requiredPointWindows: [
                { name: 'O', xMin: -0.1, xMax: 0.1, yMin: -0.1, yMax: 0.1 },
                { name: 'A', xMin: 5.9, xMax: 6.1, yMin: -0.1, yMax: 0.1 },
                { name: 'B', xMin: -0.1, xMax: 0.1, yMin: 5.9, yMax: 6.1 }
            ],
            maxVisibleLabels: 3,
            maxLabelTextLength: 1
        },
        referencePayload: {
            operations: [
                { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
                { op: 'create', id: 'A', type: 'point', x: 6, y: 0, label: 'A' },
                { op: 'create', id: 'B', type: 'point', x: 0, y: 6, label: 'B' },
                { op: 'create', id: 'Y1', type: 'point', x: 0, y: -1, visible: false, showLabel: false },
                { op: 'create', id: 'X1', type: 'point', x: -1, y: 0, visible: false, showLabel: false },
                { op: 'create', id: 'C', type: 'point', x: 3, y: 3, visible: false, showLabel: false },
                { op: 'create', id: 'x0', type: 'line', point1Id: 'O', point2Id: 'Y1', showLabel: false },
                { op: 'create', id: 'y0', type: 'line', point1Id: 'O', point2Id: 'X1', showLabel: false },
                { op: 'create', id: 'sum6', type: 'line', point1Id: 'A', point2Id: 'B', showLabel: false },
                { op: 'create', id: 'region', type: 'polygon', vertexIds: ['O', 'A', 'B'], fillOpacity: 0.18, showLabel: false }
            ]
        }
    },
    {
        id: 'concentric_quarter_sector_wedge',
        title: 'Concentric circles with quarter-sector wedge',
        tags: 'circle sector concentric segment area',
        promptKo: '중심 O가 같은 반지름 2와 4의 두 원을 그리고, 1사분면에서 두 반지름 OA, OB가 만드는 90도 방향을 표시해줘. 바깥 원의 A(4,0), B(0,4)를 사용해 outer sector를 연하게 칠하고, 안쪽 원은 반지름점 R(2,0)으로 윤곽만 보이게 해줘. 현재 MathGraph에는 가운데가 비는 annularSector가 없으므로 고리 부채꼴처럼 뚫린 채움이라고 표현하지 말고, 바깥 부채꼴 채움과 안쪽 동심원 윤곽이 함께 보이게 해줘. O,A,B 라벨만 보이고 보조점 라벨은 숨겨줘.',
        showAxes: false,
        expect: {
            minTypes: { circle: 2, sector: 1, segment: 2, point: 4 },
            requireConcentricCircles: { center: 'O', radii: [2, 4] },
            minSectorSpan: 1.2,
            maxVisibleLabels: 3,
            maxLabelTextLength: 1
        },
        referencePayload: {
            operations: [
                { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
                { op: 'create', id: 'A', type: 'point', x: 4, y: 0, label: 'A' },
                { op: 'create', id: 'B', type: 'point', x: 0, y: 4, label: 'B' },
                { op: 'create', id: 'R', type: 'point', x: 2, y: 0, visible: false, showLabel: false },
                { op: 'create', id: 'inner', type: 'circle', centerId: 'O', pointOnCircleId: 'R', showLabel: false },
                { op: 'create', id: 'outer', type: 'circle', centerId: 'O', pointOnCircleId: 'A', showLabel: false },
                { op: 'create', id: 'OA', type: 'segment', point1Id: 'O', point2Id: 'A' },
                { op: 'create', id: 'OB', type: 'segment', point1Id: 'O', point2Id: 'B' },
                { op: 'create', id: 'sector_AOB', type: 'sector', circleId: 'outer', startPointId: 'A', endPointId: 'B', mode: 'minor', fillOpacity: 0.18, showLabel: false }
            ]
        }
    },
    {
        id: 'external_point_two_tangents',
        title: 'Two tangents from an external point to a circle',
        tags: 'circle tangent segment right_angle',
        promptKo: '중심 O, 반지름 3인 원과 외부점 P(5,0)를 그리고, P에서 원에 그은 두 접선 PT1, PT2를 표시해줘. 접점은 T1(1.8,2.4), T2(1.8,-2.4)로 직접 point를 만들고, 반지름 OT1, OT2와 접선 PT1, PT2는 segment로 그려줘. 각 접점에서 반지름과 접선이 직각임을 rightAngleMarker 두 개로 보여줘. 보이는 라벨은 O,P,T1,T2만 남겨줘.',
        showAxes: false,
        expect: {
            minTypes: { circle: 1, tangentCircle: 2, segment: 4, rightAngleMarker: 2, point: 5 },
            requiredCircleRadii: [{ center: 'O', radius: 3 }],
            requiredPointWindows: [
                { name: 'P', xMin: 4.9, xMax: 5.1, yMin: -0.1, yMax: 0.1 },
                { name: 'T1', xMin: 1.65, xMax: 1.95, yMin: 2.25, yMax: 2.55 },
                { name: 'T2', xMin: 1.65, xMax: 1.95, yMin: -2.55, yMax: -2.25 }
            ],
            requiredSegmentsBetween: [['P', 'T1'], ['P', 'T2'], ['O', 'T1'], ['O', 'T2']],
            maxVisibleLabels: 4,
            maxLabelTextLength: 2
        },
        referencePayload: {
            operations: [
                { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
                { op: 'create', id: 'R', type: 'point', x: 3, y: 0, visible: false, showLabel: false },
                { op: 'create', id: 'c', type: 'circle', centerId: 'O', pointOnCircleId: 'R', showLabel: false },
                { op: 'create', id: 'P', type: 'point', x: 5, y: 0, label: 'P' },
                { op: 'create', id: 'T1', type: 'point', x: 1.8, y: 2.4, label: 'T1' },
                { op: 'create', id: 'T2', type: 'point', x: 1.8, y: -2.4, label: 'T2' },
                { op: 'create', id: 'OT1', type: 'segment', point1Id: 'O', point2Id: 'T1' },
                { op: 'create', id: 'OT2', type: 'segment', point1Id: 'O', point2Id: 'T2' },
                { op: 'create', id: 'PT1', type: 'segment', point1Id: 'P', point2Id: 'T1' },
                { op: 'create', id: 'PT2', type: 'segment', point1Id: 'P', point2Id: 'T2' },
                { op: 'create', id: 'tan_T1', type: 'tangentCircle', circleId: 'c', tangentPointId: 'T1', showLabel: false },
                { op: 'create', id: 'tan_T2', type: 'tangentCircle', circleId: 'c', tangentPointId: 'T2', showLabel: false },
                { op: 'create', id: 'right_T1', type: 'rightAngleMarker', vertexId: 'T1', line1Id: 'OT1', line2Id: 'PT1' },
                { op: 'create', id: 'right_T2', type: 'rightAngleMarker', vertexId: 'T2', line1Id: 'OT2', line2Id: 'PT2' }
            ]
        }
    },
    {
        id: 'triangle_euler_line',
        title: 'Triangle Euler line with circumcenter, centroid, and orthocenter',
        tags: 'plane triangle circle construction line',
        promptKo: '삼각형 ABC를 A(-4,0), B(4,0), C(1,5)로 그리고 외접원을 circleThreePoints로 표시해줘. 오일러선 위의 세 점 O(0,1), G(0.33,1.67), H(1,3)를 직접 point로 만들고 O-G-H가 한 직선에 놓이도록 dashed line을 그려줘. 삼각형 polygon은 외곽선만 보이게 fillOpacity:0으로 만들고, 보이는 라벨은 A,B,C,O,G,H만 남겨줘.',
        showAxes: false,
        expect: {
            minTypes: { polygon: 1, segment: 3, circleThreePoints: 1, line: 1, point: 6 },
            requiredPointWindows: [
                { name: 'O', xMin: -0.1, xMax: 0.1, yMin: 0.9, yMax: 1.1 },
                { name: 'G', xMin: 0.2, xMax: 0.45, yMin: 1.55, yMax: 1.8 },
                { name: 'H', xMin: 0.9, xMax: 1.1, yMin: 2.9, yMax: 3.1 }
            ],
            requiredCollinearPointLabels: [['O', 'G', 'H']],
            maxPolygonFillOpacity: 0,
            maxVisibleLabels: 6,
            maxLabelTextLength: 1
        },
        referencePayload: {
            operations: [
                { op: 'create', id: 'A', type: 'point', x: -4, y: 0, label: 'A' },
                { op: 'create', id: 'B', type: 'point', x: 4, y: 0, label: 'B' },
                { op: 'create', id: 'C', type: 'point', x: 1, y: 5, label: 'C' },
                { op: 'create', id: 'tri', type: 'polygon', vertexIds: ['A', 'B', 'C'], fillOpacity: 0, showLabel: false },
                { op: 'create', id: 'AB', type: 'segment', point1Id: 'A', point2Id: 'B' },
                { op: 'create', id: 'BC', type: 'segment', point1Id: 'B', point2Id: 'C' },
                { op: 'create', id: 'CA', type: 'segment', point1Id: 'C', point2Id: 'A' },
                { op: 'create', id: 'circ', type: 'circleThreePoints', point1Id: 'A', point2Id: 'B', point3Id: 'C', showLabel: false },
                { op: 'create', id: 'O', type: 'point', x: 0, y: 1, label: 'O' },
                { op: 'create', id: 'G', type: 'point', x: 0.33, y: 1.67, label: 'G' },
                { op: 'create', id: 'H', type: 'point', x: 1, y: 3, label: 'H' },
                { op: 'create', id: 'euler', type: 'line', point1Id: 'O', point2Id: 'H', dashed: true, showLabel: false }
            ]
        }
    },
    {
        id: 'pentagon_pentagram_diagonals',
        title: 'Regular pentagon and pentagram diagonals',
        tags: 'plane polygon circle segment pentagon star',
        promptKo: '정오각형 ABCDE를 외접원 위에 놓인 것처럼 그리고, 내부의 별 모양 대각선 AC, CE, EB, BD, DA를 segment로 그려줘. 정오각형 polygon은 외곽선만 보이도록 fillOpacity:0으로 만들고, 외접원과 대각선 라벨은 숨겨줘. 보이는 라벨은 A,B,C,D,E 다섯 꼭짓점만 남겨줘.',
        showAxes: false,
        expect: {
            minTypes: { polygon: 1, circle: 1, segment: 5, point: 6 },
            requiredSegmentsBetween: [['A', 'C'], ['C', 'E'], ['E', 'B'], ['B', 'D'], ['D', 'A']],
            maxPolygonFillOpacity: 0,
            maxVisibleLabels: 5,
            maxLabelTextLength: 1
        },
        referencePayload: {
            operations: [
                { op: 'create', id: 'O', type: 'point', x: 0, y: 0, visible: false, showLabel: false },
                { op: 'create', id: 'A', type: 'point', x: 0, y: 4, label: 'A' },
                { op: 'create', id: 'B', type: 'point', x: 3.8, y: 1.24, label: 'B' },
                { op: 'create', id: 'C', type: 'point', x: 2.35, y: -3.24, label: 'C' },
                { op: 'create', id: 'D', type: 'point', x: -2.35, y: -3.24, label: 'D' },
                { op: 'create', id: 'E', type: 'point', x: -3.8, y: 1.24, label: 'E' },
                { op: 'create', id: 'circ', type: 'circle', centerId: 'O', pointOnCircleId: 'A', showLabel: false },
                { op: 'create', id: 'pentagon', type: 'polygon', vertexIds: ['A', 'B', 'C', 'D', 'E'], fillOpacity: 0, showLabel: false },
                { op: 'create', id: 'AC', type: 'segment', point1Id: 'A', point2Id: 'C' },
                { op: 'create', id: 'CE', type: 'segment', point1Id: 'C', point2Id: 'E' },
                { op: 'create', id: 'EB', type: 'segment', point1Id: 'E', point2Id: 'B' },
                { op: 'create', id: 'BD', type: 'segment', point1Id: 'B', point2Id: 'D' },
                { op: 'create', id: 'DA', type: 'segment', point1Id: 'D', point2Id: 'A' }
            ]
        }
    },
    {
        id: 'prism_diagonal_cross_section',
        title: 'Rectangular prism with internal diagonal and cross-section',
        tags: 'solid prism polygon cross_section diagonal',
        promptKo: '직육면체 prism을 그리고, 내부 대각선 하나와 가운데 사각 단면을 함께 표시해줘. 바깥 입체는 first-class prism 객체여야 하고, 단면은 내부 점 P,Q,R,S 네 개를 잇는 polygon으로 연하게 칠해줘. 내부 점들은 바깥 prism의 화면상 투영 안에 있어야 하며, 모든 point/prism/polygon 라벨은 숨겨줘.',
        showAxes: false,
        expect: {
            minTypes: { prism: 1, segment: 1, polygon: 1, point: 12 },
            innerWithinFirstPrism: true,
            validPrismProjections: true,
            maxVisibleLabels: 0
        },
        referencePayload: {
            operations: [
                { op: 'create', id: 'A', type: 'point', x: -4, y: -2, visible: false, showLabel: false },
                { op: 'create', id: 'B', type: 'point', x: 2, y: -2, visible: false, showLabel: false },
                { op: 'create', id: 'C', type: 'point', x: 2, y: 1, visible: false, showLabel: false },
                { op: 'create', id: 'D', type: 'point', x: -4, y: 1, visible: false, showLabel: false },
                { op: 'create', id: 'A1', type: 'point', x: -2, y: 0, visible: false, showLabel: false },
                { op: 'create', id: 'B1', type: 'point', x: 4, y: 0, visible: false, showLabel: false },
                { op: 'create', id: 'C1', type: 'point', x: 4, y: 3, visible: false, showLabel: false },
                { op: 'create', id: 'D1', type: 'point', x: -2, y: 3, visible: false, showLabel: false },
                { op: 'create', id: 'box', type: 'prism', baseVertexIds: ['A', 'B', 'C', 'D'], topVertexIds: ['A1', 'B1', 'C1', 'D1'], showLabel: false },
                { op: 'create', id: 'diag', type: 'segment', point1Id: 'A', point2Id: 'C1', dashed: true },
                { op: 'create', id: 'P', type: 'point', x: -3, y: -1, visible: false, showLabel: false },
                { op: 'create', id: 'Q', type: 'point', x: 1, y: -1, visible: false, showLabel: false },
                { op: 'create', id: 'R', type: 'point', x: 3, y: 2, visible: false, showLabel: false },
                { op: 'create', id: 'S', type: 'point', x: -1, y: 2, visible: false, showLabel: false },
                { op: 'create', id: 'section', type: 'polygon', vertexIds: ['P', 'Q', 'R', 'S'], fillOpacity: 0.18, showLabel: false }
            ]
        }
    },
    {
        id: 'triangular_pyramid_inside_triangular_prism',
        title: 'Triangular pyramid inside a triangular prism',
        tags: 'solid prism pyramid nested triangular',
        promptKo: '큰 삼각기둥 prism 안에 작은 삼각뿔 pyramid가 들어 있는 모습을 그려줘. 바깥 입체는 baseVertexIds 3개와 topVertexIds 3개를 가진 삼각기둥이어야 하고, 안쪽 pyramid는 baseVertexIds 3개와 별도 apexId를 가진 삼각뿔이어야 해. prism의 topVertexIds는 baseVertexIds와 같은 순서의 평행 이동 복사본이어야 하며, 안쪽 삼각뿔의 모든 꼭짓점은 바깥 prism의 투영 안에 있어야 해. 모든 라벨은 숨겨줘.',
        showAxes: false,
        expect: {
            minTypes: { prism: 1, pyramid: 1, point: 10 },
            requiredPrismVertexCounts: [3],
            requiredPyramidBaseVertexCounts: [{ count: 3, min: 1 }],
            innerWithinFirstPrism: true,
            validPrismProjections: true,
            validPyramidApexes: true,
            maxVisibleLabels: 0
        },
        referencePayload: {
            operations: [
                { op: 'create', id: 'A', type: 'point', x: -4, y: -2, visible: false, showLabel: false },
                { op: 'create', id: 'B', type: 'point', x: 3, y: -2, visible: false, showLabel: false },
                { op: 'create', id: 'C', type: 'point', x: -1, y: 2, visible: false, showLabel: false },
                { op: 'create', id: 'A1', type: 'point', x: -2, y: 0, visible: false, showLabel: false },
                { op: 'create', id: 'B1', type: 'point', x: 5, y: 0, visible: false, showLabel: false },
                { op: 'create', id: 'C1', type: 'point', x: 1, y: 4, visible: false, showLabel: false },
                { op: 'create', id: 'outer_tri_prism', type: 'prism', baseVertexIds: ['A', 'B', 'C'], topVertexIds: ['A1', 'B1', 'C1'], showLabel: false },
                { op: 'create', id: 'P', type: 'point', x: -1.8, y: -0.9, visible: false, showLabel: false },
                { op: 'create', id: 'Q', type: 'point', x: 1, y: -0.9, visible: false, showLabel: false },
                { op: 'create', id: 'R', type: 'point', x: -0.6, y: 0.7, visible: false, showLabel: false },
                { op: 'create', id: 'V', type: 'point', x: 0, y: 1.8, visible: false, showLabel: false },
                { op: 'create', id: 'inner_tri_pyramid', type: 'pyramid', baseVertexIds: ['P', 'Q', 'R'], apexId: 'V', showLabel: false }
            ]
        }
    }
];

const promptSets = {
    default: smokePrompts,
    extended: extendedSmokePrompts,
    stress: stressSmokePrompts,
    stress_extra: stressExtraSmokePrompts,
    stress_novel: stressNovelSmokePrompts
};

const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'application/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png']
]);

const asMarkdownPath = filePath => path.resolve(filePath).replaceAll(path.sep, '/');

function getPromptSet() {
    const name = process.env.LIVE_AI_PROMPT_SET || 'default';
    const prompts = promptSets[name];
    if (!prompts) {
        throw new Error(`Unknown LIVE_AI_PROMPT_SET="${name}". Valid sets: ${Object.keys(promptSets).join(', ')}.`);
    }
    return { name, prompts };
}

function findPromptById(id) {
    for (const [setName, prompts] of Object.entries(promptSets)) {
        const prompt = prompts.find(candidate => candidate.id === id);
        if (prompt) return { ...prompt, promptSetName: setName };
    }
    return null;
}

function reportPrompt(prompt) {
    const { referencePayload, ...safePrompt } = prompt || {};
    return safePrompt;
}

function payloadFromSavedResult(result) {
    if (result?.response?.payload?.operations) return result.response.payload;
    if (result?.payload?.operations) return result.payload;
    if (Array.isArray(result?.operations)) return { operations: result.operations };
    return { operations: [] };
}

async function revalidateSavedResults(validator, resultsPath) {
    const resolvedPath = path.resolve(resultsPath);
    const saved = JSON.parse(await readFile(resolvedPath, 'utf8'));
    const savedResults = Array.isArray(saved) ? saved : saved.results;
    if (!Array.isArray(savedResults)) {
        throw new Error(`Saved results file does not contain a results array: ${resolvedPath}`);
    }

    const reports = savedResults.map(result => {
        const savedPrompt = result.prompt || {};
        const prompt = findPromptById(savedPrompt.id) || savedPrompt;
        const validation = validatePayload(payloadFromSavedResult(result), validator, prompt);
        return {
            id: savedPrompt.id || prompt.id || '(unknown)',
            promptSet: prompt.promptSetName || saved.meta?.promptSet || '(saved)',
            operationCount: validation.operationCount,
            valid: validation.valid,
            errors: validation.errors
        };
    });
    const failures = reports.filter(item => !item.valid);
    const summary = {
        source: asMarkdownPath(resolvedPath),
        checkedAt: new Date().toISOString(),
        count: reports.length,
        failureCount: failures.length,
        failures: failures.map(item => ({
            id: item.id,
            errors: item.errors
        })),
        reports
    };
    const reportPath = path.join(path.dirname(resolvedPath), 'live-openai-random-revalidation.json');
    await writeFile(reportPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(JSON.stringify({
        ...summary,
        reportPath: asMarkdownPath(reportPath),
        reports: undefined
    }, null, 2));

    if (failures.length > 0) {
        process.exitCode = 1;
    }
}

async function renderReferenceTargets(validator) {
    const promptSet = getPromptSet();
    const limit = Number(process.env.LIVE_AI_SAMPLE_LIMIT || promptSet.prompts.length);
    const selectedPrompts = promptSet.prompts.slice(0, limit);
    const results = selectedPrompts.map(prompt => {
        if (!prompt.referencePayload?.operations) {
            throw new Error(`${prompt.id} does not define referencePayload.operations for local target rendering.`);
        }
        const payload = stripNullFields(prompt.referencePayload);
        return {
            prompt: reportPrompt(prompt),
            request: {
                endpoint: 'local-reference-target',
                model: 'local-reference-target',
                attempt: 0,
                userPrompt: prompt.promptKo,
                developerPrompt: '(not used for local reference targets)'
            },
            response: {
                id: null,
                model: 'local-reference-target',
                rawText: JSON.stringify(payload),
                payload
            },
            validation: validatePayload(payload, validator, prompt)
        };
    });

    const renderMeta = await render(results, 'Local Reference MathGraph Targets');
    const meta = {
        generatedAt: new Date().toISOString(),
        endpoint: 'local-reference-target',
        model: 'local-reference-target',
        promptSet: promptSet.name,
        promptCount: results.length,
        contactSheetPath: renderMeta.contactSheetPath,
        consoleErrorCount: renderMeta.consoleErrors.length,
        consoleErrors: renderMeta.consoleErrors
    };
    const resultPath = path.join(outputDir, 'reference-target-results.json');
    const reportPath = path.join(outputDir, 'reference-target-report.md');
    await writeFile(resultPath, JSON.stringify({ meta, results }, null, 2), 'utf8');
    await writeFile(reportPath, referenceTargetReport(meta, results), 'utf8');

    const failures = results.filter(result =>
        !result.validation.valid ||
        !result.render?.rendered
    );

    console.log(JSON.stringify({
        meta,
        resultPath: asMarkdownPath(resultPath),
        reportPath: asMarkdownPath(reportPath),
        screenshotDir: asMarkdownPath(screenshotDir),
        failures: failures.map(result => result.prompt.id)
    }, null, 2));

    if (failures.length > 0 || renderMeta.consoleErrors.length > 0) {
        process.exit(1);
    }
}

async function openAIRequest(apiKey, url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...(options.headers || {})
        }
    });
    const text = await response.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        data = { raw: text };
    }
    if (!response.ok) {
        const error = new Error(data?.error?.message || text || `OpenAI HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    return data;
}

async function chooseModel(apiKey) {
    const preferred = [
        process.env.OPENAI_MODEL,
        'gpt-5.4-mini',
        'gpt-4.1-mini',
        'gpt-5-mini',
        'gpt-4o-mini',
        'gpt-5.5',
        'gpt-4.1',
        'gpt-4o'
    ].filter(Boolean);
    const models = await openAIRequest(apiKey, 'https://api.openai.com/v1/models', { method: 'GET' });
    const ids = new Set((models.data || []).map(model => model.id));
    for (const model of preferred) {
        if (ids.has(model)) return model;
    }
    const fallback = [...ids].find(id => /^gpt-/.test(id) && !/audio|realtime|transcribe|tts|image/i.test(id));
    if (!fallback) {
        throw new Error('No GPT text model was visible to this API key.');
    }
    return fallback;
}

async function buildReferencePrompt(prompt) {
    const [manual, index] = await Promise.all([
        readFile(featureManualPath, 'utf8').then(JSON.parse),
        readFile(referenceIndexPath, 'utf8').then(JSON.parse)
    ]);
    const service = new AIService({
        provider: 'local',
        apiKey: '',
        referenceManual: manual,
        referenceIndex: index
    });
    return service.buildDrawingReferencePromptFromManual(
        manual,
        index,
        `${prompt.tags}\n${prompt.promptKo}`,
        null,
        'recreate'
    );
}

function developerPrompt(referencePrompt = '') {
    return [
        'You convert Korean MathGraph drawing requests into GraphA operations JSON.',
        'Return only a JSON object shaped exactly as {"operations":[...]} with no prose or Markdown.',
        'Use only supported GraphA operation fields. Do not invent aliases such as p1, p2, from, to, points, vertices, center, radius, width, height, equation, or text.',
        'Every referenced id must be created earlier in the same operations array unless it already exists in the canvas context.',
        'Prefer black default geometry. Omit color fields unless a non-black color is explicitly requested.',
        `Keep the drawing at or below ${IMAGE_RECREATE_OPERATION_BUDGET} operations.`,
        'Use MathGraph math coordinates near the default view, usually between -8 and 8. Do not use pixel-style coordinates such as 120 or 260.',
        'For graph/function prompts, create functions with expression strings only, such as "x^2 - 4". Never include "y=" in a function expression.',
        'For quadratic/parabola prompts, create an actual function object for the parabola; do not approximate it only with points or line segments.',
        'For pointOnCircle, use angle in radians. Do not use t for pointOnCircle.',
        'For sector/arc requests, create distinct start and end points on the circle so the shaded sector has visible area.',
        'For tangent-to-circle requests, prefer tangentCircle with circleId and tangentPointId.',
        'For tangent-to-function requests, prefer tangentFunction with functionId and x.',
        'When a prompt gives exact construction coordinates for focus/directrix/tangent points/region vertices, create those point objects directly instead of substituting nearby sample points.',
        'For dashed reference equations such as y=4, y=-1, x=0, or x+y=6, create line objects from two explicit support points on the requested equation.',
        'For concentric-circle or fixed-radius prompts, use the same center point id and create radius points at the exact requested distance.',
        'For exact annular-sector fills, note that MathGraph currently has no first-class annularSector; approximate only with supported circles, sectors, segments, and polygons when the prompt allows it.',
        'For function-bounded curved regions, use a polygon through explicit named boundary/sample points and keep helper vertices hidden; do not claim the fill is exact unless a first-class region object exists.',
        'For triangle or polygon sides, use finite segment objects for the sides. Use line only when an infinite construction line is explicitly requested.',
        'For rightAngleMarker, the fields are vertexId, line1Id, and line2Id. Never use segment1Id or segment2Id for rightAngleMarker; those fields are only for equalLengthMarker.',
        'For angleDimension, create one marker per shown angle. Use the actual intersection point as vertexId and choose point1Id/point2Id on the two rays that form that angle.',
        'For angleDimension, point1Id and point2Id must be distinct from vertexId, at least 0.55 math units away from the vertex, and not collinear with each other.',
        'For multiple angleDimension markers at the same vertex, use staggered arcRadius values and set showValue:false or customText to avoid overlapping automatic degree labels.',
        'For construction-only polygons that should look like outlines, set fillOpacity:0. Use a positive fillOpacity only when the user requests a shaded region.',
        'For histograms, draw bars on the requested class-interval boundaries, such as [0,1], [1,2], not centered half-offset ranges such as [0.5,1.5] unless explicitly requested.',
        'For prism or solid prompts, prefer the first-class prism/pyramid object so hidden-edge dashed rendering is determined consistently by the runtime.',
        'For prism objects, use baseVertexIds for the near/front face and topVertexIds for the shifted rear face so visible front edges stay solid and hidden rear edges become dashed.',
        'For pyramid objects, apexId must not be included in baseVertexIds and the apex must be visually separated from the base centroid.',
        'For nested solids, keep every inner vertex inside the outer projection and separate multiple inner solids so their screen-projection centers do not overlap.',
        'For dense graphs or solids, label only the essential points requested by the prompt. Set showLabel:false on helper points, functions, circles, arcs, sectors, prisms, and pyramids when labels would clutter the drawing.',
        'For helper points that only shape a filled or outlined region, set visible:false so they do not appear as extra dots.',
        'For chart-like or unsupported details, approximate with points, segments, polygons, numberLine, prism, or pyramid only.',
        referencePrompt
    ].filter(Boolean).join('\n');
}

function repairPrompt(prompt, previousPayload, errors) {
    return [
        prompt.promptKo,
        '',
        '위 요청에 대한 이전 GraphA JSON이 로컬 검증에 실패했습니다.',
        '아래 오류를 모두 고쳐서 {"operations":[...]} JSON만 다시 반환하세요.',
        '',
        'If the previous response was truncated or too long, return fewer objects and omit optional labels/styles while preserving the requested main structure.',
        'Important field rule: rightAngleMarker must use line1Id and line2Id. Do not use segment1Id or segment2Id unless the type is equalLengthMarker.',
        '',
        'Validation errors:',
        errors.map(error => `- ${error}`).join('\n'),
        '',
        'Previous JSON:',
        JSON.stringify(previousPayload, null, 2)
    ].join('\n');
}

function parsePayload(data) {
    const rawText = extractOpenAIResponseText(data);
    const parsed = data.output_parsed || parseAIJSONPayload(rawText);
    const payload = stripNullFields(Array.isArray(parsed) ? { operations: parsed } : parsed);
    if (!Array.isArray(payload?.operations)) {
        throw new Error('OpenAI response did not contain operations[].');
    }
    return { rawText, payload };
}

export function validatePayload(payload, validator, prompt = null) {
    const schema = validator.validate(payload);
    const refs = validator.validateReferences(payload, new Set());
    const intent = validator.validateIntent(payload, {
        mode: 'recreate',
        maxOperations: IMAGE_RECREATE_OPERATION_BUDGET
    });
    const runtimeErrors = validateRuntimeReadablePayload(payload);
    const semanticErrors = prompt ? validateSmokeSemantics(payload, prompt) : [];
    const errors = [
        ...schema.errors,
        ...refs.errors,
        ...intent.errors,
        ...runtimeErrors,
        ...semanticErrors
    ];
    return {
        schemaValid: schema.valid,
        referencesValid: refs.valid,
        intentValid: intent.valid,
        runtimeReadable: runtimeErrors.length === 0,
        semanticValid: semanticErrors.length === 0,
        valid: schema.valid && refs.valid && intent.valid && runtimeErrors.length === 0 && semanticErrors.length === 0,
        errors,
        operationCount: payload.operations.length
    };
}

export function validateRuntimeReadablePayload(payload) {
    const operations = Array.isArray(payload?.operations) ? payload.operations : [];
    const errors = [];
    operations.forEach((operation, index) => {
        if (operation.type === 'function' && typeof operation.expression === 'string') {
            if (operation.expression.includes('=')) {
                errors.push(`operations[${index}]: function expression must omit "y=" and contain only the right-hand side.`);
            }
        }
        if (operation.type === 'pointOnCircle' && operation.t !== undefined) {
            errors.push(`operations[${index}]: pointOnCircle must use angle in radians; t is ignored by the runtime.`);
        }
    });
    return errors;
}

export function validateSmokeSemantics(payload, prompt) {
    const operations = Array.isArray(payload?.operations) ? payload.operations : [];
    const ctx = buildOperationContext(operations);
    const errors = [];

    if (prompt?.id === 'circle_sector_tangent') {
        const sectors = ctx.byType('sector');
        const arcs = ctx.byType('arc');
        if (sectors.length === 0) {
            errors.push('circle_sector_tangent: expected a sector object for the requested sector AOB.');
        }
        if (arcs.length === 0) {
            errors.push('circle_sector_tangent: expected an arc object for the requested minor arc AB.');
        }

        for (const sector of sectors) {
            const span = angularSpanForCircleRegion(ctx, sector);
            if (!Number.isFinite(span)) {
                errors.push(`circle_sector_tangent: sector "${sector.id || '(no id)'}" must reference resolvable distinct circle start/end points.`);
            } else if (span < 0.15) {
                errors.push(`circle_sector_tangent: sector "${sector.id || '(no id)'}" has near-zero angular span, so it will not appear as a visible sector.`);
            }
            if (sector.fillOpacity !== undefined && sector.fillOpacity <= 0.05) {
                errors.push(`circle_sector_tangent: sector "${sector.id || '(no id)'}" fillOpacity is too low to serve as a visible shaded sector.`);
            }
        }
    }

    if (prompt?.id === 'quadratic_line_intersections') {
        const quadraticFunctions = ctx.byType('function').filter(operation =>
            isQuadraticExpression(operation.expression) && !String(operation.expression || '').includes('=')
        );
        if (quadraticFunctions.length === 0) {
            errors.push('quadratic_line_intersections: expected an actual function object with RHS-only quadratic expression, for example "x^2 - 4".');
        }
        if (ctx.byType('tangentFunction').length === 0) {
            errors.push('quadratic_line_intersections: expected a tangentFunction object for the requested tangent at x=1.');
        }
    }

    if (prompt?.id === 'triangle_incircle_contacts') {
        validateTriangleIncircleContacts(ctx, errors);
    }

    if (prompt?.id === 'parallel_transversal_angles') {
        validateParallelTransversalAngles(ctx, errors);
    }

    if (prompt?.id === 'histogram_frequency_polygon') {
        validateHistogramFrequencyPolygon(ctx, errors);
    }

    if (prompt?.id === 'triangular_prism_hidden_edges') {
        validateTriangularPrismHiddenEdges(ctx, errors);
    }

    validateSmokeCoordinateRange(ctx, prompt, errors);
    validatePromptExpectations(ctx, prompt, errors);

    return errors;
}

function validateSmokeCoordinateRange(ctx, prompt, errors) {
    if (!prompt) return;
    const maxAbsCoordinate = prompt.maxAbsCoordinate || 20;
    const outOfViewPoints = ctx.byType('point').filter(point =>
        Math.abs(point.x) > maxAbsCoordinate || Math.abs(point.y) > maxAbsCoordinate
    );
    if (outOfViewPoints.length > 0) {
        const ids = outOfViewPoints.slice(0, 4).map(point => point.id || '(no id)').join(', ');
        errors.push(`${prompt.id}: point coordinates must stay within +/-${maxAbsCoordinate} math units for the default render view; out-of-range point(s): ${ids}.`);
    }
}

const RUNTIME_DEFAULT_LABEL_TYPES = new Set([
    'point',
    'pointOnLine',
    'pointOnCircle',
    'circleCenterPoint',
    'intersection',
    'midpoint',
    'circle',
    'circleThreePoints',
    'arc',
    'sector',
    'circularSegment',
    'polygon',
    'function'
]);

function hasRuntimeVisibleLabel(operation) {
    if (!operation || operation.visible === false) return false;

    if (operation.type === 'angleDimension') {
        return operation.showValue !== false;
    }

    if (operation.showLabel === false) return false;
    if (operation.showLabel === true) return true;
    if (typeof operation.label === 'string' && operation.label.trim()) return true;

    return RUNTIME_DEFAULT_LABEL_TYPES.has(operation.type);
}

function describeRuntimeLabel(operation) {
    const label = typeof operation.label === 'string' && operation.label.trim()
        ? operation.label.trim()
        : '(runtime default)';
    return `${operation.type || '(unknown)'}:${operation.id || '(no id)'}:${label}`;
}

function runtimeVisibleLabelText(operation) {
    if (!hasRuntimeVisibleLabel(operation)) return null;
    if (operation.type === 'angleDimension') {
        if (typeof operation.customText === 'string') return operation.customText;
        return '90°';
    }
    if (typeof operation.label === 'string' && operation.label.trim()) {
        return operation.label.trim();
    }
    if (operation.type === 'circle' || operation.type === 'circleThreePoints' ||
        operation.type === 'arc' || operation.type === 'sector' ||
        operation.type === 'circularSegment' || operation.type === 'polygon') {
        return 'c1';
    }
    return 'A';
}

function countRuntimeVisibleLabels(payload) {
    const operations = Array.isArray(payload?.operations) ? payload.operations : [];
    return operations.filter(operation => operation?.op === 'create' && hasRuntimeVisibleLabel(operation)).length;
}

function validatePromptExpectations(ctx, prompt, errors) {
    const expectations = prompt?.expect;
    if (!expectations) return;

    if (expectations.minTypes) {
        for (const [type, minimum] of Object.entries(expectations.minTypes)) {
            const count = ctx.byType(type).length;
            if (count < minimum) {
                errors.push(`${prompt.id}: expected at least ${minimum} "${type}" object(s), but found ${count}.`);
            }
        }
    }

    if (Number.isFinite(expectations.maxVisibleLabels)) {
        const labeled = ctx.creates.filter(hasRuntimeVisibleLabel);
        if (labeled.length > expectations.maxVisibleLabels) {
            const examples = labeled.slice(0, 6).map(describeRuntimeLabel).join(', ');
            errors.push(`${prompt.id}: expected at most ${expectations.maxVisibleLabels} runtime-visible label(s), but found ${labeled.length}; hide nonessential labels with showLabel:false. Examples: ${examples}.`);
        }
    }

    if (Number.isFinite(expectations.maxLabelTextLength)) {
        const longLabels = ctx.creates
            .filter(hasRuntimeVisibleLabel)
            .map(operation => ({ operation, text: runtimeVisibleLabelText(operation) || '' }))
            .filter(item => item.text.length > expectations.maxLabelTextLength);
        if (longLabels.length > 0) {
            const examples = longLabels.slice(0, 6)
                .map(({ operation, text }) => `${operation.type || '(unknown)'}:${operation.id || '(no id)'}:${text}`)
                .join(', ');
            errors.push(`${prompt.id}: visible labels must be ${expectations.maxLabelTextLength} character(s) or shorter to avoid overlap; long label(s): ${examples}.`);
        }
    }

    if (Number.isFinite(expectations.maxVisiblePointCount)) {
        const visiblePoints = ctx.byType('point').filter(point => point.visible !== false);
        if (visiblePoints.length > expectations.maxVisiblePointCount) {
            const examples = visiblePoints.slice(0, 8).map(point => point.id || '(no id)').join(', ');
            errors.push(`${prompt.id}: expected at most ${expectations.maxVisiblePointCount} visible point object(s), but found ${visiblePoints.length}; set helper points to visible:false. Visible point(s): ${examples}.`);
        }
    }

    if (Array.isArray(expectations.requiredPointWindows)) {
        validateRequiredPointWindows(ctx, prompt, expectations.requiredPointWindows, errors);
    }

    if (Array.isArray(expectations.requiredFunctionExpressions)) {
        validateRequiredFunctionExpressions(ctx, prompt, expectations.requiredFunctionExpressions, errors);
    }

    if (Array.isArray(expectations.requiredSegmentsBetween)) {
        validateRequiredSegmentsBetween(ctx, prompt, expectations.requiredSegmentsBetween, errors);
    }

    if (Number.isFinite(expectations.minDashedLines)) {
        const dashedLines = ctx.byType('line').filter(line => line.dashed === true);
        if (dashedLines.length < expectations.minDashedLines) {
            errors.push(`${prompt.id}: expected at least ${expectations.minDashedLines} dashed line object(s), but found ${dashedLines.length}.`);
        }
    }

    if (Array.isArray(expectations.requiredLinePatterns)) {
        validateRequiredLinePatterns(ctx, prompt, expectations.requiredLinePatterns, errors);
    }

    if (Array.isArray(expectations.requiredCircleRadii)) {
        validateRequiredCircleRadii(ctx, prompt, expectations.requiredCircleRadii, errors);
    }

    if (expectations.requireConcentricCircles) {
        validateConcentricCircles(ctx, prompt, expectations.requireConcentricCircles, errors);
    }

    if (Array.isArray(expectations.requiredCollinearPointLabels)) {
        validateRequiredCollinearPointLabels(ctx, prompt, expectations.requiredCollinearPointLabels, errors);
    }

    if (Array.isArray(expectations.requiredTangentXs)) {
        const tangentXs = ctx.byType('tangentFunction')
            .map(tangent => Number(tangent.x))
            .filter(Number.isFinite);
        for (const requiredX of expectations.requiredTangentXs) {
            if (!tangentXs.some(actualX => nearlyEqual(actualX, requiredX, 0.02))) {
                errors.push(`${prompt.id}: expected a tangentFunction at x=${requiredX}, but found x values [${tangentXs.map(formatNumber).join(', ')}].`);
            }
        }
    }

    if (Number.isFinite(expectations.minSectorSpan)) {
        const sectors = ctx.byType('sector');
        const collapsed = sectors.filter(sector => angularSpanForCircleRegion(ctx, sector) < expectations.minSectorSpan);
        if (sectors.length > 0 && collapsed.length === sectors.length) {
            const ids = collapsed.map(sector => sector.id || '(no id)').join(', ');
            errors.push(`${prompt.id}: expected a visible sector span of at least ${formatNumber(expectations.minSectorSpan)} radians; collapsed or tiny sector(s): ${ids}.`);
        }
    }

    if (expectations.requireDirectLensPoints) {
        validateDirectTwoCircleLensPoints(ctx, prompt, errors);
    }

    if (Number.isFinite(expectations.lensCircleRadius)) {
        validateLensCircleGeometry(ctx, prompt, expectations.lensCircleRadius, errors);
    }

    if (expectations.requireSimpleLensPolygon) {
        validateSimpleLensPolygon(ctx, prompt, errors);
    }

    if (expectations.lensPolygonBounds) {
        validateLensPolygonBounds(ctx, prompt, expectations.lensPolygonBounds, errors);
    }

    if (expectations.requireRenderableAngles) {
        validateRenderableAngles(ctx, prompt, errors);
    }

    if (Number.isFinite(expectations.minDistinctAngleVertices)) {
        const distinctVertices = new Set(ctx.byType('angleDimension').map(angle => angle.vertexId).filter(Boolean));
        if (distinctVertices.size < expectations.minDistinctAngleVertices) {
            errors.push(`${prompt.id}: expected angle markers at ${expectations.minDistinctAngleVertices} distinct vertices, but found ${distinctVertices.size}.`);
        }
    }

    if (Number.isFinite(expectations.maxPolygonFillOpacity)) {
        validatePolygonFillOpacity(ctx, prompt, expectations.maxPolygonFillOpacity, errors);
    }

    if (expectations.innerWithinFirstPrism) {
        validateInnerPointsWithinFirstSolid(ctx, prompt, 'prism', errors);
    }

    if (expectations.innerWithinFirstPyramid) {
        validateInnerPointsWithinFirstSolid(ctx, prompt, 'pyramid', errors);
    }

    if (Number.isFinite(expectations.innerSolidMinCenterDistance)) {
        validateInnerSolidSeparation(ctx, prompt, expectations.innerSolidMinCenterDistance, errors);
    }

    if (Array.isArray(expectations.requiredPrismVertexCounts)) {
        validateRequiredPrismVertexCounts(ctx, prompt, expectations.requiredPrismVertexCounts, errors);
    }

    if (expectations.validPrismProjections) {
        validatePrismProjections(ctx, prompt, errors);
    }

    if (Array.isArray(expectations.requiredPyramidBaseVertexCounts)) {
        validateRequiredPyramidBaseVertexCounts(ctx, prompt, expectations.requiredPyramidBaseVertexCounts, errors);
    }

    if (expectations.validPyramidApexes) {
        validatePyramidApexes(ctx, prompt, errors);
    }
}

function validateRequiredPointWindows(ctx, prompt, windows, errors) {
    for (const window of windows) {
        const pointId = findNamedPointId(ctx, window.name);
        const point = pointId ? resolvePoint(ctx, pointId, new Set()) : null;
        if (!point) {
            errors.push(`${prompt.id}: expected point ${window.name} in the requested coordinate window, but it was missing or unresolved.`);
            continue;
        }
        const inWindow = point.x >= window.xMin && point.x <= window.xMax &&
            point.y >= window.yMin && point.y <= window.yMax;
        if (!inWindow) {
            errors.push(`${prompt.id}: point ${window.name} should be inside x=[${formatNumber(window.xMin)}, ${formatNumber(window.xMax)}], y=[${formatNumber(window.yMin)}, ${formatNumber(window.yMax)}], but was (${formatNumber(point.x)}, ${formatNumber(point.y)}).`);
        }
    }
}

function validateRequiredFunctionExpressions(ctx, prompt, expressions, errors) {
    const normalizedActual = ctx.byType('function')
        .map(func => normalizeExpression(func.expression))
        .filter(Boolean);

    for (const expression of expressions) {
        const expected = normalizeExpression(expression);
        if (!normalizedActual.includes(expected)) {
            errors.push(`${prompt.id}: expected a function expression matching "${expression}", but found [${ctx.byType('function').map(func => func.expression || '(missing)').join(', ')}].`);
        }
    }
}

function normalizeExpression(expression) {
    return String(expression || '')
        .replace(/\s+/g, '')
        .replace(/\*\*/g, '^')
        .toLowerCase();
}

function validateRequiredSegmentsBetween(ctx, prompt, segmentRules, errors) {
    for (const rule of segmentRules) {
        const [name1, name2] = rule;
        const id1 = findNamedPointId(ctx, name1);
        const id2 = findNamedPointId(ctx, name2);
        if (!id1 || !id2) {
            errors.push(`${prompt.id}: expected segment endpoints ${name1} and ${name2}, but at least one point was missing.`);
            continue;
        }
        if (!findSegmentBetween(ctx, id1, id2)) {
            errors.push(`${prompt.id}: expected a segment between ${name1} and ${name2}.`);
        }
    }
}

function validateDirectTwoCircleLensPoints(ctx, prompt, errors) {
    const pointAId = findNamedPointId(ctx, 'A');
    const pointBId = findNamedPointId(ctx, 'B');
    const pointA = pointAId ? ctx.byId.get(pointAId) : null;
    const pointB = pointBId ? ctx.byId.get(pointBId) : null;

    if (!pointA || !pointB) {
        errors.push(`${prompt.id}: expected directly created lens intersection points labeled A and B.`);
        return;
    }

    if (pointA.type !== 'point' || pointB.type !== 'point') {
        errors.push(`${prompt.id}: lens points A and B must be direct point objects, not duplicate circle-circle intersection objects.`);
        return;
    }

    const a = resolvePoint(ctx, pointA.id, new Set());
    const b = resolvePoint(ctx, pointB.id, new Set());
    if (!a || !b || distance(a, b) < 1 || a.y * b.y >= 0) {
        errors.push(`${prompt.id}: lens points A and B should be distinct upper/lower points on opposite sides of the center segment.`);
    }

    const lensPolygon = ctx.byType('polygon').find(polygon =>
        Array.isArray(polygon.vertexIds) &&
        polygon.vertexIds.includes(pointA.id) &&
        polygon.vertexIds.includes(pointB.id)
    );
    if (!lensPolygon) {
        errors.push(`${prompt.id}: expected a lens polygon that uses both A and B as vertices.`);
    }
}

function validateRequiredCircleRadii(ctx, prompt, rules, errors) {
    for (const rule of rules) {
        const centerId = rule.center ? findNamedPointId(ctx, rule.center) : null;
        const circles = ctx.byType('circle').filter(circle => !centerId || circle.centerId === centerId);
        const matches = circles.filter(circle => {
            const radius = circleRadius(ctx, circle);
            return Number.isFinite(radius) && Math.abs(radius - rule.radius) <= (rule.tolerance || 0.12);
        });
        const requiredMinimum = rule.min || 1;
        if (matches.length < requiredMinimum) {
            const actual = circles.map(circle => `${circle.id || '(no id)'}:${formatNumber(circleRadius(ctx, circle))}`).join(', ') || '(none)';
            const centerNote = rule.center ? ` centered at ${rule.center}` : '';
            errors.push(`${prompt.id}: expected at least ${requiredMinimum} circle(s)${centerNote} with radius ${formatNumber(rule.radius)}; actual radii: ${actual}.`);
        }
    }
}

function validateConcentricCircles(ctx, prompt, rule, errors) {
    const centerId = findNamedPointId(ctx, rule.center || 'O');
    if (!centerId) {
        errors.push(`${prompt.id}: expected concentric circle center ${rule.center || 'O'}, but it was missing.`);
        return;
    }

    const circles = ctx.byType('circle').filter(circle => circle.centerId === centerId);
    if (circles.length < (rule.min || 2)) {
        errors.push(`${prompt.id}: expected at least ${rule.min || 2} circles centered at ${rule.center || 'O'}, but found ${circles.length}.`);
        return;
    }

    if (Array.isArray(rule.radii)) {
        const radii = circles.map(circle => circleRadius(ctx, circle));
        for (const expectedRadius of rule.radii) {
            if (!radii.some(radius => Number.isFinite(radius) && Math.abs(radius - expectedRadius) <= (rule.tolerance || 0.12))) {
                errors.push(`${prompt.id}: expected a concentric circle radius ${formatNumber(expectedRadius)}; actual radii were [${radii.map(formatNumber).join(', ')}].`);
            }
        }
    }
}

function validateRequiredCollinearPointLabels(ctx, prompt, groups, errors) {
    for (const group of groups) {
        const points = group
            .map(name => ({ name, id: findNamedPointId(ctx, name) }))
            .map(item => ({ ...item, point: item.id ? resolvePoint(ctx, item.id, new Set()) : null }));
        const missing = points.filter(item => !item.point);
        if (missing.length > 0) {
            errors.push(`${prompt.id}: expected collinear point(s) ${group.join(', ')}, but missing/unresolved: ${missing.map(item => item.name).join(', ')}.`);
            continue;
        }
        const [first, second, ...rest] = points.map(item => item.point);
        const baseLength = distance(first, second);
        if (baseLength < 0.05) {
            errors.push(`${prompt.id}: collinear reference points ${group.join(', ')} must be distinct.`);
            continue;
        }
        const offLine = rest.filter(point => Math.abs(cross(subtract(second, first), subtract(point, first))) / baseLength > 0.08);
        if (offLine.length > 0) {
            errors.push(`${prompt.id}: expected points ${group.join(', ')} to be collinear.`);
        }
    }
}

function validateLensCircleGeometry(ctx, prompt, expectedRadius, errors) {
    const centerIds = ['O', 'P'].map(name => findNamedPointId(ctx, name));
    if (!centerIds.every(Boolean)) {
        errors.push(`${prompt.id}: expected lens circle centers labeled O and P.`);
        return;
    }

    const circles = centerIds.map(centerId => ctx.byType('circle').find(circle => circle.centerId === centerId));
    if (!circles.every(Boolean)) {
        errors.push(`${prompt.id}: expected one circle centered at O and one circle centered at P.`);
        return;
    }

    const radii = circles.map(circle => circleRadius(ctx, circle));
    const badRadii = radii
        .map((radius, index) => ({ radius, id: circles[index].id || '(no id)' }))
        .filter(item => !Number.isFinite(item.radius) || Math.abs(item.radius - expectedRadius) > 0.12);
    if (badRadii.length > 0) {
        const actual = radii.map(radius => formatNumber(radius)).join(', ');
        errors.push(`${prompt.id}: both lens circles must have radius ${formatNumber(expectedRadius)}; actual radii were [${actual}].`);
    }

    if (radii.every(Number.isFinite) && Math.abs(radii[0] - radii[1]) > 0.12) {
        errors.push(`${prompt.id}: lens circles must have equal radii; actual radii were ${formatNumber(radii[0])} and ${formatNumber(radii[1])}.`);
    }
}

function validateSimpleLensPolygon(ctx, prompt, errors) {
    const pointAId = findNamedPointId(ctx, 'A');
    const pointBId = findNamedPointId(ctx, 'B');
    const lensPolygon = ctx.byType('polygon').find(polygon =>
        Array.isArray(polygon.vertexIds) &&
        polygon.vertexIds.includes(pointAId) &&
        polygon.vertexIds.includes(pointBId)
    );
    if (!lensPolygon) return;

    const vertices = lensPolygon.vertexIds.map(id => resolvePoint(ctx, id, new Set()));
    if (vertices.some(point => !point)) {
        errors.push(`${prompt.id}: lens polygon vertices must resolve to points before visual parity can be checked.`);
        return;
    }

    if (polygonHasSelfIntersection(vertices)) {
        errors.push(`${prompt.id}: lens polygon vertex order self-intersects; order vertices around the lens boundary instead of crossing between arcs.`);
    }
}

function validateLensPolygonBounds(ctx, prompt, bounds, errors) {
    const pointAId = findNamedPointId(ctx, 'A');
    const pointBId = findNamedPointId(ctx, 'B');
    const lensPolygon = ctx.byType('polygon').find(polygon =>
        Array.isArray(polygon.vertexIds) &&
        polygon.vertexIds.includes(pointAId) &&
        polygon.vertexIds.includes(pointBId)
    );
    if (!lensPolygon) return;

    const offenders = lensPolygon.vertexIds
        .map(id => ({ id, point: resolvePoint(ctx, id, new Set()) }))
        .filter(item => item.point)
        .filter(({ point }) => point.x < bounds.xMin || point.x > bounds.xMax ||
            point.y < bounds.yMin || point.y > bounds.yMax);
    if (offenders.length > 0) {
        const ids = offenders.slice(0, 6)
            .map(({ id, point }) => `${id || '(no id)'}(${formatNumber(point.x)},${formatNumber(point.y)})`)
            .join(', ');
        errors.push(`${prompt.id}: lens polygon helper vertices must stay within the requested lens bounds; outside vertex/vertices: ${ids}.`);
    }
}

function validateRequiredLinePatterns(ctx, prompt, patterns, errors) {
    const lines = ctx.byType('line');
    for (const pattern of patterns) {
        const match = lines.find(line => lineMatchesPattern(ctx, line, pattern));
        if (!match) {
            errors.push(`${prompt.id}: expected a ${describeLinePattern(pattern)} line, but no matching line object was found.`);
        }
    }
}

function lineMatchesPattern(ctx, line, pattern) {
    if (pattern.dashed === true && line.dashed !== true) return false;
    const endpoints = linearEndpoints(ctx, line, new Set());
    if (!endpoints) return false;
    const [a, b] = endpoints;
    if (distance(a, b) < 0.2) return false;

    if (pattern.kind === 'vertical') {
        return Math.abs(a.x - pattern.x) <= 0.08 && Math.abs(b.x - pattern.x) <= 0.08;
    }

    if (pattern.kind === 'slopeIntercept') {
        const dx = b.x - a.x;
        if (Math.abs(dx) < 0.08) return false;
        const slope = (b.y - a.y) / dx;
        const interceptA = a.y - slope * a.x;
        const interceptB = b.y - slope * b.x;
        const intercept = (interceptA + interceptB) / 2;
        return Math.abs(slope - pattern.slope) <= 0.08 &&
            Math.abs(intercept - pattern.intercept) <= 0.15;
    }

    return false;
}

function describeLinePattern(pattern) {
    if (pattern.kind === 'vertical') return `vertical x=${formatNumber(pattern.x)}${pattern.dashed ? ' dashed' : ''}`;
    if (pattern.kind === 'slopeIntercept') {
        return `slope ${formatNumber(pattern.slope)}, intercept ${formatNumber(pattern.intercept)}${pattern.dashed ? ' dashed' : ''}`;
    }
    return pattern.kind || 'unknown-pattern';
}

function validateRenderableAngles(ctx, prompt, errors) {
    const badAngles = ctx.byType('angleDimension').filter(angle => {
        const vertex = resolvePoint(ctx, angle.vertexId, new Set());
        const point1 = resolvePoint(ctx, angle.point1Id, new Set());
        const point2 = resolvePoint(ctx, angle.point2Id, new Set());
        if (!vertex || !point1 || !point2) return true;
        const ray1 = distance(vertex, point1);
        const ray2 = distance(vertex, point2);
        if (ray1 < 0.55 || ray2 < 0.55) return true;
        const cosine = dot(
            normalizeVector(subtract(point1, vertex)),
            normalizeVector(subtract(point2, vertex))
        );
        return Math.abs(cosine) > 0.985;
    });

    if (badAngles.length > 0) {
        const ids = badAngles.slice(0, 6).map(angle => angle.id || '(no id)').join(', ');
        errors.push(`${prompt.id}: angleDimension helper points must be far enough from the vertex and form a visible non-degenerate angle; bad angle(s): ${ids}.`);
    }
}

function validatePolygonFillOpacity(ctx, prompt, maxFillOpacity, errors) {
    const filled = ctx.byType('polygon').filter(polygon => {
        const fillOpacity = Number.isFinite(Number(polygon.fillOpacity)) ? Number(polygon.fillOpacity) : 0.12;
        return fillOpacity > maxFillOpacity + 0.001;
    });

    if (filled.length > 0) {
        const ids = filled.slice(0, 6).map(polygon => `${polygon.id || '(no id)'}:${formatNumber(Number.isFinite(Number(polygon.fillOpacity)) ? Number(polygon.fillOpacity) : 0.12)}`).join(', ');
        errors.push(`${prompt.id}: construction polygon(s) should use fillOpacity <= ${formatNumber(maxFillOpacity)}; filled polygon(s): ${ids}.`);
    }
}

function validateInnerPointsWithinFirstSolid(ctx, prompt, solidType, errors) {
    const outer = ctx.byType(solidType)[0];
    if (!outer) return;

    const outerVertexIds = new Set(solidType === 'prism'
        ? [...(outer.baseVertexIds || []), ...(outer.topVertexIds || [])]
        : [outer.apexId, ...(outer.baseVertexIds || [])].filter(Boolean));
    const outerPoints = [...outerVertexIds]
        .map(id => resolvePoint(ctx, id, new Set()))
        .filter(Boolean);
    if (outerPoints.length < 3) return;

    const hull = convexHull(outerPoints);
    const bounds = pointBounds(outerPoints);
    const margin = 0.25;
    const offenders = ctx.byType('point')
        .filter(point => !outerVertexIds.has(point.id))
        .filter(point => {
            const outsideBounds = point.x < bounds.minX - margin ||
                point.x > bounds.maxX + margin ||
                point.y < bounds.minY - margin ||
                point.y > bounds.maxY + margin;
            if (outsideBounds) return true;
            return hull.length >= 3 && !pointInsideConvexHull(point, hull, margin);
        });

    if (offenders.length > 0) {
        const ids = offenders.slice(0, 6).map(point => point.id || '(no id)').join(', ');
        errors.push(`${prompt.id}: inner solid point(s) must stay inside the first ${solidType} projection bounds; outside point(s): ${ids}.`);
    }
}

function validateInnerSolidSeparation(ctx, prompt, minDistance, errors) {
    const outerPrism = ctx.byType('prism')[0];
    const outerPyramid = ctx.byType('pyramid')[0];
    const outerIds = new Set([(outerPrism || outerPyramid)?.id].filter(Boolean));
    const innerSolids = [...ctx.byType('prism'), ...ctx.byType('pyramid')]
        .filter(solid => !outerIds.has(solid.id))
        .map(solid => ({ solid, center: solidProjectionCenter(ctx, solid) }))
        .filter(item => item.center);

    for (let i = 0; i < innerSolids.length; i += 1) {
        for (let j = i + 1; j < innerSolids.length; j += 1) {
            const actual = distance(innerSolids[i].center, innerSolids[j].center);
            if (actual < minDistance) {
                errors.push(`${prompt.id}: inner solids should be visually separated by at least ${formatNumber(minDistance)} units; ${innerSolids[i].solid.id || '(no id)'} and ${innerSolids[j].solid.id || '(no id)'} are ${formatNumber(actual)} apart.`);
            }
        }
    }
}

function validateRequiredPrismVertexCounts(ctx, prompt, requiredCounts, errors) {
    const prismCounts = ctx.byType('prism').map(prism => ({
        id: prism.id || '(no id)',
        base: Array.isArray(prism.baseVertexIds) ? prism.baseVertexIds.length : 0,
        top: Array.isArray(prism.topVertexIds) ? prism.topVertexIds.length : 0
    }));

    for (const requiredCount of requiredCounts) {
        const found = prismCounts.some(count => count.base === requiredCount && count.top === requiredCount);
        if (!found) {
            const actual = prismCounts.map(count => `${count.id}:${count.base}/${count.top}`).join(', ') || '(none)';
            errors.push(`${prompt.id}: expected at least one prism with ${requiredCount} base vertices and ${requiredCount} top vertices; actual prism vertex counts: ${actual}.`);
        }
    }
}

function validatePrismProjections(ctx, prompt, errors) {
    const badPrisms = ctx.byType('prism').filter(prism => {
        const baseIds = Array.isArray(prism.baseVertexIds) ? prism.baseVertexIds : [];
        const topIds = Array.isArray(prism.topVertexIds) ? prism.topVertexIds : [];
        if (baseIds.length < 3 || baseIds.length !== topIds.length) return true;
        const basePoints = baseIds.map(id => resolvePoint(ctx, id, new Set()));
        const topPoints = topIds.map(id => resolvePoint(ctx, id, new Set()));
        if (basePoints.some(point => !point) || topPoints.some(point => !point)) return true;
        if (polygonHasSelfIntersection(basePoints) || polygonHasSelfIntersection(topPoints)) return true;

        const offsets = basePoints.map((point, index) => subtract(topPoints[index], point));
        const averageOffset = averagePoint(offsets);
        const maxDeviation = Math.max(...offsets.map(offset => distance(offset, averageOffset)));
        return maxDeviation > 0.85;
    });

    if (badPrisms.length > 0) {
        const ids = badPrisms.slice(0, 6).map(prism => prism.id || '(no id)').join(', ');
        errors.push(`${prompt.id}: prism top vertices must follow the base vertices in the same translated order without crossed or twisted projection edges; bad prism(s): ${ids}.`);
    }
}

function validateRequiredPyramidBaseVertexCounts(ctx, prompt, rules, errors) {
    const baseCounts = ctx.byType('pyramid').map(pyramid => ({
        id: pyramid.id || '(no id)',
        count: Array.isArray(pyramid.baseVertexIds) ? pyramid.baseVertexIds.length : 0
    }));

    for (const rule of rules) {
        const requiredCount = typeof rule === 'number' ? rule : rule.count;
        const requiredMinimum = typeof rule === 'number' ? 1 : rule.min || 1;
        const actualMinimum = baseCounts.filter(item => item.count === requiredCount).length;
        if (actualMinimum < requiredMinimum) {
            const actual = baseCounts.map(item => `${item.id}:${item.count}`).join(', ') || '(none)';
            errors.push(`${prompt.id}: expected at least ${requiredMinimum} pyramid object(s) with ${requiredCount} base vertices; actual pyramid base counts: ${actual}.`);
        }
    }
}

function validatePyramidApexes(ctx, prompt, errors) {
    const badPyramids = ctx.byType('pyramid').filter(pyramid => {
        if (!pyramid.apexId || !Array.isArray(pyramid.baseVertexIds)) return true;
        if (pyramid.baseVertexIds.includes(pyramid.apexId)) return true;
        const apex = resolvePoint(ctx, pyramid.apexId, new Set());
        const basePoints = pyramid.baseVertexIds.map(id => resolvePoint(ctx, id, new Set())).filter(Boolean);
        if (!apex || basePoints.length < 3) return true;
        return distance(apex, averagePoint(basePoints)) < 0.45;
    });

    if (badPyramids.length > 0) {
        const ids = badPyramids.slice(0, 6).map(pyramid => pyramid.id || '(no id)').join(', ');
        errors.push(`${prompt.id}: pyramid apexId must be a distinct, visible apex outside the base vertex list; bad pyramid(s): ${ids}.`);
    }
}

function solidProjectionCenter(ctx, solid) {
    const vertexIds = solid.type === 'prism'
        ? [...(solid.baseVertexIds || []), ...(solid.topVertexIds || [])]
        : [solid.apexId, ...(solid.baseVertexIds || [])].filter(Boolean);
    const points = vertexIds.map(id => resolvePoint(ctx, id, new Set())).filter(Boolean);
    return points.length > 0 ? averagePoint(points) : null;
}

function circleRadius(ctx, circle) {
    const center = resolvePoint(ctx, circle?.centerId, new Set());
    const radiusPoint = resolvePoint(ctx, circle?.pointOnCircleId, new Set());
    if (!center || !radiusPoint) return NaN;
    return distance(center, radiusPoint);
}

function averagePoint(points) {
    return {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length
    };
}

function pointBounds(points) {
    return {
        minX: Math.min(...points.map(point => point.x)),
        maxX: Math.max(...points.map(point => point.x)),
        minY: Math.min(...points.map(point => point.y)),
        maxY: Math.max(...points.map(point => point.y))
    };
}

function convexHull(points) {
    const unique = [];
    const seen = new Set();
    for (const point of points) {
        const key = `${point.x.toFixed(6)},${point.y.toFixed(6)}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push(point);
        }
    }
    if (unique.length <= 2) return unique;

    const sorted = [...unique].sort((a, b) => a.x - b.x || a.y - b.y);
    const lower = [];
    for (const point of sorted) {
        while (lower.length >= 2 && orientation(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
            lower.pop();
        }
        lower.push(point);
    }

    const upper = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
        const point = sorted[i];
        while (upper.length >= 2 && orientation(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
            upper.pop();
        }
        upper.push(point);
    }

    return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function pointInsideConvexHull(point, hull, margin) {
    for (let i = 0; i < hull.length; i++) {
        const a = hull[i];
        const b = hull[(i + 1) % hull.length];
        const edgeLength = Math.max(distance(a, b), 1e-9);
        const signedDistance = orientation(a, b, point) / edgeLength;
        if (signedDistance < -margin) return false;
    }
    return true;
}

function polygonHasSelfIntersection(vertices) {
    for (let i = 0; i < vertices.length; i += 1) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        for (let j = i + 1; j < vertices.length; j += 1) {
            if (Math.abs(i - j) <= 1) continue;
            if (i === 0 && j === vertices.length - 1) continue;
            const c = vertices[j];
            const d = vertices[(j + 1) % vertices.length];
            if (segmentsIntersect(a, b, c, d)) return true;
        }
    }
    return false;
}

function segmentsIntersect(a, b, c, d) {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    const tolerance = 1e-8;

    if (Math.abs(o1) <= tolerance && pointOnBoundingBox(c, a, b, tolerance)) return true;
    if (Math.abs(o2) <= tolerance && pointOnBoundingBox(d, a, b, tolerance)) return true;
    if (Math.abs(o3) <= tolerance && pointOnBoundingBox(a, c, d, tolerance)) return true;
    if (Math.abs(o4) <= tolerance && pointOnBoundingBox(b, c, d, tolerance)) return true;

    return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0);
}

function pointOnBoundingBox(point, a, b, tolerance) {
    return point.x >= Math.min(a.x, b.x) - tolerance &&
        point.x <= Math.max(a.x, b.x) + tolerance &&
        point.y >= Math.min(a.y, b.y) - tolerance &&
        point.y <= Math.max(a.y, b.y) + tolerance;
}

function orientation(a, b, point) {
    return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
}

function validateTriangleIncircleContacts(ctx, errors) {
    const triangleIds = namedPointIds(ctx, ['A', 'B', 'C']);
    const explicitTriangleSides = triangleIds
        ? triangleEdges(triangleIds).every(([a, b]) => findSegmentBetween(ctx, a, b))
        : false;
    const polygonTriangleSides = ctx.byType('polygon')
        .filter(polygon => Array.isArray(polygon.vertexIds) && polygon.vertexIds.length === 3)
        .some(polygon => triangleEdges(polygon.vertexIds).every(([a, b]) => findSegmentBetween(ctx, a, b)));

    if (!explicitTriangleSides && !polygonTriangleSides) {
        errors.push('triangle_incircle_contacts: expected finite segment sides for triangle ABC; infinite line objects make contact and right-angle markers visually ambiguous.');
    }

    if (triangleIds) {
        const infiniteSideLines = triangleEdges(triangleIds)
            .filter(([a, b]) => findLineBetween(ctx, a, b));
        if (infiniteSideLines.length > 0) {
            errors.push('triangle_incircle_contacts: triangle sides AB, BC, and CA must be finite segment objects, not infinite line objects.');
        }
    }

    if (!findNamedPointId(ctx, 'I')) {
        errors.push('triangle_incircle_contacts: expected a resolvable incenter point labeled or id "I".');
    }

    if (ctx.byType('circle').length === 0 && ctx.byType('circleThreePoints').length === 0) {
        errors.push('triangle_incircle_contacts: expected a circle object for the incircle.');
    }

    const markers = ctx.byType('rightAngleMarker');
    if (markers.length < 3) {
        errors.push('triangle_incircle_contacts: expected three rightAngleMarker objects at the contact points D, E, and F.');
    }

    const badMarkers = markers.filter(marker => !rightAngleMarkerUsesFinitePerpendicularSegments(ctx, marker));
    if (badMarkers.length > 0) {
        errors.push('triangle_incircle_contacts: each contact rightAngleMarker must reference a radius segment and a finite side segment that are perpendicular at the contact point.');
    }
}

function validateParallelTransversalAngles(ctx, errors) {
    const angleDimensions = ctx.byType('angleDimension');
    if (angleDimensions.length < 6) {
        errors.push('parallel_transversal_angles: expected at least 6 angleDimension objects, one for each angle in two alternate-interior pairs and one corresponding-angle pair.');
    }

    const setup = findParallelTransversalSetup(ctx);
    if (!setup) {
        errors.push('parallel_transversal_angles: expected two parallel line-like objects and one transversal that intersects both.');
        return;
    }

    const badAngles = angleDimensions.filter(angle => !angleDimensionUsesTransversalIntersection(ctx, setup, angle));
    if (badAngles.length > 0) {
        errors.push('parallel_transversal_angles: every angleDimension must use a line/transversal intersection as vertexId and helper points on the two rays.');
    }

    const unstaggeredVertices = angleDimensionGroupsByVertex(angleDimensions)
        .filter(group => group.length > 1)
        .filter(group => uniqueApprox(group.map(angle => Number.isFinite(angle.arcRadius) ? angle.arcRadius : 0.5), 0.04).length < group.length);
    if (unstaggeredVertices.length > 0) {
        errors.push('parallel_transversal_angles: angleDimensions sharing the same vertex must use distinct arcRadius values so the angle markers do not overlap.');
    }

    const valueLabelsShown = angleDimensions.filter(angle => angle.showValue !== false);
    if (valueLabelsShown.length > 0) {
        errors.push('parallel_transversal_angles: set showValue:false on each angleDimension so automatic degree labels do not overlap the angle markers.');
    }
}

function validateHistogramFrequencyPolygon(ctx, errors) {
    const bars = ctx.byType('polygon')
        .map(polygon => rectangleBounds(ctx, polygon))
        .filter(bounds => bounds && nearlyEqual(bounds.minY, 0, 0.1) && bounds.maxY > 0.2)
        .sort((a, b) => a.minX - b.minX);

    if (bars.length < 5) {
        errors.push('histogram_frequency_polygon: expected five rectangular histogram bar polygons.');
        return;
    }

    const firstFive = bars.slice(0, 5);
    for (let index = 0; index < firstFive.length; index += 1) {
        const bar = firstFive[index];
        const expectedMin = index;
        const expectedMax = index + 1;
        if (!nearlyEqual(bar.minX, expectedMin, 0.12) || !nearlyEqual(bar.maxX, expectedMax, 0.12)) {
            errors.push(`histogram_frequency_polygon: bar ${index + 1} should cover class interval [${expectedMin},${expectedMax}], not [${formatNumber(bar.minX)},${formatNumber(bar.maxX)}].`);
        }
    }
}

function validateTriangularPrismHiddenEdges(ctx, errors) {
    const triangularPrism = ctx.byType('prism').find(prism =>
        Array.isArray(prism.baseVertexIds) &&
        Array.isArray(prism.topVertexIds) &&
        prism.baseVertexIds.length === 3 &&
        prism.topVertexIds.length === 3
    );

    if (!triangularPrism) {
        errors.push('triangular_prism_hidden_edges: expected a first-class prism object with three base vertices and three top vertices; hand-drawn dashed/solid segment sets are rejected because hidden-edge visibility is ambiguous.');
    }
}

function buildOperationContext(operations) {
    const creates = operations.filter(operation => operation?.op === 'create');
    const byId = new Map();
    for (const operation of creates) {
        if (typeof operation.id === 'string' && operation.id) {
            byId.set(operation.id, operation);
        }
    }
    return {
        creates,
        byId,
        byType(type) {
            return creates.filter(operation => operation.type === type);
        }
    };
}

function angularSpanForCircleRegion(ctx, region) {
    const circle = ctx.byId.get(region.circleId);
    const center = resolvePoint(ctx, circle?.centerId, new Set());
    const start = resolvePoint(ctx, region.startPointId, new Set());
    const end = resolvePoint(ctx, region.endPointId, new Set());
    if (!center || !start || !end) return NaN;
    if (distance(start, end) < 0.05) return 0;
    const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
    const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
    let span = endAngle - startAngle;
    while (span < 0) span += Math.PI * 2;
    while (span >= Math.PI * 2) span -= Math.PI * 2;
    if (region.mode === 'major') {
        return Math.PI * 2 - span;
    }
    return Math.min(span, Math.PI * 2 - span);
}

function resolvePoint(ctx, id, visited) {
    if (!id || visited.has(id)) return null;
    visited.add(id);
    const operation = ctx.byId.get(id);
    if (!operation) return null;
    if (operation.type === 'point') {
        if (!Number.isFinite(operation.x) || !Number.isFinite(operation.y)) return null;
        return { x: operation.x, y: operation.y };
    }
    if (operation.type === 'pointOnCircle') {
        if (!Number.isFinite(operation.angle)) return null;
        const circle = ctx.byId.get(operation.circleId);
        const center = resolvePoint(ctx, circle?.centerId, visited);
        const radiusPoint = resolvePoint(ctx, circle?.pointOnCircleId, visited);
        if (!center || !radiusPoint) return null;
        const radius = distance(center, radiusPoint);
        if (radius <= 0) return null;
        return {
            x: center.x + radius * Math.cos(operation.angle),
            y: center.y + radius * Math.sin(operation.angle)
        };
    }
    if (operation.type === 'pointOnLine') {
        const line = ctx.byId.get(operation.lineId);
        const endpoints = linearEndpoints(ctx, line, visited);
        if (!endpoints || !Number.isFinite(operation.t)) return null;
        return lerp(endpoints[0], endpoints[1], operation.t);
    }
    if (operation.type === 'midpoint') {
        const object = ctx.byId.get(operation.segmentId);
        const endpoints = linearEndpoints(ctx, object, visited);
        if (!endpoints) return null;
        return midpoint(endpoints[0], endpoints[1]);
    }
    if (operation.type === 'intersection') {
        const object1 = ctx.byId.get(operation.object1Id);
        const object2 = ctx.byId.get(operation.object2Id);
        const endpoints1 = linearEndpoints(ctx, object1, visited);
        const endpoints2 = linearEndpoints(ctx, object2, visited);
        if (!endpoints1 || !endpoints2) return null;
        return lineIntersection(endpoints1, endpoints2);
    }
    return null;
}

function namedPointIds(ctx, names) {
    const ids = names.map(name => findNamedPointId(ctx, name));
    return ids.every(Boolean) ? ids : null;
}

function findNamedPointId(ctx, name) {
    const normalize = value => String(value || '').replace(/\s+/g, '');
    const candidates = ctx.creates.filter(operation =>
        operation.type === 'point' ||
        operation.type === 'pointOnLine' ||
        operation.type === 'pointOnCircle' ||
        operation.type === 'midpoint' ||
        operation.type === 'intersection'
    );
    const found = candidates.find(operation =>
        normalize(operation.id) === name || normalize(operation.label) === name
    );
    return found?.id || null;
}

function triangleEdges(vertexIds) {
    return [
        [vertexIds[0], vertexIds[1]],
        [vertexIds[1], vertexIds[2]],
        [vertexIds[2], vertexIds[0]]
    ];
}

function findSegmentBetween(ctx, id1, id2) {
    return ctx.byType('segment').find(segment => sameEndpointPair(segment, id1, id2));
}

function findLineBetween(ctx, id1, id2) {
    return ctx.byType('line').find(line => sameEndpointPair(line, id1, id2));
}

function sameEndpointPair(operation, id1, id2) {
    return (operation.point1Id === id1 && operation.point2Id === id2) ||
        (operation.point1Id === id2 && operation.point2Id === id1);
}

function rightAngleMarkerUsesFinitePerpendicularSegments(ctx, marker) {
    const vertex = resolvePoint(ctx, marker.vertexId, new Set());
    const object1 = ctx.byId.get(marker.line1Id);
    const object2 = ctx.byId.get(marker.line2Id);
    if (!vertex || object1?.type !== 'segment' || object2?.type !== 'segment') return false;

    const direction1 = directionAtVertex(ctx, object1, vertex, marker.vertexId);
    const direction2 = directionAtVertex(ctx, object2, vertex, marker.vertexId);
    if (!direction1 || !direction2) return false;

    const lengths = magnitude(direction1) * magnitude(direction2);
    if (lengths <= 0) return false;
    return Math.abs(dot(direction1, direction2) / lengths) <= 0.2;
}

function directionAtVertex(ctx, operation, vertex, vertexId) {
    const endpoints = linearEndpoints(ctx, operation, new Set());
    if (!endpoints) return null;
    const [a, b] = endpoints;
    if (operation.point1Id === vertexId) return subtract(b, vertex);
    if (operation.point2Id === vertexId) return subtract(a, vertex);
    if (!pointLiesOnSegmentLine(vertex, a, b, 0.15)) return null;
    return subtract(b, a);
}

function findParallelTransversalSetup(ctx) {
    const lineLikes = ctx.creates
        .filter(operation => ['line', 'segment', 'ray'].includes(operation.type))
        .map(operation => ({ operation, endpoints: linearEndpoints(ctx, operation, new Set()) }))
        .filter(item => item.endpoints && distance(item.endpoints[0], item.endpoints[1]) > 0.1);

    for (let i = 0; i < lineLikes.length; i += 1) {
        for (let j = i + 1; j < lineLikes.length; j += 1) {
            if (!areParallel(lineLikes[i].endpoints, lineLikes[j].endpoints)) continue;
            for (const transversal of lineLikes) {
                if (transversal === lineLikes[i] || transversal === lineLikes[j]) continue;
                if (areParallel(lineLikes[i].endpoints, transversal.endpoints)) continue;
                const intersection1 = lineIntersection(lineLikes[i].endpoints, transversal.endpoints);
                const intersection2 = lineIntersection(lineLikes[j].endpoints, transversal.endpoints);
                if (intersection1 && intersection2 && distance(intersection1, intersection2) > 0.2) {
                    return {
                        parallel1: lineLikes[i],
                        parallel2: lineLikes[j],
                        transversal,
                        intersection1,
                        intersection2
                    };
                }
            }
        }
    }
    return null;
}

function angleDimensionUsesTransversalIntersection(ctx, setup, angle) {
    const vertex = resolvePoint(ctx, angle.vertexId, new Set());
    const point1 = resolvePoint(ctx, angle.point1Id, new Set());
    const point2 = resolvePoint(ctx, angle.point2Id, new Set());
    if (!vertex || !point1 || !point2) return false;

    const atFirst = distance(vertex, setup.intersection1) <= 0.2;
    const atSecond = distance(vertex, setup.intersection2) <= 0.2;
    if (!atFirst && !atSecond) return false;

    const parallelLine = atFirst ? setup.parallel1 : setup.parallel2;
    const onParallel1 = pointLiesOnLine(point1, parallelLine.endpoints, 0.15);
    const onTransversal1 = pointLiesOnLine(point1, setup.transversal.endpoints, 0.15);
    const onParallel2 = pointLiesOnLine(point2, parallelLine.endpoints, 0.15);
    const onTransversal2 = pointLiesOnLine(point2, setup.transversal.endpoints, 0.15);

    return (onParallel1 && onTransversal2) || (onTransversal1 && onParallel2);
}

function angleDimensionGroupsByVertex(angleDimensions) {
    const groups = new Map();
    for (const angle of angleDimensions) {
        if (!groups.has(angle.vertexId)) groups.set(angle.vertexId, []);
        groups.get(angle.vertexId).push(angle);
    }
    return [...groups.values()];
}

function rectangleBounds(ctx, polygon) {
    if (!Array.isArray(polygon.vertexIds) || polygon.vertexIds.length !== 4) return null;
    const points = polygon.vertexIds.map(id => resolvePoint(ctx, id, new Set()));
    if (points.some(point => !point)) return null;

    const xs = uniqueApprox(points.map(point => point.x), 0.08);
    const ys = uniqueApprox(points.map(point => point.y), 0.08);
    if (xs.length !== 2 || ys.length !== 2) return null;

    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
    };
}

function linearEndpoints(ctx, operation, visited) {
    if (!operation) return null;
    if (operation.type === 'segment' || operation.type === 'line') {
        const p1 = resolvePoint(ctx, operation.point1Id, new Set(visited));
        const p2 = resolvePoint(ctx, operation.point2Id, new Set(visited));
        return p1 && p2 ? [p1, p2] : null;
    }
    if (operation.type === 'ray') {
        const p1 = resolvePoint(ctx, operation.originId, new Set(visited));
        const p2 = resolvePoint(ctx, operation.directionPointId, new Set(visited));
        return p1 && p2 ? [p1, p2] : null;
    }
    if (operation.type === 'parallel') {
        const base = linearEndpoints(ctx, ctx.byId.get(operation.baseLineId), new Set(visited));
        const through = resolvePoint(ctx, operation.throughPointId, new Set(visited));
        if (!base || !through) return null;
        const dir = normalizeVector(subtract(base[1], base[0]));
        return dir ? [through, add(through, dir)] : null;
    }
    if (operation.type === 'perpendicular') {
        const base = linearEndpoints(ctx, ctx.byId.get(operation.baseLineId), new Set(visited));
        const through = resolvePoint(ctx, operation.throughPointId, new Set(visited));
        if (!base || !through) return null;
        const dir = normalizeVector(subtract(base[1], base[0]));
        return dir ? [through, add(through, perpendicularVector(dir))] : null;
    }
    if (operation.type === 'perpendicularBisector') {
        const segment = linearEndpoints(ctx, ctx.byId.get(operation.segmentId), new Set(visited));
        if (!segment) return null;
        const mid = midpoint(segment[0], segment[1]);
        const dir = normalizeVector(subtract(segment[1], segment[0]));
        return dir ? [mid, add(mid, perpendicularVector(dir))] : null;
    }
    if (operation.type === 'angleBisector') {
        const line1 = linearEndpoints(ctx, ctx.byId.get(operation.line1Id), new Set(visited));
        const line2 = linearEndpoints(ctx, ctx.byId.get(operation.line2Id), new Set(visited));
        if (!line1 || !line2) return null;
        const vertex = lineIntersection(line1, line2);
        if (!vertex) return null;
        const dir1 = normalizeVector(subtract(line1[1], line1[0]));
        const dir2 = normalizeVector(subtract(line2[1], line2[0]));
        if (!dir1 || !dir2) return null;
        let bisector = normalizeVector(add(dir1, dir2));
        if (!bisector) bisector = perpendicularVector(dir1);
        if (operation.exterior) bisector = perpendicularVector(bisector);
        return [vertex, add(vertex, bisector)];
    }
    return null;
}

function lineIntersection([a, b], [c, d]) {
    const denominator = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denominator) < 1e-9) return null;
    return {
        x: ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) / denominator,
        y: ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) / denominator
    };
}

function areParallel(endpoints1, endpoints2) {
    const v1 = subtract(endpoints1[1], endpoints1[0]);
    const v2 = subtract(endpoints2[1], endpoints2[0]);
    return Math.abs(cross(v1, v2)) <= 0.05 * magnitude(v1) * magnitude(v2);
}

function pointLiesOnSegmentLine(point, a, b, tolerance) {
    if (!pointLiesOnLine(point, [a, b], tolerance)) return false;
    const lengthSquared = squaredDistance(a, b);
    if (lengthSquared <= 0) return false;
    const t = dot(subtract(point, a), subtract(b, a)) / lengthSquared;
    return t >= -0.05 && t <= 1.05;
}

function pointLiesOnLine(point, [a, b], tolerance) {
    const lineLength = distance(a, b);
    if (lineLength <= 0) return false;
    return Math.abs(cross(subtract(b, a), subtract(point, a))) / lineLength <= tolerance;
}

function uniqueApprox(values, tolerance) {
    const sorted = [...values].sort((a, b) => a - b);
    const unique = [];
    for (const value of sorted) {
        if (!unique.some(existing => nearlyEqual(existing, value, tolerance))) {
            unique.push(value);
        }
    }
    return unique;
}

function nearlyEqual(a, b, tolerance) {
    return Math.abs(a - b) <= tolerance;
}

function midpoint(a, b) {
    return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
    };
}

function lerp(a, b, t) {
    return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t
    };
}

function subtract(a, b) {
    return {
        x: a.x - b.x,
        y: a.y - b.y
    };
}

function add(a, b) {
    return {
        x: a.x + b.x,
        y: a.y + b.y
    };
}

function dot(a, b) {
    return a.x * b.x + a.y * b.y;
}

function cross(a, b) {
    return a.x * b.y - a.y * b.x;
}

function magnitude(vector) {
    return Math.hypot(vector.x, vector.y);
}

function normalizeVector(vector) {
    const length = magnitude(vector);
    if (length <= 0) return null;
    return {
        x: vector.x / length,
        y: vector.y / length
    };
}

function perpendicularVector(vector) {
    return {
        x: -vector.y,
        y: vector.x
    };
}

function squaredDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}

function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatNumber(value) {
    return Number.isFinite(value) ? Number(value.toFixed(2)).toString() : String(value);
}

function isQuadraticExpression(expression) {
    const normalized = String(expression || '').replace(/\s+/g, '').toLowerCase();
    return /x\^2|x\*\*2|x\*x|pow\(x,2\)/.test(normalized);
}

async function callPrompt(apiKey, model, prompt, validator) {
    const maxAttempts = Number(process.env.LIVE_AI_MAX_ATTEMPTS || 3);
    const referencePrompt = await buildReferencePrompt(prompt);
    let previousPayload = null;
    let errors = [];
    let lastResult = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const userText = attempt === 1
            ? prompt.promptKo
            : repairPrompt(prompt, previousPayload, errors);
        const requestBody = {
            model,
            input: [
                { role: 'developer', content: developerPrompt(referencePrompt) },
                { role: 'user', content: userText }
            ],
            store: false,
            text: {
                format: GRAPH_OPERATIONS_RESPONSE_FORMAT
            }
        };
        if (/^(gpt-5|o[1-9]|o\d)/.test(model)) {
            requestBody.reasoning = { effort: 'low' };
            requestBody.text.verbosity = 'low';
        }
        requestBody.max_output_tokens = Number(process.env.LIVE_AI_MAX_OUTPUT_TOKENS || 7000);

        const data = await openAIRequest(apiKey, endpoint, {
            method: 'POST',
            body: JSON.stringify(requestBody)
        });
        let parsed;
        try {
            parsed = parsePayload(data);
        } catch (error) {
            errors = [`OpenAI response could not be parsed as complete GraphA JSON: ${error.message}`];
            previousPayload = null;
            lastResult = {
                prompt: reportPrompt(prompt),
                request: {
                    endpoint,
                    model,
                    attempt,
                    userPrompt: userText,
                    developerPrompt: developerPrompt(referencePrompt)
                },
                response: {
                    id: data.id || null,
                    model: data.model || model,
                    rawText: extractOpenAIResponseText(data),
                    payload: { operations: [] }
                },
                validation: {
                    schemaValid: false,
                    referencesValid: false,
                    intentValid: false,
                    runtimeReadable: false,
                    semanticValid: false,
                    valid: false,
                    errors,
                    operationCount: 0
                }
            };
            continue;
        }
        const validation = validatePayload(parsed.payload, validator, prompt);
        lastResult = {
            prompt: reportPrompt(prompt),
            request: {
                endpoint,
                model,
                attempt,
                userPrompt: userText,
                developerPrompt: developerPrompt(referencePrompt)
            },
            response: {
                id: data.id || null,
                model: data.model || model,
                rawText: parsed.rawText,
                payload: parsed.payload
            },
            validation
        };
        if (validation.valid) return lastResult;
        previousPayload = parsed.payload;
        errors = validation.errors;
    }

    return lastResult;
}

function startStaticServer() {
    const server = createServer(async (req, res) => {
        try {
            const rawUrl = new URL(req.url || '/', 'http://127.0.0.1');
            const requested = rawUrl.pathname === '/' ? '/index.html' : decodeURIComponent(rawUrl.pathname);
            const filePath = path.normalize(path.join(repoRoot, requested));
            if (!filePath.startsWith(repoRoot)) {
                res.writeHead(403);
                res.end('Forbidden');
                return;
            }
            const info = await stat(filePath);
            if (!info.isFile()) {
                res.writeHead(404);
                res.end('Not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': mimeTypes.get(path.extname(filePath)) || 'application/octet-stream' });
            res.end(await readFile(filePath));
        } catch {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
    });
}

async function chromiumExecutable() {
    if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE) return process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
    const root = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
    const candidates = [];
    try {
        for (const entry of await readdir(root, { withFileTypes: true })) {
            if (!entry.isDirectory() || !entry.name.startsWith('chromium')) continue;
            candidates.push(
                path.join(root, entry.name, 'chrome-win', 'chrome.exe'),
                path.join(root, entry.name, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
            );
        }
    } catch {
        return null;
    }
    candidates.sort().reverse();
    for (const candidate of candidates) {
        try {
            await access(candidate);
            return candidate;
        } catch {
            // Try the next locally installed browser.
        }
    }
    return null;
}

async function render(results, title = 'Live OpenAI Random MathGraph Smoke') {
    await mkdir(screenshotDir, { recursive: true });
    const { server, url } = await startStaticServer();
    const executablePath = await chromiumExecutable();
    const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const consoleErrors = [];
    try {
        const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
        page.on('console', message => {
            if (message.type() === 'error') consoleErrors.push(message.text());
        });
        await page.goto(url, { waitUntil: 'load' });
        await page.waitForFunction(() => window.app?.objectManager && window.app?.processAIJSON);
        await page.addStyleTag({
            content: '.canvas-controls, .coord-display, #chat-panel { display: none !important; }'
        });
        for (const result of results) {
            const renderResult = await page.evaluate((current) => {
                const app = window.app;
                app.objectManager.clear();
                app.historyManager.clear();
                app.canvas.resetView();
                app.canvas.showGrid = current.prompt.showAxes;
                app.canvas.showXAxis = current.prompt.showAxes;
                app.canvas.showYAxis = current.prompt.showAxes;
                let applyError = null;
                try {
                    app.processAIJSON(JSON.stringify(current.response.payload), {
                        mode: 'recreate',
                        maxOperations: 45
                    });
                    app.render();
                } catch (error) {
                    applyError = error.message;
                    app.render();
                }
                const canvas = document.getElementById('mainCanvas');
                const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
                let nonWhitePixels = 0;
                for (let i = 0; i < pixels.length; i += 4) {
                    if (pixels[i] < 248 || pixels[i + 1] < 248 || pixels[i + 2] < 248) nonWhitePixels += 1;
                }
                const objects = app.objectManager.getAllObjects();
                return {
                    applyError,
                    objectCount: objects.length,
                    visibleObjectCount: objects.filter(object => object.visible !== false).length,
                    nonWhitePixels
                };
            }, result);
            const screenshotPath = path.join(screenshotDir, `${result.prompt.id}.png`);
            await page.locator('#mainCanvas').screenshot({ path: screenshotPath });
            result.render = {
                ...renderResult,
                screenshotPath: asMarkdownPath(screenshotPath),
                rendered: !renderResult.applyError && renderResult.objectCount > 0 && renderResult.nonWhitePixels >= 100
            };
        }

        const contactSheetPath = path.join(outputDir, 'contact-sheet.png');
        const cards = await Promise.all(results.map(async result => {
            const imageData = await readFile(path.resolve(result.render.screenshotPath));
            const imageUrl = `data:image/png;base64,${imageData.toString('base64')}`;
            const labelCount = countRuntimeVisibleLabels(result.response.payload);
            return `
                <figure>
                    <img src="${imageUrl}" alt="${result.prompt.id}">
                    <figcaption>${result.prompt.title}<br>${result.validation.operationCount} ops, ${result.render.objectCount} objects, ${labelCount} labels</figcaption>
                </figure>
            `;
        }));
        await page.setContent(`
            <!doctype html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    body { margin: 0; padding: 20px; font-family: Arial, sans-serif; background: #f5f5f5; color: #111; }
                    h1 { margin: 0 0 16px; font-size: 20px; }
                    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
                    figure { margin: 0; background: #fff; border: 1px solid #ddd; padding: 8px; }
                    img { display: block; width: 100%; height: auto; border: 1px solid #eee; }
                    figcaption { padding-top: 6px; font-size: 12px; line-height: 1.35; }
                </style>
            </head>
            <body>
                <h1>${escapeHtml(title)}</h1>
                <div class="grid">${cards.join('\n')}</div>
            </body>
            </html>
        `, { waitUntil: 'load' });
        await page.screenshot({ path: contactSheetPath, fullPage: true });
        return {
            contactSheetPath: asMarkdownPath(contactSheetPath),
            consoleErrors
        };
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function report(meta, results) {
    const lines = [
        '# Live OpenAI Random MathGraph Smoke',
        '',
        `- generatedAt: ${meta.generatedAt}`,
        `- endpoint: ${endpoint}`,
        `- model: ${meta.model}`,
        `- promptSet: ${meta.promptSet}`,
        '- apiKey: provided via OPENAI_API_KEY, not written to this report',
        `- contactSheet: ${meta.contactSheetPath}`,
        '',
        'This report records real OpenAI Responses API calls, local GraphA validation, and browser canvas render results.',
        ''
    ];
    for (const result of results) {
        lines.push(`## ${result.prompt.id}`);
        lines.push('');
        lines.push(`- title: ${result.prompt.title}`);
        lines.push(`- responseId: ${result.response.id}`);
        lines.push(`- attempt: ${result.request.attempt}`);
        lines.push(`- validation: schema=${result.validation.schemaValid}, references=${result.validation.referencesValid}, intent=${result.validation.intentValid}, runtime=${result.validation.runtimeReadable}, semantic=${result.validation.semanticValid}`);
        lines.push(`- visibleLabels: ${countRuntimeVisibleLabels(result.response.payload)}`);
        lines.push(`- render: rendered=${result.render?.rendered}, objects=${result.render?.objectCount}, nonWhitePixels=${result.render?.nonWhitePixels}`);
        lines.push(`- screenshot: ${result.render?.screenshotPath}`);
        if (result.validation.errors.length > 0) {
            lines.push(`- validationErrors: ${result.validation.errors.join(' | ')}`);
        }
        lines.push('');
        lines.push('### Prompt', '', '```text', result.prompt.promptKo, '```', '');
        lines.push('### Operations', '', '```json', JSON.stringify(result.response.payload, null, 2), '```', '');
    }
    return lines.join('\n');
}

function referenceTargetReport(meta, results) {
    const lines = [
        '# Local Reference MathGraph Targets',
        '',
        `- generatedAt: ${meta.generatedAt}`,
        `- promptSet: ${meta.promptSet}`,
        `- contactSheet: ${meta.contactSheetPath}`,
        '',
        'This report records deterministic local GraphA reference targets for visual comparison. It does not record OpenAI API calls.',
        ''
    ];
    for (const result of results) {
        lines.push(`## ${result.prompt.id}`);
        lines.push('');
        lines.push(`- title: ${result.prompt.title}`);
        lines.push(`- validation: schema=${result.validation.schemaValid}, references=${result.validation.referencesValid}, intent=${result.validation.intentValid}, runtime=${result.validation.runtimeReadable}, semantic=${result.validation.semanticValid}`);
        lines.push(`- visibleLabels: ${countRuntimeVisibleLabels(result.response.payload)}`);
        lines.push(`- render: rendered=${result.render?.rendered}, objects=${result.render?.objectCount}, nonWhitePixels=${result.render?.nonWhitePixels}`);
        lines.push(`- screenshot: ${result.render?.screenshotPath}`);
        if (result.validation.errors.length > 0) {
            lines.push(`- validationErrors: ${result.validation.errors.join(' | ')}`);
        }
        lines.push('');
        lines.push('### Prompt', '', '```text', result.prompt.promptKo, '```', '');
        lines.push('### Reference Operations', '', '```json', JSON.stringify(result.response.payload, null, 2), '```', '');
    }
    return lines.join('\n');
}

async function main() {
    await mkdir(outputDir, { recursive: true });
    const validator = new SchemaValidator();

    if (process.env.LIVE_AI_REVALIDATE_RESULTS) {
        await revalidateSavedResults(validator, process.env.LIVE_AI_REVALIDATE_RESULTS);
        return;
    }

    if (process.env.LIVE_AI_RENDER_REFERENCE_TARGETS) {
        await renderReferenceTargets(validator);
        return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is required.');

    const model = await chooseModel(apiKey);
    const promptSet = getPromptSet();
    const limit = Number(process.env.LIVE_AI_SAMPLE_LIMIT || promptSet.prompts.length);
    const selectedPrompts = promptSet.prompts.slice(0, limit);
    const results = [];

    for (const prompt of selectedPrompts) {
        console.log(`Calling OpenAI for ${prompt.id} with ${model}...`);
        results.push(await callPrompt(apiKey, model, prompt, validator));
    }

    const renderMeta = await render(results);
    const meta = {
        generatedAt: new Date().toISOString(),
        endpoint,
        model,
        promptSet: promptSet.name,
        promptCount: results.length,
        contactSheetPath: renderMeta.contactSheetPath,
        consoleErrorCount: renderMeta.consoleErrors.length,
        consoleErrors: renderMeta.consoleErrors
    };
    const resultPath = path.join(outputDir, 'live-openai-random-results.json');
    const reportPath = path.join(outputDir, 'live-openai-random-report.md');
    await writeFile(resultPath, JSON.stringify({ meta, results }, null, 2), 'utf8');
    await writeFile(reportPath, report(meta, results), 'utf8');

    const failures = results.filter(result =>
        !result.validation.valid ||
        !result.render?.rendered
    );

    console.log(JSON.stringify({
        meta,
        resultPath: asMarkdownPath(resultPath),
        reportPath: asMarkdownPath(reportPath),
        screenshotDir: asMarkdownPath(screenshotDir),
        failures: failures.map(result => result.prompt.id)
    }, null, 2));

    if (failures.length > 0 || renderMeta.consoleErrors.length > 0) {
        process.exit(1);
    }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
    main().catch(error => {
        console.error(error.message);
        process.exit(1);
    });
}
