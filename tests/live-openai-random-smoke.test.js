import assert from 'node:assert/strict';
import test from 'node:test';

import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import {
    validateRuntimeReadablePayload,
    validateSmokeSemantics
} from '../tools/run-live-openai-random-drawing-smoke.mjs';

const sectorPrompt = { id: 'circle_sector_tangent' };
const quadraticPrompt = { id: 'quadratic_line_intersections' };
const incirclePrompt = { id: 'triangle_incircle_contacts' };
const parallelPrompt = { id: 'parallel_transversal_angles' };
const histogramPrompt = { id: 'histogram_frequency_polygon' };
const prismPrompt = { id: 'triangular_prism_hidden_edges' };

test('random smoke semantics rejects a collapsed sector from pointOnCircle t', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'O', type: 'point', x: 0, y: 0 },
            { op: 'create', id: 'A', type: 'point', x: 3, y: 0 },
            { op: 'create', id: 'c', type: 'circle', centerId: 'O', pointOnCircleId: 'A' },
            { op: 'create', id: 'B', type: 'pointOnCircle', circleId: 'c', t: 0.75 },
            { op: 'create', id: 'sector_AOB', type: 'sector', circleId: 'c', startPointId: 'A', endPointId: 'B' },
            { op: 'create', id: 'arc_AB', type: 'arc', circleId: 'c', startPointId: 'A', endPointId: 'B' }
        ]
    };

    const schema = new SchemaValidator().validate(payload);
    const runtimeErrors = validateRuntimeReadablePayload(payload);
    const semanticErrors = validateSmokeSemantics(payload, sectorPrompt);

    assert.equal(schema.valid, false);
    assert.match(schema.errors.join('\n'), /pointOnCircle uses "angle"/);
    assert.match(runtimeErrors.join('\n'), /pointOnCircle must use angle/);
    assert.match(semanticErrors.join('\n'), /resolvable distinct circle start\/end points/);
});

test('random smoke semantics accepts a visible sector with angle-based pointOnCircle', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'O', type: 'point', x: 0, y: 0 },
            { op: 'create', id: 'A', type: 'point', x: 3, y: 0 },
            { op: 'create', id: 'c', type: 'circle', centerId: 'O', pointOnCircleId: 'A' },
            { op: 'create', id: 'B', type: 'pointOnCircle', circleId: 'c', angle: Math.PI / 2 },
            { op: 'create', id: 'sector_AOB', type: 'sector', circleId: 'c', startPointId: 'A', endPointId: 'B', fillOpacity: 0.18 },
            { op: 'create', id: 'arc_AB', type: 'arc', circleId: 'c', startPointId: 'A', endPointId: 'B' }
        ]
    };

    assert.deepEqual(validateSmokeSemantics(payload, sectorPrompt), []);
});

test('random smoke semantics rejects line-only quadratic graph stand-ins', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'P', type: 'point', x: -3, y: -1 },
            { op: 'create', id: 'Q', type: 'point', x: 1, y: 3 },
            { op: 'create', id: 'l', type: 'line', point1Id: 'P', point2Id: 'Q' }
        ]
    };

    const errors = validateSmokeSemantics(payload, quadraticPrompt);

    assert.match(errors.join('\n'), /actual function object/);
    assert.match(errors.join('\n'), /tangentFunction/);
});

test('random smoke semantics accepts a real quadratic function and tangentFunction', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'f', type: 'function', expression: 'x^2 - 4' },
            { op: 'create', id: 'tan_f_1', type: 'tangentFunction', functionId: 'f', x: 1 }
        ]
    };

    assert.deepEqual(validateSmokeSemantics(payload, quadraticPrompt), []);
});

test('SchemaValidator rejects function expressions that include y equals', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'f', type: 'function', expression: 'y=x^2-4' }
        ]
    };

    const validation = new SchemaValidator().validate(payload);

    assert.equal(validation.valid, false);
    assert.match(validation.errors.join('\n'), /must omit "y="/);
});

