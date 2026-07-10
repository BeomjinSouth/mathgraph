/**
 * TextLabel.js - 시험지용 독립 텍스트/수식 라벨 객체
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2 } from '../utils/Geometry.js';

const VALID_ALIGNMENTS = new Set(['left', 'center', 'right']);

export class TextLabel extends GeoObject {
    constructor(text = '', x = 0, y = 0, options = {}) {
        super(ObjectType.TEXT_LABEL, {
            showLabel: false,
            label: options.label || String(text || '').slice(0, 80),
            fontSize: options.fontSize !== undefined ? options.fontSize : 18,
            ...options
        });

        this.text = String(text ?? '');
        this.position = new Vec2(x, y);
        this.align = VALID_ALIGNMENTS.has(options.align) ? options.align : 'left';
        this.backgroundColor = options.backgroundColor || null;
        this.valid = this.text.trim().length > 0;
    }

    update() {
        this.text = String(this.text ?? '');
        this.label = this.text.slice(0, 80);
        this.align = VALID_ALIGNMENTS.has(this.align) ? this.align : 'left';
        this.valid = this.text.trim().length > 0 && Number.isFinite(this.position.x) && Number.isFinite(this.position.y);
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        canvas.drawMathLabel(this.position, this.text, {
            fontSize: this.fontSize,
            color: this.color,
            offsetX: 0,
            offsetY: 0,
            align: this.align,
            backgroundColor: this.backgroundColor
        });
    }

    getScreenBounds(canvas) {
        const screen = canvas.toScreen(this.position);
        const ctx = canvas.ctx;
        const parts = canvas.parseMathExpression?.(this.text, this.fontSize, this.color);
        const width = parts && canvas.measureMathExpression
            ? canvas.measureMathExpression(parts, ctx, this.fontSize)
            : Math.max(this.fontSize, this.text.length * this.fontSize * 0.6);
        const left = this.align === 'center' ? screen.x - width / 2 :
            this.align === 'right' ? screen.x - width : screen.x;

        return {
            left,
            right: left + width,
            top: screen.y - this.fontSize,
            bottom: screen.y + Math.max(4, this.fontSize * 0.25)
        };
    }

    hitTest(point, threshold, canvas) {
        const screenPoint = canvas.toScreen(point);
        const bounds = this.getScreenBounds(canvas);
        return screenPoint.x >= bounds.left - threshold &&
            screenPoint.x <= bounds.right + threshold &&
            screenPoint.y >= bounds.top - threshold &&
            screenPoint.y <= bounds.bottom + threshold;
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
            text: this.text,
            x: this.position.x,
            y: this.position.y,
            align: this.align,
            backgroundColor: this.backgroundColor
        };
    }
}

export default TextLabel;
