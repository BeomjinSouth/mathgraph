/**
 * Circle.js - 원 객체들
 * 중심-점 원, 세 점 원
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2, Geometry } from '../utils/Geometry.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * 중심-점 원 (Circle by Center and Point)
 */
export class Circle extends GeoObject {
    constructor(centerId, pointOnCircleId, params = {}) {
        super(ObjectType.CIRCLE, params);
        this.centerId = centerId;
        this.pointOnCircleId = pointOnCircleId;
        this.addDependency(centerId);
        this.addDependency(pointOnCircleId);

        this._center = new Vec2(0, 0);
        this._radius = 0;
        this._draggingLabel = false; // 라벨 드래그 중인지
    }

    update(objectManager) {
        const centerObj = objectManager.getObject(this.centerId);
        const pointObj = objectManager.getObject(this.pointOnCircleId);

        if (!centerObj || !pointObj || !centerObj.valid || !pointObj.valid) {
            this.valid = false;
            return;
        }

        this._center = centerObj.getPosition();
        const pointOnCircle = pointObj.getPosition();
        this._radius = this._center.distanceTo(pointOnCircle);

        if (this._radius < MathUtils.EPSILON) {
            this.valid = false;
            return;
        }

        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawCircle(this._center, this._radius, {
            color: this.color,
            width: this.lineWidth,
            dashed: this.dashed,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            // 원의 오른쪽 상단에 라벨 (labelOffset 적용)
            const labelPos = this._center.add(new Vec2(this._radius * 0.7, this._radius * 0.7));
            canvas.drawLabel(labelPos, this.label, {
                fontSize: this.fontSize,
                color: this.color,
                offsetX: this.labelOffset.x,
                offsetY: this.labelOffset.y
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);
        const distToCenter = point.distanceTo(this._center);
        const distToCircle = Math.abs(distToCenter - this._radius);

        return distToCircle <= screenThreshold;
    }

    /**
     * 라벨 영역 히트 테스트
     */
    hitTestLabel(point, canvas) {
        if (!this.showLabel || !this.label) return false;

        const labelPos = this._center.add(new Vec2(this._radius * 0.7, this._radius * 0.7));
        const screenLabelPos = canvas.toScreen(labelPos);
        const labelX = screenLabelPos.x + this.labelOffset.x;
        const labelY = screenLabelPos.y + this.labelOffset.y;

        const screenPoint = canvas.toScreen(point);
        const labelWidth = this.fontSize * this.label.length * 0.6;
        const labelHeight = this.fontSize;

        return screenPoint.x >= labelX - 5 &&
            screenPoint.x <= labelX + labelWidth + 5 &&
            screenPoint.y >= labelY - labelHeight - 5 &&
            screenPoint.y <= labelY + 5;
    }

    isDraggable() {
        return !this.locked && this.visible; // 원 드래그 가능
    }

    startDrag(point, canvas, objectManager) {
        // 라벨 영역 클릭인지 확인
        if (this.hitTestLabel(point, canvas)) {
            this._draggingLabel = true;
            this._labelDragStart = this.labelOffset.clone();
            this._dragStart = canvas.toScreen(point);
        } else {
            this._draggingLabel = false;
            this._dragStart = point.clone();

            // 중심점과 원 위의 점의 시작 위치 저장
            const centerObj = objectManager.getObject(this.centerId);
            const pointObj = objectManager.getObject(this.pointOnCircleId);

            if (centerObj && centerObj.getPosition) {
                this._centerStart = centerObj.getPosition();
            }
            if (pointObj && pointObj.getPosition) {
                this._pointStart = pointObj.getPosition();
            }
        }
    }

    drag(point, delta, canvas, objectManager) {
        if (this._draggingLabel) {
            // 라벨 드래그: 스크린 좌표로 오프셋 조정
            const screenPoint = canvas.toScreen(point);
            const dx = screenPoint.x - this._dragStart.x;
            const dy = screenPoint.y - this._dragStart.y;

            this.labelOffset = new Vec2(
                this._labelDragStart.x + dx,
                this._labelDragStart.y + dy
            );
        } else {
            // 원 전체 드래그
            if (!this._dragStart || !this._centerStart) return;

            const moveVec = point.sub(this._dragStart);

            // 중심점 이동
            const centerObj = objectManager.getObject(this.centerId);
            if (centerObj && centerObj.setPosition && !centerObj.locked) {
                centerObj.setPosition(
                    this._centerStart.x + moveVec.x,
                    this._centerStart.y + moveVec.y
                );
            }

            // 원 위의 점 이동
            const pointObj = objectManager.getObject(this.pointOnCircleId);
            if (pointObj && pointObj.setPosition && !pointObj.locked && this._pointStart) {
                pointObj.setPosition(
                    this._pointStart.x + moveVec.x,
                    this._pointStart.y + moveVec.y
                );
            }
        }
    }

    endDrag() {
        delete this._dragStart;
        delete this._centerStart;
        delete this._pointStart;
        delete this._draggingLabel;
        delete this._labelDragStart;
    }

    getCenter() {
        return this._center.clone();
    }

    getRadius() {
        return this._radius;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            centerId: this.centerId,
            pointOnCircleId: this.pointOnCircleId,
            labelOffset: { x: this.labelOffset.x, y: this.labelOffset.y }
        };
    }
}

/**
 * 세 점 원 (Circle through Three Points)
 */
export class CircleThreePoints extends GeoObject {
    constructor(point1Id, point2Id, point3Id, params = {}) {
        super(ObjectType.CIRCLE_THREE_POINTS, params);
        this.point1Id = point1Id;
        this.point2Id = point2Id;
        this.point3Id = point3Id;
        this.addDependency(point1Id);
        this.addDependency(point2Id);
        this.addDependency(point3Id);

        this._center = new Vec2(0, 0);
        this._radius = 0;
    }

    update(objectManager) {
        const p1Obj = objectManager.getObject(this.point1Id);
        const p2Obj = objectManager.getObject(this.point2Id);
        const p3Obj = objectManager.getObject(this.point3Id);

        if (!p1Obj || !p2Obj || !p3Obj ||
            !p1Obj.valid || !p2Obj.valid || !p3Obj.valid) {
            this.valid = false;
            return;
        }

        const p1 = p1Obj.getPosition();
        const p2 = p2Obj.getPosition();
        const p3 = p3Obj.getPosition();

        // 외접원 계산
        const result = Geometry.circumcircle(p1, p2, p3);

        if (!result) {
            this.valid = false; // 세 점이 일직선
            return;
        }

        this._center = result.center;
        this._radius = result.radius;
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawCircle(this._center, this._radius, {
            color: this.color,
            width: this.lineWidth,
            dashed: this.dashed,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            const labelPos = this._center.add(new Vec2(this._radius * 0.7, this._radius * 0.7));
            canvas.drawLabel(labelPos, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);
        const distToCenter = point.distanceTo(this._center);
        const distToCircle = Math.abs(distToCenter - this._radius);

        return distToCircle <= screenThreshold;
    }

    isDraggable() {
        return false;
    }

    getCenter() {
        return this._center.clone();
    }

    getRadius() {
        return this._radius;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            point1Id: this.point1Id,
            point2Id: this.point2Id,
            point3Id: this.point3Id
        };
    }
}

/**
 * 원의 접선 (Tangent Line to Circle)
 */
export class TangentCircle extends GeoObject {
    constructor(circleId, tangentPointId, params = {}) {
        super(ObjectType.TANGENT_CIRCLE, params);
        this.circleId = circleId;
        this.tangentPointId = tangentPointId;
        this.addDependency(circleId);
        this.addDependency(tangentPointId);

        this._p1 = new Vec2(0, 0);
        this._p2 = new Vec2(0, 0);
        this._tangentPoint = new Vec2(0, 0);
    }

    update(objectManager) {
        const circle = objectManager.getObject(this.circleId);
        const tangentPointObj = objectManager.getObject(this.tangentPointId);

        if (!circle || !tangentPointObj || !circle.valid || !tangentPointObj.valid) {
            this.valid = false;
            return;
        }

        const center = circle.getCenter();
        this._tangentPoint = tangentPointObj.getPosition();

        // 접선 방향: 중심에서 접점으로의 벡터에 수직
        const radialDir = this._tangentPoint.sub(center).normalize();
        const tangentDir = radialDir.perpendicular();

        this._p1 = this._tangentPoint.sub(tangentDir);
        this._p2 = this._tangentPoint.add(tangentDir);
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
            canvas.drawLabel(this._tangentPoint, this.label, {
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

    // 접선 드래그: 접점이 원 위에서 이동
    drag(point, delta, canvas, objectManager) {
        const tangentPointObj = objectManager.getObject(this.tangentPointId);
        if (!tangentPointObj || tangentPointObj.locked) return;

        const circle = objectManager.getObject(this.circleId);
        if (!circle) return;

        const center = circle.getCenter();

        // 드래그 지점을 원에 투영
        const dir = point.sub(center);
        const angle = Math.atan2(dir.y, dir.x);

        // PointOnCircle의 angle 업데이트
        if (tangentPointObj.angle !== undefined) {
            tangentPointObj.angle = angle;
        }
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
            circleId: this.circleId,
            tangentPointId: this.tangentPointId
        };
    }
}

export default { Circle, CircleThreePoints, TangentCircle };
