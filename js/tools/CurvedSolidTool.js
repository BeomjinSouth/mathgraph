/**
 * CurvedSolidTool.js - 곡면 입체도형 생성 도구
 */

import { Tool } from './Tool.js';

export class CurvedSolidTool extends Tool {
    constructor(kind) {
        super(kind);
        this.kind = kind;
    }

    activate(app) {
        super.activate(app);
        app.openCurvedSolidModal?.(this.kind);
    }

    cancel(app) {
        super.cancel(app);
        const modal = document.getElementById('curvedSolidModal');
        if (modal) modal.classList.add('hidden');
        app.pendingCurvedSolidKind = null;
        app.toolManager.returnToSelect();
    }
}

export default CurvedSolidTool;
