/**
 * FunctionTool.js - 함수 관련 도구들
 */

import { Tool } from './Tool.js';

/**
 * 함수 그래프 도구
 */
export class FunctionTool extends Tool {
    constructor() {
        super('function');
    }

    activate(app) {
        super.activate(app);
        // 함수 입력 모달 열기
        app.showFunctionModal();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        // 함수 클릭 시 선택
        const func = app.objectManager.findObjectAt(mathPos, 8, app.canvas,
            obj => obj.type === 'function'
        );

        if (func) {
            app.objectManager.selectObject(func);
            app.render();
        } else {
            // 새 함수 입력
            app.showFunctionModal();
        }
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        const func = app.objectManager.findObjectAt(mathPos, 8, app.canvas,
            obj => obj.type === 'function'
        );
        app.objectManager.highlightObject(func);
        app.render();
    }
}

/**
 * 함수 접선 도구
 */
export class TangentFunctionTool extends Tool {
    constructor() {
        super('tangentFunction');
        this.selectedFunction = null;
    }

    activate(app) {
        super.activate(app);
        this.selectedFunction = null;
    }

    cancel(app) {
        super.cancel(app);
        this.selectedFunction = null;
        app.render();
    }

    onMouseDown(mathPos, screenPos, event, app) {
        if (!this.selectedFunction) {
            // 함수 선택
            const func = app.objectManager.findObjectAt(mathPos, 8, app.canvas,
                obj => obj.type === 'function'
            );

            if (func) {
                this.selectedFunction = func;
                app.showToast('접선을 그릴 x 좌표를 클릭하세요.', 'info');
            } else {
                app.showToast('먼저 함수 그래프를 선택하세요.', 'warning');
            }
        } else {
            // 접점 x 좌표 선택
            const x = mathPos.x;

            const tangent = app.objectManager.createTangentFunction(this.selectedFunction.id, x);

            if (tangent.valid) {
                app.historyManager.recordCreate(tangent);
                app.objectManager.selectObject(tangent);
                app.showToast(`함수 접선 ${tangent.label} 생성`, 'success');
                app.toolManager.returnToSelect();
            } else {
                app.showToast('해당 위치에서 접선을 구할 수 없습니다.', 'error');
                app.objectManager.removeObject(tangent.id);
            }

            this.selectedFunction = null;
        }

        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        if (!this.selectedFunction) {
            const func = app.objectManager.findObjectAt(mathPos, 8, app.canvas,
                obj => obj.type === 'function'
            );
            app.objectManager.highlightObject(func);
        }
        app.render();
    }

    render(canvas, app) {
        if (this.selectedFunction) {
            // 선택된 함수 강조
            canvas.drawFunction(this.selectedFunction.getFunction(), {
                color: '#f97316',
                width: 3
            });
        }
    }
}

export default { FunctionTool, TangentFunctionTool };
