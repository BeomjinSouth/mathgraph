/**
 * AIService.js - AI 서비스 모듈 (Mk.2)
 * 
 * LLM API를 통해 자연어를 그래프A JSON 명령으로 변환합니다.
 * 지원: OpenAI, Google Gemini
 */

import { parseAIJSONPayload } from './JSONUtils.js';

// AI 참조 문서에서 가져온 시스템 프롬프트
const SYSTEM_PROMPT = `당신은 수학 기하 도형을 생성하는 AI 어시스턴트입니다.
사용자의 요청을 분석하여 아래 JSON 스키마에 맞는 **구조화된 출력만** 생성합니다.

## 중요 규칙
1. JSON만 출력하세요. "그렸습니다" 같은 텍스트 없이 순수 JSON만 출력합니다.
2. 참조 순서를 준수하세요. 참조되는 객체(점)가 먼저 정의되어야 합니다.
3. 정수 좌표를 권장합니다. 예: (2, 0), (-3, 5)
4. 필수 필드를 포함하세요.

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
- vector: startPointId, endPointId
- rightAngleMarker: vertexId, line1Id, line2Id
- equalLengthMarker: segment1Id, segment2Id
- angleDimension: vertexId, point1Id, point2Id
- lengthDimension: segmentId
- arc, sector, circularSegment: circleId, startPointId, endPointId, mode ("minor" 또는 "major")
- prism: baseVertexIds (배열), topVertexIds (배열) - 각기둥
- pyramid: baseVertexIds (배열), apexId - 각뿔
- numberLine: start, end, step, y

### 선택적 공통 속성
- label: 객체 이름
- color: 색상 (HEX, 예: "#3b82f6")
- lineWidth: 선 굵기 (1-5)
- dashed: 점선 여부

## 예시

### 삼각형 ABC
{
  "operations": [
    { "op": "create", "type": "point", "id": "p1", "x": 0, "y": 0, "label": "A" },
    { "op": "create", "type": "point", "id": "p2", "x": 4, "y": 0, "label": "B" },
    { "op": "create", "type": "point", "id": "p3", "x": 2, "y": 3, "label": "C" },
    { "op": "create", "type": "segment", "id": "s1", "point1Id": "p1", "point2Id": "p2" },
    { "op": "create", "type": "segment", "id": "s2", "point1Id": "p2", "point2Id": "p3" },
    { "op": "create", "type": "segment", "id": "s3", "point1Id": "p3", "point2Id": "p1" }
  ]
}

### 외접원이 있는 삼각형
{
  "operations": [
    { "op": "create", "type": "point", "id": "p1", "x": 0, "y": 0, "label": "A" },
    { "op": "create", "type": "point", "id": "p2", "x": 4, "y": 0, "label": "B" },
    { "op": "create", "type": "point", "id": "p3", "x": 2, "y": 3, "label": "C" },
    { "op": "create", "type": "segment", "id": "s1", "point1Id": "p1", "point2Id": "p2" },
    { "op": "create", "type": "segment", "id": "s2", "point1Id": "p2", "point2Id": "p3" },
    { "op": "create", "type": "segment", "id": "s3", "point1Id": "p3", "point2Id": "p1" },
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

/**
 * AI 서비스 설정
 */
export class AIServiceConfig {
    constructor() {
        this.provider = 'openai'; // 'openai' | 'gemini' | 'local'
        this.apiKey = '';
        this.model = 'gpt-5.2'; // GPT-5.2 기본값
        this.reasoningEffort = 'low'; // none, low, medium, high, xhigh
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
            this.config.model = 'gpt-5.2'; // GPT-5.2 사용
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
            return this.fallbackProcessDeterministic(normalizedMessage, context);
        }

        try {
            const messages = this.buildMessages(normalizedMessage, context);

            let response;
            if (this.config.provider === 'openai') {
                response = await this.callOpenAI(messages);
            } else if (this.config.provider === 'gemini') {
                response = await this.callGemini(messages);
            } else {
                return this.fallbackProcessDeterministic(normalizedMessage, context);
            }

            // JSON 파싱
            const json = this.extractJSON(response);
            if (json) {
                return { success: true, json, message: response };
            } else {
                return this.fallbackProcessDeterministic(normalizedMessage, context);
            }
        } catch (error) {
            console.error('AI 처리 오류:', error);
            return this.fallbackProcessDeterministic(normalizedMessage, context);
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
        if (context && context.objects && context.objects.length > 0) {
            const contextStr = `현재 캔버스에는 다음 객체들이 있습니다:\n${context.objects.map(o => {
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
                if (Array.isArray(o.dependencies) && o.dependencies.length > 0) {
                    parts.push(`deps=${o.dependencies.join(',')}`);
                }

                return `- ${parts.join(', ')}`;
            }).join('\n')}\n\n새로운 객체를 추가할 때 기존 객체 id를 참조할 수 있습니다.`;
            messages.push({ role: 'system', content: contextStr });
        }

        // 대화 히스토리 추가 (최근 4개만)
        const recentHistory = this.conversationHistory.slice(-4);
        messages.push(...recentHistory);

        // 현재 사용자 메시지
        messages.push({ role: 'user', content: userMessage });

        return messages;
    }

    /**
     * OpenAI Responses API 호출 (GPT-5.2)
     * https://platform.openai.com/docs/guides/latest-model
     */
    async callOpenAI(messages) {
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
        const previousResponseId = this.lastResponseId || undefined;

        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`
            },
            body: JSON.stringify({
                model: this.config.model,
                input: [
                    { role: 'developer', content: systemContent },
                    { role: 'user', content: userContent }
                ],
                // GPT-5.2 reasoning 설정 - 기하 도형 생성은 복잡하지 않으므로 low
                reasoning: {
                    effort: 'low'
                },
                // 간결한 JSON 출력을 위해 low verbosity
                text: {
                    verbosity: 'low',
                    format: {
                        type: 'json_object'
                    }
                },
                // 이전 대화 컨텍스트 유지
                ...(previousResponseId && { previous_response_id: previousResponseId })
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI Responses API 오류');
        }

        const data = await response.json();

        // 응답 ID 저장 (다음 턴에서 chain-of-thought 유지)
        this.lastResponseId = data.id;

        // GPT-5.2 Responses API는 output 배열에서 텍스트 추출
        let content = '';
        if (data.output) {
            for (const item of data.output) {
                if (item.type === 'message' && item.content) {
                    for (const block of item.content) {
                        if (block.type === 'output_text') {
                            content += block.text;
                        }
                    }
                }
            }
        }

        // 대화 히스토리에 추가
        this.conversationHistory.push({ role: 'assistant', content });

        return content;
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
            return parseAIJSONPayload(text);
        } catch (e) {
            return null;
        }
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
                { op: 'create', type: 'segment', point1Id: 'p1', point2Id: 'p2' },
                { op: 'create', type: 'segment', point1Id: 'p2', point2Id: 'p3' },
                { op: 'create', type: 'segment', point1Id: 'p3', point2Id: 'p1' }
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
                { op: 'create', type: 'segment', point1Id: 'p1', point2Id: 'p2' },
                { op: 'create', type: 'segment', point1Id: 'p2', point2Id: 'p3' },
                { op: 'create', type: 'segment', point1Id: 'p3', point2Id: 'p4' },
                { op: 'create', type: 'segment', point1Id: 'p4', point2Id: 'p1' }
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

    /**
     * 이미지 분석 (비전 모델)
     * @param {string} imageDataUrl - Base64 인코딩된 이미지
     * @param {string} prompt - 분석 지시
     */
    async analyzeImage(imageDataUrl, prompt = '이 이미지에 있는 도형을 그래프A JSON으로 변환해주세요.') {
        if (!this.config.apiKey) {
            return {
                success: false,
                error: 'AI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.'
            };
        }

        try {
            if (this.config.provider === 'openai') {
                // GPT-5.2 Responses API로 이미지 분석
                const response = await fetch('https://api.openai.com/v1/responses', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.config.apiKey}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-5.2',
                        input: [
                            { role: 'developer', content: SYSTEM_PROMPT },
                            {
                                role: 'user',
                                content: [
                                    { type: 'input_text', text: prompt },
                                    { type: 'input_image', image_url: imageDataUrl, detail: 'high' }
                                ]
                            }
                        ],
                        reasoning: { effort: 'medium' }, // 이미지 분석은 더 깊은 추론 필요
                        text: { verbosity: 'low', format: { type: 'json_object' } }
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error?.message || 'OpenAI GPT-5.2 Vision API 오류');
                }

                const data = await response.json();
                // GPT-5.2 응답에서 텍스트 추출
                let content = '';
                if (data.output) {
                    for (const item of data.output) {
                        if (item.type === 'message' && item.content) {
                            for (const block of item.content) {
                                if (block.type === 'output_text') {
                                    content += block.text;
                                }
                            }
                        }
                    }
                }
                const json = this.extractJSON(content);

                if (json) {
                    return { success: true, json, message: content };
                }
                return { success: false, error: 'JSON 파싱 실패', message: content };
            } else if (this.config.provider === 'gemini') {
                // Gemini Vision
                const base64Data = imageDataUrl.split(',')[1];
                const response = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.config.apiKey}`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{
                                parts: [
                                    { text: SYSTEM_PROMPT + '\n\n' + prompt },
                                    { inline_data: { mime_type: 'image/png', data: base64Data } }
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
                    return { success: true, json, message: content };
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
