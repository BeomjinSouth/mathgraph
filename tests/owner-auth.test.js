import assert from 'node:assert/strict';
import test from 'node:test';

// 테스트 전체에서 사용할 서명 시크릿을 먼저 설정합니다(함수들이 호출 시점에 env를 읽음).
process.env.MATHGRAPH_LOGIN_SECRET = 'test-signing-secret';

const {
    AuthConfigError,
    PayloadTooLargeError,
    ProxyRequestError,
    OWNER_NAME,
    createToken,
    verifyToken,
    getSigningSecret,
    getOwnerPassword,
    safeEqual,
    readJson,
    isModelAllowed,
    getAllowedModels,
    checkRateLimit,
    resetRateLimit,
    resetRateLimitKey,
    sanitizeProxyRequestBody,
    getProxyTimeoutMs
} = await import('../lib/ownerAuth.js');

function futureToken(overrides = {}) {
    return createToken({
        sub: 'owner',
        name: OWNER_NAME,
        iat: Date.now(),
        exp: Date.now() + 60_000,
        ...overrides
    });
}

test('createToken/verifyToken round trips a valid owner token', () => {
    const result = verifyToken(futureToken());
    assert.equal(result.valid, true);
    assert.equal(result.payload.sub, 'owner');
});

test('verifyToken rejects a tampered signature', () => {
    const token = futureToken();
    const tampered = `${token.split('.')[0]}.deadbeef`;
    const result = verifyToken(tampered);
    assert.equal(result.valid, false);
    assert.match(result.error, /Invalid login token/);
});

test('verifyToken rejects an expired token', () => {
    const token = createToken({ sub: 'owner', name: OWNER_NAME, iat: 0, exp: Date.now() - 1000 });
    const result = verifyToken(token);
    assert.equal(result.valid, false);
    assert.match(result.error, /expired/);
});

test('verifyToken rejects a wrong subject', () => {
    const token = createToken({ sub: 'intruder', name: OWNER_NAME, iat: Date.now(), exp: Date.now() + 60_000 });
    const result = verifyToken(token);
    assert.equal(result.valid, false);
    assert.match(result.error, /subject/);
});

test('verifyToken reports missing token', () => {
    assert.equal(verifyToken('').valid, false);
    assert.equal(verifyToken('no-dot').valid, false);
});

test('getSigningSecret fails closed when the secret is not configured', () => {
    const original = process.env.MATHGRAPH_LOGIN_SECRET;
    delete process.env.MATHGRAPH_LOGIN_SECRET;
    try {
        assert.throws(() => getSigningSecret(), AuthConfigError);
    } finally {
        process.env.MATHGRAPH_LOGIN_SECRET = original;
    }
});

test('getOwnerPassword fails closed when the password is not configured', () => {
    const original = process.env.MATHGRAPH_OWNER_PASSWORD;
    delete process.env.MATHGRAPH_OWNER_PASSWORD;
    try {
        assert.throws(() => getOwnerPassword(), AuthConfigError);
    } finally {
        if (original === undefined) {
            delete process.env.MATHGRAPH_OWNER_PASSWORD;
        } else {
            process.env.MATHGRAPH_OWNER_PASSWORD = original;
        }
    }
});

test('safeEqual compares constant-time without leaking on length mismatch', () => {
    assert.equal(safeEqual('secret', 'secret'), true);
    assert.equal(safeEqual('secret', 'secre'), false);
    assert.equal(safeEqual('secret', 'wrongg'), false);
});

test('isModelAllowed only accepts whitelisted models', () => {
    assert.equal(isModelAllowed('gpt-5.5'), true);
    assert.equal(isModelAllowed('gpt-5.4-mini'), true);
    assert.equal(isModelAllowed('evil-model'), false);
    assert.equal(isModelAllowed(undefined), false);
    assert.ok(getAllowedModels().includes('gpt-5.5'));
});

test('isModelAllowed honors the MATHGRAPH_PROXY_ALLOWED_MODELS override', () => {
    const original = process.env.MATHGRAPH_PROXY_ALLOWED_MODELS;
    process.env.MATHGRAPH_PROXY_ALLOWED_MODELS = 'only-this, and-that';
    try {
        assert.equal(isModelAllowed('only-this'), true);
        assert.equal(isModelAllowed('gpt-5.5'), false);
    } finally {
        if (original === undefined) {
            delete process.env.MATHGRAPH_PROXY_ALLOWED_MODELS;
        } else {
            process.env.MATHGRAPH_PROXY_ALLOWED_MODELS = original;
        }
    }
});

test('sanitizeProxyRequestBody preserves supported nested Responses input and enforces server-owned fields', () => {
    const input = [{
        role: 'user',
        content: [
            { type: 'input_text', text: '도형을 재현해줘' },
            { type: 'input_image', image_url: 'data:image/png;base64,AAAA', detail: 'high' }
        ]
    }];
    const reasoning = { effort: 'low' };
    const text = {
        verbosity: 'low',
        format: {
            type: 'json_schema',
            name: 'graph_operations',
            strict: true,
            schema: {
                type: 'object',
                properties: {
                    operations: { type: 'array', items: { type: 'object' } }
                }
            }
        }
    };

    const sanitized = sanitizeProxyRequestBody({
        model: 'gpt-5.5',
        input,
        reasoning,
        text,
        previous_response_id: 'resp_previous',
        store: true
    });

    assert.deepEqual(sanitized.input, input);
    assert.deepEqual(sanitized.reasoning, reasoning);
    assert.deepEqual(sanitized.text, text);
    assert.equal(sanitized.previous_response_id, 'resp_previous');
    assert.equal(sanitized.store, false);
    assert.equal(sanitized.max_output_tokens, 16384);
});

