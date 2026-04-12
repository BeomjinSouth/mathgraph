/**
 * Function.js - 함수 그래프 객체
 */

import { GeoObject, ObjectType } from './GeoObject.js';
import { Vec2, Geometry } from '../utils/Geometry.js';
import { FunctionParser } from '../utils/Parser.js';
import { MathUtils } from '../utils/MathUtils.js';

/**
 * 함수 그래프 (Function Graph)
 */
export class FunctionGraph extends GeoObject {
    constructor(expression, params = {}) {
        super(ObjectType.FUNCTION, params);
        this.expression = expression;
        this._fn = null;
        this._error = null;

        // 도메인 제한 (x 범위)
        this.xMin = params.xMin !== undefined ? params.xMin : null;
        this.xMax = params.xMax !== undefined ? params.xMax : null;

        // 라벨 수학 좌표 위치 (null이면 자동 계산)
        this._labelMathPos = params.labelMathPos || null;
        // 라벨이 드래그 중인지 여부
        this._labelDragging = false;

        this.parseExpression();
    }

    parseExpression() {
        try {
            this._fn = FunctionParser.parse(this.expression);
            this._error = null;
            this.valid = true;
        } catch (error) {
            this._fn = null;
            this._error = error.message;
            this.valid = false;
        }
    }

    setExpression(expression) {
        this.expression = expression;
        this.parseExpression();
    }

    update() {
        // 함수는 의존성이 없으므로 update 불필요
    }

    /**
     * 도메인 설정
     */
    setDomain(xMin, xMax) {
        this.xMin = xMin;
        this.xMax = xMax;
    }

    /**
     * 도메인 문자열 반환 (예: "1 < x < 3")
     */
    getDomainString() {
        if (this.xMin !== null && this.xMax !== null) {
            return `${this.xMin} < x < ${this.xMax}`;
        } else if (this.xMin !== null) {
            return `x > ${this.xMin}`;
        } else if (this.xMax !== null) {
            return `x < ${this.xMax}`;
        }
        return '';
    }

    /**
     * 라벨의 수학 좌표 위치 계산
     * 사용자가 드래그했으면 그 위치, 아니면 자동 계산 후 고정
     */
    getLabelPosition(canvas) {
        if (!this._fn) return null;

        // 이미 설정된 위치가 있으면 그대로 사용
        if (this._labelMathPos) {
            return this._labelMathPos.clone();
        }

        // 자동 계산: 화면 중앙 근처의 그래프 위치
        const bounds = canvas.getVisibleBounds();
        let labelX = (bounds.maxX + bounds.minX) / 2;

        // 도메인 제한 고려
        if (this.xMin !== null && labelX < this.xMin) labelX = this.xMin + 0.5;
        if (this.xMax !== null && labelX > this.xMax) labelX = this.xMax - 0.5;

        const labelY = this._fn(labelX);

        if (!isFinite(labelY) || labelY < bounds.minY || labelY > bounds.maxY) {
            return null;
        }

        // 자동 계산된 위치를 저장하여 화면 이동 시에도 고정
        this._labelMathPos = new Vec2(labelX, labelY);
        return this._labelMathPos.clone();
    }

    /**
     * 라벨 텍스트 계산 (라벨이 수식 형태이면 중복 방지)
     */
    getLabelText() {
        // 라벨이 수식 형태인지 확인 (y=, f(x)= 등으로 시작하거나 x를 포함)
        const isEquationLabel = /^(y\s*=|f\s*\(x\)\s*=)|x/.test(this.label);

        let displayExpr = this.expression;

        // 삼각함수/로그 등에서 괄호 제거: sin(x) → sinx, log(x) → logx
        displayExpr = displayExpr.replace(/\b(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|exp)\(([a-zA-Z])\)/g, '$1$2');

        // 괄호 안에 단일 변수가 있는 경우만 제거 (복잡한 표현은 유지)
        // 예: sin(x) → sinx, 하지만 sin(2x)는 유지

        if (isEquationLabel) {
            // 라벨 자체가 수식이면 괄호 제거 적용
            let displayLabel = this.label;
            displayLabel = displayLabel.replace(/\b(sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|exp)\(([a-zA-Z])\)/g, '$1$2');
            return displayLabel;
        } else {
            // 함수명(x) = 수식 형태로 표시
            return `${this.label}(x) = ${displayExpr}`;
        }
    }

