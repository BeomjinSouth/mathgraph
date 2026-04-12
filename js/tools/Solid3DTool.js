/**
 * Solid3DTool.js - 투영 입체도형 도구
 * 각기둥, 각뿔 생성
 */

import { Tool } from './Tool.js';
import { Vec2 } from '../utils/Geometry.js';
import { Prism, Pyramid } from '../objects/Solid3D.js';

/**
 * 각기둥 도구
 * 밑면 꼭짓점들 → 시작점 재클릭으로 밑면 완료 → 높이점 클릭
 */
export class PrismTool extends Tool {
    constructor() {
        super('prism');
        this.baseVertices = []; // 밑면 꼭짓점들
        this.heightPoint = null;
        this.phase = 'base'; // 'base' 또는 'height'
        this.previewPos = null;
    }

    activate(app) {
        super.activate(app);
        this.baseVertices = [];
        this.heightPoint = null;
        this.phase = 'base';
        app.showToast('밑면 꼭짓점들을 순서대로 클릭하세요. 시작점 재클릭으로 밑면 완료.', 'info');
    }

    deactivate(app) {
        super.deactivate(app);
        this.baseVertices = [];
        this.heightPoint = null;
        this.phase = 'base';
    }

    cancel(app) {
        super.cancel(app);
        this.baseVertices = [];
        this.heightPoint = null;
        this.phase = 'base';
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

        if (!point) {
            point = app.objectManager.createPoint(mathPos.x, mathPos.y);
            app.historyManager.recordCreate(point);
        }

        if (this.phase === 'base') {
            // 밑면 정의 중

            // 시작점 재클릭으로 밑면 완료
            if (this.baseVertices.length >= 3 && this.baseVertices[0].id === point.id) {
                this.phase = 'height';
                app.showToast('이제 높이점을 클릭하세요. (밑면 위쪽에 위치)', 'info');
                app.render();
                return;
            }

            // 이미 추가된 점인지 확인
            if (this.baseVertices.some(v => v.id === point.id)) {
                return;
            }

            this.baseVertices.push(point);
            app.showToast(`밑면: ${this.baseVertices.length}개 점. ${this.baseVertices.length >= 3 ? '시작점 클릭으로 완료.' : ''}`, 'info');

        } else {
            // 높이점 선택
            this.heightPoint = point;
            this.completePrism(app);
        }

        app.render();
    }

    completePrism(app) {
        if (this.baseVertices.length < 3 || !this.heightPoint) {
            app.showToast('밑면 3개 이상의 점과 높이점이 필요합니다.', 'warning');
            return;
        }

        // 밑면 중심 계산
        const basePositions = this.baseVertices.map(v => v.getPosition());
        const centerX = basePositions.reduce((sum, p) => sum + p.x, 0) / basePositions.length;
        const centerY = basePositions.reduce((sum, p) => sum + p.y, 0) / basePositions.length;
        const baseCenter = new Vec2(centerX, centerY);

        // 높이 벡터 계산 (밑면 중심에서 높이점까지)
        const heightPos = this.heightPoint.getPosition();
        const heightVector = heightPos.sub(baseCenter);

        // 윗면 꼭짓점 자동 생성
        const topVertices = [];
        for (const baseVertex of this.baseVertices) {
            const basePos = baseVertex.getPosition();
            const topPos = basePos.add(heightVector);

            // 밑면 점의 라벨에 ' 추가 (예: A -> A')
            let topLabel = (baseVertex.label || '') + "'";

            // 새로운 윗면 점 생성
            const topPoint = app.objectManager.createPoint(topPos.x, topPos.y, { label: topLabel });
            app.historyManager.recordCreate(topPoint);
            topVertices.push(topPoint);
        }

        // 높이점을 사용했던 것은 삭제 (사용자가 클릭해서 만든 임시 점)
        // 단, 높이점이 기존 점이 아닌 새로 만든 점일 경우에만
        const heightPointIsNew = !this.baseVertices.some(v => v.id === this.heightPoint.id);
        if (heightPointIsNew) {
            app.objectManager.removeObject(this.heightPoint.id);
        }

        // Prism 생성 (밑면 + 윗면 꼭짓점 ID 모두 전달)
        const baseVertexIds = this.baseVertices.map(v => v.id);
        const topVertexIds = topVertices.map(v => v.id);
        const prism = app.objectManager.addObject(
            new Prism(baseVertexIds, topVertexIds)
        );

        app.historyManager.recordCreate(prism);
        app.objectManager.selectObject(prism);
        app.showToast(`${this.baseVertices.length}각기둥 생성!`, 'success');
        app.toolManager.returnToSelect();

        this.baseVertices = [];
        this.heightPoint = null;
        this.phase = 'base';
        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        this.previewPos = mathPos.clone();

        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(point);

        app.render();
    }

