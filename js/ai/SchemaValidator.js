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
            'segment', 'line', 'ray', 'circle', 'circleThreePoints', 'ellipse', 'hyperbola', 'parabola',
            'intersection', 'midpoint', 'parallel', 'perpendicular',
            'perpendicularBisector', 'angleBisector', 'tangentCircle', 'tangentFunction', 'function',
            'vector', 'rightAngleMarker', 'equalLengthMarker',
            'angleDimension', 'lengthDimension',
            'arc', 'sector', 'circularSegment',
            'lensRegion', 'polygon', 'prism', 'pyramid', 'numberLine', 'textLabel',
            'cylinder', 'cone', 'sphere'
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
            ellipse: ['x', 'y', 'radiusX', 'radiusY'],
            hyperbola: ['x', 'y', 'a', 'b', 'orientation'],
            parabola: ['x', 'y', 'p', 'orientation'],
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
            lensRegion: ['circle1Id', 'circle2Id'],
            polygon: ['vertexIds'],
            prism: ['baseVertexIds', 'topVertexIds'],
            pyramid: ['baseVertexIds', 'apexId'],
            numberLine: ['start', 'end', 'step', 'y'],
            textLabel: ['text', 'x', 'y'],
            cylinder: ['x', 'y', 'width', 'height'],
            cone: ['x', 'y', 'width', 'height'],
            sphere: ['x', 'y', 'width', 'height']
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

        if (op.vertexIds !== undefined && !Array.isArray(op.vertexIds)) {
            errors.push(`${prefix}: vertexIds must be an array.`);
        }

        if (op.type === 'polygon' && Array.isArray(op.vertexIds) && op.vertexIds.length < 3) {
            errors.push(`${prefix}: polygon vertexIds must contain at least 3 vertices.`);
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

            if (op.customMarks !== undefined) {
                if (!Array.isArray(op.customMarks)) {
                    errors.push(`${prefix}: numberLine customMarks must be an array.`);
                } else {
                    op.customMarks.forEach((mark, markIndex) => {
                        const markPrefix = `${prefix}: numberLine customMarks[${markIndex}]`;
                        if (!mark || typeof mark !== 'object') {
                            errors.push(`${markPrefix} must be an object.`);
                            return;
                        }
                        if (!Number.isFinite(mark.value)) {
                            errors.push(`${markPrefix} value must be a finite number.`);
                        }
                        if (mark.endpoint !== undefined && !['open', 'closed'].includes(mark.endpoint)) {
                            errors.push(`${markPrefix} endpoint must be "open" or "closed".`);
                        }
                    });
                }
            }
        }

        if (op.pointStyle !== undefined) {
            const pointTypes = [
                'point', 'pointOnLine', 'pointOnCircle',
                'circleCenterPoint', 'intersection', 'midpoint'
            ];
            if (!['closed', 'open'].includes(op.pointStyle)) {
                errors.push(`${prefix}: pointStyle must be "closed" or "open".`);
            } else if (op.op === 'create' && op.type && !pointTypes.includes(op.type)) {
                errors.push(`${prefix}: pointStyle is supported only for point-like objects.`);
            }
        }

        if (op.type === 'textLabel') {
            if (typeof op.text !== 'string' || op.text.trim().length === 0) {
                errors.push(`${prefix}: textLabel text must be a non-empty string.`);
            }
            for (const field of ['x', 'y', 'fontSize']) {
                if (op[field] !== undefined && !Number.isFinite(op[field])) {
                    errors.push(`${prefix}: textLabel ${field} must be a finite number.`);
                }
            }
        }

        if (['cylinder', 'cone', 'sphere'].includes(op.type)) {
            for (const field of ['x', 'y', 'width', 'height', 'ellipseRatio']) {
                if (op[field] !== undefined && !Number.isFinite(op[field])) {
                    errors.push(`${prefix}: ${op.type} ${field} must be a finite number.`);
                }
            }
            if (Number.isFinite(op.width) && op.width <= 0) {
                errors.push(`${prefix}: ${op.type} width must be greater than 0.`);
            }
            if (Number.isFinite(op.height) && op.height <= 0) {
                errors.push(`${prefix}: ${op.type} height must be greater than 0.`);
            }
            if (op.showHiddenLines !== undefined && typeof op.showHiddenLines !== 'boolean') {
                errors.push(`${prefix}: ${op.type} showHiddenLines must be a boolean.`);
            }
        }

        const conicNumericFields = ['radiusX', 'radiusY', 'a', 'b', 'p', 'rotation'];
        for (const field of conicNumericFields) {
            if (op[field] !== undefined && !Number.isFinite(op[field])) {
                errors.push(`${prefix}: ${field} must be a finite number.`);
            }
        }
        for (const field of ['radiusX', 'radiusY', 'a', 'b', 'p']) {
            if (Number.isFinite(op[field]) && op[field] <= 0) {
                errors.push(`${prefix}: ${field} must be greater than 0.`);
            }
        }
        if (op.type === 'hyperbola' && op.orientation !== undefined &&
            !['horizontal', 'vertical'].includes(op.orientation)) {
            errors.push(`${prefix}: hyperbola orientation must be horizontal or vertical.`);
        }
        if (op.type === 'parabola' && op.orientation !== undefined &&
            !['right', 'left', 'up', 'down'].includes(op.orientation)) {
            errors.push(`${prefix}: parabola orientation must be right, left, up, or down.`);
        }
        if (op.type === 'ellipse' && op.orientation !== undefined) {
            errors.push(`${prefix}: ellipse uses rotation and does not use orientation.`);
        }

        if (op.text !== undefined && typeof op.text !== 'string') {
            errors.push(`${prefix}: text must be a string.`);
        }

        if (op.align !== undefined && !['left', 'center', 'right'].includes(op.align)) {
            errors.push(`${prefix}: align must be left, center, or right.`);
        }

        const rangeFields = ['xMin', 'xMax', 'yMin', 'yMax'];
        for (const field of rangeFields) {
            if (op[field] !== undefined && op[field] !== null && !Number.isFinite(op[field])) {
                errors.push(`${prefix}: ${field} must be a finite number or null.`);
            }
        }
        if (Number.isFinite(op.xMin) && Number.isFinite(op.xMax) && op.xMin >= op.xMax) {
            errors.push(`${prefix}: xMin must be less than xMax.`);
        }
        if (Number.isFinite(op.yMin) && Number.isFinite(op.yMax) && op.yMin >= op.yMax) {
            errors.push(`${prefix}: yMin must be less than yMax.`);
        }
        if (op.branch !== undefined && op.branch !== null &&
            (!Number.isInteger(op.branch) || op.branch < 0 || op.branch > 1)) {
            errors.push(`${prefix}: intersection branch must be 0 or 1.`);
        }

        if (op.type === 'pointOnCircle') {
            if (op.t !== undefined) {
                errors.push(`${prefix}: pointOnCircle uses "angle" in radians; "t" is ignored at runtime and can collapse arcs/sectors.`);
            }
            if (op.angle !== undefined && !Number.isFinite(op.angle)) {
                errors.push(`${prefix}: pointOnCircle angle must be a finite number.`);
            }
        }

        if (op.type === 'pointOnLine' && op.angle !== undefined) {
            errors.push(`${prefix}: pointOnLine uses "t"; "angle" is only for pointOnCircle.`);
        }
        if (op.type === 'pointOnLine' && op.t !== undefined && !Number.isFinite(op.t)) {
            errors.push(prefix + ': pointOnLine t must be a finite number.');
        }

        if (op.type === 'function' && typeof op.expression === 'string' && op.expression.includes('=')) {
            errors.push(`${prefix}: function expression must omit "y=" and contain only the right-hand side.`);
        }

        if (op.type === 'angleDimension') {
            if (op.arcRadius !== undefined && (!Number.isFinite(op.arcRadius) || op.arcRadius <= 0)) {
                errors.push(`${prefix}: angleDimension arcRadius must be a positive finite number.`);
            }
            if (op.showValue !== undefined && typeof op.showValue !== 'boolean') {
                errors.push(`${prefix}: angleDimension showValue must be a boolean.`);
            }
            if (op.markerCount !== undefined && (!Number.isInteger(op.markerCount) || op.markerCount < 0)) {
                errors.push(`${prefix}: angleDimension markerCount must be a non-negative integer.`);
            }
            if (op.labelFontSize !== undefined && (!Number.isFinite(op.labelFontSize) || op.labelFontSize <= 0)) {
                errors.push(`${prefix}: angleDimension labelFontSize must be a positive finite number.`);
            }
        }

        if (op.type === 'lengthDimension') {
            if (op.curvature !== undefined && (!Number.isFinite(op.curvature))) {
                errors.push(`${prefix}: lengthDimension curvature must be a finite number.`);
            }
            if (op.showValue !== undefined && typeof op.showValue !== 'boolean') {
                errors.push(`${prefix}: lengthDimension showValue must be a boolean.`);
            }
            if (op.labelFontSize !== undefined && (!Number.isFinite(op.labelFontSize) || op.labelFontSize <= 0)) {
                errors.push(`${prefix}: lengthDimension labelFontSize must be a positive finite number.`);
            }
        }

        if (op.type === 'equalLengthMarker' && op.tickCount != null &&
            (!Number.isInteger(op.tickCount) || op.tickCount < 1)) {
            errors.push(`${prefix}: equalLengthMarker tickCount must be a positive integer.`);
        }

        return errors;
    }

    validateReferences(data, existingIds) {
        const result = ValidationResult.success();
        const operations = data.operations || (Array.isArray(data) ? data : [data]);

        const newIds = new Set();
        const deletedIds = new Set();
        const createdById = new Map();

        for (let i = 0; i < operations.length; i++) {
            const op = operations[i];

            if (op.op === 'create' && op.id) {
                newIds.add(op.id);
                createdById.set(op.id, op);
            }

            if ((op.op === 'update' || op.op === 'delete') && op.id) {
                if (!existingIds.has(op.id) && !newIds.has(op.id)) {
                    result.addError(`operations[${i}]: id="${op.id}" does not exist.`);
                }
            }

            const refFields = [
                'point1Id', 'point2Id', 'point3Id', 'centerId', 'pointOnCircleId',
                'originId', 'directionPointId', 'lineId', 'circleId', 'segmentId',
                'circle1Id', 'circle2Id',
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

            if (op.op === 'create' && op.type === 'pointOnLine' && Number.isFinite(op.t)) {
                const referencedObject = createdById.get(op.lineId);
                if (referencedObject?.type === 'segment' && (op.t < 0 || op.t > 1)) {
                    result.addError(
                        'operations[' + i + ']: pointOnLine t must stay between 0 and 1 when lineId references a segment.'
                    );
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

            if (op.vertexIds && Array.isArray(op.vertexIds)) {
                for (const refId of op.vertexIds) {
                    if (!existingIds.has(refId) && !newIds.has(refId)) {
                        result.addError(`operations[${i}]: vertexIds item "${refId}" does not exist.`);
                    } else if (deletedIds.has(refId)) {
                        result.addError(`operations[${i}]: vertexIds item "${refId}" was deleted earlier in the batch.`);
                    }
                }
            }

            if (op.op === 'delete' && op.id) {
                deletedIds.add(op.id);
            }
        }

        return result;
    }

    validateIntent(data, options = {}) {
        const operations = data.operations || (Array.isArray(data) ? data : [data]);
        if (!Array.isArray(operations)) {
            return ValidationResult.failure('operations must be an array before intent validation.');
        }

        const result = ValidationResult.success();
        const mode = ['patch', 'recreate', 'problem_diagram'].includes(options.mode)
            ? options.mode
            : null;

        if (mode === 'recreate' || mode === 'problem_diagram') {
            const maxOperations = Number.isFinite(options.maxOperations)
                ? options.maxOperations
                : null;
            if (maxOperations !== null && operations.length > maxOperations) {
                result.addError(
                    `image recreate returned ${operations.length} operations, over the ${maxOperations} operation budget.`
                );
            }
            return result;
        }

        if (mode !== 'patch') {
            return result;
        }

        const selectedIds = new Set(
            (options.context?.selectedObjectIds || options.selectedObjectIds || [])
                .filter(id => typeof id === 'string' && id.trim())
        );

        if (selectedIds.size === 0) {
            return result;
        }

        const instruction = String(options.instruction || '');
        const strictSelectedEdit = this.isStrictSelectedPatchInstruction(instruction);
        const selectedMutationRequired = strictSelectedEdit || this.looksLikeMutationInstruction(instruction);

        if (selectedMutationRequired) {
            const touchesSelectedId = operations.some(op =>
                (op.op === 'update' || op.op === 'delete') && selectedIds.has(op.id)
            );

            if (!touchesSelectedId) {
                result.addError(
                    `patch mode must update or delete at least one selected object id: ${Array.from(selectedIds).join(', ')}.`
                );
            }
        }

        if (!strictSelectedEdit) {
            return result;
        }

        for (let i = 0; i < operations.length; i++) {
            const op = operations[i];
            if (op.op === 'create') {
                result.addError(
                    `operations[${i}]: strict selected-object edit cannot create new objects.`
                );
            }

            if ((op.op === 'update' || op.op === 'delete') && !selectedIds.has(op.id)) {
                result.addError(
                    `operations[${i}]: strict selected-object edit cannot mutate unselected id="${op.id}".`
                );
            }
        }

        return result;
    }

    isStrictSelectedPatchInstruction(instruction) {
        const text = String(instruction || '').toLowerCase();
        if (!text) return false;

        return /only|just|selected|selection|this part|that part/.test(text) ||
            /선택|해당|그 부분|이 부분|저 부분|만\b|만\s|만$/.test(text);
    }

    looksLikeMutationInstruction(instruction) {
        const text = String(instruction || '').toLowerCase();
        if (!text) return false;

        return /change|modify|edit|replace|move|resize|red|blue|green|color|bigger|smaller|larger|thicker|thinner|delete|remove/.test(text) ||
            /바꿔|변경|수정|이동|색|빨간|빨강|파란|파랑|초록|크게|작게|굵게|얇게|삭제|지워/.test(text);
    }
}

export default SchemaValidator;