    /**
     * 라벨 영역 계산 (화면 좌표, 히트 테스트용)
     */
    getLabelBounds(canvas) {
        const pos = this.getLabelPosition(canvas);
        if (!pos) return null;

        const screenPos = canvas.toScreen(pos);
        const offsetX = this.labelOffset.x;
        const offsetY = this.labelOffset.y;

        // 라벨 텍스트 크기 추정
        const text = this.getLabelText();
        const width = text.length * this.fontSize * 0.55;
        const height = this.fontSize * 1.2;

        return {
            x: screenPos.x + offsetX,
            y: screenPos.y + offsetY - height,
            width: width,
            height: height
        };
    }

    render(canvas) {
        if (!this.visible || !this.valid || !this._fn) return;

        // 도메인 제한 적용하여 그래프 그리기
        canvas.drawFunction(this._fn, {
            color: this.color,
            width: this.lineWidth,
            highlighted: this.highlighted,
            selected: this.selected,
            xMin: this.xMin,
            xMax: this.xMax
        });

        if (this.showLabel && this.label) {
            const pos = this.getLabelPosition(canvas);

            if (pos) {
                const labelText = this.getLabelText();

                // 사용자가 드래그한 위치가 있으면 offset 무시
                const offsetX = this._labelMathPos ? 0 : this.labelOffset.x;
                const offsetY = this._labelMathPos ? 0 : this.labelOffset.y;

                canvas.drawMathLabel(pos, labelText, {
                    fontSize: this.fontSize,
                    color: this.color,
                    offsetX: offsetX,
                    offsetY: offsetY,
                    background: this.selected ? 'rgba(99, 102, 241, 0.1)' : null,
                    border: this.selected ? '1px solid rgba(99, 102, 241, 0.5)' : null
                });
            }
        }
    }

    /**
     * 라벨 히트 테스트
     */
    labelHitTest(point, canvas) {
        if (!this.showLabel || !this.label) return false;

        const bounds = this.getLabelBounds(canvas);
        if (!bounds) return false;

        const screenPoint = canvas.toScreen(point);

        return screenPoint.x >= bounds.x &&
            screenPoint.x <= bounds.x + bounds.width &&
            screenPoint.y >= bounds.y &&
            screenPoint.y <= bounds.y + bounds.height;
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid || !this._fn) return false;

        // 라벨 히트 테스트 우선
        if (this.labelHitTest(point, canvas)) {
            return true;
        }

        const screenThreshold = canvas.toMathLength(threshold);

        // 주변 x 값들에서 y 값 계산하여 근접 여부 확인
        const testPoints = [-0.1, -0.05, 0, 0.05, 0.1];

        for (const dx of testPoints) {
            const x = point.x + dx;
            const y = this._fn(x);

            if (isFinite(y)) {
                const dist = Math.abs(point.y - y);
                if (dist <= screenThreshold) {
                    return true;
                }
            }
        }

        return false;
    }

    isDraggable() {
        // 라벨이 드래그 중이거나 라벨이 표시 중일 때 드래그 가능
        // (실제 드래그 여부는 startDrag에서 라벨 영역 확인)
        return this._labelDragging || (this.showLabel && this.label);
    }

    /**
     * 드래그 시작 - 라벨 클릭 시에만 드래그 가능
     */
    startDrag(point, canvas, objectManager) {
        if (this.labelHitTest(point, canvas)) {
            this._labelDragging = true;
            // 드래그 시작 시 수학 좌표 저장
            this._dragStartMathPos = point.clone();
            // 현재 라벨 수학 좌표 저장
            this._labelStartMathPos = this._labelMathPos ?
                this._labelMathPos.clone() :
                this.getLabelPosition(canvas);
            return true;
        }
        return false;
    }

    /**
     * 드래그 중 - 라벨 위치 업데이트 (마우스를 따라 자유롭게 이동)
     */
    drag(point, delta, canvas, objectManager) {
        if (this._labelDragging && this._dragStartMathPos && this._labelStartMathPos) {
            // 드래그 시작점으로부터의 수학 좌표 이동량
            const mathDelta = point.sub(this._dragStartMathPos);

            // 새 라벨 수학 좌표
            this._labelMathPos = new Vec2(
                this._labelStartMathPos.x + mathDelta.x,
                this._labelStartMathPos.y + mathDelta.y
            );
        }
    }

    /**
     * 드래그 종료
     */
    endDrag() {
        this._labelDragging = false;
        delete this._dragStartMathPos;
        delete this._labelStartMathPos;
    }

    /**
     * 라벨 위치 초기화
     */
    resetLabelPosition() {
        this._labelMathPos = null;
        this.labelOffset = new Vec2(0, 0);
    }

    getFunction() {
        return this._fn;
    }

    getError() {
        return this._error;
    }

    /**
     * x 값에서의 y 값
     */
    evaluate(x) {
        if (!this._fn) return NaN;
        return this._fn(x);
    }

    /**
     * x 값에서의 미분값 (기울기)
     */
    derivative(x) {
        if (!this._fn) return NaN;
        const df = FunctionParser.derivative(this._fn);
        return df(x);
    }

    toJSON() {
        return {
            ...super.toJSON(),
            expression: this.expression,
            labelX: this._labelX,
            labelOffset: { x: this.labelOffset.x, y: this.labelOffset.y }
        };
    }

    static fromJSON(data) {
        const func = new FunctionGraph(data.expression, data);
        func.id = data.id;
        if (data.labelX !== undefined) {
            func._labelX = data.labelX;
        }
        return func;
    }
}

