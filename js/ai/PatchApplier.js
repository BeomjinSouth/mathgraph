/**
 * PatchApplier.js - AI patch application helper (Mk.2)
 */

export class PatchResult {
    constructor(success, message = '', createdObjects = []) {
        this.success = success;
        this.message = message;
        this.createdObjects = createdObjects;
        this.errors = [];
    }

    static success(message, createdObjects = []) {
        return new PatchResult(true, message, createdObjects);
    }

    static failure(message, errors = []) {
        const result = new PatchResult(false, message);
        result.errors = errors;
        return result;
    }
}

export class PatchApplier {
    constructor(objectManager, historyManager) {
        this.objectManager = objectManager;
        this.historyManager = historyManager;
    }

    apply(data) {
        const operations = data.operations || (Array.isArray(data) ? data : [data]);
        const createdObjects = [];
        const idMap = new Map();
        const rollbackSnapshot = this.createRollbackSnapshot();

        try {
            for (const op of operations) {
                const result = this.applyOperation(op, idMap);
                if (result.object) {
                    createdObjects.push(result.object);
                }
            }

            this.objectManager.updateAll();

            return PatchResult.success(
                `${createdObjects.length} objects created`,
                createdObjects
            );
        } catch (error) {
            this.restoreRollbackSnapshot(rollbackSnapshot);
            return PatchResult.failure(`Patch application failed: ${error.message}`, [error.message]);
        }
    }

    applyOperation(op, idMap) {
        switch (op.op) {
            case 'create':
                return this.createObject(op, idMap);
            case 'update':
                return this.updateObject(op, idMap);
            case 'delete':
                return this.deleteObject(op, idMap);
            default:
                throw new Error(`Unsupported operation: ${op.op}`);
        }
    }

