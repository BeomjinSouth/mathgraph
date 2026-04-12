/**
 * CircleTool.js - 원 생성 도구
 */

import { Tool } from './Tool.js';
import { Vec2 } from '../utils/Geometry.js';

/**
 * 중심-점 원 도구
 */
export class CircleTool extends Tool {
    constructor() {
        super('circle');
        this.centerPoint = null;
        this.previewRadius = null;
    }

    activate(app) {
        super.activate(app);
        this.centerPoint = null;
        this.previewRadius = null;
    }

    cancel(app) {
        super.cancel(app);
        this.centerPoint = null;
        this.previewRadius = null;
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

        if (!point) {
            point = app.objectManager.createPoint(mathPos.x, mathPos.y);
            app.historyManager.recordCreate(point);
        }

        if (!this.centerPoint) {
            this.centerPoint = point;
            app.showToast(`중심 ${point.label} 선택. 원 위의 점을 클릭하세요.`, 'info');
        } else {
            if (point.id !== this.centerPoint.id) {
                const circle = app.objectManager.createCircle(this.centerPoint.id, point.id, { showLabel: false });
                app.historyManager.recordCreate(circle);
                app.objectManager.selectObject(circle);
                app.showToast('원 생성', 'success');
                app.toolManager.returnToSelect();
            }

            this.centerPoint = null;
            this.previewRadius = null;
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        if (this.centerPoint) {
            this.previewRadius = this.centerPoint.getPosition().distanceTo(mathPos);
        }

        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(point);

        app.render();
    }

    render(canvas, app) {
        if (this.centerPoint && this.previewRadius) {
            canvas.drawCircle(this.centerPoint.getPosition(), this.previewRadius, {
                color: 'rgba(34, 197, 94, 0.5)',
                width: 2,
                dashed: true
            });
        }
    }
}

/**
 * 세 점 원 도구
 */
export class CircleThreePointsTool extends Tool {
    constructor() {
        super('circleThreePoints');
        this.points = [];
    }

    activate(app) {
        super.activate(app);
        this.points = [];
    }

    cancel(app) {
        super.cancel(app);
        this.points = [];
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

        if (!point) {
            point = app.objectManager.createPoint(mathPos.x, mathPos.y);
            app.historyManager.recordCreate(point);
        }

        // 이미 선택된 점인지 확인
        if (this.points.some(p => p.id === point.id)) {
            return;
        }

        this.points.push(point);

        if (this.points.length < 3) {
            app.showToast(`${this.points.length}/3 점 선택. ${3 - this.points.length}개 더 선택하세요.`, 'info');
        } else {
            // 세 점 원 생성
            const circle = app.objectManager.createCircleThreePoints(
                this.points[0].id,
                this.points[1].id,
                this.points[2].id,
                { showLabel: false }
            );

            if (circle.valid) {
                app.historyManager.recordCreate(circle);

                // 의존성 있는 중심점 자동 생성 (원 이동 시 따라감)
                const centerPoint = app.objectManager.createCircleCenterPoint(circle.id);
                app.historyManager.recordCreate(centerPoint);

                app.objectManager.selectObject(circle);
                app.showToast(`세 점 원 및 중심 ${centerPoint.label} 생성`, 'success');
                app.toolManager.returnToSelect();
            } else {
                app.showToast('세 점이 일직선상에 있어 원을 만들 수 없습니다.', 'error');
                app.objectManager.removeObject(circle.id);
            }

            this.points = [];
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(point);
        app.render();
    }

    render(canvas, app) {
        // 선택된 점들 강조
        for (const point of this.points) {
            const pos = point.getPosition();
            canvas.drawPoint(pos, {
                radius: 6,
                color: '#22c55e',
                highlighted: true
            });
        }
    }
}

/**
 * 원의 접선 도구
 */
export class TangentCircleTool extends Tool {
    constructor() {
        super('tangentCircle');
        this.selectedCircle = null;
    }

    activate(app) {
        super.activate(app);
        this.selectedCircle = null;
    }

    cancel(app) {
        super.cancel(app);
        this.selectedCircle = null;
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        if (!this.selectedCircle) {
            // 원 선택
            const circle = app.objectManager.findCircleAt(mathPos, 8, app.canvas);

            if (circle) {
                this.selectedCircle = circle;
                app.showToast('접점 위치를 클릭하세요.', 'info');
            } else {
                app.showToast('먼저 원을 선택하세요.', 'warning');
            }
        } else {
            // 접점 생성 및 접선 생성
            const center = this.selectedCircle.getCenter();
            const angle = Math.atan2(mathPos.y - center.y, mathPos.x - center.x);

            // 원 위의 점 생성
            const tangentPoint = app.objectManager.createPointOnCircle(this.selectedCircle.id, angle);
            app.historyManager.recordCreate(tangentPoint);

            // 접선 생성
            const tangent = app.objectManager.createTangentCircle(this.selectedCircle.id, tangentPoint.id);
            app.historyManager.recordCreate(tangent);
            app.objectManager.selectObject(tangent);

            app.showToast(`접선 ${tangent.label} 생성`, 'success');
            app.toolManager.returnToSelect();

            this.selectedCircle = null;
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        if (!this.selectedCircle) {
            const circle = app.objectManager.findCircleAt(mathPos, 8, app.canvas);
            app.objectManager.highlightObject(circle);
        }

        app.render();
    }

    render(canvas, app) {
        if (this.selectedCircle) {
            // 선택된 원 강조
            const center = this.selectedCircle.getCenter();
            const radius = this.selectedCircle.getRadius();
            canvas.drawCircle(center, radius, {
                color: '#22c55e',
                width: 3
            });
        }
    }
}

export default { CircleTool, CircleThreePointsTool, TangentCircleTool };
