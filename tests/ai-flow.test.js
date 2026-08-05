import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import * as AIServiceModule from '../js/ai/AIService.js';
import { parseAIJSONPayload } from '../js/ai/JSONUtils.js';
import {
    AI_COMMAND_MODE,
    AIService,
    AIServiceConfig,
    DEFAULT_OPENAI_MODEL,
    GRAPH_OPERATIONS_RESPONSE_FORMAT,
    DEFAULT_IMAGE_RECREATE_INSTRUCTION,
    IMAGE_RECREATE_OPERATION_BUDGET,
    OPENAI_IMAGE_FAST_MODEL,
    AI_IMAGE_PREPROCESS_MAX_LONG_EDGE,
    AI_IMAGE_PREPROCESS_MIN_LONG_EDGE,
    AI_IMAGE_MAX_ABS_COORDINATE,
    chooseImagePreprocessPlan,
    extractOpenAIResponseText,
    formatAIValidationMessage
} from '../js/ai/AIService.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { SemanticValidator } from '../js/ai/SemanticValidator.js';
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

function withStorageEnvironment({ localConfig, sessionKey, sessionUnavailable = false }, callback) {
    const originalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const originalSessionStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    const localValues = new Map();
    const sessionValues = new Map();
    if (localConfig !== undefined) {
        localValues.set('graphA_ai_config', JSON.stringify(localConfig));
    }
    if (sessionKey !== undefined) {
        sessionValues.set('graphA_ai_key', sessionKey);
    }

    const storage = (values, unavailable = false) => ({
        getItem(key) {
            if (unavailable) throw new Error('storage unavailable');
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            if (unavailable) throw new Error('storage unavailable');
            values.set(key, String(value));
        },
        removeItem(key) {
            if (unavailable) throw new Error('storage unavailable');
            values.delete(key);
        }
    });

    Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: storage(localValues)
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
        configurable: true,
        value: storage(sessionValues, sessionUnavailable)
    });

    try {
        return callback({ localValues, sessionValues });
    } finally {
        if (originalLocalStorage) Object.defineProperty(globalThis, 'localStorage', originalLocalStorage);
        else delete globalThis.localStorage;
        if (originalSessionStorage) Object.defineProperty(globalThis, 'sessionStorage', originalSessionStorage);
        else delete globalThis.sessionStorage;
    }
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
    assert.equal(DEFAULT_OPENAI_MODEL, 'gpt-5.6-luna');
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
    assert.equal(body.previous_response_id, undefined);

    const chainedBody = service.buildOpenAIRequestBody([
        { role: 'system', content: 'system rules' },
        { role: 'user', content: 'draw triangle' }
    ], {
        previousResponseId: 'resp_previous'
    });
    assert.equal(chainedBody.previous_response_id, 'resp_previous');
});

test('buildOpenAIRequestBody preserves assistant turns and collapses duplicate trailing user turns', () => {
    const service = createAIService();
    const body = service.buildOpenAIRequestBody([
        { role: 'system', content: 'S1' },
        { role: 'system', content: 'S2' },
        { role: 'user', content: '이전 질문' },
        { role: 'assistant', content: '{"operations":[]}' },
        { role: 'user', content: '지금 질문' },
        { role: 'user', content: '지금 질문' }
    ]);

    // 시스템은 하나의 developer 지시로 합쳐집니다.
    assert.equal(body.input[0].role, 'developer');
    assert.equal(body.input[0].content, 'S1\n\nS2');

    // assistant 턴이 보존되고, 내용이 같은 인접 user 중복은 하나로 접힙니다.
    const conversationRoles = body.input.slice(1).map(item => item.role);
    assert.deepEqual(conversationRoles, ['user', 'assistant', 'user']);
    assert.equal(body.input.at(-1).content, '지금 질문');
    assert.ok(body.input.some(item => item.role === 'assistant'));
});

test('buildOpenAIRequestBody always includes at least one user turn', () => {
    const service = createAIService();
    const body = service.buildOpenAIRequestBody([
        { role: 'system', content: 'only system' }
    ]);

    assert.equal(body.input[0].role, 'developer');
    assert.ok(body.input.some(item => item.role === 'user'));
});

test('AIServiceConfig migrates a legacy persisted API key into session storage and scrubs local storage', () => {
    withStorageEnvironment({
        localConfig: { provider: 'openai', model: 'gpt-5.4-mini', apiKey: 'legacy-key' }
    }, ({ localValues, sessionValues }) => {
        const config = AIServiceConfig.fromStorage();
        const persisted = JSON.parse(localValues.get('graphA_ai_config'));

        assert.equal(config.apiKey, 'legacy-key');
        assert.equal(sessionValues.get('graphA_ai_key'), 'legacy-key');
        assert.equal(Object.hasOwn(persisted, 'apiKey'), false);
        assert.equal(persisted.model, 'gpt-5.4-mini');
    });
});

test('AIServiceConfig keeps an existing session API key while scrubbing a different legacy key', () => {
    withStorageEnvironment({
        localConfig: { provider: 'openai', apiKey: 'legacy-key' },
        sessionKey: 'current-session-key'
    }, ({ localValues, sessionValues }) => {
        const config = AIServiceConfig.fromStorage();
        const persisted = JSON.parse(localValues.get('graphA_ai_config'));

        assert.equal(config.apiKey, 'current-session-key');
        assert.equal(sessionValues.get('graphA_ai_key'), 'current-session-key');
        assert.equal(Object.hasOwn(persisted, 'apiKey'), false);
    });
});

test('AIServiceConfig scrubs a legacy API key even when session storage is unavailable', () => {
    withStorageEnvironment({
        localConfig: { provider: 'openai', apiKey: 'memory-only-key' },
        sessionUnavailable: true
    }, ({ localValues }) => {
        const config = AIServiceConfig.fromStorage();
        const persisted = JSON.parse(localValues.get('graphA_ai_config'));

        assert.equal(config.apiKey, 'memory-only-key');
        assert.equal(Object.hasOwn(persisted, 'apiKey'), false);
    });
});