test('extended smoke semantics rejects incircle contact markers on infinite triangle side lines', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 6, y: 0, label: 'B' },
            { op: 'create', id: 'C', type: 'point', x: 0, y: 8, label: 'C' },
            { op: 'create', id: 'AB', type: 'line', point1Id: 'A', point2Id: 'B' },
            { op: 'create', id: 'BC', type: 'line', point1Id: 'B', point2Id: 'C' },
            { op: 'create', id: 'CA', type: 'line', point1Id: 'C', point2Id: 'A' },
            { op: 'create', id: 'I', type: 'point', x: 2, y: 2, label: 'I' },
            { op: 'create', id: 'D', type: 'midpoint', segmentId: 'AB', label: 'D' },
            { op: 'create', id: 'incircle', type: 'circle', centerId: 'I', pointOnCircleId: 'D' },
            { op: 'create', id: 'ID', type: 'segment', point1Id: 'I', point2Id: 'D' },
            { op: 'create', id: 'right_D', type: 'rightAngleMarker', vertexId: 'D', line1Id: 'ID', line2Id: 'AB' }
        ]
    };

    const errors = validateSmokeSemantics(payload, incirclePrompt);

    assert.match(errors.join('\n'), /finite segment sides/);
    assert.match(errors.join('\n'), /not infinite line objects/);
    assert.match(errors.join('\n'), /three rightAngleMarker/);
});

test('extended smoke semantics accepts finite incircle contact side segments and right-angle markers', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 6, y: 0, label: 'B' },
            { op: 'create', id: 'C', type: 'point', x: 0, y: 8, label: 'C' },
            { op: 'create', id: 'tri', type: 'polygon', vertexIds: ['A', 'B', 'C'] },
            { op: 'create', id: 'AB', type: 'segment', point1Id: 'A', point2Id: 'B' },
            { op: 'create', id: 'BC', type: 'segment', point1Id: 'B', point2Id: 'C' },
            { op: 'create', id: 'CA', type: 'segment', point1Id: 'C', point2Id: 'A' },
            { op: 'create', id: 'I', type: 'point', x: 2, y: 2, label: 'I' },
            { op: 'create', id: 'D', type: 'point', x: 2, y: 0, label: 'D' },
            { op: 'create', id: 'E', type: 'point', x: 0, y: 2, label: 'E' },
            { op: 'create', id: 'F', type: 'point', x: 3.6, y: 3.2, label: 'F' },
            { op: 'create', id: 'incircle', type: 'circle', centerId: 'I', pointOnCircleId: 'D' },
            { op: 'create', id: 'ID', type: 'segment', point1Id: 'I', point2Id: 'D' },
            { op: 'create', id: 'IE', type: 'segment', point1Id: 'I', point2Id: 'E' },
            { op: 'create', id: 'IF', type: 'segment', point1Id: 'I', point2Id: 'F' },
            { op: 'create', id: 'right_D', type: 'rightAngleMarker', vertexId: 'D', line1Id: 'ID', line2Id: 'AB' },
            { op: 'create', id: 'right_E', type: 'rightAngleMarker', vertexId: 'E', line1Id: 'IE', line2Id: 'CA' },
            { op: 'create', id: 'right_F', type: 'rightAngleMarker', vertexId: 'F', line1Id: 'IF', line2Id: 'BC' }
        ]
    };

    assert.deepEqual(validateSmokeSemantics(payload, incirclePrompt), []);
});

