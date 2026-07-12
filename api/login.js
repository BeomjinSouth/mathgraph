/**
 * api/login.js 역할
 * 오너(`박범진`) 세션 토큰을 발급하는 서버리스 엔드포인트입니다.
 *
 * 이번 변경의 의도는 다음과 같습니다.
 * - 이름만 맞으면 통과하던 방식(사실상 무인증)을 이름 + 비밀번호 검증으로 강화합니다.
 * - 서명 시크릿/비밀번호가 서버에 없으면 발급을 막습니다(fail-closed).
 * - 공용 인증 로직을 lib/ownerAuth.js로 옮겨 openai-responses.js와 중복을 없앱니다.
 */

import {
    AuthConfigError,
    PayloadTooLargeError,
    OWNER_NAME,
    DEFAULT_TOKEN_TTL_MS,
    LOGIN_MAX_BODY_BYTES,
    LOGIN_MAX_NAME_LENGTH,
    LOGIN_MAX_PASSWORD_LENGTH,
    createToken,
    getSigningSecret,
    getOwnerPassword,
    safeEqual,
    readJson,
    getClientAddress,
    getLoginRateOptions,
    hashRateLimitKeyPart,
    checkRateLimit,
    resetRateLimitKey
} from '../lib/ownerAuth.js';

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    // 서버 설정(서명 시크릿, 오너 비밀번호)이 갖춰져 있는지 먼저 확인합니다.
    let ownerPassword;
    try {
        getSigningSecret();
        ownerPassword = getOwnerPassword();
    } catch (error) {
        if (error instanceof AuthConfigError) {
            res.status(503).json({
                error: '오너 로그인이 설정되지 않았습니다. 서버에 MATHGRAPH_LOGIN_SECRET와 MATHGRAPH_OWNER_PASSWORD를 설정하세요.'
            });
            return;
        }
        throw error;
    }

    try {
        const body = await readJson(req, { maxBytes: LOGIN_MAX_BODY_BYTES });
        const rateOptions = { ...getLoginRateOptions(), scope: 'login' };
        const addressHash = hashRateLimitKeyPart(getClientAddress(req));
        const addressRateKey = `login:address:${addressHash}`;
        const addressRate = checkRateLimit(addressRateKey, rateOptions);
        if (!addressRate.allowed) {
            res.setHeader('Retry-After', String(Math.ceil((addressRate.retryAfterMs || 1000) / 1000)));
            res.status(429).json({
                error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.'
            });
            return;
        }

        if (!body || typeof body !== 'object' || Array.isArray(body)
            || typeof body.name !== 'string' || typeof body.password !== 'string') {
            throw new Error('이름과 비밀번호는 문자열이어야 합니다.');
        }
        if (body.name.length > LOGIN_MAX_NAME_LENGTH
            || body.password.length > LOGIN_MAX_PASSWORD_LENGTH) {
            throw new Error('이름 또는 비밀번호가 허용 길이를 초과했습니다.');
        }

        const name = body.name.normalize('NFKC').trim();
        const password = body.password;
        if (name.length > LOGIN_MAX_NAME_LENGTH) {
            throw new Error('이름이 허용 길이를 초과했습니다.');
        }

        const accountRateKey = `login:account:${addressHash}:${hashRateLimitKeyPart(name)}`;
        const accountRate = checkRateLimit(accountRateKey, rateOptions);
        if (!accountRate.allowed) {
            res.setHeader('Retry-After', String(Math.ceil((accountRate.retryAfterMs || 1000) / 1000)));
            res.status(429).json({
                error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도하세요.'
            });
            return;
        }

        const nameMatches = name === OWNER_NAME;
        const passwordMatches = safeEqual(password, ownerPassword);
        if (!nameMatches || !passwordMatches) {
            res.status(401).json({
                error: '이름 또는 비밀번호가 올바르지 않습니다. 게스트로 진행하거나 다시 확인하세요.'
            });
            return;
        }

        const ttlMs = Number(process.env.MATHGRAPH_OWNER_TOKEN_TTL_MS) || DEFAULT_TOKEN_TTL_MS;
        const issuedAt = Date.now();
        resetRateLimitKey(addressRateKey, { scope: 'login' });
        resetRateLimitKey(accountRateKey, { scope: 'login' });
        const expiresAt = issuedAt + ttlMs;
        const token = createToken({
            sub: 'owner',
            name: OWNER_NAME,
            iat: issuedAt,
            exp: expiresAt
        });

        res.status(200).json({
            ok: true,
            mode: 'owner',
            displayName: OWNER_NAME,
            token,
            expiresAt
        });
    } catch (error) {
        if (error instanceof PayloadTooLargeError) {
            res.status(413).json({ error: '요청 본문이 너무 큽니다.' });
            return;
        }
        if (error instanceof AuthConfigError) {
            res.status(503).json({ error: '오너 로그인이 설정되지 않았습니다.' });
            return;
        }
        res.status(400).json({
            error: error?.message || '로그인 요청을 처리하지 못했습니다.'
        });
    }
}