    render(canvas, app) {
        const positions = this.baseVertices.map(v => v.getPosition());

        // 밑면 미리보기
        if (positions.length >= 2) {
            for (let i = 0; i < positions.length - 1; i++) {
                canvas.drawSegment(positions[i], positions[i + 1], {
                    color: 'rgba(59, 130, 246, 0.7)',
                    width: 2
                });
            }

            // 닫기 선 (밑면 완료 시)
            if (this.phase === 'height') {
                canvas.drawSegment(positions[positions.length - 1], positions[0], {
                    color: 'rgba(59, 130, 246, 0.7)',
                    width: 2
                });
            }
        }

        // 현재 위치까지 미리보기
        if (this.previewPos && positions.length > 0 && this.phase === 'base') {
            canvas.drawSegment(positions[positions.length - 1], this.previewPos, {
                color: 'rgba(59, 130, 246, 0.4)',
                width: 2,
                dashed: true
            });
        }

        // 높이점 미리보기 (밑면 완료 후)
        if (this.phase === 'height' && this.previewPos && positions.length >= 3) {
            // 밑면 중심 계산
            const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
            const centerY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
            const center = new Vec2(centerX, centerY);

            // 높이 벡터
            const heightVec = this.previewPos.sub(center);

            // 상단면 미리보기
            for (let i = 0; i < positions.length; i++) {
                const topPos = positions[i].add(heightVec);
                const nextTopPos = positions[(i + 1) % positions.length].add(heightVec);

                // 세로 모서리
                canvas.drawSegment(positions[i], topPos, {
                    color: 'rgba(34, 197, 94, 0.4)',
                    width: 2,
                    dashed: true
                });

                // 상단면 모서리
                canvas.drawSegment(topPos, nextTopPos, {
                    color: 'rgba(34, 197, 94, 0.4)',
                    width: 2,
                    dashed: true
                });
            }
        }

        // 점들 강조
        for (const vertex of this.baseVertices) {
            const pos = vertex.getPosition();
            canvas.drawPoint(pos, {
                radius: 6,
                color: '#3b82f6',
                highlighted: true
            });
        }

        // 시작점 특별 강조
        if (positions.length >= 3 && this.phase === 'base') {
            canvas.drawPoint(positions[0], {
                radius: 10,
                color: 'rgba(34, 197, 94, 0.5)'
            });
        }
    }
}

/**
 * 각뿔 도구
 */
export class PyramidTool extends Tool {
    constructor() {
        super('pyramid');
        this.baseVertices = [];
        this.apex = null;
        this.phase = 'base'; // 'base' 또는 'apex'
        this.previewPos = null;
    }

    activate(app) {
        super.activate(app);
        this.baseVertices = [];
        this.apex = null;
        this.phase = 'base';
        app.showToast('밑면 꼭짓점들을 순서대로 클릭하세요. 시작점 재클릭으로 밑면 완료.', 'info');
    }

    deactivate(app) {
        super.deactivate(app);
        this.baseVertices = [];
        this.apex = null;
        this.phase = 'base';
    }

    cancel(app) {
        super.cancel(app);
        this.baseVertices = [];
        this.apex = null;
        this.phase = 'base';
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

        if (!point) {
            point = app.objectManager.createPoint(mathPos.x, mathPos.y);
            app.historyManager.recordCreate(point);
        }

        if (this.phase === 'base') {
            // 밑면 정의 중

            // 시작점 재클릭으로 밑면 완료
            if (this.baseVertices.length >= 3 && this.baseVertices[0].id === point.id) {
                this.phase = 'apex';
                app.showToast('이제 꼭대기점(apex)을 클릭하세요.', 'info');
                app.render();
                return;
            }

            if (this.baseVertices.some(v => v.id === point.id)) {
                return;
            }

            this.baseVertices.push(point);
            app.showToast(`밑면: ${this.baseVertices.length}개 점. ${this.baseVertices.length >= 3 ? '시작점 클릭으로 완료.' : ''}`, 'info');

        } else {
            // 꼭대기점 선택
            this.apex = point;
            this.completePyramid(app);
        }

        app.render();
    }

    completePyramid(app) {
        if (this.baseVertices.length < 3 || !this.apex) {
            app.showToast('밑면 3개 이상의 점과 꼭대기점이 필요합니다.', 'warning');
            return;
        }

        const vertexIds = this.baseVertices.map(v => v.id);
        const pyramid = app.objectManager.addObject(
            new Pyramid(vertexIds, this.apex.id)
        );

        app.historyManager.recordCreate(pyramid);
        app.objectManager.selectObject(pyramid);
        app.showToast(`${this.baseVertices.length}각뿔 생성!`, 'success');
        app.toolManager.returnToSelect();

        this.baseVertices = [];
        this.apex = null;
        this.phase = 'base';
        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        this.previewPos = mathPos.clone();

        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(point);

        app.render();
    }

    render(canvas, app) {
        const positions = this.baseVertices.map(v => v.getPosition());

        // 밑면 미리보기
        if (positions.length >= 2) {
            for (let i = 0; i < positions.length - 1; i++) {
                canvas.drawSegment(positions[i], positions[i + 1], {
                    color: 'rgba(59, 130, 246, 0.7)',
                    width: 2
                });
            }

            // 닫기 선 (밑면 완료 시)
            if (this.phase === 'apex') {
                canvas.drawSegment(positions[positions.length - 1], positions[0], {
                    color: 'rgba(59, 130, 246, 0.7)',
                    width: 2
                });
            }
        }

        // 현재 위치까지 미리보기
        if (this.previewPos && positions.length > 0 && this.phase === 'base') {
            canvas.drawSegment(positions[positions.length - 1], this.previewPos, {
                color: 'rgba(59, 130, 246, 0.4)',
                width: 2,
                dashed: true
            });
        }

        // 꼭대기점 미리보기
        if (this.phase === 'apex' && this.previewPos) {
            for (const pos of positions) {
                canvas.drawSegment(pos, this.previewPos, {
                    color: 'rgba(236, 72, 153, 0.4)',
                    width: 2,
                    dashed: true
                });
            }
        }

        // 점들 강조
        for (const vertex of this.baseVertices) {
            const pos = vertex.getPosition();
            canvas.drawPoint(pos, {
                radius: 6,
                color: '#3b82f6',
                highlighted: true
            });
        }

        // 시작점 특별 강조
        if (positions.length >= 3 && this.phase === 'base') {
            canvas.drawPoint(positions[0], {
                radius: 10,
                color: 'rgba(34, 197, 94, 0.5)'
            });
        }
    }
}

export default { PrismTool, PyramidTool };
