/**
 * js/utils/Html.js 역할
 * innerHTML 템플릿 문자열에 사용자/AI가 만든 값을 끼워 넣을 때 사용하는 이스케이프 유틸입니다.
 *
 * 라벨, 수식, 치수 텍스트 등은 사람이 직접 입력하거나 AI 씬그래프 출력에서 들어올 수 있어
 * 완전히 신뢰할 수 없습니다. 이 값들을 그대로 innerHTML에 넣으면 DOM 기반 XSS가 발생하므로
 * 반드시 escapeHtml을 거쳐야 합니다.
 */

/**
 * HTML 특수문자를 이스케이프해 문자열을 안전한 텍스트/속성값으로 만듭니다.
 * @param {*} value - 임의의 값 (문자열이 아니면 문자열로 변환)
 * @returns {string} 이스케이프된 문자열
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) {
        return '';
    }
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function escapeRegExp(value) {
    return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
