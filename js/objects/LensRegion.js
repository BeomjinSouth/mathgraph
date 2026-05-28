/**
 * LensRegion.js - filled intersection region of two circles.
 */

import { DEFAULT_OBJECT_COLOR, GeoObject, ObjectType } from './GeoObject.js';
import { Geometry, Vec2 } from '../utils/Geometry.js';
import { MathUtils } from '../utils/MathUtils.js';

const TWO_PI = Math.PI * 2;
const DEFAULT_SAMPLES_PER_ARC = 64;

export class LensRegion extends GeoObject {
    constructor(circle1Id, circle2Id, params = {}) {
        super(ObjectType.LENS_REGION, { showLabel: false, ...params });
        this.circle1Id = circle1Id;
        this.circle2Id = circle2Id;
        this.fillColor = params.fillColor || DEFAULT_OBJECT_COLOR;
        this.fillOpacity = params.fillOpacity ?? 0.24;
        this.samplesPerArc = Number.isFinite(params.samplesPerArc)
            ? Math.max(12, Math.floor(params.samplesPerArc))
            : DEFAULT_SAMPLES_PER_ARC;

        this.addDependency(circle1Id);
        this.addDependency(circle2Id);

        this.center1 = null;
        this.center2 = null;
        this.radius1 = 0;
        this.radius2 = 0;
        this.intersections = [];
        this.pathPoints = [];
        this.arc1Direction = 'ccw';
        this.arc2Direction = 'ccw';
    }

    update(objectManager) {
        const circle1 = objectManager.getObject(this.circle1Id);
        const circle2 = objectManager.getObject(this.circle2Id);

        if (!isCircleLike(circle1) || !isCircleLike(circle2)) {
            this.valid = false;
            this.pathPoints = [];
            return;
        }

        this.center1 = circle1.getCenter();
        this.center2 = circle2.getCenter();
        this.radius1 = circle1.getRadius();
        this.radius2 = circle2.getRadius();

        if (!Number.isFinite(this.radius1) || !Number.isFinite(this.radius2) ||
            this.radius1 <= MathUtils.EPSILON || this.radius2 <= MathUtils.EPSILON) {
            this.valid = false;
            this.pathPoints = [];
            return;
        }

        const intersections = Geometry.circleCircleIntersection(
            this.center1,
            this.radius1,
            this.center2,
            this.radius2
        );

        if (intersections.length !== 2 || intersections[0].distanceTo(intersections[1]) <= MathUtils.EPSILON) {
            this.valid = false;
            this.pathPoints = [];
            return;
        }

        const [start, end] = orderIntersections(intersections[0], intersections[1]);
        const start1 = angleFrom(this.center1, start);
        const end1 = angleFrom(this.center1, end);
        const start2 = angleFrom(this.center2, end);
        const end2 = angleFrom(this.center2, start);

        this.arc1Direction = chooseInsideArcDirection(
            this.center1,
            this.radius1,
            start1,
            end1,
            this.center2,
            this.radius2
        );
        this.arc2Direction = chooseInsideArcDirection(
            this.center2,
            this.radius2,
            start2,
            end2,
            this.center1,
            this.radius1
        );

        const arc1 = sampleArc(this.center1, this.radius1, start1, end1, this.arc1Direction, this.samplesPerArc);
        const arc2 = sampleArc(this.center2, this.radius2, start2, end2, this.arc2Direction, this.samplesPerArc);
        this.intersections = [start, end];
        this.pathPoints = [...arc1, ...arc2.slice(1)];
        this.valid = this.pathPoints.length >= 4;
    }

