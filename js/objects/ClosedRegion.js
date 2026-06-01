/**
 * ClosedRegion.js - filled region inferred from an existing closed segment loop.
 */

import { DEFAULT_OBJECT_COLOR, GeoObject, ObjectType } from './GeoObject.js';
import { Geometry, Vec2 } from '../utils/Geometry.js';

export class ClosedRegion extends GeoObject {
    constructor(vertexIds, boundaryObjectIds = [], params = {}) {
        super(ObjectType.CLOSED_REGION, { showLabel: false, ...params });
        this.vertexIds = Array.isArray(vertexIds) ? [...vertexIds] : [];
        this.boundaryObjectIds = Array.isArray(boundaryObjectIds) ? [...boundaryObjectIds] : [];
        this.staticVertices = Array.isArray(params.vertices)
            ? params.vertices
                .filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y))
                .map(point => new Vec2(point.x, point.y))
            : [];
        this.fillColor = params.fillColor || DEFAULT_OBJECT_COLOR;
        this.fillOpacity = params.fillOpacity ?? 0.24;
        this.lineWidth = params.lineWidth ?? 0;
        this.vertices = [];

        for (const id of this.vertexIds) {
            this.addDependency(id);
        }
        for (const id of this.boundaryObjectIds) {
            this.addDependency(id);
        }
    }

    update(objectManager) {
        this.vertices = [];

        for (const id of this.boundaryObjectIds) {
            const boundary = objectManager.getObject(id);
            if (!boundary || !boundary.valid) {
                this.valid = false;
                return;
            }
        }

        if (this.vertexIds.length > 0) {
            for (const id of this.vertexIds) {
                const point = objectManager.getObject(id);
                if (!point || !point.valid || typeof point.getPosition !== 'function') {
                    this.valid = false;
                    return;
                }
                this.vertices.push(point.getPosition());
            }
        } else {
            this.vertices = this.staticVertices.map(vertex => vertex.clone());
        }

        this.valid = this.vertices.length >= 3 && Geometry.polygonArea(this.vertices) > 1e-8;
    }

    render(canvas) {
        if (!this.visible || !this.valid || this.vertices.length < 3) return;

        const ctx = canvas.ctx;
        const screenVertices = this.vertices.map(vertex => canvas.toScreen(vertex));

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(screenVertices[0].x, screenVertices[0].y);
        for (let i = 1; i < screenVertices.length; i++) {
            ctx.lineTo(screenVertices[i].x, screenVertices[i].y);
        }
        ctx.closePath();
        ctx.fillStyle = this.hexToRgba(this.fillColor, this.fillOpacity);
        ctx.fill();

        if (this.lineWidth > 0) {
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.lineWidth;
            if (this.dashed) {
                ctx.setLineDash([5, 5]);
            }
            ctx.stroke();
        }
        ctx.restore();

        if (this.selected || this.highlighted) {
            canvas.drawPolygon(this.vertices, {
                strokeColor: this.highlighted ? '#f97316' : '#6366f1',
                fillColor: null,
                width: Math.max(3, this.lineWidth + 2),
                dashed: false,
                close: true
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid || this.vertices.length < 3) return false;

        if (Geometry.pointInPolygon(point, this.vertices)) {
            return true;
        }

        const tol = canvas?.toMathLength ? canvas.toMathLength(threshold) : threshold;
        for (let i = 0; i < this.vertices.length; i++) {
            const next = (i + 1) % this.vertices.length;
            if (Geometry.pointToSegmentDistance(point, this.vertices[i], this.vertices[next]) <= tol) {
                return true;
            }
        }

        return false;
    }

    isDraggable() {
        return false;
    }

    getIconClass() {
        return 'polygon';
    }

    getTypeName() {
        return '닫힌 영역';
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
        const data = {
            ...super.toJSON(),
            vertexIds: [...this.vertexIds],
            boundaryObjectIds: [...this.boundaryObjectIds],
            fillColor: this.fillColor,
            fillOpacity: this.fillOpacity
        };

        if (this.vertexIds.length === 0 && this.staticVertices.length > 0) {
            data.vertices = this.staticVertices.map(vertex => ({ x: vertex.x, y: vertex.y }));
        }

        return data;
    }
}

export default ClosedRegion;
