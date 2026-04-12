/**
 * MathUtils.js - 수학 유틸리티 함수
 */

export const MathUtils = {
    // 상수
    EPSILON: 1e-10,
    PI: Math.PI,
    TAU: Math.PI * 2,
    
    /**
     * 부동소수점 비교
     */
    isZero(val) {
        return Math.abs(val) < this.EPSILON;
    },
    
    isEqual(a, b) {
        return Math.abs(a - b) < this.EPSILON;
    },
    
    /**
     * 값 제한
     */
    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    },
    
    /**
     * 선형 보간
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },
    
    /**
     * 각도 변환
     */
    degToRad(deg) {
        return deg * (Math.PI / 180);
    },
    
    radToDeg(rad) {
        return rad * (180 / Math.PI);
    },
    
    /**
     * 각도 정규화 (0 ~ 2π)
     */
    normalizeAngle(angle) {
        while (angle < 0) angle += this.TAU;
        while (angle >= this.TAU) angle -= this.TAU;
        return angle;
    },
    
    /**
     * 두 각도 사이의 차이 (-π ~ π)
     */
    angleDiff(a, b) {
        let diff = b - a;
        while (diff < -Math.PI) diff += this.TAU;
        while (diff > Math.PI) diff -= this.TAU;
        return diff;
    },
    
    /**
     * 부호 함수
     */
    sign(val) {
        if (this.isZero(val)) return 0;
        return val > 0 ? 1 : -1;
    },
    
    /**
     * 이차방정식 해 (ax² + bx + c = 0)
     * @returns {number[]|null} 해 배열 또는 null (해 없음)
     */
    solveQuadratic(a, b, c) {
        if (this.isZero(a)) {
            // 일차방정식
            if (this.isZero(b)) return null;
            return [-c / b];
        }
        
        const discriminant = b * b - 4 * a * c;
        
        if (discriminant < -this.EPSILON) {
            return null; // 실근 없음
        }
        
        if (this.isZero(discriminant)) {
            return [-b / (2 * a)];
        }
        
        const sqrtD = Math.sqrt(discriminant);
        return [
            (-b + sqrtD) / (2 * a),
            (-b - sqrtD) / (2 * a)
        ];
    },
    
    /**
     * 난수 생성 (min ~ max)
     */
    random(min, max) {
        return Math.random() * (max - min) + min;
    },
    
    /**
     * 정수 난수 생성 (min ~ max, inclusive)
     */
    randomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
};

export default MathUtils;
