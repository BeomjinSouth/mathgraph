/**
 * DimensionTool.js - 치수 생성 도구 (Mk.2)
 */

import { Tool } from './Tool.js';

/**
 * 각도 치수 도구 - 세 점 클릭 방식 (Mk.2)
 * 첫번째 점 (A) → 꼭짓점 (B) → 두번째 점 (C) 순으로 클릭
 * 각 ABC를 측정 (B가 꼭짓점)
 */
export class AngleDimensionTool extends Tool {
    constructor() {
        super('angleDimension');
        this.step = 0;
        this.point1 = null;  // 첫 번째 점 A
        this.vertex = null;  // 꼭짓점 B
    }

    onMouseDown(mathPos, screenPos, event, app) {
        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

        if (!point) {
            app.showToast('점을 클릭하세요', 'warning');
            app.render();
            return;
        }

        if (this.step === 0) {
            // 첫 번째 점 A 선택
            this.point1 = point;
            this.step = 1;
            app.showToast('꼭짓점(각의 중심)을 클릭하세요', 'info');
        } else if (this.step === 1) {
            // 꼭짓점 B 선택
            if (point.id !== this.point1.id) {
                this.vertex = point;
                this.step = 2;
                app.showToast('세 번째 점을 클릭하세요', 'info');
            } else {
                app.showToast('다른 점을 클릭하세요', 'warning');
            }
        } else if (this.step === 2) {
            // 세 번째 점 C 선택
            if (point.id !== this.vertex.id && point.id !== this.point1.id) {
                // createAngleDimension(vertexId, point1Id, point2Id)
                // 꼭짓점을 중심으로 point1과 point2가 각의 양쪽 끝
                const dimension = app.objectManager.createAngleDimension(
                    this.vertex.id,
                    this.point1.id,
                    point.id
                );
                app.historyManager.recordCreate(dimension);

                const degrees = dimension.getAngleDegrees().toFixed(1);
                app.showToast(`각도 치수 생성: ${degrees}°`, 'success');
                app.toolManager.returnToSelect();

                this.reset();
            } else {
                app.showToast('다른 점을 클릭하세요', 'warning');
            }
        }

        app.render();
    }

    reset() {
        this.step = 0;
        this.point1 = null;
        this.vertex = null;
    }

    cancel(app) {
        super.cancel(app);
        this.reset();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(point);
        app.render();
    }
}

/**
 * 길이 치수 도구 - 선분 또는 3D 객체 모서리 클릭하여 길이 표시
 */
export class LengthDimensionTool extends Tool {
    constructor() {
        super('lengthDimension');
    }

    onMouseDown(mathPos, screenPos, event, app) {
        // 먼저 선분 찾기
        const segment = app.objectManager.findLineAt(mathPos, 8, app.canvas);

        if (segment && segment.type === 'segment') {
            const dimension = app.objectManager.createLengthDimension(segment.id);
            app.historyManager.recordCreate(dimension);

            const length = dimension.getLength().toFixed(2);
            app.showToast(`길이 치수 생성: ${length}`, 'success');
            app.toolManager.returnToSelect();
            app.render();
            return;
        }

        // 3D 객체(Prism/Pyramid) 모서리 찾기
        const obj3D = app.objectManager.findObjectAt(mathPos, 8, app.canvas);

        if (obj3D && (obj3D.type === 'prism' || obj3D.type === 'pyramid')) {
            const activeEdge = obj3D.getActiveEdge ? obj3D.getActiveEdge() : null;

            if (activeEdge) {
                // 모서리 길이 표시 (Toast로 알림)
                const length = activeEdge.length.toFixed(2);
                const typeLabel = {
                    base: '밑면',
                    top: '윗면',
                    vertical: '세로',
                    lateral: '측면'
                }[activeEdge.kind] || activeEdge.kind;

                app.showToast(`${typeLabel} 모서리 ${activeEdge.index + 1} 길이: ${length}`, 'success');

                // 객체 선택 및 속성 패널에 모서리 정보 표시
                app.objectManager.selectObject(obj3D, false);
                app.updatePropertyPanel();
            } else {
                app.showToast('모서리를 직접 클릭하세요', 'info');
            }

            app.render();
            return;
        }

        app.showToast('선분 또는 3D 객체의 모서리를 클릭하세요', 'warning');
        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        // 선분 또는 3D 객체 하이라이트
        const segment = app.objectManager.findLineAt(mathPos, 8, app.canvas);

        if (segment && segment.type === 'segment') {
            app.objectManager.highlightObject(segment);
            app.canvasElement.style.cursor = 'pointer';
        } else {
            // 3D 객체 체크
            const obj3D = app.objectManager.findObjectAt(mathPos, 8, app.canvas);

            if (obj3D && (obj3D.type === 'prism' || obj3D.type === 'pyramid')) {
                app.objectManager.highlightObject(obj3D);
                app.canvasElement.style.cursor = 'pointer';
            } else {
                app.objectManager.clearHighlight();
                app.canvasElement.style.cursor = 'default';
            }
        }

        app.render();
    }
}

export default { AngleDimensionTool, LengthDimensionTool };
