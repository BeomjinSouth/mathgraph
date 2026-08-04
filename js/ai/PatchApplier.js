/**
 * PatchApplier.js - AI patch application helper (Mk.2)
 */

import { remapObjectReferences } from '../utils/ObjectReferences.js';

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
        const stats = { created: 0, updated: 0, deleted: 0 };

        // 패치 전체를 하나의 undo 단위로 묶습니다. (실제 HistoryManager만 지원, mock은 무시)
        this.historyManager?.beginTransaction?.();

        try {
            for (const op of operations) {
                const result = this.applyOperation(op, idMap, stats);
                if (result.kind === 'create' && result.object) {
                    createdObjects.push(result.object);
                }
            }

            this.objectManager.updateAll();
            this.historyManager?.commitTransaction?.();

            return PatchResult.success(
                this.formatSummary(stats),
                createdObjects
            );
        } catch (error) {
            this.historyManager?.abortTransaction?.();
            this.restoreRollbackSnapshot(rollbackSnapshot);
            return PatchResult.failure(`Patch application failed: ${error.message}`, [error.message]);
        }
    }

    applyOperation(op, idMap, stats) {
        switch (op.op) {
            case 'create':
                return this.createObject(op, idMap, stats);
            case 'update':
                return this.updateObject(op, idMap, stats);
            case 'delete':
                return this.deleteObject(op, idMap, stats);
            default:
                throw new Error(`Unsupported operation: ${op.op}`);
        }
    }

    createObject(op, idMap, stats) {
        const resolvedOp = this.resolveReferences(op, idMap);
        const commonParams = this.buildCommonParams(resolvedOp);

        let object;
        switch (op.type) {
            case 'point':
                object = this.objectManager.createPoint(
                    resolvedOp.x,
                    resolvedOp.y,
                    commonParams
                );
                break;

            case 'pointOnLine':
                object = this.objectManager.createPointOnLine(
                    resolvedOp.lineId,
                    resolvedOp.t ?? 0.5,
                    commonParams
                );
                break;

            case 'pointOnCircle':
                object = this.objectManager.createPointOnCircle(
                    resolvedOp.circleId,
                    resolvedOp.angle ?? 0,
                    commonParams
                );
                break;

            case 'circleCenterPoint':
                object = this.objectManager.createCircleCenterPoint(
                    resolvedOp.circleId,
                    commonParams
                );
                break;

            case 'segment':
                object = this.objectManager.createSegment(
                    resolvedOp.point1Id,
                    resolvedOp.point2Id,
                    commonParams
                );
                break;

            case 'line':
                object = this.objectManager.createLine(
                    resolvedOp.point1Id,
                    resolvedOp.point2Id,
                    commonParams
                );
                break;

            case 'ray':
                object = this.objectManager.createRay(
                    resolvedOp.originId,
                    resolvedOp.directionPointId,
                    commonParams
                );
                break;

            case 'circle':
                object = this.objectManager.createCircle(
                    resolvedOp.centerId,
                    resolvedOp.pointOnCircleId,
                    commonParams
                );
                break;

            case 'circleThreePoints':
                object = this.objectManager.createCircleThreePoints(
                    resolvedOp.point1Id,
                    resolvedOp.point2Id,
                    resolvedOp.point3Id,
                    commonParams
                );
                break;

            case 'ellipse':
                object = this.objectManager.createEllipse(
                    resolvedOp.radiusX,
                    resolvedOp.radiusY,
                    {
                        ...commonParams,
                        x: resolvedOp.x,
                        y: resolvedOp.y,
                        rotation: resolvedOp.rotation ?? 0
                    }
                );
                break;

            case 'hyperbola':
                object = this.objectManager.createHyperbola(
                    resolvedOp.a,
                    resolvedOp.b,
                    {
                        ...commonParams,
                        x: resolvedOp.x,
                        y: resolvedOp.y,
                        orientation: resolvedOp.orientation,
                        rotation: resolvedOp.rotation ?? 0
                    }
                );
                break;

            case 'parabola':
                object = this.objectManager.createParabola(resolvedOp.p, {
                    ...commonParams,
                    x: resolvedOp.x,
                    y: resolvedOp.y,
                    orientation: resolvedOp.orientation,
                    rotation: resolvedOp.rotation ?? 0
                });
                break;

            case 'intersection':
                object = this.objectManager.createIntersection(
                    resolvedOp.object1Id,
                    resolvedOp.object2Id,
                    null,
                    {
                        ...commonParams,
                        ...(resolvedOp.branch !== undefined ? { branch: resolvedOp.branch } : {})
                    }
                );
                break;

            case 'midpoint':
                object = this.objectManager.createMidpoint(
                    resolvedOp.segmentId,
                    commonParams
                );
                break;

            case 'parallel':
                object = this.objectManager.createParallelLine(
                    resolvedOp.baseLineId,
                    resolvedOp.throughPointId,
                    commonParams
                );
                break;

            case 'perpendicular':
                object = this.objectManager.createPerpendicularLine(
                    resolvedOp.throughPointId,
                    resolvedOp.baseLineId,
                    commonParams
                );
                break;

            case 'perpendicularBisector':
                object = this.objectManager.createPerpendicularBisector(
                    resolvedOp.segmentId,
                    commonParams
                );
                break;

            case 'angleBisector':
                object = this.objectManager.createAngleBisector(
                    resolvedOp.line1Id,
                    resolvedOp.line2Id,
                    commonParams
                );
                break;

            case 'tangentCircle':
                object = this.objectManager.createTangentCircle(
                    resolvedOp.circleId,
                    resolvedOp.tangentPointId,
                    commonParams
                );
                break;

            case 'tangentFunction':
                object = this.objectManager.createTangentFunction(
                    resolvedOp.functionId,
                    resolvedOp.x || 0,
                    commonParams
                );
                break;

            case 'function':
                object = this.objectManager.createFunction(
                    resolvedOp.expression,
                    commonParams
                );
                break;

            case 'vector':
                object = this.objectManager.createVector(
                    resolvedOp.startPointId,
                    resolvedOp.endPointId,
                    commonParams
                );
                break;

            case 'rightAngleMarker':
                object = this.objectManager.createRightAngleMarker(
                    resolvedOp.vertexId,
                    resolvedOp.line1Id,
                    resolvedOp.line2Id,
                    commonParams
                );
                break;

            case 'equalLengthMarker':
                object = this.objectManager.createEqualLengthMarker(
                    resolvedOp.segment1Id,
                    resolvedOp.segment2Id,
                    commonParams
                );
                break;

            case 'angleDimension':
                object = this.objectManager.createAngleDimension(
                    resolvedOp.vertexId,
                    resolvedOp.point1Id,
                    resolvedOp.point2Id,
                    commonParams
                );
                break;

            case 'lengthDimension':
                object = this.objectManager.createLengthDimension(
                    resolvedOp.segmentId,
                    commonParams
                );
                break;

            case 'arc':
                object = this.objectManager.createArc(
                    resolvedOp.circleId,
                    resolvedOp.startPointId,
                    resolvedOp.endPointId,
                    resolvedOp.mode || 'minor',
                    commonParams
                );
                break;

            case 'sector':
                object = this.objectManager.createSector(
                    resolvedOp.circleId,
                    resolvedOp.startPointId,
                    resolvedOp.endPointId,
                    resolvedOp.mode || 'minor',
                    commonParams
                );
                break;

            case 'circularSegment':
                object = this.objectManager.createCircularSegment(
                    resolvedOp.circleId,
                    resolvedOp.startPointId,
                    resolvedOp.endPointId,
                    resolvedOp.mode || 'minor',
                    commonParams
                );
                break;

            case 'lensRegion':
                object = this.objectManager.createLensRegion(
                    resolvedOp.circle1Id,
                    resolvedOp.circle2Id,
                    commonParams
                );
                break;

            case 'polygon':
                object = this.objectManager.createPolygon(
                    resolvedOp.vertexIds,
                    commonParams
                );
                break;

            case 'prism':
                object = this.objectManager.createPrism(
                    resolvedOp.baseVertexIds,
                    resolvedOp.topVertexIds,
                    commonParams
                );
                break;

            case 'pyramid':
                object = this.objectManager.createPyramid(
                    resolvedOp.baseVertexIds,
                    resolvedOp.apexId,
                    commonParams
                );
                break;

            case 'numberLine':
                object = this.objectManager.createNumberLine({
                    ...commonParams,
                    ...(resolvedOp.start !== undefined ? { start: resolvedOp.start } : {}),
                    ...(resolvedOp.end !== undefined ? { end: resolvedOp.end } : {}),
                    ...(resolvedOp.step !== undefined ? { step: resolvedOp.step } : {}),
                    ...(resolvedOp.y !== undefined ? { y: resolvedOp.y } : {}),
                    ...(resolvedOp.showArrows !== undefined ? { showArrows: resolvedOp.showArrows } : {}),
                    ...(resolvedOp.tickHeight !== undefined ? { tickHeight: resolvedOp.tickHeight } : {}),
                    ...(resolvedOp.customMarks !== undefined ? { customMarks: resolvedOp.customMarks } : {})
                });
                break;

            case 'textLabel':
                object = this.objectManager.createTextLabel(
                    resolvedOp.text,
                    resolvedOp.x,
                    resolvedOp.y,
                    {
                        ...commonParams,
                        ...(resolvedOp.align !== undefined ? { align: resolvedOp.align } : {}),
                        ...(resolvedOp.backgroundColor !== undefined ? { backgroundColor: resolvedOp.backgroundColor } : {})
                    }
                );
                break;

            case 'cylinder':
            case 'cone':
            case 'sphere':
                object = this.objectManager.createCurvedSolid(op.type, {
                    ...commonParams,
                    x: resolvedOp.x,
                    y: resolvedOp.y,
                    width: resolvedOp.width,
                    height: resolvedOp.height,
                    ...(resolvedOp.ellipseRatio !== undefined ? { ellipseRatio: resolvedOp.ellipseRatio } : {}),
                    ...(resolvedOp.showHiddenLines !== undefined ? { showHiddenLines: resolvedOp.showHiddenLines } : {})
                });
                break;

            default:
                throw new Error(`Unsupported object type: ${op.type}`);
        }

        if (object && op.id) {
            idMap.set(op.id, object.id);
        }

        if (object) {
            this.historyManager.recordCreate(object);
            stats.created += 1;
        }

        return { kind: 'create', object };
    }

    updateObject(op, idMap, stats) {
        const id = idMap.get(op.id) || op.id;
        const object = this.objectManager.getObject(id);

        if (!object) {
            throw new Error(`Object not found: ${op.id}`);
        }

        if (op.x !== undefined && object.position) {
            this.recordPropertyChange(object, 'position.x', object.position.x, op.x);
            object.position.x = op.x;
        }
        if (op.y !== undefined && object.position) {
            this.recordPropertyChange(object, 'position.y', object.position.y, op.y);
            object.position.y = op.y;
        }

        this.applyPropertyUpdate(object, 'color', op.color);
        this.applyPropertyUpdate(object, 'label', op.label);
        this.applyPropertyUpdate(object, 'visible', op.visible);
        this.applyPropertyUpdate(object, 'lineWidth', op.lineWidth);
        this.applyPropertyUpdate(object, 'pointSize', op.pointSize);
        this.applyPropertyUpdate(object, 'fontSize', op.fontSize);
        this.applyPropertyUpdate(object, 'dashed', op.dashed);
        this.applyPropertyUpdate(object, 'fillColor', op.fillColor);
        this.applyPropertyUpdate(object, 'fillOpacity', op.fillOpacity);
        this.applyPropertyUpdate(object, 'showLabel', op.showLabel);
        this.applyPropertyUpdate(object, 'expression', op.expression);
        this.applyPropertyUpdate(object, 'mode', op.mode);
        this.applyPropertyUpdate(object, 'locked', op.locked);
        this.applyPropertyUpdate(object, 't', op.t);
        this.applyPropertyUpdate(object, 'angle', op.angle);
        this.applyPropertyUpdate(object, 'start', op.start);
        this.applyPropertyUpdate(object, 'end', op.end);
        this.applyPropertyUpdate(object, 'step', op.step);
        this.applyPropertyUpdate(object, 'y', op.y);
        this.applyPropertyUpdate(object, 'showArrows', op.showArrows);
        this.applyPropertyUpdate(object, 'tickHeight', op.tickHeight);
        this.applyPropertyUpdate(object, 'text', op.text);
        this.applyPropertyUpdate(object, 'align', op.align);
        this.applyPropertyUpdate(object, 'backgroundColor', op.backgroundColor);
        this.applyPropertyUpdate(object, 'width', op.width);
        this.applyPropertyUpdate(object, 'height', op.height);
        this.applyPropertyUpdate(object, 'ellipseRatio', op.ellipseRatio);
        this.applyPropertyUpdate(object, 'showHiddenLines', op.showHiddenLines);
        this.applyPropertyUpdate(object, 'xMin', op.xMin);
        this.applyPropertyUpdate(object, 'xMax', op.xMax);
        this.applyPropertyUpdate(object, 'yMin', op.yMin);
        this.applyPropertyUpdate(object, 'yMax', op.yMax);
        this.applyPropertyUpdate(object, 'branch', op.branch);
        this.applyPropertyUpdate(object, 'radiusX', op.radiusX);
        this.applyPropertyUpdate(object, 'radiusY', op.radiusY);
        this.applyPropertyUpdate(object, 'a', op.a);
        this.applyPropertyUpdate(object, 'b', op.b);
        this.applyPropertyUpdate(object, 'p', op.p);
        this.applyPropertyUpdate(object, 'orientation', op.orientation);
        this.applyPropertyUpdate(object, 'rotation', op.rotation);

        if (op.labelOffset !== undefined && 'labelOffset' in object) {
            this.recordPropertyChange(object, 'labelOffset', object.labelOffset, op.labelOffset);
            object.labelOffset = this.cloneValue(op.labelOffset);
        }

        if (op.customMarks !== undefined && 'customMarks' in object) {
            this.recordPropertyChange(object, 'customMarks', object.customMarks, op.customMarks);
            object.customMarks = this.cloneValue(op.customMarks);
        }

        this.objectManager.updateObject(id);
        stats.updated += 1;

        return { kind: 'update', object };
    }

    deleteObject(op, idMap, stats) {
        const id = idMap.get(op.id) || op.id;
        const object = this.objectManager.getObject(id);

        if (!object) {
            throw new Error(`Object not found: ${op.id}`);
        }

        const dependents = this.objectManager.getDependents(id).filter(Boolean);
        this.historyManager.recordDelete([object, ...dependents]);
        this.objectManager.removeObject(id);
        stats.deleted += 1;

        return { kind: 'delete', object: null };
    }

    resolveReferences(op, idMap) {
        return remapObjectReferences(op, idMap);
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

    buildCommonParams(op) {
        const params = {};
        const supportedFields = [
            'label',
            'color',
            'visible',
            'lineWidth',
            'pointSize',
            'fontSize',
            'arcRadius',
            'showValue',
            'markerCount',
            'customText',
            'labelFontSize',
            'dashed',
            'fillColor',
            'fillOpacity',
            'showLabel',
            'locked',
            'xMin',
            'xMax',
            'yMin',
            'yMax'
        ];

        for (const field of supportedFields) {
            if (op[field] !== undefined) {
                params[field] = op[field];
            }
        }

        if (op.labelOffset && typeof op.labelOffset === 'object') {
            params.labelOffset = this.cloneValue(op.labelOffset);
        }

        return params;
    }

    applyPropertyUpdate(object, property, newValue) {
        if (newValue === undefined || !(property in object)) {
            return;
        }

        this.recordPropertyChange(object, property, object[property], newValue);
        object[property] = newValue;
    }

    recordPropertyChange(object, property, oldValue, newValue) {
        if (oldValue === newValue) {
            return;
        }

        if (typeof this.historyManager?.recordPropertyChange === 'function') {
            this.historyManager.recordPropertyChange(
                object.id,
                property,
                this.cloneValue(oldValue),
                this.cloneValue(newValue)
            );
        }
    }

    formatSummary(stats) {
        const parts = [];
        if (stats.created) parts.push(`${stats.created} created`);
        if (stats.updated) parts.push(`${stats.updated} updated`);
        if (stats.deleted) parts.push(`${stats.deleted} deleted`);
        return parts.length > 0 ? parts.join(', ') : 'No changes applied';
    }
}

export default PatchApplier;
