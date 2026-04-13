import assert from 'node:assert/strict';
import test from 'node:test';

import { parseAIJSONPayload } from '../js/ai/JSONUtils.js';
import { AIService } from '../js/ai/AIService.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';

function createAIService() {
    return new AIService({
        provider: 'local',
        apiKey: '',
        save() { }
    });
}

function createPatchHarness() {
    const objects = new Map();
    const history = [];

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
