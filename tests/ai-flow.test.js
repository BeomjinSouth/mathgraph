import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { parseAIJSONPayload } from '../js/ai/JSONUtils.js';
import {
    AIService,
    DEFAULT_OPENAI_MODEL,
    GRAPH_OPERATIONS_RESPONSE_FORMAT,
    DEFAULT_IMAGE_RECREATE_INSTRUCTION,
    IMAGE_RECREATE_OPERATION_BUDGET,
    OPENAI_IMAGE_FAST_MODEL,
    AI_IMAGE_PREPROCESS_MAX_LONG_EDGE,
    AI_IMAGE_PREPROCESS_MIN_LONG_EDGE,
    chooseImagePreprocessPlan,
    extractOpenAIResponseText
} from '../js/ai/AIService.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';

const manual = JSON.parse(
    readFileSync(new URL('../.agents/skills/mathgraph-drawing/references/feature-manual.json', import.meta.url), 'utf8')
);
const retrievalIndex = JSON.parse(
    readFileSync(new URL('../.agents/skills/mathgraph-drawing/references/retrieval-index.json', import.meta.url), 'utf8')
);

function createAIService() {
    return new AIService({
        provider: 'local',
        apiKey: '',
        save() { }
    });
}

const TEST_REFERENCE_MANUAL = {
    defaultStylePolicy: {
        colorFieldGuidance: 'Omit color unless the user explicitly asks for it.'
    },
    operationContract: {
        supportedCreateTypes: ['point', 'segment', 'circle', 'sector', 'function', 'prism', 'pyramid']
    },
    aiCreatableObjects: [
        { type: 'point', requiredFields: ['x', 'y'], optionalFields: ['label', 'color', 'pointSize'] },
        { type: 'circle', requiredFields: ['centerId', 'pointOnCircleId'], optionalFields: ['label'] },
        { type: 'sector', requiredFields: ['circleId', 'startPointId', 'endPointId'], optionalFields: ['mode', 'fillOpacity'] },
        { type: 'function', requiredFields: ['expression'], optionalFields: ['label'] },
        { type: 'prism', requiredFields: ['baseVertexIds', 'topVertexIds'], optionalFields: ['label'] },
        { type: 'pyramid', requiredFields: ['baseVertexIds', 'apexId'], optionalFields: ['label'] }
    ],
    knownGapsAndApproximations: [
        {
            gap: 'Curved solid primitives are not first-class objects.',
            currentApproximation: 'Approximate cylinders with composed supported primitives.'
        }
    ],
    visualGuardrails: [
        'For construction-only polygons that should look like outlines, set fillOpacity:0.',
        'For angleDimension, helper points must be distinct from the vertex.'
    ]
};

const TEST_REFERENCE_INDEX = {
    chunks: [
        { id: 'objects-circle-core', objectTypes: ['point', 'circle', 'sector'] },
        { id: 'objects-solid', objectTypes: ['point', 'prism', 'pyramid'] }
    ]
};

function createPatchHarness() {
    const objects = new Map();
    const history = [];
    let pointCount = 0;
    let polygonCount = 0;
    let lensCount = 0;

    const objectManager = {
        selectedObjects: new Set(),
        highlightedObject: null,
        toJSON() {
            return { objects: Array.from(objects.values()).map(obj => obj.toJSON()) };
        },
        fromJSON() { },
        updateAll() { },
        updateObject() { },
        getObject(id) {
            return objects.get(id) || null;
        },
        getDependents() {
            return [];
        },
        removeObject(id) {
            objects.delete(id);
        },
        clearSelection() { },
        selectObject() { },
        clearHighlight() { },
        highlightObject() { },
        createPoint(x, y, params = {}) {
            const obj = {
                id: `point_${++pointCount}`,
                type: 'point',
                x,
                y,
                ...params,
                toJSON() {
                    return {
                        id: this.id,
                        type: this.type,
                        x: this.x,
                        y: this.y,
                        label: this.label,
                        color: this.color
                    };
                }
            };
            objects.set(obj.id, obj);
            return obj;
        },
        createPolygon(vertexIds, params = {}) {
            const obj = {
                id: `polygon_${++polygonCount}`,
                type: 'polygon',
                vertexIds,
                ...params,
                toJSON() {
                    return {
                        id: this.id,
                        type: this.type,
                        vertexIds: this.vertexIds,
                        fillColor: this.fillColor,
                        fillOpacity: this.fillOpacity
                    };
                }
            };
            objects.set(obj.id, obj);
            return obj;
        },
        createLensRegion(circle1Id, circle2Id, params = {}) {
            const obj = {
                id: `lens_${++lensCount}`,
                type: 'lensRegion',
                circle1Id,
                circle2Id,
                ...params,
                toJSON() {
                    return {
                        id: this.id,
                        type: this.type,
                        circle1Id: this.circle1Id,
                        circle2Id: this.circle2Id,
                        fillColor: this.fillColor,
                        fillOpacity: this.fillOpacity
                    };
                }
            };
            objects.set(obj.id, obj);
            return obj;
        },
        createRightAngleMarker(vertexId, line1Id, line2Id, params = {}) {
            const obj = {
                id: 'marker_1',
                type: 'rightAngleMarker',
                vertexId,
                line1Id,
                line2Id,
                ...params,
                toJSON() {
                    return {
                        id: this.id,
                        type: this.type,
                        vertexId: this.vertexId,
                        line1Id: this.line1Id,
                        line2Id: this.line2Id
                    };
                }
            };
            objects.set(obj.id, obj);
            return obj;
        },
        createPointOnCircle(circleId, angle, params = {}) {
            const obj = {
                id: 'point_on_circle_1',
                type: 'pointOnObject',
                circleId,
                angle,
                ...params,
                toJSON() {
                    return {
                        id: this.id,
                        type: this.type,
                        circleId: this.circleId,
                        angle: this.angle
                    };
                }
            };
            objects.set(obj.id, obj);
            return obj;
        },
        createCircleCenterPoint(circleId, params = {}) {
            const obj = {
                id: 'center_point_1',
                type: 'pointOnObject',
                circleId,
                ...params,
                toJSON() {
                    return {
                        id: this.id,
                        type: this.type,
                        circleId: this.circleId
                    };
                }
            };
            objects.set(obj.id, obj);
            return obj;
        },
        createNumberLine(params = {}) {
            const obj = {
                id: 'number_line_1',
                type: 'numberLine',
                ...params,
                toJSON() {
                    return {
                        id: this.id,
                        type: this.type,
                        start: this.start,
                        end: this.end,
                        step: this.step,
                        y: this.y
                    };
                }
            };
            objects.set(obj.id, obj);
            return obj;
        }
    };

    const historyManager = {
        recordCreate(object) {
            history.push(['create', object.id]);
        },
        recordDelete(objectsToDelete) {
            history.push(['delete', Array.isArray(objectsToDelete) ? objectsToDelete.length : 1]);
        },
        recordPropertyChange(objectId, property, oldValue, newValue) {
            history.push(['property', objectId, property, oldValue, newValue]);
        },
        createSnapshot() {
            return { history: [...history] };
        },
        restoreSnapshot() { }
    };

    return { objectManager, historyManager, objects, history };
}

