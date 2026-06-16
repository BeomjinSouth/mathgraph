import { createHmac } from 'node:crypto';

const OWNER_NAME = process.env.MATHGRAPH_OWNER_NAME || '박범진';
const DEFAULT_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

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

function createToken(payload) {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${encodedPayload}.${signPayload(encodedPayload)}`;
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

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const body = await readJson(req);
        const name = String(body?.name || '').normalize('NFKC').trim();

        if (name !== OWNER_NAME) {
            res.status(401).json({
                error: '등록된 이름이 아닙니다. 게스트로 진행하거나 이름을 다시 확인하세요.'
            });
            return;
        }

        const ttlMs = Number(process.env.MATHGRAPH_OWNER_TOKEN_TTL_MS) || DEFAULT_TOKEN_TTL_MS;
        const issuedAt = Date.now();
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
        res.status(400).json({
            error: error?.message || '로그인 요청을 처리하지 못했습니다.'
        });
    }
}
