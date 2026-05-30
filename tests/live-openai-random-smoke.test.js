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

test('prompt-local smoke expectations reject wrong asymptote line geometry', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: -1, y: 1, showLabel: false },
            { op: 'create', id: 'B', type: 'point', x: 1, y: 3, showLabel: false },
            { op: 'create', id: 'C', type: 'point', x: -4, y: -2, showLabel: false },
            { op: 'create', id: 'D', type: 'point', x: 4, y: 6, showLabel: false },
            { op: 'create', id: 'bad_vertical', type: 'line', point1Id: 'A', point2Id: 'B', dashed: true, showLabel: false },
            { op: 'create', id: 'slant', type: 'line', point1Id: 'C', point2Id: 'D', dashed: true, showLabel: false }
        ]
    };
    const prompt = {
        id: 'rational_slant_asymptote',
        expect: {
            requiredLinePatterns: [
                { kind: 'vertical', x: 2, dashed: true },
                { kind: 'slopeIntercept', slope: 1, intercept: 2, dashed: true }
            ]
        }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /vertical x=2 dashed/);
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

test('prompt-local smoke expectations reject points outside required coordinate windows', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'f1', type: 'function', expression: 'exp(0.4*x)-1', showLabel: false },
            { op: 'create', id: 'f2', type: 'function', expression: 'ln(x+5)-1', showLabel: false },
            { op: 'create', id: 'A', type: 'point', x: 1.5, y: 0.82, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 1.5, y: 0.88, label: 'B' }
        ]
    };
    const prompt = {
        id: 'exp_log_two_curve_window',
        expect: {
            requiredPointWindows: [
                { name: 'A', xMin: -4.05, xMax: -3.45, yMin: -1.05, yMax: -0.5 },
                { name: 'B', xMin: 1.25, xMax: 1.9, yMin: 0.6, yMax: 1.15 }
            ]
        }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /point A should be inside/);
});

test('prompt-local smoke expectations reject visible helper points in lens diagrams', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'O', type: 'point', x: -2, y: 0, label: 'O' },
            { op: 'create', id: 'P', type: 'point', x: 2, y: 0, label: 'P' },
            { op: 'create', id: 'A', type: 'point', x: 0, y: 2.24, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 0, y: -2.24, label: 'B' },
            { op: 'create', id: 'h1', type: 'point', x: 0.5, y: 1, showLabel: false },
            { op: 'create', id: 'h2', type: 'point', x: 0.5, y: -1, showLabel: false },
            { op: 'create', id: 'lens', type: 'polygon', vertexIds: ['A', 'h1', 'B', 'h2'], showLabel: false }
        ]
    };
    const prompt = {
        id: 'two_circle_lens_region',
        expect: { maxVisiblePointCount: 4 }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /at most 4 visible point/);
    assert.match(errors.join('\n'), /visible:false/);
});

test('prompt-local smoke expectations reject unequal-radius lens circles', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'O', type: 'point', x: -2, y: 0, label: 'O' },
            { op: 'create', id: 'P', type: 'point', x: 2, y: 0, label: 'P' },
            { op: 'create', id: 'A', type: 'point', x: 0, y: 2.24, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 0, y: -2.24, label: 'B' },
            { op: 'create', id: 'r1', type: 'point', x: 1, y: 0, visible: false, showLabel: false },
            { op: 'create', id: 'r2', type: 'point', x: 3, y: 0, visible: false, showLabel: false },
            { op: 'create', id: 'c1', type: 'circle', centerId: 'O', pointOnCircleId: 'r1', showLabel: false },
            { op: 'create', id: 'c2', type: 'circle', centerId: 'P', pointOnCircleId: 'r2', showLabel: false }
        ]
    };
    const prompt = {
        id: 'two_circle_lens_region',
        expect: { lensCircleRadius: 3 }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /both lens circles must have radius 3/);
    assert.match(errors.join('\n'), /equal radii/);
});

