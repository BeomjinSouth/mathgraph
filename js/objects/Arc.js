/**
 * Arc.js - 호, 부채꼴, 활꼴 객체 (Mk.2)
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2 } from '../utils/Geometry.js';

/**
 * 호 (Arc) - 원 위의 두 점 사이 곡선
 */
export class Arc extends GeoObject {
    constructor(circleId, startPointId, endPointId, mode = 'minor', params = {}) {
        super(ObjectType.ARC, params);
        this.circleId = circleId;
        this.startPointId = startPointId;
        this.endPointId = endPointId;
        this.mode = mode; // 'minor' (짧은 호) 또는 'major' (긴 호)

        this.addDependency(circleId);
        this.addDependency(startPointId);
        this.addDependency(endPointId);

        // 계산된 값
        this.center = null;
        this.radius = 0;
        this.startAngle = 0;
        this.endAngle = 0;
    }

    update(objectManager) {
        const circle = objectManager.getObject(this.circleId);
        const startPoint = objectManager.getObject(this.startPointId);
        const endPoint = objectManager.getObject(this.endPointId);

        if (!circle || !startPoint || !endPoint ||
            !circle.valid || !startPoint.valid || !endPoint.valid) {
            this.valid = false;
            return;
        }

        this.center = circle.getCenter();
        this.radius = circle.getRadius();

        const startPos = startPoint.getPosition();
        const endPos = endPoint.getPosition();

        this.startAngle = Math.atan2(startPos.y - this.center.y, startPos.x - this.center.x);
        this.endAngle = Math.atan2(endPos.y - this.center.y, endPos.x - this.center.x);

        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid || !this.center) return;

        const ctx = canvas.ctx;
        const screenCenter = canvas.toScreen(this.center);
        const screenRadius = canvas.toScreenLength(this.radius);

        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;

        if (this.dashed) {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }

        // 호 그리기
        let startAngle = this.startAngle;
        let endAngle = this.endAngle;
        let counterclockwise = false;

        // minor/major 모드에 따라 방향 결정
        let angleDiff = endAngle - startAngle;
        if (angleDiff < 0) angleDiff += Math.PI * 2;

        // minor: 짧은 호 (angleDiff > PI면 반대 방향으로)
        // major: 긴 호 (angleDiff < PI면 반대 방향으로)
        if (this.mode === 'major') {
            // major면 긴 호를 그림: angleDiff < PI면 반대 방향
            counterclockwise = angleDiff < Math.PI;
        } else {
            // minor면 짧은 호를 그림: angleDiff > PI면 반대 방향
            counterclockwise = angleDiff > Math.PI;
        }

        // 화면 좌표계에서 y축이 반전되므로 counterclockwise도 반전
        counterclockwise = !counterclockwise;

        ctx.beginPath();
        // Canvas의 y축은 반전되어 있으므로 각도도 반전
        ctx.arc(screenCenter.x, screenCenter.y, screenRadius,
            -startAngle, -endAngle, counterclockwise);
        ctx.stroke();

        ctx.setLineDash([]);

        // 라벨
        if (this.showLabel && this.label) {
            const midAngle = (startAngle + endAngle) / 2;
            const labelPos = new Vec2(
                this.center.x + this.radius * Math.cos(midAngle),
                this.center.y + this.radius * Math.sin(midAngle)
            );
            canvas.drawLabel(labelPos, this.label, { color: this.color });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid || !this.center) return false;

        const dist = point.distanceTo(this.center);
        const onCircle = Math.abs(dist - this.radius) < canvas.toMathLength(threshold);

        if (!onCircle) return false;

        // 호 범위 내인지 확인
        const angle = Math.atan2(point.y - this.center.y, point.x - this.center.x);
        return this.isAngleInArc(angle);
    }

    isAngleInArc(angle) {
        let start = this.startAngle;
        let end = this.endAngle;

        // 정규화
        while (start < 0) start += Math.PI * 2;
        while (end < 0) end += Math.PI * 2;
        while (angle < 0) angle += Math.PI * 2;

        let angleDiff = end - start;
        if (angleDiff < 0) angleDiff += Math.PI * 2;

        let testDiff = angle - start;
        if (testDiff < 0) testDiff += Math.PI * 2;

        if (this.mode === 'major') {
            return testDiff > angleDiff || angleDiff > Math.PI;
        } else {
            return testDiff < angleDiff && angleDiff < Math.PI;
        }
    }

    isDraggable() {
        return false;
    }

    getIconClass() {
        return 'circle';
    }

    getTypeName() {
        return '호';
    }

    toJSON() {
        return {
            ...super.toJSON(),
            circleId: this.circleId,
            startPointId: this.startPointId,
            endPointId: this.endPointId,
            mode: this.mode
        };
    }
}

