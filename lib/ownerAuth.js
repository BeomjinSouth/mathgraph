/**
 * lib/ownerAuth.js 역할
 * 이 파일은 서버리스 API(`api/login.js`, `api/openai-responses.js`)가 공통으로 사용하는
 * 오너 인증/토큰 서명/요청 검증 유틸을 한곳에 모은 모듈입니다.
 *
 * 이번 변경의 의도는 다음과 같습니다.
 * - 두 API 사이에 중복되던 서명/토큰/본문 파싱 로직을 하나로 합칩니다.
 * - 서명 시크릿과 오너 비밀번호가 없으면 하드코딩 상수로 폴백하지 않고 fail-closed 하게 만듭니다.
 * - 프록시로 들어오는 요청의 모델/본문 크기/호출 빈도를 검증할 수 있게 합니다.
 */

import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const OWNER_NAME = process.env.MATHGRAPH_OWNER_NAME || '박범진';
export const DEFAULT_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

/** 서버 환경변수 설정이 누락됐을 때 사용하는 오류 (fail-closed 신호) */
export class AuthConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AuthConfigError';
    }
}

/** 요청 본문이 허용 크기를 넘었을 때 사용하는 오류 */
export class PayloadTooLargeError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PayloadTooLargeError';
    }
}

/** 프록시 요청이 서버 소유 정책을 벗어났을 때 사용하는 오류 */
export class ProxyRequestError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ProxyRequestError';
    }
}

/**
 * 토큰 서명에 사용할 시크릿을 반환합니다.
 * 예전에는 OPENAI_API_KEY나 하드코딩 상수로 폴백했지만, 그 경우 토큰이 위조 가능하므로
 * 이제는 MATHGRAPH_LOGIN_SECRET가 없으면 명시적으로 오류를 던집니다.
 */
export function getSigningSecret() {
    const secret = process.env.MATHGRAPH_LOGIN_SECRET;
    if (!secret || !secret.trim()) {
        throw new AuthConfigError('MATHGRAPH_LOGIN_SECRET is not configured.');
    }
    return secret;
}

/**
 * 오너 로그인 비밀번호를 반환합니다. 설정되어 있지 않으면 오너 로그인을 막습니다.
 */
export function getOwnerPassword() {
    const password = process.env.MATHGRAPH_OWNER_PASSWORD;
    if (!password || !password.trim()) {
        throw new AuthConfigError('MATHGRAPH_OWNER_PASSWORD is not configured.');
    }
    return password;
}

export function signPayload(encodedPayload) {
    return createHmac('sha256', getSigningSecret())
        .update(encodedPayload)
        .digest('base64url');
}

/** 타이밍 공격에 안전하게 두 문자열을 비교합니다. */
export function safeEqual(left, right) {
    const digest = (value) => createHash('sha256').update(String(value ?? ''), 'utf8').digest();
    return timingSafeEqual(digest(left), digest(right));
}

