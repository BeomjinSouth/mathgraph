export const IMAGE_ANALYSIS_TRACE_SCHEMA_VERSION = 1;
export const IMAGE_ANALYSIS_TRACE_STORAGE_KEY = 'graphA_image_debug_traces_v1';
export const IMAGE_ANALYSIS_TRACE_MAX_COUNT = 5;
export const IMAGE_ANALYSIS_TRACE_MAX_BYTES = 300000;

const TRACE_MAX_DEPTH = 8;
const TRACE_MAX_ARRAY_ITEMS = 120;
const TRACE_MAX_OBJECT_KEYS = 100;
const TRACE_MAX_STRING_LENGTH = 3000;

const SENSITIVE_KEY_PATTERN = /^(?:api[-_]?key|authorization|headers?|password|secret|token|credentials?|cookies?|session(?:[-_]?id)?|proxy[-_]?token|access[-_]?token|refresh[-_]?token|image[-_]?(?:data[-_]?)?url|processedImageDataUrl|image_url|inline_data|base64|prompt|instruction|requestBody|message|content|evidence|constructionSummary)$/i;
const DATA_URL_PATTERN = /^data:[^;,]+(?:;[^,]*)?,/i;
const BEARER_TOKEN_PATTERN = /^bearer\s+/i;
const EMBEDDED_SECRET_PATTERNS = [
    /data:[^;,\s]+(?:;[^,\s]*)?,[A-Za-z0-9+/=_-]+/gi,
    /\bbearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
    /\bsk-[A-Za-z0-9_-]{8,}\b/g,
    /\bAIza[A-Za-z0-9_-]{20,}\b/g
];

function nowIso() {
    return new Date().toISOString();
}