test('extended smoke semantics resolves incircle contacts built from perpendicular feet', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 6, y: 0, label: 'B' },
            { op: 'create', id: 'C', type: 'point', x: 0, y: 8, label: 'C' },
            { op: 'create', id: 'AB', type: 'segment', point1Id: 'A', point2Id: 'B' },
            { op: 'create', id: 'BC', type: 'segment', point1Id: 'B', point2Id: 'C' },
            { op: 'create', id: 'CA', type: 'segment', point1Id: 'C', point2Id: 'A' },
            { op: 'create', id: 'tri', type: 'polygon', vertexIds: ['A', 'B', 'C'] },
            { op: 'create', id: 'I', type: 'point', x: 2, y: 2, label: 'I' },
            { op: 'create', id: 'perpAB', type: 'perpendicular', baseLineId: 'AB', throughPointId: 'I' },
            { op: 'create', id: 'perpBC', type: 'perpendicular', baseLineId: 'BC', throughPointId: 'I' },
            { op: 'create', id: 'perpCA', type: 'perpendicular', baseLineId: 'CA', throughPointId: 'I' },
            { op: 'create', id: 'D', type: 'intersection', object1Id: 'perpAB', object2Id: 'AB', label: 'D' },
            { op: 'create', id: 'E', type: 'intersection', object1Id: 'perpBC', object2Id: 'BC', label: 'E' },
            { op: 'create', id: 'F', type: 'intersection', object1Id: 'perpCA', object2Id: 'CA', label: 'F' },
            { op: 'create', id: 'incircle', type: 'circle', centerId: 'I', pointOnCircleId: 'D' },
            { op: 'create', id: 'IDseg', type: 'segment', point1Id: 'I', point2Id: 'D' },
            { op: 'create', id: 'IEseg', type: 'segment', point1Id: 'I', point2Id: 'E' },
            { op: 'create', id: 'IFseg', type: 'segment', point1Id: 'I', point2Id: 'F' },
            { op: 'create', id: 'rD', type: 'rightAngleMarker', vertexId: 'D', line1Id: 'IDseg', line2Id: 'AB' },
            { op: 'create', id: 'rE', type: 'rightAngleMarker', vertexId: 'E', line1Id: 'IEseg', line2Id: 'BC' },
            { op: 'create', id: 'rF', type: 'rightAngleMarker', vertexId: 'F', line1Id: 'IFseg', line2Id: 'CA' }
        ]
    };

    assert.deepEqual(validateSmokeSemantics(payload, incirclePrompt), []);
});

test('SchemaValidator keeps rightAngleMarker segment1Id aliases invalid', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0 },
            { op: 'create', id: 'B', type: 'point', x: 1, y: 0 },
            { op: 'create', id: 'C', type: 'point', x: 0, y: 1 },
            { op: 'create', id: 'AB', type: 'segment', point1Id: 'A', point2Id: 'B' },
            { op: 'create', id: 'AC', type: 'segment', point1Id: 'A', point2Id: 'C' },
            { op: 'create', id: 'right_A', type: 'rightAngleMarker', vertexId: 'A', segment1Id: 'AB', segment2Id: 'AC' }
        ]
    };

    const validation = new SchemaValidator().validate(payload);

    assert.equal(validation.valid, false);
    assert.match(validation.errors.join('\n'), /line1Id/);
    assert.match(validation.errors.join('\n'), /line2Id/);
});

test('extended smoke semantics rejects too few transversal angle markers', () => {
    const payload = parallelBasePayload([
        { op: 'create', id: 'angle_1', type: 'angleDimension', vertexId: 'P', point1Id: 'P_left', point2Id: 'P_down' },
        { op: 'create', id: 'angle_2', type: 'angleDimension', vertexId: 'Q', point1Id: 'Q_right', point2Id: 'Q_up' },
        { op: 'create', id: 'angle_3', type: 'angleDimension', vertexId: 'P', point1Id: 'P_right', point2Id: 'P_up' }
    ]);

    const errors = validateSmokeSemantics(payload, parallelPrompt);

    assert.match(errors.join('\n'), /at least 6 angleDimension/);
});

