const DEFAULT_STYLE_COLOR = '#000000';
const DEFAULT_POINT_SIZE = 4;
const LEGACY_STYLE_COLORS = new Set(['#6366f1', '#3b82f6', '#22c55e', '#f97316']);
const DEFAULT_STYLE_COLOR_KEYS = ['pointColor', 'lineColor', 'circleColor', 'functionColor'];

/**
 * SettingsManager.js - 전역 설정 관리 (Mk.2)
 */

export class SettingsManager {
    constructor() {
        // 스냅 설정
        this.snapMode = 'integer'; // 'integer', 'decimal1', 'decimal2'

        // 자석 기능 (0.5 단위 스냅)
        this.magnetEnabled = false;
        this.magnetStep = 0.5;

        // 기본 스타일
        this.defaultStyles = {
            pointSize: DEFAULT_POINT_SIZE,
            lineWidth: 2,
            pointColor: DEFAULT_STYLE_COLOR,
            lineColor: DEFAULT_STYLE_COLOR,
            circleColor: DEFAULT_STYLE_COLOR,
            functionColor: DEFAULT_STYLE_COLOR,
            fontSize: 14
        };

        // 표시 옵션
        this.showLabels = true;
        this.hidePoints = false;
        this.hideNewPointBodies = false;

        // 로컬 스토리지에서 불러오기
        this.load();
    }

    /**
     * 자석 기능으로 좌표 스냅
     */
    magnetSnap(value) {
        if (!this.magnetEnabled) return value;
        return Math.round(value / this.magnetStep) * this.magnetStep;
    }

    /**
     * 자석 ON/OFF 토글
     */
    toggleMagnet() {
        this.magnetEnabled = !this.magnetEnabled;
        this.save();
        return this.magnetEnabled;
    }

    /**
     * 스냅 모드에 따른 값 반올림
     */
    snapValue(value) {
        switch (this.snapMode) {
            case 'integer':
                return Math.round(value);
            case 'decimal1':
                return Math.round(value * 10) / 10;
            case 'decimal2':
                return Math.round(value * 100) / 100;
            default:
                return Math.round(value);
        }
    }

    /**
     * 스냅 모드 설정
     */
    setSnapMode(mode) {
        if (['integer', 'decimal1', 'decimal2'].includes(mode)) {
            this.snapMode = mode;
            this.save();
        }
    }

    /**
     * 기본 스타일 설정
     */
    setDefaultStyle(key, value) {
        if (key in this.defaultStyles) {
            this.defaultStyles[key] = value;
            this.save();
        }
    }

    setHideNewPointBodies(hide) {
        this.hideNewPointBodies = !!hide;
        this.save();
    }

    getDefaultPointParams() {
        return {
            pointSize: (this.hidePoints || this.hideNewPointBodies) ? 0 : this.defaultStyles.pointSize,
            color: this.defaultStyles.pointColor
        };
    }

    normalizeDefaultStyleColors() {
        let changed = false;

        for (const key of DEFAULT_STYLE_COLOR_KEYS) {
            const value = this.defaultStyles[key];
            if (typeof value === 'string' && LEGACY_STYLE_COLORS.has(value.toLowerCase())) {
                this.defaultStyles[key] = DEFAULT_STYLE_COLOR;
                changed = true;
            }
        }

        return changed;
    }

    /**
     * 모든 객체에 스타일 일괄 적용
     */
    applyStylesToAll(objectManager, options = {}) {
        const objects = objectManager.getAllObjects();

        for (const obj of objects) {
            if (options.pointSize !== undefined && obj.pointSize !== undefined) {
                obj.pointSize = options.pointSize;
            }
            if (options.lineWidth !== undefined && obj.lineWidth !== undefined) {
                obj.lineWidth = options.lineWidth;
            }
            if (options.color !== undefined) {
                obj.color = options.color;
            }
            if (options.fontSize !== undefined && obj.fontSize !== undefined) {
                obj.fontSize = options.fontSize;
            }
        }
    }

    /**
     * 모든 점 숨기기/보이기
     */
    togglePointsVisibility(objectManager, hide) {
        const objects = objectManager.getAllObjects();

        for (const obj of objects) {
            if (obj.type === 'point' || obj.type === 'pointOnObject' ||
                obj.type === 'intersection' || obj.type === 'midpoint') {
                obj.pointSize = hide ? 0 : this.defaultStyles.pointSize;
            }
        }

        this.hidePoints = hide;
        this.save();
    }

    /**
     * 저장
     */
    save() {
        if (typeof localStorage === 'undefined') {
            return;
        }

        localStorage.setItem('graphA_settings', JSON.stringify({
            snapMode: this.snapMode,
            magnetEnabled: this.magnetEnabled,
            magnetStep: this.magnetStep,
            defaultStyles: this.defaultStyles,
            showLabels: this.showLabels,
            hidePoints: this.hidePoints,
            hideNewPointBodies: this.hideNewPointBodies
        }));
    }

    /**
     * 불러오기
     */
    load() {
        try {
            const saved = localStorage.getItem('graphA_settings');
            if (saved) {
                const data = JSON.parse(saved);
                if (data.snapMode) this.snapMode = data.snapMode;
                if (data.magnetEnabled !== undefined) this.magnetEnabled = data.magnetEnabled;
                if (data.magnetStep !== undefined) this.magnetStep = data.magnetStep;
                if (data.defaultStyles) Object.assign(this.defaultStyles, data.defaultStyles);
                if (data.showLabels !== undefined) this.showLabels = data.showLabels;
                if (data.hidePoints !== undefined) this.hidePoints = data.hidePoints;
                if (data.hideNewPointBodies !== undefined) this.hideNewPointBodies = data.hideNewPointBodies;

                if (this.normalizeDefaultStyleColors()) {
                    this.save();
                }
            }
        } catch (e) {
            console.warn('설정 불러오기 실패:', e);
        }
    }
}

export default SettingsManager;