function createTraceId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    return `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function utf8ByteLength(value) {
    const text = String(value || '');
    if (typeof TextEncoder !== 'undefined') {
        return new TextEncoder().encode(text).length;
    }
    return text.length * 2;
}

function sanitizeString(value) {
    const original = String(value);
    if (DATA_URL_PATTERN.test(original) || BEARER_TOKEN_PATTERN.test(original)) {
        return '[removed]';
    }
    const text = EMBEDDED_SECRET_PATTERNS.reduce(
        (current, pattern) => current.replace(pattern, '[removed]'),
        original
    );
    if (text.length <= TRACE_MAX_STRING_LENGTH) return text;
    return `${text.slice(0, TRACE_MAX_STRING_LENGTH)}…[truncated:${text.length - TRACE_MAX_STRING_LENGTH}]`;
}

export function sanitizeImageAnalysisTraceValue(value, depth = 0, seen = new WeakSet()) {
    if (value === null || value === undefined) return value ?? null;
    if (typeof value === 'string') return sanitizeString(value);
    if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
    if (typeof value === 'boolean') return value;
    if (typeof value === 'bigint') return String(value);
    if (typeof value === 'function' || typeof value === 'symbol') return undefined;
    if (depth >= TRACE_MAX_DEPTH) return '[depth-limit]';
    if (typeof value !== 'object') return sanitizeString(value);
    if (seen.has(value)) return '[circular]';

    seen.add(value);
    try {
        if (Array.isArray(value)) {
            const items = value.slice(0, TRACE_MAX_ARRAY_ITEMS)
                .map(item => sanitizeImageAnalysisTraceValue(item, depth + 1, seen))
                .filter(item => item !== undefined);
            if (value.length > TRACE_MAX_ARRAY_ITEMS) {
                items.push(`[items-truncated:${value.length - TRACE_MAX_ARRAY_ITEMS}]`);
            }
            return items;
        }

        const result = {};
        const entries = Object.entries(value).slice(0, TRACE_MAX_OBJECT_KEYS);
        for (const [key, entryValue] of entries) {
            if (SENSITIVE_KEY_PATTERN.test(key)) continue;
            const sanitized = sanitizeImageAnalysisTraceValue(entryValue, depth + 1, seen);
            if (sanitized !== undefined) result[key] = sanitized;
        }
        if (Object.keys(value).length > TRACE_MAX_OBJECT_KEYS) {
            result.__keysTruncated = Object.keys(value).length - TRACE_MAX_OBJECT_KEYS;
        }
        return result;
    } finally {
        seen.delete(value);
    }
}

function operationKey(operation, index) {
    const id = String(operation?.id || '').trim();
    if (id) return id;
    return `${operation?.op || 'operation'}:${operation?.type || 'unknown'}:${index}`;
}

function comparableOperation(operation) {
    return sanitizeImageAnalysisTraceValue(operation);
}

function changedFields(before, after) {
    const fields = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    return Array.from(fields).filter(field =>
        JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field])
    );
}

export function diffImageAnalysisOperations(beforeOperations = [], afterOperations = []) {
    const before = Array.isArray(beforeOperations) ? beforeOperations : [];
    const after = Array.isArray(afterOperations) ? afterOperations : [];
    const beforeMap = new Map(before.map((operation, index) => [
        operationKey(operation, index),
        comparableOperation(operation)
    ]));
    const afterMap = new Map(after.map((operation, index) => [
        operationKey(operation, index),
        comparableOperation(operation)
    ]));

    const added = [];
    const removed = [];
    const changed = [];

    for (const [key, operation] of afterMap) {
        if (!beforeMap.has(key)) {
            added.push({ key, operation });
            continue;
        }
        const previous = beforeMap.get(key);
        const fields = changedFields(previous, operation);
        if (fields.length) changed.push({ key, fields, before: previous, after: operation });
    }

    for (const [key, operation] of beforeMap) {
        if (!afterMap.has(key)) removed.push({ key, operation });
    }

    return {
        beforeCount: before.length,
        afterCount: after.length,
        added,
        removed,
        changed
    };
}

export function createImageAnalysisTrace({ source = 'upload', mode = 'problem_diagram', input = {} } = {}) {
    const createdAt = nowIso();
    return {
        schemaVersion: IMAGE_ANALYSIS_TRACE_SCHEMA_VERSION,
        traceId: createTraceId(),
        createdAt,
        updatedAt: createdAt,
        completedAt: null,
        status: 'in_progress',
        outcome: null,
        suspectedStage: null,
        request: sanitizeImageAnalysisTraceValue({ source, mode, ...input }),
        sourceFidelity: {
            status: 'not_performed',
            reason: 'automatic source-image comparison is not implemented'
        },
        stages: []
    };
}

export function recordImageAnalysisStage(trace, name, details = {}) {
    if (!trace || !Array.isArray(trace.stages) || !name) return trace;
    const stage = sanitizeImageAnalysisTraceValue({
        name,
        attempt: Number.isSafeInteger(details.attempt) ? details.attempt : 1,
        status: details.status || 'ok',
        recordedAt: nowIso(),
        durationMs: Number.isFinite(details.durationMs) ? Math.max(0, Math.round(details.durationMs)) : null,
        summary: details.summary || '',
        errors: Array.isArray(details.errors) ? details.errors : [],
        warnings: Array.isArray(details.warnings) ? details.warnings : [],
        meta: details.meta || {},
        snapshot: details.snapshot ?? null,
        changes: details.changes ?? null
    });
    trace.stages.push(stage);
    trace.updatedAt = stage.recordedAt;
    return trace;
}

export function finalizeImageAnalysisTrace(trace, {
    success = false,
    outcome = success ? 'applied' : 'failed',
    error = ''
} = {}) {
    if (!trace) return trace;
    const firstErrorStage = trace.stages.find(stage => stage?.status === 'error');
    const completedAt = nowIso();
    trace.completedAt = completedAt;
    trace.updatedAt = completedAt;
    trace.status = success ? 'source_fidelity_unverified' : 'failed';
    trace.outcome = sanitizeImageAnalysisTraceValue({ success, code: outcome, error });
    trace.suspectedStage = firstErrorStage?.name || (success ? 'source_fidelity_unverified' : 'unknown');
    return trace;
}

function snapshotSummary(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const operations = Array.isArray(snapshot.operations) ? snapshot.operations : null;
    const nodes = Array.isArray(snapshot.nodes) ? snapshot.nodes : null;
    return {
        truncated: true,
        operationCount: operations?.length ?? null,
        nodeCount: nodes?.length ?? null,
        keys: Object.keys(snapshot).slice(0, 30)
    };
}

export function fitImageAnalysisTraceToSize(trace, maxBytes = IMAGE_ANALYSIS_TRACE_MAX_BYTES) {
    const fitted = sanitizeImageAnalysisTraceValue(trace);
    let serialized = JSON.stringify(fitted);
    if (utf8ByteLength(serialized) <= maxBytes) return fitted;

    fitted.storageTruncated = true;
    for (const stage of fitted.stages || []) {
        if (stage.snapshot !== null && stage.snapshot !== undefined) {
            stage.snapshot = snapshotSummary(stage.snapshot);
        }
        if (stage.changes?.changed?.length > 20) {
            stage.changes.changed = stage.changes.changed.slice(0, 20);
            stage.changes.changedTruncated = true;
        }
    }
    serialized = JSON.stringify(fitted);
    if (utf8ByteLength(serialized) <= maxBytes) return fitted;

    fitted.stages = (fitted.stages || []).map(stage => ({
        name: stage.name,
        attempt: stage.attempt,
        status: stage.status,
        recordedAt: stage.recordedAt,
        durationMs: stage.durationMs,
        summary: stage.summary,
        errors: stage.errors,
        warnings: stage.warnings,
        meta: stage.meta,
        snapshot: snapshotSummary(stage.snapshot),
        changes: stage.changes ? {
            beforeCount: stage.changes.beforeCount,
            afterCount: stage.changes.afterCount,
            addedCount: stage.changes.added?.length || 0,
            removedCount: stage.changes.removed?.length || 0,
            changedCount: stage.changes.changed?.length || 0,
            truncated: true
        } : null
    }));
    serialized = JSON.stringify(fitted);
    if (utf8ByteLength(serialized) <= maxBytes) return fitted;

    const stageCount = fitted.stages.length;
    fitted.stages = fitted.stages.slice(0, 30).map(stage => ({
        name: stage.name,
        attempt: stage.attempt,
        status: stage.status,
        recordedAt: stage.recordedAt,
        durationMs: stage.durationMs,
        summary: stage.summary,
        errorCount: stage.errors?.length || 0,
        warningCount: stage.warnings?.length || 0,
        changes: stage.changes
    }));
    fitted.stagesTruncated = Math.max(0, stageCount - fitted.stages.length);
    serialized = JSON.stringify(fitted);
    if (utf8ByteLength(serialized) <= maxBytes) return fitted;

    return {
        schemaVersion: fitted.schemaVersion,
        traceId: fitted.traceId,
        createdAt: fitted.createdAt,
        completedAt: fitted.completedAt,
        status: fitted.status,
        outcome: fitted.outcome,
        suspectedStage: fitted.suspectedStage,
        sourceFidelity: fitted.sourceFidelity,
        request: {
            source: fitted.request?.source || null,
            mode: fitted.request?.mode || null
        },
        stages: fitted.stages.slice(0, 10).map(stage => ({
            name: stage.name,
            attempt: stage.attempt,
            status: stage.status,
            recordedAt: stage.recordedAt,
            errorCount: stage.errorCount,
            warningCount: stage.warningCount
        })),
        storageTruncated: true,
        storageSeverelyTruncated: true
    };
}

export class ImageAnalysisTraceStore {
    constructor(storage = globalThis.localStorage, options = {}) {
        this.storage = storage;
        this.storageKey = options.storageKey || IMAGE_ANALYSIS_TRACE_STORAGE_KEY;
        this.maxCount = options.maxCount || IMAGE_ANALYSIS_TRACE_MAX_COUNT;
        this.maxBytes = options.maxBytes || IMAGE_ANALYSIS_TRACE_MAX_BYTES;
    }

    getAll() {
        try {
            const raw = this.storage?.getItem(this.storageKey);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed)
                ? parsed
                    .filter(trace => trace && typeof trace === 'object')
                    .map(trace => fitImageAnalysisTraceToSize(trace, this.maxBytes))
                    .slice(-this.maxCount)
                : [];
        } catch {
            return [];
        }
    }

    getLast() {
        return this.getAll().at(-1) || null;
    }

    save(trace) {
        const fitted = fitImageAnalysisTraceToSize(trace, this.maxBytes);
        const traces = this.getAll()
            .filter(candidate => candidate.traceId !== fitted.traceId)
            .concat(fitted)
            .slice(-this.maxCount);
        try {
            this.storage?.setItem(this.storageKey, JSON.stringify(traces));
            return fitted;
        } catch {
            return fitted;
        }
    }

    clear() {
        try {
            this.storage?.removeItem(this.storageKey);
        } catch {
            // 저장소를 사용할 수 없는 환경에서도 앱 동작은 유지합니다.
        }
    }
}
