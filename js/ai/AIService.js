/**
 * AIService.js - AI 서비스 모듈 (Mk.2)
 * 
 * LLM API를 통해 자연어를 그래프A JSON 명령으로 변환합니다.
 * 지원: OpenAI, Google Gemini
 */

import { parseAIJSONPayload } from './JSONUtils.js';
import { SchemaValidator } from './SchemaValidator.js';
import { enhanceDiagramQuality } from './DiagramQualityEnhancer.js';

export const DEFAULT_OPENAI_MODEL = 'gpt-5.5';

export const IMAGE_RECREATE_OPERATION_BUDGET = 45;
export const OPENAI_IMAGE_FAST_MODEL = 'gpt-5.4-mini';
export const AI_IMAGE_PREPROCESS_MAX_LONG_EDGE = 1800;
export const AI_IMAGE_PREPROCESS_MIN_LONG_EDGE = 1200;
export const AI_IMAGE_PREPROCESS_MIN_CROP_LONG_EDGE = 900;
export const AI_IMAGE_PREPROCESS_CROP_PADDING_RATIO = 0.06;
export const AI_IMAGE_PREPROCESS_JPEG_QUALITY = 0.92;

export const OPENAI_MODEL_OPTIONS = [
    { value: 'gpt-5.5', label: 'GPT-5.5 (권장)' },
    { value: 'gpt-5.5-pro', label: 'GPT-5.5 Pro (고난도/느림)' },
    { value: 'gpt-5.4', label: 'GPT-5.4 (균형)' },
    { value: 'gpt-5.4-mini', label: 'GPT-5.4 Mini (빠름/저렴)' },
    { value: 'gpt-5.4-nano', label: 'GPT-5.4 Nano (최저 비용)' }
];

export const GEMINI_MODEL_OPTIONS = [
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' }
];

