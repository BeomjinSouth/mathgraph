/**
 * NumberLine.js - 수직선(수평 수직선) 객체
 * 사용자가 지정한 범위와 간격으로 수직선을 생성
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2 } from '../utils/Geometry.js';

/**
 * 수직선 클래스
 */
export class NumberLine extends GeoObject {
    constructor(options = {}) {
        super(ObjectType.NUMBER_LINE, {
            showLabel: false,
            ...options
        });

        this.start = options.start !== undefined ? options.start : -5;     // 시작값
        this.end = options.end !== undefined ? options.end : 5;            // 끝값
        this.step = options.step !== undefined ? options.step : 1;          // 주요 간격
        this.y = options.y !== undefined ? options.y : 0;                   // Y 위치
        this.showArrows = options.showArrows !== false;                      // 화살표 표시
        this.tickHeight = options.tickHeight || 0.15;                        // 눈금 높이 (수학 좌표)

        // 커스텀 마크 [{value, label, color}]
        this.customMarks = options.customMarks || [];

        this.valid = true;
    }

    update(objectManager) {
        // 독립 객체이므로 별도 업데이트 불필요
        this.valid = this.start < this.end && this.step > 0;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        const ctx = canvas.ctx;
        const startPos = canvas.toScreen(new Vec2(this.start, this.y));
        const endPos = canvas.toScreen(new Vec2(this.end, this.y));

        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.lineWidth;
        ctx.fillStyle = this.color;

        // 메인 라인 그리기
        ctx.beginPath();
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(endPos.x, endPos.y);
        ctx.stroke();

        // 화살표 그리기 (양쪽 끝)
        if (this.showArrows) {
            const arrowSize = 8;

            // 왼쪽 화살표
            ctx.beginPath();
            ctx.moveTo(startPos.x + arrowSize, startPos.y - arrowSize / 2);
            ctx.lineTo(startPos.x, startPos.y);
            ctx.lineTo(startPos.x + arrowSize, startPos.y + arrowSize / 2);
            ctx.stroke();

            // 오른쪽 화살표
            ctx.beginPath();
            ctx.moveTo(endPos.x - arrowSize, endPos.y - arrowSize / 2);
            ctx.lineTo(endPos.x, endPos.y);
            ctx.lineTo(endPos.x - arrowSize, endPos.y + arrowSize / 2);
            ctx.stroke();
        }

        // 눈금 및 레이블 그리기
        const tickScreenHeight = canvas.toScreenLength(this.tickHeight);

        ctx.font = `${this.fontSize || 14}px "Noto Sans KR", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let v = this.start; v <= this.end; v += this.step) {
            // 부동소수점 오차 보정
            const value = Math.round(v * 1000000) / 1000000;
            const pos = canvas.toScreen(new Vec2(value, this.y));

            // 눈금
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y - tickScreenHeight);
            ctx.lineTo(pos.x, pos.y + tickScreenHeight);
            ctx.stroke();

            // 레이블
            const label = this.formatLabel(value);
            ctx.fillText(label, pos.x, pos.y + tickScreenHeight + 5);
        }

        // 커스텀 마크 그리기
        for (const mark of this.customMarks) {
            const pos = canvas.toScreen(new Vec2(mark.value, this.y));
            const markColor = mark.color || this.color;

            ctx.strokeStyle = markColor;
            ctx.fillStyle = markColor;

            // 눈금
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y - tickScreenHeight * 1.5);
            ctx.lineTo(pos.x, pos.y + tickScreenHeight * 1.5);
            ctx.stroke();

            // 레이블 (위쪽에 표시)
            if (mark.label) {
                ctx.font = `${(this.fontSize || 14) - 2}px "Noto Sans KR", sans-serif`;
                ctx.textBaseline = 'bottom';
                ctx.fillText(mark.label, pos.x, pos.y - tickScreenHeight * 1.5 - 5);
            }
        }

        // 색상 복원
        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;
    }

    /**
     * 레이블 포맷팅
     */
    formatLabel(value) {
        if (Number.isInteger(value)) {
            // 양수에 + 표시 (0 제외)
            if (value > 0) return `+${value}`;
            return value.toString();
        }
        // 소수는 필요한 만큼만 표시
        const str = value.toFixed(2).replace(/\.?0+$/, '');
        if (value > 0) return `+${str}`;
        return str;
    }

    hitTest(point, threshold, canvas) {
        const screenPoint = canvas.toScreen(point);
        const startPos = canvas.toScreen(new Vec2(this.start, this.y));
        const endPos = canvas.toScreen(new Vec2(this.end, this.y));

        // 수평선 위에 있는지 확인
        if (screenPoint.x < startPos.x - threshold ||
            screenPoint.x > endPos.x + threshold) {
            return false;
        }

        const yDist = Math.abs(screenPoint.y - startPos.y);
        return yDist <= threshold + 10;
    }

    isDraggable() {
        return !this.locked && this.visible;
    }

    startDrag(point, canvas) {
        this.dragOffset = this.y - point.y;
    }

    drag(point, delta, canvas) {
        this.y = point.y + this.dragOffset;
    }

    endDrag() {
        delete this.dragOffset;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            start: this.start,
            end: this.end,
            step: this.step,
            y: this.y,
            showArrows: this.showArrows,
            tickHeight: this.tickHeight,
            customMarks: this.customMarks
        };
    }
}

export default NumberLine;
