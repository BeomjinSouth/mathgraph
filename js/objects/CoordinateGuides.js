import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2, Geometry } from '../utils/Geometry.js';

/** A point dependency keeps projections attached to free and constructed points. */
export class CoordinateGuides extends GeoObject {
    constructor(originId, params = {}) {
        super(ObjectType.COORDINATE_GUIDES, params);
        this.originId = originId;
        this.addDependency(originId);
        this.showX = params.showX !== false;
        this.showY = params.showY !== false;
        this.showValue = params.showValue !== false;
        this.precision = Math.max(0, Math.min(4, Math.round(Number(params.precision) || 0)));
        this.labelFontSize = params.labelFontSize || 14;
        this.position = null;
    }

    update(manager) {
        const point = manager.getObject(this.originId);
        this.position = point?.valid && point.getPosition ? point.getPosition() : null;
        this.valid = !!this.position && Number.isFinite(this.position.x) && Number.isFinite(this.position.y);
    }

    getSegments() {
        if (!this.valid) return [];
        const { x, y } = this.position;
        return [
            ...(this.showX && Math.abs(y) > 1e-9 ? [[this.position, new Vec2(x, 0)]] : []),
            ...(this.showY && Math.abs(x) > 1e-9 ? [[this.position, new Vec2(0, y)]] : [])
        ];
    }

    render(canvas) {
        this._labelBoxes = [];
        if (!this.visible || !this.valid) return;
        const ctx = canvas.ctx;
        ctx.save();
        ctx.strokeStyle = this.selected ? '#f97316' : this.highlighted ? '#fbbf24' : this.color;
        ctx.lineWidth = this.lineWidth;
        ctx.setLineDash([4, 4]);
        for (const [start, end] of this.getSegments()) {
            const a = canvas.toScreen(start), b = canvas.toScreen(end);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        }
        if (this.showValue) {
            ctx.fillStyle = this.color;
            ctx.font = `${this.labelFontSize}px "Times New Roman", serif`;
            const { x, y } = this.position;
            const format = value => Number(value.toFixed(this.precision)).toString();
            const label = (text, px, py) => {
                const width = ctx.measureText(text).width;
                const left = ctx.textAlign === 'center' ? px - width / 2 : ctx.textAlign === 'right' ? px - width : px;
                const top = ctx.textBaseline === 'top' ? py : ctx.textBaseline === 'bottom' ? py - this.labelFontSize : py - this.labelFontSize / 2;
                this._labelBoxes.push({ x: left - 3, y: top - 3, w: width + 6, h: this.labelFontSize + 6 });
                ctx.fillText(text, px, py);
            };
            if (this.showX && Math.abs(x) > 1e-9) {
                const foot = canvas.toScreen(new Vec2(x, 0));
                ctx.textAlign = 'center';
                ctx.textBaseline = y >= 0 ? 'top' : 'bottom';
                label(format(x), foot.x, foot.y + (y >= 0 ? 6 : -6));
            }
            if (this.showY && Math.abs(y) > 1e-9) {
                const foot = canvas.toScreen(new Vec2(0, y));
                ctx.textAlign = x >= 0 ? 'right' : 'left';
                ctx.textBaseline = 'middle';
                label(format(y), foot.x + (x >= 0 ? -6 : 6), foot.y);
            }
        }
        ctx.restore();
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;
        const screen = canvas.toScreen(point);
        if (this._labelBoxes?.some(box => screen.x >= box.x && screen.x <= box.x + box.w &&
            screen.y >= box.y && screen.y <= box.y + box.h)) return true;
        return this.getSegments().some(([a, b]) => Geometry.pointToSegmentDistance(point, a, b) <= canvas.toMathLength(threshold));
    }

    isDraggable() { return false; }
    getTypeName() { return '좌표 보조선'; }
    getIconClass() { return 'marker'; }
    toJSON() {
        return { ...super.toJSON(), originId: this.originId, showX: this.showX,
            showY: this.showY, showValue: this.showValue, precision: this.precision,
            labelFontSize: this.labelFontSize };
    }
}
