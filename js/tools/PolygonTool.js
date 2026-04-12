/**
 * PolygonTool.js - 다각형 도구
 */

import { Tool } from './Tool.js';
import { Vec2 } from '../utils/Geometry.js';

/**
 * 다각형 도구 - 점들을 순서대로 클릭하여 다각형 생성
 */
export class PolygonTool extends Tool {
    constructor() {
        super('polygon');
        this.vertices = [];
        this.previewPos = null;
    }

    activate(app) {
        super.activate(app);
        this.vertices = [];
        app.showToast('꼭짓점들을 순서대로 클릭하세요. 시작점 재클릭으로 완료.', 'info');
    }

    deactivate(app) {
        super.deactivate(app);
        this.vertices = [];
    }

    cancel(app) {
        super.cancel(app);
        this.vertices = [];
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

        if (!point) {
            point = app.objectManager.createPoint(mathPos.x, mathPos.y);
            app.historyManager.recordCreate(point);
        }

        // 시작점 재클릭으로 완료
        if (this.vertices.length >= 3 && this.vertices[0].id === point.id) {
            this.completePolygon(app);
            return;
        }

        // 이미 추가된 점인지 확인
        if (this.vertices.some(v => v.id === point.id)) {
            return;
        }

        this.vertices.push(point);
        app.showToast(`${this.vertices.length}개 점. ${this.vertices.length >= 3 ? '시작점 클릭으로 완료.' : ''}`, 'info');
        app.render();
    }

    completePolygon(app) {
        if (this.vertices.length < 3) {
            app.showToast('최소 3개 점이 필요합니다.', 'warning');
            return;
        }

        // 다각형 생성 (선분들로 구성)
        const segments = [];
        for (let i = 0; i < this.vertices.length; i++) {
            const p1 = this.vertices[i];
            const p2 = this.vertices[(i + 1) % this.vertices.length];

            const segment = app.objectManager.createSegment(p1.id, p2.id);
            app.historyManager.recordCreate(segment);
            segments.push(segment);
        }

        app.showToast(`${this.vertices.length}각형 생성!`, 'success');
        app.toolManager.returnToSelect();

        this.vertices = [];
        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        this.previewPos = mathPos.clone();
        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(point);
        app.render();
    }

    render(canvas, app) {
        if (this.vertices.length === 0) return;

        const positions = this.vertices.map(v => v.getPosition());

        // 이미 선택된 점들 연결
        if (positions.length >= 2) {
            for (let i = 0; i < positions.length - 1; i++) {
                canvas.drawSegment(positions[i], positions[i + 1], {
                    color: 'rgba(34, 197, 94, 0.7)',
                    width: 2
                });
            }
        }

        // 현재 위치까지 미리보기 선
        if (this.previewPos && positions.length > 0) {
            canvas.drawSegment(positions[positions.length - 1], this.previewPos, {
                color: 'rgba(34, 197, 94, 0.4)',
                width: 2,
                dashed: true
            });

            // 시작점으로 돌아가는 선
            if (positions.length >= 3) {
                canvas.drawSegment(this.previewPos, positions[0], {
                    color: 'rgba(34, 197, 94, 0.3)',
                    width: 1,
                    dashed: true
                });
            }
        }

        // 선택된 점들 강조
        for (const vertex of this.vertices) {
            const pos = vertex.getPosition();
            canvas.drawPoint(pos, {
                radius: 6,
                color: '#22c55e',
                highlighted: true
            });
        }

        // 시작점 특별 강조
        if (positions.length >= 3) {
            canvas.drawPoint(positions[0], {
                radius: 10,
                color: 'rgba(34, 197, 94, 0.5)'
            });
        }
    }
}

export default { PolygonTool };