    render(canvas) {
        if (!this.visible || !this.valid || this.pathPoints.length < 3) return;

        canvas.drawPolygon(this.pathPoints, {
            strokeColor: this.color,
            fillColor: this.hexToRgba(this.fillColor, this.fillOpacity),
            width: this.lineWidth,
            dashed: this.dashed,
            close: true
        });

        if (this.selected || this.highlighted) {
            canvas.drawPolygon(this.pathPoints, {
                strokeColor: this.highlighted ? '#f97316' : '#6366f1',
                fillColor: null,
                width: Math.max(3, this.lineWidth + 2),
                dashed: false,
                close: true
            });
        }

        if (this.showLabel && this.label) {
            const center = Geometry.polygonCentroid(this.pathPoints);
            canvas.drawLabel(center, this.label, {
                fontSize: this.fontSize,
                color: this.color,
                backgroundColor: 'rgba(255, 255, 255, 0.8)'
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid || this.pathPoints.length < 3) return false;

        if (Geometry.pointInPolygon(point, this.pathPoints)) {
            return true;
        }

        const tol = canvas?.toMathLength ? canvas.toMathLength(threshold) : threshold;
        for (let i = 0; i < this.pathPoints.length; i++) {
            const next = (i + 1) % this.pathPoints.length;
            if (Geometry.pointToSegmentDistance(point, this.pathPoints[i], this.pathPoints[next]) <= tol) {
                return true;
            }
        }

        return false;
    }

    isDraggable() {
        return false;
    }

    getIconClass() {
        return 'circle';
    }

    getTypeName() {
        return 'Lens Region';
    }

    hexToRgba(hex, opacity) {
        if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) {
            return hex || `rgba(0, 0, 0, ${opacity})`;
        }

        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            circle1Id: this.circle1Id,
            circle2Id: this.circle2Id,
            fillColor: this.fillColor,
            fillOpacity: this.fillOpacity
        };
    }
}

function isCircleLike(object) {
    return object &&
        object.valid &&
        typeof object.getCenter === 'function' &&
        typeof object.getRadius === 'function';
}

function orderIntersections(a, b) {
    if (Math.abs(a.y - b.y) > MathUtils.EPSILON) {
        return a.y > b.y ? [a, b] : [b, a];
    }
    return a.x <= b.x ? [a, b] : [b, a];
}

function angleFrom(center, point) {
    return Math.atan2(point.y - center.y, point.x - center.x);
}

function normalizeAngle(angle) {
    let normalized = angle % TWO_PI;
    if (normalized < 0) normalized += TWO_PI;
    return normalized;
}

function sweepBetween(startAngle, endAngle, direction) {
    const start = normalizeAngle(startAngle);
    const end = normalizeAngle(endAngle);
    if (direction === 'cw') {
        return -((start - end + TWO_PI) % TWO_PI || TWO_PI);
    }
    return (end - start + TWO_PI) % TWO_PI || TWO_PI;
}

function pointOnCircle(center, radius, angle) {
    return new Vec2(
        center.x + radius * Math.cos(angle),
        center.y + radius * Math.sin(angle)
    );
}

function chooseInsideArcDirection(center, radius, startAngle, endAngle, otherCenter, otherRadius) {
    const ccwSweep = sweepBetween(startAngle, endAngle, 'ccw');
    const cwSweep = sweepBetween(startAngle, endAngle, 'cw');
    const ccwMid = pointOnCircle(center, radius, startAngle + ccwSweep / 2);
    const cwMid = pointOnCircle(center, radius, startAngle + cwSweep / 2);

    const ccwDistance = ccwMid.distanceTo(otherCenter);
    const cwDistance = cwMid.distanceTo(otherCenter);
    const ccwInside = ccwDistance <= otherRadius + MathUtils.EPSILON;
    const cwInside = cwDistance <= otherRadius + MathUtils.EPSILON;

    if (ccwInside !== cwInside) {
        return ccwInside ? 'ccw' : 'cw';
    }

    return ccwDistance <= cwDistance ? 'ccw' : 'cw';
}

function sampleArc(center, radius, startAngle, endAngle, direction, samples) {
    const sweep = sweepBetween(startAngle, endAngle, direction);
    const points = [];

    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        points.push(pointOnCircle(center, radius, startAngle + sweep * t));
    }

    return points;
}

export default LensRegion;