test('extended smoke semantics accepts six angle markers on transversal intersections', () => {
    const payload = parallelBasePayload([
        { op: 'create', id: 'angle_1', type: 'angleDimension', vertexId: 'P', point1Id: 'P_left', point2Id: 'P_down', arcRadius: 0.35, showValue: false },
        { op: 'create', id: 'angle_2', type: 'angleDimension', vertexId: 'Q', point1Id: 'Q_right', point2Id: 'Q_up', arcRadius: 0.35, showValue: false },
        { op: 'create', id: 'angle_3', type: 'angleDimension', vertexId: 'P', point1Id: 'P_right', point2Id: 'P_up', arcRadius: 0.55, showValue: false },
        { op: 'create', id: 'angle_4', type: 'angleDimension', vertexId: 'Q', point1Id: 'Q_left', point2Id: 'Q_down', arcRadius: 0.55, showValue: false },
        { op: 'create', id: 'angle_5', type: 'angleDimension', vertexId: 'P', point1Id: 'P_left', point2Id: 'P_up', arcRadius: 0.75, showValue: false },
        { op: 'create', id: 'angle_6', type: 'angleDimension', vertexId: 'Q', point1Id: 'Q_left', point2Id: 'Q_up', arcRadius: 0.75, showValue: false }
    ]);

    assert.deepEqual(validateSmokeSemantics(payload, parallelPrompt), []);
});

test('extended smoke semantics rejects overlapping angle markers at the same transversal vertex', () => {
    const payload = parallelBasePayload([
        { op: 'create', id: 'angle_1', type: 'angleDimension', vertexId: 'P', point1Id: 'P_left', point2Id: 'P_down' },
        { op: 'create', id: 'angle_2', type: 'angleDimension', vertexId: 'Q', point1Id: 'Q_right', point2Id: 'Q_up' },
        { op: 'create', id: 'angle_3', type: 'angleDimension', vertexId: 'P', point1Id: 'P_right', point2Id: 'P_up' },
        { op: 'create', id: 'angle_4', type: 'angleDimension', vertexId: 'Q', point1Id: 'Q_left', point2Id: 'Q_down' },
        { op: 'create', id: 'angle_5', type: 'angleDimension', vertexId: 'P', point1Id: 'P_left', point2Id: 'P_up' },
        { op: 'create', id: 'angle_6', type: 'angleDimension', vertexId: 'Q', point1Id: 'Q_left', point2Id: 'Q_up' }
    ]);

    const errors = validateSmokeSemantics(payload, parallelPrompt);

    assert.match(errors.join('\n'), /distinct arcRadius/);
});

test('extended smoke semantics rejects half-offset histogram bins', () => {
    const payload = histogramPayload(0.5);
    const errors = validateSmokeSemantics(payload, histogramPrompt);

    assert.match(errors.join('\n'), /bar 1 should cover class interval \[0,1\]/);
});

test('extended smoke semantics accepts histogram bars on zero-based class intervals', () => {
    const payload = histogramPayload(0);

    assert.deepEqual(validateSmokeSemantics(payload, histogramPrompt), []);
});

test('extended smoke semantics rejects hand-drawn triangular-prism edge sets without prism object', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0 },
            { op: 'create', id: 'B', type: 'point', x: 4, y: 0 },
            { op: 'create', id: 'C', type: 'point', x: 1, y: 2 },
            { op: 'create', id: 'Ap', type: 'point', x: 1, y: 3 },
            { op: 'create', id: 'Bp', type: 'point', x: 5, y: 3 },
            { op: 'create', id: 'Cp', type: 'point', x: 2, y: 5 },
            { op: 'create', id: 'AB', type: 'segment', point1Id: 'A', point2Id: 'B' },
            { op: 'create', id: 'BC', type: 'segment', point1Id: 'B', point2Id: 'C', dashed: true },
            { op: 'create', id: 'CA', type: 'segment', point1Id: 'C', point2Id: 'A' },
            { op: 'create', id: 'AAp', type: 'segment', point1Id: 'A', point2Id: 'Ap' }
        ]
    };

    const errors = validateSmokeSemantics(payload, prismPrompt);

    assert.match(errors.join('\n'), /first-class prism object/);
});

