import { Tool } from './Tool.js';

export class EqualAngleTool extends Tool {
    constructor() {
        super('equalAngle');
        this.points = [];
        this.markerCount = 1;
    }

    activate(app) {
        super.activate(app);
        this.points = [];
        app.showToast('첫 번째 각: 첫 점 → 꼭짓점 → 끝 점을 선택하세요.', 'info');
    }

    cancel(app) { super.cancel(app); this.points = []; app.render(); }

    onMouseDown(mathPos, screenPos, event, app) {
        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        if (!point) return;
        const inAngle = this.points.slice(Math.floor(this.points.length / 3) * 3);
        if (inAngle.some(item => item.id === point.id)) {
            app.showToast('각을 이루는 서로 다른 세 점을 선택하세요.', 'warning');
            return;
        }
        this.points.push(point);
        const count = this.points.length;
        if (count % 3 === 0) {
            const [a, b, c] = this.points.slice(-3).map(item => item.getPosition());
            if (a.distanceTo(b) < 1e-9 || c.distanceTo(b) < 1e-9) {
                this.points.splice(count - 3);
                app.showToast('겹치지 않는 세 점을 선택하세요.', 'warning');
                return;
            }
        }
        if (count === 6) {
            const [a, b, c, d, e, f] = this.points;
            if (b.id === e.id && [a.id, c.id].every(id => id === d.id || id === f.id)) {
                this.points.splice(3);
                app.showToast('두 번째 각은 다른 각을 선택하세요.', 'warning');
                return;
            }
            const params = { showValue: false, markerCount: this.markerCount };
            const first = app.objectManager.createAngleDimension(b.id, a.id, c.id, params);
            const second = app.objectManager.createAngleDimension(e.id, d.id, f.id, params);
            app.historyManager.recordBatch([first, second].map(object => ({ type: 'create', objectData: object.toJSON() })));
            app.objectManager.selectObject(second);
            this.markerCount++;
            this.points = [];
            app.toolManager.returnToSelect();
        } else {
            const next = count % 3 === 1 ? '꼭짓점을 선택하세요.' : count % 3 === 2 ? '끝 점을 선택하세요.' : '첫 점을 선택하세요.';
            app.showToast(`${count < 3 ? '첫 번째' : '두 번째'} 각: ${next}`, 'info');
        }
        app.render();
    }

    onMouseMove(mathPos, screenPos, delta, event, app) {
        app.objectManager.highlightObject(app.objectManager.findPointAt(mathPos, 8, app.canvas));
        app.render();
    }
}

export class CoordinateGuidesTool extends Tool {
    constructor() { super('coordinateGuides'); }
    activate(app) {
        super.activate(app);
        app.showToast('좌표를 표시할 점을 선택하세요.', 'info');
    }
    onMouseDown(mathPos, screenPos, event, app) {
        const point = app.objectManager.findPointAt(mathPos, 8, app.canvas);
        if (!point) return;
        let guides = app.objectManager.getAllObjects().find(obj => obj.type === 'coordinateGuides' && obj.originId === point.id);
        if (!guides) {
            guides = app.objectManager.createCoordinateGuides(point.id);
            app.historyManager.recordCreate(guides);
        }
        app.objectManager.selectObject(guides);
        app.toolManager.returnToSelect();
        app.render();
    }
    onMouseMove(mathPos, screenPos, delta, event, app) {
        app.objectManager.highlightObject(app.objectManager.findPointAt(mathPos, 8, app.canvas));
        app.render();
    }
}
