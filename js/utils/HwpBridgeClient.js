export class HwpBridgeClient {
    constructor({ storage = globalThis.sessionStorage, fetchImpl = globalThis.fetch, baseUrl = 'http://127.0.0.1:18765' } = {}) {
        this.storage = storage;
        this.fetch = (url, options) => fetchImpl.call(globalThis, url, options);
        this.baseUrl = baseUrl;
        this.token = storage?.getItem('mathgraph_hwp_token') || '';
        this.pending = null;
    }
    connect(token) {
        if (!/^[a-zA-Z0-9_-]{32,100}$/.test(token)) throw new Error('연결 프로그램에서 연 주소를 사용하거나 연결 코드를 다시 확인해 주세요.');
        this.token = token;
        this.storage?.setItem('mathgraph_hwp_token', token);
    }
    async request(path, body, timeout = 120000) {
        if (!this.token) throw new Error('한글 연결 프로그램을 먼저 실행해 주세요.');
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await this.fetch(this.baseUrl + path, {
                method: body ? 'POST' : 'GET',
                headers: { Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
                body: body ? JSON.stringify(body) : undefined, signal: controller.signal,
                credentials: 'omit', cache: 'no-store'
            });
            const result = await response.json();
            if (!response.ok) {
                const error = new Error(result.error || '한글 연결 요청을 처리하지 못했습니다.');
                error.final = result.final === true;
                throw error;
            }
            return result;
        } catch (error) {
            if (error.name === 'AbortError') throw new Error(body
                ? '한글의 처리 결과를 확인하지 못했습니다. 문서를 확인한 뒤 같은 요청을 다시 확인해 주세요.'
                : '한글 연결을 확인하지 못했습니다. 연결 프로그램과 브라우저의 로컬 연결 허용 여부를 확인한 뒤 다시 연결해 주세요.');
            if (error instanceof TypeError) throw new Error('한글 연결 프로그램이 실행 중인지 확인해 주세요. 브라우저가 로컬 연결을 물으면 허용해야 합니다.');
            throw error;
        } finally { clearTimeout(timer); }
    }
    documents() { return this.request('/documents', null, 10000); }
    async insert(payload) {
        const serialized = JSON.stringify(payload);
        if (this.pending && this.pending.serialized !== serialized) {
            throw new Error('앞선 입력 결과가 확인되지 않았습니다. 먼저 결과 다시 확인을 눌러 주세요.');
        }
        this.pending ||= { requestId: crypto.randomUUID(), serialized, payload };
        return this.retryPending();
    }
    async retryPending() {
        if (!this.pending) throw new Error('확인할 입력 요청이 없습니다.');
        try {
            const result = await this.request('/insert', { ...this.pending.payload, requestId: this.pending.requestId });
            this.pending = null;
            return result;
        } catch (error) {
            if (error.final) this.pending = null;
            throw error;
        }
    }
}