test('extended smoke semantics accepts first-class triangular prism objects', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0 },
            { op: 'create', id: 'B', type: 'point', x: 4, y: 0 },
            { op: 'create', id: 'C', type: 'point', x: 1, y: 2 },
            { op: 'create', id: 'Ap', type: 'point', x: 1, y: 3 },
            { op: 'create', id: 'Bp', type: 'point', x: 5, y: 3 },
            { op: 'create', id: 'Cp', type: 'point', x: 2, y: 5 },
            { op: 'create', id: 'prism_tri', type: 'prism', baseVertexIds: ['A', 'B', 'C'], topVertexIds: ['Ap', 'Bp', 'Cp'] }
        ]
    };

    assert.deepEqual(validateSmokeSemantics(payload, prismPrompt), []);
});

test('prompt-local smoke expectations reject missing required object families', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'f', type: 'function', expression: 'x^2' }
        ]
    };
    const prompt = {
        id: 'stress_expectation_sample',
        expect: { minTypes: { function: 2, prism: 1 } }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /expected at least 2 "function"/);
    assert.match(errors.join('\n'), /expected at least 1 "prism"/);
});

test('prompt-local smoke expectations accept the requested object families', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'f1', type: 'function', expression: 'x^2' },
            { op: 'create', id: 'f2', type: 'function', expression: 'x^3' },
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0 },
            { op: 'create', id: 'B', type: 'point', x: 2, y: 0 },
            { op: 'create', id: 'C', type: 'point', x: 0, y: 2 },
            { op: 'create', id: 'Ap', type: 'point', x: 0.5, y: 1 },
            { op: 'create', id: 'Bp', type: 'point', x: 2.5, y: 1 },
            { op: 'create', id: 'Cp', type: 'point', x: 0.5, y: 3 },
            { op: 'create', id: 'prism_1', type: 'prism', baseVertexIds: ['A', 'B', 'C'], topVertexIds: ['Ap', 'Bp', 'Cp'] }
        ]
    };
    const prompt = {
        id: 'stress_expectation_sample',
        expect: { minTypes: { function: 2, prism: 1 } }
    };

    assert.deepEqual(validateSmokeSemantics(payload, prompt), []);
});

test('prompt-local smoke expectations reject runtime-generated label clutter', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'f', type: 'function', expression: 'x^2' },
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0 },
            { op: 'create', id: 'B', type: 'point', x: 1, y: 0 },
            { op: 'create', id: 'C', type: 'point', x: 0, y: 1 }
        ]
    };
    const prompt = {
        id: 'label_budget_sample',
        expect: { maxVisibleLabels: 2 }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /at most 2 runtime-visible label/);
    assert.match(errors.join('\n'), /runtime default/);
});

test('prompt-local smoke expectations accept hidden helper labels', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'f', type: 'function', expression: 'x^2', showLabel: false },
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 1, y: 0, showLabel: false },
            { op: 'create', id: 'C', type: 'point', x: 0, y: 1, showLabel: false }
        ]
    };
    const prompt = {
        id: 'label_budget_sample',
        expect: { maxVisibleLabels: 1 }
    };

    assert.deepEqual(validateSmokeSemantics(payload, prompt), []);
});

test('prompt-local smoke expectations reject long visible labels in dense diagrams', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, label: '교점' },
            { op: 'create', id: 'B', type: 'point', x: 1, y: 0, label: 'B' }
        ]
    };
    const prompt = {
        id: 'short_label_sample',
        expect: { maxVisibleLabels: 2, maxLabelTextLength: 1 }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /visible labels must be 1 character/);
    assert.match(errors.join('\n'), /교점/);
});

