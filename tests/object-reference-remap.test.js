import assert from 'node:assert/strict';
import test from 'node:test';

import {
    ARRAY_REFERENCE_FIELDS,
    SINGLE_REFERENCE_FIELDS,
    remapObjectReferences
} from '../js/utils/ObjectReferences.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';

const EXPECTED_SINGLE_FIELDS = [
    'point1Id', 'point2Id', 'point3Id', 'centerId', 'pointOnCircleId',
    'originId', 'directionPointId', 'lineId', 'circleId', 'segmentId',
    'circle1Id', 'circle2Id', 'object1Id', 'object2Id', 'baseLineId',
    'throughPointId', 'startPointId', 'endPointId', 'functionId', 'vertexId',
    'line1Id', 'line2Id', 'segment1Id', 'segment2Id', 'tangentPointId', 'apexId'
];

const EXPECTED_ARRAY_FIELDS = [
    'dependencies', 'vertexIds', 'baseVertexIds', 'topVertexIds', 'boundaryObjectIds'
];

test('reference field contracts cover every supported runtime reference', () => {
    assert.deepEqual([...SINGLE_REFERENCE_FIELDS], EXPECTED_SINGLE_FIELDS);
    assert.deepEqual([...ARRAY_REFERENCE_FIELDS], EXPECTED_ARRAY_FIELDS);
    assert.equal(Object.isFrozen(SINGLE_REFERENCE_FIELDS), true);
    assert.equal(Object.isFrozen(ARRAY_REFERENCE_FIELDS), true);
});

test('remapObjectReferences remaps every known reference without mutating its source', () => {
    const source = { label: 'source' };
    const idMap = new Map();

    for (const [index, field] of EXPECTED_SINGLE_FIELDS.entries()) {
        source[field] = `old-single-${index}`;
        idMap.set(source[field], `new-single-${index}`);
    }
    for (const [index, field] of EXPECTED_ARRAY_FIELDS.entries()) {
        source[field] = [`old-array-${index}`, `external-${index}`];
        idMap.set(source[field][0], `new-array-${index}`);
    }

    const originalArrays = new Map(EXPECTED_ARRAY_FIELDS.map(field => [field, source[field]]));
    const resolved = remapObjectReferences(source, idMap);

    assert.notEqual(resolved, source);
    assert.equal(source.label, 'source');
    for (const [index, field] of EXPECTED_SINGLE_FIELDS.entries()) {
        assert.equal(resolved[field], `new-single-${index}`, field);
        assert.equal(source[field], `old-single-${index}`, field);
    }
    for (const [index, field] of EXPECTED_ARRAY_FIELDS.entries()) {
        assert.deepEqual(resolved[field], [`new-array-${index}`, `external-${index}`], field);
        assert.deepEqual(source[field], [`old-array-${index}`, `external-${index}`], field);
        assert.notEqual(resolved[field], originalArrays.get(field), field);
    }
});

test('remapObjectReferences preserves unknown, null, and non-array values', () => {
    const source = {
        circleId: 'external-circle',
        tangentPointId: null,
        vertexIds: 'not-an-array',
        dependencies: undefined
    };

    assert.deepEqual(remapObjectReferences(source, new Map()), source);
});

test('PatchApplier resolves dependency and closed-region reference arrays through the shared contract', () => {
    const applier = new PatchApplier(null, null);
    const idMap = new Map([
        ['old-point', 'new-point'],
        ['old-boundary', 'new-boundary']
    ]);

    assert.deepEqual(applier.resolveReferences({
        dependencies: ['old-point', 'old-boundary'],
        vertexIds: ['old-point'],
        boundaryObjectIds: ['old-boundary']
    }, idMap), {
        dependencies: ['new-point', 'new-boundary'],
        vertexIds: ['new-point'],
        boundaryObjectIds: ['new-boundary']
    });
});
