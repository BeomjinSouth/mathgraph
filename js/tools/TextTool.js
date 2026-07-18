/**
 * TextTool.js - 캔버스에 독립 설명문/수식을 배치하는 도구
 */

import { Tool } from './Tool.js';

export class TextTool extends Tool {
    constructor() {
        super('textLabel');
    }

    activate(app) {
        super.activate(app);
        app.showToast('글을 넣을 위치를 클릭하세요.', 'info');
    }

    onMouseDown(mathPos, screenPos, event, app) {
        app.openTextLabelModal?.(mathPos);
    }

    cancel(app) {
        super.cancel(app);
        const modal = document.getElementById('textLabelModal');
        if (modal) modal.classList.add('hidden');
        app.pendingTextPosition = null;
        app.toolManager.returnToSelect();
    }
}

export default TextTool;
