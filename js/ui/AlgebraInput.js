/**
 * AlgebraInput.js - 대수식 입력창 (Mk.2)
 * 
 * 지원하는 표현식:
 * - 점: A = (2, 0) 또는 (2, 0)
 * - 상수: a = 5
 * - 함수: y = x^2, f(x) = x^2 - 2x
 * - 원: (x-2)^2 + (y-3)^2 = 25 또는 center=(2,3), r=5
 */

export class AlgebraInput {
    constructor(objectManager) {
        this.objectManager = objectManager;
    }

    /**
     * 대수식 파싱 및 객체 생성
     * @param {string} expression - 입력된 대수식
     * @returns {object} - { success, message, object }
     */
    parse(expression) {
        const expr = expression.trim();

        if (!expr) {
            return { success: false, message: '표현식을 입력해주세요.' };
        }

        // 점 표현식: A = (2, 0) 또는 (2, 0)
        const pointResult = this.parsePoint(expr);
        if (pointResult) return pointResult;

        // 함수 표현식: y = x^2, f(x) = ...
        const funcResult = this.parseFunction(expr);
        if (funcResult) return funcResult;

        // 원 표현식: (x-h)^2 + (y-k)^2 = r^2
        const circleResult = this.parseCircle(expr);
        if (circleResult) return circleResult;

        return {
            success: false,
            message: '인식할 수 없는 표현식입니다. 예: A=(2,0), y=x^2, (x-2)^2+(y-3)^2=25'
        };
    }

    /**
     * 점 표현식 파싱
     * 형식: A = (x, y) 또는 (x, y)
     */
    parsePoint(expr) {
        // A = (2, 0) 형식
        const namedPointMatch = expr.match(/^([A-Z])\s*=\s*\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\)$/i);
        if (namedPointMatch) {
            const label = namedPointMatch[1].toUpperCase();
            const x = parseFloat(namedPointMatch[2]);
            const y = parseFloat(namedPointMatch[3]);

            const point = this.objectManager.createPoint(x, y, { label });
            return {
                success: true,
                message: `점 ${label}(${x}, ${y}) 생성`,
                object: point
            };
        }

        // (2, 0) 형식 (이름 없음)
        const pointMatch = expr.match(/^\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\)$/);
        if (pointMatch) {
            const x = parseFloat(pointMatch[1]);
            const y = parseFloat(pointMatch[2]);

            const point = this.objectManager.createPoint(x, y);
            return {
                success: true,
                message: `점 ${point.label}(${x}, ${y}) 생성`,
                object: point
            };
        }

        return null;
    }

    /**
     * 함수 표현식 파싱
     * 형식: y = expression 또는 f(x) = expression
     */
    parseFunction(expr) {
        // y = expression 형식
        const yMatch = expr.match(/^y\s*=\s*(.+)$/i);
        if (yMatch) {
            const funcExpr = yMatch[1].trim();
            try {
                const func = this.objectManager.createFunction(funcExpr);
                return {
                    success: true,
                    message: `함수 y = ${funcExpr} 생성`,
                    object: func
                };
            } catch (e) {
                return {
                    success: false,
                    message: `함수 파싱 오류: ${e.message}`
                };
            }
        }

        // f(x) = expression 형식
        const fxMatch = expr.match(/^([a-z])\s*\(\s*x\s*\)\s*=\s*(.+)$/i);
        if (fxMatch) {
            const label = fxMatch[1];
            const funcExpr = fxMatch[2].trim();
            try {
                const func = this.objectManager.createFunction(funcExpr, { label });
                return {
                    success: true,
                    message: `함수 ${label}(x) = ${funcExpr} 생성`,
                    object: func
                };
            } catch (e) {
                return {
                    success: false,
                    message: `함수 파싱 오류: ${e.message}`
                };
            }
        }

        return null;
    }

    /**
     * 원 표현식 파싱
     * 형식: (x-h)^2 + (y-k)^2 = r^2 또는 center=(h,k), r=r
     */
    parseCircle(expr) {
        // center=(h,k), r=r 형식
        const simpleMatch = expr.match(/center\s*=\s*\(\s*([+-]?\d*\.?\d+)\s*,\s*([+-]?\d*\.?\d+)\s*\)\s*,\s*r\s*=\s*([+-]?\d*\.?\d+)/i);
        if (simpleMatch) {
            const h = parseFloat(simpleMatch[1]);
            const k = parseFloat(simpleMatch[2]);
            const r = parseFloat(simpleMatch[3]);

            return this.createCircleFromParams(h, k, r);
        }

        // (x-h)^2 + (y-k)^2 = r^2 형식
        // 정규화된 형태: (x-2)^2+(y-3)^2=25
        const standardMatch = expr.match(/\(\s*x\s*([+-]\s*\d*\.?\d+)?\s*\)\s*\^\s*2\s*\+\s*\(\s*y\s*([+-]\s*\d*\.?\d+)?\s*\)\s*\^\s*2\s*=\s*(\d*\.?\d+)/i);
        if (standardMatch) {
            // x - h => h = -coefficient
            const hStr = standardMatch[1] ? standardMatch[1].replace(/\s/g, '') : '0';
            const kStr = standardMatch[2] ? standardMatch[2].replace(/\s/g, '') : '0';
            const h = hStr === '0' ? 0 : -parseFloat(hStr);
            const k = kStr === '0' ? 0 : -parseFloat(kStr);
            const r2 = parseFloat(standardMatch[3]);
            const r = Math.sqrt(r2);

            return this.createCircleFromParams(h, k, r);
        }

        // x^2 + y^2 = r^2 형식 (원점 중심)
        const originMatch = expr.match(/x\s*\^\s*2\s*\+\s*y\s*\^\s*2\s*=\s*(\d*\.?\d+)/i);
        if (originMatch) {
            const r2 = parseFloat(originMatch[1]);
            const r = Math.sqrt(r2);

            return this.createCircleFromParams(0, 0, r);
        }

        return null;
    }

    /**
     * 중심과 반지름으로 원 생성
     */
    createCircleFromParams(h, k, r) {
        // 중심점 생성
        const center = this.objectManager.createPoint(h, k);

        // 원 위의 점 생성 (오른쪽)
        const onCircle = this.objectManager.createPoint(h + r, k);

        // 원 생성
        const circle = this.objectManager.createCircle(center.id, onCircle.id);

        return {
            success: true,
            message: `원 생성: 중심(${h}, ${k}), 반지름=${r.toFixed(2)}`,
            object: circle
        };
    }
}

export default AlgebraInput;
