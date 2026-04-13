/**
 * SchemaValidator.js - AI output JSON schema validator (Mk.2)
 */

import { parseAIJSONPayload } from './JSONUtils.js';

/**
 * Validation result wrapper.
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
 * AI output schema validator.
 */
export class SchemaValidator {
    constructor() {
        this.validTypes = [
            'point', 'pointOnLine', 'pointOnCircle', 'circleCenterPoint',
            'segment', 'line', 'ray', 'circle', 'circleThreePoints',
            'intersection', 'midpoint', 'parallel', 'perpendicular',
            'perpendicularBisector', 'angleBisector', 'tangentCircle', 'tangentFunction', 'function',
            'vector', 'rightAngleMarker', 'equalLengthMarker',
            'angleDimension', 'lengthDimension',
            'arc', 'sector', 'circularSegment',
            'prism', 'pyramid', 'numberLine'
        ];

        this.validOperations = ['create', 'update', 'delete'];

        this.requiredFields = {
            point: ['x', 'y'],
            pointOnLine: ['lineId'],
            pointOnCircle: ['circleId'],
            circleCenterPoint: ['circleId'],
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
            rightAngleMarker: ['vertexId', 'line1Id', 'line2Id'],
            equalLengthMarker: ['segment1Id', 'segment2Id'],
            angleDimension: ['vertexId', 'point1Id', 'point2Id'],
            lengthDimension: ['segmentId'],
            arc: ['circleId', 'startPointId', 'endPointId'],
            sector: ['circleId', 'startPointId', 'endPointId'],
            circularSegment: ['circleId', 'startPointId', 'endPointId'],
            prism: ['baseVertexIds', 'topVertexIds'],
            pyramid: ['baseVertexIds', 'apexId'],
            numberLine: ['start', 'end', 'step', 'y']
        };
    }

    parseAndValidate(response) {
        try {
            const data = parseAIJSONPayload(response);
            return this.validate(data);
        } catch (e) {
            return ValidationResult.failure(`JSON parse failed: ${e.message}`);
        }
    }

    validate(data) {
        const result = ValidationResult.success();
        const operations = data.operations || (Array.isArray(data) ? data : [data]);

        if (!Array.isArray(operations)) {
            return ValidationResult.failure('operations must be an array.');
        }

        if (operations.length === 0) {
            return ValidationResult.failure('operations is empty.');
        }

        for (let i = 0; i < operations.length; i++) {
            const op = operations[i];
            const opErrors = this.validateOperation(op, i);
            for (const err of opErrors) {
                result.addError(err);
            }
        }

        return result;
    }

    validateOperation(op, index) {
        const errors = [];
        const prefix = `operations[${index}]`;

        if (!op.op) {
            errors.push(`${prefix}: op field is missing.`);
        } else if (!this.validOperations.includes(op.op)) {
            errors.push(`${prefix}: unsupported operation "${op.op}". Valid values: ${this.validOperations.join(', ')}`);
        }

        if (!op.id && op.op !== 'create') {
            errors.push(`${prefix}: update/delete operations require id.`);
        }

        if (op.op === 'create') {
            if (!op.type) {
                errors.push(`${prefix}: create operations require type.`);
            } else if (!this.validTypes.includes(op.type)) {
                errors.push(`${prefix}: unsupported type "${op.type}". Valid values: ${this.validTypes.join(', ')}`);
            } else {
                const required = this.requiredFields[op.type] || [];
                for (const field of required) {
                    if (op[field] === undefined) {
                        errors.push(`${prefix}: ${op.type} requires field "${field}".`);
                    }
                }
            }
        }

        if (op.baseVertexIds !== undefined && !Array.isArray(op.baseVertexIds)) {
            errors.push(`${prefix}: baseVertexIds must be an array.`);
        }

        if (op.topVertexIds !== undefined && !Array.isArray(op.topVertexIds)) {
            errors.push(`${prefix}: topVertexIds must be an array.`);
        }

        if (op.type === 'prism') {
            if (Array.isArray(op.baseVertexIds) && op.baseVertexIds.length < 3) {
                errors.push(`${prefix}: prism baseVertexIds must contain at least 3 vertices.`);
            }
            if (Array.isArray(op.baseVertexIds) && Array.isArray(op.topVertexIds) &&
                op.topVertexIds.length !== op.baseVertexIds.length) {
                errors.push(`${prefix}: prism topVertexIds must have the same length as baseVertexIds.`);
            }
        }

        if (op.type === 'pyramid' && Array.isArray(op.baseVertexIds) && op.baseVertexIds.length < 3) {
            errors.push(`${prefix}: pyramid baseVertexIds must contain at least 3 vertices.`);
        }

        if (op.type === 'numberLine') {
            const numericFields = ['start', 'end', 'step', 'y', 'tickHeight'];
            for (const field of numericFields) {
                if (op[field] !== undefined && !Number.isFinite(op[field])) {
                    errors.push(`${prefix}: numberLine ${field} must be a finite number.`);
                }
            }

            if (Number.isFinite(op.start) && Number.isFinite(op.end) && op.start >= op.end) {
                errors.push(`${prefix}: numberLine start must be less than end.`);
            }

            if (Number.isFinite(op.step) && op.step <= 0) {
                errors.push(`${prefix}: numberLine step must be greater than 0.`);
            }

            if (op.showArrows !== undefined && typeof op.showArrows !== 'boolean') {
                errors.push(`${prefix}: numberLine showArrows must be a boolean.`);
            }

            if (op.customMarks !== undefined && !Array.isArray(op.customMarks)) {
                errors.push(`${prefix}: numberLine customMarks must be an array.`);
            }
        }

        return errors;
    }

    validateReferences(data, existingIds) {
        const result = ValidationResult.success();
        const operations = data.operations || (Array.isArray(data) ? data : [data]);

        const newIds = new Set();
        const deletedIds = new Set();

        for (let i = 0; i < operations.length; i++) {
            const op = operations[i];

            if (op.op === 'create' && op.id) {
                newIds.add(op.id);
            }

            if ((op.op === 'update' || op.op === 'delete') && op.id) {
                if (!existingIds.has(op.id) && !newIds.has(op.id)) {
                    result.addError(`operations[${i}]: id="${op.id}" does not exist.`);
                }
            }

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
                        result.addError(`operations[${i}]: ${field}="${refId}" does not exist.`);
                    } else if (deletedIds.has(refId)) {
                        result.addError(`operations[${i}]: ${field}="${refId}" was deleted earlier in the batch.`);
                    }
                }
            }

            if (op.baseVertexIds && Array.isArray(op.baseVertexIds)) {
                for (const refId of op.baseVertexIds) {
                    if (!existingIds.has(refId) && !newIds.has(refId)) {
                        result.addError(`operations[${i}]: baseVertexIds item "${refId}" does not exist.`);
                    } else if (deletedIds.has(refId)) {
                        result.addError(`operations[${i}]: baseVertexIds item "${refId}" was deleted earlier in the batch.`);
                    }
                }
            }

            if (op.topVertexIds && Array.isArray(op.topVertexIds)) {
                for (const refId of op.topVertexIds) {
                    if (!existingIds.has(refId) && !newIds.has(refId)) {
                        result.addError(`operations[${i}]: topVertexIds item "${refId}" does not exist.`);
                    } else if (deletedIds.has(refId)) {
                        result.addError(`operations[${i}]: topVertexIds item "${refId}" was deleted earlier in the batch.`);
                    }
                }
            }

            if (op.op === 'delete' && op.id) {
                deletedIds.add(op.id);
            }
        }

        return result;
    }
}

export default SchemaValidator;
