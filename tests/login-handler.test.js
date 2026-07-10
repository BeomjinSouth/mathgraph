import assert from 'node:assert/strict';
import test from 'node:test';

process.env.MATHGRAPH_LOGIN_SECRET = 'test-signing-secret';
process.env.MATHGRAPH_OWNER_PASSWORD = 'correct-password';

const { default: loginHandler } = await import('../api/login.js');
const { OWNER_NAME, resetRateLimit } = await import('../lib/ownerAuth.js');

function createResponseRecorder() {
    return {
        statusCode: 200,
        headers: {},
        body: undefined,
        setHeader(name, value) {
            this.headers[name] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        }
    };
}

async function invokeLogin(body, address = '203.0.113.7') {
    const req = {
        method: 'POST',
        headers: { 'x-forwarded-for': address },
        body
    };
    const res = createResponseRecorder();
    await loginHandler(req, res);
    return res;
}

test.beforeEach(() => {
    resetRateLimit();
});

test('owner login blocks the eleventh invalid attempt for one address and name', async () => {
    for (let i = 0; i < 10; i += 1) {
        assert.equal((await invokeLogin({ name: OWNER_NAME, password: 'wrong' })).statusCode, 401);
    }
    const blocked = await invokeLogin({ name: OWNER_NAME, password: 'wrong' });
    assert.equal(blocked.statusCode, 429);
    assert.ok(blocked.headers['Retry-After']);
});

test('valid owner credentials still return a token within the attempt budget', async () => {
    const response = await invokeLogin({ name: OWNER_NAME, password: 'correct-password' });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.mode, 'owner');
});