test('sanitizeProxyRequestBody rejects caller-controlled Responses cost and execution fields', () => {
    for (const [field, value] of [
        ['tools', [{ type: 'web_search' }]],
        ['background', true],
        ['stream', true],
        ['service_tier', 'priority'],
        ['max_output_tokens', 999999]
    ]) {
        assert.throws(
            () => sanitizeProxyRequestBody({ model: 'gpt-5.5', input: [], [field]: value }),
            (error) => error instanceof ProxyRequestError && error.message.includes(field),
            field
        );
    }
});

test('proxy numeric settings accept only finite positive safe integers', () => {
    const originalMaxOutput = process.env.MATHGRAPH_PROXY_MAX_OUTPUT_TOKENS;
    const originalTimeout = process.env.MATHGRAPH_PROXY_TIMEOUT_MS;
    try {
        process.env.MATHGRAPH_PROXY_MAX_OUTPUT_TOKENS = '2048';
        process.env.MATHGRAPH_PROXY_TIMEOUT_MS = '2500';
        assert.equal(sanitizeProxyRequestBody({ model: 'gpt-5.5', input: [] }).max_output_tokens, 2048);
        assert.equal(getProxyTimeoutMs(), 2500);

        for (const invalid of ['0', '-1', '3.5', 'Infinity', 'NaN', '9007199254740992']) {
            process.env.MATHGRAPH_PROXY_MAX_OUTPUT_TOKENS = invalid;
            process.env.MATHGRAPH_PROXY_TIMEOUT_MS = invalid;
            assert.equal(sanitizeProxyRequestBody({ model: 'gpt-5.5', input: [] }).max_output_tokens, 16384, invalid);
            assert.equal(getProxyTimeoutMs(), 120000, invalid);
        }
    } finally {
        if (originalMaxOutput === undefined) delete process.env.MATHGRAPH_PROXY_MAX_OUTPUT_TOKENS;
        else process.env.MATHGRAPH_PROXY_MAX_OUTPUT_TOKENS = originalMaxOutput;
        if (originalTimeout === undefined) delete process.env.MATHGRAPH_PROXY_TIMEOUT_MS;
        else process.env.MATHGRAPH_PROXY_TIMEOUT_MS = originalTimeout;
    }
});

test('readJson parses a string body within the size limit', async () => {
    const body = await readJson({ body: '{"model":"gpt-5.5"}' });
    assert.deepEqual(body, { model: 'gpt-5.5' });
});

test('readJson rejects an oversized string body', async () => {
    await assert.rejects(
        readJson({ body: 'x'.repeat(64) }, { maxBytes: 16 }),
        PayloadTooLargeError
    );
});

test('readJson rejects an oversized streamed body', async () => {
    async function* chunks() {
        yield Buffer.from('x'.repeat(32));
        yield Buffer.from('x'.repeat(32));
    }
    const req = chunks();
    req.headers = {};
    await assert.rejects(readJson(req, { maxBytes: 16 }), PayloadTooLargeError);
});


test('readJson enforces the byte limit for pre-parsed object bodies', async () => {
    await assert.rejects(
        readJson({ body: { value: 'x'.repeat(128) } }, { maxBytes: 16 }),
        PayloadTooLargeError
    );
});
test('checkRateLimit blocks once the window budget is exhausted', () => {
    resetRateLimit();
    const options = { windowMs: 1000, max: 2 };
    assert.equal(checkRateLimit('k', options).allowed, true);
    assert.equal(checkRateLimit('k', options).allowed, true);
    const blocked = checkRateLimit('k', options);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterMs >= 0);
    // 다른 키는 독립적으로 카운트됩니다.
    assert.equal(checkRateLimit('other', options).allowed, true);
});

test('resetRateLimitKey clears only the selected bucket', () => {
    resetRateLimit();
    checkRateLimit('a', { windowMs: 1000, max: 1 });
    checkRateLimit('b', { windowMs: 1000, max: 1 });
    resetRateLimitKey('a');
    assert.equal(checkRateLimit('a', { windowMs: 1000, max: 1 }).allowed, true);
    assert.equal(checkRateLimit('b', { windowMs: 1000, max: 1 }).allowed, false);
});

test('checkRateLimit fails closed for a new key when active buckets fill the store', () => {
    resetRateLimit();
    const options = { windowMs: 60_000, max: 1, maxBuckets: 2 };
    assert.equal(checkRateLimit('oldest', options).allowed, true);
    assert.equal(checkRateLimit('newer', options).allowed, true);
    const overflow = checkRateLimit('newest', options);
    assert.equal(overflow.allowed, false);
    assert.equal(overflow.overflow, true);
    assert.equal(checkRateLimit('oldest', options).allowed, false);
});

test('login bucket churn cannot evict an active proxy rate limit', () => {
    resetRateLimit();
    const proxy = { windowMs: 60_000, max: 1, maxBuckets: 2, scope: 'proxy' };
    const login = { windowMs: 60_000, max: 1, maxBuckets: 2, scope: 'login' };

    assert.equal(checkRateLimit('proxy-owner', proxy).allowed, true);
    assert.equal(checkRateLimit('proxy-owner', proxy).allowed, false);
    assert.equal(checkRateLimit('login-a', login).allowed, true);
    assert.equal(checkRateLimit('login-b', login).allowed, true);
    assert.equal(checkRateLimit('login-c', login).allowed, false);
    assert.equal(checkRateLimit('proxy-owner', proxy).allowed, false);
});
