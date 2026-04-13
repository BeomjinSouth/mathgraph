/**
 * CommandPalette.js 역할
 * 이 파일은 Ctrl+K로 열리는 명령 팔레트 UI를 제공합니다.
 * 사용자는 도구 전환, 편집 명령, 뷰 명령 등을 검색해 빠르게 실행할 수 있습니다.
 *
 * 이번 변경의 의도는 다음과 같습니다.
 * - 사용자가 요청한 단축키 변경과 일치하도록 표시 단축키를 업데이트합니다.
 * - 점 도구 단축키를 P에서 D로 변경합니다.
 */

export class CommandPalette {
    constructor(app) {
        this.app = app;
        this.isOpen = false;
        this.commands = [];
        this.filteredCommands = [];
        this.selectedIndex = 0;

        this.setupCommands();
        this.createUI();
        this.setupEventListeners();
    }

    /**
     * 명령 목록 설정
     */
    setupCommands() {
        this.commands = [
            // 도구 명령
            { name: '선택 도구', category: '도구', action: () => this.app.toolManager.setTool('select'), shortcut: 'V' },
            { name: '점 도구', category: '도구', action: () => this.app.toolManager.setTool('point'), shortcut: 'D' },
            { name: '선분 도구', category: '도구', action: () => this.app.toolManager.setTool('segment'), shortcut: 'S' },
            { name: '직선 도구', category: '도구', action: () => this.app.toolManager.setTool('line'), shortcut: 'L' },
            { name: '반직선 도구', category: '도구', action: () => this.app.toolManager.setTool('ray'), shortcut: 'R' },
            { name: '원 도구', category: '도구', action: () => this.app.toolManager.setTool('circle'), shortcut: 'C' },
            { name: '세 점 원 도구', category: '도구', action: () => this.app.toolManager.setTool('circleThreePoints') },
            { name: '호 도구', category: '도구', action: () => this.app.toolManager.setTool('arc') },
            { name: '부채꼴 도구', category: '도구', action: () => this.app.toolManager.setTool('sector') },
            { name: '활꼴 도구', category: '도구', action: () => this.app.toolManager.setTool('circularSegment') },
            { name: '함수 그래프 도구', category: '도구', action: () => this.app.toolManager.setTool('function'), shortcut: 'F' },
            { name: '교점 도구', category: '도구', action: () => this.app.toolManager.setTool('intersection'), shortcut: 'I' },
            { name: '중점 도구', category: '도구', action: () => this.app.toolManager.setTool('midpoint'), shortcut: 'M' },
            { name: '평행선 도구', category: '도구', action: () => this.app.toolManager.setTool('parallel') },
            { name: '수선 도구', category: '도구', action: () => this.app.toolManager.setTool('perpendicular') },
            { name: '수직이등분선 도구', category: '도구', action: () => this.app.toolManager.setTool('perpendicularBisector') },
            { name: '각의 이등분선 도구', category: '도구', action: () => this.app.toolManager.setTool('angleBisector') },
            { name: '벡터 도구', category: '도구', action: () => this.app.toolManager.setTool('vector'), shortcut: 'W' },
            { name: '길이 치수 도구', category: '도구', action: () => this.app.toolManager.setTool('lengthDimension'), shortcut: 'E' },
            { name: '각도 치수 도구', category: '도구', action: () => this.app.toolManager.setTool('angleDimension'), shortcut: 'A' },
            { name: '직각 표시 도구', category: '도구', action: () => this.app.toolManager.setTool('rightAngle') },
            { name: '같은 길이 표시 도구', category: '도구', action: () => this.app.toolManager.setTool('equalLength') },
            { name: '각기둥 도구', category: '도구', action: () => this.app.toolManager.setTool('prism') },
            { name: '각뿔 도구', category: '도구', action: () => this.app.toolManager.setTool('pyramid') },

            // 편집 명령
            { name: '되돌리기', category: '편집', action: () => { this.app.historyManager.undo(); this.app.render(); }, shortcut: 'Ctrl+Z' },
            { name: '다시하기', category: '편집', action: () => { this.app.historyManager.redo(); this.app.render(); }, shortcut: 'Ctrl+Y' },
            { name: '전체 선택', category: '편집', action: () => this.selectAll(), shortcut: 'Ctrl+A' },
            { name: '선택 삭제', category: '편집', action: () => this.app.deleteSelectedObjects(), shortcut: 'Delete' },
            { name: '복사', category: '편집', action: () => this.app.eventHandler.copySelectedObjects(), shortcut: 'Ctrl+C' },
            { name: '붙여넣기', category: '편집', action: () => this.app.eventHandler.pasteObjects(), shortcut: 'Ctrl+V' },

            // 뷰 명령
            { name: '확대', category: '뷰', action: () => { this.app.canvas.zoom(1.2); this.app.render(); this.app.updateZoomDisplay(); } },
            { name: '축소', category: '뷰', action: () => { this.app.canvas.zoom(0.8); this.app.render(); this.app.updateZoomDisplay(); } },
            { name: '뷰 초기화', category: '뷰', action: () => { this.app.canvas.resetView(); this.app.render(); this.app.updateZoomDisplay(); } },
            { name: '격자 토글', category: '뷰', action: () => { this.app.setGridVisibility(!this.app.canvas.showGrid); } },
            { name: '축 토글', category: '뷰', action: () => { this.app.toggleAxesVisibility(); } },

            // 내보내기
            { name: 'PNG로 내보내기', category: '내보내기', action: () => this.app.exportPNG() },
            { name: 'SVG로 내보내기', category: '내보내기', action: () => this.app.exportSVG() },

            // 기타
            { name: '전체 지우기', category: '기타', action: () => { this.app.objectManager.clear(); this.app.render(); this.app.updateSidebar(); } },
            { name: '로컬에 저장', category: '기타', action: () => this.app.saveToLocal() },
            { name: '로컬에서 불러오기', category: '기타', action: () => { this.app.loadFromLocal(); this.app.render(); } }
        ];

        this.filteredCommands = [...this.commands];
    }

