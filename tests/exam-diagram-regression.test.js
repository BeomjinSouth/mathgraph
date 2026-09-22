import test from 'node:test';
import assert from 'node:assert/strict';
import { AngleDimension } from '../js/objects/Dimension.js';
import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';
import { PatchApplier } from '../js/ai/PatchApplier.js';
import { enhanceDiagramQuality } from '../js/ai/DiagramQualityEnhancer.js';
import { buildExamDiagramCases } from '../scripts/exam-diagram-cases.mjs';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';
test('minor-angle label direction stays inside the angle across the atan2 boundary', () => {
    for (const degrees of [165, 175, -175, -155]) {
        const manager = new ObjectManager();
        const v = manager.createPoint(0, 0), a = manager.createPoint(4 * Math.cos(degrees * Math.PI / 180), 4 * Math.sin(degrees * Math.PI / 180));
        const b = manager.createPoint(4 * Math.cos(degrees * Math.PI / 180 + 0.65), 4 * Math.sin(degrees * Math.PI / 180 + 0.65));
        const angle = new AngleDimension(v.id, a.id, b.id);
        angle.update(manager);
        assert.ok(Math.abs(angle.angle - 0.65) < 1e-12);
        const middle = (angle.startAngle + angle.endAngle) / 2;
        const expected = { x: a.position.x + b.position.x, y: a.position.y + b.position.y };
        assert.ok(Math.cos(middle) * expected.x + Math.sin(middle) * expected.y > 0);
        assert.ok(angle.isAngleInRange(middle));
    }
});
test('GraphA creation preserves signed length curvature, including zero, through save/load', () => {
    for (const curvature of [-160, -80, 0, 80, 160]) {
        const manager = new ObjectManager();
        const result = new PatchApplier(manager, new HistoryManager(manager)).apply({ operations: [
                { op: 'create', type: 'point', id: 'A', x: 0, y: 0 }, { op: 'create', type: 'point', id: 'B', x: 5, y: 0 },
                { op: 'create', type: 'segment', id: 'AB', point1Id: 'A', point2Id: 'B' },
                { op: 'create', type: 'lengthDimension', segmentId: 'AB', curvature, customText: '3x+12', precision: 3 }
            ] });
        assert.equal(result.success, true);
        assert.equal(result.createdObjects[3].curvature, curvature);
        manager.fromJSON(JSON.parse(JSON.stringify(manager.toJSON())));
        const dim = manager.getAllObjects().find(o => o.type === 'lengthDimension');
        assert.equal(dim.curvature, curvature);
        assert.equal(dim.customText, '3x+12');
        assert.equal(dim.precision, 3);
    }
});
test('explicit zero and small point-label offsets survive enhancement', () => {
    for (const offset of [{ x: 0, y: 0 }, { x: 2, y: 1 }, { x: -1, y: 0 }]) {
        const input = { operations: [{ op: 'create', type: 'point', id: 'A', x: 0, y: 0, label: 'A', labelOffset: offset }] };
        assert.deepEqual(enhanceDiagramQuality(input).operations[0].labelOffset, offset);
    }
});
test('pyramid does not draw a second marker over a label-only apex', () => {
    const manager = new ObjectManager();
    const vertices = [[-3, -2], [3, -2], [2, 0], [-2, 0]].map(([x, y]) => manager.createPoint(x, y, { pointSize: 0 }));
    const apex = manager.createPoint(-1, 3, { pointSize: 0 });
    const pyramid = manager.createPyramid(vertices.map(p => p.id), apex.id, { showLabel: false });
    const markers = [];
    pyramid.render({ drawSegment() { }, drawPoint(p, options) { markers.push(options); }, drawLabel() { } });
    assert.deepEqual(markers, []);
    assert.equal(apex.pointSize, 0);
});
test('100 diagram sources span 25 families and construct valid non-degenerate objects', () => {
    const cases = buildExamDiagramCases();
    assert.equal(cases.length, 100);
    assert.equal(new Set(cases.map(c => c.family)).size, 25);
    assert.equal(cases.filter(c => c.split === 'holdout').length, 25);
    for (const source of cases) {
        const validation = new SchemaValidator().validate(source);
        assert.equal(validation.valid, true, source.id + ': ' + validation.errors.join(';'));
        const manager = new ObjectManager();
        const result = new PatchApplier(manager, new HistoryManager(manager)).apply(source);
        assert.equal(result.success, true, source.id + ': ' + result.errors.join(';'));
        for (const obj of manager.getAllObjects())
            assert.equal(obj.valid, true, source.id + ': ' + obj.type);
    }
});
