/**
 * Marker.js - 표식 객체들
 * 직각 표시, 같은 길이 표시
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2, Geometry } from '../utils/Geometry.js';

/**
 * 직각 표시 (Right Angle Marker)
 */
export class RightAngleMarker extends GeoObject {
    constructor(vertexId, line1Id, line2Id, params = {}) {
        super(ObjectType.RIGHT_ANGLE_MARKER, params);
        this.vertexId = vertexId;
        this.line1Id = line1Id;
        this.line2Id = line2Id;
        this.size = params.size || 12;
        this.addDependency(vertexId);
        this.addDependency(line1Id);
        this.addDependency(line2Id);

        this._vertex = new Vec2(0, 0);
        this._dir1 = new Vec2(1, 0);
        this._dir2 = new Vec2(0, 1);
    }

    update(objectManager) {
        const vertexObj = objectManager.getObject(this.vertexId);
        const line1 = objectManager.getObject(this.line1Id);
        const line2 = objectManager.getObject(this.line2Id);

        if (!vertexObj || !line1 || !line2 ||
            !vertexObj.valid || !line1.valid || !line2.valid) {
            this.valid = false;
            return;
        }

        this._vertex = vertexObj.getPosition();

        // 각 선에서 정점을 향하는 방향 계산
        const p1 = line1.getPoint1();
        const p2 = line1.getPoint2();
        const p3 = line2.getPoint1();
        const p4 = line2.getPoint2();

        // 정점에서 멀어지는 방향
        let dir1 = p2.sub(p1).normalize();
        let dir2 = p4.sub(p3).normalize();

        // 정점 기준 방향 조정
        if (this._vertex.distanceTo(p2) < this._vertex.distanceTo(p1)) {
            dir1 = dir1.mul(-1);
        }
        if (this._vertex.distanceTo(p4) < this._vertex.distanceTo(p3)) {
            dir2 = dir2.mul(-1);
        }

        this._dir1 = dir1;
        this._dir2 = dir2;
        this.valid = p1.distanceTo(p2) > 1e-9 && p3.distanceTo(p4) > 1e-9 &&
            Math.abs(dir1.dot(dir2)) < 1e-7;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        const p1 = this._vertex.add(this._dir1);
        const p2 = this._vertex.add(this._dir2);

        canvas.drawRightAngleMarker(this._vertex, p1, p2, {
            size: this.size,
            color: this.selected ? '#f97316' : this.highlighted ? '#fbbf24' : this.color,
            lineWidth: this.lineWidth
        });
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);
        const dist = point.distanceTo(this._vertex);
        return dist <= this.size / canvas.scale + screenThreshold;
    }

    isDraggable() {
        return false;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            vertexId: this.vertexId,
            line1Id: this.line1Id,
            line2Id: this.line2Id,
            size: this.size
        };
    }
}

/**
 * 같은 길이 표시 (Equal Length Marker)
 */
export class EqualLengthMarker extends GeoObject {
    constructor(segment1Id, segment2Id, params = {}) {
        super(ObjectType.EQUAL_LENGTH_MARKER, params);
        this.segment1Id = segment1Id;
        this.segment2Id = segment2Id;
        this.tickCount = Math.max(1, Math.round(Number(params.tickCount) || 1));
        this.size = params.size || 8;
        this.addDependency(segment1Id);
        this.addDependency(segment2Id);

        this._seg1Start = new Vec2(0, 0);
        this._seg1End = new Vec2(0, 0);
        this._seg2Start = new Vec2(0, 0);
        this._seg2End = new Vec2(0, 0);
    }