/**
 * 부채꼴 (Sector) - 원의 중심과 호로 이루어진 영역
 */
export class Sector extends GeoObject {
    constructor(circleId, startPointId, endPointId, mode = 'minor', params = {}) {
        super(ObjectType.SECTOR, params);
        this.circleId = circleId;
        this.startPointId = startPointId;
        this.endPointId = endPointId;
        this.mode = mode;

        // 채움 스타일
        this.fillColor = params.fillColor || '#22c55e';
        this.fillOpacity = params.fillOpacity ?? 0.3;

        this.addDependency(circleId);
        this.addDependency(startPointId);
        this.addDependency(endPointId);

        this.center = null;
        this.radius = 0;
        this.startAngle = 0;
        this.endAngle = 0;
    }

    update(objectManager) {
        const circle = objectManager.getObject(this.circleId);
        const startPoint = objectManager.getObject(this.startPointId);
        const endPoint = objectManager.getObject(this.endPointId);

        if (!circle || !startPoint || !endPoint ||
            !circle.valid || !startPoint.valid || !endPoint.valid) {
            this.valid = false;
            return;
        }

        this.center = circle.getCenter();
        this.radius = circle.getRadius();

        const startPos = startPoint.getPosition();
        const endPos = endPoint.getPosition();

        this.startAngle = Math.atan2(startPos.y - this.center.y, startPos.x - this.center.x);
        this.endAngle = Math.atan2(endPos.y - this.center.y, endPos.x - this.center.x);

        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid || !this.center) return;

        const ctx = canvas.ctx;
        const screenCenter = canvas.toScreen(this.center);
        const screenRadius = canvas.toScreenLength(this.radius);

        let startAngle = this.startAngle;
        let endAngle = this.endAngle;
        let counterclockwise = false;

        let angleDiff = endAngle - startAngle;
        if (angleDiff < 0) angleDiff += Math.PI * 2;

        // minor: 짧은 부채꼴, major: 긴 부채꼴
        if (this.mode === 'major') {
            counterclockwise = angleDiff < Math.PI;
        } else {
            counterclockwise = angleDiff > Math.PI;
        }
        // 화면 좌표계 y축 반전 보정
        counterclockwise = !counterclockwise;

        ctx.beginPath();
        ctx.moveTo(screenCenter.x, screenCenter.y);
        ctx.arc(screenCenter.x, screenCenter.y, screenRadius,
            -startAngle, -endAngle, counterclockwise);
        ctx.closePath();

        // 채움
        ctx.fillStyle = this.hexToRgba(this.fillColor, this.fillOpacity);
        ctx.fill();

        // 테두리
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        if (this.dashed) {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // 라벨
        if (this.showLabel && this.label) {
            const midAngle = (startAngle + endAngle) / 2;
            const labelPos = new Vec2(
                this.center.x + this.radius * 0.5 * Math.cos(midAngle),
                this.center.y + this.radius * 0.5 * Math.sin(midAngle)
            );
            canvas.drawLabel(labelPos, this.label, { color: this.color });
        }
    }

    hexToRgba(hex, opacity) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid || !this.center) return false;

        const dist = point.distanceTo(this.center);
        if (dist > this.radius) return false;

        const angle = Math.atan2(point.y - this.center.y, point.x - this.center.x);
        return this.isAngleInSector(angle);
    }

    isAngleInSector(angle) {
        let start = this.startAngle;
        let end = this.endAngle;

        while (start < 0) start += Math.PI * 2;
        while (end < 0) end += Math.PI * 2;
        while (angle < 0) angle += Math.PI * 2;

        let angleDiff = end - start;
        if (angleDiff < 0) angleDiff += Math.PI * 2;

        let testDiff = angle - start;
        if (testDiff < 0) testDiff += Math.PI * 2;

        if (this.mode === 'major') {
            return testDiff > angleDiff || angleDiff > Math.PI;
        } else {
            return testDiff < angleDiff;
        }
    }

    isDraggable() {
        return false;
    }

    getIconClass() {
        return 'circle';
    }

    getTypeName() {
        return '부채꼴';
    }

    toJSON() {
        return {
            ...super.toJSON(),
            circleId: this.circleId,
            startPointId: this.startPointId,
            endPointId: this.endPointId,
            mode: this.mode,
            fillColor: this.fillColor,
            fillOpacity: this.fillOpacity
        };
    }
}

/**
 * 활꼴 (Circular Segment) - 호와 현으로 둘러싸인 영역
 */