export function createToken(payload) {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifyToken(token) {
    const [encodedPayload, signature] = String(token || '').split('.');
    if (!encodedPayload || !signature) {
        return { valid: false, error: 'Missing login token.' };
    }

    // 서명 시크릿 미설정은 서버 설정 오류이므로 그대로 위로 전파합니다.
    const expectedSignature = signPayload(encodedPayload);
    if (!safeEqual(signature, expectedSignature)) {
        return { valid: false, error: 'Invalid login token.' };
    }

    let payload;
    try {
        payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    } catch {
        return { valid: false, error: 'Invalid login token payload.' };
    }

    if (payload?.sub !== 'owner' || payload?.name !== OWNER_NAME) {
        return { valid: false, error: 'Invalid login token subject.' };
    }

    if (!Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
        return { valid: false, error: 'Login token expired.' };
    }

    return { valid: true, payload };
}

const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024; // 이미지 재현 요청의 base64 페이로드를 고려한 상한

export function getMaxBodyBytes() {
    const value = Number(process.env.MATHGRAPH_PROXY_MAX_BODY_BYTES);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_BODY_BYTES;
}

/**
 * 요청 본문을 JSON으로 읽되, 최대 크기를 초과하면 PayloadTooLargeError를 던집니다.
 */
export async function readJson(req, { maxBytes = getMaxBodyBytes() } = {}) {
    if (req.body && typeof req.body === 'object') {
        const serializedBody = JSON.stringify(req.body);
        if (Buffer.byteLength(serializedBody, 'utf8') > maxBytes) {
            throw new PayloadTooLargeError('Request body too large.');
        }
        return req.body;
    }

    if (typeof req.body === 'string') {
        if (Buffer.byteLength(req.body) > maxBytes) {
            throw new PayloadTooLargeError('Request body too large.');
        }
        return JSON.parse(req.body || '{}');
    }

    const chunks = [];
    let total = 0;
    for await (const chunk of req) {
        const buffer = Buffer.from(chunk);
        total += buffer.length;
        if (total > maxBytes) {
            throw new PayloadTooLargeError('Request body too large.');
        }
        chunks.push(buffer);
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');
    return rawBody ? JSON.parse(rawBody) : {};
}

export function getBearerToken(req) {
    const header = req.headers?.authorization || req.headers?.Authorization || '';
    const match = String(header).match(/^Bearer\s+(.+)$/i);
    return match?.[1] || '';
}

const DEFAULT_ALLOWED_MODELS = ['gpt-5.5', 'gpt-5.5-pro', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'];

/**
 * 프록시가 OpenAI로 전달할 수 있는 모델 목록입니다.
 * 모델명이 바뀌면 코드 배포 없이 MATHGRAPH_PROXY_ALLOWED_MODELS 환경변수로 교체할 수 있습니다.
 */
export function getAllowedModels() {
    const raw = process.env.MATHGRAPH_PROXY_ALLOWED_MODELS;
    if (raw && raw.trim()) {
        return raw.split(',').map((item) => item.trim()).filter(Boolean);
    }
    return DEFAULT_ALLOWED_MODELS;
}

export function isModelAllowed(model) {
    return typeof model === 'string' && getAllowedModels().includes(model);
}

const PROXY_INPUT_FIELDS = new Set([
    'model',
    'input',
    'reasoning',
    'text',
    'previous_response_id',
    'store'
]);
const DEFAULT_PROXY_MAX_OUTPUT_TOKENS = 16384;
const DEFAULT_PROXY_TIMEOUT_MS = 120000;

function getPositiveSafeIntegerSetting(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function getProxyMaxOutputTokens() {
    return getPositiveSafeIntegerSetting(
        'MATHGRAPH_PROXY_MAX_OUTPUT_TOKENS',
        DEFAULT_PROXY_MAX_OUTPUT_TOKENS
    );
}

export function getProxyTimeoutMs() {
    return getPositiveSafeIntegerSetting('MATHGRAPH_PROXY_TIMEOUT_MS', DEFAULT_PROXY_TIMEOUT_MS);
}

export function sanitizeProxyRequestBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ProxyRequestError('Invalid request body.');
    }

    const unsupportedFields = Object.keys(body).filter((key) => !PROXY_INPUT_FIELDS.has(key));
    if (unsupportedFields.length > 0) {
        throw new ProxyRequestError(`Unsupported fields: ${unsupportedFields.join(', ')}`);
    }

    const sanitized = {};
    for (const field of ['model', 'input', 'reasoning', 'text', 'previous_response_id']) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
            sanitized[field] = body[field];
        }
    }

    return {
        ...sanitized,
        store: false,
        max_output_tokens: getProxyMaxOutputTokens()
    };
}


export function getClientAddress(req) {
    const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
    return forwarded || req.socket?.remoteAddress || 'unknown';
}

export function getLoginRateOptions() {
    const configuredWindowMs = Number(process.env.MATHGRAPH_LOGIN_RATE_WINDOW_MS);
    const configuredMax = Number(process.env.MATHGRAPH_LOGIN_RATE_MAX);
    return {
        windowMs: Number.isFinite(configuredWindowMs) && configuredWindowMs > 0
            ? configuredWindowMs
            : 15 * 60 * 1000,
        max: Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : 10
    };
}
function getRateWindowMs() {
    const value = Number(process.env.MATHGRAPH_PROXY_RATE_WINDOW_MS);
    return Number.isFinite(value) && value > 0 ? value : 60 * 1000;
}

function getRateMax() {
    const value = Number(process.env.MATHGRAPH_PROXY_RATE_MAX);
    return Number.isFinite(value) && value > 0 ? value : 30;
}

// 서버리스 인스턴스별 메모리 기반 슬라이딩 윈도우 레이트리밋.
// 인스턴스가 여러 개면 완벽히 공유되지 않지만, 단일 토큰의 폭주를 상당 부분 억제합니다.
const rateBuckets = new Map();

export function checkRateLimit(key, { windowMs = getRateWindowMs(), max = getRateMax() } = {}) {
    const now = Date.now();
    const cutoff = now - windowMs;
    const hits = (rateBuckets.get(key) || []).filter((timestamp) => timestamp > cutoff);

    if (hits.length >= max) {
        return { allowed: false, retryAfterMs: Math.max(0, hits[0] + windowMs - now) };
    }

    hits.push(now);
    rateBuckets.set(key, hits);

    // 오래된 버킷을 가끔 정리해 메모리 누수를 방지합니다.
    if (rateBuckets.size > 500) {
        for (const [bucketKey, timestamps] of rateBuckets) {
            const kept = timestamps.filter((timestamp) => timestamp > cutoff);
            if (kept.length === 0) {
                rateBuckets.delete(bucketKey);
            } else {
                rateBuckets.set(bucketKey, kept);
            }
        }
    }

    return { allowed: true };
}

export function resetRateLimitKey(key) {
    rateBuckets.delete(key);
}

/** 테스트에서 레이트리밋 상태를 초기화하기 위한 헬퍼입니다. */
export function resetRateLimit() {
    rateBuckets.clear();
}
