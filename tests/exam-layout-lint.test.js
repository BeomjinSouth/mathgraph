import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeExamDiagramProject } from '../.agents/skills/mathgraph-drawing/scripts/check-exam-diagram-layout.mjs';
import { enhanceDiagramQuality } from '../js/ai/DiagramQualityEnhancer.js';

function project(objects) {
    return { format: 'mathgraph-project', view: { scale: 42 }, objects };
}

test('exam layout lint catches a far label used to compensate for nearly coincident named points', () => {
    const result = analyzeExamDiagramProject(project([
        { id: 'D', type: 'point', label: 'D', x: 2, y: 0, visible: true, showLabel: true, pointSize: 0, fontSize: 27, labelOffset: { x: -93, y: -45 } },
        { id: 'P', type: 'point', label: 'P', x: 2.22, y: -0.11, visible: true, showLabel: true, pointSize: 0, fontSize: 27, labelOffset: { x: 12, y: 20 } }
    ]));

    assert.ok(result.issues.some(issue => issue.code === 'label-offset-too-far'));
    assert.ok(result.issues.some(issue => issue.code === 'named-points-too-close'));
});

test('exam layout lint accepts separated points with baseline-aware offsets', () => {
    const result = analyzeExamDiagramProject(project([
        { id: 'D', type: 'point', label: 'D', x: 0, y: 1, visible: true, showLabel: true, pointSize: 0, fontSize: 27, labelOffset: { x: -9, y: -3 } },
        { id: 'P', type: 'point', label: 'P', x: 2.22, y: -0.11, visible: true, showLabel: true, pointSize: 0, fontSize: 27, labelOffset: { x: 12, y: 20 } }
    ]));

    assert.equal(result.issues.some(issue => issue.code === 'label-offset-too-far'), false);
    assert.equal(result.issues.some(issue => issue.code === 'named-points-too-close'), false);
    assert.equal(result.issues.some(issue => issue.code === 'top-label-baseline-too-high'), false);
});

test('exam layout lint flags baseline misuse and missing length curvature', () => {
    const result = analyzeExamDiagramProject(project([
        { id: 'C', type: 'point', label: 'C', x: 0, y: 2, visible: true, showLabel: true, pointSize: 0, fontSize: 27, labelOffset: { x: -8, y: -24 } },
        { id: 'len', type: 'lengthDimension', lineWidth: 1 }
    ]));

    assert.ok(result.issues.some(issue => issue.code === 'top-label-baseline-too-high'));
    assert.ok(result.issues.some(issue => issue.code === 'length-curvature-missing'));
    assert.ok(result.issues.some(issue => issue.code === 'length-stroke-too-thin'));
});

test('quality enhancer assigns point labels with bottom-baseline-aware vertical offsets', () => {
    const result = enhanceDiagramQuality({ operations: [
        { op: 'create', id: 'A', type: 'point', x: -3, y: -2, label: 'A', fontSize: 27 },
        { op: 'create', id: 'B', type: 'point', x: 3, y: -2, label: 'B', fontSize: 27 },
        { op: 'create', id: 'C', type: 'point', x: 3, y: 2, label: 'C', fontSize: 27 },
        { op: 'create', id: 'D', type: 'point', x: -3, y: 2, label: 'D', fontSize: 27 }
    ] });
    const byId = new Map(result.operations.map(operation => [operation.id, operation]));

    assert.ok(byId.get('A').labelOffset.y >= 30);
    assert.ok(byId.get('B').labelOffset.y >= 30);
    assert.ok(byId.get('C').labelOffset.y >= -4 && byId.get('C').labelOffset.y <= 7);
    assert.ok(byId.get('D').labelOffset.y >= -4 && byId.get('D').labelOffset.y <= 7);
});

test('quality enhancer preserves an explicit teacher label offset', () => {
    const result = enhanceDiagramQuality({ operations: [
        { op: 'create', id: 'A', type: 'point', x: 0, y: 0, label: 'A', fontSize: 27, labelOffset: { x: -25, y: 2 } }
    ] });

    assert.deepEqual(result.operations[0].labelOffset, { x: -25, y: 2 });
});

test('exam lint preserves explicitly justified domain endpoint markers, not arbitrary dots', () => {
    const input = project([
        { id: 'A', type: 'point', label: 'A', x: 0, y: 0, pointSize: 6, pointStyle: 'open', labelOffset: { x: 12, y: 2 } },
        { id: 'B', type: 'point', label: 'B', x: 3, y: 0, pointSize: 6, pointStyle: 'closed', labelOffset: { x: 12, y: 2 } }
    ]);
    assert.equal(analyzeExamDiagramProject(input).errorCount, 2);
    const result = analyzeExamDiagramProject(input, { pointMarkerReasons: { A: '정의역에서 제외하는 끝점' } });
    assert.equal(result.errorCount, 1);
    assert.deepEqual(result.issues.find(issue => issue.severity === 'error').objectIds, ['B']);
});
