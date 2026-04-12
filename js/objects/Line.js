/**
 * Line.js - 선 객체들
 * 선분, 직선, 반직선, 평행선, 수선, 수직이등분선, 각의 이등분선
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2, Geometry } from '../utils/Geometry.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * 선분 (Segment)
 */
export class Segment extends GeoObject {
    constructor(point1Id, point2Id, params = {}) {
        super(ObjectType.SEGMENT, params);
        this.point1Id = point1Id;
        this.point2Id = point2Id;
        this.addDependency(point1Id);
        this.addDependency(point2Id);

        // 캐시된 위치
        this._p1 = new Vec2(0, 0);
        this._p2 = new Vec2(0, 0);
    }

    update(objectManager) {
        const p1Obj = objectManager.getObject(this.point1Id);
        const p2Obj = objectManager.getObject(this.point2Id);

        if (!p1Obj || !p2Obj || !p1Obj.valid || !p2Obj.valid) {
            this.valid = false;
            return;
        }

        this._p1 = p1Obj.getPosition();
        this._p2 = p2Obj.getPosition();
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawSegment(this._p1, this._p2, {
            color: this.color,
            width: this.lineWidth,
            dashed: this.dashed,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            const mid = Geometry.midpoint(this._p1, this._p2);
            canvas.drawLabel(mid, this.label, {
                fontSize: this.fontSize,
                color: this.color,
                offsetX: 0,
                offsetY: -12
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);
        const dist = Geometry.pointToSegmentDistance(point, this._p1, this._p2);
        return dist <= screenThreshold;
    }

    // 직선 드래그: 양 끝점 동시 이동 (평행이동)
    startDrag(point, canvas, objectManager) {
        this._dragStart = point.clone();
        this._dragP1Start = this._p1.clone();
        this._dragP2Start = this._p2.clone();
    }

    drag(point, delta, canvas, objectManager) {
        const p1Obj = objectManager.getObject(this.point1Id);
        const p2Obj = objectManager.getObject(this.point2Id);

        const offset = point.sub(this._dragStart);

        // 잠기지 않은 점만 이동
        if (p1Obj && !p1Obj.locked && p1Obj.setPosition) {
            p1Obj.setPosition(this._dragP1Start.x + offset.x, this._dragP1Start.y + offset.y);
        }
        if (p2Obj && !p2Obj.locked && p2Obj.setPosition) {
            p2Obj.setPosition(this._dragP2Start.x + offset.x, this._dragP2Start.y + offset.y);
        }
    }

    endDrag() {
        delete this._dragStart;
        delete this._dragP1Start;
        delete this._dragP2Start;
    }

    getPoint1() {
        return this._p1.clone();
    }

    getPoint2() {
        return this._p2.clone();
    }

    getLength() {
        return this._p1.distanceTo(this._p2);
    }

    getDirection() {
        return this._p2.sub(this._p1).normalize();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            point1Id: this.point1Id,
            point2Id: this.point2Id
        };
    }
}

/**
 * 직선 (Line)
 */
export class Line extends GeoObject {
    constructor(point1Id, point2Id, params = {}) {
        super(ObjectType.LINE, params);
        this.point1Id = point1Id;
        this.point2Id = point2Id;
        this.addDependency(point1Id);
        this.addDependency(point2Id);

        this._p1 = new Vec2(0, 0);
        this._p2 = new Vec2(0, 0);
    }

    update(objectManager) {
        const p1Obj = objectManager.getObject(this.point1Id);
        const p2Obj = objectManager.getObject(this.point2Id);

        if (!p1Obj || !p2Obj || !p1Obj.valid || !p2Obj.valid) {
            this.valid = false;
            return;
        }

        this._p1 = p1Obj.getPosition();
        this._p2 = p2Obj.getPosition();

        // 두 점이 같으면 무효
        if (this._p1.equals(this._p2)) {
            this.valid = false;
            return;
        }

        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawLine(this._p1, this._p2, {
            color: this.color,
            width: this.lineWidth,
            dashed: this.dashed,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            const mid = Geometry.midpoint(this._p1, this._p2);
            canvas.drawLabel(mid, this.label, {
                fontSize: this.fontSize,
                color: this.color,
                offsetX: 0,
                offsetY: -12
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);
        const dist = Geometry.pointToLineDistance(point, this._p1, this._p2);
        return dist <= screenThreshold;
    }

    startDrag(point, canvas, objectManager) {
        this._dragStart = point.clone();
        this._dragP1Start = this._p1.clone();
        this._dragP2Start = this._p2.clone();
    }

    drag(point, delta, canvas, objectManager) {
        const p1Obj = objectManager.getObject(this.point1Id);
        const p2Obj = objectManager.getObject(this.point2Id);

        const offset = point.sub(this._dragStart);

        if (p1Obj && !p1Obj.locked && p1Obj.setPosition) {
            p1Obj.setPosition(this._dragP1Start.x + offset.x, this._dragP1Start.y + offset.y);
        }
        if (p2Obj && !p2Obj.locked && p2Obj.setPosition) {
            p2Obj.setPosition(this._dragP2Start.x + offset.x, this._dragP2Start.y + offset.y);
        }
    }

    endDrag() {
        delete this._dragStart;
        delete this._dragP1Start;
        delete this._dragP2Start;
    }

    getPoint1() {
        return this._p1.clone();
    }

    getPoint2() {
        return this._p2.clone();
    }

    getDirection() {
        return this._p2.sub(this._p1).normalize();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            point1Id: this.point1Id,
            point2Id: this.point2Id
        };
    }
}

/**
 * 반직선 (Ray)
 */
export class Ray extends GeoObject {
    constructor(originId, directionPointId, params = {}) {
        super(ObjectType.RAY, params);
        this.originId = originId;
        this.directionPointId = directionPointId;
        this.addDependency(originId);
        this.addDependency(directionPointId);

        this._origin = new Vec2(0, 0);
        this._dirPoint = new Vec2(0, 0);
    }

    update(objectManager) {
        const originObj = objectManager.getObject(this.originId);
        const dirObj = objectManager.getObject(this.directionPointId);

        if (!originObj || !dirObj || !originObj.valid || !dirObj.valid) {
            this.valid = false;
            return;
        }

        this._origin = originObj.getPosition();
        this._dirPoint = dirObj.getPosition();

        if (this._origin.equals(this._dirPoint)) {
            this.valid = false;
            return;
        }

        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        const dir = this._dirPoint.sub(this._origin);
        canvas.drawRay(this._origin, dir, {
            color: this.color,
            width: this.lineWidth,
            dashed: this.dashed,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            const labelPos = this._origin.add(dir.normalize().mul(2));
            canvas.drawLabel(labelPos, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);
        const dir = this._dirPoint.sub(this._origin).normalize();

        // 반직선 방향 체크
        const toPoint = point.sub(this._origin);
        if (toPoint.dot(dir) < 0) return false;

        const dist = Geometry.pointToLineDistance(point, this._origin, this._dirPoint);
        return dist <= screenThreshold;
    }

    startDrag(point, canvas, objectManager) {
        this._dragStart = point.clone();
        this._dragOriginStart = this._origin.clone();
        this._dragDirStart = this._dirPoint.clone();
    }

    drag(point, delta, canvas, objectManager) {
        const originObj = objectManager.getObject(this.originId);
        const dirObj = objectManager.getObject(this.directionPointId);

        const offset = point.sub(this._dragStart);

        if (originObj && !originObj.locked && originObj.setPosition) {
            originObj.setPosition(this._dragOriginStart.x + offset.x, this._dragOriginStart.y + offset.y);
        }
        if (dirObj && !dirObj.locked && dirObj.setPosition) {
            dirObj.setPosition(this._dragDirStart.x + offset.x, this._dragDirStart.y + offset.y);
        }
    }

    endDrag() {
        delete this._dragStart;
        delete this._dragOriginStart;
        delete this._dragDirStart;
    }

    getPoint1() {
        return this._origin.clone();
    }

    getPoint2() {
        return this._dirPoint.clone();
    }

    getDirection() {
        return this._dirPoint.sub(this._origin).normalize();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            originId: this.originId,
            directionPointId: this.directionPointId
        };
    }
}

/**
 * 평행선 (Parallel Line)
 */
export class ParallelLine extends GeoObject {
    constructor(baseLineId, throughPointId, params = {}) {
        super(ObjectType.PARALLEL, params);
        this.baseLineId = baseLineId;
        this.throughPointId = throughPointId;
        this.addDependency(baseLineId);
        this.addDependency(throughPointId);

        this._p1 = new Vec2(0, 0);
        this._p2 = new Vec2(0, 0);
    }

    update(objectManager) {
        const baseLine = objectManager.getObject(this.baseLineId);
        const throughPoint = objectManager.getObject(this.throughPointId);

        if (!baseLine || !throughPoint || !baseLine.valid || !throughPoint.valid) {
            this.valid = false;
            return;
        }

        const dir = baseLine.getDirection();
        const point = throughPoint.getPosition();

        this._p1 = point;
        this._p2 = point.add(dir);
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawLine(this._p1, this._p2, {
            color: this.color,
            width: this.lineWidth,
            dashed: this.dashed,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            canvas.drawLabel(this._p1, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);
        const dist = Geometry.pointToLineDistance(point, this._p1, this._p2);
        return dist <= screenThreshold;
    }

    // 평행선 드래그: 기준선에 수직 방향으로 점 이동
    drag(point, delta, canvas, objectManager) {
        const throughPoint = objectManager.getObject(this.throughPointId);
        if (!throughPoint || throughPoint.locked || !throughPoint.setPosition) return;

        const baseLine = objectManager.getObject(this.baseLineId);
        if (!baseLine) return;

        // 수직 방향 투영
        const dir = baseLine.getDirection();
        const perp = dir.perpendicular();

        const currentPos = throughPoint.getPosition();
        const newPos = currentPos.add(perp.mul(delta.dot(perp)));

        throughPoint.setPosition(newPos.x, newPos.y);
    }

    getPoint1() {
        return this._p1.clone();
    }

    getPoint2() {
        return this._p2.clone();
    }

    getDirection() {
        return this._p2.sub(this._p1).normalize();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            baseLineId: this.baseLineId,
            throughPointId: this.throughPointId
        };
    }
}

/**
 * 수선 (Perpendicular Line)
 */
export class PerpendicularLine extends GeoObject {
    constructor(throughPointId, baseLineId, params = {}) {
        super(ObjectType.PERPENDICULAR, params);
        this.throughPointId = throughPointId;
        this.baseLineId = baseLineId;
        this.addDependency(throughPointId);
        this.addDependency(baseLineId);

        this._p1 = new Vec2(0, 0);
        this._p2 = new Vec2(0, 0);
    }

    update(objectManager) {
        const baseLine = objectManager.getObject(this.baseLineId);
        const throughPoint = objectManager.getObject(this.throughPointId);

        if (!baseLine || !throughPoint || !baseLine.valid || !throughPoint.valid) {
            this.valid = false;
            return;
        }

        const dir = baseLine.getDirection();
        const perpDir = dir.perpendicular();
        const point = throughPoint.getPosition();

        this._p1 = point;
        this._p2 = point.add(perpDir);
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawLine(this._p1, this._p2, {
            color: this.color,
            width: this.lineWidth,
            dashed: this.dashed,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            canvas.drawLabel(this._p1, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);
        const dist = Geometry.pointToLineDistance(point, this._p1, this._p2);
        return dist <= screenThreshold;
    }

    // 수선 드래그: 기준선 방향으로 점 이동
    drag(point, delta, canvas, objectManager) {
        const throughPoint = objectManager.getObject(this.throughPointId);
        if (!throughPoint || throughPoint.locked || !throughPoint.setPosition) return;

        const baseLine = objectManager.getObject(this.baseLineId);
        if (!baseLine) return;

        const dir = baseLine.getDirection();

        const currentPos = throughPoint.getPosition();
        const newPos = currentPos.add(dir.mul(delta.dot(dir)));

        throughPoint.setPosition(newPos.x, newPos.y);
    }

    getPoint1() {
        return this._p1.clone();
    }

    getPoint2() {
        return this._p2.clone();
    }

    getDirection() {
        return this._p2.sub(this._p1).normalize();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            throughPointId: this.throughPointId,
            baseLineId: this.baseLineId
        };
    }
}

/**
 * 수직이등분선 (Perpendicular Bisector)
 */
export class PerpendicularBisector extends GeoObject {
    constructor(segmentId, params = {}) {
        super(ObjectType.PERPENDICULAR_BISECTOR, params);
        this.segmentId = segmentId;
        this.addDependency(segmentId);

        this._p1 = new Vec2(0, 0);
        this._p2 = new Vec2(0, 0);
        this._midpoint = new Vec2(0, 0);
    }

    update(objectManager) {
        const segment = objectManager.getObject(this.segmentId);

        if (!segment || !segment.valid) {
            this.valid = false;
            return;
        }

        const sp1 = segment.getPoint1();
        const sp2 = segment.getPoint2();

        const mid = Geometry.midpoint(sp1, sp2);
        const dir = sp2.sub(sp1).perpendicular().normalize();

        this._midpoint = mid;
        this._p1 = mid.sub(dir);
        this._p2 = mid.add(dir);
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawLine(this._p1, this._p2, {
            color: this.color,
            width: this.lineWidth,
            dashed: this.dashed,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            canvas.drawLabel(this._midpoint, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);
        const dist = Geometry.pointToLineDistance(point, this._p1, this._p2);
        return dist <= screenThreshold;
    }

    isDraggable() {
        return false; // 수직이등분선은 직접 드래그 불가
    }

    getPoint1() {
        return this._p1.clone();
    }

    getPoint2() {
        return this._p2.clone();
    }

    getDirection() {
        return this._p2.sub(this._p1).normalize();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            segmentId: this.segmentId
        };
    }
}

/**
 * 각의 이등분선 (Angle Bisector)
 */
export class AngleBisector extends GeoObject {
    constructor(line1Id, line2Id, params = {}) {
        super(ObjectType.ANGLE_BISECTOR, params);
        this.line1Id = line1Id;
        this.line2Id = line2Id;
        this.exterior = params.exterior || false; // 외각 이등분선
        this.addDependency(line1Id);
        this.addDependency(line2Id);

        this._p1 = new Vec2(0, 0);
        this._p2 = new Vec2(0, 0);
        this._vertex = new Vec2(0, 0);
    }

    update(objectManager) {
        const line1 = objectManager.getObject(this.line1Id);
        const line2 = objectManager.getObject(this.line2Id);

        if (!line1 || !line2 || !line1.valid || !line2.valid) {
            this.valid = false;
            return;
        }

        // 두 직선의 교点
        const l1p1 = line1.getPoint1();
        const l1p2 = line1.getPoint2();
        const l2p1 = line2.getPoint1();
        const l2p2 = line2.getPoint2();

        const intersection = Geometry.lineLineIntersection(l1p1, l1p2, l2p1, l2p2);

        if (!intersection) {
            this.valid = false; // 평행
            return;
        }

        this._vertex = intersection;

        // 각의 이등분선 방향
        const dir1 = l1p2.sub(l1p1).normalize();
        const dir2 = l2p2.sub(l2p1).normalize();

        let bisectorDir = Geometry.angleBisectorDirection(intersection,
            intersection.add(dir1), intersection.add(dir2));

        // 외각인 경우 수직 방향
        if (this.exterior) {
            bisectorDir = bisectorDir.perpendicular();
        }

        this._p1 = intersection;
        this._p2 = intersection.add(bisectorDir);
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawLine(this._p1, this._p2, {
            color: this.color,
            width: this.lineWidth,
            dashed: this.dashed,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            canvas.drawLabel(this._vertex, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);
        const dist = Geometry.pointToLineDistance(point, this._p1, this._p2);
        return dist <= screenThreshold;
    }

    isDraggable() {
        return false;
    }

    getPoint1() {
        return this._p1.clone();
    }

    getPoint2() {
        return this._p2.clone();
    }

    getDirection() {
        return this._p2.sub(this._p1).normalize();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            line1Id: this.line1Id,
            line2Id: this.line2Id,
            exterior: this.exterior
        };
    }
}

export default { Segment, Line, Ray, ParallelLine, PerpendicularLine, PerpendicularBisector, AngleBisector };