    createObject(op, idMap) {
        const resolvedOp = this.resolveReferences(op, idMap);

        let object;
        switch (op.type) {
            case 'point':
                object = this.objectManager.createPoint(
                    resolvedOp.x,
                    resolvedOp.y,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'segment':
                object = this.objectManager.createSegment(
                    resolvedOp.point1Id,
                    resolvedOp.point2Id,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'line':
                object = this.objectManager.createLine(
                    resolvedOp.point1Id,
                    resolvedOp.point2Id,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'ray':
                object = this.objectManager.createRay(
                    resolvedOp.originId,
                    resolvedOp.directionPointId,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'circle':
                object = this.objectManager.createCircle(
                    resolvedOp.centerId,
                    resolvedOp.pointOnCircleId,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'circleThreePoints':
                object = this.objectManager.createCircleThreePoints(
                    resolvedOp.point1Id,
                    resolvedOp.point2Id,
                    resolvedOp.point3Id,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'intersection':
                object = this.objectManager.createIntersection(
                    resolvedOp.object1Id,
                    resolvedOp.object2Id,
                    null,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'midpoint':
                object = this.objectManager.createMidpoint(
                    resolvedOp.segmentId,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'parallel':
                object = this.objectManager.createParallelLine(
                    resolvedOp.baseLineId,
                    resolvedOp.throughPointId,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'perpendicular':
                object = this.objectManager.createPerpendicularLine(
                    resolvedOp.throughPointId,
                    resolvedOp.baseLineId,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'perpendicularBisector':
                object = this.objectManager.createPerpendicularBisector(
                    resolvedOp.segmentId,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'angleBisector':
                object = this.objectManager.createAngleBisector(
                    resolvedOp.line1Id,
                    resolvedOp.line2Id,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'tangentCircle':
                object = this.objectManager.createTangentCircle(
                    resolvedOp.circleId,
                    resolvedOp.tangentPointId,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'tangentFunction':
                object = this.objectManager.createTangentFunction(
                    resolvedOp.functionId,
                    resolvedOp.x || 0,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'function':
                object = this.objectManager.createFunction(
                    resolvedOp.expression,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'vector':
                object = this.objectManager.createVector(
                    resolvedOp.startPointId,
                    resolvedOp.endPointId,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'arc':
                object = this.objectManager.createArc(
                    resolvedOp.circleId,
                    resolvedOp.startPointId,
                    resolvedOp.endPointId,
                    resolvedOp.mode || 'minor',
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'sector':
                object = this.objectManager.createSector(
                    resolvedOp.circleId,
                    resolvedOp.startPointId,
                    resolvedOp.endPointId,
                    resolvedOp.mode || 'minor',
                    {
                        label: resolvedOp.label,
                        color: resolvedOp.color,
                        fillColor: resolvedOp.fillColor,
                        fillOpacity: resolvedOp.fillOpacity
                    }
                );
                break;

            case 'circularSegment':
                object = this.objectManager.createCircularSegment(
                    resolvedOp.circleId,
                    resolvedOp.startPointId,
                    resolvedOp.endPointId,
                    resolvedOp.mode || 'minor',
                    {
                        label: resolvedOp.label,
                        color: resolvedOp.color,
                        fillColor: resolvedOp.fillColor,
                        fillOpacity: resolvedOp.fillOpacity
                    }
                );
                break;

            case 'prism':
                object = this.objectManager.createPrism(
                    resolvedOp.baseVertexIds,
                    resolvedOp.topVertexIds,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            case 'pyramid':
                object = this.objectManager.createPyramid(
                    resolvedOp.baseVertexIds,
                    resolvedOp.apexId,
                    { label: resolvedOp.label, color: resolvedOp.color }
                );
                break;

            default:
                throw new Error(`Unsupported object type: ${op.type}`);
        }

        if (object && op.id) {
            idMap.set(op.id, object.id);
        }

        if (object) {
            this.historyManager.recordCreate(object);
        }

        return { object };
    }

    updateObject(op, idMap) {
        const id = idMap.get(op.id) || op.id;
        const object = this.objectManager.getObject(id);

        if (!object) {
            throw new Error(`Object not found: ${op.id}`);
        }

        if (op.x !== undefined && object.position) {
            object.position.x = op.x;
        }
        if (op.y !== undefined && object.position) {
            object.position.y = op.y;
        }
        if (op.color !== undefined) {
            object.color = op.color;
        }
        if (op.label !== undefined) {
            object.label = op.label;
        }
        if (op.visible !== undefined) {
            object.visible = op.visible;
        }

        this.objectManager.updateObject(id);

        return { object };
    }

    deleteObject(op, idMap) {
        const id = idMap.get(op.id) || op.id;
        const object = this.objectManager.getObject(id);

        if (object) {
            const dependents = this.objectManager.getDependents(id).filter(Boolean);
            this.historyManager.recordDelete([object, ...dependents]);
            this.objectManager.removeObject(id);
        }

        return { object: null };
    }

    resolveReferences(op, idMap) {
        const resolved = { ...op };

        const refFields = [
            'point1Id', 'point2Id', 'point3Id', 'centerId', 'pointOnCircleId',
            'originId', 'directionPointId', 'lineId', 'circleId', 'segmentId',
            'object1Id', 'object2Id', 'baseLineId', 'throughPointId',
            'startPointId', 'endPointId', 'functionId', 'vertexId',
            'line1Id', 'line2Id', 'segment1Id', 'segment2Id',
            'tangentPointId', 'apexId'
        ];

        for (const field of refFields) {
            if (resolved[field] && idMap.has(resolved[field])) {
                resolved[field] = idMap.get(resolved[field]);
            }
        }

        if (resolved.baseVertexIds && Array.isArray(resolved.baseVertexIds)) {
            resolved.baseVertexIds = resolved.baseVertexIds.map(id => idMap.get(id) || id);
        }

        if (resolved.topVertexIds && Array.isArray(resolved.topVertexIds)) {
            resolved.topVertexIds = resolved.topVertexIds.map(id => idMap.get(id) || id);
        }

        return resolved;
    }

    createRollbackSnapshot() {
        const historyState = this.historyManager?.createSnapshot
            ? this.historyManager.createSnapshot()
            : this.cloneValue({
                undoStack: this.historyManager?.undoStack ?? [],
                redoStack: this.historyManager?.redoStack ?? [],
                pendingAction: this.historyManager?.pendingAction ?? null
            });

        return {
            objectState: this.objectManager.toJSON(),
            historyState,
            selectionState: this.captureSelectionState()
        };
    }

    restoreRollbackSnapshot(snapshot) {
        if (!snapshot) return;

        this.objectManager.fromJSON(snapshot.objectState);

        if (snapshot.historyState) {
            if (this.historyManager?.restoreSnapshot) {
                this.historyManager.restoreSnapshot(snapshot.historyState);
            } else if (this.historyManager) {
                this.historyManager.undoStack = this.cloneValue(snapshot.historyState.undoStack ?? []);
                this.historyManager.redoStack = this.cloneValue(snapshot.historyState.redoStack ?? []);
                this.historyManager.pendingAction = this.cloneValue(snapshot.historyState.pendingAction ?? null);
            }
        }

        this.restoreSelectionState(snapshot.selectionState);
    }

    captureSelectionState() {
        return {
            selectedIds: Array.from(this.objectManager.selectedObjects || []),
            highlightedId: this.objectManager.highlightedObject?.id || null
        };
    }

    restoreSelectionState(selectionState) {
        if (!selectionState) return;

        const selectedIds = Array.isArray(selectionState.selectedIds) ? selectionState.selectedIds : [];
        const highlightedId = selectionState.highlightedId || null;

        this.objectManager.clearSelection();
        selectedIds.forEach((id, index) => {
            const obj = this.objectManager.getObject(id);
            if (obj) {
                this.objectManager.selectObject(obj, index !== 0);
            }
        });

        if (highlightedId) {
            const highlightedObject = this.objectManager.getObject(highlightedId);
            if (highlightedObject) {
                this.objectManager.highlightObject(highlightedObject);
            } else {
                this.objectManager.clearHighlight();
            }
        } else {
            this.objectManager.clearHighlight();
        }
    }

    cloneValue(value) {
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
    }
}

export default PatchApplier;
