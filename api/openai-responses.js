/**
 * api/openai-responses.js 역할
 * 오너 세션 토큰을 확인한 뒤 OpenAI Responses API로 요청을 중계하는 프록시입니다.
 *
 * 이번 변경의 의도는 다음과 같습니다.
 * - 서명 검증/토큰 파싱/본문 파싱을 lib/ownerAuth.js와 공유해 중복을 없앱니다.
 * - 전달 가능한 모델을 화이트리스트로 제한하고, 본문 크기와 호출 빈도를 제한해 남용/비용 폭주를 막습니다.
 * - 서명 시크릿 미설정 시 fail-closed 하게 동작합니다.
 */

import {
    AuthConfigError,
    PayloadTooLargeError,
    ProxyRequestError,
    verifyToken,
    getBearerToken,
    readJson,
    isModelAllowed,
    getAllowedModels,
    checkRateLimit,
    sanitizeProxyRequestBody,
    getProxyTimeoutMs
} from '../lib/ownerAuth.js';

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const bearerToken = getBearerToken(req);

    let tokenResult;
    try {
        tokenResult = verifyToken(bearerToken);
    } catch (error) {
        if (error instanceof AuthConfigError) {
            res.status(503).json({ error: '서버 로그인 시크릿이 설정되지 않았습니다.' });
            return;
        }
        throw error;
    }

    if (!tokenResult.valid) {
        res.status(401).json({ error: tokenResult.error });
        return;
    }

    // 새 토큰 발급으로 예산이 초기화되지 않도록 검증된 오너 주체 단위로 제한합니다.
    const rate = checkRateLimit(`proxy:${tokenResult.payload.sub}:${tokenResult.payload.name}`);
    if (!rate.allowed) {
        res.setHeader('Retry-After', String(Math.ceil((rate.retryAfterMs || 1000) / 1000)));
        res.status(429).json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도하세요.' });
        return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        res.status(500).json({
            error: 'Server OpenAI API key is not configured. Set OPENAI_API_KEY in Vercel environment variables.'
        });
        return;
    }

    let requestBody;
    try {
        requestBody = sanitizeProxyRequestBody(await readJson(req));
    } catch (error) {
        if (error instanceof PayloadTooLargeError) {
            res.status(413).json({ error: '요청 본문이 너무 큽니다.' });
            return;
        }
        if (error instanceof ProxyRequestError) {
            res.status(400).json({ error: error.message });
            return;
        }
        res.status(400).json({ error: '요청 본문을 해석하지 못했습니다.' });
        return;
    }

    if (!isModelAllowed(requestBody?.model)) {
        res.status(400).json({
            error: `허용되지 않은 모델입니다. 허용 목록: ${getAllowedModels().join(', ')}`
        });
        return;
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, getProxyTimeoutMs());

    try {
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        const responseText = await response.text();
        res.status(response.status);
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
        res.send(responseText);
    } catch (error) {
        if (timedOut || error?.name === 'AbortError') {
            res.status(504).json({
                error: 'OpenAI 요청 시간이 초과되었습니다. 잠시 후 다시 시도하세요.'
            });
            return;
        }
        res.status(502).json({
            error: error?.message || 'OpenAI proxy request failed.'
        });
    } finally {
        clearTimeout(timer);
    }
}
