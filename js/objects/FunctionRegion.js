/** An editable area bounded by two function graphs, or a graph and y = baselineY. */
import { DEFAULT_OBJECT_COLOR, GeoObject, ObjectType } from './GeoObject.js';
import { Geometry, Vec2 } from '../utils/Geometry.js';

export class FunctionRegion extends GeoObject {
    constructor(function1Id, function2Id, xMin, xMax, params = {}) {
        super(ObjectType.FUNCTION_REGION, { showLabel: false, ...params });
        this.function1Id = function1Id;
        this.function2Id = function2Id || null;
        this.xMin = xMin;
        this.xMax = xMax;
        this.baselineY = params.baselineY ?? 0;
        this.fillColor = params.fillColor || DEFAULT_OBJECT_COLOR;
        this.fillOpacity = params.fillOpacity ?? 0.2;
        this.function1 = null;
        this.function2 = null;
        this.pathPoints = [];
        this.addDependency(function1Id);
        if (this.function2Id) this.addDependency(this.function2Id);
    }

    update(objectManager) {
        this.function1 = objectManager.getObject(this.function1Id);
        this.function2 = this.function2Id ? objectManager.getObject(this.function2Id) : null;
        const first = this.function1;
        const second = this.function2;
        this.valid = Boolean(first?.valid && typeof first.evaluate === 'function' &&
            (!this.function2Id || (second?.valid && typeof second.evaluate === 'function')) &&
            Number.isFinite(this.xMin) && Number.isFinite(this.xMax) && this.xMin < this.xMax &&
            Number.isFinite(this.baselineY) && this.fillOpacity >= 0 && this.fillOpacity <= 1 &&
            this.inDomain(first) && (!second || this.inDomain(second)));
        if (!this.valid) {
            this.pathPoints = [];
            return;
        }
        this.pathPoints = this.getPathPoints(64);
        this.valid = this.pathPoints.length >= 4 &&
            this.pathPoints.some((point, i) => i < this.pathPoints.length / 2 &&
                Math.abs(point.y - this.pathPoints[this.pathPoints.length - 1 - i].y) > 1e-10);
        if (!this.valid) this.pathPoints = [];
    }

    inDomain(graph) {
        return (graph.xMin === null || this.xMin >= graph.xMin - 1e-9) &&
            (graph.xMax === null || this.xMax <= graph.xMax + 1e-9);
    }

    getPathPoints(scale = 64) {
        if (!this.function1 || (this.function2Id && !this.function2)) return [];
        const count = Math.min(2048, Math.max(64, Math.ceil((this.xMax - this.xMin) * scale / 2)));
        const upper = [], lower = [], firstValues = [], secondValues = [];
        for (let i = 0; i <= count; i++) {
            const x = this.xMin + (this.xMax - this.xMin) * i / count;
            const a = this.function1.evaluate(x);
            const b = this.function2 ? this.function2.evaluate(x) : this.baselineY;
            if (!Number.isFinite(a) || !Number.isFinite(b) ||
                !this.function1.isPointWithinVisibleRange(x, a) ||
                (this.function2 && !this.function2.isPointWithinVisibleRange(x, b))) return [];
            upper.push(new Vec2(x, a));
            lower.push(new Vec2(x, b));
            firstValues.push(a);
            secondValues.push(b);
        }
        if (hasSampledPole(firstValues) || (this.function2 && hasSampledPole(secondValues))) return [];
        return [...upper, ...lower.reverse()];
    }

    render(canvas) {
        if (!this.visible || !this.valid || this.fillOpacity <= 0) return;
        const points = this.getPathPoints(canvas.scale);
        if (points.length < 4) return;
        this.pathPoints = points;
        const ctx = canvas.ctx;
        ctx.save();
        ctx.beginPath();
        const first = canvas.toScreen(points[0]);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < points.length; i++) {
            const p = canvas.toScreen(points[i]);
            ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.globalAlpha *= this.fillOpacity;
        ctx.fillStyle = this.fillColor;
        ctx.fill();
        ctx.restore();
        // The x bounds are part of the mathematical region. Draw their short
        // boundary segments so an area under an unbounded graph has clear ends.
        const last = points.length - 1;
        const half = points.length / 2;
        ctx.save();
        ctx.strokeStyle = this.color;
        ctx.lineWidth = Math.max(1, this.lineWidth - 1);
        ctx.beginPath();
        for (const [a, b] of [[points[0], points[last]], [points[half - 1], points[half]]]) {
            const start = canvas.toScreen(a), end = canvas.toScreen(b);
            if (Math.hypot(start.x - end.x, start.y - end.y) < 1) continue;
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
        }
        if (!this.function2 && this.baselineY !== 0) {
            const start = canvas.toScreen(new Vec2(this.xMin, this.baselineY));
            const end = canvas.toScreen(new Vec2(this.xMax, this.baselineY));
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
        }
        ctx.stroke();
        ctx.restore();
    }

    hitTest(point) {
        return this.valid && this.pathPoints.length >= 4 &&
            Geometry.pointInPolygon(point, this.pathPoints);
    }

    isDraggable() { return false; }
    getIconClass() { return 'polygon'; }
    getTypeName() { return '함수 사이 영역'; }

    toJSON() {
        return {
            ...super.toJSON(), function1Id: this.function1Id, function2Id: this.function2Id,
            xMin: this.xMin, xMax: this.xMax, baselineY: this.baselineY,
            fillColor: this.fillColor, fillOpacity: this.fillOpacity
        };
    }
}

function hasSampledPole(values) {
    const magnitudes = values.map(Math.abs);
    const sorted = magnitudes.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const signThreshold = Math.max(10, median * 5);
    const spikeThreshold = Math.max(100, median * 50);
    for (let i = 1; i < values.length; i++) {
        if (values[i - 1] * values[i] < 0 &&
            Math.min(magnitudes[i - 1], magnitudes[i]) > signThreshold) return true;
        const larger = Math.max(magnitudes[i - 1], magnitudes[i]);
        const smaller = Math.max(1e-9, Math.min(magnitudes[i - 1], magnitudes[i]));
        if (larger > spikeThreshold && larger / smaller > 4) return true;
    }
    return false;
}