    update(objectManager) {
        const seg1 = objectManager.getObject(this.segment1Id);
        const seg2 = objectManager.getObject(this.segment2Id);

        if (!seg1 || !seg2 || !seg1.valid || !seg2.valid) {
            this.valid = false;
            return;
        }

        this._seg1Start = seg1.getPoint1();
        this._seg1End = seg1.getPoint2();
        this._seg2Start = seg2.getPoint1();
        this._seg2End = seg2.getPoint2();
        this.valid = this._seg1Start.distanceTo(this._seg1End) > 1e-9 &&
            this._seg2Start.distanceTo(this._seg2End) > 1e-9;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        // 첫 번째 선분에 틱 마크
        canvas.drawEqualLengthMarker(this._seg1Start, this._seg1End, {
            tickCount: this.tickCount,
            size: this.size,
            color: this.color,
            lineWidth: this.lineWidth
        });

        // 두 번째 선분에 틱 마크
        canvas.drawEqualLengthMarker(this._seg2Start, this._seg2End, {
            tickCount: this.tickCount,
            size: this.size,
            color: this.color,
            lineWidth: this.lineWidth
        });
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);

        // 각 선분의 중간점 근처인지 확인
        const mid1 = Geometry.midpoint(this._seg1Start, this._seg1End);
        const mid2 = Geometry.midpoint(this._seg2Start, this._seg2End);

        const dist1 = point.distanceTo(mid1);
        const dist2 = point.distanceTo(mid2);

        return dist1 <= screenThreshold + this.size / canvas.scale ||
            dist2 <= screenThreshold + this.size / canvas.scale;
    }

    isDraggable() {
        return false;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            segment1Id: this.segment1Id,
            segment2Id: this.segment2Id,
            tickCount: this.tickCount,
            size: this.size
        };
    }
}

/** Two equally directed chevrons describe an explicitly supplied parallel relation. */
export class ParallelMarker extends EqualLengthMarker {
    constructor(segment1Id, segment2Id, params = {}) {
        super(segment1Id, segment2Id, params);
        this.type = ObjectType.PARALLEL_MARKER;
    }

    getMarkerPaths(canvas) {
        if (!this.valid) return [];
        const paths = [];
        const reference = this._seg1End.sub(this._seg1Start).normalize();
        for (const [start, end] of [[this._seg1Start, this._seg1End], [this._seg2Start, this._seg2End]]) {
            const mid = canvas.toScreen(Geometry.midpoint(start, end));
            let direction = end.sub(start).normalize();
            if (direction.dot(reference) < 0) direction = direction.mul(-1);
            const dx = direction.x, dy = -direction.y;
            for (let i = 0; i < this.tickCount; i++) {
                const offset = (i - (this.tickCount - 1) / 2) * (this.size * 0.8 + this.lineWidth);
                const x = mid.x + dx * offset, y = mid.y + dy * offset;
                paths.push([
                    new Vec2(x - dx * this.size / 2 - dy * this.size / 2, y - dy * this.size / 2 + dx * this.size / 2),
                    new Vec2(x + dx * this.size / 2, y + dy * this.size / 2),
                    new Vec2(x - dx * this.size / 2 + dy * this.size / 2, y - dy * this.size / 2 - dx * this.size / 2)
                ]);
            }
        }
        return paths;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;
        const ctx = canvas.ctx;
        ctx.save();
        ctx.setLineDash([]);
        ctx.strokeStyle = this.selected ? '#f97316' : this.highlighted ? '#fbbf24' : this.color;
        ctx.lineWidth = this.lineWidth;
        for (const [a, b, c] of this.getMarkerPaths(canvas)) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.lineTo(c.x, c.y);
            ctx.stroke();
        }
        ctx.restore();
    }

    hitTest(point, threshold, canvas) {
        const screen = canvas.toScreen(point);
        return this.getMarkerPaths(canvas).some(([a, b, c]) =>
            Math.min(Geometry.pointToSegmentDistance(screen, a, b), Geometry.pointToSegmentDistance(screen, b, c)) <= threshold);
    }

    getTypeName() { return '평행 표시'; }
}

export default { RightAngleMarker, EqualLengthMarker, ParallelMarker };