    /**
     * 전체 선택 헬퍼
     */
    selectAll() {
        for (const obj of this.app.objectManager.getAllObjects()) {
            this.app.objectManager.selectObject(obj, true);
        }
        this.app.render();
    }

    /**
     * UI 생성
     */
    createUI() {
        // 오버레이
        this.overlay = document.createElement('div');
        this.overlay.className = 'command-palette-overlay hidden';
        this.overlay.addEventListener('click', () => this.close());

        // 팔레트 컨테이너
        this.palette = document.createElement('div');
        this.palette.className = 'command-palette hidden';

        // 입력창
        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'command-palette-input';
        this.input.placeholder = '명령어 또는 대수식 입력... (예: 점, y=x^2)';

        // 결과 목록
        this.resultList = document.createElement('div');
        this.resultList.className = 'command-palette-results';

        this.palette.appendChild(this.input);
        this.palette.appendChild(this.resultList);

        document.body.appendChild(this.overlay);
        document.body.appendChild(this.palette);

        // CSS 추가
        this.addStyles();
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // Ctrl+K로 열기
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.toggle();
            }

            if (this.isOpen) {
                if (e.key === 'Escape') {
                    this.close();
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.moveSelection(1);
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.moveSelection(-1);
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    this.executeSelected();
                }
            }
        });

        // 입력 이벤트
        this.input.addEventListener('input', () => {
            this.filter(this.input.value);
        });
    }

    /**
     * 토글
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * 열기
     */
    open() {
        this.isOpen = true;
        this.overlay.classList.remove('hidden');
        this.palette.classList.remove('hidden');
        this.input.value = '';
        this.filter('');
        this.input.focus();
    }

    /**
     * 닫기
     */
    close() {
        this.isOpen = false;
        this.overlay.classList.add('hidden');
        this.palette.classList.add('hidden');
        this.input.blur();
    }

    /**
     * 필터링
     */
    filter(query) {
        const q = query.toLowerCase().trim();

        if (!q) {
            this.filteredCommands = [...this.commands];
        } else {
            this.filteredCommands = this.commands.filter(cmd =>
                cmd.name.toLowerCase().includes(q) ||
                cmd.category.toLowerCase().includes(q)
            );
        }

        this.selectedIndex = 0;
        this.renderResults(q);
    }

    /**
     * 결과 렌더링
     */
    renderResults(query) {
        // 대수식 입력 힌트
        let algebraHint = '';
        if (query && this.filteredCommands.length === 0) {
            algebraHint = `
                <div class="command-item algebra-hint" data-action="algebra">
                    <div class="command-icon">📐</div>
                    <div class="command-info">
                        <div class="command-name">"${query}" 대수식으로 생성</div>
                        <div class="command-category">Enter를 눌러 생성</div>
                    </div>
                </div>
            `;
        }

        this.resultList.innerHTML = algebraHint + this.filteredCommands.slice(0, 10).map((cmd, i) => `
            <div class="command-item ${i === this.selectedIndex ? 'selected' : ''}" data-index="${i}">
                <div class="command-icon">${this.getCategoryIcon(cmd.category)}</div>
                <div class="command-info">
                    <div class="command-name">${this.highlightMatch(cmd.name, query)}</div>
                    <div class="command-category">${cmd.category}${cmd.shortcut ? ` · ${cmd.shortcut}` : ''}</div>
                </div>
            </div>
        `).join('');

        // 클릭 이벤트
        this.resultList.querySelectorAll('.command-item').forEach((item, i) => {
            item.addEventListener('click', () => {
                if (item.dataset.action === 'algebra') {
                    this.executeAlgebra(query);
                } else {
                    this.selectedIndex = parseInt(item.dataset.index);
                    this.executeSelected();
                }
            });
            item.addEventListener('mouseenter', () => {
                this.selectedIndex = parseInt(item.dataset.index) || 0;
                this.updateSelection();
            });
        });
    }

    /**
     * 카테고리 아이콘
     */
    getCategoryIcon(category) {
        const icons = {
            '도구': '🔧',
            '편집': '✏️',
            '뷰': '👁️',
            '내보내기': '📤',
            '기타': '⚙️'
        };
        return icons[category] || '📋';
    }

    /**
     * 검색어 하이라이트
     */
    highlightMatch(text, query) {
        if (!query) return text;
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    /**
     * 선택 이동
     */
    moveSelection(delta) {
        const maxIndex = this.filteredCommands.length - 1;
        this.selectedIndex = Math.max(0, Math.min(maxIndex, this.selectedIndex + delta));
        this.updateSelection();
    }

    /**
     * 선택 업데이트
     */
    updateSelection() {
        this.resultList.querySelectorAll('.command-item').forEach((item, i) => {
            if (item.dataset.action !== 'algebra') {
                item.classList.toggle('selected', parseInt(item.dataset.index) === this.selectedIndex);
            }
        });
    }

    /**
     * 선택된 명령 실행
     */
    executeSelected() {
        const query = this.input.value.trim();

        // 대수식 모드 (명령이 없을 때)
        if (this.filteredCommands.length === 0 && query) {
            this.executeAlgebra(query);
            return;
        }

        const cmd = this.filteredCommands[this.selectedIndex];
        if (cmd) {
            cmd.action();
            this.close();
            this.app.showToast(`${cmd.name} 실행됨`, 'success');
        }
    }

    /**
     * 대수식 실행
     */
    executeAlgebra(expression) {
        if (this.app.algebraInput) {
            const result = this.app.algebraInput.parse(expression);
            if (result.success) {
                this.app.render();
                this.app.updateSidebar();
                this.app.showToast(result.message, 'success');
            } else {
                this.app.showToast(result.message, 'error');
            }
        } else {
            this.app.showToast('대수식 입력을 지원하지 않습니다.', 'warning');
        }
        this.close();
    }

    /**
     * 스타일 추가
     */
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .command-palette-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 999;
            }

            .command-palette {
                position: fixed;
                top: 20%;
                left: 50%;
                transform: translateX(-50%);
                width: 500px;
                max-width: 90vw;
                background: var(--bg-secondary, #1a1a2e);
                border-radius: 12px;
                box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
                border: 1px solid var(--border-color, #3d3d5c);
                z-index: 1000;
                overflow: hidden;
            }

            .command-palette-input {
                width: 100%;
                padding: 16px 20px;
                border: none;
                border-bottom: 1px solid var(--border-color, #3d3d5c);
                background: transparent;
                color: var(--text-primary, white);
                font-size: 16px;
                outline: none;
            }

            .command-palette-input::placeholder {
                color: var(--text-muted, #606080);
            }

            .command-palette-results {
                max-height: 400px;
                overflow-y: auto;
            }

            .command-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 20px;
                cursor: pointer;
                transition: background 0.15s ease;
            }

            .command-item:hover,
            .command-item.selected {
                background: var(--bg-hover, #363660);
            }

            .command-item.algebra-hint {
                border-bottom: 1px solid var(--border-color, #3d3d5c);
                background: rgba(99, 102, 241, 0.1);
            }

            .command-icon {
                font-size: 20px;
                width: 28px;
                text-align: center;
            }

            .command-info {
                flex: 1;
            }

            .command-name {
                color: var(--text-primary, white);
                font-size: 14px;
            }

            .command-name mark {
                background: var(--accent-primary, #6366f1);
                color: white;
                padding: 0 2px;
                border-radius: 2px;
            }

            .command-category {
                font-size: 12px;
                color: var(--text-tertiary, #8080a0);
            }

            .command-palette.hidden,
            .command-palette-overlay.hidden {
                display: none;
            }
        `;
        document.head.appendChild(style);
    }
}

export default CommandPalette;
