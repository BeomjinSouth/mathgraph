import { Tool } from './Tool.js';
import { normalizeExportAreaRect } from '../utils/ExportArea.js';

export class AreaExportTool extends Tool {
    constructor() {
        super('areaExport');
        this.startScreen = null;
        this.currentScreen = null;
        this.isDragging = false;
    }

    activate(app) {
        super.activate(app);
        app.canvasElement?.classList.add('area-export-mode');
    }

    deactivate(app) {
        super.deactivate(app);
        app.canvasElement?.classList.remove('area-export-mode');
        this.reset();
    }

    reset() {
        this.startScreen = null;
        this.currentScreen = null;
        this.isDragging = false;
    }

    onMouseDown(mathPos, screenPos, event, app) {
        if (event.button !== 0) return;

        this.startScreen = screenPos.clone();
        this.currentScreen = screenPos.clone();
        this.isDragging = true;
        app.objectManager.clearHighlight?.();
        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        if (!this.isDragging) return;

        this.currentScreen = screenPos.clone();
        app.render();
    }

    onMouseUp(mathPos, screenPos, event, app) {
        if (!this.isDragging || !this.startScreen) return;

        this.currentScreen = screenPos.clone();
        const rect = normalizeExportAreaRect(
            this.startScreen,
            this.currentScreen,
            { width: app.canvas.width, height: app.canvas.height }
        );

        this.reset();

        if (!rect) {
            app.showToast('저장할 영역을 조금 더 크게 드래그하세요.', 'warning');
            app.toolManager?.setTool('select');
            app.render();
            return;
        }

        app.exportAreaFromScreenRect(rect);
        app.toolManager?.setTool('select');
        app.render();
    }

    cancel(app) {
        this.reset();
        app.toolManager?.setTool('select');
        app.showToast('영역 저장이 취소되었습니다.', 'info');
    }

    render(canvas) {
        if (!this.isDragging || !this.startScreen || !this.currentScreen) return;

        const x = Math.min(this.startScreen.x, this.currentScreen.x);
        const y = Math.min(this.startScreen.y, this.currentScreen.y);
        const width = Math.abs(this.currentScreen.x - this.startScreen.x);
        const height = Math.abs(this.currentScreen.y - this.startScreen.y);
        const ctx = canvas.ctx;

        ctx.save();
        ctx.fillStyle = 'rgba(14, 165, 233, 0.12)';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
        ctx.restore();
    }

    getCursor() {
        return 'crosshair';
    }
}

export default AreaExportTool;
