import assert from 'node:assert/strict';
import test from 'node:test';

import { SceneGraphCompiler, compileSceneGraph } from '../js/ai/SceneGraphCompiler.js';
import { SchemaValidator } from '../js/ai/SchemaValidator.js';

function validateOperations(operations) {
    const payload = { operations };
    const validator = new SchemaValidator();
    const schema = validator.validate(payload);
    const references = validator.validateReferences(payload, new Set());
    assert.equal(schema.valid, true, schema.errors.join('\n'));
    assert.equal(references.valid, true, references.errors.join('\n'));
}

test('SceneGraphCompiler compiles circle sector scenes into valid GraphA operations', () => {
    const scene = {
        sceneType: 'diagram',
        nodes: [
            { id: 'O', kind: 'point', label: 'O', x: 0, y: 0 },
            { id: 'A', kind: 'point', label: 'A', x: 3, y: 0 },
            { id: 'B', kind: 'point', label: 'B', x: 0, y: 3 },
            { id: 'C', kind: 'point', label: 'C', x: -3, y: 0 },
            { id: 'circle_O', kind: 'circle', center: 'O', through: 'A' },
            { id: 'circle_B', kind: 'circle', center: 'B', through: 'C' },
            { id: 'arc_AB', kind: 'arc', circle: 'circle_O', start: 'A', end: 'B', mode: 'minor' },
            { id: 'sector_AOB', kind: 'sector', circle: 'circle_O', start: 'A', end: 'B', fillOpacity: 0.18 },
            { id: 'lens_overlap', kind: 'circleIntersectionRegion', circles: ['circle_O', 'circle_B'], fillOpacity: 0.2 }
        ],
        relations: [
            { id: 'angle_AOB', kind: 'angleDimension', vertex: 'O', point1: 'A', point2: 'B' }
        ]
    };

    const compiled = compileSceneGraph(scene);

    assert.deepEqual(
        compiled.operations.map(op => op.type),
        ['point', 'point', 'point', 'point', 'circle', 'circle', 'arc', 'sector', 'lensRegion', 'angleDimension']
    );
    assert.deepEqual(
        compiled.operations.find(op => op.id === 'lens_overlap'),
        { op: 'create', id: 'lens_overlap', type: 'lensRegion', circle1Id: 'circle_O', circle2Id: 'circle_B', fillOpacity: 0.2, showLabel: false }
    );
    assert.equal(compiled.warnings.length, 0);
    validateOperations(compiled.operations);
});

test('SceneGraphCompiler compiles graph, number line, and relation scenes', () => {
    const scene = {
        nodes: [
            { id: 'A', kind: 'point', x: -2, y: 0, label: 'A' },
            { id: 'B', kind: 'point', x: 3, y: 0, label: 'B' },
            { id: 'AB', kind: 'segment', from: 'A', to: 'B' },
            { id: 'n1', kind: 'numberLine', start: -5, end: 5, step: 1, y: -1 },
            { id: 'f', kind: 'function', equation: 'y = x^2 - 2*x - 3' }
        ],
        relations: [
            { id: 'M', kind: 'midpoint', segment: 'AB' },
            { id: 'tan_f_1', kind: 'tangentFunction', function: 'f', x: 1 },
            { id: 'len_AB', kind: 'lengthDimension', segment: 'AB' }
        ]
    };

    const compiled = new SceneGraphCompiler().compile(scene);

    assert.equal(compiled.operations.find(op => op.id === 'f').expression, 'x^2 - 2*x - 3');
    assert.ok(compiled.operations.some(op => op.type === 'numberLine'));
    assert.ok(compiled.operations.some(op => op.type === 'midpoint'));
    assert.ok(compiled.operations.some(op => op.type === 'tangentFunction'));
    validateOperations(compiled.operations);
});

test('SceneGraphCompiler creates a radius support point for circle radius scenes', () => {
    const scene = {
        nodes: [
            { id: 'O', kind: 'point', x: 1, y: 2, label: 'O' },
            { id: 'c', kind: 'circle', center: 'O', radius: 4 }
        ]
    };

    const compiled = compileSceneGraph(scene);

    assert.deepEqual(
        compiled.operations.map(op => [op.id, op.type]),
        [['O', 'point'], ['c_radius_point', 'point'], ['c', 'circle']]
    );
    assert.equal(compiled.operations[1].x, 5);
    assert.equal(compiled.operations[1].y, 2);
    validateOperations(compiled.operations);
});

test('SceneGraphCompiler compiles curved solids and text while warning on excluded charts', () => {
    const scene = {
        nodes: [
            { id: 'cyl_1', kind: 'cylinder', center: 'O', radius: 2, height: 4 },
            { id: 'label_1', kind: 'textLabel', text: 'height' },
            { id: 'hist_1', kind: 'histogram', bins: [] }
        ]
    };

    const compiled = compileSceneGraph(scene);

    assert.deepEqual(compiled.operations.map(operation => operation.type), ['cylinder', 'textLabel']);
    assert.equal(compiled.warnings.length, 1);
    validateOperations(compiled.operations);
    assert.doesNotMatch(compiled.warnings.join('\n'), /cylinder|textLabel/);
    assert.match(compiled.warnings.join('\n'), /histogram/);
});

test('SceneGraphCompiler strict patch mode updates only selected ids', () => {
    const compiler = new SceneGraphCompiler();
    const compiled = compiler.compilePatch({
        updates: [
            { id: 'point_a', x: 2, y: 3, pointSize: 10 },
            { id: 'point_b', color: '#ef4444' }
        ],
        deletes: [{ id: 'old_segment' }],
        creates: [{ id: 'new_point', kind: 'point', x: 0, y: 0 }]
    }, {
        strictSelectedEdit: true,
        selectedObjectIds: ['point_a']
    });

    assert.deepEqual(compiled.operations, [
        { op: 'update', id: 'point_a', x: 2, y: 3, pointSize: 10 }
    ]);
    assert.match(compiled.warnings.join('\n'), /unselected id "point_b"/);
    assert.match(compiled.warnings.join('\n'), /unselected id "old_segment"/);
    assert.match(compiled.warnings.join('\n'), /Patch creates were skipped/);
});

test('SceneGraphCompiler hides auto-assigned names for unlabeled created objects', () => {
    const scene = {
        nodes: [
            { id: 'O', kind: 'point', x: 0, y: 0, label: 'O' },
            { id: 'circMain', kind: 'circle', center: 'O', radius: 2.5 },
            { id: 'named', kind: 'circle', center: 'O', radius: 4, label: 'C' },
            { id: 'graphF', kind: 'function', equation: 'y = x^2' }
        ]
    };

    const compiled = compileSceneGraph(scene);
    const byId = new Map(compiled.operations.map(operation => [operation.id, operation]));

    assert.equal(byId.get('circMain').showLabel, false);
    assert.equal(byId.get('named').showLabel, true);
    assert.equal(byId.get('graphF').showLabel, false);
    assert.equal(byId.get('O').showLabel, true);
    validateOperations(compiled.operations);
});