test('parseAIJSONPayload extracts JSON from prose and code fences', () => {
    const parsedFromFence = parseAIJSONPayload('```json\n{"operations":[{"op":"create","type":"point","x":1,"y":2}]}\n```');
    assert.equal(parsedFromFence.operations[0].type, 'point');

    const parsedFromProse = parseAIJSONPayload('설명입니다.\n[{"op":"create","type":"point","x":3,"y":4}]\n끝');
    assert.equal(Array.isArray(parsedFromProse), true);
    assert.equal(parsedFromProse[0].x, 3);
});

test('AIService defaults to current OpenAI reference model', () => {
    const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
        save() { }
    });

    assert.equal(service.config.model, DEFAULT_OPENAI_MODEL);
    assert.equal(DEFAULT_OPENAI_MODEL, 'gpt-5.5');
});

test('AIService builds OpenAI Responses request with strict Structured Outputs', () => {
    const service = new AIService({
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-5.4-mini',
        reasoningEffort: 'medium',
        verbosity: 'high',
        save() { }
    });
    service.lastResponseId = 'resp_previous';

    const body = service.buildOpenAIRequestBody([
        { role: 'system', content: 'system rules' },
        { role: 'user', content: '삼각형을 그려줘' }
    ]);

    assert.equal(body.model, 'gpt-5.4-mini');
    assert.equal(body.store, false);
    assert.deepEqual(body.reasoning, { effort: 'medium' });
    assert.equal(body.text.verbosity, 'high');
    assert.equal(body.text.format, GRAPH_OPERATIONS_RESPONSE_FORMAT);
    assert.equal(body.text.format.type, 'json_schema');
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.additionalProperties, false);
    assert.deepEqual(body.text.format.schema.required, ['operations']);
    assert.equal(body.previous_response_id, 'resp_previous');
});