const OPENAI_MODEL_ROUTING_RANK = {
    'gpt-5.4-nano': 1,
    'gpt-5.4-mini': 2,
    'gpt-5.4': 3,
    'gpt-5.5': 4,
    'gpt-5.5-pro': 5
};

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function normalizePositiveInteger(value, fallback = 1) {
    const number = Math.round(Number(value));
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeCropBounds(cropBounds, width, height, options = {}) {
    if (!cropBounds) {
        return {
            x: 0,
            y: 0,
            width,
            height,
            applied: false
        };
    }

    const paddingRatio = Number.isFinite(options.cropPaddingRatio)
        ? options.cropPaddingRatio
        : AI_IMAGE_PREPROCESS_CROP_PADDING_RATIO;
    const rawX = Number(cropBounds.x);
    const rawY = Number(cropBounds.y);
    const rawWidth = Number(cropBounds.width);
    const rawHeight = Number(cropBounds.height);
    if (![rawX, rawY, rawWidth, rawHeight].every(Number.isFinite) || rawWidth <= 0 || rawHeight <= 0) {
        return {
            x: 0,
            y: 0,
            width,
            height,
            applied: false
        };
    }

    const padding = Math.max(12, Math.round(Math.max(rawWidth, rawHeight) * paddingRatio));
    const x = clampNumber(Math.floor(rawX - padding), 0, width - 1);
    const y = clampNumber(Math.floor(rawY - padding), 0, height - 1);
    const right = clampNumber(Math.ceil(rawX + rawWidth + padding), x + 1, width);
    const bottom = clampNumber(Math.ceil(rawY + rawHeight + padding), y + 1, height);
    const cropWidth = right - x;
    const cropHeight = bottom - y;
    const minCropLongEdge = normalizePositiveInteger(
        options.minCropLongEdge,
        AI_IMAGE_PREPROCESS_MIN_CROP_LONG_EDGE
    );
    const cropLongEdge = Math.max(cropWidth, cropHeight);
    const originalLongEdge = Math.max(width, height);
    const cropAreaRatio = (cropWidth * cropHeight) / (width * height);
    const areaSavingRatio = 1 - cropAreaRatio;
    const cropChangesImage = areaSavingRatio >= 0.04
        && (cropWidth < width - 4 || cropHeight < height - 4);
    const keepsReadablePixels = cropLongEdge >= Math.min(minCropLongEdge, originalLongEdge);

    if (!cropChangesImage || !keepsReadablePixels) {
        return {
            x: 0,
            y: 0,
            width,
            height,
            applied: false
        };
    }

    return {
        x,
        y,
        width: cropWidth,
        height: cropHeight,
        applied: true
    };
}

export function chooseImagePreprocessPlan(imageSize, cropBounds = null, options = {}) {
    const originalWidth = normalizePositiveInteger(imageSize?.width);
    const originalHeight = normalizePositiveInteger(imageSize?.height);
    const maxLongEdge = normalizePositiveInteger(
        options.maxLongEdge,
        AI_IMAGE_PREPROCESS_MAX_LONG_EDGE
    );
    const minLongEdge = normalizePositiveInteger(
        options.minLongEdge,
        AI_IMAGE_PREPROCESS_MIN_LONG_EDGE
    );
    const crop = normalizeCropBounds(cropBounds, originalWidth, originalHeight, options);
    const cropLongEdge = Math.max(crop.width, crop.height);
    const targetLongEdge = cropLongEdge > maxLongEdge
        ? Math.min(cropLongEdge, Math.max(maxLongEdge, minLongEdge))
        : cropLongEdge;
    const scale = targetLongEdge / cropLongEdge;
    const processedWidth = Math.max(1, Math.round(crop.width * scale));
    const processedHeight = Math.max(1, Math.round(crop.height * scale));

    return {
        originalWidth,
        originalHeight,
        crop,
        scale,
        resized: scale < 0.999,
        processedWidth,
        processedHeight,
        maxLongEdge,
        minLongEdge
    };
}

const GRAPH_OPERATION_TYPES = [
    'point', 'pointOnLine', 'pointOnCircle', 'circleCenterPoint',
    'segment', 'line', 'ray', 'circle', 'circleThreePoints',
    'intersection', 'midpoint', 'parallel', 'perpendicular',
    'perpendicularBisector', 'angleBisector', 'tangentCircle', 'tangentFunction', 'function',
    'vector', 'rightAngleMarker', 'equalLengthMarker',
    'angleDimension', 'lengthDimension',
    'arc', 'sector', 'circularSegment',
    'lensRegion', 'polygon', 'prism', 'pyramid', 'numberLine'
];

const NULLABLE_STRING = { type: ['string', 'null'] };
const NULLABLE_NUMBER = { type: ['number', 'null'] };
const NULLABLE_BOOLEAN = { type: ['boolean', 'null'] };

const customMarkSchema = {
    type: 'object',
    properties: {
        value: NULLABLE_NUMBER,
        label: NULLABLE_STRING
    },
    required: ['value', 'label'],
    additionalProperties: false
};

const operationProperties = {
    op: {
        type: 'string',
        enum: ['create', 'update', 'delete'],
        description: 'Operation to apply to the graph model.'
    },
    id: {
        ...NULLABLE_STRING,
        description: 'Stable temporary or existing object id. Required for update/delete and recommended for create.'
    },
    type: {
        type: ['string', 'null'],
        enum: [...GRAPH_OPERATION_TYPES, null],
        description: 'Object type for create operations. Use null for update/delete operations.'
    },
    label: NULLABLE_STRING,
    x: NULLABLE_NUMBER,
    y: NULLABLE_NUMBER,
    point1Id: NULLABLE_STRING,
    point2Id: NULLABLE_STRING,
    point3Id: NULLABLE_STRING,
    centerId: NULLABLE_STRING,
    pointOnCircleId: NULLABLE_STRING,
    originId: NULLABLE_STRING,
    directionPointId: NULLABLE_STRING,
    lineId: NULLABLE_STRING,
    circleId: NULLABLE_STRING,
    circle1Id: NULLABLE_STRING,
    circle2Id: NULLABLE_STRING,
    segmentId: NULLABLE_STRING,
    object1Id: NULLABLE_STRING,
    object2Id: NULLABLE_STRING,
    baseLineId: NULLABLE_STRING,
    throughPointId: NULLABLE_STRING,
    startPointId: NULLABLE_STRING,
    endPointId: NULLABLE_STRING,
    functionId: NULLABLE_STRING,
    vertexId: NULLABLE_STRING,
    line1Id: NULLABLE_STRING,
    line2Id: NULLABLE_STRING,
    segment1Id: NULLABLE_STRING,
    segment2Id: NULLABLE_STRING,
    tangentPointId: NULLABLE_STRING,
    apexId: NULLABLE_STRING,
    expression: NULLABLE_STRING,
    mode: {
        type: ['string', 'null'],
        enum: ['minor', 'major', null]
    },
    baseVertexIds: {
        type: ['array', 'null'],
        items: { type: 'string' }
    },
    topVertexIds: {
        type: ['array', 'null'],
        items: { type: 'string' }
    },
    vertexIds: {
        type: ['array', 'null'],
        items: { type: 'string' }
    },
    start: NULLABLE_NUMBER,
    end: NULLABLE_NUMBER,
    step: NULLABLE_NUMBER,
    showArrows: NULLABLE_BOOLEAN,
    tickHeight: NULLABLE_NUMBER,
    customMarks: {
        type: ['array', 'null'],
        items: customMarkSchema
    },
    color: NULLABLE_STRING,
    visible: NULLABLE_BOOLEAN,
    lineWidth: NULLABLE_NUMBER,
    pointSize: NULLABLE_NUMBER,
    fontSize: NULLABLE_NUMBER,
    arcRadius: NULLABLE_NUMBER,
    showValue: NULLABLE_BOOLEAN,
    markerCount: NULLABLE_NUMBER,
    customText: NULLABLE_STRING,
    labelFontSize: NULLABLE_NUMBER,
    dashed: NULLABLE_BOOLEAN,
    fillColor: NULLABLE_STRING,
    fillOpacity: NULLABLE_NUMBER,
    showLabel: NULLABLE_BOOLEAN,
    locked: NULLABLE_BOOLEAN,
    t: NULLABLE_NUMBER,
    angle: NULLABLE_NUMBER,
    labelOffset: {
        type: ['object', 'null'],
        properties: {
            x: NULLABLE_NUMBER,
            y: NULLABLE_NUMBER
        },
        required: ['x', 'y'],
        additionalProperties: false
    }
};

export const GRAPH_OPERATIONS_JSON_SCHEMA = {
    type: 'object',
    properties: {
        operations: {
            type: 'array',
            items: {
                type: 'object',
                properties: operationProperties,
                required: Object.keys(operationProperties),
                additionalProperties: false
            }
        }
    },
    required: ['operations'],
    additionalProperties: false
};

export const GRAPH_OPERATIONS_RESPONSE_FORMAT = {
    type: 'json_schema',
    name: 'graph_operations',
    description: 'GraphA patch operations for creating, updating, or deleting graph objects.',
    strict: true,
    schema: GRAPH_OPERATIONS_JSON_SCHEMA
};

export function stripNullFields(value) {
    if (Array.isArray(value)) {
        return value.map(item => stripNullFields(item));
    }

    if (!value || typeof value !== 'object') {
        return value;
    }

    const cleaned = {};
    for (const [key, item] of Object.entries(value)) {
        if (item === null || item === undefined) {
            continue;
        }
        cleaned[key] = stripNullFields(item);
    }
    return cleaned;
}

export function extractOpenAIResponseText(data) {
    if (!data || typeof data !== 'object') {
        return '';
    }

    if (data.output_parsed !== undefined) {
        return JSON.stringify(data.output_parsed);
    }

    if (typeof data.output_text === 'string') {
        return data.output_text;
    }

    let content = '';
    if (Array.isArray(data.output)) {
        for (const item of data.output) {
            if (item.type === 'message' && Array.isArray(item.content)) {
                for (const block of item.content) {
                    if (block.type === 'output_text' && typeof block.text === 'string') {
                        content += block.text;
                    }
                }
            }
        }
    }

    return content;
}

// AI 참조 문서에서 가져온 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 수학 기하 도형을 생성하는 AI 어시스턴트입니다.
사용자의 요청을 분석하여 아래 JSON 스키마에 맞는 **구조화된 출력만** 생성합니다.

## 중요 규칙
1. JSON만 출력하세요. "그렸습니다" 같은 텍스트 없이 순수 JSON만 출력합니다.
2. 참조 순서를 준수하세요. 참조되는 객체(점)가 먼저 정의되어야 합니다.
3. 정수 좌표를 권장합니다. 예: (2, 0), (-3, 5)
4. 필수 필드를 포함하세요.
5. 기본 도형 색상은 #000000입니다. 사용자가 색을 명시적으로 요청하지 않으면 여러 색을 넣지 마세요.
6. Visual fidelity guardrails:
   - For two-circle lens overlaps, use lensRegion with circle1Id and circle2Id. Do not approximate this with a polygon unless lensRegion is unavailable.
   - For construction-only polygons that should look like outlines, set fillOpacity:0. Use fillOpacity above 0 only for requested shaded regions.
   - For angleDimension, point1Id and point2Id must be distinct from vertexId and far enough away to render a visible, non-degenerate angle arc.
   - For prism objects, use baseVertexIds for the near/front face and topVertexIds for the shifted rear face so visible front edges stay solid and hidden rear edges become dashed.
   - For pyramid objects, apexId must not be included in baseVertexIds and the apex must be visually separated from the base centroid.
   - For nested solids, keep inner vertices inside the outer projection and separate multiple inner solids so they do not overlap visually.
   - Hide helper points with visible:false when they only shape a region.

## JSON 스키마

### 출력 형식
{
  "operations": [
    { "op": "create", "type": "point", "id": "p1", "x": 0, "y": 0, "label": "A" },
    { "op": "create", "type": "segment", "id": "s1", "point1Id": "p1", "point2Id": "p2" }
  ]
}

### 지원 타입별 필수 필드
- point: x, y (좌표)
- pointOnLine: lineId, t (0~1 권장)
- pointOnCircle: circleId, angle
- pointOnCircle uses angle in radians. Never use t for pointOnCircle.
- circleCenterPoint: circleId
- segment, line: point1Id, point2Id
- ray: originId, directionPointId  
- circle: centerId, pointOnCircleId
- circleThreePoints: point1Id, point2Id, point3Id
- intersection: object1Id, object2Id
- midpoint: segmentId
- parallel: baseLineId, throughPointId
- perpendicular: baseLineId, throughPointId
- perpendicularBisector: segmentId
- angleBisector: line1Id, line2Id
- tangentCircle: circleId, tangentPointId
- tangentFunction: functionId, x
- function: expression (예: "x^2 - 2*x + 1")
- function expression is the right-hand side only. Never include "y=".
- vector: startPointId, endPointId
- rightAngleMarker: vertexId, line1Id, line2Id
- equalLengthMarker: segment1Id, segment2Id
- angleDimension: vertexId, point1Id, point2Id (optional arcRadius, showValue, markerCount, customText, labelOffset)
- lengthDimension: segmentId
- polygon: vertexIds (array of at least 3 point IDs)
- lensRegion: circle1Id, circle2Id (filled intersection of two circles)
- arc, sector, circularSegment: circleId, startPointId, endPointId, mode ("minor" 또는 "major")
- prism: baseVertexIds (배열), topVertexIds (배열) - 각기둥
- pyramid: baseVertexIds (배열), apexId - 각뿔
- numberLine: start, end, step, y

### 선택적 공통 속성
- label: 객체 이름
- color: 색상 (HEX, 기본 예: "#000000")
- lineWidth: 선 굵기 (1-5)
- dashed: 점선 여부

## 예시

### 삼각형 ABC
{
  "operations": [
    { "op": "create", "type": "point", "id": "p1", "x": 0, "y": 0, "label": "A" },
    { "op": "create", "type": "point", "id": "p2", "x": 4, "y": 0, "label": "B" },
    { "op": "create", "type": "point", "id": "p3", "x": 2, "y": 3, "label": "C" },
    { "op": "create", "type": "polygon", "id": "poly1", "vertexIds": ["p1", "p2", "p3"], "fillColor": "#000000", "fillOpacity": 0.12 }
  ]
}

### 외접원이 있는 삼각형
{
  "operations": [
    { "op": "create", "type": "point", "id": "p1", "x": 0, "y": 0, "label": "A" },
    { "op": "create", "type": "point", "id": "p2", "x": 4, "y": 0, "label": "B" },
    { "op": "create", "type": "point", "id": "p3", "x": 2, "y": 3, "label": "C" },
    { "op": "create", "type": "polygon", "id": "poly1", "vertexIds": ["p1", "p2", "p3"], "fillColor": "#000000", "fillOpacity": 0.12 },
    { "op": "create", "type": "circleThreePoints", "id": "c1", "point1Id": "p1", "point2Id": "p2", "point3Id": "p3", "label": "외접원" }
  ]
}

### 삼각기둥
{
  "operations": [
    { "op": "create", "type": "point", "id": "a", "x": 0, "y": 0, "label": "A" },
    { "op": "create", "type": "point", "id": "b", "x": 4, "y": 0, "label": "B" },
    { "op": "create", "type": "point", "id": "c", "x": 2, "y": -2, "label": "C" },
    { "op": "create", "type": "point", "id": "ap", "x": 1, "y": 3, "label": "A'" },
    { "op": "create", "type": "point", "id": "bp", "x": 5, "y": 3, "label": "B'" },
    { "op": "create", "type": "point", "id": "cp", "x": 3, "y": 1, "label": "C'" },
    { "op": "create", "type": "prism", "id": "prism1", "baseVertexIds": ["a", "b", "c"], "topVertexIds": ["ap", "bp", "cp"] }
  ]
}

### 사각뿔
{
  "operations": [
    { "op": "create", "type": "point", "id": "a", "x": -2, "y": -1, "label": "A" },
    { "op": "create", "type": "point", "id": "b", "x": 2, "y": -1, "label": "B" },
    { "op": "create", "type": "point", "id": "c", "x": 3, "y": 1, "label": "C" },
    { "op": "create", "type": "point", "id": "d", "x": -1, "y": 1, "label": "D" },
    { "op": "create", "type": "point", "id": "v", "x": 0, "y": 4, "label": "V" },
    { "op": "create", "type": "pyramid", "id": "pyr1", "baseVertexIds": ["a", "b", "c", "d"], "apexId": "v" }
  ]
}

이제 사용자 요청에 맞는 JSON을 생성하세요.`;

export const DEFAULT_IMAGE_RECREATE_INSTRUCTION =
    '사진 전체에 보이는 수학 도식, 그래프, 그림, 라벨, 보조선, 음영을 GraphA 객체로 정확하게 재구성해줘.';

export const PROBLEM_SITUATION_GRAPH_GUIDANCE = [
    '작업 모드: 문제 상황 그래프 생성.',
    '사용자 입력은 짧은 그리기 명령이 아니라 수학 문제 전문일 수 있습니다.',
    '문제를 풀거나 정답을 말하지 말고, 문제 상황을 이해하는 데 쓸 수 있는 GraphA 그래프/도식만 생성하세요.',
    '문제에서 변수, 좌표축, 함수식, 방정식, 부등식, 수직선, 도형 조건, 길이/각/접선/교점/음영 조건을 추출하세요.',
    '명시된 그림이 없더라도 조건을 설명하는 데 가장 유용한 좌표평면 그래프, 함수 그래프, 수직선, 기하 도식, 또는 영역 그림을 선택하세요.',
    '문제 본문, 선택지, 긴 설명 문장은 객체로 복사하지 말고, 도식 이해에 필요한 점 이름, 축 이름, 짧은 라벨, 함수식만 사용하세요.',
    '조건이 모호하면 정확한 수치가 주어진 요소를 우선 그리고, 남은 요소는 수학적으로 자연스러운 대표 배치로 구성하세요.'
].join('\n');

/**
 * AI 서비스 설정
 */
export class AIServiceConfig {
    constructor() {
        this.provider = 'openai'; // 'openai' | 'gemini' | 'local'
        this.apiKey = '';
        this.model = DEFAULT_OPENAI_MODEL;
        this.reasoningEffort = 'low'; // none, minimal, low, medium, high, xhigh
        this.verbosity = 'low'; // low, medium, high
    }

    static fromStorage() {
        const config = new AIServiceConfig();
        try {
            const saved = localStorage.getItem('graphA_ai_config');
            if (saved) {
                const data = JSON.parse(saved);
                Object.assign(config, data);
            }
        } catch (e) {
            console.warn('AI 설정 로드 실패:', e);
        }
        return config;
    }

    save() {
        try {
            localStorage.setItem('graphA_ai_config', JSON.stringify(this));
        } catch (e) {
            console.warn('AI 설정 저장 실패:', e);
        }
    }
}

/**
 * AI 서비스
 */
export class AIService {
    constructor(config = null) {
        this.config = config
            ? Object.assign(new AIServiceConfig(), config)
            : AIServiceConfig.fromStorage();
        this.conversationHistory = [];
        this.lastResponseId = null;
        this.schemaValidator = new SchemaValidator();
        this.drawingReferenceIndex = this.config.drawingReferenceIndex || this.config.referenceIndex || null;
        this.drawingFeatureManual = this.config.drawingFeatureManual || this.config.referenceManual || null;
        this.drawingReferenceLoadPromise = null;
    }

    /**
     * API 키 설정
     */
    setApiKey(apiKey) {
        this.config.apiKey = apiKey;
        this.config.save();
    }

    /**
     * 프로바이더 설정
     */
    setProvider(provider) {
        this.config.provider = provider;
        // 프로바이더별 기본 모델
        if (provider === 'openai') {
            this.config.model = DEFAULT_OPENAI_MODEL;
        } else if (provider === 'gemini') {
            this.config.model = 'gemini-1.5-flash';
        }
        this.config.save();
    }

    /**
     * 자연어를 JSON 명령으로 변환
     * @param {string} userMessage - 사용자 입력
     * @param {object} context - 현재 캔버스 상태 (옵션)
     * @returns {Promise<{success: boolean, json?: object, message?: string, error?: string}>}
     */
    async processCommand(userMessage, context = null) {
        const normalizedMessage = typeof userMessage === 'string' ? userMessage.trim() : '';
        if (!normalizedMessage) {
            return { success: false, error: '명령이 비어 있습니다.' };
        }

        // 사용자 메시지를 히스토리에 추가
        this.conversationHistory.push({ role: 'user', content: normalizedMessage });

        // 히스토리가 너무 길어지면 오래된 것 제거
        if (this.conversationHistory.length > 20) {
            this.conversationHistory = this.conversationHistory.slice(-10);
        }

        if (!this.config.apiKey || this.config.provider === 'local') {
            return this.enhanceProcessResult(
                this.fallbackProcess(normalizedMessage, context),
                normalizedMessage,
                context,
                'command'
            );
        }

        try {
            const messages = await this.buildMessagesWithReferences(normalizedMessage, context);

            let response;
            if (this.config.provider === 'openai') {
                response = await this.callOpenAI(messages);
            } else if (this.config.provider === 'gemini') {
                response = await this.callGemini(messages);
            } else {
                return this.enhanceProcessResult(
                    this.fallbackProcess(normalizedMessage, context),
                    normalizedMessage,
                    context,
                    'command'
                );
            }

            // JSON 파싱
            const json = this.extractJSON(response);
            if (json) {
                return this.enhanceProcessResult(
                    { success: true, json, message: response },
                    normalizedMessage,
                    context,
                    'command'
                );
            } else {
                return this.enhanceProcessResult(
                    this.fallbackProcess(normalizedMessage, context),
                    normalizedMessage,
                    context,
                    'command'
                );
            }
        } catch (error) {
            console.error('AI 처리 오류:', error);
            return this.enhanceProcessResult(
                this.fallbackProcess(normalizedMessage, context),
                normalizedMessage,
                context,
                'command'
            );
        }
    }

    /**
     * 메시지 배열 구성
     */
    buildMessages(userMessage, context) {
        const messages = [
            { role: 'system', content: SYSTEM_PROMPT }
        ];

        // 현재 캔버스 상태 컨텍스트 추가
        const contextStr = this.buildCanvasContextPrompt(context);
        if (contextStr) {
            messages.push({ role: 'system', content: contextStr });
        }

        const problemSituationPrompt = this.buildProblemSituationPrompt(userMessage);
        if (problemSituationPrompt) {
            messages.push({ role: 'system', content: problemSituationPrompt });
        }

        // 대화 히스토리 추가 (최근 4개만)
        const recentHistory = this.conversationHistory.slice(-4);
        messages.push(...recentHistory);

        // 현재 사용자 메시지
        messages.push({ role: 'user', content: userMessage });

        return messages;
    }

    async buildMessagesWithReferences(userMessage, context) {
        const messages = this.buildMessages(userMessage, context);
        const referenceRequestText = this.isLikelyProblemStatement(userMessage)
            ? `problem_situation\n${userMessage}`
            : userMessage;
        const referencePrompt = await this.buildDrawingReferencePrompt(referenceRequestText, context, 'command');
        if (referencePrompt) {
            messages.splice(1, 0, { role: 'system', content: referencePrompt });
        }
        return messages;
    }

    buildProblemSituationPrompt(userMessage) {
        if (!this.isLikelyProblemStatement(userMessage)) {
            return '';
        }

        return PROBLEM_SITUATION_GRAPH_GUIDANCE;
    }

    isLikelyProblemStatement(userMessage) {
        const text = String(userMessage || '').trim();
        if (!text) {
            return false;
        }

        const compact = text.replace(/\s+/g, ' ');
        const lineCount = text.split(/\r?\n/).filter(line => line.trim()).length;
        const sentenceBreakCount = (text.match(/[.?!。？！]|[가-힣]\)|\d+[.)]/g) || []).length;
        const longEnough = compact.length >= 80 || lineCount >= 3 || sentenceBreakCount >= 3;
        if (!longEnough) {
            return false;
        }

        const markerPatterns = [
            /문제|다음|아래|위\s*그림|그림과\s*같이|조건|보기|선택지|좌표평면|도형|그래프|표/,
            /구하|구하여라|찾으|나타내|설명|만족|지나|접하|만나|교점|넓이|둘레|부피|최댓값|최솟값/,
            /함수|일차|이차|직선|포물선|원|삼각형|사각형|다각형|수직선|부등식|방정식|확률|통계/,
            /[xy]\s*[=+\-^]|[<>]=?|√|제곱근|근호|\b\d+\s*차\b/
        ];
        const markerScore = markerPatterns.reduce((score, pattern) => score + (pattern.test(compact) ? 1 : 0), 0);

        return markerScore >= 2;
    }

    buildCanvasContextPrompt(context) {
        const objects = Array.isArray(context?.objects) ? context.objects : [];
        const selectedObjectIds = Array.isArray(context?.selectedObjectIds)
            ? context.selectedObjectIds.filter(Boolean)
            : [];

        if (objects.length === 0 && selectedObjectIds.length === 0) {
            return '';
        }

        const lines = [];
        if (objects.length > 0) {
            lines.push('현재 캔버스에는 다음 객체들이 있습니다:');
            lines.push(...objects.map(o => `- ${this.formatContextObject(o)}`));
        }

        if (selectedObjectIds.length > 0) {
            lines.push(`현재 선택된 객체 id: ${selectedObjectIds.join(', ')}`);
        }

        lines.push('새로운 객체를 추가할 때 기존 객체 id를 참조할 수 있습니다.');
        lines.push('기존 일부만 바꾸라는 요청이면 관련 객체만 update/delete/create하고 나머지는 유지하세요.');

        return lines.join('\n');
    }

    formatContextObject(o) {
        const parts = [
            `type=${o.type}`,
            `id=${o.id}`,
            `label=${o.label || ''}`
        ];

        if (Number.isFinite(o.x) && Number.isFinite(o.y)) {
            parts.push(`x=${o.x}`, `y=${o.y}`);
        }
        if (typeof o.expression === 'string') {
            parts.push(`expression=${o.expression}`);
        }
        if (Number.isFinite(o.start) && Number.isFinite(o.end)) {
            parts.push(`start=${o.start}`, `end=${o.end}`, `step=${o.step ?? 1}`, `yLine=${o.y ?? 0}`);
        }
        if (Array.isArray(o.vertexIds) && o.vertexIds.length > 0) {
            parts.push(`vertexIds=${o.vertexIds.join(',')}`);
        }
        if (Array.isArray(o.dependencies) && o.dependencies.length > 0) {
            parts.push(`deps=${o.dependencies.join(',')}`);
        }

        return parts.join(', ');
    }

    async loadDrawingReferences() {
        if (this.drawingReferenceIndex && this.drawingFeatureManual) {
            return {
                index: this.drawingReferenceIndex,
                manual: this.drawingFeatureManual
            };
        }

        if (this.drawingReferenceLoadPromise) {
            return this.drawingReferenceLoadPromise;
        }

        if (this.config.referenceManualEnabled === false || typeof window === 'undefined' || typeof fetch !== 'function') {
            return null;
        }

        this.drawingReferenceLoadPromise = Promise.all([
            fetch('.agents/skills/mathgraph-drawing/references/retrieval-index.json'),
            fetch('.agents/skills/mathgraph-drawing/references/feature-manual.json')
        ])
            .then(async ([indexResponse, manualResponse]) => {
                if (!indexResponse.ok || !manualResponse.ok) {
                    throw new Error('MathGraph drawing reference files are not available.');
                }
                const index = await indexResponse.json();
                const manual = await manualResponse.json();
                this.drawingReferenceIndex = index;
                this.drawingFeatureManual = manual;
                return { index, manual };
            })
            .catch(error => {
                console.warn('MathGraph drawing reference load failed:', error);
                return null;
            });

        return this.drawingReferenceLoadPromise;
    }

    async buildDrawingReferencePrompt(requestText = '', context = null, mode = 'command') {
        const references = await this.loadDrawingReferences();
        if (!references?.manual) {
            return '';
        }

        return this.buildDrawingReferencePromptFromManual(
            references.manual,
            references.index,
            requestText,
            context,
            mode
        );
    }

    buildDrawingReferencePromptFromManual(manual, index, requestText = '', context = null, mode = 'command') {
        if (!manual || typeof manual !== 'object') {
            return '';
        }

        const selection = this.selectDrawingReferenceTypes(requestText, context, mode);
        const supportedTypes = manual.operationContract?.supportedCreateTypes || GRAPH_OPERATION_TYPES;
        const objectEntries = (manual.aiCreatableObjects || [])
            .filter(entry => selection.objectTypes.has(entry.type))
            .slice(0, 12);

        const lines = [
            'MathGraph reference manual context:',
            '- Source: .agents/skills/mathgraph-drawing/references/feature-manual.json selected through retrieval-index.json.',
            `- Return only {"operations":[...]} using create/update/delete.`,
            `- Supported create types: ${supportedTypes.join(', ')}.`,
            `- Default style: ${manual.defaultStylePolicy?.colorFieldGuidance || 'omit color fields unless explicitly requested.'}`,
            '- Create dependencies before objects that reference them. Use existing canvas ids for updates and references.',
            `- Recreate operation budget: keep image recreation at or below ${IMAGE_RECREATE_OPERATION_BUDGET} operations; simplify dense grids/page decoration.`
        ];

        if (Array.isArray(manual.visualGuardrails) && manual.visualGuardrails.length > 0) {
            lines.push('- Visual fidelity guardrails:');
            for (const rule of manual.visualGuardrails.slice(0, 8)) {
                lines.push(`  - ${rule}`);
            }
        }

        if (mode === 'patch') {
            lines.push('- Patch mode: user instruction and selected object ids outrank text visible inside the image.');
            lines.push('- Patch mode: update/delete existing ids for selected-object edits; do not solve or copy textbook problem text unless explicitly requested.');
        }

        if (objectEntries.length > 0) {
            lines.push('- Relevant object schemas from the manual:');
            for (const entry of objectEntries) {
                const required = (entry.requiredFields || []).join(', ') || 'none';
                const optional = (entry.optionalFields || []).slice(0, 8).join(', ') || 'none';
                lines.push(`  - ${entry.type}: required ${required}; optional ${optional}.`);
            }
        }

        if (selection.includeKnownGaps && Array.isArray(manual.knownGapsAndApproximations)) {
            lines.push('- Current manual gaps/approximations:');
            for (const gap of manual.knownGapsAndApproximations.slice(0, 5)) {
                lines.push(`  - ${gap.gap} ${gap.currentApproximation}`);
            }
        }

        const selectedChunkIds = (index?.chunks || [])
            .filter(chunk => Array.isArray(chunk.objectTypes) && chunk.objectTypes.some(type => selection.objectTypes.has(type)))
            .map(chunk => chunk.id)
            .slice(0, 8);
        if (selectedChunkIds.length > 0) {
            lines.push(`- Retrieval chunks selected: ${selectedChunkIds.join(', ')}.`);
        }

        return lines.join('\n');
    }

    selectDrawingReferenceTypes(requestText = '', context = null, mode = 'command') {
        const text = String(requestText || '').toLowerCase();
        const objectTypes = new Set();
        let includeKnownGaps = mode === 'recreate';

        const add = (...types) => {
            for (const type of types) objectTypes.add(type);
        };

        const addPlane = () => add('point', 'segment', 'line', 'ray', 'polygon');
        const addCircle = () => add('point', 'circle', 'circleThreePoints', 'pointOnCircle', 'circleCenterPoint', 'arc', 'sector', 'circularSegment', 'lensRegion', 'tangentCircle');
        const addConstruction = () => add('intersection', 'midpoint', 'parallel', 'perpendicular', 'perpendicularBisector', 'angleBisector', 'rightAngleMarker', 'equalLengthMarker', 'angleDimension', 'lengthDimension');
        const addSolid = () => {
            add('point', 'segment', 'polygon', 'prism', 'pyramid');
            includeKnownGaps = true;
        };
        const addGraph = () => add('point', 'segment', 'line', 'function', 'tangentFunction', 'intersection', 'polygon');
        const addNumberLine = () => add('numberLine', 'point', 'segment');
        const addChart = () => {
            add('point', 'segment', 'polygon', 'numberLine', 'line');
            includeKnownGaps = true;
        };

        if (/triangle|quadrilateral|polygon|angle|parallel|perpendicular|similar|plane/.test(text) ||
            /삼각|사각|다각|각|평행|수선|직각|닮음|평면/.test(text)) {
            addPlane();
            addConstruction();
        }

        if (/circle|arc|sector|lens|overlap|intersection region|tangent|radius|diameter/.test(text) ||
            /원|호|부채꼴|활꼴|렌즈|교집합|접선|반지름|지름|현/.test(text)) {
            addCircle();
            addConstruction();
        }

        if (/solid|prism|pyramid|cylinder|cone|sphere|cube|3d/.test(text) ||
            /입체|기둥|뿔|원기둥|원뿔|구|정육면체|직육면체/.test(text)) {
            addSolid();
        }

        if (/graph|function|parabola|linear|quadratic|intersection|tangent/.test(text) ||
            /그래프|함수|직선|이차|일차|교점|접점|접선/.test(text)) {
            addGraph();
        }

        if (/number line|numberline|radical/.test(text) ||
            /수직선|무리수|근호|제곱근/.test(text)) {
            addNumberLine();
        }

        if (/chart|histogram|scatter|box plot|statistics|frequency/.test(text) ||
            /통계|히스토그램|산점도|상자그림|도수|분포|꺾은선/.test(text)) {
            addChart();
        }

        const objects = Array.isArray(context?.objects) ? context.objects : [];
        const selectedIds = new Set(Array.isArray(context?.selectedObjectIds) ? context.selectedObjectIds : []);
        for (const object of objects) {
            if (mode === 'patch' && selectedIds.size > 0 && !selectedIds.has(object.id)) {
                continue;
            }
            if (GRAPH_OPERATION_TYPES.includes(object.type)) {
                objectTypes.add(object.type);
            }
        }

        if (objectTypes.size === 0) {
            addPlane();
            addCircle();
            addGraph();
        }

        return { objectTypes, includeKnownGaps };
    }

    /**
     * OpenAI Responses API 호출
     * Uses Structured Outputs so the model response matches the GraphA operations schema.
     */
    async callOpenAI(messages) {
        const requestBody = this.buildOpenAIRequestBody(messages);

        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI Responses API 오류');
        }

        const data = await response.json();
        this.lastResponseId = data.id;

        const content = extractOpenAIResponseText(data);
        this.conversationHistory.push({ role: 'assistant', content });

        return content;
    }

    buildOpenAIRequestBody(messages, overrides = {}) {
        // 시스템 프롬프트와 사용자 메시지 분리
        const systemContent = messages
            .filter(m => m.role === 'system')
            .map(m => m.content)
            .join('\n\n');

        const userContent = messages
            .filter(m => m.role === 'user')
            .map(m => m.content)
            .join('\n\n');

        // 이전 응답 ID (대화 연속성을 위해)
        const previousResponseId = overrides.previousResponseId ?? this.lastResponseId ?? undefined;

        return this.buildOpenAIRequestBodyFromInput([
            { role: 'developer', content: systemContent },
            { role: 'user', content: userContent }
        ], {
            previousResponseId,
            reasoningEffort: overrides.reasoningEffort,
            verbosity: overrides.verbosity,
            model: overrides.model
        });
    }

    buildOpenAIRequestBodyFromInput(input, options = {}) {
        const previousResponseId = options.previousResponseId;
        const model = options.model || this.config.model || DEFAULT_OPENAI_MODEL;
        const reasoningEffort = this.normalizeReasoningEffort(options.reasoningEffort ?? this.config.reasoningEffort);
        const verbosity = this.normalizeVerbosity(options.verbosity ?? this.config.verbosity);

        return {
            model,
            input,
            store: false,
            reasoning: {
                effort: reasoningEffort
            },
            text: {
                verbosity,
                format: GRAPH_OPERATIONS_RESPONSE_FORMAT
            },
            ...(previousResponseId && { previous_response_id: previousResponseId })
        };
    }

    normalizeReasoningEffort(value) {
        const allowed = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);
        return allowed.has(value) ? value : 'low';
    }

    normalizeVerbosity(value) {
        const allowed = new Set(['low', 'medium', 'high']);
        return allowed.has(value) ? value : 'low';
    }

    getOpenAIModelRoutingRank(model) {
        return OPENAI_MODEL_ROUTING_RANK[model] || OPENAI_MODEL_ROUTING_RANK[DEFAULT_OPENAI_MODEL];
    }

    selectOpenAIImageModel(options = {}, phase = 'first') {
        if (options.model) {
            return options.model;
        }

        if (phase === 'first') {
            return this.config.imageFastModel || OPENAI_IMAGE_FAST_MODEL;
        }

        const configuredModel = this.config.model || DEFAULT_OPENAI_MODEL;
        const configuredRank = this.getOpenAIModelRoutingRank(configuredModel);
        const fastRank = this.getOpenAIModelRoutingRank(OPENAI_IMAGE_FAST_MODEL);
        return configuredRank > fastRank ? configuredModel : DEFAULT_OPENAI_MODEL;
    }

    /**
     * Google Gemini API 호출
     */
    async callGemini(messages) {
        // Gemini 형식으로 변환
        const parts = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : m.role,
            parts: [{ text: m.content }]
        }));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: parts,
                    generationConfig: {
                        temperature: this.config.temperature,
                        maxOutputTokens: this.config.maxTokens
                    }
                })
            }
        );

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Gemini API 오류');
        }

        const data = await response.json();
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        // 대화 히스토리에 추가
        this.conversationHistory.push({ role: 'assistant', content });

        return content;
    }

    /**
     * JSON 추출
     */
    extractJSON(text) {
        try {
            return stripNullFields(parseAIJSONPayload(text));
        } catch (e) {
            return null;
        }
    }

    enhanceDiagramQuality(json, requestText = '', context = null, mode = 'command') {
        if (mode === 'patch') {
            return json;
        }

        return enhanceDiagramQuality(json, requestText, {
            context,
            mode,
            enabled: this.config.diagramQualityEnhancement !== false
        });
    }

    enhanceProcessResult(result, requestText = '', context = null, mode = 'command') {
        if (!result?.success || !result.json) {
            return result;
        }

        return {
            ...result,
            json: this.enhanceDiagramQuality(result.json, requestText, context, mode)
        };
    }

    /**
     * 폴백 처리 (API 없이 컨텍스트 인식 패턴 매칭)
     */
    fallbackProcess(message, context = null) {
        const destructiveRequest = /(삭제|지워|지우|remove|delete|erase|없애)/i;
        if (destructiveRequest.test(String(message))) {
            return {
                success: false,
                error: '삭제 요청은 대상이 명확할 때만 처리합니다. 현재 요청은 새 도형을 만들지 않고 중단했습니다.'
            };
        }

        const deterministicResult = this.fallbackProcessDeterministic(message, context);
        if (deterministicResult.success) {
            return deterministicResult;
        }

        const lower = message.toLowerCase();
        let operations = [];

        // 참조어 감지 (금방, 방금, 기존, 그, 이, 아까 등)
        const referencePatterns = ['금방', '방금', '기존', '그 ', '이 ', '아까', '위의', '저'];
        const hasReference = referencePatterns.some(p => lower.includes(p));

        // 컨텍스트에서 객체 정보 추출
        const existingObjects = context?.objects || [];
        const circles = existingObjects.filter(o =>
            o.type === 'circle' || o.type === 'circleThreePoints'
        );
        const points = existingObjects.filter(o => o.type === 'point');
        const segments = existingObjects.filter(o => o.type === 'segment');

        // 사용된 라벨 추적
        const usedLabels = new Set(existingObjects.map(o => o.label).filter(Boolean));

        // 다음 사용 가능한 좌표 오프셋 (중복 방지)
        const offsetX = Math.floor(existingObjects.length / 3) * 5;
        const offsetY = (existingObjects.length % 3) * 3;

        // ===============================
        // 1. 접하는 원 요청 (컨텍스트 필요)
        // ===============================
        if ((lower.includes('접') || lower.includes('접하')) && lower.includes('원')) {
            if (hasReference && circles.length > 0) {
                // 가장 최근 원 참조
                const lastCircle = circles[circles.length - 1];
                const circleLabel = lastCircle.label || lastCircle.id;

                // 외접하는 원 생성 (기존 원 바깥에)
                const newX = 6 + offsetX;
                const newY = 0 + offsetY;
                const newLabel = this.getNextLabel('O', usedLabels);
                const pointLabel = this.getNextLabel('Q', usedLabels);

                operations = [
                    { op: 'create', type: 'point', id: 'new_center', x: newX, y: newY, label: newLabel },
                    { op: 'create', type: 'point', id: 'new_on_circle', x: newX + 2, y: newY, label: pointLabel },
                    { op: 'create', type: 'circle', centerId: 'new_center', pointOnCircleId: 'new_on_circle' }
                ];

                this.addToHistory(operations);
                return {
                    success: true,
                    json: { operations },
                    note: `기존 원(${circleLabel}) 옆에 새 원을 생성했습니다.`
                };
            }
        }

        // ===============================
        // 2. 삼각형 (라벨 및 좌표 파싱)
        // ===============================
        if (lower.includes('삼각형')) {
            // 삼각형 라벨 추출: "삼각형 DEF" → D, E, F
            const labelMatch = message.match(/삼각형\s*([A-Z])([A-Z])([A-Z])/i);
            let labels = ['A', 'B', 'C'];
            if (labelMatch) {
                labels = [labelMatch[1].toUpperCase(), labelMatch[2].toUpperCase(), labelMatch[3].toUpperCase()];
            } else {
                // 기존 라벨과 겹치지 않게 조정
                labels = [
                    this.getNextLabel('A', usedLabels),
                    this.getNextLabel('B', usedLabels),
                    this.getNextLabel('C', usedLabels)
                ];
            }

            // 좌표 추출: "점 E가 (4,-3)에" → E = (4, -3)
            const customCoords = {};
            const coordPattern = /점\s*([A-Z])[^(]*\(\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*\)/gi;
            let coordMatch;
            while ((coordMatch = coordPattern.exec(message)) !== null) {
                const label = coordMatch[1].toUpperCase();
                customCoords[label] = {
                    x: parseFloat(coordMatch[2]),
                    y: parseFloat(coordMatch[3])
                };
            }

            // 기본 좌표 (오프셋 적용)
            const baseCoords = {
                [labels[0]]: { x: 0 + offsetX, y: 0 + offsetY },
                [labels[1]]: { x: 4 + offsetX, y: 0 + offsetY },
                [labels[2]]: { x: 2 + offsetX, y: 3 + offsetY }
            };

            // 사용자 지정 좌표 적용
            for (const label of labels) {
                if (customCoords[label]) {
                    baseCoords[label] = customCoords[label];
                }
            }

            // 점 생성
            operations = [
                { op: 'create', type: 'point', id: 'p1', x: baseCoords[labels[0]].x, y: baseCoords[labels[0]].y, label: labels[0] },
                { op: 'create', type: 'point', id: 'p2', x: baseCoords[labels[1]].x, y: baseCoords[labels[1]].y, label: labels[1] },
                { op: 'create', type: 'point', id: 'p3', x: baseCoords[labels[2]].x, y: baseCoords[labels[2]].y, label: labels[2] },
                { op: 'create', type: 'polygon', id: 'poly1', vertexIds: ['p1', 'p2', 'p3'], fillColor: '#000000', fillOpacity: 0.12 }
            ];

            // 외접원
            if (lower.includes('외접원')) {
                operations.push({
                    op: 'create', type: 'circleThreePoints',
                    point1Id: 'p1', point2Id: 'p2', point3Id: 'p3',
                    label: '외접원'
                });
            }

            this.addToHistory(operations);
            return { success: true, json: { operations } };
        }

        // ===============================
        // 3. 일반 원
        // ===============================
        if (lower.includes('원') && !lower.includes('외접원')) {
            const centerLabel = this.getNextLabel('O', usedLabels);
            const pointLabel = this.getNextLabel('P', usedLabels);

            operations = [
                { op: 'create', type: 'point', id: 'o1', x: 0 + offsetX, y: 0 + offsetY, label: centerLabel },
                { op: 'create', type: 'point', id: 'p1', x: 3 + offsetX, y: 0 + offsetY, label: pointLabel },
                { op: 'create', type: 'circle', centerId: 'o1', pointOnCircleId: 'p1' }
            ];

            this.addToHistory(operations);
            return { success: true, json: { operations } };
        }

        // ===============================
        // 4. 정사각형
        // ===============================
        if (lower.includes('정사각형') || lower.includes('사각형')) {
            const labels = [
                this.getNextLabel('A', usedLabels),
                this.getNextLabel('B', usedLabels),
                this.getNextLabel('C', usedLabels),
                this.getNextLabel('D', usedLabels)
            ];

            operations = [
                { op: 'create', type: 'point', id: 'p1', x: 0 + offsetX, y: 0 + offsetY, label: labels[0] },
                { op: 'create', type: 'point', id: 'p2', x: 4 + offsetX, y: 0 + offsetY, label: labels[1] },
                { op: 'create', type: 'point', id: 'p3', x: 4 + offsetX, y: 4 + offsetY, label: labels[2] },
                { op: 'create', type: 'point', id: 'p4', x: 0 + offsetX, y: 4 + offsetY, label: labels[3] },
                { op: 'create', type: 'polygon', id: 'poly1', vertexIds: ['p1', 'p2', 'p3', 'p4'], fillColor: '#000000', fillOpacity: 0.12 }
            ];

            this.addToHistory(operations);
            return { success: true, json: { operations } };
        }

        // ===============================
        // 5. 함수
        // ===============================
        const funcMatch = message.match(/y\s*=\s*(.+)/i);
        if (funcMatch) {
            operations = [
                { op: 'create', type: 'function', expression: funcMatch[1].trim() }
            ];
            this.addToHistory(operations);
            return { success: true, json: { operations } };
        }

        // ===============================
        // 6. 점
        // ===============================
        const pointMatch = message.match(/점\s*([A-Z])?[^(]*\(\s*([+-]?\d+\.?\d*)\s*,\s*([+-]?\d+\.?\d*)\s*\)/i);
        if (pointMatch) {
            const label = pointMatch[1] ? pointMatch[1].toUpperCase() : this.getNextLabel('P', usedLabels);
            operations = [
                { op: 'create', type: 'point', x: parseFloat(pointMatch[2]), y: parseFloat(pointMatch[3]), label }
            ];
            this.addToHistory(operations);
            return { success: true, json: { operations } };
        }

        // ===============================
        // 7. 각기둥
        // ===============================
        if (lower.includes('각기둥') || lower.includes('기둥')) {
            // 삼각기둥 기본
            let n = 3;
            if (lower.includes('사각') || lower.includes('4각')) n = 4;
            if (lower.includes('오각') || lower.includes('5각')) n = 5;
            if (lower.includes('육각') || lower.includes('6각')) n = 6;

            const baseLabels = [];
            const topLabels = [];
            for (let i = 0; i < n; i++) {
                baseLabels.push(this.getNextLabel(String.fromCharCode(65 + i), usedLabels));
            }
            for (let i = 0; i < n; i++) {
                topLabels.push(baseLabels[i] + "'");
                usedLabels.add(baseLabels[i] + "'");
            }

            // 밑면 좌표 (정다각형)
            const radius = 2;
            const baseOps = [];
            const topOps = [];
            for (let i = 0; i < n; i++) {
                const angle = (2 * Math.PI * i / n) - Math.PI / 2;
                const x = Math.round(radius * Math.cos(angle) * 10) / 10 + offsetX;
                const y = Math.round(radius * Math.sin(angle) * 10) / 10 + offsetY;
                baseOps.push({ op: 'create', type: 'point', id: `base_${i}`, x, y, label: baseLabels[i] });
                topOps.push({ op: 'create', type: 'point', id: `top_${i}`, x: x + 1, y: y + 2.5, label: topLabels[i] });
            }

            operations = [
                ...baseOps,
                ...topOps,
                { op: 'create', type: 'prism', id: 'prism1', baseVertexIds: baseOps.map(o => o.id), topVertexIds: topOps.map(o => o.id) }
            ];

            this.addToHistory(operations);
            return { success: true, json: { operations } };
        }

        // ===============================
        // 8. 각뿔
        // ===============================
        if (lower.includes('각뿔') || lower.includes('뿔')) {
            // 사각뿔 기본
            let n = 4;
            if (lower.includes('삼각') || lower.includes('3각')) n = 3;
            if (lower.includes('오각') || lower.includes('5각')) n = 5;
            if (lower.includes('육각') || lower.includes('6각')) n = 6;

            const baseLabels = [];
            for (let i = 0; i < n; i++) {
                baseLabels.push(this.getNextLabel(String.fromCharCode(65 + i), usedLabels));
            }
            const apexLabel = this.getNextLabel('V', usedLabels);

            // 밑면 좌표 (정다각형)
            const radius = 2;
            const baseOps = [];
            for (let i = 0; i < n; i++) {
                const angle = (2 * Math.PI * i / n) - Math.PI / 2;
                const x = Math.round(radius * Math.cos(angle) * 10) / 10 + offsetX;
                const y = Math.round(radius * Math.sin(angle) * 10) / 10 + offsetY;
                baseOps.push({ op: 'create', type: 'point', id: `base_${i}`, x, y, label: baseLabels[i] });
            }

            operations = [
                ...baseOps,
                { op: 'create', type: 'point', id: 'apex', x: offsetX, y: offsetY + 3, label: apexLabel },
                { op: 'create', type: 'pyramid', id: 'pyr1', baseVertexIds: baseOps.map(o => o.id), apexId: 'apex' }
            ];

            this.addToHistory(operations);
            return { success: true, json: { operations } };
        }

        return {
            success: false,
            error: '요청을 이해하지 못했습니다.\n\n' +
                '💡 **지원하는 명령:**\n' +
                '• "삼각형 ABC 그려줘"\n' +
                '• "원 그려줘"\n' +
                '• "삼각기둥 그려줘"\n' +
                '• "사각뿔 그려줘"\n' +
                '• "y = x^2 그래프"\n' +
                '• "점 A (2, 3)"'
        };
    }

    fallbackProcessDeterministic(message, context = null) {
        const normalizedMessage = typeof message === 'string' ? message.trim() : '';
        if (!normalizedMessage) {
            return { success: false, error: '명령이 비어 있습니다.' };
        }

        const lower = normalizedMessage.toLowerCase();
        const state = this.buildContextState(context);
        const builders = [
            () => this.buildNumberLineOperations(normalizedMessage),
            () => this.buildMidpointOperations(normalizedMessage, state),
            () => this.buildTangentFunctionOperations(normalizedMessage, state),
            () => this.buildBasicFunctionOperations(normalizedMessage),
            () => this.buildBasicCircleOperations(normalizedMessage, state.usedLabels, state.layoutOrigin),
            () => this.buildEquationCircleOperations(normalizedMessage, state.usedLabels, state.layoutOrigin),
            () => this.buildEquationLineOperations(normalizedMessage, lower, state.usedLabels, state.layoutOrigin)
        ];

        for (const builder of builders) {
            const result = builder();
            if (!result) {
                continue;
            }
            if (result.error) {
                return { success: false, error: result.error };
            }
            if (Array.isArray(result.operations) && result.operations.length > 0) {
                this.addToHistory(result.operations);
                return { success: true, json: { operations: result.operations } };
            }
        }

        return { success: false, error: '결정적으로 해석할 수 있는 패턴을 찾지 못했습니다.' };
    }

    buildContextState(context = null) {
        const objects = Array.isArray(context?.objects) ? context.objects : [];
        const objectById = new Map();
        const pointByLabel = new Map();
        const segmentByPair = new Map();
        const usedLabels = new Set();

        for (const object of objects) {
            objectById.set(object.id, object);
            if (typeof object.label === 'string' && object.label.trim()) {
                const label = object.label.trim().toUpperCase();
                usedLabels.add(label);
                if (object.type === 'point' || object.type === 'pointOnObject' || object.type === 'midpoint' || object.type === 'intersection') {
                    pointByLabel.set(label, object);
                }
            }
        }

        for (const object of objects) {
            if (object.type !== 'segment') {
                continue;
            }

            const point1 = objectById.get(object.point1Id);
            const point2 = objectById.get(object.point2Id);
            if (!point1?.label || !point2?.label) {
                continue;
            }

            segmentByPair.set(this.getPairKey(point1.label, point2.label), object);
        }

        return {
            objects,
            objectById,
            pointByLabel,
            segmentByPair,
            usedLabels,
            layoutOrigin: {
                x: Math.floor(objects.length / 3) * 5,
                y: (objects.length % 3) * 3
            }
        };
    }

    buildNumberLineOperations(message) {
        if (!/(수직선|number\s*line|numberline)/i.test(message)) {
            return null;
        }

        const rangeMatch =
            message.match(/([+-]?\d*\.?\d+)\s*(?:부터|to|from)\s*([+-]?\d*\.?\d+)\s*(?:까지)?/i) ||
            message.match(/([+-]?\d*\.?\d+)\s*~\s*([+-]?\d*\.?\d+)/);
        const numbers = Array.from(message.matchAll(/[+-]?\d*\.?\d+/g), match => parseFloat(match[0]))
            .filter(value => Number.isFinite(value));

        const start = rangeMatch ? parseFloat(rangeMatch[1]) : numbers[0] ?? -5;
        const end = rangeMatch ? parseFloat(rangeMatch[2]) : numbers[1] ?? 5;
        const stepMatch = message.match(/(?:간격|step|눈금)\s*(?:은|는|=)?\s*([+-]?\d*\.?\d+)/i);
        const yMatch = message.match(/(?:y\s*=|높이)\s*([+-]?\d*\.?\d+)/i);
        const step = stepMatch ? parseFloat(stepMatch[1]) : 1;
        const y = yMatch ? parseFloat(yMatch[1]) : 0;

        if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
            return { error: '수직선의 시작값과 끝값을 해석하지 못했습니다.' };
        }
        if (!Number.isFinite(step) || step <= 0) {
            return { error: '수직선의 간격은 0보다 커야 합니다.' };
        }

        return {
            operations: [
                { op: 'create', type: 'numberLine', start, end, step, y }
            ]
        };
    }

    buildMidpointOperations(message, state) {
        if (!/(중점|midpoint)/i.test(message)) {
            return null;
        }

        const supportOps = [];
        const coordinatePoints = this.extractCoordinateMentions(message, new Set(state.usedLabels), ['A', 'B']);
        let segmentId = null;

        if (coordinatePoints.length >= 2) {
            const pointOps = this.createPointOperations(coordinatePoints.slice(0, 2));
            supportOps.push(...pointOps);
            segmentId = 'midpoint_segment';
            supportOps.push({
                op: 'create',
                type: 'segment',
                id: segmentId,
                point1Id: pointOps[0].id,
                point2Id: pointOps[1].id
            });
        } else {
            const pair = this.extractLabelPairs(message)[0];
            if (pair) {
                segmentId = this.ensureSegmentReference(pair[0], pair[1], state, supportOps);
            }
        }

        if (!segmentId) {
            return { error: '중점을 만들 선분을 찾지 못했습니다.' };
        }

        return {
            operations: [
                ...supportOps,
                { op: 'create', type: 'midpoint', segmentId }
            ]
        };
    }

    buildTangentFunctionOperations(message, state) {
        if (!/(접선|tangent)/i.test(message) || /(원|circle)/i.test(message)) {
            return null;
        }

        const xMatch = message.match(/x\s*=\s*([+-]?\d*\.?\d+)/i) || message.match(/([+-]?\d*\.?\d+)\s*에서/);
        if (!xMatch) {
            return null;
        }

        const x = parseFloat(xMatch[1]);
        if (!Number.isFinite(x)) {
            return { error: '접선의 x값을 해석하지 못했습니다.' };
        }

        const expression = this.extractFunctionExpression(message);
        const operations = [];
        let functionId = null;

        if (expression) {
            functionId = 'tangent_function_base';
            operations.push({
                op: 'create',
                type: 'function',
                id: functionId,
                expression
            });
        } else {
            const functions = state.objects.filter(object => object.type === 'function');
            if (functions.length !== 1) {
                return { error: '접선을 만들 함수가 명확하지 않습니다.' };
            }
            functionId = functions[0].id;
        }

        operations.push({
            op: 'create',
            type: 'tangentFunction',
            functionId,
            x
        });

        return { operations };
    }

    buildEquationCircleOperations(message, usedLabels, layoutOrigin = { x: 0, y: 0 }) {
        const parsed = this.parseCircleEquation(message);
        if (!parsed) {
            return null;
        }

        const centerLabel = this.getNextLabel('O', usedLabels);
        const edgeLabel = this.getNextLabel('P', usedLabels);
        return {
            operations: [
                { op: 'create', type: 'point', id: 'circle_center', x: parsed.centerX, y: parsed.centerY, label: centerLabel },
                { op: 'create', type: 'point', id: 'circle_edge', x: parsed.centerX + parsed.radius, y: parsed.centerY, label: edgeLabel },
                { op: 'create', type: 'circle', centerId: 'circle_center', pointOnCircleId: 'circle_edge' }
            ]
        };
    }

    buildEquationLineOperations(message, lower, usedLabels, layoutOrigin = { x: 0, y: 0 }) {
        if (/(?:^|\s)y\s*=/.test(lower)) {
            return null;
        }

        const parsed = this.parseLinearEquation(message);
        if (!parsed) {
            return null;
        }

        const point1Label = this.getNextLabel('A', usedLabels);
        const point2Label = this.getNextLabel('B', usedLabels);
        let point1;
        let point2;

        if (Math.abs(parsed.b) < 1e-9) {
            const x = -parsed.c / parsed.a;
            point1 = { x, y: layoutOrigin.y - 5, label: point1Label };
            point2 = { x, y: layoutOrigin.y + 5, label: point2Label };
        } else {
            const x1 = layoutOrigin.x - 4;
            const x2 = layoutOrigin.x + 4;
            point1 = { x: x1, y: -(parsed.a * x1 + parsed.c) / parsed.b, label: point1Label };
            point2 = { x: x2, y: -(parsed.a * x2 + parsed.c) / parsed.b, label: point2Label };
        }

        return {
            operations: [
                { op: 'create', type: 'point', id: 'line_point_1', x: point1.x, y: point1.y, label: point1.label },
                { op: 'create', type: 'point', id: 'line_point_2', x: point2.x, y: point2.y, label: point2.label },
                { op: 'create', type: 'line', point1Id: 'line_point_1', point2Id: 'line_point_2' }
            ]
        };
    }

    buildBasicFunctionOperations(message) {
        const trimmedLower = String(message ?? '').trim().toLowerCase();
        if (!/^(?:y\s*=|[a-z]\(x\)\s*=)/i.test(trimmedLower) && this.parseLinearEquation(message)) {
            return null;
        }

        const expression = this.extractFunctionExpression(message);
        if (!expression || /(접선|tangent)/i.test(message)) {
            return null;
        }

        return {
            operations: [
                { op: 'create', type: 'function', expression }
            ]
        };
    }

    buildBasicCircleOperations(message, usedLabels, layoutOrigin = { x: 0, y: 0 }) {
        if (!/(원|circle)/i.test(message) || /(외접원|접선|호|부채꼴|원활꼴)/i.test(message)) {
            return null;
        }

        const centerCoordMatch = message.match(/(?:중심|center)(?:은|는|이|가)?[^()\n]*\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\)/i);
        const radiusMatch = message.match(/(?:반지름|radius|r)\s*(?:은|는|=)?\s*([+-]?\d*\.?\d+)/i);
        if (!centerCoordMatch && !radiusMatch) {
            return null;
        }

        const centerX = centerCoordMatch ? parseFloat(centerCoordMatch[1]) : layoutOrigin.x;
        const centerY = centerCoordMatch ? parseFloat(centerCoordMatch[2]) : layoutOrigin.y;
        const radius = radiusMatch ? Math.abs(parseFloat(radiusMatch[1])) : 3;

        if (!Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(radius) || radius <= 0) {
            return { error: '원의 중심 또는 반지름을 해석하지 못했습니다.' };
        }

        const centerLabel = this.getNextLabel('O', usedLabels);
        const edgeLabel = this.getNextLabel('P', usedLabels);
        return {
            operations: [
                { op: 'create', type: 'point', id: 'circle_center', x: centerX, y: centerY, label: centerLabel },
                { op: 'create', type: 'point', id: 'circle_edge', x: centerX + radius, y: centerY, label: edgeLabel },
                { op: 'create', type: 'circle', centerId: 'circle_center', pointOnCircleId: 'circle_edge' }
            ]
        };
    }

    extractFunctionExpression(message) {
        const directMatch = message.match(/((?:[a-z]\(x\)|y)\s*=\s*[^\n]+)/i);
        if (directMatch) {
            return this.normalizeFunctionExpression(directMatch[1]);
        }

        const graphMatch = message.match(/([a-z0-9x^*+\-\/().|\s]+?)\s*(?:그래프|graph|함수|function)/i);
        if (graphMatch && /x/i.test(graphMatch[1])) {
            return this.normalizeFunctionExpression(graphMatch[1]);
        }

        return null;
    }

    normalizeFunctionExpression(expression) {
        let normalized = String(expression ?? '').trim();
        normalized = normalized.replace(/^(?:[a-z]\(x\)|y)\s*=\s*/i, '');
        normalized = normalized.replace(/\s*(?:그래프|graph|plot|그려줘|그려 줘|draw).*$/i, '');
        normalized = normalized.replace(/\s*(?:에서|at)\s*x\s*=.*$/i, '');
        normalized = normalized.replace(/\s*(?:접선|tangent).*$/i, '');
        normalized = normalized.replace(/[−–—]/g, '-');
        normalized = normalized.trim();
        return normalized || null;
    }

    parseCircleEquation(message) {
        const normalized = String(message ?? '')
            .replace(/[−–—]/g, '-')
            .replace(/²/g, '^2')
            .replace(/\s+/g, '')
            .trim();

        const standardMatch = normalized.match(/\(x([+-]\d*\.?\d+)?\)\^?2\+\(y([+-]\d*\.?\d+)?\)\^?2=([+-]?\d*\.?\d+)/i);
        if (standardMatch) {
            const centerX = standardMatch[1] ? -parseFloat(standardMatch[1]) : 0;
            const centerY = standardMatch[2] ? -parseFloat(standardMatch[2]) : 0;
            const radiusSquared = parseFloat(standardMatch[3]);
            if (Number.isFinite(radiusSquared) && radiusSquared > 0) {
                return {
                    centerX,
                    centerY,
                    radius: Math.sqrt(radiusSquared)
                };
            }
        }

        const equationCoefficients = this.parseEquationCoefficients(message);
        if (!equationCoefficients || equationCoefficients.other) {
            return null;
        }
        if (Math.abs(equationCoefficients.xy) > 1e-9) {
            return null;
        }
        if (Math.abs(equationCoefficients.x2 - 1) > 1e-9 || Math.abs(equationCoefficients.y2 - 1) > 1e-9) {
            return null;
        }

        const centerX = -equationCoefficients.x / 2;
        const centerY = -equationCoefficients.y / 2;
        const radiusSquared = centerX * centerX + centerY * centerY - equationCoefficients.constant;
        if (!Number.isFinite(radiusSquared) || radiusSquared <= 0) {
            return null;
        }

        return {
            centerX,
            centerY,
            radius: Math.sqrt(radiusSquared)
        };
    }

    parseLinearEquation(message) {
        const equationCoefficients = this.parseEquationCoefficients(message);
        if (!equationCoefficients || equationCoefficients.other) {
            return null;
        }
        if (Math.abs(equationCoefficients.x2) > 1e-9 || Math.abs(equationCoefficients.y2) > 1e-9 || Math.abs(equationCoefficients.xy) > 1e-9) {
            return null;
        }
        if (Math.abs(equationCoefficients.x) < 1e-9 && Math.abs(equationCoefficients.y) < 1e-9) {
            return null;
        }

        return {
            a: equationCoefficients.x,
            b: equationCoefficients.y,
            c: equationCoefficients.constant
        };
    }

    parseEquationCoefficients(message) {
        const candidate = this.extractEquationCandidate(message);
        if (!candidate) {
            return null;
        }

        const [lhs, rhs] = candidate.split('=');
        if (!lhs || rhs === undefined) {
            return null;
        }

        const lhsTerms = this.parsePolynomial(lhs);
        const rhsTerms = this.parsePolynomial(rhs);
        if (!lhsTerms || !rhsTerms) {
            return null;
        }

        return {
            x2: lhsTerms.x2 - rhsTerms.x2,
            y2: lhsTerms.y2 - rhsTerms.y2,
            xy: lhsTerms.xy - rhsTerms.xy,
            x: lhsTerms.x - rhsTerms.x,
            y: lhsTerms.y - rhsTerms.y,
            constant: lhsTerms.constant - rhsTerms.constant,
            other: lhsTerms.other || rhsTerms.other
        };
    }

    extractEquationCandidate(message) {
        const compact = String(message ?? '').replace(/\n/g, ' ').trim();
        if (!compact.includes('=')) {
            return null;
        }

        const match = compact.match(/([^,;]+?=[^,;]+)/);
        return match ? match[1].trim() : compact;
    }

    parsePolynomial(expression) {
        const normalized = String(expression ?? '')
            .replace(/[−–—]/g, '-')
            .replace(/²/g, '^2')
            .replace(/\s+/g, '')
            .trim();
        if (!normalized) {
            return null;
        }

        const terms = normalized.match(/[+-]?[^+-]+/g) || [];
        const result = { x2: 0, y2: 0, xy: 0, x: 0, y: 0, constant: 0, other: false };

        for (const term of terms) {
            if (!term) continue;

            if (term.endsWith('x^2')) {
                const coeff = this.parseSignedCoefficient(term.slice(0, -3));
                if (!Number.isFinite(coeff)) return null;
                result.x2 += coeff;
                continue;
            }

            if (term.endsWith('y^2')) {
                const coeff = this.parseSignedCoefficient(term.slice(0, -3));
                if (!Number.isFinite(coeff)) return null;
                result.y2 += coeff;
                continue;
            }

            if (term.endsWith('xy') || term.endsWith('yx')) {
                const coeff = this.parseSignedCoefficient(term.slice(0, -2));
                if (!Number.isFinite(coeff)) return null;
                result.xy += coeff;
                continue;
            }

            if (term.endsWith('x')) {
                const coeff = this.parseSignedCoefficient(term.slice(0, -1));
                if (!Number.isFinite(coeff)) return null;
                result.x += coeff;
                continue;
            }

            if (term.endsWith('y')) {
                const coeff = this.parseSignedCoefficient(term.slice(0, -1));
                if (!Number.isFinite(coeff)) return null;
                result.y += coeff;
                continue;
            }

            const constant = parseFloat(term);
            if (!Number.isFinite(constant)) {
                result.other = true;
                continue;
            }
            result.constant += constant;
        }

        return result;
    }

    parseSignedCoefficient(raw) {
        if (raw === '' || raw === '+' || raw === undefined) return 1;
        if (raw === '-') return -1;
        const value = parseFloat(raw);
        return Number.isFinite(value) ? value : NaN;
    }

    extractCoordinateMentions(message, usedLabels, defaultLabels = ['A', 'B', 'C']) {
        const regex = /(?:점\s*)?([A-Z](?:')?)?\s*(?:=|는|은|가|이|을|를)?\s*\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\)/gi;
        const points = [];
        let defaultIndex = 0;
        let match;

        while ((match = regex.exec(message)) !== null) {
            const preferredLabel = match[1] ? match[1].toUpperCase() : (defaultLabels[defaultIndex] || 'P');
            const label = match[1] ? preferredLabel : this.getNextLabel(preferredLabel, usedLabels);
            points.push({
                id: `point_${points.length + 1}`,
                label,
                x: parseFloat(match[2]),
                y: parseFloat(match[3])
            });
            defaultIndex += 1;
        }

        return points;
    }

    createPointOperations(pointSpecs) {
        return pointSpecs.map((point, index) => ({
            op: 'create',
            type: 'point',
            id: point.id || `point_${index + 1}`,
            x: point.x,
            y: point.y,
            ...(point.label ? { label: point.label } : {})
        }));
    }

    extractLabelPairs(message) {
        const pairs = [];
        const seen = new Set();
        const patterns = [
            /(?:선분|직선|segment|line)\s*([A-Z](?:')?)\s*([A-Z](?:')?)/gi,
            /([A-Z](?:')?)\s*([A-Z](?:')?)\s*(?:선분|직선|segment|line)/gi,
            /([A-Z](?:')?)\s*([A-Z](?:')?)(?![a-z])/g
        ];

        for (const pattern of patterns) {
            for (const match of message.matchAll(pattern)) {
                const pair = [match[1].toUpperCase(), match[2].toUpperCase()];
                const key = `${pair[0]}__${pair[1]}`;
                if (!seen.has(key) && pair[0] !== pair[1]) {
                    seen.add(key);
                    pairs.push(pair);
                }
            }
        }

        return pairs;
    }

    ensureSegmentReference(label1, label2, state, supportOps) {
        const existingSegment = state.segmentByPair.get(this.getPairKey(label1, label2));
        if (existingSegment) {
            return existingSegment.id;
        }

        const point1 = state.pointByLabel.get(label1) || null;
        const point2 = state.pointByLabel.get(label2) || null;
        if (!point1 || !point2) {
            return null;
        }

        const id = `support_segment_${supportOps.length + 1}`;
        supportOps.push({
            op: 'create',
            type: 'segment',
            id,
            point1Id: point1.id,
            point2Id: point2.id
        });
        return id;
    }

    getPairKey(label1, label2) {
        return [label1, label2].sort().join('__');
    }

    /**
     * 다음 사용 가능한 라벨 생성
     */
    getNextLabel(preferred, usedLabels) {
        if (!usedLabels.has(preferred)) return preferred;

        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const startIdx = alphabet.indexOf(preferred);

        for (let i = 1; i < 26; i++) {
            const candidate = alphabet[(startIdx + i) % 26];
            if (!usedLabels.has(candidate)) {
                usedLabels.add(candidate);
                return candidate;
            }
        }

        // 모든 알파벳이 사용된 경우 숫자 추가
        for (let n = 1; n <= 99; n++) {
            const candidate = `${preferred}${n}`;
            if (!usedLabels.has(candidate)) {
                usedLabels.add(candidate);
                return candidate;
            }
        }

        return preferred;
    }

    /**
     * 응답을 히스토리에 추가
     */
    addToHistory(operations) {
        this.conversationHistory.push({
            role: 'assistant',
            content: JSON.stringify({ operations })
        });
    }

    /**
     * 대화 히스토리 초기화
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    normalizeImageAnalysisOptions(promptOrOptions = DEFAULT_IMAGE_RECREATE_INSTRUCTION) {
        if (typeof promptOrOptions === 'string') {
            const instruction = promptOrOptions.trim() || DEFAULT_IMAGE_RECREATE_INSTRUCTION;
            return {
                instruction,
                mode: 'recreate',
                context: null
            };
        }

        const instruction = typeof promptOrOptions?.instruction === 'string'
            ? promptOrOptions.instruction.trim()
            : '';
        const mode = promptOrOptions?.mode === 'patch' || promptOrOptions?.mode === 'recreate'
            ? promptOrOptions.mode
            : (instruction ? 'patch' : 'recreate');

        return {
            instruction: instruction || DEFAULT_IMAGE_RECREATE_INSTRUCTION,
            mode,
            context: promptOrOptions?.context || null
        };
    }

    buildImageAnalysisPrompt(instruction = DEFAULT_IMAGE_RECREATE_INSTRUCTION, context = null, mode = 'recreate', referencePrompt = '') {
        const normalizedInstruction = String(instruction || '').trim() || DEFAULT_IMAGE_RECREATE_INSTRUCTION;
        const normalizedMode = mode === 'patch' ? 'patch' : 'recreate';
        const contextPrompt = this.buildCanvasContextPrompt(context);
        const modeGuide = normalizedMode === 'patch'
            ? [
                '작업 모드: 부분 수정 패치.',
                '참조 이미지와 사용자 지시를 기준으로 현재 캔버스에서 바뀌어야 하는 객체만 최소한으로 수정하세요.',
                '기존 객체를 재사용할 수 있으면 id를 유지하고 update를 우선 사용하세요.',
                '선택된 객체가 있으면 그 객체를 우선 수정 대상으로 간주하세요.',
                '관련 없는 객체를 다시 만들거나 삭제하지 마세요.',
                '현재 캔버스가 비어 있으면 참조 이미지 전체를 재구성하되 사용자 지시를 반영하세요.'
            ].join('\n')
            : [
                '작업 모드: 이미지 재현.',
                '사진이 문제 전체 페이지이거나 주변 여백이 많아도, 그 안의 수학 도식/그래프/그림 영역을 찾아 GraphA 객체로 새로 재구성하세요.',
                '참조 이미지의 주요 점, 선, 곡선, 축, 눈금, 교점, 접점, 평행/수직 관계, 음영, 점선/실선, 짧은 라벨의 상대 위치를 최대한 보존하세요.',
                '점, 선분, 직선, 원, 호, 다각형, 함수, 수직선, 치수, 입체 도형 등 현재 스키마가 지원하는 객체만 사용하세요.',
                '문제 본문, 보기, 긴 설명, 장식 격자, 페이지 여백은 복사하지 말고 도식 이해에 필요한 라벨과 수식만 남기세요.',
                '지원되지 않는 차트/입체/독립 텍스트는 현재 지원 객체로 가능한 범위만 재구성하고, 보이는 구조를 왜곡하는 가짜 객체를 만들지 마세요.',
                '이미지의 픽셀 자체를 생성하지 말고 GraphA operations[]만 반환하세요.',
                '내부적으로 먼저 장면 그래프처럼 점/선/원/함수/관계/불확실성을 정리한 뒤, 최종 출력은 GraphA operations[]만 내보내세요.'
            ].join('\n');

        return [
            '당신은 MathGraph 이미지 참조 변환 모드입니다.',
            '출력은 반드시 GraphA operations[] JSON만이어야 하며 설명 문장은 쓰지 마세요.',
            modeGuide,
            referencePrompt,
            `사용자 지시: ${normalizedInstruction}`,
            contextPrompt ? `현재 캔버스 컨텍스트:\n${contextPrompt}` : '',
            '불확실한 세부 요소는 가장 가까운 수학 도형 구성으로 근사하되, 라벨과 주요 위치 관계를 우선 보존하세요.'
        ].filter(Boolean).join('\n\n');
    }

    getDataUrlMimeType(imageDataUrl) {
        const match = String(imageDataUrl || '').match(/^data:([^;,]+)[;,]/);
        return match?.[1] || 'image/png';
    }

    validateImageAnalysisIntent(json, options) {
        return this.schemaValidator.validateIntent(json, {
            mode: options.mode,
            instruction: options.instruction,
            context: options.context,
            maxOperations: options.mode === 'recreate' ? IMAGE_RECREATE_OPERATION_BUDGET : undefined
        });
    }

    buildImageRepairPrompt(originalPrompt, previousJson, errors, options) {
        return [
            originalPrompt,
            'The previous GraphA JSON failed local semantic validation.',
            `Validation errors:\n- ${errors.join('\n- ')}`,
            options.mode === 'patch'
                ? 'Repair rule: if selected ids are provided, update/delete the selected ids directly. Do not create unrelated objects for strict selected-object edits.'
                : `Repair rule: reduce the result to at most ${IMAGE_RECREATE_OPERATION_BUDGET} operations and ignore dense decorative grids/page text.`,
            'Previous JSON to repair:',
            JSON.stringify(previousJson).slice(0, 8000),
            'Return only corrected {"operations":[...]} JSON.'
        ].filter(Boolean).join('\n\n');
    }

    async callOpenAIImageAnalysis(imageDataUrl, promptText, requestOptions = {}) {
        const imageDetail = requestOptions.detail || 'high';
        const requestBody = this.buildOpenAIRequestBodyFromInput([
            { role: 'developer', content: SYSTEM_PROMPT },
            {
                role: 'user',
                content: [
                    { type: 'input_text', text: promptText },
                    { type: 'input_image', image_url: imageDataUrl, detail: imageDetail }
                ]
            }
        ], {
            reasoningEffort: requestOptions.reasoningEffort || 'medium',
            model: requestOptions.model || this.config.model || DEFAULT_OPENAI_MODEL,
            previousResponseId: requestOptions.previousResponseId
        });

        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI Vision API 오류');
        }

        const data = await response.json();
        this.lastResponseId = data.id || this.lastResponseId;
        const content = extractOpenAIResponseText(data);
        const json = this.extractJSON(content);

        return { data, content, json, requestBody };
    }

    /**
     * 이미지 분석 (비전 모델)
     * @param {string} imageDataUrl - Base64 인코딩된 이미지
     * @param {string|object} promptOrOptions - 분석 지시 또는 { instruction, mode, context }
     */
    async analyzeImage(imageDataUrl, promptOrOptions = DEFAULT_IMAGE_RECREATE_INSTRUCTION) {
        if (!this.config.apiKey) {
            return {
                success: false,
                error: 'AI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.'
            };
        }

        const options = this.normalizeImageAnalysisOptions(promptOrOptions);
        const referencePrompt = await this.buildDrawingReferencePrompt(
            `${options.mode}\n${options.instruction}`,
            options.context,
            options.mode
        );
        const promptText = this.buildImageAnalysisPrompt(
            options.instruction,
            options.context,
            options.mode,
            referencePrompt
        );

        try {
            if (this.config.provider === 'openai') {
                const firstAttempt = await this.callOpenAIImageAnalysis(imageDataUrl, promptText, {
                    model: this.selectOpenAIImageModel(options, 'first'),
                    reasoningEffort: 'medium',
                    detail: 'high'
                });
                const json = firstAttempt.json
                    ? this.enhanceDiagramQuality(firstAttempt.json, options.instruction, options.context, options.mode)
                    : null;

                if (json) {
                    const intentResult = this.validateImageAnalysisIntent(json, options);
                    if (intentResult.valid) {
                        return {
                            success: true,
                            json,
                            message: firstAttempt.content,
                            model: firstAttempt.requestBody.model
                        };
                    }

                    const repairPrompt = this.buildImageRepairPrompt(promptText, json, intentResult.errors, options);
                    const repairAttempt = await this.callOpenAIImageAnalysis(imageDataUrl, repairPrompt, {
                        previousResponseId: this.lastResponseId,
                        model: this.selectOpenAIImageModel(options, 'repair'),
                        reasoningEffort: 'medium',
                        detail: 'high'
                    });

                    if (repairAttempt.json) {
                        const repairedJson = this.enhanceDiagramQuality(
                            repairAttempt.json,
                            options.instruction,
                            options.context,
                            options.mode
                        );
                        const repairedIntentResult = this.validateImageAnalysisIntent(repairedJson, options);
                        if (repairedIntentResult.valid) {
                            return {
                                success: true,
                                json: repairedJson,
                                message: repairAttempt.content,
                                repaired: true,
                                repairErrors: intentResult.errors,
                                model: repairAttempt.requestBody.model,
                                initialModel: firstAttempt.requestBody.model
                            };
                        }

                        return {
                            success: false,
                            error: `AI patch semantic validation failed after repair: ${repairedIntentResult.errors.join(' ')}`,
                            message: repairAttempt.content,
                            json: repairedJson,
                            validationErrors: repairedIntentResult.errors
                        };
                    }

                    return {
                        success: false,
                        error: 'Repair response JSON parsing failed.',
                        message: repairAttempt.content,
                        validationErrors: intentResult.errors
                    };
                }

                return { success: false, error: 'JSON parsing failed.', message: firstAttempt.content };

            } else if (this.config.provider === 'gemini') {
                // Gemini Vision
                const base64Data = imageDataUrl.split(',')[1];
                const mimeType = this.getDataUrlMimeType(imageDataUrl);
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.config.apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: SYSTEM_PROMPT + '\n\n' + promptText },
                                    { inline_data: { mime_type: mimeType, data: base64Data } }
                                ]
                            }]
                        })
                    }
                );

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error?.message || 'Gemini Vision API 오류');
                }

                const data = await response.json();
                const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                const json = this.extractJSON(content);

                if (json) {
                    const enhancedJson = this.enhanceDiagramQuality(json, options.instruction, options.context, options.mode);
                    const intentResult = this.validateImageAnalysisIntent(enhancedJson, options);
                    if (intentResult.valid) {
                        return { success: true, json: enhancedJson, message: content };
                    }
                    return {
                        success: false,
                        error: `AI patch semantic validation failed: ${intentResult.errors.join(' ')}`,
                        message: content,
                        json: enhancedJson,
                        validationErrors: intentResult.errors
                    };
                }
                return { success: false, error: 'JSON 파싱 실패', message: content };
            }

            return { success: false, error: '지원하지 않는 프로바이더입니다.' };
        } catch (error) {
            console.error('이미지 분석 오류:', error);
            return { success: false, error: error.message };
        }
    }
}

export default AIService;
