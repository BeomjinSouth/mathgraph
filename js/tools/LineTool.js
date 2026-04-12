/**
 * LineTool.js - 선분/직선/반직선 생성 도구
 */

import { Tool } from './Tool.js';
import { Vec2 } from '../utils/Geometry.js';

/**
 * 선분 도구
 */
export class SegmentTool extends Tool {
    constructor() {
        super('segment');
        this.firstPoint = null;
        this.previewEnd = null;
    }

    activate(app) {
        super.activate(app);
        this.firstPoint = null;
        this.previewEnd = null;
    }

    deactivate(app) {
        super.deactivate(app);
        this.firstPoint = null;
        this.previewEnd = null;
    }

    cancel(app) {
        super.cancel(app);
        this.firstPoint = null;
        this.previewEnd = null;
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        // 기존 점 확인 또는 새 점 생성
        let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

        if (!point) {
            // 새 점 생성
            point = app.objectManager.createPoint(mathPos.x, mathPos.y);
            app.historyManager.recordCreate(point);
        }

        if (!this.firstPoint) {
            // 첫 번째 점 선택
            this.firstPoint = point;
            app.showToast(`점 ${point.label} 선택. 두 번째 점을 클릭하세요.`, 'info');
        } else {
            // 두 번째 점 선택 -> 선분 생성
            if (point.id !== this.firstPoint.id) {
                const segment = app.objectManager.createSegment(this.firstPoint.id, point.id);
                app.historyManager.recordCreate(segment);
                app.objectManager.selectObject(segment);
                app.showToast(`선분 ${segment.label} 생성`, 'success');
                app.toolManager.returnToSelect();
            }

            this.firstPoint = null;
            this.previewEnd = null;
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        this.previewEnd = mathPos.clone();

        // 호버 하이라이트
        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(point);

        app.render();
    }

    render(canvas, app) {
        if (this.firstPoint && this.previewEnd) {
            const p1 = this.firstPoint.getPosition();
            canvas.drawSegment(p1, this.previewEnd, {
                color: 'rgba(59, 130, 246, 0.5)',
                width: 2,
                dashed: true,
                dashPattern: [5, 5]
            });
        }
    }
}

/**
 * 직선 도구
 */
export class LineTool extends Tool {
    constructor() {
        super('line');
        this.firstPoint = null;
        this.previewEnd = null;
    }

    activate(app) {
        super.activate(app);
        this.firstPoint = null;
        this.previewEnd = null;
    }

    cancel(app) {
        super.cancel(app);
        this.firstPoint = null;
        this.previewEnd = null;
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

        if (!point) {
            point = app.objectManager.createPoint(mathPos.x, mathPos.y);
            app.historyManager.recordCreate(point);
        }

        if (!this.firstPoint) {
            this.firstPoint = point;
            app.showToast(`점 ${point.label} 선택. 두 번째 점을 클릭하세요.`, 'info');
        } else {
            if (point.id !== this.firstPoint.id) {
                const line = app.objectManager.createLine(this.firstPoint.id, point.id);
                app.historyManager.recordCreate(line);
                app.objectManager.selectObject(line);
                app.showToast(`직선 ${line.label} 생성`, 'success');
                app.toolManager.returnToSelect();
            }

            this.firstPoint = null;
            this.previewEnd = null;
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        this.previewEnd = mathPos.clone();

        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(point);

        app.render();
    }

    render(canvas, app) {
        if (this.firstPoint && this.previewEnd) {
            const p1 = this.firstPoint.getPosition();
            canvas.drawLine(p1, this.previewEnd, {
                color: 'rgba(59, 130, 246, 0.5)',
                width: 2,
                dashed: true
            });
        }
    }
}

/**
 * 반직선 도구
 */
export class RayTool extends Tool {
    constructor() {
        super('ray');
        this.originPoint = null;
        this.previewEnd = null;
    }

    activate(app) {
        super.activate(app);
        this.originPoint = null;
        this.previewEnd = null;
    }

    cancel(app) {
        super.cancel(app);
        this.originPoint = null;
        this.previewEnd = null;
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

        if (!point) {
            point = app.objectManager.createPoint(mathPos.x, mathPos.y);
            app.historyManager.recordCreate(point);
        }

        if (!this.originPoint) {
            this.originPoint = point;
            app.showToast(`시작점 ${point.label} 선택. 방향점을 클릭하세요.`, 'info');
        } else {
            if (point.id !== this.originPoint.id) {
                const ray = app.objectManager.createRay(this.originPoint.id, point.id);
                app.historyManager.recordCreate(ray);
                app.objectManager.selectObject(ray);
                app.showToast(`반직선 생성`, 'success');
                app.toolManager.returnToSelect();
            }

            this.originPoint = null;
            this.previewEnd = null;
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        this.previewEnd = mathPos.clone();

        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(point);

        app.render();
    }

    render(canvas, app) {
        if (this.originPoint && this.previewEnd) {
            const origin = this.originPoint.getPosition();
            const dir = this.previewEnd.sub(origin);
            canvas.drawRay(origin, dir, {
                color: 'rgba(59, 130, 246, 0.5)',
                width: 2,
                dashed: true
            });
        }
    }
}

/**
 * 벡터 도구
 */
export class VectorTool extends Tool {
    constructor() {
        super('vector');
        this.startPoint = null;
        this.previewEnd = null;
    }

    activate(app) {
        super.activate(app);
        this.startPoint = null;
        this.previewEnd = null;
    }

    cancel(app) {
        super.cancel(app);
        this.startPoint = null;
        this.previewEnd = null;
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

        if (!point) {
            point = app.objectManager.createPoint(mathPos.x, mathPos.y);
            app.historyManager.recordCreate(point);
        }

        if (!this.startPoint) {
            this.startPoint = point;
            app.showToast(`시작점 ${point.label} 선택. 끝점을 클릭하세요.`, 'info');
        } else {
            if (point.id !== this.startPoint.id) {
                const vector = app.objectManager.createVector(this.startPoint.id, point.id);
                app.historyManager.recordCreate(vector);
                app.objectManager.selectObject(vector);
                app.showToast(`벡터 생성`, 'success');
                app.toolManager.returnToSelect();
            }

            this.startPoint = null;
            this.previewEnd = null;
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        this.previewEnd = mathPos.clone();

        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(point);

        app.render();
    }

    render(canvas, app) {
        if (this.startPoint && this.previewEnd) {
            const start = this.startPoint.getPosition();
            canvas.drawVector(start, this.previewEnd, {
                color: 'rgba(236, 72, 153, 0.5)',
                width: 2
            });
        }
    }
}

export default { SegmentTool, LineTool, RayTool, VectorTool };
