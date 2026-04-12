/**
 * PointTool.js - 점 생성 도구
 */

import { Tool } from './Tool.js';
import { Vec2 } from '../utils/Geometry.js';
import { ObjectType } from '../objects/GeoObject.js';

export class PointTool extends Tool {
    constructor() {
        super('point');
    }

    /**
     * 스냅 적용 (SettingsManager 사용)
     * @param {number} value - 원본 좌표 값
     * @param {boolean} skipSnap - 스냅 무시 여부
     * @param {object} app - app 객체
     * @returns {number} - 스냅된 좌표 값
     */
    snapValue(value, skipSnap, app) {
        if (skipSnap) return value;
        if (app.settingsManager) {
            return app.settingsManager.snapValue(value);
        }
        return Math.round(value);
    }

    onMouseDown(mathPos, screenPos, event, app) {
        // 기존 점 위 클릭 확인
        const existingPoint = app.objectManager.findPointAt(mathPos, 8, app.canvas);

        if (existingPoint) {
            // 기존 점 선택
            app.objectManager.selectObject(existingPoint);
        } else {
            // 새 점 생성 (Shift 키 누르면 스냅 무시)
            const skipSnap = event.shiftKey;
            const x = this.snapValue(mathPos.x, skipSnap, app);
            const y = this.snapValue(mathPos.y, skipSnap, app);

            const point = app.objectManager.createPoint(x, y);
            app.historyManager.recordCreate(point);
            app.objectManager.selectObject(point);

            // 좌표 표시 포맷
            const formatCoord = (v) => {
                if (Number.isInteger(v)) return v.toString();
                return v.toFixed(2).replace(/\.?0+$/, '');
            };
            app.showToast(`점 ${point.label} 생성 (${formatCoord(x)}, ${formatCoord(y)})`, 'success');

            // Mk.2: 도구 사용 후 선택 도구로 돌아가기
            app.toolManager.returnToSelect();
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        // 호버 하이라이트
        const hoveredPoint = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(hoveredPoint);
        app.render();
    }
}

/**
 * 선 위의 점 도구
 */
export class PointOnObjectTool extends Tool {
    constructor() {
        super('pointOnObject');
    }

    onMouseDown(mathPos, screenPos, event, app) {
        // 선 위 클릭
        const line = app.objectManager.findLineAt(mathPos, 8, app.canvas);

        if (line) {
            // 선 위의 점 생성
            const p1 = line.getPoint1();
            const p2 = line.getPoint2();
            const dir = p2.sub(p1);
            const lenSq = dir.lengthSq();

            let t = 0.5;
            if (lenSq > 0) {
                t = mathPos.sub(p1).dot(dir) / lenSq;

                // 선분이면 0~1로 제한
                if (line.type === ObjectType.SEGMENT) {
                    t = Math.max(0, Math.min(1, t));
                }
            }

            const point = app.objectManager.createPointOnLine(line.id, t);
            app.historyManager.recordCreate(point);
            app.objectManager.selectObject(point);
            app.showToast(`선 위의 점 ${point.label} 생성`, 'success');
            app.toolManager.returnToSelect();
        } else {
            // 원 위 클릭
            const circle = app.objectManager.findCircleAt(mathPos, 8, app.canvas);

            if (circle) {
                const center = circle.getCenter();
                const angle = Math.atan2(mathPos.y - center.y, mathPos.x - center.x);

                const point = app.objectManager.createPointOnCircle(circle.id, angle);
                app.historyManager.recordCreate(point);
                app.objectManager.selectObject(point);
                app.showToast(`원 위의 점 ${point.label} 생성`, 'success');
                app.toolManager.returnToSelect();
            }
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        const line = app.objectManager.findLineAt(mathPos, 8, app.canvas);
        const circle = app.objectManager.findCircleAt(mathPos, 8, app.canvas);

        app.objectManager.highlightObject(line || circle);
        app.render();
    }
}

export default { PointTool, PointOnObjectTool };
