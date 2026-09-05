import { extractOpenAIResponseText, fetchWithTimeout } from './AIService.js';
import { parseAIJSONPayload } from './JSONUtils.js';
import { PROBLEM_DOCUMENT_FORMAT, PROBLEM_DOCUMENT_PROMPT, normalizeProblemDocument } from '../utils/ProblemDocument.js';

export async function recognizeProblemDocument(service, imageDataUrl, { signal } = {}) {
    const config = service.config;
    if (config.provider === 'local' || (config.authMode !== 'owner' && !config.apiKey)) {
        throw new Error('사진 인식에는 AI 설정의 API 키가 필요합니다. 본문을 직접 입력할 수도 있습니다.');
    }
    let response;
    if (config.provider === 'openai') {
        const transport = service.buildOpenAITransport();
        const body = service.buildOpenAIRequestBodyFromInput([
            { role: 'developer', content: PROBLEM_DOCUMENT_PROMPT },
            { role: 'user', content: [
                { type: 'input_text', text: '문제 본문과 보기를 빠짐없이 옮겨 주세요.' },
                { type: 'input_image', image_url: imageDataUrl, detail: 'high' }
            ] }
        ], { responseFormat: PROBLEM_DOCUMENT_FORMAT });
        response = await fetchWithTimeout(transport.url, { method: 'POST', headers: transport.headers, body: JSON.stringify(body), signal });
    } else if (config.provider === 'gemini') {
        const match = /^data:(image\/[\w.+-]+);base64,(.+)$/.exec(imageDataUrl);
        if (!match) throw new Error('사진 형식을 읽을 수 없습니다.');
        response = await fetchWithTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`, {
            method: 'POST', signal,
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
            body: JSON.stringify({
                contents: [{ parts: [{ text: PROBLEM_DOCUMENT_PROMPT + '\nJSON 형식: ' + JSON.stringify(PROBLEM_DOCUMENT_FORMAT.schema) }, { inline_data: { mime_type: match[1], data: match[2] } }] }],
                generationConfig: { responseMimeType: 'application/json' }
            })
        });
    } else throw new Error('현재 AI 설정으로 사진을 인식할 수 없습니다.');
    if (!response.ok) throw new Error(await service.extractApiErrorMessage(response, '문제를 인식하지 못했습니다.'));
    const data = await response.json();
    const content = config.provider === 'openai' ? extractOpenAIResponseText(data) : (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    return normalizeProblemDocument(parseAIJSONPayload(content));
}
