/**
 * Tool.js 역할
 * 이 파일은 "도구"의 공통 인터페이스와 "도구 관리자"를 정의합니다.
 * 사용자는 좌측 패널이나 단축키로 도구를 선택하고
 * 각 도구는 마우스 이벤트를 받아 점, 선, 원 같은 객체를 생성하거나 편집합니다.
 *
 * 이번 변경의 의도는 다음과 같습니다.
 * - 선(선분, 직선 등)을 한 번 그린 뒤 자동으로 선택/이동으로 복귀하기를 원합니다.
 * - 기존에는 segment, line이 persistentTools에 포함되어 있어 returnToSelect가 동작하지 않았습니다.
 * - 따라서 select만 "지속 도구"로 유지하고 나머지 도구는 작업 완료 후 선택 도구로 복귀하도록 바꿉니다.
 */

import { Vec2 } from '../utils/Geometry.js';

/**
 * 도구 기본 클래스
 */
export class Tool {
    constructor(name) {
        this.name = name;
        this.isActive = false;

        // 임시 상태 (도구 사용 중 클릭 순서 등)
        this.state = {};
    }

    /**
     * 도구 활성화
     */
    activate(app) {
        this.isActive = true;
        this.state = {};
    }

    /**
     * 도구 비활성화
     */
    deactivate(app) {
        this.isActive = false;
        this.state = {};
    }

    /**
     * 도구 취소 (Escape)
     */
    cancel(app) {
        this.state = {};
    }

    /**
     * 마우스 이벤트 핸들러 (오버라이드)
     */
    onMouseDown(mathPos, screenPos, event, app) { }
    onMouseMove(mathPos, screenPos, delta, event, app) { }
    onMouseUp(mathPos, screenPos, event, app) { }
    onDoubleClick(mathPos, screenPos, event, app) { }

    /**
     * 렌더링 (미리보기 등)
     */
    render(canvas, app) { }

    /**
     * 커서 스타일
     */
    getCursor() {
        return 'crosshair';
    }
}

/**
 * 도구 관리자
 */
export class ToolManager {
    constructor(app) {
        this.app = app;
        this.tools = new Map();
        this.currentTool = null;
        this.currentToolName = null;

        // Mk2.1: 사용 후에도 유지되는 도구는 선택 도구만 유지합니다
        // 이유는 사용자가 선을 하나 그릴 때마다 "선 도구가 계속 유지"되면
        // 의도치 않게 선이 연속으로 생성되는 UX가 발생할 수 있기 때문입니다.
        this.persistentTools = ['select'];
    }

    /**
     * 도구 등록
     */
    registerTool(name, tool) {
        this.tools.set(name, tool);
    }

    /**
     * 도구 선택
     */
    setTool(name) {
        if (this.currentTool) {
            this.currentTool.deactivate(this.app);
        }

        const tool = this.tools.get(name);
        if (tool) {
            this.currentTool = tool;
            this.currentToolName = name;
            tool.activate(this.app);

            // UI 업데이트
            this.updateToolbarUI(name);

            // 커서 업데이트
            this.app.canvasElement.style.cursor = tool.getCursor();
        }
    }

    /**
     * Mk.2: 도구 사용 후 선택 도구로 돌아가기
     * persistentTools(select, segment, line)는 유지됨
     */
    returnToSelect() {
        if (!this.persistentTools.includes(this.currentToolName)) {
            this.setTool('select');
        }
    }

    /**
     * 현재 도구 반환
     */
    getCurrentTool() {
        return this.currentTool;
    }

    /**
     * 현재 도구 이름 반환
     */
    getCurrentToolName() {
        return this.currentToolName;
    }

    /**
     * 도구바 UI 업데이트
     */
    updateToolbarUI(activeName) {
        // 모든 도구 버튼에서 active 제거
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 현재 도구에 active 추가
        const activeBtn = document.querySelector(`[data-tool="${activeName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
}

export default { Tool, ToolManager };