test('prompt-local smoke expectations reject self-crossing lens polygons', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'O', type: 'point', x: -2, y: 0, label: 'O' },
            { op: 'create', id: 'P', type: 'point', x: 2, y: 0, label: 'P' },
            { op: 'create', id: 'A', type: 'point', x: 0, y: 2.24, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 0, y: -2.24, label: 'B' },
            { op: 'create', id: 'r1', type: 'point', x: 1, y: 0, visible: false, showLabel: false },
            { op: 'create', id: 'r2', type: 'point', x: 5, y: 0, visible: false, showLabel: false },
            { op: 'create', id: 'c1', type: 'circle', centerId: 'O', pointOnCircleId: 'r1', showLabel: false },
            { op: 'create', id: 'c2', type: 'circle', centerId: 'P', pointOnCircleId: 'r2', showLabel: false },
            { op: 'create', id: 'h1', type: 'point', x: 0.56, y: 1.57, visible: false, showLabel: false },
            { op: 'create', id: 'h2', type: 'point', x: 1, y: 0, visible: false, showLabel: false },
            { op: 'create', id: 'h3', type: 'point', x: 0.56, y: -1.57, visible: false, showLabel: false },
            { op: 'create', id: 'h4', type: 'point', x: -0.56, y: 1.57, visible: false, showLabel: false },
            { op: 'create', id: 'h5', type: 'point', x: -1, y: 0, visible: false, showLabel: false },
            { op: 'create', id: 'h6', type: 'point', x: -0.56, y: -1.57, visible: false, showLabel: false },
            { op: 'create', id: 'lens', type: 'polygon', vertexIds: ['A', 'h1', 'h2', 'h3', 'B', 'h4', 'h5', 'h6'], showLabel: false }
        ]
    };
    const prompt = {
        id: 'two_circle_lens_region',
        expect: { requireSimpleLensPolygon: true }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /self-intersects/);
});

test('prompt-local smoke expectations reject lens polygon vertices outside the lens bounds', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 2.24, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 0, y: -2.24, label: 'B' },
            { op: 'create', id: 'h1', type: 'point', x: 0.6, y: 2.7, visible: false, showLabel: false },
            { op: 'create', id: 'h2', type: 'point', x: 1, y: 0, visible: false, showLabel: false },
            { op: 'create', id: 'h3', type: 'point', x: 0.6, y: -1.5, visible: false, showLabel: false },
            { op: 'create', id: 'h4', type: 'point', x: -0.6, y: -1.5, visible: false, showLabel: false },
            { op: 'create', id: 'h5', type: 'point', x: -1, y: 0, visible: false, showLabel: false },
            { op: 'create', id: 'h6', type: 'point', x: -0.6, y: 1.5, visible: false, showLabel: false },
            { op: 'create', id: 'lens', type: 'polygon', vertexIds: ['A', 'h1', 'h2', 'h3', 'B', 'h4', 'h5', 'h6'], showLabel: false }
        ]
    };
    const prompt = {
        id: 'two_circle_lens_region',
        expect: { lensPolygonBounds: { xMin: -1.05, xMax: 1.05, yMin: -2.38, yMax: 2.38 } }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /lens polygon helper vertices/);
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

test('prompt-local smoke expectations reject angle markers whose helper point equals the vertex', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'V', type: 'point', x: 0, y: 0, showLabel: false },
            { op: 'create', id: 'A', type: 'point', x: 2, y: 0, showLabel: false },
            { op: 'create', id: 'bad', type: 'angleDimension', vertexId: 'V', point1Id: 'A', point2Id: 'V', showValue: false, showLabel: false }
        ]
    };
    const prompt = {
        id: 'renderable_angle_sample',
        expect: { requireRenderableAngles: true }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /visible non-degenerate angle/);
});

