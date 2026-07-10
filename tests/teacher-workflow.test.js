import assert from 'node:assert/strict';
import test from 'node:test';

import { TeacherWorkflow } from '../js/ui/TeacherWorkflow.js';

function createElementStub() {
    return {
        textContent: '',
        value: '',
        hidden: false,
        dataset: {},
        classList: {
            values: new Set(),
            toggle(name, active) {
                if (active) this.values.add(name);
                else this.values.delete(name);
            }
        }
    };
}

function createWorkflowHarness() {
    const elements = {
        prompt: createElementStub(),
        status: createElementStub(),
        retry: createElementStub(),
        summary: createElementStub(),
        liveRegion: createElementStub()
    };
    return {
        elements,
        workflow: new TeacherWorkflow(elements)
    };
}

test('workflow keeps prompt on errors and exposes retry', () => {
    const { workflow, elements } = createWorkflowHarness();
    workflow.setPrompt('원뿔과 구를 그려줘');
    workflow.setState('error', { message: '응답 시간이 초과되었습니다.' });

    assert.equal(workflow.prompt, '원뿔과 구를 그려줘');
    assert.equal(elements.prompt.value, '원뿔과 구를 그려줘');
    assert.equal(workflow.retryVisible, true);
    assert.equal(elements.retry.hidden, false);
    assert.equal(workflow.liveMessage, '응답 시간이 초과되었습니다.');
    assert.equal(elements.liveRegion.textContent, '응답 시간이 초과되었습니다.');
});

test('workflow reports supported, approximate, and excluded quality summaries', () => {
    const { workflow, elements } = createWorkflowHarness();
    const summary = workflow.updateQualitySummary([
        { type: 'point' },
        { type: 'cylinder' },
        { type: 'textLabel' }
    ], {
        status: 'approximated',
        supported: ['cylinder'],
        approximated: ['annularSector'],
        excluded: [],
        message: '고리 부채꼴은 근사해 생성합니다.'
    });

    assert.equal(summary.objectCount, 3);
    assert.equal(summary.status, 'approximated');
    assert.match(elements.summary.textContent, /객체 3개/);
    assert.match(elements.summary.textContent, /근사/);
});

test('workflow lifecycle exposes stable status labels', () => {
    const { workflow, elements } = createWorkflowHarness();
    const labels = {
        checking: '지원 범위 확인 중',
        generating: '그림 생성 중',
        repairing: '도형 관계 보정 중',
        complete: '시험지용 그림 준비 완료',
        warning: '확인이 필요한 요청',
        error: '생성하지 못했습니다'
    };

    for (const [state, label] of Object.entries(labels)) {
        workflow.setState(state);
        assert.equal(elements.status.textContent, label);
    }
});
