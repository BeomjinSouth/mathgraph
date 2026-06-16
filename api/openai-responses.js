import { createHmac, timingSafeEqual } from 'node:crypto';

const OWNER_NAME = process.env.MATHGRAPH_OWNER_NAME || '박범진';

function getSigningSecret() {
    return process.env.MATHGRAPH_LOGIN_SECRET
        || process.env.OPENAI_API_KEY
        || process.env.VERCEL_GIT_COMMIT_SHA
        || 'mathgraph-local-dev-secret';
}
function signPayload(encodedPayload) {
    return createHmac('sha256', getSigningSecret())
        .update(encodedPayload)
        .digest('base64url');
}

function safeEqual(left, right) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyToken(token) {
    const [encodedPayload, signature] = String(token || '').split('.');
    if (!encodedPayload || !signature) {
        return { valid: false, error: 'Missing login token.' };
    }

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

async function readJson(req) {
    if (req.body && typeof req.body === 'object') {
        return req.body;
    }

    if (typeof req.body === 'string') {
        return JSON.parse(req.body || '{}');
    }

    const chunks = [];
    for await (const chunk of req) {
        chunks.push(Buffer.from(chunk));
    }
    const rawBody = Buffer.concat(chunks).toString('utf8');
    return rawBody ? JSON.parse(rawBody) : {};
}

function getBearerToken(req) {
    const header = req.headers?.authorization || req.headers?.Authorization || '';
    const match = String(header).match(/^Bearer\s+(.+)$/i);
    return match?.[1] || '';
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const tokenResult = verifyToken(getBearerToken(req));
    if (!tokenResult.valid) {
        res.status(401).json({ error: tokenResult.error });
        return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        res.status(500).json({
            error: 'Server OpenAI API key is not configured. Set OPENAI_API_KEY in Vercel environment variables.'
        });
        return;
    }

    try {
        const requestBody = await readJson(req);
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                ...requestBody,
                store: false
            })
        });

        const responseText = await response.text();
        res.status(response.status);
        res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
        res.send(responseText);
    } catch (error) {
        res.status(502).json({
            error: error?.message || 'OpenAI proxy request failed.'
        });
    }
}
