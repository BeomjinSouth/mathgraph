import { normalizeProblemDocument } from './ProblemDocument.js';

export const PROJECT_FORMAT = 'mathgraph-project';
export const PROJECT_VERSION = 1;

function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

export function validateProjectEnvelope(value) {
    const errors = [];
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { valid: false, errors: ['프로젝트 파일 형식이 올바르지 않습니다.'] };
    }

    if (value.format !== PROJECT_FORMAT) {
        errors.push('MathGraph 프로젝트 파일이 아닙니다.');
    }
    if (value.version !== PROJECT_VERSION) {
        errors.push('지원하지 않는 프로젝트 버전입니다: ' + (value.version ?? '없음'));
    }
    if (typeof value.name !== 'string' || !value.name.trim()) {
        errors.push('프로젝트 이름이 필요합니다.');
    }
    if (typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt))) {
        errors.push('저장 시각이 올바르지 않습니다.');
    }
    if (!value.view || typeof value.view !== 'object') {
        errors.push('보기 정보가 필요합니다.');
    } else {
        if (!value.view.offset || !isFiniteNumber(value.view.offset.x) || !isFiniteNumber(value.view.offset.y)) {
            errors.push('보기 중심 좌표가 올바르지 않습니다.');
        }
        if (!isFiniteNumber(value.view.scale) || value.view.scale <= 0) {
            errors.push('보기 배율이 올바르지 않습니다.');
        }
    }
    if (!Array.isArray(value.objects)) {
        errors.push('프로젝트 객체 목록이 올바르지 않습니다.');
    }
    if (value.problem !== undefined) {
        try { normalizeProblemDocument(value.problem); }
        catch (error) { errors.push(error.message); }
    }

    return { valid: errors.length === 0, errors };
}

export function createProjectEnvelope({
    name,
    savedAt = new Date().toISOString(),
    view,
    objects,
    problem
}) {
    const envelope = {
        format: PROJECT_FORMAT,
        version: PROJECT_VERSION,
        name: String(name || '이름 없는 프로젝트').trim() || '이름 없는 프로젝트',
        savedAt,
        view: {
            offset: {
                x: Number(view?.offset?.x) || 0,
                y: Number(view?.offset?.y) || 0
            },
            scale: Number(view?.scale) || 50
        },
        objects: Array.isArray(objects) ? objects : []
    };
    if (problem !== undefined) envelope.problem = normalizeProblemDocument(problem);

    const result = validateProjectEnvelope(envelope);
    if (!result.valid) {
        throw new Error(result.errors.join('\n'));
    }
    return envelope;
}

export function parseProjectFile(text) {
    let value;
    try {
        value = JSON.parse(String(text ?? ''));
    } catch {
        throw new Error('프로젝트 파일의 JSON을 읽을 수 없습니다.');
    }

    const result = validateProjectEnvelope(value);
    if (!result.valid) {
        throw new Error(result.errors.join('\n'));
    }
    return value;
}
