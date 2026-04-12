/**
 * Point.js - 점 객체들
 * 자유점, 선 위의 점, 교점, 중점 등
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2, Geometry } from '../utils/Geometry.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * 자유점 (Free Point)
 * 캔버스 어디든 배치 가능
 */
export class FreePoint extends GeoObject {
    constructor(x, y, params = {}) {
        super(ObjectType.POINT, params);
        this.position = new Vec2(x, y);
        this._draggingLabel = false; // 라벨 드래그 중인지
    }

    update() {
        // 자유점은 업데이트 불필요
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawPoint(this.position, {
            radius: this.pointSize,
            color: this.color,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            canvas.drawLabel(this.position, this.label, {
                fontSize: this.fontSize,
                color: this.color,
                offsetX: this.labelOffset.x,
                offsetY: this.labelOffset.y
            });
        }
    }

    hitTest(point, threshold, canvas) {
        const screenPos = canvas.toScreen(this.position);
        const screenPoint = canvas.toScreen(point);

        // 점 영역 히트
        if (screenPos.distanceTo(screenPoint) <= threshold + this.pointSize) {
            return true;
        }

        // 라벨 영역 히트
        if (this.hitTestLabel(point, canvas)) {
            return true;
        }

        return false;
    }

    /**
     * 라벨 영역 히트 테스트
     */
    hitTestLabel(point, canvas) {
        if (!this.showLabel || !this.label) return false;

        // 점의 화면 좌표
        const screenPos = canvas.toScreen(this.position);
        // 라벨의 화면 위치
        const labelX = screenPos.x + this.labelOffset.x;
        const labelY = screenPos.y + this.labelOffset.y - this.fontSize; // baseline 위가 실제 라벨 영역

        // 마우스의 화면 좌표
        const screenPoint = canvas.toScreen(point);

        // 라벨 크기 계산
        const labelWidth = Math.max(this.fontSize * this.label.length * 0.7, 20);
        const labelHeight = this.fontSize + 4;

        return screenPoint.x >= labelX - 5 &&
            screenPoint.x <= labelX + labelWidth + 5 &&
            screenPoint.y >= labelY - 5 &&
            screenPoint.y <= labelY + labelHeight + 5;
    }

    isDraggable() {
        return !this.locked && this.visible;
    }

    startDrag(point, canvas) {
        // 라벨 영역 클릭인지 확인
        if (this.hitTestLabel(point, canvas)) {
            this._draggingLabel = true;
            this._labelDragStart = this.labelOffset.clone();
            this._dragStart = canvas.toScreen(point);
        } else {
            this._draggingLabel = false;
            this.dragOffset = this.position.sub(point);
        }
    }

    drag(point, delta, canvas) {
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
            // 점 드래그
            this.position = point.add(this.dragOffset);
        }
    }

    endDrag() {
        delete this.dragOffset;
        delete this._draggingLabel;
        delete this._labelDragStart;
        delete this._dragStart;
    }

    getPosition() {
        return this.position.clone();
    }

    setPosition(x, y) {
        this.position.set(x, y);
    }

    toJSON() {
        return {
            ...super.toJSON(),
            x: this.position.x,
            y: this.position.y,
            labelOffset: { x: this.labelOffset.x, y: this.labelOffset.y }
        };
    }

    static fromJSON(data) {
        const point = new FreePoint(data.x, data.y, data);
        point.id = data.id;
        point.dependencies = data.dependencies || [];
        return point;
    }
}

/**
 * 선 위의 점 (Point on Object)
 * 선(직선/선분/반직선) 위에서만 이동 가능
 */
export class PointOnLine extends GeoObject {
    constructor(lineId, t = 0.5, params = {}) {
        super(ObjectType.POINT_ON_OBJECT, params);
        this.lineId = lineId;
        this.t = t; // 0~1 파라미터 (선분의 경우), 직선은 무제한
        this.position = new Vec2(0, 0);
        this.addDependency(lineId);
    }

