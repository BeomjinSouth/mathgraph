/**
 * Conic.js - 타원·쌍곡선·포물선 일급 객체
 */

import { DEFAULT_OBJECT_COLOR, GeoObject, ObjectType } from './GeoObject.js';
import { Vec2 } from '../utils/Geometry.js';

const HYPERBOLA_ORIENTATIONS = new Set(['horizontal', 'vertical']);
const PARABOLA_ORIENTATIONS = new Set(['right', 'left', 'up', 'down']);

function finiteNumber(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function visibleRadius(bounds, center) {
    const corners = [
        new Vec2(bounds.minX, bounds.minY),
        new Vec2(bounds.minX, bounds.maxY),
        new Vec2(bounds.maxX, bounds.minY),
        new Vec2(bounds.maxX, bounds.maxY)
    ];
    return Math.max(1, ...corners.map(corner => corner.distanceTo(center)));
}

function hexToRgba(hex, opacity) {
    if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) {
        return hex || `rgba(0, 0, 0, ${opacity})`;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

class ConicBase extends GeoObject {
    constructor(type, params = {}) {
        super(type, params);
        this.position = new Vec2(
            finiteNumber(params.x),
            finiteNumber(params.y)
        );
        this.rotation = finiteNumber(params.rotation);
    }

    update() {
        this.valid = Number.isFinite(this.position.x) &&
            Number.isFinite(this.position.y) &&
            Number.isFinite(this.rotation) &&
            this.hasValidParameters();
    }

    hasValidParameters() {
        return false;
    }

    toWorld(u, v) {
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        return new Vec2(
            this.position.x + u * cos - v * sin,
            this.position.y + u * sin + v * cos
        );
    }

    toLocal(point) {
        const dx = point.x - this.position.x;
        const dy = point.y - this.position.y;
        const cos = Math.cos(this.rotation);
        const sin = Math.sin(this.rotation);
        return new Vec2(
            dx * cos + dy * sin,
            -dx * sin + dy * cos
        );
    }

    getPosition() {
        return this.position.clone();
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        const polylines = this.getPolylines(canvas.getVisibleBounds());
        for (const points of polylines) {
            canvas.drawPolyline(points, {
                color: this.color,
                width: this.lineWidth,
                dashed: this.dashed,
                highlighted: this.highlighted,
                selected: this.selected,
                closed: this.type === ObjectType.ELLIPSE,
                fillColor: this.type === ObjectType.ELLIPSE && this.fillOpacity > 0
                    ? hexToRgba(this.fillColor, this.fillOpacity)
                    : null
            });
        }

        if (this.showLabel && this.label) {
            canvas.drawMathLabel(this.getLabelAnchor(), this.label, {
                fontSize: this.fontSize,
                color: this.color,
                offsetX: this.labelOffset.x,
                offsetY: this.labelOffset.y
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;
        const distance = this.approximateDistance(this.toLocal(point));
        return Number.isFinite(distance) && distance <= canvas.toMathLength(threshold);
    }

    isDraggable() {
        return !this.locked && this.visible;
    }

    startDrag(point) {
        this.dragOffset = this.position.sub(new Vec2(point.x, point.y));
    }

    drag(point) {
        const offset = this.dragOffset || new Vec2(0, 0);
        this.position = new Vec2(point.x + offset.x, point.y + offset.y);
    }

    endDrag() {
        delete this.dragOffset;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            x: this.position.x,
            y: this.position.y,
            rotation: this.rotation,
            labelOffset: { x: this.labelOffset.x, y: this.labelOffset.y }
        };
    }
}

export class Ellipse extends ConicBase {
    constructor(radiusX, radiusY, params = {}) {
        super(ObjectType.ELLIPSE, params);
        this.radiusX = finiteNumber(radiusX, NaN);
        this.radiusY = finiteNumber(radiusY, NaN);
        this.fillColor = params.fillColor || DEFAULT_OBJECT_COLOR;
        this.fillOpacity = Number.isFinite(params.fillOpacity) ? params.fillOpacity : 0;
        this.update();
    }

    hasValidParameters() {
        return Number.isFinite(this.radiusX) && this.radiusX > 0 &&
            Number.isFinite(this.radiusY) && this.radiusY > 0;
    }

    getPolylines(bounds, samples = 240) {
        const points = [];
        for (let i = 0; i <= samples; i++) {
            const angle = Math.PI * 2 * (i / samples);
            points.push(this.toWorld(
                this.radiusX * Math.cos(angle),
                this.radiusY * Math.sin(angle)
            ));
        }
        return [points];
    }

    approximateDistance(localPoint) {
        const u = localPoint.x;
        const v = localPoint.y;
        const value = (u * u) / (this.radiusX * this.radiusX) +
            (v * v) / (this.radiusY * this.radiusY) - 1;
        const gradient = Math.hypot(
            (2 * u) / (this.radiusX * this.radiusX),
            (2 * v) / (this.radiusY * this.radiusY)
        );
        return gradient > 1e-9 ? Math.abs(value) / gradient : Infinity;
    }

    getLabelAnchor() {
        return this.toWorld(this.radiusX * 0.7, this.radiusY * 0.7);
    }

    toJSON() {
        return {
            ...super.toJSON(),
            radiusX: this.radiusX,
            radiusY: this.radiusY,
            fillColor: this.fillColor,
            fillOpacity: this.fillOpacity
        };
    }
}

export class Hyperbola extends ConicBase {
    constructor(a, b, params = {}) {
        super(ObjectType.HYPERBOLA, params);
        this.a = finiteNumber(a, NaN);
        this.b = finiteNumber(b, NaN);
        this.orientation = HYPERBOLA_ORIENTATIONS.has(params.orientation)
            ? params.orientation
            : 'horizontal';
        this.update();
    }

    hasValidParameters() {
        return Number.isFinite(this.a) && this.a > 0 &&
            Number.isFinite(this.b) && this.b > 0 &&
            HYPERBOLA_ORIENTATIONS.has(this.orientation);
    }

    getPolylines(bounds, samples = 260) {
        const radius = visibleRadius(bounds, this.position);
        const scale = Math.max(1e-6, Math.min(this.a, this.b));
        const tLimit = Math.min(8, Math.max(2, Math.acosh(Math.max(1, radius / scale)) + 0.5));
        const branches = [];

        for (const sign of [-1, 1]) {
            const points = [];
            for (let i = 0; i <= samples; i++) {
                const t = -tLimit + (2 * tLimit * i) / samples;
                const transverse = sign * this.a * Math.cosh(t);
                const conjugate = this.b * Math.sinh(t);
                points.push(this.orientation === 'horizontal'
                    ? this.toWorld(transverse, conjugate)
                    : this.toWorld(conjugate, transverse));
            }
            branches.push(points);
        }
        return branches;
    }

    approximateDistance(localPoint) {
        const u = localPoint.x;
        const v = localPoint.y;
        const horizontal = this.orientation === 'horizontal';
        const transverse = horizontal ? u : v;
        const conjugate = horizontal ? v : u;
        const value = (transverse * transverse) / (this.a * this.a) -
            (conjugate * conjugate) / (this.b * this.b) - 1;
        const gradient = Math.hypot(
            (2 * transverse) / (this.a * this.a),
            (2 * conjugate) / (this.b * this.b)
        );
        return gradient > 1e-9 ? Math.abs(value) / gradient : Infinity;
    }

    getLabelAnchor() {
        return this.orientation === 'horizontal'
            ? this.toWorld(this.a, 0)
            : this.toWorld(0, this.a);
    }

    toJSON() {
        return {
            ...super.toJSON(),
            a: this.a,
            b: this.b,
            orientation: this.orientation
        };
    }
}

export class Parabola extends ConicBase {
    constructor(p, params = {}) {
        super(ObjectType.PARABOLA, params);
        this.p = finiteNumber(p, NaN);
        this.orientation = PARABOLA_ORIENTATIONS.has(params.orientation)
            ? params.orientation
            : 'right';
        this.update();
    }

    hasValidParameters() {
        return Number.isFinite(this.p) && this.p > 0 &&
            PARABOLA_ORIENTATIONS.has(this.orientation);
    }

    getPolylines(bounds, samples = 300) {
        const radius = visibleRadius(bounds, this.position);
        const byAxis = Math.sqrt(radius / this.p);
        const byCrossAxis = radius / (2 * this.p);
        const tLimit = Math.min(100, Math.max(2, Math.min(byAxis, byCrossAxis) * 1.25));
        const points = [];

        for (let i = 0; i <= samples; i++) {
            const t = -tLimit + (2 * tLimit * i) / samples;
            const axial = this.p * t * t;
            const cross = 2 * this.p * t;
            switch (this.orientation) {
                case 'left':
                    points.push(this.toWorld(-axial, cross));
                    break;
                case 'up':
                    points.push(this.toWorld(cross, axial));
                    break;
                case 'down':
                    points.push(this.toWorld(cross, -axial));
                    break;
                default:
                    points.push(this.toWorld(axial, cross));
            }
        }
        return [points];
    }

    approximateDistance(localPoint) {
        const u = localPoint.x;
        const v = localPoint.y;
        let value;
        let gradient;

        switch (this.orientation) {
            case 'left':
                value = v * v + 4 * this.p * u;
                gradient = Math.hypot(4 * this.p, 2 * v);
                break;
            case 'up':
                value = u * u - 4 * this.p * v;
                gradient = Math.hypot(2 * u, 4 * this.p);
                break;
            case 'down':
                value = u * u + 4 * this.p * v;
                gradient = Math.hypot(2 * u, 4 * this.p);
                break;
            default:
                value = v * v - 4 * this.p * u;
                gradient = Math.hypot(4 * this.p, 2 * v);
        }
        return gradient > 1e-9 ? Math.abs(value) / gradient : Infinity;
    }

    getLabelAnchor() {
        const offset = Math.max(0.5, this.p * 0.5);
        switch (this.orientation) {
            case 'left': return this.toWorld(-offset, 0);
            case 'up': return this.toWorld(0, offset);
            case 'down': return this.toWorld(0, -offset);
            default: return this.toWorld(offset, 0);
        }
    }

    toJSON() {
        return {
            ...super.toJSON(),
            p: this.p,
            orientation: this.orientation
        };
    }
}

export default { Ellipse, Hyperbola, Parabola };
