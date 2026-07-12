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

test('login rejects a body above the dedicated small login limit', async () => {
    const response = await invokeLogin({
        name: OWNER_NAME,
        password: 'x'.repeat(9000)
    });
    assert.equal(response.statusCode, 413);
});

test('login rejects overlong name and password fields before authentication work', async () => {
    const overlongName = await invokeLogin({ name: 'n'.repeat(129), password: 'wrong' });
    assert.equal(overlongName.statusCode, 400);

    const overlongPassword = await invokeLogin({ name: OWNER_NAME, password: 'x'.repeat(1025) });
    assert.equal(overlongPassword.statusCode, 400);
});

test('one address is blocked even when every invalid attempt rotates the name', async () => {
    for (let i = 0; i < 10; i += 1) {
        const response = await invokeLogin({ name: `rotating-${i}`, password: 'wrong' });
        assert.equal(response.statusCode, 401);
    }
    const blocked = await invokeLogin({ name: 'rotating-10', password: 'wrong' });
    assert.equal(blocked.statusCode, 429);
    assert.ok(blocked.headers['Retry-After']);
});
