/**
 * FillTool.js - vector paint-bucket fill for closed MathGraph objects.
 */

import { Tool } from './Tool.js';
import { ObjectType } from '../objects/GeoObject.js';

const FILLABLE_TYPES = new Set([
    ObjectType.CIRCLE,
    ObjectType.CIRCLE_THREE_POINTS,
    ObjectType.SECTOR,
    ObjectType.CIRCULAR_SEGMENT,
    ObjectType.LENS_REGION,
    ObjectType.POLYGON
]);

export class FillTool extends Tool {
    constructor() {
        super('fill');
    }

    activate(app) {
        super.activate(app);
        app.showToast?.('채울 닫힌 도형을 클릭하세요.', 'info');
    }

    deactivate(app) {
        app.objectManager.clearHighlight();
        super.deactivate(app);
        app.render?.();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        const target = this.findFillTargetAt(mathPos, app);
        if (!target) {
            app.showToast?.('이 위치에서 채울 수 있는 도형을 찾지 못했습니다.', 'warning');
            return;
        }

        const fillColor = app.currentFillColor || '#000000';
        const fillOpacity = Number.isFinite(app.currentFillOpacity) ? app.currentFillOpacity : 0.24;
        const actions = [];

        if (target.fillColor !== fillColor) {
            actions.push({
                type: 'propertyChange',
                objectId: target.id,
                property: 'fillColor',
                oldValue: target.fillColor,
                newValue: fillColor
            });
            target.fillColor = fillColor;
        }

        if (target.fillOpacity !== fillOpacity) {
            actions.push({
                type: 'propertyChange',
                objectId: target.id,
                property: 'fillOpacity',
                oldValue: target.fillOpacity,
                newValue: fillOpacity
            });
            target.fillOpacity = fillOpacity;
        }

        if (actions.length > 0) {
            if (typeof app.historyManager.recordBatch === 'function') {
                app.historyManager.recordBatch(actions);
            } else {
                for (const action of actions) {
                    app.historyManager.recordPropertyChange(
                        action.objectId,
                        action.property,
                        action.oldValue,
                        action.newValue
                    );
                }
            }
        }

        app.objectManager.updateObject(target.id);
        app.objectManager.highlightObject(target);
        app.showToast?.('채우기를 적용했습니다.', 'success');
        app.render();
        app.toolManager.returnToSelect();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        app.objectManager.highlightObject(this.findFillTargetAt(mathPos, app));
        app.render();
    }

    findFillTargetAt(mathPos, app) {
        const objects = [...app.objectManager.getAllObjects()].reverse();

        for (const object of objects) {
            if (!object.visible || !object.valid || !FILLABLE_TYPES.has(object.type)) {
                continue;
            }

            if (isCircleType(object.type)) {
                if (pointInsideCircle(mathPos, object, app.canvas)) {
                    return object;
                }
                continue;
            }

            if (object.hitTest(mathPos, 8, app.canvas)) {
                return object;
            }
        }

        return null;
    }

    getCursor() {
        return 'cell';
    }
}

function isCircleType(type) {
    return type === ObjectType.CIRCLE || type === ObjectType.CIRCLE_THREE_POINTS;
}

function pointInsideCircle(point, circle, canvas) {
    if (typeof circle.getCenter !== 'function' || typeof circle.getRadius !== 'function') {
        return false;
    }

    const tolerance = canvas?.toMathLength ? canvas.toMathLength(8) : 0;
    return point.distanceTo(circle.getCenter()) <= circle.getRadius() + tolerance;
}

export default FillTool;