test('prompt-local smoke expectations reject filled construction polygons', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, showLabel: false },
            { op: 'create', id: 'B', type: 'point', x: 2, y: 0, showLabel: false },
            { op: 'create', id: 'C', type: 'point', x: 1, y: 1, showLabel: false },
            { op: 'create', id: 'poly', type: 'polygon', vertexIds: ['A', 'B', 'C'], showLabel: false }
        ]
    };
    const prompt = {
        id: 'unfilled_polygon_sample',
        expect: { maxPolygonFillOpacity: 0 }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /fillOpacity <= 0/);
});

test('prompt-local smoke expectations reject pyramid apex reused as a base vertex', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, showLabel: false },
            { op: 'create', id: 'B', type: 'point', x: 2, y: 0, showLabel: false },
            { op: 'create', id: 'C', type: 'point', x: 1, y: 1, showLabel: false },
            { op: 'create', id: 'bad_pyramid', type: 'pyramid', apexId: 'A', baseVertexIds: ['A', 'B', 'C'], showLabel: false }
        ]
    };
    const prompt = {
        id: 'pyramid_apex_sample',
        expect: { validPyramidApexes: true }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /apexId must be a distinct/);
});

test('prompt-local smoke expectations reject nested inner solids that visually overlap', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: -4, y: -2, showLabel: false },
            { op: 'create', id: 'B', type: 'point', x: 4, y: -2, showLabel: false },
            { op: 'create', id: 'C', type: 'point', x: 4, y: 2, showLabel: false },
            { op: 'create', id: 'D', type: 'point', x: -4, y: 2, showLabel: false },
            { op: 'create', id: 'A2', type: 'point', x: -3, y: -1, showLabel: false },
            { op: 'create', id: 'B2', type: 'point', x: 5, y: -1, showLabel: false },
            { op: 'create', id: 'C2', type: 'point', x: 5, y: 3, showLabel: false },
            { op: 'create', id: 'D2', type: 'point', x: -3, y: 3, showLabel: false },
            { op: 'create', id: 'outer', type: 'prism', baseVertexIds: ['A', 'B', 'C', 'D'], topVertexIds: ['A2', 'B2', 'C2', 'D2'], showLabel: false },
            { op: 'create', id: 'E', type: 'point', x: -0.5, y: -0.3, showLabel: false },
            { op: 'create', id: 'F', type: 'point', x: 0.5, y: -0.3, showLabel: false },
            { op: 'create', id: 'G', type: 'point', x: 0.5, y: 0.3, showLabel: false },
            { op: 'create', id: 'H', type: 'point', x: -0.5, y: 0.3, showLabel: false },
            { op: 'create', id: 'E2', type: 'point', x: -0.2, y: 0, showLabel: false },
            { op: 'create', id: 'F2', type: 'point', x: 0.8, y: 0, showLabel: false },
            { op: 'create', id: 'G2', type: 'point', x: 0.8, y: 0.6, showLabel: false },
            { op: 'create', id: 'H2', type: 'point', x: -0.2, y: 0.6, showLabel: false },
            { op: 'create', id: 'inner_prism', type: 'prism', baseVertexIds: ['E', 'F', 'G', 'H'], topVertexIds: ['E2', 'F2', 'G2', 'H2'], showLabel: false },
            { op: 'create', id: 'P1', type: 'point', x: -0.4, y: -0.2, showLabel: false },
            { op: 'create', id: 'P2', type: 'point', x: 0.4, y: -0.2, showLabel: false },
            { op: 'create', id: 'P3', type: 'point', x: 0.4, y: 0.4, showLabel: false },
            { op: 'create', id: 'P4', type: 'point', x: -0.4, y: 0.4, showLabel: false },
            { op: 'create', id: 'APEX', type: 'point', x: 0, y: 0.8, showLabel: false },
            { op: 'create', id: 'inner_pyramid', type: 'pyramid', apexId: 'APEX', baseVertexIds: ['P1', 'P2', 'P3', 'P4'], showLabel: false }
        ]
    };
    const prompt = {
        id: 'inner_separation_sample',
        expect: { innerSolidMinCenterDistance: 1.1 }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /visually separated/);
});

