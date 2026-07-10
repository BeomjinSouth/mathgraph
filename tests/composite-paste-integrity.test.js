import assert from 'node:assert/strict';
import test from 'node:test';

import { ObjectManager } from '../js/core/ObjectManager.js';
import { HistoryManager } from '../js/core/HistoryManager.js';

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
globalThis.document = { addEventListener() {} };
globalThis.window = {};
const { default: GraphAApp } = await import('../js/main.js');
if (originalDocument === undefined) delete globalThis.document;
else globalThis.document = originalDocument;
if (originalWindow === undefined) delete globalThis.window;
else globalThis.window = originalWindow;

function point(manager, x, y, label) {
    return manager.createPoint(x, y, { label });
}

function appFacade(objectManager, historyManager) {
    return {
        objectManager,
        historyManager,
        clipboard: [],
        showToast() {},
        render() {},
        updateSidebar() {}
    };
}

function vectorJSON(value) {
    return { x: value.x, y: value.y };
}

function geometrySnapshot(object) {
    switch (object.type) {
        case 'polygon':
        case 'closedRegion':
            return object.vertices.map(vectorJSON);
        case 'lensRegion':
            return object.pathPoints.map(vectorJSON);
        case 'prism':
            return [...object._baseVertices, ...object._topVertices].map(vectorJSON);
        case 'tangentCircle':
            return [object.getPoint1(), object.getPoint2()].map(vectorJSON);
        default:
            throw new Error(`Unsupported scenario type: ${object.type}`);
    }
}

function referenceSnapshot(object, fields) {
    return Object.fromEntries(fields.map(field => [
        field,
        Array.isArray(object[field]) ? [...object[field]] : object[field]
    ]));
}

function referencedIds(object, fields) {
    return fields.flatMap(field => Array.isArray(object[field]) ? object[field] : [object[field]])
        .filter(Boolean);
}

const scenarios = [
    {
        name: 'polygon',
        type: 'polygon',
        fields: ['vertexIds'],
        build(manager) {
            const A = point(manager, 0, 0, 'A');
            const B = point(manager, 3, 0, 'B');
            const C = point(manager, 1, 2, 'C');
            return { composite: manager.createPolygon([A.id, B.id, C.id]), mover: A };
        }
    },
    {
        name: 'lens',
        type: 'lensRegion',
        fields: ['circle1Id', 'circle2Id'],
        build(manager) {
            const O1 = point(manager, -1, 0, 'O1');
            const R1 = point(manager, 1, 0, 'R1');
            const O2 = point(manager, 1, 0, 'O2');
            const R2 = point(manager, 3, 0, 'R2');
            const c1 = manager.createCircle(O1.id, R1.id);
            const c2 = manager.createCircle(O2.id, R2.id);
            return { composite: manager.createLensRegion(c1.id, c2.id), mover: O1 };
        }
    },
    {
        name: 'prism',
        type: 'prism',
        fields: ['baseVertexIds', 'topVertexIds'],
        build(manager) {
            const A = point(manager, 0, 0, 'A');
            const B = point(manager, 3, 0, 'B');
            const C = point(manager, 1, 2, 'C');
            const Ap = point(manager, 1, 1, "A'");
            const Bp = point(manager, 4, 1, "B'");
            const Cp = point(manager, 2, 3, "C'");
            return {
                composite: manager.createPrism([A.id, B.id, C.id], [Ap.id, Bp.id, Cp.id]),
                mover: Ap
            };
        }
    },
    {
        name: 'tangent circle',
        type: 'tangentCircle',
        fields: ['circleId', 'tangentPointId'],
        build(manager) {
            const O = point(manager, 0, 0, 'O');
            const R = point(manager, 2, 0, 'R');
            const circle = manager.createCircle(O.id, R.id);
            return { composite: manager.createTangentCircle(circle.id, R.id), mover: R };
        }
    },
    {
        name: 'closed region',
        type: 'closedRegion',
        fields: ['vertexIds', 'boundaryObjectIds'],
        build(manager) {
            const A = point(manager, 0, 0, 'A');
            const B = point(manager, 3, 0, 'B');
            const C = point(manager, 1, 2, 'C');
            const AB = manager.createSegment(A.id, B.id);
            const BC = manager.createSegment(B.id, C.id);
            const CA = manager.createSegment(C.id, A.id);
            return {
                composite: manager.createClosedRegion([A.id, B.id, C.id], [AB.id, BC.id, CA.id]),
                mover: A
            };
        }
    }
];

for (const scenario of scenarios) {
    test(`${scenario.name} paste is independent and preserves remapped references through undo/redo`, () => {
        const objectManager = new ObjectManager();
        const historyManager = new HistoryManager(objectManager);
        const app = appFacade(objectManager, historyManager);
        const { composite, mover } = scenario.build(objectManager);
        objectManager.updateAll();

        const originalIds = new Set(objectManager.getAllObjects().map(object => object.id));
        objectManager.selectObject(composite);
        GraphAApp.prototype.copySelectedObjects.call(app);
        GraphAApp.prototype.pasteObjects.call(app);

        const pastedComposite = objectManager.getObjectsByType(scenario.type)
            .find(object => !originalIds.has(object.id));
        assert.ok(pastedComposite, `missing pasted ${scenario.type}`);

        const pastedReferences = referenceSnapshot(pastedComposite, scenario.fields);
        for (const id of referencedIds(pastedComposite, scenario.fields)) {
            assert.equal(originalIds.has(id), false, `${scenario.name} retained original reference ${id}`);
            assert.ok(objectManager.getObject(id), `${scenario.name} references missing copied object ${id}`);
        }

        const copiedGeometryBefore = geometrySnapshot(pastedComposite);
        const originalGeometryBefore = geometrySnapshot(composite);
        const originalPosition = mover.getPosition();
        mover.setPosition(originalPosition.x + 4, originalPosition.y + 3);
        objectManager.updateAll();

        assert.notDeepEqual(geometrySnapshot(composite), originalGeometryBefore, 'original geometry should react');
        assert.deepEqual(geometrySnapshot(pastedComposite), copiedGeometryBefore, 'pasted geometry must stay independent');

        assert.equal(historyManager.undo(), true);
        assert.equal(objectManager.getObject(pastedComposite.id), undefined);
        assert.equal(historyManager.redo(), true);

        const restored = objectManager.getObject(pastedComposite.id);
        assert.ok(restored);
        assert.deepEqual(referenceSnapshot(restored, scenario.fields), pastedReferences);
        for (const id of referencedIds(restored, scenario.fields)) {
            assert.equal(originalIds.has(id), false, `${scenario.name} redo restored an original reference ${id}`);
            assert.ok(objectManager.getObject(id), `${scenario.name} redo lost copied dependency ${id}`);
        }
    });
}
