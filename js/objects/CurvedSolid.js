/**
 * CurvedSolid.js - 원기둥·원뿔·구의 편집 가능한 교과서식 투영 객체
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2 } from '../utils/Geometry.js';

const CURVED_SOLID_TYPES = new Set([
    ObjectType.CYLINDER,
    ObjectType.CONE,
    ObjectType.SPHERE
]);

export class CurvedSolid extends GeoObject {
    constructor(kind = ObjectType.CYLINDER, options = {}) {
        const type = CURVED_SOLID_TYPES.has(kind) ? kind : ObjectType.CYLINDER;
        super(type, {
            showLabel: false,
            ...options
        });

        this.position = new Vec2(
            Number.isFinite(options.x) ? options.x : 0,
            Number.isFinite(options.y) ? options.y : 0
        );
        this.width = Number.isFinite(options.width) ? options.width : 4;
        this.height = Number.isFinite(options.height) ? options.height : (type === ObjectType.SPHERE ? this.width : 6);
        this.ellipseRatio = Number.isFinite(options.ellipseRatio) ? options.ellipseRatio : 0.28;
        this.showHiddenLines = options.showHiddenLines !== false;
        this.update();
    }

    update() {
        this.width = Math.abs(Number(this.width));
        this.height = Math.abs(Number(this.height));
        this.ellipseRatio = Math.min(0.6, Math.max(0.12, Number(this.ellipseRatio) || 0.28));
        this.valid = CURVED_SOLID_TYPES.has(this.type) &&
            Number.isFinite(this.position.x) && Number.isFinite(this.position.y) &&
            this.width > 0 && this.height > 0;
    }

    setDash(ctx, dashed) {
        ctx.setLineDash(dashed ? [5, 4] : []);
    }

    strokeEllipse(ctx, x, y, rx, ry, startAngle, endAngle, dashed = false) {
        this.setDash(ctx, dashed);
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, startAngle, endAngle);
        ctx.stroke();
        this.setDash(ctx, false);
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        const ctx = canvas.ctx;
        const center = canvas.toScreen(this.position);
        const rx = canvas.toScreenLength(this.width / 2);
        const halfHeight = canvas.toScreenLength(this.height / 2);
        const ry = Math.max(3, rx * this.ellipseRatio);

        ctx.strokeStyle = this.highlighted || this.selected ? '#f97316' : this.color;
        ctx.fillStyle = this.color;
        ctx.lineWidth = this.highlighted || this.selected ? Math.max(3, this.lineWidth + 1) : this.lineWidth;

        if (this.type === ObjectType.CYLINDER) {
            this.renderCylinder(ctx, center, rx, ry, halfHeight);
        } else if (this.type === ObjectType.CONE) {
            this.renderCone(ctx, center, rx, ry, halfHeight);
        } else {
            this.renderSphere(ctx, center, rx, ry);
        }

        this.setDash(ctx, false);
        if (this.showLabel && this.label) {
            canvas.drawLabel(this.position, this.label, { fontSize: this.fontSize, color: this.color });
        }
    }

    renderCylinder(ctx, center, rx, ry, halfHeight) {
        const topY = center.y - halfHeight + ry;
        const bottomY = center.y + halfHeight - ry;

        this.strokeEllipse(ctx, center.x, topY, rx, ry, 0, Math.PI * 2, false);
        if (this.showHiddenLines) {
            this.strokeEllipse(ctx, center.x, bottomY, rx, ry, Math.PI, Math.PI * 2, true);
        }
        this.strokeEllipse(ctx, center.x, bottomY, rx, ry, 0, Math.PI, false);

        this.setDash(ctx, false);
        ctx.beginPath();
        ctx.moveTo(center.x - rx, topY);
        ctx.lineTo(center.x - rx, bottomY);
        ctx.moveTo(center.x + rx, topY);
        ctx.lineTo(center.x + rx, bottomY);
        ctx.stroke();
    }

    renderCone(ctx, center, rx, ry, halfHeight) {
        const apexY = center.y - halfHeight;
        const baseY = center.y + halfHeight - ry;

        this.setDash(ctx, false);
        ctx.beginPath();
        ctx.moveTo(center.x, apexY);
        ctx.lineTo(center.x - rx, baseY);
        ctx.moveTo(center.x, apexY);
        ctx.lineTo(center.x + rx, baseY);
        ctx.stroke();

        if (this.showHiddenLines) {
            this.strokeEllipse(ctx, center.x, baseY, rx, ry, Math.PI, Math.PI * 2, true);
        }
        this.strokeEllipse(ctx, center.x, baseY, rx, ry, 0, Math.PI, false);
    }

    renderSphere(ctx, center, rx, ellipseRy) {
        const radius = Math.min(rx, canvasSafeRadius(rx));
        this.setDash(ctx, false);
        ctx.beginPath();
        ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (this.showHiddenLines) {
            this.strokeEllipse(ctx, center.x, center.y, radius, ellipseRy, Math.PI, Math.PI * 2, true);
        }
        this.strokeEllipse(ctx, center.x, center.y, radius, ellipseRy, 0, Math.PI, false);
    }

    getPosition() {
        return this.position.clone();
    }

    containsPoint(point) {
        const dx = Math.abs(Number(point?.x) - this.position.x);
        const dy = Math.abs(Number(point?.y) - this.position.y);
        return Number.isFinite(dx) && Number.isFinite(dy) &&
            dx <= this.width / 2 && dy <= this.height / 2;
    }
    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;
        const screenPoint = canvas.toScreen(point);
        const center = canvas.toScreen(this.position);
        const halfWidth = canvas.toScreenLength(this.width / 2) + threshold;
        const halfHeight = canvas.toScreenLength(this.height / 2) + threshold;
        return Math.abs(screenPoint.x - center.x) <= halfWidth &&
            Math.abs(screenPoint.y - center.y) <= halfHeight;
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
            width: this.width,
            height: this.height,
            ellipseRatio: this.ellipseRatio,
            showHiddenLines: this.showHiddenLines
        };
    }
}

function canvasSafeRadius(value) {
    return Math.max(1, value);
}

export default CurvedSolid;
