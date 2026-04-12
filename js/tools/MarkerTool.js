/**
 * MarkerTool.js - 표식 도구들
 * 직각 표시, 같은 길이 표시
 */

import { Tool } from './Tool.js';
import { ObjectType } from '../objects/GeoObject.js';

/**
 * 직각 표시 도구
 */
export class RightAngleTool extends Tool {
    constructor() {
        super('rightAngle');
        this.selectedLines = [];
    }

    activate(app) {
        super.activate(app);
        this.selectedLines = [];
    }

    cancel(app) {
        super.cancel(app);
        this.selectedLines = [];
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        // 선 선택
        const line = app.objectManager.findLineAt(mathPos, 8, app.canvas);

        if (!line) {
            app.showToast('직각을 이루는 두 선을 선택하세요.', 'warning');
            return;
        }

        // 이미 선택된 선인지 확인
        if (this.selectedLines.some(l => l.id === line.id)) {
            return;
        }

        this.selectedLines.push(line);

        if (this.selectedLines.length < 2) {
            app.showToast('두 번째 선을 선택하세요.', 'info');
        } else {
            // 교점 찾기
            const intersection = app.objectManager.createIntersection(
                this.selectedLines[0].id,
                this.selectedLines[1].id,
                mathPos
            );

            if (intersection.valid) {
                // 직각 표시 생성
                const marker = app.objectManager.createRightAngleMarker(
                    intersection.id,
                    this.selectedLines[0].id,
                    this.selectedLines[1].id
                );

                app.historyManager.recordCreate(intersection);
                app.historyManager.recordCreate(marker);
                app.objectManager.selectObject(marker);
                app.showToast('직각 표시 생성', 'success');
                app.toolManager.returnToSelect();
            } else {
                app.showToast('두 선이 만나지 않습니다.', 'error');
                app.objectManager.removeObject(intersection.id);
            }

            this.selectedLines = [];
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        const line = app.objectManager.findLineAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(line);
        app.render();
    }

    render(canvas, app) {
        // 선택된 선 강조
        for (const line of this.selectedLines) {
            if (line.valid) {
                canvas.drawLine(line.getPoint1(), line.getPoint2(), {
                    color: '#8b5cf6',
                    width: 3
                });
            }
        }
    }
}

/**
 * 같은 길이 표시 도구
 */
export class EqualLengthTool extends Tool {
    constructor() {
        super('equalLength');
        this.selectedSegments = [];
        this.tickCount = 1; // 현재 틱 개수
    }

    activate(app) {
        super.activate(app);
        this.selectedSegments = [];
    }

    cancel(app) {
        super.cancel(app);
        this.selectedSegments = [];
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        // 선분만 선택 가능
        const segment = app.objectManager.findObjectAt(mathPos, 8, app.canvas,
            obj => obj.type === ObjectType.SEGMENT
        );

        if (!segment) {
            app.showToast('같은 길이로 표시할 선분 2개를 선택하세요.', 'warning');
            return;
        }

        // 이미 선택된 선분인지 확인
        if (this.selectedSegments.some(s => s.id === segment.id)) {
            return;
        }

        this.selectedSegments.push(segment);

        if (this.selectedSegments.length < 2) {
            app.showToast('두 번째 선분을 선택하세요.', 'info');
        } else {
            // 같은 길이 표시 생성
            const marker = app.objectManager.createEqualLengthMarker(
                this.selectedSegments[0].id,
                this.selectedSegments[1].id,
                { tickCount: this.tickCount }
            );

            app.historyManager.recordCreate(marker);
            app.objectManager.selectObject(marker);
            app.showToast('같은 길이 표시 생성', 'success');

            // 다음 표시를 위해 틱 개수 증가
            this.tickCount++;
            app.toolManager.returnToSelect();
            this.selectedSegments = [];
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        const segment = app.objectManager.findObjectAt(mathPos, 8, app.canvas,
            obj => obj.type === ObjectType.SEGMENT
        );
        app.objectManager.highlightObject(segment);
        app.render();
    }

    render(canvas, app) {
        // 선택된 선분 강조
        for (const segment of this.selectedSegments) {
            if (segment.valid) {
                canvas.drawSegment(segment.getPoint1(), segment.getPoint2(), {
                    color: '#8b5cf6',
                    width: 3
                });
            }
        }
    }
}

export default { RightAngleTool, EqualLengthTool };