    update(objectManager) {
        const line = objectManager.getObject(this.lineId);
        if (!line || !line.valid) {
            this.valid = false;
            return;
        }

        const p1 = line.getPoint1();
        const p2 = line.getPoint2();

        if (!p1 || !p2) {
            this.valid = false;
            return;
        }

        // t 파라미터로 위치 계산
        this.position = p1.lerp(p2, this.t);
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawPoint(this.position, {
            radius: this.pointSize,
            color: this.color,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            canvas.drawLabel(this.position, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        const screenPos = canvas.toScreen(this.position);
        const screenPoint = canvas.toScreen(point);
        return screenPos.distanceTo(screenPoint) <= threshold + this.pointSize;
    }

    drag(point, delta, canvas, objectManager) {
        const line = objectManager.getObject(this.lineId);
        if (!line) return;

        const p1 = line.getPoint1();
        const p2 = line.getPoint2();

        // 드래그 지점을 선에 투영
        const proj = Geometry.projectPointOnLine(point, p1, p2);

        // t 파라미터 계산
        const dir = p2.sub(p1);
        const lenSq = dir.lengthSq();

        if (lenSq > MathUtils.EPSILON) {
            this.t = proj.sub(p1).dot(dir) / lenSq;

            // 선분이면 0~1로 제한
            if (line.type === ObjectType.SEGMENT) {
                this.t = MathUtils.clamp(this.t, 0, 1);
            }
            // 반직선이면 0 이상으로 제한
            else if (line.type === ObjectType.RAY) {
                this.t = Math.max(0, this.t);
            }
        }
    }

    getPosition() {
        return this.position.clone();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            lineId: this.lineId,
            t: this.t
        };
    }
}

/**
 * 원 위의 점
 */
export class PointOnCircle extends GeoObject {
    constructor(circleId, angle = 0, params = {}) {
        super(ObjectType.POINT_ON_OBJECT, params);
        this.circleId = circleId;
        this.angle = angle; // 라디안
        this.position = new Vec2(0, 0);
        this.addDependency(circleId);
    }

    update(objectManager) {
        const circle = objectManager.getObject(this.circleId);
        if (!circle || !circle.valid) {
            this.valid = false;
            return;
        }

        const center = circle.getCenter();
        const radius = circle.getRadius();

        if (!center || radius <= 0) {
            this.valid = false;
            return;
        }

        this.position = new Vec2(
            center.x + radius * Math.cos(this.angle),
            center.y + radius * Math.sin(this.angle)
        );
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawPoint(this.position, {
            radius: this.pointSize,
            color: this.color,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            canvas.drawLabel(this.position, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        const screenPos = canvas.toScreen(this.position);
        const screenPoint = canvas.toScreen(point);
        return screenPos.distanceTo(screenPoint) <= threshold + this.pointSize;
    }

    drag(point, delta, canvas, objectManager) {
        const circle = objectManager.getObject(this.circleId);
        if (!circle) return;

        const center = circle.getCenter();
        const dir = point.sub(center);
        this.angle = Math.atan2(dir.y, dir.x);
    }

    getPosition() {
        return this.position.clone();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            circleId: this.circleId,
            angle: this.angle
        };
    }
}

/**
 * 교점 (Intersection Point)
 */
export class IntersectionPoint extends GeoObject {
    constructor(object1Id, object2Id, anchor = null, params = {}) {
        super(ObjectType.INTERSECTION, params);
        this.object1Id = object1Id;
        this.object2Id = object2Id;
        this.anchor = anchor; // 여러 교점 중 선택 기준점
        this.position = new Vec2(0, 0);
        this.addDependency(object1Id);
        this.addDependency(object2Id);
    }

    update(objectManager) {
        const obj1 = objectManager.getObject(this.object1Id);
        const obj2 = objectManager.getObject(this.object2Id);

        if (!obj1 || !obj2 || !obj1.valid || !obj2.valid) {
            this.valid = false;
            return;
        }

        // 교점 계산
        const intersections = this.computeIntersections(obj1, obj2);

        if (intersections.length === 0) {
            this.valid = false;
            return;
        }

        // anchor에 가장 가까운 교점 선택
        if (this.anchor && intersections.length > 1) {
            let minDist = Infinity;
            let closest = intersections[0];

            for (const p of intersections) {
                const dist = p.distanceTo(this.anchor);
                if (dist < minDist) {
                    minDist = dist;
                    closest = p;
                }
            }
            this.position = closest;
        } else {
            this.position = intersections[0];
        }

        // anchor 업데이트 (다음 계산을 위해)
        this.anchor = this.position.clone();
        this.valid = true;
    }

    computeIntersections(obj1, obj2) {
        // 선-선 교점
        if (this.isLineType(obj1) && this.isLineType(obj2)) {
            const p1 = obj1.getPoint1();
            const p2 = obj1.getPoint2();
            const p3 = obj2.getPoint1();
            const p4 = obj2.getPoint2();

            const intersection = Geometry.lineLineIntersection(p1, p2, p3, p4);
            if (intersection) {
                // 선분/반직선인 경우 범위 체크
                if (this.isInRange(obj1, intersection) && this.isInRange(obj2, intersection)) {
                    return [intersection];
                }
            }
            return [];
        }

        // 선-원 교점
        if (this.isLineType(obj1) && this.isCircleType(obj2)) {
            return this.lineCircleIntersection(obj1, obj2);
        }
        if (this.isCircleType(obj1) && this.isLineType(obj2)) {
            return this.lineCircleIntersection(obj2, obj1);
        }

        // 원-원 교점
        if (this.isCircleType(obj1) && this.isCircleType(obj2)) {
            const c1 = obj1.getCenter();
            const r1 = obj1.getRadius();
            const c2 = obj2.getCenter();
            const r2 = obj2.getRadius();
            return Geometry.circleCircleIntersection(c1, r1, c2, r2);
        }

        // 함수-선 교점
        if (obj1.type === ObjectType.FUNCTION && this.isLineType(obj2)) {
            return this.functionLineIntersection(obj1, obj2);
        }
        if (this.isLineType(obj1) && obj2.type === ObjectType.FUNCTION) {
            return this.functionLineIntersection(obj2, obj1);
        }

        return [];
    }

    isLineType(obj) {
        return [ObjectType.SEGMENT, ObjectType.LINE, ObjectType.RAY,
        ObjectType.PARALLEL, ObjectType.PERPENDICULAR,
        ObjectType.PERPENDICULAR_BISECTOR, ObjectType.ANGLE_BISECTOR,
        ObjectType.TANGENT_CIRCLE, ObjectType.TANGENT_FUNCTION].includes(obj.type);
    }

    isCircleType(obj) {
        return [ObjectType.CIRCLE, ObjectType.CIRCLE_THREE_POINTS].includes(obj.type);
    }

    isInRange(lineObj, point) {
        const p1 = lineObj.getPoint1();
        const p2 = lineObj.getPoint2();
        const dir = p2.sub(p1);
        const t = point.sub(p1).dot(dir) / dir.lengthSq();

        if (lineObj.type === ObjectType.SEGMENT) {
            return t >= -MathUtils.EPSILON && t <= 1 + MathUtils.EPSILON;
        }
        if (lineObj.type === ObjectType.RAY) {
            return t >= -MathUtils.EPSILON;
        }
        return true; // 직선
    }

    lineCircleIntersection(lineObj, circleObj) {
        const p1 = lineObj.getPoint1();
        const p2 = lineObj.getPoint2();
        const center = circleObj.getCenter();
        const radius = circleObj.getRadius();

        let intersections;
        if (lineObj.type === ObjectType.SEGMENT) {
            intersections = Geometry.segmentCircleIntersection(p1, p2, center, radius);
        } else {
            intersections = Geometry.lineCircleIntersection(p1, p2, center, radius);
            // 반직선이면 범위 체크
            if (lineObj.type === ObjectType.RAY) {
                intersections = intersections.filter(p => this.isInRange(lineObj, p));
            }
        }

        return intersections;
    }

    functionLineIntersection(funcObj, lineObj) {
        // 수치적 교점 찾기 (간단한 이터레이션)
        // 실제 구현은 더 정교한 알고리즘 필요
        const fn = funcObj.getFunction();
        const p1 = lineObj.getPoint1();
        const p2 = lineObj.getPoint2();

        // TODO: 함수-직선 교점 수치 해법 구현
        return [];
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawPoint(this.position, {
            radius: this.pointSize,
            color: this.color,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            canvas.drawLabel(this.position, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;
        const screenPos = canvas.toScreen(this.position);
        const screenPoint = canvas.toScreen(point);
        return screenPos.distanceTo(screenPoint) <= threshold + this.pointSize;
    }

    getPosition() {
        return this.position.clone();
    }

    // 교점은 드래그 불가 (의존 객체)
    isDraggable() {
        return false;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            object1Id: this.object1Id,
            object2Id: this.object2Id,
            anchorX: this.anchor?.x,
            anchorY: this.anchor?.y
        };
    }
}

/**
 * 중점 (Midpoint)
 */
export class Midpoint extends GeoObject {
    constructor(segmentId, params = {}) {
        super(ObjectType.MIDPOINT, params);
        this.segmentId = segmentId;
        this.position = new Vec2(0, 0);
        this.addDependency(segmentId);
    }

    update(objectManager) {
        const segment = objectManager.getObject(this.segmentId);
        if (!segment || !segment.valid) {
            this.valid = false;
            return;
        }

        const p1 = segment.getPoint1();
        const p2 = segment.getPoint2();

        if (!p1 || !p2) {
            this.valid = false;
            return;
        }

        this.position = Geometry.midpoint(p1, p2);
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawPoint(this.position, {
            radius: this.pointSize,
            color: this.color,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            canvas.drawLabel(this.position, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;
        const screenPos = canvas.toScreen(this.position);
        const screenPoint = canvas.toScreen(point);
        return screenPos.distanceTo(screenPoint) <= threshold + this.pointSize;
    }

    getPosition() {
        return this.position.clone();
    }

    isDraggable() {
        return false;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            segmentId: this.segmentId
        };
    }
}

/**
 * 원의 중심점 (Circle Center Point)
 * 원에 의존하며 원의 중심 위치를 자동으로 따라감
 */
export class CircleCenterPoint extends GeoObject {
    constructor(circleId, params = {}) {
        super(ObjectType.POINT, params);
        this.circleId = circleId;
        this.addDependency(circleId);

        this.position = new Vec2(0, 0);
        this.pointSize = params.pointSize || 4;
    }

    update(objectManager) {
        const circle = objectManager.getObject(this.circleId);

        if (!circle || !circle.valid) {
            this.valid = false;
            return;
        }

        this.position = circle.getCenter();
        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawPoint(this.position, {
            radius: this.pointSize,
            color: this.color,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            canvas.drawLabel(this.position, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;
        const screenPos = canvas.toScreen(this.position);
        const screenPoint = canvas.toScreen(point);
        return screenPos.distanceTo(screenPoint) <= threshold + this.pointSize;
    }

    getPosition() {
        return this.position.clone();
    }

    isDraggable() {
        return false;  // 원을 따라가므로 직접 드래그 불가
    }

    toJSON() {
        return {
            ...super.toJSON(),
            circleId: this.circleId
        };
    }
}

export default { FreePoint, PointOnLine, PointOnCircle, IntersectionPoint, Midpoint, CircleCenterPoint };
