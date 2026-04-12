/**
 * Vector.js - 벡터 객체
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2, Geometry } from '../utils/Geometry.js';

/**
 * 벡터 (Vector)
 */
export class Vector extends GeoObject {
    constructor(startPointId, endPointId, params = {}) {
        super(ObjectType.VECTOR, params);
        this.startPointId = startPointId;
        this.endPointId = endPointId;
        this.addDependency(startPointId);
        this.addDependency(endPointId);

        this._start = new Vec2(0, 0);
        this._end = new Vec2(0, 0);
    }

    update(objectManager) {
        const startObj = objectManager.getObject(this.startPointId);
        const endObj = objectManager.getObject(this.endPointId);

        if (!startObj || !endObj || !startObj.valid || !endObj.valid) {
            this.valid = false;
            return;
        }

        this._start = startObj.getPosition();
        this._end = endObj.getPosition();
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawVector(this._start, this._end, {
            color: this.color,
            width: this.lineWidth,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            const mid = Geometry.midpoint(this._start, this._end);
            canvas.drawLabel(mid, this.label, {
                fontSize: this.fontSize,
                color: this.color,
                offsetX: 10,
                offsetY: -10
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);
        const dist = Geometry.pointToSegmentDistance(point, this._start, this._end);
        return dist <= screenThreshold;
    }

    startDrag(point, canvas, objectManager) {
        this._dragStart = point.clone();
        this._dragStartStart = this._start.clone();
        this._dragEndStart = this._end.clone();
    }

    drag(point, delta, canvas, objectManager) {
        const startObj = objectManager.getObject(this.startPointId);
        const endObj = objectManager.getObject(this.endPointId);

        const offset = point.sub(this._dragStart);

        if (startObj && !startObj.locked && startObj.setPosition) {
            startObj.setPosition(this._dragStartStart.x + offset.x, this._dragStartStart.y + offset.y);
        }
        if (endObj && !endObj.locked && endObj.setPosition) {
            endObj.setPosition(this._dragEndStart.x + offset.x, this._dragEndStart.y + offset.y);
        }
    }

    endDrag() {
        delete this._dragStart;
        delete this._dragStartStart;
        delete this._dragEndStart;
    }

    getStart() {
        return this._start.clone();
    }

    getEnd() {
        return this._end.clone();
    }

    getDirection() {
        return this._end.sub(this._start).normalize();
    }

    getMagnitude() {
        return this._start.distanceTo(this._end);
    }

    toJSON() {
        return {
            ...super.toJSON(),
            startPointId: this.startPointId,
            endPointId: this.endPointId
        };
    }
}

export default Vector;
