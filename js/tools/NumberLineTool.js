/**
 * NumberLineTool.js - 수직선 생성 도구
 */

import { Tool } from './Tool.js';

/**
 * 수직선 생성 도구
 */
export class NumberLineTool extends Tool {
    constructor() {
        super('numberLine');
    }

    activate(app) {
        super.activate(app);
        // 모달 열기
        this.showModal(app);
    }

    showModal(app) {
        const modal = document.getElementById('numberLineModal');
        if (modal) {
            modal.classList.remove('hidden');

            // 기본값 설정
            const startInput = document.getElementById('nlStart');
            const endInput = document.getElementById('nlEnd');
            const stepInput = document.getElementById('nlStep');
            const yInput = document.getElementById('nlY');

            if (startInput) startInput.value = '-5';
            if (endInput) endInput.value = '5';
            if (stepInput) stepInput.value = '1';
            if (yInput) yInput.value = '0';
        } else {
            app.showToast('수직선 모달을 찾을 수 없습니다', 'error');
            app.toolManager.returnToSelect();
        }
    }

    cancel(app) {
        super.cancel(app);
        const modal = document.getElementById('numberLineModal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
}

export default NumberLineTool;