test('prompt-local smoke expectations reject missing tangent x values and dashed lines', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'f', type: 'function', expression: 'x^3 - 3*x', showLabel: false },
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, showLabel: false },
            { op: 'create', id: 'B', type: 'point', x: 1, y: 0, showLabel: false },
            { op: 'create', id: 'l', type: 'line', point1Id: 'A', point2Id: 'B' },
            { op: 'create', id: 't0', type: 'tangentFunction', functionId: 'f', x: 0, showLabel: false }
        ]
    };
    const prompt = {
        id: 'stress_specific_sample',
        expect: { requiredTangentXs: [-1, 0, 1], minDashedLines: 1 }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /tangentFunction at x=-1/);
    assert.match(errors.join('\n'), /tangentFunction at x=1/);
    assert.match(errors.join('\n'), /dashed line/);
});

test('prompt-local smoke expectations reject duplicate circle-intersection lens points', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'O', type: 'point', x: -2, y: 0, label: 'O' },
            { op: 'create', id: 'P', type: 'point', x: 2, y: 0, label: 'P' },
            { op: 'create', id: 'R1', type: 'point', x: -2, y: 3, showLabel: false },
            { op: 'create', id: 'R2', type: 'point', x: 2, y: 3, showLabel: false },
            { op: 'create', id: 'c1', type: 'circle', centerId: 'O', pointOnCircleId: 'R1', showLabel: false },
            { op: 'create', id: 'c2', type: 'circle', centerId: 'P', pointOnCircleId: 'R2', showLabel: false },
            { op: 'create', id: 'A', type: 'intersection', object1Id: 'c1', object2Id: 'c2', label: 'A' },
            { op: 'create', id: 'B', type: 'intersection', object1Id: 'c1', object2Id: 'c2', label: 'B' },
            { op: 'create', id: 'lens', type: 'polygon', vertexIds: ['A', 'R1', 'R2', 'B'], showLabel: false }
        ]
    };
    const prompt = {
        id: 'two_circle_lens_region',
        expect: { requireDirectLensPoints: true }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /must be direct point objects/);
});

test('prompt-local smoke expectations reject inner solid points outside the outer prism', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: -2, y: -1, showLabel: false },
            { op: 'create', id: 'B', type: 'point', x: 2, y: -1, showLabel: false },
            { op: 'create', id: 'C', type: 'point', x: 2, y: 1, showLabel: false },
            { op: 'create', id: 'D', type: 'point', x: -2, y: 1, showLabel: false },
            { op: 'create', id: 'Ap', type: 'point', x: -1, y: 0, showLabel: false },
            { op: 'create', id: 'Bp', type: 'point', x: 3, y: 0, showLabel: false },
            { op: 'create', id: 'Cp', type: 'point', x: 3, y: 2, showLabel: false },
            { op: 'create', id: 'Dp', type: 'point', x: -1, y: 2, showLabel: false },
            { op: 'create', id: 'outer', type: 'prism', baseVertexIds: ['A', 'B', 'C', 'D'], topVertexIds: ['Ap', 'Bp', 'Cp', 'Dp'], showLabel: false },
            { op: 'create', id: 'inner1', type: 'point', x: 4, y: 0, showLabel: false },
            { op: 'create', id: 'inner2', type: 'point', x: 4.5, y: 0, showLabel: false }
        ]
    };
    const prompt = {
        id: 'nested_bounds_sample',
        expect: { innerWithinFirstPrism: true }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /inside the first prism projection bounds/);
});