test('fetchWithTimeout aborts a slow OpenAI request with a retryable Korean message', async () => {
    assert.equal(typeof AIServiceModule.fetchWithTimeout, 'function');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
        }, { once: true });
    });

    try {
        await assert.rejects(
            () => AIServiceModule.fetchWithTimeout('/slow-openai', { method: 'POST' }, 5),
            /AI 요청 시간이 초과되었습니다\. 잠시 후 다시 시도하세요\./
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
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
        assert.ok(capturedOptions.signal instanceof AbortSignal);
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

test('AIService callOpenAI can route through the owner OpenAI proxy', async () => {
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
                    id: 'resp_owner_proxy',
                    output: [
                        {
                            type: 'message',
                            content: [
                                {
                                    type: 'output_text',
                                    text: '{"operations":[{"op":"create","type":"point","x":3,"y":4}]}'
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
            apiKey: '',
            authMode: 'owner',
            proxyToken: 'signed-owner-token',
            model: 'gpt-5.4-mini',
            save() { }
        });

        const content = await service.callOpenAI([
            { role: 'system', content: 'system rules' },
            { role: 'user', content: 'owner proxy point' }
        ]);

        const body = JSON.parse(capturedOptions.body);
        assert.equal(capturedUrl, '/api/openai-responses');
        assert.equal(capturedOptions.headers.Authorization, 'Bearer signed-owner-token');
        assert.equal(capturedOptions.headers['Content-Type'], 'application/json');
        assert.equal(body.store, false);
        assert.equal(body.text.format.type, 'json_schema');
        assert.equal(content, '{"operations":[{"op":"create","type":"point","x":3,"y":4}]}');
        assert.equal(service.lastResponseId, 'resp_owner_proxy');
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

test('processCommand repairs OpenAI text output with stale update ids', async () => {
    const originalFetch = globalThis.fetch;
    const capturedBodies = [];

    globalThis.fetch = async (url, options) => {
        capturedBodies.push(JSON.parse(options.body));
        const firstCall = capturedBodies.length === 1;
        return {
            ok: true,
            async json() {
                return {
                    id: firstCall ? 'resp_stale_ids' : 'resp_repaired_ids',
                    output: [
                        {
                            type: 'message',
                            content: [
                                {
                                    type: 'output_text',
                                    text: firstCall
                                        ? JSON.stringify({
                                            operations: [
                                                { op: 'update', id: 'obj_1781506409729_1', label: 'A' }
                                            ]
                                        })
                                        : JSON.stringify({
                                            operations: [
                                                { op: 'create', id: 'A', type: 'point', x: 0, y: 0, label: 'A' }
                                            ]
                                        })
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
        service.lastResponseId = 'resp_old_canvas';

        const result = await service.processCommand('새 점 A를 그려줘', { objects: [] });

        assert.equal(result.success, true);
        assert.equal(result.repaired, true);
        assert.equal(result.initialModel, 'gpt-5.4-mini');
        assert.equal(result.model, 'gpt-5.4-mini');
        assert.equal(result.json.operations[0].op, 'create');
        assert.equal(result.json.operations[0].id, 'A');
        assert.match(result.repairErrors.join('\n'), /obj_1781506409729_1/);
        assert.equal(capturedBodies.length, 2);
        assert.equal(capturedBodies[0].previous_response_id, undefined);
        assert.equal(capturedBodies[1].previous_response_id, undefined);
        assert.match(capturedBodies[1].input[0].content, /failed local validation/);
        assert.match(capturedBodies[1].input[0].content, /op:"create"/);
        assert.match(capturedBodies[1].input[0].content, /obj_1781506409729_1/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('callOpenAI surfaces owner-proxy string error bodies with a re-login hint', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: false,
        status: 401,
        async json() {
            // 오너 프록시는 { error: "문자열" } 형태로 반환합니다.
            return { error: 'Login token expired.' };
        }
    });

    try {
        const service = new AIService({
            provider: 'openai',
            apiKey: '',
            authMode: 'owner',
            proxyToken: 'signed-owner-token',
            model: 'gpt-5.4-mini',
            save() { }
        });

        await assert.rejects(
            () => service.callOpenAI([{ role: 'user', content: 'x' }]),
            (error) => {
                assert.match(error.message, /Login token expired\./);
                assert.match(error.message, /다시 로그인/);
                return true;
            }
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('callOpenAI still reads OpenAI-shaped nested error messages', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: false,
        status: 400,
        async json() {
            // OpenAI 직접 호출은 { error: { message } } 형태로 반환합니다.
            return { error: { message: 'Invalid model id' } };
        }
    });

    try {
        const service = new AIService({
            provider: 'openai',
            apiKey: 'test-key',
            model: 'gpt-5.4-mini',
            save() { }
        });

        await assert.rejects(
            () => service.callOpenAI([{ role: 'user', content: 'x' }]),
            (error) => {
                assert.match(error.message, /Invalid model id/);
                return true;
            }
        );
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

test('AIService straightens a wobbly prism rear face into one parallel projection', () => {
    const service = createAIService();
    const enhanced = service.enhanceDiagramQuality({
        operations: [
            { op: 'create', id: 'A', type: 'point', x: -4, y: 3, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 2, y: 3, label: 'B' },
            { op: 'create', id: 'F', type: 'point', x: 2, y: -3, label: 'F' },
            { op: 'create', id: 'E', type: 'point', x: -4, y: -3, label: 'E' },
            { op: 'create', id: 'D', type: 'point', x: -2, y: 5.2, label: 'D' },
            { op: 'create', id: 'C', type: 'point', x: 5.1, y: 4.8, label: 'C' },
            { op: 'create', id: 'G', type: 'point', x: 5, y: -1, label: 'G' },
            { op: 'create', id: 'H', type: 'point', x: -2.1, y: -1.2, label: 'H' },
            { op: 'create', id: 'box', type: 'prism', baseVertexIds: ['A', 'B', 'F', 'E'], topVertexIds: ['D', 'C', 'G', 'H'], showLabel: false }
        ]
    }, 'Recreate the image as GraphA geometry.');

    const points = operationPointMap(enhanced.operations);
    const shifts = [['A', 'D'], ['B', 'C'], ['F', 'G'], ['E', 'H']]
        .map(([baseId, topId]) => ({
            x: points.get(topId).x - points.get(baseId).x,
            y: points.get(topId).y - points.get(baseId).y
        }));

    assert.ok(shifts.every(shift =>
        Math.abs(shift.x - 2.5) < 1e-9 && Math.abs(shift.y - 1.95) < 1e-9
    ));
    assert.equal(points.get('A').x, -4);
    assert.equal(points.get('A').y, 3);
    assert.equal(points.get('F').x, 2);
    assert.equal(points.get('F').y, -3);
});

test('AIService keeps an explicitly coordinated prism unchanged', () => {
    const service = createAIService();
    const enhanced = service.enhanceDiagramQuality({
        operations: [
            { op: 'create', id: 'A', type: 'point', x: -4, y: 3 },
            { op: 'create', id: 'B', type: 'point', x: 2, y: 3 },
            { op: 'create', id: 'F', type: 'point', x: 2, y: -3 },
            { op: 'create', id: 'E', type: 'point', x: -4, y: -3 },
            { op: 'create', id: 'D', type: 'point', x: -2, y: 5.2 },
            { op: 'create', id: 'C', type: 'point', x: 5.1, y: 4.8 },
            { op: 'create', id: 'G', type: 'point', x: 5, y: -1 },
            { op: 'create', id: 'H', type: 'point', x: -2.1, y: -1.2 },
            { op: 'create', id: 'box', type: 'prism', baseVertexIds: ['A', 'B', 'F', 'E'], topVertexIds: ['D', 'C', 'G', 'H'], showLabel: false }
        ]
    }, 'Keep the explicitly provided A(-4, 3), B(2, 3), and D(-2, 5.2) coordinates.');

    const points = operationPointMap(enhanced.operations);
    assert.equal(points.get('C').x, 5.1);
    assert.equal(points.get('C').y, 4.8);
    assert.equal(points.get('H').x, -2.1);
    assert.equal(points.get('H').y, -1.2);
});
test('AIService hides visible center dots in three-circle lens layouts', () => {
    const service = createAIService();
    const enhanced = service.enhanceDiagramQuality({
        operations: [
            { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O', pointSize: 3 },
            { op: 'create', id: 'O_edge', type: 'point', x: 3, y: 0, showLabel: false },
            { op: 'create', id: 'P', type: 'point', x: 4, y: 0, label: 'P', pointSize: 3 },
            { op: 'create', id: 'P_edge', type: 'point', x: 7, y: 0, showLabel: false },
            { op: 'create', id: 'Q', type: 'point', x: 2, y: 3, label: 'Q', pointSize: 3 },
            { op: 'create', id: 'Q_edge', type: 'point', x: 5, y: 3, showLabel: false },
            { op: 'create', id: 'cO', type: 'circle', centerId: 'O', pointOnCircleId: 'O_edge' },
            { op: 'create', id: 'cP', type: 'circle', centerId: 'P', pointOnCircleId: 'P_edge' },
            { op: 'create', id: 'cQ', type: 'circle', centerId: 'Q', pointOnCircleId: 'Q_edge' },
            { op: 'create', id: 'lensOP', type: 'lensRegion', circle1Id: 'cO', circle2Id: 'cP' },
            { op: 'create', id: 'lensOQ', type: 'lensRegion', circle1Id: 'cO', circle2Id: 'cQ' },
            { op: 'create', id: 'lensPQ', type: 'lensRegion', circle1Id: 'cP', circle2Id: 'cQ' }
        ]
    }, 'draw three circles O, P, Q with pairwise lens overlap regions');

    for (const id of ['O', 'P', 'Q']) {
        const center = enhanced.operations.find(operation => operation.id === id);
        assert.equal(center.visible, false);
        assert.equal(center.showLabel, false);
        assert.equal(center.pointSize, 0);
    }

    const anchors = enhanced.operations.filter(operation => /_label$/.test(operation.id));
    assert.deepEqual(anchors.map(operation => operation.label).sort(), ['O', 'P', 'Q']);
    assert.ok(anchors.every(operation => operation.visible === true));
    assert.ok(anchors.every(operation => operation.showLabel === true));
    assert.ok(anchors.every(operation => operation.pointSize <= 0.1));
    assert.ok(enhanced.operations
        .filter(operation => operation.type === 'lensRegion')
        .every(operation => operation.showLabel === false && operation.fillOpacity >= 0.16));
    assert.ok(enhanced.operations
        .filter(operation => operation.type === 'circle')
        .every(operation => operation.showLabel === false));
});

test('AIService declutters square pyramid midsection layouts', () => {
    const service = createAIService();
    const enhanced = service.enhanceDiagramQuality({
        operations: [
            { op: 'create', id: 'A', type: 'point', x: -3, y: -1, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 3, y: -1, label: 'B' },
            { op: 'create', id: 'C', type: 'point', x: 4, y: 1, label: 'C' },
            { op: 'create', id: 'D', type: 'point', x: -2, y: 1, label: 'D' },
            { op: 'create', id: 'V', type: 'point', x: 0.5, y: 5, label: 'V' },
            { op: 'create', id: 'O', type: 'point', x: 0.5, y: 0, label: 'O' },
            { op: 'create', id: 'M1', type: 'point', x: -1.2, y: 2, label: 'M1' },
            { op: 'create', id: 'M2', type: 'point', x: 1.8, y: 2, label: 'M2' },
            { op: 'create', id: 'M3', type: 'point', x: 2.5, y: 2.7, label: 'M3' },
            { op: 'create', id: 'M4', type: 'point', x: -0.5, y: 2.7, label: 'M4' },
            { op: 'create', id: 'base_poly', type: 'polygon', vertexIds: ['A', 'B', 'C', 'D'], label: 'c7' },
            { op: 'create', id: 'midsection', type: 'polygon', vertexIds: ['M1', 'M2', 'M3', 'M4'], label: '중간 단면', fillOpacity: 0.08 },
            { op: 'create', id: 'pyr', type: 'pyramid', baseVertexIds: ['A', 'B', 'C', 'D'], apexId: 'V', label: '정사각뿔' },
            { op: 'create', id: 'height', type: 'segment', point1Id: 'V', point2Id: 'O', label: '높이' }
        ]
    }, 'draw a square pyramid midsection cross-section');

    const center = enhanced.operations.find(operation => operation.id === 'O');
    const midsection = enhanced.operations.find(operation => operation.id === 'midsection');
    const base = enhanced.operations.find(operation => operation.id === 'base_poly');
    const pyramid = enhanced.operations.find(operation => operation.id === 'pyr');
    const height = enhanced.operations.find(operation => operation.id === 'height');

    assert.equal(center.visible, false);
    assert.equal(center.showLabel, false);
    assert.ok(['M1', 'M2', 'M3', 'M4'].every(id => {
        const point = enhanced.operations.find(operation => operation.id === id);
        return point.visible === false && point.showLabel === false;
    }));
    assert.equal(base.showLabel, false);
    assert.equal(midsection.showLabel, false);
    assert.ok(midsection.fillOpacity >= 0.16);
    assert.equal(pyramid.showLabel, false);
    assert.equal(height.dashed, true);
    assert.equal(height.showLabel, false);
});

test('AIService hides inner labels in nested rectangular prism layouts', () => {
    const service = createAIService();
    const enhanced = service.enhanceDiagramQuality({
        operations: [
            { op: 'create', id: 'A', type: 'point', x: -4, y: -2, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 2, y: -2, label: 'B' },
            { op: 'create', id: 'C', type: 'point', x: 4, y: 0, label: 'C' },
            { op: 'create', id: 'D', type: 'point', x: -2, y: 0, label: 'D' },
            { op: 'create', id: 'E', type: 'point', x: -4, y: 2, label: 'E' },
            { op: 'create', id: 'F', type: 'point', x: 2, y: 2, label: 'F' },
            { op: 'create', id: 'G', type: 'point', x: 4, y: 4, label: 'G' },
            { op: 'create', id: 'H', type: 'point', x: -2, y: 4, label: 'H' },
            { op: 'create', id: 'outer_prism', type: 'prism', baseVertexIds: ['A', 'B', 'C', 'D'], topVertexIds: ['E', 'F', 'G', 'H'], label: '직육면체 ABCD EFGH' },
            { op: 'create', id: 'a', type: 'point', x: -1, y: -1, label: 'a' },
            { op: 'create', id: 'b', type: 'point', x: 1, y: -1, label: 'b' },
            { op: 'create', id: 'c', type: 'point', x: 2, y: 0, label: 'c' },
            { op: 'create', id: 'd', type: 'point', x: 0, y: 0, label: 'd' },
            { op: 'create', id: 'e', type: 'point', x: -1, y: 1, label: 'e' },
            { op: 'create', id: 'f', type: 'point', x: 1, y: 1, label: 'f' },
            { op: 'create', id: 'g', type: 'point', x: 2, y: 2, label: 'g' },
            { op: 'create', id: 'h', type: 'point', x: 0, y: 2, label: 'h' },
            { op: 'create', id: 'inner_prism', type: 'prism', baseVertexIds: ['a', 'b', 'c', 'd'], topVertexIds: ['e', 'f', 'g', 'h'], label: '작은 정육면체' }
        ]
    }, 'draw rectangular prism ABCD EFGH with a small cube inside');

    assert.ok(enhanced.operations
        .filter(operation => operation.type === 'prism')
        .every(operation => operation.showLabel === false));
    assert.ok(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].every(id => {
        const point = enhanced.operations.find(operation => operation.id === id);
        return point.visible === false && point.showLabel === false && point.pointSize === 0;
    }));
    assert.deepEqual(
        enhanced.operations
            .filter(operation => /^[A-H]$/.test(operation.id))
            .map(operation => operation.label),
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    );
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

test('AIService shades the named polygon when its area is the quantity being optimized', () => {
    const service = createAIService();
    const enhanced = service.enhanceDiagramQuality({
        operations: [
            { op: 'create', id: 'P', type: 'point', x: -2, y: 4, label: 'P' },
            { op: 'create', id: 'Q', type: 'point', x: -2, y: 0, label: 'Q' },
            { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
            { op: 'create', id: 'R', type: 'point', x: 0, y: 1, label: 'R' },
            { op: 'create', id: 'PQ', type: 'segment', point1Id: 'P', point2Id: 'Q' },
            { op: 'create', id: 'QO', type: 'segment', point1Id: 'Q', point2Id: 'O' },
            { op: 'create', id: 'OR', type: 'segment', point1Id: 'O', point2Id: 'R' },
            { op: 'create', id: 'RP', type: 'segment', point1Id: 'R', point2Id: 'P' }
        ]
    }, '사각형 PQOR의 넓이의 최댓값을 구하여라.');

    const target = enhanced.operations.find(operation => operation.type === 'polygon');
    assert.deepEqual(target.vertexIds, ['P', 'Q', 'O', 'R']);
    assert.equal(target.fillColor, '#000000');
    assert.ok(target.fillOpacity >= 0.18);
    assert.equal(target.showLabel, false);
});

test('AIService strengthens a zero-opacity target polygon when the question asks for its area', () => {
    const service = createAIService();
    const enhanced = service.enhanceDiagramQuality({
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 4, y: 0, label: 'B' },
            { op: 'create', id: 'C', type: 'point', x: 1, y: 3, label: 'C' },
            { op: 'create', id: 'ABC', type: 'polygon', vertexIds: ['A', 'B', 'C'], fillOpacity: 0 }
        ]
    }, '삼각형 ABC의 넓이를 구하시오.');

    const target = enhanced.operations.find(operation => operation.id === 'ABC');
    assert.equal(target.fillColor, '#000000');
    assert.ok(target.fillOpacity >= 0.18);
});

test('AIService does not shade polygons when area is only a given condition', () => {
    const service = createAIService();
    const cases = [
        '사각형 ADCB의 넓이가 25이다. 두 직선 사이의 거리 d에 대하여 d^2의 값을 구하시오.',
        '삼각형 ABP의 넓이가 삼각형 AOB의 넓이의 5배일 때 f(k)×g(-k)를 구하시오.',
        "삼각형 FF'Q의 넓이가 4√5일 때 b^2의 값을 구하시오."
    ];

    for (const prompt of cases) {
        const enhanced = service.enhanceDiagramQuality({
            operations: [
                { op: 'create', id: 'A', type: 'point', x: 0, y: 0, label: 'A' },
                { op: 'create', id: 'B', type: 'point', x: 4, y: 0, label: 'B' },
                { op: 'create', id: 'C', type: 'point', x: 1, y: 3, label: 'C' }
            ]
        }, prompt);

        assert.equal(enhanced.operations.some(operation => operation.type === 'polygon'), false, prompt);
    }
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
    assert.match(recreatePrompt, /우선순위 1/);
    assert.match(recreatePrompt, /우선순위 2/);
    assert.match(recreatePrompt, /의미 입력으로 사용하되 캔버스에 본문 자체를 복사하지/);
    assert.match(recreatePrompt, /풀이 과정, 계산, 정답 또는 문제에 없는 조건은 만들지/);
    assert.match(recreatePrompt, /화면 픽셀이 아니라 수학 좌표/);
    assert.match(recreatePrompt, /GraphA operations\[\]/);
    assert.match(recreatePrompt, /pointOnLine\(lineId=PQ, t는 0~1\)/);
    assert.match(recreatePrompt, /t를 m\/\(m\+n\)/);
    assert.match(recreatePrompt, /넓이 자체나 그 최댓값·최솟값/);
    assert.match(recreatePrompt, /주어진 조건·비율이고 다른 값을 묻는다면 채우지/);
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
    assert.match(joined, /pointOnLine으로 종속/);
    assert.match(joined, /t를 정확히 계산/);
    assert.match(joined, /넓이의 최댓값 또는 최솟값을 직접 요구하면/);
    assert.match(joined, /주어진 조건·비율일 뿐 다른 값을 묻는 문제는 채우지/);
});

test('AIService detects full Korean problems as problem_diagram mode', () => {
    const service = createAIService();
    const problemText = [
        '다음은 좌표평면에서 이차함수 y = x^2 - 4x + 3 과 직선 y = x + 1 이 만나는 상황에 대한 문제이다.',
        '두 교점을 A, B라 하고, 선분 AB와 x축으로 둘러싸인 부분을 그림으로 나타내어라.',
        '보기 ① 1 ② 2 ③ 3 ④ 4 ⑤ 5 중에서 알맞은 값을 구하여라.'
    ].join('\n');

    assert.equal(service.detectCommandMode(problemText), AI_COMMAND_MODE.PROBLEM_DIAGRAM);
    assert.equal(service.detectCommandMode('삼각형 ABC를 그려줘'), AI_COMMAND_MODE.COMMAND);

    const messages = service.buildMessages(problemText, { objects: [] });
    const joined = messages.map(message => message.content).join('\n\n');
    assert.match(joined, /problem_diagram/);
    assert.match(joined, /Do not solve/);
    assert.match(joined, /Do not copy problem body text/);
});

test('problem_diagram prompt references prioritize broad exam diagram objects and known gaps', () => {
    const service = createAIService();
    const referencePrompt = service.buildDrawingReferencePromptFromManual(
        manual,
        retrievalIndex,
        [
            '다음 입체도형과 좌표평면 그래프, 원의 접선, 수직선 조건을 모두 포함한 문제이다.',
            '원기둥은 현재 지원 객체로 근사하고 필요한 길이와 각만 표시하여라.'
        ].join('\n'),
        null,
        AI_COMMAND_MODE.PROBLEM_DIAGRAM
    );

    assert.match(referencePrompt, /Problem diagram mode/);
    assert.match(referencePrompt, /Current manual gaps\/approximations/);
    assert.match(referencePrompt, /function/);
    assert.match(referencePrompt, /numberLine/);
    assert.match(referencePrompt, /prism|pyramid/);
});

test('processCommand requires provider for unsupported whole-problem interpretation', async () => {
    const service = createAIService();
    const problemText = [
        '다음은 좌표평면에서 이차함수 y = x^2 - 4x + 3 과 직선 y = x + 1 이 만나는 상황에 대한 문제이다.',
        '두 교점을 A, B라 하고, 선분 AB와 x축으로 둘러싸인 부분을 그림으로 나타내어라.',
        '보기 ① 1 ② 2 ③ 3 ④ 4 ⑤ 5 중에서 알맞은 값을 구하여라.'
    ].join('\n');

    const result = await service.processCommand(problemText, { objects: [] });

    assert.equal(result.success, false);
    assert.equal(result.mode, AI_COMMAND_MODE.PROBLEM_DIAGRAM);
    assert.match(result.error, /OpenAI 연결/);
});

test('processCommand returns problem_diagram mode for valid OpenAI whole-problem output', async () => {
    const originalFetch = globalThis.fetch;
    const capturedBodies = [];
    const problemText = [
        '다음은 좌표평면에서 이차함수 y = x^2 - 4x + 3 과 직선 y = x + 1 이 만나는 상황에 대한 문제이다.',
        '두 교점을 A, B라 하고, 선분 AB와 x축으로 둘러싸인 부분을 그림으로 나타내어라.',
        '구하여라.'
    ].join('\n');

    globalThis.fetch = async (url, options) => {
        capturedBodies.push(JSON.parse(options.body));
        return {
            ok: true,
            async json() {
                return {
                    id: 'resp_problem_diagram',
                    output: [
                        {
                            type: 'message',
                            content: [
                                {
                                    type: 'output_text',
                                    text: JSON.stringify({
                                        operations: [
                                            { op: 'create', id: 'f', type: 'function', expression: 'x^2 - 4*x + 3', label: 'y=x^2-4x+3' },
                                            { op: 'create', id: 'g', type: 'function', expression: 'x + 1', label: 'y=x+1' },
                                            { op: 'create', id: 'A', type: 'point', x: -0.45, y: 0.55, label: 'A' },
                                            { op: 'create', id: 'B', type: 'point', x: 4.45, y: 5.45, label: 'B' },
                                            { op: 'create', id: 'AB', type: 'segment', point1Id: 'A', point2Id: 'B' }
                                        ]
                                    })
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

        const result = await service.processCommand(problemText, { objects: [] });

        assert.equal(result.success, true);
        assert.equal(result.mode, AI_COMMAND_MODE.PROBLEM_DIAGRAM);
        assert.equal(result.model, 'gpt-5.4-mini');
        assert.match(capturedBodies[0].input[0].content, /Problem diagram mode/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('processCommand repairs problem_diagram output that copies prose instead of drawing core objects', async () => {
    const originalFetch = globalThis.fetch;
    const capturedBodies = [];
    const problemText = [
        '다음은 원과 접선에 대한 문제이다.',
        '원 O 위의 점 A에서의 접선을 그리고, 반지름 OA와 접선이 수직임을 나타내어라.',
        '옳은 것을 구하여라.'
    ].join('\n');

    globalThis.fetch = async (url, options) => {
        capturedBodies.push(JSON.parse(options.body));
        const firstCall = capturedBodies.length === 1;
        return {
            ok: true,
            async json() {
                return {
                    id: firstCall ? 'resp_problem_bad' : 'resp_problem_repaired',
                    output: [
                        {
                            type: 'message',
                            content: [
                                {
                                    type: 'output_text',
                                    text: JSON.stringify(firstCall
                                        ? {
                                            operations: [
                                                { op: 'create', id: 'note', type: 'point', x: 0, y: 0, label: '다음은 원과 접선에 대한 문제이다' }
                                            ]
                                        }
                                        : {
                                            operations: [
                                                { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
                                                { op: 'create', id: 'A', type: 'point', x: 2, y: 0, label: 'A' },
                                                { op: 'create', id: 'c', type: 'circle', centerId: 'O', pointOnCircleId: 'A' },
                                                { op: 'create', id: 'T', type: 'point', x: 2, y: 2, visible: false, pointSize: 0 },
                                                { op: 'create', id: 'tan', type: 'line', point1Id: 'A', point2Id: 'T', label: 't' },
                                                { op: 'create', id: 'r', type: 'segment', point1Id: 'O', point2Id: 'A' },
                                                { op: 'create', id: 'ra', type: 'rightAngleMarker', vertexId: 'A', line1Id: 'r', line2Id: 'tan' }
                                            ]
                                        })
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

        const result = await service.processCommand(problemText, { objects: [] });

        assert.equal(result.success, true);
        assert.equal(result.mode, AI_COMMAND_MODE.PROBLEM_DIAGRAM);
        assert.equal(result.repaired, true);
        assert.equal(capturedBodies.length, 2);
        assert.match(result.repairErrors.join('\n'), /problem prose|answer choices|labels/);
        assert.match(capturedBodies[1].input[0].content, /Problem diagram mode/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('SemanticValidator rejects copied solution and answer-choice text in problem diagrams', () => {
    const validator = new SemanticValidator();
    const result = validator.validateProblemDiagramIntent({
        operations: [
            { op: 'create', id: 'bad', type: 'point', x: 0, y: 0, label: '정답은 ③이고 풀이 과정은 다음과 같다' }
        ]
    }, {
        prompt: '다음 좌표평면 문제를 구하여라.'
    });

    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /must not copy problem prose/);
});

test('SemanticValidator requires every explicitly requested curved solid', () => {
    const validator = new SemanticValidator();
    const result = validator.validateRequestedSolidIntent({
        operations: [
            { op: 'create', id: 'outer', type: 'cone', x: 0, y: 0, width: 6, height: 8 }
        ]
    }, {
        prompt: '원뿔 안에 구 그려줘'
    });

    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /sphere object/);
});

test('SemanticValidator requires the requested sphere to stay inside the cone', () => {
    const validator = new SemanticValidator();
    const outside = validator.validateRequestedSolidIntent({
        operations: [
            { op: 'create', id: 'outer', type: 'cone', x: 0, y: 0, width: 6, height: 8 },
            { op: 'create', id: 'inner', type: 'sphere', x: 5, y: 0, width: 3, height: 3 }
        ]
    }, {
        prompt: '원뿔 안에 구 그려줘'
    });
    const inside = validator.validateRequestedSolidIntent({
        operations: [
            { op: 'create', id: 'outer', type: 'cone', x: 0, y: 0, width: 6, height: 8 },
            { op: 'create', id: 'inner', type: 'sphere', x: 0, y: -0.5, width: 2.4, height: 2.4 }
        ]
    }, {
        prompt: '원뿔 안에 구 그려줘'
    });

    assert.equal(outside.valid, false);
    assert.match(outside.errors.join('\n'), /completely inside the cone/);
    assert.equal(inside.valid, true);
});

test('processCommand repairs a cone-only response for a sphere-inside-cone request', async () => {
    const originalFetch = globalThis.fetch;
    const capturedBodies = [];

    globalThis.fetch = async (url, options) => {
        capturedBodies.push(JSON.parse(options.body));
        const repaired = capturedBodies.length > 1;
        return {
            ok: true,
            async json() {
                return {
                    id: repaired ? 'resp_nested_solids_repaired' : 'resp_cone_only',
                    output: [{
                        type: 'message',
                        content: [{
                            type: 'output_text',
                            text: JSON.stringify({
                                operations: repaired
                                    ? [
                                        { op: 'create', id: 'outer', type: 'cone', x: 0, y: 0, width: 6, height: 8 },
                                        { op: 'create', id: 'inner', type: 'sphere', x: 0, y: -0.5, width: 2.4, height: 2.4 }
                                    ]
                                    : [
                                        { op: 'create', id: 'outer', type: 'cone', x: 0, y: 0, width: 6, height: 8 }
                                    ]
                            })
                        }]
                    }]
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
        const result = await service.processCommand('원뿔 안에 구 그려줘', { objects: [] });

        assert.equal(result.success, true);
        assert.equal(result.repaired, true);
        assert.equal(capturedBodies.length, 2);
        assert.match(result.repairErrors.join('\n'), /sphere object/);
        assert.deepEqual(result.json.operations.map(operation => operation.type), ['cone', 'sphere']);
    } finally {
        globalThis.fetch = originalFetch;
    }
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
        assert.ok(capturedOptions.signal instanceof AbortSignal);
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

test('AIService repairs pixel-style image coordinates into the visible GraphA range', async () => {
    const originalFetch = globalThis.fetch;
    const capturedBodies = [];
    globalThis.fetch = async (url, options) => {
        capturedBodies.push(JSON.parse(options.body));
        const firstCall = capturedBodies.length === 1;
        return {
            ok: true,
            async json() {
                return {
                    id: firstCall ? 'resp_pixel_coordinates' : 'resp_math_coordinates',
                    output: [{
                        type: 'message',
                        content: [{
                            type: 'output_text',
                            text: firstCall
                                ? '{"operations":[{"op":"create","id":"O","type":"point","x":300,"y":80,"label":"O"}]}'
                                : '{"operations":[{"op":"create","id":"O","type":"point","x":0,"y":4,"label":"O"}]}'
                        }]
                    }]
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
        const imageDataUrl = 'data:image/png;base64,PIXEL_COORDINATES';
        const result = await service.analyzeImage(imageDataUrl, {
            mode: 'recreate',
            context: { objects: [], selectedObjectIds: [] }
        });

        assert.equal(result.success, true);
        assert.equal(result.repaired, true);
        assert.match(result.repairErrors.join('\n'), /coordinates must stay within/);
        assert.equal(capturedBodies.length, 2);
        assert.match(capturedBodies[1].input[1].content[0].text, /OUT_OF_VIEW_COORDINATES/);
        assert.match(capturedBodies[1].input[1].content[0].text, new RegExp(`\\+/-${AI_IMAGE_MAX_ABS_COORDINATE}`));
        assert.deepEqual(capturedBodies[1].input[1].content[1], {
            type: 'input_image',
            image_url: imageDataUrl,
            detail: 'high'
        });
        assert.equal(result.json.operations[0].x, 0);
        assert.equal(result.json.operations[0].y, 4);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
test('AIService repairs empty image operations with the original image and problem-text fallback', async () => {
    const originalFetch = globalThis.fetch;
    const capturedBodies = [];
    const targetOperations = [
        ['O', 0, 4],
        ['A', -4, -2],
        ['B', 0, -3],
        ['C', 4, -2],
        ['D', 0, -1],
        ['E', -1.5, 1.75],
        ['F', 0, 1.25],
        ['G', 1.5, 1.75],
        ['H', 0, 2.25]
    ].map(([id, x, y]) => ({ op: 'create', id, type: 'point', x, y, label: id }));
    targetOperations.push(
        { op: 'create', id: 'outer_pyramid', type: 'pyramid', baseVertexIds: ['A', 'B', 'C', 'D'], apexId: 'O' },
        { op: 'create', id: 'inner_pyramid', type: 'pyramid', baseVertexIds: ['E', 'F', 'G', 'H'], apexId: 'O' }
    );

    globalThis.fetch = async (url, options) => {
        capturedBodies.push(JSON.parse(options.body));
        const firstCall = capturedBodies.length === 1;
        return {
            ok: true,
            async json() {
                return {
                    id: firstCall ? 'resp_empty_recreate' : 'resp_repaired_recreate',
                    output: [{
                        type: 'message',
                        content: [{
                            type: 'output_text',
                            text: firstCall
                                ? '{"operations":[]}'
                                : JSON.stringify({ operations: targetOperations })
                        }]
                    }]
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
        const imageDataUrl = 'data:image/png;base64,PROBLEM_IMAGE';
        const result = await service.analyzeImage(imageDataUrl, {
            mode: 'recreate',
            context: { objects: [], selectedObjectIds: [] }
        });

        assert.equal(result.success, true);
        assert.equal(result.repaired, true);
        assert.match(result.repairErrors.join('\n'), /operations is empty/);
        assert.equal(capturedBodies.length, 2);
        assert.equal(capturedBodies[1].previous_response_id, 'resp_empty_recreate');
        assert.equal(capturedBodies[1].model, DEFAULT_OPENAI_MODEL);
        for (const body of capturedBodies) {
            assert.deepEqual(body.input[1].content[1], {
                type: 'input_image',
                image_url: imageDataUrl,
                detail: 'high'
            });
        }
        assert.match(capturedBodies[1].input[1].content[0].text, /EMPTY_OPERATIONS/);
        assert.match(capturedBodies[1].input[1].content[0].text, /problem statement explicitly describes drawable geometry/);

        const pointLabels = new Set(
            result.json.operations
                .filter(operation => operation.type === 'point')
                .map(operation => operation.label)
        );
        assert.deepEqual(pointLabels, new Set(['O', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']));
        const pyramids = result.json.operations.filter(operation => operation.type === 'pyramid');
        assert.equal(pyramids.length, 2);
        assert.ok(pyramids.every(pyramid => pyramid.apexId === 'O'));
        assert.deepEqual(pyramids[0].baseVertexIds, ['A', 'B', 'C', 'D']);
        assert.deepEqual(pyramids[1].baseVertexIds, ['E', 'F', 'G', 'H']);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('AIService stops after one empty image repair and returns Korean recovery guidance', async () => {
    const originalFetch = globalThis.fetch;
    let requestCount = 0;
    globalThis.fetch = async () => {
        requestCount += 1;
        return {
            ok: true,
            async json() {
                return {
                    id: `resp_empty_${requestCount}`,
                    output: [{
                        type: 'message',
                        content: [{ type: 'output_text', text: '{"operations":[]}' }]
                    }]
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
        const result = await service.analyzeImage('data:image/png;base64,EMPTY_TWICE', {
            mode: 'recreate',
            context: { objects: [], selectedObjectIds: [] }
        });

        assert.equal(result.success, false);
        assert.equal(requestCount, 2);
        assert.match(result.error, /사진이나 문제문에서 그릴 도형을 찾지 못했습니다/);
        assert.doesNotMatch(result.error, /operations is empty|JSON validation|semantic validation/i);
        assert.equal(
            formatAIValidationMessage(['operations is empty.']),
            result.error
        );
    } finally {
        globalThis.fetch = originalFetch;
    }
});
test('AIService analyzeImage exposes the owner-proxy error instead of a generic Vision error', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
        ok: false,
        status: 503,
        async json() {
            return { error: 'OpenAI 서버 연결 설정을 확인해주세요.' };
        }
    });

    try {
        const service = new AIService({
            provider: 'openai',
            authMode: 'owner',
            proxyToken: 'owner-token',
            model: 'gpt-5.4-mini',
            save() { }
        });
        const result = await service.analyzeImage('data:image/png;base64,AAAA', {
            mode: 'recreate',
            context: { objects: [], selectedObjectIds: [] }
        });

        assert.equal(result.success, false);
        assert.equal(result.error, 'OpenAI 서버 연결 설정을 확인해주세요.');
        assert.doesNotMatch(result.error, /Vision API 오류/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test('image intent validation rejects marker references to missing construction segments', () => {
    const service = new AIService({
        provider: 'openai',
        model: DEFAULT_OPENAI_MODEL,
        save() { }
    });
    const result = service.validateImageAnalysisIntent({
        operations: [
            { op: 'create', id: 'B', type: 'point', x: 0, y: 0, label: 'B' },
            { op: 'create', id: 'C', type: 'point', x: 4, y: 0, label: 'C' },
            { op: 'create', id: 'BC', type: 'segment', point1Id: 'B', point2Id: 'C' },
            { op: 'create', id: 'equal_ad_bc', type: 'equalLengthMarker', segment1Id: 'AD', segment2Id: 'BC' }
        ]
    }, {
        mode: AI_COMMAND_MODE.PROBLEM_DIAGRAM,
        instruction: '',
        context: { objects: [] }
    });

    assert.equal(result.valid, false);
    assert.match(result.errors.join('\n'), /segment1Id="AD" does not exist/);
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

test('local fallback draws nested rectangular prism and small cube prompt', () => {
    const service = createAIService();
    const result = service.fallbackProcess('직육면체 ABCD EFGH 내부에 정육면체가 작게 있는거 그려줘');

    assert.equal(result.success, true);

    const validation = new SchemaValidator().validate(result.json);
    assert.equal(validation.valid, true, validation.errors.join('\n'));

    const prismOps = result.json.operations.filter(operation => operation.type === 'prism');
    const pointOps = result.json.operations.filter(operation => operation.type === 'point');
    assert.equal(prismOps.length, 2);
    assert.equal(pointOps.length, 16);
    assert.deepEqual(
        pointOps.slice(0, 8).map(operation => operation.label),
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    );

    const outerBounds = boundsForIds(result.json.operations, [
        ...prismOps[0].baseVertexIds,
        ...prismOps[0].topVertexIds
    ]);
    const innerBounds = boundsForIds(result.json.operations, [
        ...prismOps[1].baseVertexIds,
        ...prismOps[1].topVertexIds
    ]);

    assert.ok(innerBounds.minX > outerBounds.minX);
    assert.ok(innerBounds.maxX < outerBounds.maxX);
    assert.ok(innerBounds.minY > outerBounds.minY);
    assert.ok(innerBounds.maxY < outerBounds.maxY);
    assert.ok((innerBounds.maxX - innerBounds.minX) < (outerBounds.maxX - outerBounds.minX) / 2);
});

test('local fallback creates both a cone and a contained sphere', async () => {
    const service = createAIService();
    service.config.provider = 'local';
    service.config.apiKey = '';

    const result = await service.processCommand('원뿔 안에 구 그리고 높이 h를 표시해줘', { objects: [] });
    const cone = result.json.operations.find(operation => operation.type === 'cone');
    const sphere = result.json.operations.find(operation => operation.type === 'sphere');
    const heightLabel = result.json.operations.find(operation => operation.type === 'textLabel');

    assert.equal(result.success, true);
    assert.ok(cone);
    assert.ok(sphere);
    assert.equal(heightLabel.text, 'h');
    assert.ok(sphere.width < cone.width);
    assert.ok(sphere.height < cone.height);
});

test('deterministic fallback draws a labeled rectangular prism', () => {
    const service = createAIService();
    const result = service.fallbackProcessDeterministic('직육면체 ABCD EFGH 그려줘', { objects: [] });

    assert.equal(result.success, true);

    const prism = result.json.operations.find(operation => operation.type === 'prism');
    assert.ok(prism);
    assert.deepEqual(prism.baseVertexIds, ['outer_box_1', 'outer_box_2', 'outer_box_3', 'outer_box_4']);
    assert.deepEqual(prism.topVertexIds, ['outer_box_5', 'outer_box_6', 'outer_box_7', 'outer_box_8']);
    assert.deepEqual(
        result.json.operations.filter(operation => operation.type === 'point').map(operation => operation.label),
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
    );
});

test('local fallback draws prior CSAT hyperbola asymptote prompt', () => {
    const service = createAIService();
    const prompt = '\uC88C\uD45C\uD3C9\uBA74\uC5D0 \uC720\uB9AC\uD568\uC218 2/x\uB97C \uADF8\uB9AC\uACE0 \uC810\uADFC\uC120 x=0\uACFC y=0\uC744 \uD45C\uC2DC\uD574\uC918.';
    const result = service.fallbackProcess(prompt);

    assert.equal(result.success, true);

    const validation = new SchemaValidator().validate(result.json);
    assert.equal(validation.valid, true, validation.errors.join('\n'));

    assert.equal(result.json.operations.filter(operation => operation.type === 'function').length, 1);
    assert.equal(result.json.operations.find(operation => operation.type === 'function').expression, '2/x');
    assert.equal(result.json.operations.filter(operation => operation.type === 'line' && operation.dashed).length, 2);
    assert.deepEqual(
        result.json.operations.filter(operation => operation.type === 'point' && operation.visible !== false).map(operation => operation.label),
        ['A', 'B', 'C', 'D']
    );
});

test('local fallback draws prior CSAT three-circle lens prompt', () => {
    const service = createAIService();
    const prompt = '\uBC18\uC9C0\uB984 2.4\uC778 \uC138 \uC6D0\uC744 \uC911\uC2EC O(-1.5,0), P(1.5,0), Q(0,2.1)\uC5D0 \uB450\uACE0 lensRegion \uC138 \uAC1C\uB85C \uACB9\uCE68\uC744 \uD45C\uC2DC\uD574\uC918.';
    const result = service.fallbackProcess(prompt);

    assert.equal(result.success, true);

    const validation = new SchemaValidator().validate(result.json);
    assert.equal(validation.valid, true, validation.errors.join('\n'));

    assert.equal(result.json.operations.filter(operation => operation.type === 'circle').length, 3);
    assert.equal(result.json.operations.filter(operation => operation.type === 'lensRegion').length, 3);
    assert.deepEqual(
        result.json.operations.filter(operation => operation.type === 'point' && operation.visible !== false).map(operation => operation.label),
        ['O', 'P', 'Q']
    );
    assert.ok(
        result.json.operations
            .filter(operation => operation.id?.endsWith('_label'))
            .every(operation => operation.pointSize <= 0.5)
    );
});

test('local fallback draws prior CSAT square-pyramid midsection prompt', () => {
    const service = createAIService();
    const prompt = '\uC0AC\uAC01\uBFD4 pyramid\uB97C \uC218\uB2A5 \uB3C4\uC2DD\uCC98\uB7FC \uADF8\uB824\uC918. \uB9C8\uB984\uBAA8 \uD22C\uC601\uC758 \uBC11\uBA74\uACFC \uC911\uAC04 \uB192\uC774\uC758 \uB2E8\uBA74\uC744 \uD45C\uC2DC\uD574\uC918.';
    const result = service.fallbackProcess(prompt);

    assert.equal(result.success, true);

    const validation = new SchemaValidator().validate(result.json);
    assert.equal(validation.valid, true, validation.errors.join('\n'));

    const pyramid = result.json.operations.find(operation => operation.type === 'pyramid');
    const section = result.json.operations.find(operation => operation.type === 'polygon');
    const height = result.json.operations.find(operation => operation.type === 'segment');
    assert.ok(pyramid);
    assert.deepEqual(pyramid.baseVertexIds, ['A', 'B', 'C', 'D']);
    assert.equal(pyramid.apexId, 'V');
    assert.deepEqual(section.vertexIds, ['P', 'Q', 'R', 'S']);
    assert.equal(section.fillOpacity, 0.12);
    assert.equal(height.dashed, true);
    assert.equal(result.json.operations.filter(operation => operation.type === 'point' && operation.visible !== false).length, 0);
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

test('clearCredentials wipes the guest API key and proxy token from config and session storage', () => {
    withStorageEnvironment({ sessionKey: 'sk-guest-123' }, ({ sessionValues }) => {
        const service = new AIService(new AIServiceConfig());
        service.config.provider = 'openai';
        service.config.authMode = 'guest';
        service.setApiKey('sk-guest-123');
        assert.equal(service.config.apiKey, 'sk-guest-123');
        assert.equal(sessionValues.get('graphA_ai_key'), 'sk-guest-123');

        service.clearCredentials();

        assert.equal(service.config.apiKey, '', 'in-memory guest key must be cleared');
        assert.equal(service.config.proxyToken, '', 'proxy token must be cleared');
        assert.equal(sessionValues.has('graphA_ai_key'), false, 'session-stored guest key must be removed');
    });
});

test('setAuthSession owner mode does not leave a stale guest key', () => {
    withStorageEnvironment({ sessionKey: 'sk-guest-xyz' }, ({ sessionValues }) => {
        const service = new AIService(new AIServiceConfig());
        service.setApiKey('sk-guest-xyz');
        service.setAuthSession({ mode: 'owner', token: 'tok', expiresAt: Date.now() + 1000 });
        assert.equal(service.config.apiKey, '');
        assert.equal(sessionValues.has('graphA_ai_key'), false);
    });
});
