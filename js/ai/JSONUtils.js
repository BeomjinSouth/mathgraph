/**
 * JSONUtils.js - Shared helpers for extracting and parsing AI JSON payloads.
 */

function collectFencedBlocks(text) {
    const matches = text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi);
    return Array.from(matches, (match) => match[1].trim()).filter(Boolean);
}

function extractBalancedJSON(text) {
    let start = -1;
    let stack = [];
    let inString = false;
    let escaped = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];

        if (start === -1) {
            if (char === '{' || char === '[') {
                start = i;
                stack = [char === '{' ? '}' : ']'];
            }
            continue;
        }

        if (inString) {
            if (escaped) {
                escaped = false;
            } else if (char === '\\') {
                escaped = true;
            } else if (char === '"') {
                inString = false;
            }
            continue;
        }

        if (char === '"') {
            inString = true;
            continue;
        }

        if (char === '{') {
            stack.push('}');
            continue;
        }

        if (char === '[') {
            stack.push(']');
            continue;
        }

        if (char === stack[stack.length - 1]) {
            stack.pop();
            if (stack.length === 0) {
                return text.slice(start, i + 1);
            }
        }
    }

    return null;
}

export function parseAIJSONPayload(payload) {
    if (payload === null || payload === undefined) {
        throw new Error('JSON payload is empty.');
    }

    if (typeof payload !== 'string') {
        if (typeof payload === 'object') {
            return payload;
        }
        throw new Error('JSON payload must be a string or object.');
    }

    const trimmed = payload.trim();
    if (!trimmed) {
        throw new Error('JSON payload is empty.');
    }

    const candidates = [
        trimmed,
        ...collectFencedBlocks(trimmed)
    ];

    const balanced = extractBalancedJSON(trimmed);
    if (balanced) {
        candidates.push(balanced);
    }

    let lastError = null;
    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Could not find a valid JSON object in the payload.');
}

export default {
    parseAIJSONPayload
};