/**
 * 함수의 접선 (Tangent Line to Function)
 */
export class TangentFunction extends GeoObject {
    constructor(functionId, x = 0, params = {}) {
        super(ObjectType.TANGENT_FUNCTION, params);
        this.functionId = functionId;
        this.x = x; // 접점의 x 좌표
        this.addDependency(functionId);

        this._p1 = new Vec2(0, 0);
        this._p2 = new Vec2(0, 0);
        this._tangentPoint = new Vec2(0, 0);
        this._slope = 0;
    }

    update(objectManager) {
        const funcObj = objectManager.getObject(this.functionId);

        if (!funcObj || !funcObj.valid) {
            this.valid = false;
            return;
        }

        const tangent = FunctionParser.tangentAt(funcObj.getFunction(), this.x);

        if (!tangent) {
            this.valid = false;
            return;
        }

        this._tangentPoint = new Vec2(tangent.point.x, tangent.point.y);
        this._slope = tangent.slope;

        // 접선의 두 점 계산
        const dir = new Vec2(1, tangent.slope).normalize();
        this._p1 = this._tangentPoint.sub(dir.mul(10));
        this._p2 = this._tangentPoint.add(dir.mul(10));

        this.valid = true;
    }

    render(canvas) {
        if (!this.visible || !this.valid) return;

        // 접선 그리기
        canvas.drawLine(this._p1, this._p2, {
            color: this.color,
            width: this.lineWidth,
            dashed: this.dashed,
            highlighted: this.highlighted,
            selected: this.selected
        });

        // 접점 표시
        canvas.drawPoint(this._tangentPoint, {
            radius: 4,
            color: this.color,
            highlighted: this.highlighted,
            selected: this.selected
        });

        if (this.showLabel && this.label) {
            canvas.drawLabel(this._tangentPoint, this.label, {
                fontSize: this.fontSize,
                color: this.color
            });
        }
    }

    hitTest(point, threshold, canvas) {
        if (!this.valid) return false;

        const screenThreshold = canvas.toMathLength(threshold);
        const dist = Geometry.pointToLineDistance(point, this._p1, this._p2);
        return dist <= screenThreshold;
    }

    // 접선 드래그: x 좌표 변경
    startDrag(point, canvas, objectManager) {
        this._dragStartX = this.x;
    }

    drag(point, delta, canvas, objectManager) {
        const funcObj = objectManager.getObject(this.functionId);
        if (!funcObj) return;

        // 마우스 x 좌표로 접선 위치 변경
        this.x = point.x;
    }

    endDrag() {
        delete this._dragStartX;
    }

    isDraggable() {
        return !this.locked && this.visible;
    }

    getPoint1() {
        return this._p1.clone();
    }

    getPoint2() {
        return this._p2.clone();
    }

    getDirection() {
        return this._p2.sub(this._p1).normalize();
    }

    getTangentPoint() {
        return this._tangentPoint.clone();
    }

    getSlope() {
        return this._slope;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            functionId: this.functionId,
            x: this.x
        };
    }
}

export default { FunctionGraph, TangentFunction };