test('prompt-local smoke expectations reject non-triangular prism when triangular prism is required', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: -1, y: -1, showLabel: false },
            { op: 'create', id: 'B', type: 'point', x: 1, y: -1, showLabel: false },
            { op: 'create', id: 'C', type: 'point', x: 1, y: 1, showLabel: false },
            { op: 'create', id: 'D', type: 'point', x: -1, y: 1, showLabel: false },
            { op: 'create', id: 'A2', type: 'point', x: -0.5, y: -0.5, showLabel: false },
            { op: 'create', id: 'B2', type: 'point', x: 1.5, y: -0.5, showLabel: false },
            { op: 'create', id: 'C2', type: 'point', x: 1.5, y: 1.5, showLabel: false },
            { op: 'create', id: 'D2', type: 'point', x: -0.5, y: 1.5, showLabel: false },
            { op: 'create', id: 'box_like_prism', type: 'prism', baseVertexIds: ['A', 'B', 'C', 'D'], topVertexIds: ['A2', 'B2', 'C2', 'D2'], showLabel: false }
        ]
    };
    const prompt = {
        id: 'triangular_prism_inside_square_pyramid',
        expect: { requiredPrismVertexCounts: [3] }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /expected at least one prism with 3 base vertices/);
});

test('prompt-local smoke expectations reject twisted prism vertex ordering', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: 0, y: 0, visible: false, showLabel: false },
            { op: 'create', id: 'B', type: 'point', x: 2, y: 0, visible: false, showLabel: false },
            { op: 'create', id: 'C', type: 'point', x: 2, y: 1, visible: false, showLabel: false },
            { op: 'create', id: 'D', type: 'point', x: 0, y: 1, visible: false, showLabel: false },
            { op: 'create', id: 'A2', type: 'point', x: 0.5, y: 0.5, visible: false, showLabel: false },
            { op: 'create', id: 'B2', type: 'point', x: 2.5, y: 0.5, visible: false, showLabel: false },
            { op: 'create', id: 'C2', type: 'point', x: 2.5, y: 1.5, visible: false, showLabel: false },
            { op: 'create', id: 'D2', type: 'point', x: 0.5, y: 1.5, visible: false, showLabel: false },
            { op: 'create', id: 'twisted', type: 'prism', baseVertexIds: ['A', 'B', 'C', 'D'], topVertexIds: ['A2', 'C2', 'B2', 'D2'], showLabel: false }
        ]
    };
    const prompt = {
        id: 'valid_prism_projection_sample',
        expect: { validPrismProjections: true }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /same translated order/);
});

test('prompt-local smoke expectations reject triangular pyramids when square pyramids are required', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: -1, y: 0, showLabel: false },
            { op: 'create', id: 'B', type: 'point', x: 1, y: 0, showLabel: false },
            { op: 'create', id: 'C', type: 'point', x: 0, y: 1, showLabel: false },
            { op: 'create', id: 'D', type: 'point', x: 0, y: 2, showLabel: false },
            { op: 'create', id: 'tri_pyramid_1', type: 'pyramid', apexId: 'D', baseVertexIds: ['A', 'B', 'C'], showLabel: false },
            { op: 'create', id: 'E', type: 'point', x: -1, y: -2, showLabel: false },
            { op: 'create', id: 'F', type: 'point', x: 1, y: -2, showLabel: false },
            { op: 'create', id: 'G', type: 'point', x: 0, y: -1, showLabel: false },
            { op: 'create', id: 'H', type: 'point', x: 0, y: -3, showLabel: false },
            { op: 'create', id: 'tri_pyramid_2', type: 'pyramid', apexId: 'H', baseVertexIds: ['E', 'F', 'G'], showLabel: false }
        ]
    };
    const prompt = {
        id: 'double_pyramid_inside_box',
        expect: { requiredPyramidBaseVertexCounts: [{ count: 4, min: 2 }] }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /2 pyramid object\(s\) with 4 base vertices/);
});

