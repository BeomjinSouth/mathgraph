/**
 * SchemaValidator.js - AI 출력 JSON 스키마 검증 (Mk.2)
 * 
 * AI가 생성한 JSON 출력이 올바른지 검증합니다.
 */

/**
 * 에러 결과 클래스
 */
export class ValidationResult {
    constructor(valid, errors = []) {
        this.valid = valid;
        this.errors = errors;
    }

    static success() {
        return new ValidationResult(true, []);
    }

    static failure(errors) {
        return new ValidationResult(false, Array.isArray(errors) ? errors : [errors]);
    }

    addError(error) {
        this.errors.push(error);
        this.valid = false;
    }
}

/**
 * AI 출력 스키마 검증기
 */
export class SchemaValidator {
    constructor() {
        // 유효한 객체 타입
        this.validTypes = [
            'point', 'segment', 'line', 'ray', 'circle', 'circleThreePoints',
            'intersection', 'midpoint', 'parallel', 'perpendicular',
            'perpendicularBisector', 'angleBisector', 'tangentCircle', 'tangentFunction', 'function',
            'vector', 'rightAngleMarker', 'equalLengthMarker',
            'arc', 'sector', 'circularSegment', // Mk.2
            'prism', 'pyramid' // 입체도형
        ];

        // 유효한 작업 타입
        this.validOperations = ['create', 'update', 'delete'];

        // 타입별 필수 필드
        this.requiredFields = {
            point: ['x', 'y'],
            segment: ['point1Id', 'point2Id'],
            line: ['point1Id', 'point2Id'],
            ray: ['originId', 'directionPointId'],
            circle: ['centerId', 'pointOnCircleId'],
            circleThreePoints: ['point1Id', 'point2Id', 'point3Id'],
            intersection: ['object1Id', 'object2Id'],
            midpoint: ['segmentId'],
            parallel: ['baseLineId', 'throughPointId'],
            perpendicular: ['baseLineId', 'throughPointId'],
            perpendicularBisector: ['segmentId'],
            angleBisector: ['line1Id', 'line2Id'],
            tangentCircle: ['circleId', 'tangentPointId'],
            tangentFunction: ['functionId', 'x'],
            function: ['expression'],
            vector: ['startPointId', 'endPointId'],
            arc: ['circleId', 'startPointId', 'endPointId'],
            sector: ['circleId', 'startPointId', 'endPointId'],
            circularSegment: ['circleId', 'startPointId', 'endPointId'],
            prism: ['baseVertexIds', 'topVertexIds'],
            pyramid: ['baseVertexIds', 'apexId']
        };
    }

    /**
     * AI 응답 파싱 및 검증
     * @param {string} response - AI 원문 응답
     * @returns {ValidationResult}
     */
    parseAndValidate(response) {
        // 1. JSON 파싱 시도
        let data;
        try {
            // 마크다운 코드 블록 제거
            let jsonStr = response.trim();
            if (jsonStr.startsWith('```json')) {
                jsonStr = jsonStr.slice(7);
            }
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.slice(3);
            }
            if (jsonStr.endsWith('```')) {
                jsonStr = jsonStr.slice(0, -3);
            }
            jsonStr = jsonStr.trim();

            data = JSON.parse(jsonStr);
        } catch (e) {
            return ValidationResult.failure(`JSON 파싱 실패: ${e.message}`);
        }

