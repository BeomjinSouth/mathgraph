import assert from 'node:assert/strict';
import test from 'node:test';

// 테스트 전체에서 사용할 서명 시크릿을 먼저 설정합니다(함수들이 호출 시점에 env를 읽음).
process.env.MATHGRAPH_LOGIN_SECRET = 'test-signing-secret';

const {
    AuthConfigError,
    PayloadTooLargeError,
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
    resetRateLimit
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