test('prompt-local smoke expectations reject missing exact function expressions', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'f', type: 'function', expression: '4/(1+e^(-x))', showLabel: false }
        ]
    };
    const prompt = {
        id: 'logistic_midpoint_asymptotes',
        expect: { requiredFunctionExpressions: ['4/(1+exp(-x))'] }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /expected a function expression matching/);
});

test('prompt-local smoke expectations accept required segments between named points', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'P', type: 'point', x: 5, y: 0, label: 'P' },
            { op: 'create', id: 'T1', type: 'point', x: 1.8, y: 2.4, label: 'T1' },
            { op: 'create', id: 'PT1', type: 'segment', point1Id: 'P', point2Id: 'T1' }
        ]
    };
    const prompt = {
        id: 'external_point_two_tangents',
        expect: { requiredSegmentsBetween: [['P', 'T1']] }
    };

    assert.deepEqual(validateSmokeSemantics(payload, prompt), []);
});

test('prompt-local smoke expectations reject wrong fixed-radius circles', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
            { op: 'create', id: 'R', type: 'point', x: 2.5, y: 0, showLabel: false },
            { op: 'create', id: 'c', type: 'circle', centerId: 'O', pointOnCircleId: 'R', showLabel: false }
        ]
    };
    const prompt = {
        id: 'external_point_two_tangents',
        expect: { requiredCircleRadii: [{ center: 'O', radius: 3 }] }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /radius 3/);
});

test('prompt-local smoke expectations reject non-concentric circles', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
            { op: 'create', id: 'Q', type: 'point', x: 0.3, y: 0, showLabel: false },
            { op: 'create', id: 'R1', type: 'point', x: 2, y: 0, showLabel: false },
            { op: 'create', id: 'R2', type: 'point', x: 4.3, y: 0, showLabel: false },
            { op: 'create', id: 'c1', type: 'circle', centerId: 'O', pointOnCircleId: 'R1', showLabel: false },
            { op: 'create', id: 'c2', type: 'circle', centerId: 'Q', pointOnCircleId: 'R2', showLabel: false }
        ]
    };
    const prompt = {
        id: 'concentric_quarter_sector_wedge',
        expect: { requireConcentricCircles: { center: 'O', radii: [2, 4] } }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /at least 2 circles centered at O/);
});

test('prompt-local smoke expectations reject non-collinear named construction points', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'O', type: 'point', x: 0, y: 1, label: 'O' },
            { op: 'create', id: 'G', type: 'point', x: 0.33, y: 1.67, label: 'G' },
            { op: 'create', id: 'H', type: 'point', x: 1, y: 2, label: 'H' }
        ]
    };
    const prompt = {
        id: 'triangle_euler_line',
        expect: { requiredCollinearPointLabels: [['O', 'G', 'H']] }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /collinear/);
});

test('prompt-local smoke expectations reject missing required label offsets', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
            { op: 'create', id: 'T2', type: 'point', x: 1.8, y: -2.4, label: 'T2' }
        ]
    };
    const prompt = {
        id: 'external_point_two_tangents',
        expect: { requiredLabelOffsets: [{ name: 'T2', minMagnitude: 8 }] }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /label T2 must set labelOffset/);
});

test('prompt-local smoke expectations accept required label offsets', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'T2', type: 'point', x: 1.8, y: -2.4, label: 'T2', labelOffset: { x: 10, y: 8 } }
        ]
    };
    const prompt = {
        id: 'external_point_two_tangents',
        expect: { requiredLabelOffsets: [{ name: 'T2', minMagnitude: 8 }] }
    };

    assert.deepEqual(validateSmokeSemantics(payload, prompt), []);
});