        // 2. 기본 구조 검증
        return this.validate(data);
    }

    /**
     * JSON 데이터 검증
     * @param {object} data - 파싱된 JSON 데이터
     * @returns {ValidationResult}
     */
    validate(data) {
        const result = ValidationResult.success();

        // operations 배열 또는 단일 객체 지원
        const operations = data.operations || (Array.isArray(data) ? data : [data]);

        if (!Array.isArray(operations)) {
            return ValidationResult.failure('operations는 배열이어야 합니다.');
        }

        if (operations.length === 0) {
            return ValidationResult.failure('operations가 비어있습니다.');
        }

        // 각 작업 검증
        for (let i = 0; i < operations.length; i++) {
            const op = operations[i];
            const opErrors = this.validateOperation(op, i);
            for (const err of opErrors) {
                result.addError(err);
            }
        }

        return result;
    }

    /**
     * 단일 작업 검증
     */
    validateOperation(op, index) {
        const errors = [];
        const prefix = `operations[${index}]`;

        // op 필드 검증
        if (!op.op) {
            errors.push(`${prefix}: op 필드가 없습니다.`);
        } else if (!this.validOperations.includes(op.op)) {
            errors.push(`${prefix}: 알 수 없는 작업 "${op.op}". 유효한 값: ${this.validOperations.join(', ')}`);
        }

        // id 필드 검증
        if (!op.id && op.op !== 'create') {
            errors.push(`${prefix}: update/delete 작업에는 id가 필요합니다.`);
        }

        // type 필드 검증 (create 시)
        if (op.op === 'create') {
            if (!op.type) {
                errors.push(`${prefix}: create 작업에는 type이 필요합니다.`);
            } else if (!this.validTypes.includes(op.type)) {
                errors.push(`${prefix}: 알 수 없는 타입 "${op.type}". 유효한 값: ${this.validTypes.join(', ')}`);
            } else {
                // 타입별 필수 필드 검증
                const required = this.requiredFields[op.type] || [];
                for (const field of required) {
                    if (op[field] === undefined) {
                        errors.push(`${prefix}: ${op.type} 타입에는 ${field} 필드가 필요합니다.`);
                    }
                }
            }
        }

        return errors;
    }

    /**
     * 참조 ID 존재 여부 검증
     * @param {object} data - 파싱된 JSON 데이터
     * @param {Set<string>} existingIds - 기존 객체 ID 집합
     * @returns {ValidationResult}
     */
    validateReferences(data, existingIds) {
        const result = ValidationResult.success();
        const operations = data.operations || (Array.isArray(data) ? data : [data]);

        // 이번 배치에서 생성될 ID 추적
        const newIds = new Set();

        for (let i = 0; i < operations.length; i++) {
            const op = operations[i];

            if (op.op === 'create' && op.id) {
                newIds.add(op.id);
            }

            // 참조 필드 확인
            const refFields = [
                'point1Id', 'point2Id', 'point3Id', 'centerId', 'pointOnCircleId',
                'originId', 'directionPointId', 'lineId', 'circleId', 'segmentId',
                'object1Id', 'object2Id', 'baseLineId', 'throughPointId',
                'startPointId', 'endPointId', 'functionId', 'vertexId',
                'line1Id', 'line2Id', 'segment1Id', 'segment2Id',
                'tangentPointId', 'apexId'
            ];

            for (const field of refFields) {
                if (op[field]) {
                    const refId = op[field];
                    if (!existingIds.has(refId) && !newIds.has(refId)) {
                        result.addError(`operations[${i}]: ${field}="${refId}"가 존재하지 않습니다.`);
                    }
                }
            }

            // 배열 참조 필드 (baseVertexIds, topVertexIds 등)
            if (op.baseVertexIds && Array.isArray(op.baseVertexIds)) {
                for (const refId of op.baseVertexIds) {
                    if (!existingIds.has(refId) && !newIds.has(refId)) {
                        result.addError(`operations[${i}]: baseVertexIds의 "${refId}"가 존재하지 않습니다.`);
                    }
                }
            }

            if (op.topVertexIds && Array.isArray(op.topVertexIds)) {
                for (const refId of op.topVertexIds) {
                    if (!existingIds.has(refId) && !newIds.has(refId)) {
                        result.addError(`operations[${i}]: topVertexIds의 "${refId}"가 존재하지 않습니다.`);
                    }
                }
            }
        }

        return result;
    }
}

export default SchemaValidator;
