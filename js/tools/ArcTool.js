/**
 * ArcTool.js - 호, 부채꼴, 활꼴 생성 도구 (Mk.2)
 */

import { Tool } from './Tool.js';
import { Vec2 } from '../utils/Geometry.js';

/**
 * 호 도구 - 원 선택 → 시작점 → 끝점
 */
export class ArcTool extends Tool {
    constructor() {
        super('arc');
        this.step = 0;
        this.selectedCircle = null;
        this.startPoint = null;
    }

    onMouseDown(mathPos, screenPos, event, app) {
        if (this.step === 0) {
            // 원 선택
            const circle = app.objectManager.findCircleAt(mathPos, 8, app.canvas);
            if (circle) {
                this.selectedCircle = circle;
                this.step = 1;
                app.showToast('시작점을 클릭하세요 (원 위)', 'info');
            } else {
                app.showToast('원을 먼저 선택하세요', 'warning');
            }
        } else if (this.step === 1) {
            // 시작점 선택/생성
            let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

            if (!point) {
                // 원 위에 새 점 생성
                const center = this.selectedCircle.getCenter();
                const angle = Math.atan2(mathPos.y - center.y, mathPos.x - center.x);
                point = app.objectManager.createPointOnCircle(this.selectedCircle.id, angle);
                app.historyManager.recordCreate(point);
            }

            this.startPoint = point;
            this.step = 2;
            app.showToast('끝점을 클릭하세요 (원 위)', 'info');
        } else if (this.step === 2) {
            // 끝점 선택/생성
            let endPoint = app.objectManager.findPointAt(mathPos, 8, app.canvas);

            if (!endPoint) {
                const center = this.selectedCircle.getCenter();
                const angle = Math.atan2(mathPos.y - center.y, mathPos.x - center.x);
                endPoint = app.objectManager.createPointOnCircle(this.selectedCircle.id, angle);
                app.historyManager.recordCreate(endPoint);
            }

            // 호 생성
            const arc = app.objectManager.createArc(
                this.selectedCircle.id,
                this.startPoint.id,
                endPoint.id,
                'minor'
            );
            app.historyManager.recordCreate(arc);
            app.showToast(`호 ${arc.label} 생성`, 'success');
            app.toolManager.returnToSelect();

            this.reset();
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        if (this.step === 0) {
            const circle = app.objectManager.findCircleAt(mathPos, 8, app.canvas);
            app.objectManager.highlightObject(circle);
        } else {
            const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
            app.objectManager.highlightObject(point);
        }
        app.render();
    }

    reset() {
        this.step = 0;
        this.selectedCircle = null;
        this.startPoint = null;
    }

    cancel(app) {
        super.cancel(app);
        this.reset();
    }
}

/**
 * 부채꼴 도구
 */
export class SectorTool extends Tool {
    constructor() {
        super('sector');
        this.step = 0;
        this.selectedCircle = null;
        this.startPoint = null;
    }

    onMouseDown(mathPos, screenPos, event, app) {
        if (this.step === 0) {
            const circle = app.objectManager.findCircleAt(mathPos, 8, app.canvas);
            if (circle) {
                this.selectedCircle = circle;
                this.step = 1;
                app.showToast('시작점을 클릭하세요 (원 위)', 'info');
            } else {
                app.showToast('원을 먼저 선택하세요', 'warning');
            }
        } else if (this.step === 1) {
            let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

            if (!point) {
                const center = this.selectedCircle.getCenter();
                const angle = Math.atan2(mathPos.y - center.y, mathPos.x - center.x);
                point = app.objectManager.createPointOnCircle(this.selectedCircle.id, angle);
                app.historyManager.recordCreate(point);
            }

            this.startPoint = point;
            this.step = 2;
            app.showToast('끝점을 클릭하세요 (원 위)', 'info');
        } else if (this.step === 2) {
            let endPoint = app.objectManager.findPointAt(mathPos, 8, app.canvas);

            if (!endPoint) {
                const center = this.selectedCircle.getCenter();
                const angle = Math.atan2(mathPos.y - center.y, mathPos.x - center.x);
                endPoint = app.objectManager.createPointOnCircle(this.selectedCircle.id, angle);
                app.historyManager.recordCreate(endPoint);
            }

            const sector = app.objectManager.createSector(
                this.selectedCircle.id,
                this.startPoint.id,
                endPoint.id,
                'minor'
            );
            app.historyManager.recordCreate(sector);
            app.showToast(`부채꼴 ${sector.label} 생성`, 'success');
            app.toolManager.returnToSelect();

            this.reset();
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        if (this.step === 0) {
            const circle = app.objectManager.findCircleAt(mathPos, 8, app.canvas);
            app.objectManager.highlightObject(circle);
        } else {
            const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
            app.objectManager.highlightObject(point);
        }
        app.render();
    }

    reset() {
        this.step = 0;
        this.selectedCircle = null;
        this.startPoint = null;
    }

    cancel(app) {
        super.cancel(app);
        this.reset();
    }
}

/**
 * 활꼴 도구
 */
export class CircularSegmentTool extends Tool {
    constructor() {
        super('circularSegment');
        this.step = 0;
        this.selectedCircle = null;
        this.startPoint = null;
    }

    onMouseDown(mathPos, screenPos, event, app) {
        if (this.step === 0) {
            const circle = app.objectManager.findCircleAt(mathPos, 8, app.canvas);
            if (circle) {
                this.selectedCircle = circle;
                this.step = 1;
                app.showToast('시작점을 클릭하세요 (원 위)', 'info');
            } else {
                app.showToast('원을 먼저 선택하세요', 'warning');
            }
        } else if (this.step === 1) {
            let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

            if (!point) {
                const center = this.selectedCircle.getCenter();
                const angle = Math.atan2(mathPos.y - center.y, mathPos.x - center.x);
                point = app.objectManager.createPointOnCircle(this.selectedCircle.id, angle);
                app.historyManager.recordCreate(point);
            }

            this.startPoint = point;
            this.step = 2;
            app.showToast('끝점을 클릭하세요 (원 위)', 'info');
        } else if (this.step === 2) {
            let endPoint = app.objectManager.findPointAt(mathPos, 8, app.canvas);

            if (!endPoint) {
                const center = this.selectedCircle.getCenter();
                const angle = Math.atan2(mathPos.y - center.y, mathPos.x - center.x);
                endPoint = app.objectManager.createPointOnCircle(this.selectedCircle.id, angle);
                app.historyManager.recordCreate(endPoint);
            }

            const segment = app.objectManager.createCircularSegment(
                this.selectedCircle.id,
                this.startPoint.id,
                endPoint.id,
                'minor'
            );
            app.historyManager.recordCreate(segment);
            app.showToast(`활꼴 ${segment.label} 생성`, 'success');
            app.toolManager.returnToSelect();

            this.reset();
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        if (this.step === 0) {
            const circle = app.objectManager.findCircleAt(mathPos, 8, app.canvas);
            app.objectManager.highlightObject(circle);
        } else {
            const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
            app.objectManager.highlightObject(point);
        }
        app.render();
    }

    reset() {
        this.step = 0;
        this.selectedCircle = null;
        this.startPoint = null;
    }

    cancel(app) {
        super.cancel(app);
        this.reset();
    }
}

export default { ArcTool, SectorTool, CircularSegmentTool };