test('prompt-local smoke expectations reject tiny or missing angleDimension right-angle aids', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
            { op: 'create', id: 'A', type: 'point', x: 4, y: 0, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 0, y: 4, label: 'B' },
            { op: 'create', id: 'OA', type: 'segment', point1Id: 'O', point2Id: 'A', showLabel: false },
            { op: 'create', id: 'OB', type: 'segment', point1Id: 'O', point2Id: 'B', showLabel: false },
            { op: 'create', id: 'right_AOB', type: 'rightAngleMarker', vertexId: 'O', line1Id: 'OA', line2Id: 'OB' },
            { op: 'create', id: 'angle_AOB', type: 'angleDimension', vertexId: 'O', point1Id: 'A', point2Id: 'B', arcRadius: 0.25, showValue: false }
        ]
    };
    const prompt = {
        id: 'concentric_quarter_sector_wedge',
        expect: {
            requireRenderableRightAngleMarkers: true,
            requireRenderableAngles: true,
            minAngleArcRadius: 0.7
        }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /arcRadius should be at least 0\.7/);
});

test('prompt-local smoke expectations accept renderable right-angle aids', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'O', type: 'point', x: 0, y: 0, label: 'O' },
            { op: 'create', id: 'A', type: 'point', x: 4, y: 0, label: 'A' },
            { op: 'create', id: 'B', type: 'point', x: 0, y: 4, label: 'B' },
            { op: 'create', id: 'OA', type: 'segment', point1Id: 'O', point2Id: 'A', showLabel: false },
            { op: 'create', id: 'OB', type: 'segment', point1Id: 'O', point2Id: 'B', showLabel: false },
            { op: 'create', id: 'right_AOB', type: 'rightAngleMarker', vertexId: 'O', line1Id: 'OA', line2Id: 'OB' },
            { op: 'create', id: 'angle_AOB', type: 'angleDimension', vertexId: 'O', point1Id: 'A', point2Id: 'B', arcRadius: 0.75, showValue: false }
        ]
    };
    const prompt = {
        id: 'concentric_quarter_sector_wedge',
        expect: {
            requireRenderableRightAngleMarkers: true,
            requireRenderableAngles: true,
            minAngleArcRadius: 0.7
        }
    };

    assert.deepEqual(validateSmokeSemantics(payload, prompt), []);
});

test('prompt-local smoke expectations reject tiny prism cross-sections', () => {
    const payload = {
        operations: [
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
            { op: 'create', id: 'section', type: 'polygon', vertexIds: ['P', 'Q', 'R', 'S'], fillOpacity: 0.25, showLabel: false }
        ]
    };
    const prompt = {
        id: 'prism_diagonal_cross_section',
        expect: {
            firstPrismProjection: { minWidth: 6, minHeight: 4.5, minAspectRatio: 1.2 },
            crossSectionPolygonScale: { minVertexCount: 4, minAreaRatio: 0.18, minWidthRatio: 0.5, minHeightRatio: 0.4 }
        }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /first prism projection is too small/);
    assert.match(errors.join('\n'), /cross-section polygon is too small/);
});

