/**
 * ConstructionTools.js - 기하 작도 도구들
 * 교점, 중점, 평행선, 수선, 수직이등분선, 각의 이등분선
 */

import { Tool } from './Tool.js';
import { Vec2 } from '../utils/Geometry.js';
import { ObjectType } from '../objects/GeoObject.js';

/**
 * 교점 도구
 */
export class IntersectionTool extends Tool {
    constructor() {
        super('intersection');
        this.firstObject = null;
    }

    activate(app) {
        super.activate(app);
        this.firstObject = null;
    }

    cancel(app) {
        super.cancel(app);
        this.firstObject = null;
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        // 선 또는 원 찾기
        const line = app.objectManager.findLineAt(mathPos, 8, app.canvas);
        const circle = app.objectManager.findCircleAt(mathPos, 8, app.canvas);
        const obj = line || circle;

        if (!obj) {
            app.showToast('선 또는 원을 선택하세요.', 'warning');
            return;
        }

        if (!this.firstObject) {
            this.firstObject = obj;
            app.showToast('두 번째 객체를 선택하세요.', 'info');
        } else {
            if (obj.id !== this.firstObject.id) {
                const intersection = app.objectManager.createIntersection(
                    this.firstObject.id,
                    obj.id,
                    mathPos // anchor
                );

                if (intersection.valid) {
                    app.historyManager.recordCreate(intersection);
                    app.objectManager.selectObject(intersection);
                    app.showToast(`교점 ${intersection.label} 생성`, 'success');
                    app.toolManager.returnToSelect();
                } else {
                    app.showToast('교점을 찾을 수 없습니다.', 'error');
                    app.objectManager.removeObject(intersection.id);
                }
            }

            this.firstObject = null;
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

/**
 * 중점 도구
 */
export class MidpointTool extends Tool {
    constructor() {
        super('midpoint');
    }

    onMouseDown(mathPos, screenPos, event, app) {
        // 선분만 허용
        const segment = app.objectManager.findObjectAt(mathPos, 8, app.canvas,
            obj => obj.type === ObjectType.SEGMENT
        );

        if (segment) {
            const midpoint = app.objectManager.createMidpoint(segment.id);
            app.historyManager.recordCreate(midpoint);
            app.objectManager.selectObject(midpoint);
            app.showToast(`중점 ${midpoint.label} 생성`, 'success');
            app.toolManager.returnToSelect();
        } else {
            app.showToast('선분을 선택하세요.', 'warning');
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
}

/**
 * 평행선 도구
 */
export class ParallelTool extends Tool {
    constructor() {
        super('parallel');
        this.baseLine = null;
    }

    activate(app) {
        super.activate(app);
        this.baseLine = null;
    }

    cancel(app) {
        super.cancel(app);
        this.baseLine = null;
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        if (!this.baseLine) {
            // 기준 선 선택
            const line = app.objectManager.findLineAt(mathPos, 8, app.canvas);

            if (line) {
                this.baseLine = line;
                app.showToast('평행선이 지나갈 점을 선택하세요.', 'info');
            } else {
                app.showToast('먼저 기준 선을 선택하세요.', 'warning');
            }
        } else {
            // 점 선택 또는 생성
            let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

            if (!point) {
                point = app.objectManager.createPoint(mathPos.x, mathPos.y);
                app.historyManager.recordCreate(point);
            }

            const parallel = app.objectManager.createParallelLine(this.baseLine.id, point.id);
            app.historyManager.recordCreate(parallel);
            app.objectManager.selectObject(parallel);
            app.showToast(`평행선 ${parallel.label} 생성`, 'success');
            app.toolManager.returnToSelect();

            this.baseLine = null;
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        if (!this.baseLine) {
            const line = app.objectManager.findLineAt(mathPos, 8, app.canvas);
            app.objectManager.highlightObject(line);
        } else {
            const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
            app.objectManager.highlightObject(point);
        }
        app.render();
    }
}

/**
 * 수선 도구
 */
export class PerpendicularTool extends Tool {
    constructor() {
        super('perpendicular');
        this.throughPoint = null;
    }

    activate(app) {
        super.activate(app);
        this.throughPoint = null;
    }

    cancel(app) {
        super.cancel(app);
        this.throughPoint = null;
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        if (!this.throughPoint) {
            // 점 선택 또는 생성
            let point = app.objectManager.findPointAt(mathPos, 8, app.canvas);

            if (!point) {
                point = app.objectManager.createPoint(mathPos.x, mathPos.y);
                app.historyManager.recordCreate(point);
            }

            this.throughPoint = point;
            app.showToast('기준 선을 선택하세요.', 'info');
        } else {
            // 기준 선 선택
            const line = app.objectManager.findLineAt(mathPos, 8, app.canvas);

            if (line) {
                const perp = app.objectManager.createPerpendicularLine(this.throughPoint.id, line.id);
                app.historyManager.recordCreate(perp);

                // 수선과 기준선의 교점 자동 생성
                const intersection = app.objectManager.createIntersection(perp.id, line.id, null);
                if (intersection.valid) {
                    app.historyManager.recordCreate(intersection);

                    // 직각 표시 자동 추가 (교점을 꼭짓점으로, throughPoint와 선의 한 점을 사용)
                    try {
                        // 기준선의 두 끝점 가져오기
                        const linePoint1Id = line.dependencies[0];
                        const linePoint2Id = line.dependencies[1];

                        if (linePoint1Id && linePoint2Id) {
                            // 교점 - throughPoint - linePoint1 으로 직각 표시
                            const angleDim = app.objectManager.createAngleDimension(
                                intersection.id,
                                this.throughPoint.id,
                                linePoint1Id
                            );
                            angleDim.arcRadius = 0.3;
                            app.historyManager.recordCreate(angleDim);
                        }
                    } catch (e) {
                        // 직각 표시 실패해도 계속 진행
                    }

                    app.showToast(`수선 ${perp.label} 및 교점 ${intersection.label} 생성`, 'success');
                } else {
                    app.objectManager.removeObject(intersection.id);
                    app.showToast(`수선 ${perp.label} 생성`, 'success');
                }

                app.objectManager.selectObject(perp);
                app.toolManager.returnToSelect();

                this.throughPoint = null;
            } else {
                app.showToast('기준 선을 선택하세요.', 'warning');
            }
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        if (!this.throughPoint) {
            const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
            app.objectManager.highlightObject(point);
        } else {
            const line = app.objectManager.findLineAt(mathPos, 8, app.canvas);
            app.objectManager.highlightObject(line);
        }
        app.render();
    }
}

/**
 * 수직이등분선 도구
 */
export class PerpendicularBisectorTool extends Tool {
    constructor() {
        super('perpendicularBisector');
    }

    onMouseDown(mathPos, screenPos, event, app) {
        const segment = app.objectManager.findObjectAt(mathPos, 8, app.canvas,
            obj => obj.type === ObjectType.SEGMENT
        );

        if (segment) {
            // 중점 자동 생성
            const midpoint = app.objectManager.createMidpoint(segment.id);
            app.historyManager.recordCreate(midpoint);

            // 수직이등분선 생성
            const bisector = app.objectManager.createPerpendicularBisector(segment.id);
            app.historyManager.recordCreate(bisector);

            // 직각 표시 자동 추가 (중점을 꼭짓점으로)
            try {
                const segPoint1Id = segment.dependencies[0];
                const segPoint2Id = segment.dependencies[1];

                // 수직이등분선 위의 두 번째 점 찾기 (bisector의 dependencies 중 midpoint가 아닌 것)
                const bisectorPoint2Id = bisector.dependencies.find(id => id !== midpoint.id);

                if (segPoint1Id && bisectorPoint2Id) {
                    const angleDim = app.objectManager.createAngleDimension(
                        midpoint.id,
                        segPoint1Id,
                        bisectorPoint2Id
                    );
                    angleDim.arcRadius = 0.3;
                    app.historyManager.recordCreate(angleDim);
                }
            } catch (e) {
                // 직각 표시 실패해도 계속 진행
            }

            app.objectManager.selectObject(bisector);
            app.showToast(`수직이등분선 ${bisector.label} 및 중점 ${midpoint.label} 생성`, 'success');
            app.toolManager.returnToSelect();
        } else {
            app.showToast('선분을 선택하세요.', 'warning');
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
}

/**
 * 각의 이등분선 도구
 */
export class AngleBisectorTool extends Tool {
    constructor() {
        super('angleBisector');
        this.firstLine = null;
        this.exterior = false; // 외각 이등분선 모드
    }

    activate(app) {
        super.activate(app);
        this.firstLine = null;
    }

    cancel(app) {
        super.cancel(app);
        this.firstLine = null;
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        const line = app.objectManager.findLineAt(mathPos, 8, app.canvas);

        if (!line) {
            app.showToast('선을 선택하세요.', 'warning');
            return;
        }

        if (!this.firstLine) {
            this.firstLine = line;
            app.showToast('두 번째 선을 선택하세요.', 'info');
        } else {
            if (line.id !== this.firstLine.id) {
                const bisector = app.objectManager.createAngleBisector(
                    this.firstLine.id,
                    line.id,
                    { exterior: this.exterior }
                );

                if (bisector.valid) {
                    app.historyManager.recordCreate(bisector);
                    app.objectManager.selectObject(bisector);
                    app.showToast(`각의 이등분선 ${bisector.label} 생성`, 'success');
                    app.toolManager.returnToSelect();
                } else {
                    app.showToast('두 선이 평행하여 이등분선을 만들 수 없습니다.', 'error');
                    app.objectManager.removeObject(bisector.id);
                }
            }

            this.firstLine = null;
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        const line = app.objectManager.findLineAt(mathPos, 8, app.canvas);
        app.objectManager.highlightObject(line);
        app.render();
    }
}

export default {
    IntersectionTool,
    MidpointTool,
    ParallelTool,
    PerpendicularTool,
    PerpendicularBisectorTool,
    AngleBisectorTool
};