test('prompt-local smoke expectations reject inner solid points outside a slanted prism projection hull', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, showLabel: false },
            { op: 'create', id: 'B', type: 'point', x: 4, y: 0, showLabel: false },
            { op: 'create', id: 'C', type: 'point', x: 4, y: 1, showLabel: false },
            { op: 'create', id: 'D', type: 'point', x: 0, y: 1, showLabel: false },
            { op: 'create', id: 'Ap', type: 'point', x: 1, y: 1, showLabel: false },
            { op: 'create', id: 'Bp', type: 'point', x: 5, y: 1, showLabel: false },
            { op: 'create', id: 'Cp', type: 'point', x: 5, y: 2, showLabel: false },
            { op: 'create', id: 'Dp', type: 'point', x: 1, y: 2, showLabel: false },
            { op: 'create', id: 'outer', type: 'prism', baseVertexIds: ['A', 'B', 'C', 'D'], topVertexIds: ['Ap', 'Bp', 'Cp', 'Dp'], showLabel: false },
            { op: 'create', id: 'inner_near_corner', type: 'point', x: 0.2, y: 1.8, showLabel: false }
        ]
    };
    const prompt = {
        id: 'nested_hull_sample',
        expect: { innerWithinFirstPrism: true }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /inside the first prism projection bounds/);
});

test('smoke semantics rejects pixel-style point coordinates outside the default view', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 120, y: 260 }
        ]
    };
    const prompt = { id: 'stress_coordinate_sample' };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /coordinates must stay within \+\/-20/);
});

function parallelBasePayload(angles) {
    return {
        operations: [
            { op: 'create', id: 'L1a', type: 'point', x: -4, y: 2 },
            { op: 'create', id: 'L1b', type: 'point', x: 4, y: 2 },
            { op: 'create', id: 'L2a', type: 'point', x: -4, y: 0 },
            { op: 'create', id: 'L2b', type: 'point', x: 4, y: 0 },
            { op: 'create', id: 'T1', type: 'point', x: -2, y: -1 },
            { op: 'create', id: 'T2', type: 'point', x: 2, y: 3 },
            { op: 'create', id: 'l', type: 'line', point1Id: 'L1a', point2Id: 'L1b' },
            { op: 'create', id: 'm', type: 'line', point1Id: 'L2a', point2Id: 'L2b' },
            { op: 'create', id: 't', type: 'line', point1Id: 'T1', point2Id: 'T2' },
            { op: 'create', id: 'P', type: 'intersection', object1Id: 'l', object2Id: 't' },
            { op: 'create', id: 'Q', type: 'intersection', object1Id: 'm', object2Id: 't' },
            { op: 'create', id: 'P_left', type: 'point', x: 0, y: 2 },
            { op: 'create', id: 'P_right', type: 'point', x: 2, y: 2 },
            { op: 'create', id: 'P_down', type: 'point', x: 0, y: 1 },
            { op: 'create', id: 'P_up', type: 'point', x: 2, y: 3 },
            { op: 'create', id: 'Q_left', type: 'point', x: -2, y: 0 },
            { op: 'create', id: 'Q_right', type: 'point', x: 0, y: 0 },
            { op: 'create', id: 'Q_down', type: 'point', x: -2, y: -1 },
            { op: 'create', id: 'Q_up', type: 'point', x: 0, y: 1 },
            ...angles
        ]
    };
}

function histogramPayload(startX) {
    const heights = [2, 4, 3, 5, 2];
    const operations = [
        { op: 'create', id: 'axis', type: 'numberLine', start: 0, end: 5, step: 1, y: 0 }
    ];

    for (let index = 0; index < heights.length; index += 1) {
        const x0 = startX + index;
        const x1 = startX + index + 1;
        const y1 = heights[index];
        operations.push(
            { op: 'create', id: `B${index}_a`, type: 'point', x: x0, y: 0 },
            { op: 'create', id: `B${index}_b`, type: 'point', x: x1, y: 0 },
            { op: 'create', id: `B${index}_c`, type: 'point', x: x1, y: y1 },
            { op: 'create', id: `B${index}_d`, type: 'point', x: x0, y: y1 },
            { op: 'create', id: `bar_${index}`, type: 'polygon', vertexIds: [`B${index}_a`, `B${index}_b`, `B${index}_c`, `B${index}_d`] }
        );
    }

    return { operations };
}