test('prompt-local smoke expectations accept broad prism cross-sections', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: -4, y: -2, showLabel: false },
            { op: 'create', id: 'B', type: 'point', x: 2, y: -2, showLabel: false },
            { op: 'create', id: 'C', type: 'point', x: 2, y: 1, showLabel: false },
            { op: 'create', id: 'D', type: 'point', x: -4, y: 1, showLabel: false },
            { op: 'create', id: 'A1', type: 'point', x: -2, y: 0, showLabel: false },
            { op: 'create', id: 'B1', type: 'point', x: 4, y: 0, showLabel: false },
            { op: 'create', id: 'C1', type: 'point', x: 4, y: 3, showLabel: false },
            { op: 'create', id: 'D1', type: 'point', x: -2, y: 3, showLabel: false },
            { op: 'create', id: 'box', type: 'prism', baseVertexIds: ['A', 'B', 'C', 'D'], topVertexIds: ['A1', 'B1', 'C1', 'D1'], showLabel: false },
            { op: 'create', id: 'P', type: 'point', x: -3, y: -1, showLabel: false },
            { op: 'create', id: 'Q', type: 'point', x: 1, y: -1, showLabel: false },
            { op: 'create', id: 'R', type: 'point', x: 3, y: 2, showLabel: false },
            { op: 'create', id: 'S', type: 'point', x: -1, y: 2, showLabel: false },
            { op: 'create', id: 'section', type: 'polygon', vertexIds: ['P', 'Q', 'R', 'S'], fillOpacity: 0.18, showLabel: false }
        ]
    };
    const prompt = {
        id: 'prism_diagonal_cross_section',
        expect: {
            firstPrismProjection: { minWidth: 6, minHeight: 4.5, minAspectRatio: 1.2 },
            crossSectionPolygonScale: { minVertexCount: 4, minAreaRatio: 0.18, minWidthRatio: 0.5, minHeightRatio: 0.4 }
        }
    };

    assert.deepEqual(validateSmokeSemantics(payload, prompt), []);
});

test('prompt-local smoke expectations reject cramped inner pyramids', () => {
    const payload = {
        operations: [
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
        ]
    };
    const prompt = {
        id: 'triangular_pyramid_inside_triangular_prism',
        expect: {
            firstPrismProjection: { minWidth: 6, minHeight: 5, minAspectRatio: 0.9 },
            innerSolidProjection: { type: 'pyramid', minWidthRatio: 0.25, minHeightRatio: 0.3, minMarginRatio: 0.16 }
        }
    };

    const errors = validateSmokeSemantics(payload, prompt);

    assert.match(errors.join('\n'), /first prism projection is too small/);
    assert.match(errors.join('\n'), /inner pyramid projection is too cramped/);
});

test('prompt-local smoke expectations accept centered inner pyramids', () => {
    const payload = {
        operations: [
            { op: 'create', id: 'A', type: 'point', x: -4, y: -2, showLabel: false },
            { op: 'create', id: 'B', type: 'point', x: 3, y: -2, showLabel: false },
            { op: 'create', id: 'C', type: 'point', x: -1, y: 2, showLabel: false },
            { op: 'create', id: 'A1', type: 'point', x: -2, y: 0, showLabel: false },
            { op: 'create', id: 'B1', type: 'point', x: 5, y: 0, showLabel: false },
            { op: 'create', id: 'C1', type: 'point', x: 1, y: 4, showLabel: false },
            { op: 'create', id: 'outer', type: 'prism', baseVertexIds: ['A', 'B', 'C'], topVertexIds: ['A1', 'B1', 'C1'], showLabel: false },
            { op: 'create', id: 'P', type: 'point', x: -1.8, y: -0.9, showLabel: false },
            { op: 'create', id: 'Q', type: 'point', x: 1, y: -0.9, showLabel: false },
            { op: 'create', id: 'R', type: 'point', x: -0.6, y: 0.7, showLabel: false },
            { op: 'create', id: 'V', type: 'point', x: 0, y: 1.8, showLabel: false },
            { op: 'create', id: 'inner', type: 'pyramid', apexId: 'V', baseVertexIds: ['P', 'Q', 'R'], showLabel: false }
        ]
    };
    const prompt = {
        id: 'triangular_pyramid_inside_triangular_prism',
        expect: {
            firstPrismProjection: { minWidth: 6, minHeight: 5, minAspectRatio: 0.9 },
            innerSolidProjection: { type: 'pyramid', minWidthRatio: 0.25, minHeightRatio: 0.3, minMarginRatio: 0.16 }
        }
    };

    assert.deepEqual(validateSmokeSemantics(payload, prompt), []);
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
