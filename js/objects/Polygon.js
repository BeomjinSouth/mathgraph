/**
 * Polygon.js - filled polygon object.
 */

import { DEFAULT_OBJECT_COLOR, GeoObject, ObjectType } from './GeoObject.js';
import { Geometry } from '../utils/Geometry.js';

export class Polygon extends GeoObject {
    constructor(vertexIds, params = {}) {
        super(ObjectType.POLYGON, params);
        this.vertexIds = Array.isArray(vertexIds) ? [...vertexIds] : [];
        this.fillColor = params.fillColor || DEFAULT_OBJECT_COLOR;
        this.fillOpacity = params.fillOpacity ?? 0.12;
        this.vertices = [];

        for (const id of this.vertexIds) {
            this.addDependency(id);
        }
    }

    update(objectManager) {
        this.vertices = [];

        for (const id of this.vertexIds) {
            const point = objectManager.getObject(id);
            if (!point || !point.valid || typeof point.getPosition !== 'function') {
                this.valid = false;
                return;
            }
            this.vertices.push(point.getPosition());
        }

        this.valid = this.vertices.length >= 3;
    }

    render(canvas) {
        if (!this.visible || !this.valid || this.vertices.length < 3) return;

        canvas.drawPolygon(this.vertices, {
            strokeColor: this.color,
            fillColor: this.hexToRgba(this.fillColor, this.fillOpacity),
            width: this.lineWidth,
            dashed: this.dashed,
            close: true
        });

        if (this.selected || this.highlighted) {
            canvas.drawPolygon(this.vertices, {
                strokeColor: this.highlighted ? '#f97316' : '#6366f1',
                fillColor: null,
                width: Math.max(3, this.lineWidth + 2),
                dashed: false,
                close: true
            });
        }

        if (this.showLabel && this.label) {
            const center = Geometry.polygonCentroid(this.vertices);
            canvas.drawLabel(center, this.label, {
                fontSize: this.fontSize,
                color: this.color,
                backgroundColor: 'rgba(255, 255, 255, 0.8)'
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid || this.vertices.length < 3) return false;

        if (Geometry.pointInPolygon(point, this.vertices)) {
            return true;
        }

        const tol = canvas.toMathLength(threshold);
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

    getDragTargets(objectManager) {
        return this.vertexIds
            .map(id => objectManager.getObject(id))
            .filter(point =>
                point &&
                point.isDraggable?.() &&
                typeof point.getPosition === 'function' &&
                typeof point.setPosition === 'function'
            );
    }

    getIconClass() {
        return 'polygon';
    }

    getTypeName() {
        return 'Polygon';
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
            vertexIds: [...this.vertexIds],
            fillColor: this.fillColor,
            fillOpacity: this.fillOpacity
        };
    }
}

export default Polygon;
