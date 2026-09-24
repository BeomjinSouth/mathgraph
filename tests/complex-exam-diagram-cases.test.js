import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComplexExamDiagramCases } from '../scripts/complex-exam-diagram-cases.mjs';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';

test('complex exam suite covers 15 distinct compound cases with held-out variants', () => {
    const cases = buildComplexExamDiagramCases();
    assert.equal(cases.length, 45);
    assert.equal(new Set(cases.map(c => c.family)).size, 15);
    assert.equal(cases.filter(c => c.split === 'holdout').length, 15);
    const kinds = new Set(cases.flatMap(c => c.conditions.map(condition => condition.kind)));
    for (const kind of ['angle-arc', 'equal-angle', 'equal-length', 'length-curve',
        'function-region', 'solid-edges', 'fill-probes']) assert.ok(kinds.has(kind), kind);
    for (const source of cases) {
        const validation = new SchemaValidator().validate(source);
        assert.equal(validation.valid, true, source.id + ': ' + validation.errors.join('; '));
        const manager = new ObjectManager();
        const result = new PatchApplier(manager, new HistoryManager(manager)).apply(source);
        assert.equal(result.success, true, source.id + ': ' + result.errors.join('; '));
        for (const obj of manager.getAllObjects())
            assert.equal(obj.valid, true, source.id + ': ' + obj.type);
    }
});