export class CircularSegment extends GeoObject {
    constructor(circleId, startPointId, endPointId, mode = 'minor', params = {}) {
        super(ObjectType.CIRCULAR_SEGMENT, params);
        this.circleId = circleId;
        this.startPointId = startPointId;
        this.endPointId = endPointId;
        this.mode = mode;

        this.fillColor = params.fillColor || '#3b82f6';
        this.fillOpacity = params.fillOpacity ?? 0.3;

        this.addDependency(circleId);
        this.addDependency(startPointId);
        this.addDependency(endPointId);

        this.center = null;
        this.radius = 0;
        this.startAngle = 0;
        this.endAngle = 0;
        this.startPos = null;
        this.endPos = null;
    }

    update(objectManager) {
        const circle = objectManager.getObject(this.circleId);
        const startPoint = objectManager.getObject(this.startPointId);
        const endPoint = objectManager.getObject(this.endPointId);

        if (!circle || !startPoint || !endPoint ||
            !circle.valid || !startPoint.valid || !endPoint.valid) {
            this.valid = false;
            return;
        }

        this.center = circle.getCenter();
        this.radius = circle.getRadius();

        this.startPos = startPoint.getPosition();
        this.endPos = endPoint.getPosition();

        this.startAngle = Math.atan2(this.startPos.y - this.center.y, this.startPos.x - this.center.x);
        this.endAngle = Math.atan2(this.endPos.y - this.center.y, this.endPos.x - this.center.x);

        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid || !this.center) return;

        const ctx = canvas.ctx;
        const screenCenter = canvas.toScreen(this.center);
        const screenRadius = canvas.toScreenLength(this.radius);
        const screenStart = canvas.toScreen(this.startPos);
        const screenEnd = canvas.toScreen(this.endPos);

        let startAngle = this.startAngle;
        let endAngle = this.endAngle;
        let counterclockwise = false;

        let angleDiff = endAngle - startAngle;
        if (angleDiff < 0) angleDiff += Math.PI * 2;

        if (this.mode === 'major') {
            counterclockwise = angleDiff < Math.PI;
        } else {
            counterclockwise = angleDiff > Math.PI;
        }
        // 화면 좌표계 y축 반전 보정
        counterclockwise = !counterclockwise;

        // 활꼴 경로: 호 + 현
        ctx.beginPath();
        ctx.moveTo(screenStart.x, screenStart.y);
        ctx.arc(screenCenter.x, screenCenter.y, screenRadius,
            -startAngle, -endAngle, counterclockwise);
        ctx.lineTo(screenStart.x, screenStart.y);
        ctx.closePath();

        // 채움
        ctx.fillStyle = this.hexToRgba(this.fillColor, this.fillOpacity);
        ctx.fill();

        // 테두리
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        if (this.dashed) {
            ctx.setLineDash([5, 5]);
        } else {
            ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // 라벨
        if (this.showLabel && this.label) {
            const midAngle = (startAngle + endAngle) / 2;
            const labelPos = new Vec2(
                this.center.x + this.radius * 0.7 * Math.cos(midAngle),
                this.center.y + this.radius * 0.7 * Math.sin(midAngle)
            );
            canvas.drawLabel(labelPos, this.label, { color: this.color });
        }
    }

    hexToRgba(hex, opacity) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    hitTest(point, threshold, canvas) {
        // 간단한 구현: 부채꼴과 비슷하게 처리
        if (!this.valid || !this.center) return false;

        const dist = point.distanceTo(this.center);
        if (dist > this.radius) return false;

        const angle = Math.atan2(point.y - this.center.y, point.x - this.center.x);

        // 현 아래인지 확인 (간소화)
        return this.isAngleInSegment(angle);
    }

    isAngleInSegment(angle) {
        let start = this.startAngle;
        let end = this.endAngle;

        while (start < 0) start += Math.PI * 2;
        while (end < 0) end += Math.PI * 2;
        while (angle < 0) angle += Math.PI * 2;

        let angleDiff = end - start;
        if (angleDiff < 0) angleDiff += Math.PI * 2;

        let testDiff = angle - start;
        if (testDiff < 0) testDiff += Math.PI * 2;

        if (this.mode === 'major') {
            return testDiff > angleDiff || angleDiff > Math.PI;
        } else {
            return testDiff < angleDiff;
        }
    }

    isDraggable() {
        return false;
    }

    getIconClass() {
        return 'circle';
    }

    getTypeName() {
        return '활꼴';
    }

    toJSON() {
        return {
            ...super.toJSON(),
            circleId: this.circleId,
            startPointId: this.startPointId,
            endPointId: this.endPointId,
            mode: this.mode,
            fillColor: this.fillColor,
            fillOpacity: this.fillOpacity
        };
    }
}

export default { Arc, Sector, CircularSegment };
