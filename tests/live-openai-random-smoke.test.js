import assert from 'node:assert/strict';
import test from 'node:test';

import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import {
    validateRuntimeReadablePayload,
    validateSmokeSemantics
} from '../tools/run-live-openai-random-drawing-smoke.mjs';

const sectorPrompt = { id: 'circle_sector_tangent' };
const quadraticPrompt = { id: 'quadratic_line_intersections' };

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
