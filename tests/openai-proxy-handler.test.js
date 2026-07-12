import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MATHGRAPH_LOGIN_SECRET = 'proxy-handler-test-signing-secret';
process.env.MATHGRAPH_OWNER_PASSWORD = 'proxy-handler-test-password';

const { default: handler } = await import('../api/openai-responses.js');
const { default: loginHandler } = await import('../api/login.js');
const {
    OWNER_NAME,
    createToken,
    resetRateLimit
} = await import('../lib/ownerAuth.js');

function ownerToken(sequence) {
    const now = Date.now();
    return createToken({
        sub: 'owner',
        name: OWNER_NAME,
        iat: now + sequence,
        exp: now + 60_000,
        sequence
    });
}

function createRequest(token, body) {
    return {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body
    };
}

function createResponse() {
    return {
        headers: new Map(),
        statusCode: 0,
        body: undefined,
        setHeader(name, value) {
            this.headers.set(String(name).toLowerCase(), value);
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(value) {
            this.body = value;
            return this;
        },
        send(value) {
            this.body = value;
            return this;
        }
    };
}

async function withProxyEnvironment(overrides, callback) {
    const names = [
        'OPENAI_API_KEY',
        'MATHGRAPH_PROXY_RATE_MAX',
        'MATHGRAPH_PROXY_RATE_WINDOW_MS',
        'MATHGRAPH_PROXY_TIMEOUT_MS'
    ];
    const originalEnv = Object.fromEntries(names.map(name => [name, process.env[name]]));
    const originalFetch = globalThis.fetch;
    try {
        Object.assign(process.env, overrides);
        resetRateLimit();
        await callback();
    } finally {
        globalThis.fetch = originalFetch;
        resetRateLimit();
        for (const name of names) {
            if (originalEnv[name] === undefined) delete process.env[name];
            else process.env[name] = originalEnv[name];
        }
    }
}

test('proxy rate limit follows verified owner subject across distinct bearer tokens', async () => {
    await withProxyEnvironment({
        OPENAI_API_KEY: 'server-test-key',
        MATHGRAPH_PROXY_RATE_MAX: '1',
        MATHGRAPH_PROXY_RATE_WINDOW_MS: '60000'
    }, async () => {
        const firstToken = ownerToken(1);
        const secondToken = ownerToken(2);
        assert.notEqual(firstToken, secondToken);

        let fetchCalls = 0;
        globalThis.fetch = async () => {
            fetchCalls += 1;
            return {
                status: 200,
                headers: { get: () => 'application/json' },
                async text() { return '{"id":"resp_first"}'; }
            };
        };

        const firstResponse = createResponse();
        await handler(createRequest(firstToken, { model: 'gpt-5.5', input: [] }), firstResponse);
        assert.equal(firstResponse.statusCode, 200);

        const secondResponse = createResponse();
        await handler(createRequest(secondToken, { model: 'gpt-5.5', input: [] }), secondResponse);
        assert.equal(secondResponse.statusCode, 429);
        assert.equal(fetchCalls, 1);
    });
});

test('high-cardinality login traffic cannot reset an active proxy rate limit', async () => {
    await withProxyEnvironment({
        OPENAI_API_KEY: 'server-test-key',
        MATHGRAPH_PROXY_RATE_MAX: '1',
        MATHGRAPH_PROXY_RATE_WINDOW_MS: '60000'
    }, async () => {
        globalThis.fetch = async () => ({
            status: 200,
            headers: { get: () => 'application/json' },
            async text() { return '{"id":"resp_isolated"}'; }
        });

        const first = createResponse();
        await handler(createRequest(ownerToken(10), { model: 'gpt-5.5', input: [] }), first);
        assert.equal(first.statusCode, 200);

        const initiallyBlocked = createResponse();
        await handler(createRequest(ownerToken(11), { model: 'gpt-5.5', input: [] }), initiallyBlocked);
        assert.equal(initiallyBlocked.statusCode, 429);

        for (let i = 0; i < 1024; i += 1) {
            const loginResponse = createResponse();
            await loginHandler({
                method: 'POST',
                headers: { 'x-forwarded-for': `198.51.${Math.floor(i / 256)}.${i % 256}` },
                body: { name: `rotating-${i}`, password: 'wrong' }
            }, loginResponse);
            assert.equal(loginResponse.statusCode, 401);
        }

        const stillBlocked = createResponse();
        await handler(createRequest(ownerToken(12), { model: 'gpt-5.5', input: [] }), stillBlocked);
        assert.equal(stillBlocked.statusCode, 429);
    });
});

test('proxy forwards preserved Structured Outputs input through the server-owned policy', async () => {
    await withProxyEnvironment({
        OPENAI_API_KEY: 'server-test-key',
        MATHGRAPH_PROXY_RATE_MAX: '30',
        MATHGRAPH_PROXY_TIMEOUT_MS: '500'
    }, async () => {
        let capturedBody;
        globalThis.fetch = async (_url, init) => {
            capturedBody = JSON.parse(init.body);
            return {
                status: 200,
                headers: { get: () => 'application/json' },
                async text() { return '{"id":"resp_structured"}'; }
            };
        };

        const requestBody = {
            model: 'gpt-5.5',
            input: [{
                role: 'user',
                content: [
                    { type: 'input_text', text: '재현' },
                    { type: 'input_image', image_url: 'data:image/png;base64,AAAA', detail: 'high' }
                ]
            }],
            reasoning: { effort: 'medium' },
            text: {
                verbosity: 'low',
                format: {
                    type: 'json_schema',
                    name: 'graph_operations',
                    strict: true,
                    schema: { type: 'object', properties: { operations: { type: 'array' } } }
                }
            },
            store: true
        };
        const response = createResponse();
        await handler(createRequest(ownerToken(3), requestBody), response);

        assert.equal(response.statusCode, 200);
        assert.deepEqual(capturedBody.input, requestBody.input);
        assert.deepEqual(capturedBody.text, requestBody.text);
        assert.deepEqual(capturedBody.reasoning, requestBody.reasoning);
        assert.equal(capturedBody.store, false);
        assert.equal(capturedBody.max_output_tokens, 16384);
    });
});

test('proxy returns 504 when the upstream OpenAI request exceeds a small configured timeout', async () => {
    await withProxyEnvironment({
        OPENAI_API_KEY: 'server-test-key',
        MATHGRAPH_PROXY_RATE_MAX: '30',
        MATHGRAPH_PROXY_TIMEOUT_MS: '5'
    }, async () => {
        globalThis.fetch = async (_url, init) => new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            }, { once: true });
        });

        const response = createResponse();
        await handler(createRequest(ownerToken(4), { model: 'gpt-5.5', input: [] }), response);

        assert.equal(response.statusCode, 504);
        assert.match(response.body.error, /시간이 초과/);
    });
});