test('AIService callOpenAI sends Structured Outputs request and extracts output text', async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = null;
    let capturedOptions = null;

    globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
            ok: true,
            async json() {
                return {
                    id: 'resp_next',
                    output: [
                        {
                            type: 'message',
                            content: [
                                {
                                    type: 'output_text',
                                    text: '{"operations":[{"op":"create","type":"point","x":1,"y":2}]}'
                                }
                            ]
                        }
                    ]
                };
            }
        };
    };

    try {
        const service = new AIService({
            provider: 'openai',
            apiKey: 'test-key',
            model: 'gpt-5.4-mini',
            reasoningEffort: 'low',
            verbosity: 'low',
            save() { }
        });

        const content = await service.callOpenAI([
            { role: 'system', content: 'system rules' },
            { role: 'user', content: '점 하나' }
        ]);

        const body = JSON.parse(capturedOptions.body);
        assert.equal(capturedUrl, 'https://api.openai.com/v1/responses');
        assert.equal(capturedOptions.headers.Authorization, 'Bearer test-key');
        assert.equal(body.text.format.type, 'json_schema');
        assert.equal(body.text.format.strict, true);
        assert.equal(body.store, false);
        assert.equal(content, '{"operations":[{"op":"create","type":"point","x":1,"y":2}]}');
        assert.equal(service.lastResponseId, 'resp_next');
        assert.equal(service.lastRequestModel, 'gpt-5.4-mini');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('processCommand includes actual API model in successful OpenAI result', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => ({
        ok: true,
        async json() {
            return {
                id: 'resp_model_meta',
                output: [
                    {
                        type: 'message',
                        content: [
                            {
                                type: 'output_text',
                                text: JSON.stringify({
                                    operations: [
                                        { op: 'create', id: 'A', type: 'point', x: 1, y: 2, label: 'A' }
                                    ]
                                })
                            }
                        ]
                    }
                ]
            };
        }
    });

    try {
        const service = new AIService({
            provider: 'openai',
            apiKey: 'test-key',
            model: 'gpt-5.4-mini',
            referenceManual: TEST_REFERENCE_MANUAL,
            referenceIndex: TEST_REFERENCE_INDEX,
            save() { }
        });

        const result = await service.processCommand('create point A', { objects: [] });

        assert.equal(result.success, true);
        assert.equal(result.model, 'gpt-5.4-mini');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('AIService strips nullable Structured Output fields before validation', () => {
    const service = createAIService();
    const parsed = service.extractJSON({
        operations: [
            {
                op: 'create',
                id: 'p1',
                type: 'point',
                label: null,
                x: 1,
                y: 2,
                color: null
            }
        ]
    });

    assert.deepEqual(parsed, {
        operations: [
            {
                op: 'create',
                id: 'p1',
                type: 'point',
                x: 1,
                y: 2
            }
        ]
    });
});

test('AIService enhances command JSON with readable labels and right-angle aids', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () => ({
        ok: true,
        async json() {
            return {
                id: 'resp_quality',
                output: [
                    {
                        type: 'message',
                        content: [
                            {
                                type: 'output_text',
                                text: JSON.stringify({
                                    operations: [
                                        { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
                                        { op: 'create', id: 'A', type: 'point', x: 4, y: 0, label: 'A' },
                                        { op: 'create', id: 'B', type: 'point', x: 0, y: 4, label: 'B' },
                                        { op: 'create', id: 'OA', type: 'segment', point1Id: 'O', point2Id: 'A', showLabel: false },
                                        { op: 'create', id: 'OB', type: 'segment', point1Id: 'O', point2Id: 'B', showLabel: false },
                                        { op: 'create', id: 'right_O', type: 'rightAngleMarker', vertexId: 'O', line1Id: 'OA', line2Id: 'OB' },
                                        { op: 'create', id: 'T2', type: 'point', x: 1.8, y: -2.4, label: 'T2' }
                                    ]
                                })
                            }
                        ]
                    }
                ]
            };
        }
    });

    try {
        const service = new AIService({
            provider: 'openai',
            apiKey: 'test-key',
            model: 'gpt-5.4-mini',
            referenceManual: TEST_REFERENCE_MANUAL,
            referenceIndex: TEST_REFERENCE_INDEX,
            save() { }
        });

        const result = await service.processCommand('동심원 부채꼴의 90도 방향과 외부점 접선 T2 라벨을 그려줘', { objects: [] });
        const angleAid = result.json.operations.find(operation => operation.type === 'angleDimension');
        const t2 = result.json.operations.find(operation => operation.id === 'T2');

        assert.equal(result.success, true);
        assert.equal(angleAid.vertexId, 'O');
        assert.equal(angleAid.arcRadius, 0.75);
        assert.equal(angleAid.showValue, false);
        assert.ok(Math.hypot(t2.labelOffset.x, t2.labelOffset.y) >= 8);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('AIService expands weak prism cross-section layouts before application', () => {
    const service = createAIService();
    const enhanced = service.enhanceDiagramQuality({
        operations: weakPrismCrossSectionOperations()
    }, '직육면체 prism을 그리고 가운데 사각 단면을 크게 표시해줘');

    const prism = enhanced.operations.find(operation => operation.type === 'prism');
    const section = enhanced.operations.find(operation => operation.id === 'sec1');
    const outerBounds = boundsForIds(enhanced.operations, [...prism.baseVertexIds, ...prism.topVertexIds]);
    const sectionBounds = boundsForIds(enhanced.operations, section.vertexIds);
    const outerWidth = outerBounds.maxX - outerBounds.minX;
    const outerHeight = outerBounds.maxY - outerBounds.minY;
    const sectionWidth = sectionBounds.maxX - sectionBounds.minX;
    const sectionHeight = sectionBounds.maxY - sectionBounds.minY;

    assert.ok(outerWidth >= 7);
    assert.ok(outerHeight >= 5);
    assert.ok(outerWidth / outerHeight >= 1.25);
    assert.ok(sectionWidth / outerWidth >= 0.5);
    assert.ok(sectionHeight / outerHeight >= 0.4);
});

test('AIService recenters cramped triangular pyramid inside triangular prism layouts', () => {
    const service = createAIService();
    const enhanced = service.enhanceDiagramQuality({
        operations: crampedTriangularPyramidInsidePrismOperations()
    }, '큰 삼각기둥 안에 작은 삼각뿔이 들어 있는 모습을 그려줘');

    const prism = enhanced.operations.find(operation => operation.type === 'prism');
    const pyramid = enhanced.operations.find(operation => operation.type === 'pyramid');
    const outerBounds = boundsForIds(enhanced.operations, [...prism.baseVertexIds, ...prism.topVertexIds]);
    const innerBounds = boundsForIds(enhanced.operations, [...pyramid.baseVertexIds, pyramid.apexId]);
    const outerWidth = outerBounds.maxX - outerBounds.minX;
    const outerHeight = outerBounds.maxY - outerBounds.minY;
    const minMargin = Math.min(
        (innerBounds.minX - outerBounds.minX) / outerWidth,
        (outerBounds.maxX - innerBounds.maxX) / outerWidth,
        (innerBounds.minY - outerBounds.minY) / outerHeight,
        (outerBounds.maxY - innerBounds.maxY) / outerHeight
    );

    assert.ok(outerWidth >= 7);
    assert.ok(outerHeight >= 5.8);
    assert.ok(minMargin >= 0.25);
});

test('extractOpenAIResponseText supports output_text and parsed responses', () => {
    assert.equal(
        extractOpenAIResponseText({
            output: [
                { type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }
            ]
        }),
        '{"ok":true}'
    );

    assert.equal(
        extractOpenAIResponseText({ output_parsed: { operations: [] } }),
        '{"operations":[]}'
    );
});

test('AIService builds image prompts for recreation and targeted patching', () => {
    const service = createAIService();
    const recreatePrompt = service.buildImageAnalysisPrompt('', null, 'recreate');

    assert.match(recreatePrompt, /이미지 재현/);
    assert.match(recreatePrompt, /사진이 문제 전체 페이지/);
    assert.match(recreatePrompt, /상대 위치를 최대한 보존/);
    assert.match(recreatePrompt, /문제 본문, 보기, 긴 설명/);
    assert.match(recreatePrompt, /GraphA operations\[\]/);
    assert.match(recreatePrompt, new RegExp(DEFAULT_IMAGE_RECREATE_INSTRUCTION.slice(0, 12)));

    const patchPrompt = service.buildImageAnalysisPrompt('점 A만 빨간색으로 바꿔줘', {
        objects: [
            { id: 'point_a', type: 'point', label: 'A', x: 0, y: 0 }
        ],
        selectedObjectIds: ['point_a']
    }, 'patch');

    assert.match(patchPrompt, /부분 수정 패치/);
    assert.match(patchPrompt, /point_a/);
    assert.match(patchPrompt, /관련 없는 객체/);
    assert.equal(service.getDataUrlMimeType('data:image/jpeg;base64,AAAA'), 'image/jpeg');
});

test('AIService adds problem-situation graphing guidance for full problem text', () => {
    const service = createAIService();
    const problemText = [
        '다음은 좌표평면에서 움직이는 점 P에 대한 문제이다.',
        '점 P는 함수 y = x^2 - 4x + 3 위를 움직이고, 직선 y = x + 1과 만나는 두 점을 A, B라 한다.',
        '선분 AB와 x축으로 둘러싸인 부분의 넓이를 구하여라.'
    ].join('\n');

    assert.equal(service.isLikelyProblemStatement(problemText), true);
    assert.equal(service.isLikelyProblemStatement('삼각형 ABC를 그려줘'), false);

    const messages = service.buildMessages(problemText, { objects: [] });
    const joined = messages.map(message => message.content).join('\n\n');

    assert.match(joined, /문제 상황 그래프 생성/);
    assert.match(joined, /문제를 풀거나 정답을 말하지 말고/);
    assert.match(joined, /조건을 설명하는 데 가장 유용한/);
});

test('AIService builds compact prompt references from the JSON feature manual', async () => {
    const service = new AIService({
        provider: 'local',
        apiKey: '',
        referenceManual: TEST_REFERENCE_MANUAL,
        referenceIndex: TEST_REFERENCE_INDEX,
        save() { }
    });

    const referencePrompt = await service.buildDrawingReferencePrompt(
        '원기둥과 원의 부채꼴을 교과서 그림처럼 다시 그려줘',
        { objects: [] },
        'recreate'
    );

    assert.match(referencePrompt, /MathGraph reference manual context/);
    assert.match(referencePrompt, /feature-manual\.json/);
    assert.match(referencePrompt, /sector: required circleId, startPointId, endPointId/);
    assert.match(referencePrompt, /Curved solid primitives are not first-class objects/);
    assert.match(referencePrompt, new RegExp(String(IMAGE_RECREATE_OPERATION_BUDGET)));
    assert.match(referencePrompt, /Visual fidelity guardrails/);
    assert.match(referencePrompt, /fillOpacity:0/);

    const imagePrompt = service.buildImageAnalysisPrompt(
        '원기둥과 원의 부채꼴',
        null,
        'recreate',
        referencePrompt
    );
    assert.match(imagePrompt, /MathGraph reference manual context/);
});

test('AIService can build prompt references from the real JSON manual', () => {
    const service = createAIService();
    const referencePrompt = service.buildDrawingReferencePromptFromManual(
        manual,
        retrievalIndex,
        'histogram scatter plot',
        null,
        'recreate'
    );

    assert.match(referencePrompt, /feature-manual\.json/);
    assert.match(referencePrompt, /polygon/);
    assert.match(referencePrompt, /numberLine/);
    assert.match(referencePrompt, /Statistical chart primitives/);
    assert.match(referencePrompt, /Visual fidelity guardrails/);
    assert.match(referencePrompt, /angleDimension/);
});

test('SchemaValidator rejects selected-object patch responses that ignore the selected id', () => {
    const validator = new SchemaValidator();

    const invalid = validator.validateIntent({
        operations: [
            { op: 'create', id: 'new_sector', type: 'sector', circleId: 'circle_1', startPointId: 'a', endPointId: 'b' }
        ]
    }, {
        mode: 'patch',
        instruction: '선택한 점 A만 빨간색으로 크게 바꿔줘',
        context: { selectedObjectIds: ['point_a'] }
    });

    assert.equal(invalid.valid, false);
    assert.match(invalid.errors.join('\n'), /must update or delete at least one selected object id/);
    assert.match(invalid.errors.join('\n'), /cannot create new objects/);

    const valid = validator.validateIntent({
        operations: [
            { op: 'update', id: 'point_a', color: '#ef4444', pointSize: 10 }
        ]
    }, {
        mode: 'patch',
        instruction: '선택한 점 A만 빨간색으로 크게 바꿔줘',
        context: { selectedObjectIds: ['point_a'] }
    });

    assert.equal(valid.valid, true);
});

test('SchemaValidator enforces image recreation operation budget', () => {
    const validator = new SchemaValidator();
    const operations = Array.from({ length: IMAGE_RECREATE_OPERATION_BUDGET + 1 }, (_, index) => ({
        op: 'create',
        id: `p${index}`,
        type: 'point',
        x: index,
        y: 0
    }));

    const result = validator.validateIntent({ operations }, {
        mode: 'recreate',
        maxOperations: IMAGE_RECREATE_OPERATION_BUDGET
    });

    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /operation budget/);
});

test('chooseImagePreprocessPlan downsizes oversized images without crossing readability floor', () => {
    const plan = chooseImagePreprocessPlan(
        { width: 4032, height: 3024 },
        { x: 180, y: 120, width: 3600, height: 2500 }
    );

    assert.equal(plan.crop.applied, true);
    assert.equal(plan.resized, true);
    assert.ok(Math.max(plan.processedWidth, plan.processedHeight) <= AI_IMAGE_PREPROCESS_MAX_LONG_EDGE);
    assert.ok(Math.max(plan.processedWidth, plan.processedHeight) >= AI_IMAGE_PREPROCESS_MIN_LONG_EDGE);
    assert.ok(plan.scale < 1);
});

test('chooseImagePreprocessPlan keeps already readable images unchanged', () => {
    const plan = chooseImagePreprocessPlan({ width: 1100, height: 780 });

    assert.equal(plan.crop.applied, false);
    assert.equal(plan.resized, false);
    assert.equal(plan.processedWidth, 1100);
    assert.equal(plan.processedHeight, 780);
    assert.equal(plan.scale, 1);
});

test('chooseImagePreprocessPlan rejects suspicious tiny crops', () => {
    const plan = chooseImagePreprocessPlan(
        { width: 4032, height: 3024 },
        { x: 1900, y: 1400, width: 120, height: 80 }
    );

    assert.equal(plan.crop.applied, false);
    assert.equal(plan.resized, true);
    assert.equal(plan.processedWidth, AI_IMAGE_PREPROCESS_MAX_LONG_EDGE);
});

test('AIService analyzeImage sends image input with targeted patch prompt', async () => {
    const originalFetch = globalThis.fetch;
    let capturedUrl = null;
    let capturedOptions = null;

    globalThis.fetch = async (url, options) => {
        capturedUrl = url;
        capturedOptions = options;
        return {
            ok: true,
            async json() {
                return {
                    id: 'resp_image_patch',
                    output: [
                        {
                            type: 'message',
                            content: [
                                {
                                    type: 'output_text',
                                    text: '{"operations":[{"op":"update","id":"point_a","color":"#ef4444"}]}'
                                }
                            ]
                        }
                    ]
                };
            }
        };
    };

    try {
        const service = new AIService({
            provider: 'openai',
            apiKey: 'test-key',
            model: 'gpt-5.4-mini',
            save() { }
        });

        const result = await service.analyzeImage('data:image/png;base64,AAAA', {
            instruction: '점 A만 빨간색으로 바꿔줘',
            mode: 'patch',
            context: {
                objects: [{ id: 'point_a', type: 'point', label: 'A', x: 0, y: 0 }],
                selectedObjectIds: ['point_a']
            }
        });

        const body = JSON.parse(capturedOptions.body);
        const userContent = body.input[1].content;

        assert.equal(capturedUrl, 'https://api.openai.com/v1/responses');
        assert.equal(result.success, true);
        assert.equal(result.json.operations[0].op, 'update');
        assert.equal(service.lastResponseId, 'resp_image_patch');
        assert.equal(body.model, OPENAI_IMAGE_FAST_MODEL);
        assert.equal(body.store, false);
        assert.equal(body.reasoning.effort, 'medium');
        assert.equal(body.text.format.type, 'json_schema');
        assert.equal(userContent[0].type, 'input_text');
        assert.match(userContent[0].text, /부분 수정 패치/);
        assert.match(userContent[0].text, /point_a/);
        assert.deepEqual(userContent[1], {
            type: 'input_image',
            image_url: 'data:image/png;base64,AAAA',
            detail: 'high'
        });
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('AIService analyzeImage sends full-photo recreate prompt for image-only input', async () => {
    const originalFetch = globalThis.fetch;
    let capturedOptions = null;

    globalThis.fetch = async (url, options) => {
        capturedOptions = options;
        return {
            ok: true,
            async json() {
                return {
                    id: 'resp_image_recreate',
                    output: [
                        {
                            type: 'message',
                            content: [
                                {
                                    type: 'output_text',
                                    text: '{"operations":[{"op":"create","id":"point_a","type":"point","x":0,"y":0,"label":"A"}]}'
                                }
                            ]
                        }
                    ]
                };
            }
        };
    };

    try {
        const service = new AIService({
            provider: 'openai',
            apiKey: 'test-key',
            model: 'gpt-5.4-mini',
            save() { }
        });

        const result = await service.analyzeImage('data:image/png;base64,AAAA', {
            mode: 'recreate',
            context: { objects: [], selectedObjectIds: [] }
        });

        const body = JSON.parse(capturedOptions.body);
        const userContent = body.input[1].content;

        assert.equal(result.success, true);
        assert.equal(result.json.operations[0].type, 'point');
        assert.equal(body.model, OPENAI_IMAGE_FAST_MODEL);
        assert.match(userContent[0].text, /사진이 문제 전체 페이지/);
        assert.match(userContent[0].text, /점, 선분, 직선, 원, 호/);
        assert.deepEqual(userContent[1], {
            type: 'input_image',
            image_url: 'data:image/png;base64,AAAA',
            detail: 'high'
        });
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('AIService retries image patch when semantic validation rejects the first response', async () => {
    const originalFetch = globalThis.fetch;
    const capturedBodies = [];

    globalThis.fetch = async (url, options) => {
        capturedBodies.push(JSON.parse(options.body));
        const firstCall = capturedBodies.length === 1;
        return {
            ok: true,
            async json() {
                return {
                    id: firstCall ? 'resp_bad_patch' : 'resp_repaired_patch',
                    output: [
                        {
                            type: 'message',
                            content: [
                                {
                                    type: 'output_text',
                                    text: firstCall
                                        ? '{"operations":[{"op":"create","id":"new_sector","type":"sector","circleId":"circle_1","startPointId":"a","endPointId":"b"}]}'
                                        : '{"operations":[{"op":"update","id":"point_a","color":"#ef4444","pointSize":10}]}'
                                }
                            ]
                        }
                    ]
                };
            }
        };
    };

    try {
        const service = new AIService({
            provider: 'openai',
            apiKey: 'test-key',
            model: 'gpt-5.4-mini',
            referenceManual: TEST_REFERENCE_MANUAL,
            referenceIndex: TEST_REFERENCE_INDEX,
            save() { }
        });

        const result = await service.analyzeImage('data:image/png;base64,AAAA', {
            instruction: '선택한 점 A만 빨간색으로 크게 바꿔줘',
            mode: 'patch',
            context: {
                objects: [{ id: 'point_a', type: 'point', label: 'A', x: 0, y: 0 }],
                selectedObjectIds: ['point_a']
            }
        });

        assert.equal(result.success, true);
        assert.equal(result.repaired, true);
        assert.equal(result.json.operations[0].op, 'update');
        assert.equal(result.json.operations[0].id, 'point_a');
        assert.equal(capturedBodies.length, 2);
        assert.equal(capturedBodies[0].model, OPENAI_IMAGE_FAST_MODEL);
        assert.equal(capturedBodies[1].model, DEFAULT_OPENAI_MODEL);
        assert.match(capturedBodies[0].input[1].content[0].text, /MathGraph reference manual context/);
        assert.match(capturedBodies[1].input[1].content[0].text, /failed local semantic validation/);
        assert.equal(capturedBodies[1].previous_response_id, 'resp_bad_patch');
        assert.equal(service.lastResponseId, 'resp_repaired_patch');
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('legacy fallback parses circle center and radius requests', () => {
    const service = createAIService();
    const result = service.fallbackProcess('중심이 (2, 0)이고 반지름 5인 원을 그려줘');

    assert.equal(result.success, true);
    assert.equal(result.json.operations.at(-1).type, 'circle');
    assert.deepEqual(result.json.operations[0], {
        op: 'create',
        type: 'point',
        id: 'circle_center',
        x: 2,
        y: 0,
        label: 'O'
    });
    assert.deepEqual(result.json.operations[1], {
        op: 'create',
        type: 'point',
        id: 'circle_edge',
        x: 7,
        y: 0,
        label: 'P'
    });
});

test('legacy fallback strips graph suffix from function expressions', () => {
    const service = createAIService();
    const result = service.fallbackProcess('y = x^2 그래프');

    assert.equal(result.success, true);
    assert.equal(result.json.operations[0].type, 'function');
    assert.equal(result.json.operations[0].expression, 'x^2');
});

test('processCommand uses local fallback when no API key is configured', async () => {
    const service = createAIService();
    const result = await service.processCommand('y = x^2 graph', { objects: [] });

    assert.equal(result.success, true);
    assert.equal(result.json.operations[0].type, 'function');
    assert.equal(result.json.operations[0].expression, 'x^2');
});

test('legacy fallback does not create a new circle for delete requests', () => {
    const service = createAIService();
    const result = service.fallbackProcess('원을 지워줘');

    assert.equal(result.success, false);
    assert.match(result.error, /삭제 요청/);
});

test('deterministic fallback creates a midpoint from named endpoints', () => {
    const service = createAIService();
    const result = service.fallbackProcessDeterministic('선분 AB의 중점', {
        objects: [
            { id: 'point_a', type: 'point', label: 'A', x: 0, y: 0, dependencies: [] },
            { id: 'point_b', type: 'point', label: 'B', x: 4, y: 0, dependencies: [] }
        ]
    });

    assert.equal(result.success, true);
    assert.equal(result.json.operations.at(-1).type, 'midpoint');
});

test('deterministic fallback creates a tangent for inline function requests', () => {
    const service = createAIService();
    const result = service.fallbackProcessDeterministic('y = x^2의 x=1에서 접선', { objects: [] });

    assert.equal(result.success, true);
    assert.equal(result.json.operations[0].type, 'function');
    assert.equal(result.json.operations[1].type, 'tangentFunction');
    assert.equal(result.json.operations[1].x, 1);
});

test('deterministic fallback parses standard-form circle equations', () => {
    const service = createAIService();
    const result = service.fallbackProcessDeterministic('(x-2)^2 + (y+1)^2 = 9', { objects: [] });

    assert.equal(result.success, true);
    assert.equal(result.json.operations.at(-1).type, 'circle');
    assert.equal(result.json.operations[0].x, 2);
    assert.equal(result.json.operations[0].y, -1);
});

test('deterministic fallback parses linear equations into lines', () => {
    const service = createAIService();
    const result = service.fallbackProcessDeterministic('2x + 3y = 6', { objects: [] });

    assert.equal(result.success, true);
    assert.equal(result.json.operations.at(-1).type, 'line');
});

test('SchemaValidator accepts right angle markers and dimensions', () => {
    const validator = new SchemaValidator();
    const validation = validator.parseAndValidate({
        operations: [
            { op: 'create', type: 'rightAngleMarker', vertexId: 'V', line1Id: 'L1', line2Id: 'L2' },
            { op: 'create', type: 'angleDimension', vertexId: 'B', point1Id: 'A', point2Id: 'C' }
        ]
    });

    assert.equal(validation.valid, true);
});

test('SchemaValidator accepts point helpers and number lines', () => {
    const validator = new SchemaValidator();
    const validation = validator.parseAndValidate({
        operations: [
            { op: 'create', type: 'pointOnCircle', circleId: 'C1', angle: 0 },
            { op: 'create', type: 'circleCenterPoint', circleId: 'C1' },
            { op: 'create', type: 'numberLine', start: -3, end: 3, step: 0.5, y: 1 }
        ]
    });

    assert.equal(validation.valid, true);
});

test('SchemaValidator accepts polygons with three or more vertices', () => {
    const validator = new SchemaValidator();
    const validation = validator.parseAndValidate({
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0 },
            { op: 'create', id: 'B', type: 'point', x: 4, y: 0 },
            { op: 'create', id: 'C', type: 'point', x: 2, y: 3 },
            { op: 'create', type: 'polygon', vertexIds: ['A', 'B', 'C'], fillColor: '#3b82f6', fillOpacity: 0.12 }
        ]
    });

    assert.equal(validation.valid, true);
});

test('SchemaValidator accepts lens regions between two circles', () => {
    const validator = new SchemaValidator();
    const payload = {
        operations: [
            { op: 'create', id: 'O1', type: 'point', x: -1, y: 0 },
            { op: 'create', id: 'A1', type: 'point', x: 1, y: 0 },
            { op: 'create', id: 'O2', type: 'point', x: 1, y: 0 },
            { op: 'create', id: 'A2', type: 'point', x: -1, y: 0 },
            { op: 'create', id: 'c1', type: 'circle', centerId: 'O1', pointOnCircleId: 'A1' },
            { op: 'create', id: 'c2', type: 'circle', centerId: 'O2', pointOnCircleId: 'A2' },
            { op: 'create', id: 'lens', type: 'lensRegion', circle1Id: 'c1', circle2Id: 'c2', fillOpacity: 0.24 }
        ]
    };

    const validation = validator.parseAndValidate(payload);
    const references = validator.validateReferences(payload, new Set());

    assert.equal(validation.valid, true, validation.errors.join('\n'));
    assert.equal(references.valid, true, references.errors.join('\n'));
});

test('SchemaValidator rejects polygons with too few vertices', () => {
    const validator = new SchemaValidator();
    const validation = validator.parseAndValidate({
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0 },
            { op: 'create', id: 'B', type: 'point', x: 4, y: 0 },
            { op: 'create', type: 'polygon', vertexIds: ['A', 'B'] }
        ]
    });

    assert.equal(validation.valid, false);
    assert.match(validation.errors.join('\n'), /at least 3 vertices/);
});

test('PatchApplier supports marker creation and common style fields', () => {
    const { objectManager, historyManager, objects, history } = createPatchHarness();
    const applier = new PatchApplier(objectManager, historyManager);

    const result = applier.apply({
        operations: [
            {
                op: 'create',
                id: 'tmp_marker',
                type: 'rightAngleMarker',
                vertexId: 'vertex_1',
                line1Id: 'line_1',
                line2Id: 'line_2',
                color: '#ef4444',
                lineWidth: 4,
                visible: false,
                dashed: true
            }
        ]
    });

    assert.equal(result.success, true);
    assert.equal(result.message, '1 created');

    const marker = objects.get('marker_1');
    assert.ok(marker);
    assert.equal(marker.color, '#ef4444');
    assert.equal(marker.lineWidth, 4);
    assert.equal(marker.visible, false);
    assert.equal(marker.dashed, true);
    assert.deepEqual(history[0], ['create', 'marker_1']);
});

test('PatchApplier supports number line creation', () => {
    const { objectManager, historyManager, objects } = createPatchHarness();
    const applier = new PatchApplier(objectManager, historyManager);

    const result = applier.apply({
        operations: [
            {
                op: 'create',
                type: 'numberLine',
                start: -2,
                end: 4,
                step: 0.5,
                y: 1,
                color: '#2563eb'
            }
        ]
    });

    assert.equal(result.success, true);
    const numberLine = objects.get('number_line_1');
    assert.ok(numberLine);
    assert.equal(numberLine.start, -2);
    assert.equal(numberLine.step, 0.5);
    assert.equal(numberLine.color, '#2563eb');
});

test('PatchApplier creates polygons and resolves temporary vertex ids', () => {
    const { objectManager, historyManager, objects, history } = createPatchHarness();
    const applier = new PatchApplier(objectManager, historyManager);

    const result = applier.apply({
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 4, y: 0, label: 'B' },
            { op: 'create', id: 'C', type: 'point', x: 2, y: 3, label: 'C' },
            {
                op: 'create',
                id: 'tri',
                type: 'polygon',
                vertexIds: ['A', 'B', 'C'],
                fillColor: '#22c55e',
                fillOpacity: 0.2
            }
        ]
    });

    assert.equal(result.success, true);
    assert.equal(result.message, '4 created');

    const polygon = objects.get('polygon_1');
    assert.ok(polygon);
    assert.deepEqual(polygon.vertexIds, ['point_1', 'point_2', 'point_3']);
    assert.equal(polygon.fillColor, '#22c55e');
    assert.equal(polygon.fillOpacity, 0.2);
    assert.deepEqual(history.map(item => item[0]), ['create', 'create', 'create', 'create']);
});

test('PatchApplier creates lens regions and resolves temporary circle ids', () => {
    const { objectManager, historyManager, objects, history } = createPatchHarness();
    const applier = new PatchApplier(objectManager, historyManager);

    objects.set('real_c1', { id: 'real_c1', type: 'circle', toJSON: () => ({ id: 'real_c1', type: 'circle' }) });
    objects.set('real_c2', { id: 'real_c2', type: 'circle', toJSON: () => ({ id: 'real_c2', type: 'circle' }) });

    const result = applier.apply({
        operations: [
            {
                op: 'create',
                id: 'lens_tmp',
                type: 'lensRegion',
                circle1Id: 'real_c1',
                circle2Id: 'real_c2',
                fillColor: '#0ea5e9',
                fillOpacity: 0.28
            }
        ]
    });

    assert.equal(result.success, true);
    const lens = objects.get('lens_1');
    assert.ok(lens);
    assert.equal(lens.circle1Id, 'real_c1');
    assert.equal(lens.circle2Id, 'real_c2');
    assert.equal(lens.fillColor, '#0ea5e9');
    assert.equal(lens.fillOpacity, 0.28);
    assert.deepEqual(history.map(item => item[0]), ['create']);
});

function operationPointMap(operations) {
    return new Map(
        operations
            .filter(operation => operation.type === 'point')
            .map(operation => [operation.id, operation])
    );
}

function boundsForIds(operations, ids) {
    const points = operationPointMap(operations);
    const resolved = ids.map(id => points.get(id)).filter(Boolean);
    return {
        minX: Math.min(...resolved.map(point => point.x)),
        maxX: Math.max(...resolved.map(point => point.x)),
        minY: Math.min(...resolved.map(point => point.y)),
        maxY: Math.max(...resolved.map(point => point.y))
    };
}

function weakPrismCrossSectionOperations() {
    return [
        { op: 'create', id: 'A', type: 'point', x: -4, y: -2, showLabel: false },
        { op: 'create', id: 'B', type: 'point', x: -1, y: -2, showLabel: false },
        { op: 'create', id: 'C', type: 'point', x: -1, y: 1, showLabel: false },
        { op: 'create', id: 'D', type: 'point', x: -4, y: 1, showLabel: false },
        { op: 'create', id: 'A1', type: 'point', x: -2.5, y: -0.5, showLabel: false },
        { op: 'create', id: 'B1', type: 'point', x: 0.5, y: -0.5, showLabel: false },
        { op: 'create', id: 'C1', type: 'point', x: 0.5, y: 2.5, showLabel: false },
        { op: 'create', id: 'D1', type: 'point', x: -2.5, y: 2.5, showLabel: false },
        { op: 'create', id: 'pr1', type: 'prism', baseVertexIds: ['A', 'B', 'C', 'D'], topVertexIds: ['A1', 'B1', 'C1', 'D1'], showLabel: false },
        { op: 'create', id: 'P', type: 'point', x: -2.7, y: 0.2, showLabel: false },
        { op: 'create', id: 'Q', type: 'point', x: -1.3, y: 0.2, showLabel: false },
        { op: 'create', id: 'R', type: 'point', x: -1.3, y: 1.4, showLabel: false },
        { op: 'create', id: 'S', type: 'point', x: -2.7, y: 1.4, showLabel: false },
        { op: 'create', id: 'sec1', type: 'polygon', vertexIds: ['P', 'Q', 'R', 'S'], fillOpacity: 0.25, showLabel: false }
    ];
}

function crampedTriangularPyramidInsidePrismOperations() {
    return [
        { op: 'create', id: 'A', type: 'point', x: -4, y: -2, showLabel: false },
        { op: 'create', id: 'B', type: 'point', x: -1, y: -2, showLabel: false },
        { op: 'create', id: 'C', type: 'point', x: -2.5, y: 1, showLabel: false },
        { op: 'create', id: 'A2', type: 'point', x: -2.5, y: 0.5, showLabel: false },
        { op: 'create', id: 'B2', type: 'point', x: -0.5, y: 0.5, showLabel: false },
        { op: 'create', id: 'C2', type: 'point', x: -2, y: 3.5, showLabel: false },
        { op: 'create', id: 'P1', type: 'point', x: -3.3, y: -1.3, showLabel: false },
        { op: 'create', id: 'P2', type: 'point', x: -2.2, y: -1.3, showLabel: false },
        { op: 'create', id: 'P3', type: 'point', x: -2.75, y: -0.2, showLabel: false },
        { op: 'create', id: 'P4', type: 'point', x: -2.4, y: 0.6, showLabel: false },
        { op: 'create', id: 'prism1', type: 'prism', baseVertexIds: ['A', 'B', 'C'], topVertexIds: ['A2', 'B2', 'C2'], showLabel: false },
        { op: 'create', id: 'pyramid1', type: 'pyramid', apexId: 'P4', baseVertexIds: ['P1', 'P2', 'P3'], showLabel: false }
    ];
}
