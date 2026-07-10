const STATE_LABELS = Object.freeze({
    checking: '지원 범위 확인 중',
    generating: '그림 생성 중',
    repairing: '도형 관계 보정 중',
    complete: '시험지용 그림 준비 완료',
    warning: '확인이 필요한 요청',
    error: '생성하지 못했습니다',
    idle: '그릴 내용을 입력하세요'
});

const SUPPORT_LABELS = Object.freeze({
    supported: '전용 도형 지원',
    approximated: '근사 표현 확인',
    excluded: '지원 제외 항목 있음',
    unknown: '지원 범위 확인 필요'
});

export class TeacherWorkflow {
    constructor(elements = {}) {
        this.elements = elements;
        this.prompt = String(elements.prompt?.value || '');
        this.state = 'idle';
        this.retryVisible = false;
        this.liveMessage = '';
        this.qualitySummary = {
            objectCount: 0,
            status: 'unknown',
            message: ''
        };
        this.setState('idle', { announce: false });
    }

    setPrompt(value) {
        this.prompt = String(value ?? '');
        if (this.elements.prompt) this.elements.prompt.value = this.prompt;
        return this.prompt;
    }

    setState(state, details = {}) {
        const nextState = STATE_LABELS[state] ? state : 'idle';
        const label = STATE_LABELS[nextState];
        this.state = nextState;
        this.retryVisible = nextState === 'error';
        this.liveMessage = String(details.message || label);

        if (this.elements.status) {
            this.elements.status.textContent = label;
            this.elements.status.dataset.state = nextState;
            this.elements.status.classList?.toggle('is-busy', ['checking', 'generating', 'repairing'].includes(nextState));
        }
        if (this.elements.retry) this.elements.retry.hidden = !this.retryVisible;
        if (this.elements.liveRegion && details.announce !== false) {
            this.elements.liveRegion.textContent = this.liveMessage;
        }

        return nextState;
    }

    updateQualitySummary(objects = [], supportResult = {}) {
        const status = SUPPORT_LABELS[supportResult.status] ? supportResult.status : 'unknown';
        const objectCount = Array.isArray(objects) ? objects.length : 0;
        const message = String(supportResult.message || SUPPORT_LABELS[status]);
        this.qualitySummary = { objectCount, status, message };

        if (this.elements.summary) {
            this.elements.summary.textContent = `객체 ${objectCount}개 · ${SUPPORT_LABELS[status]} · ${message}`;
            this.elements.summary.dataset.status = status;
        }

        return this.qualitySummary;
    }
}

export default TeacherWorkflow;
