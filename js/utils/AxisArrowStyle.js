export const AXIS_ARROW_STYLE = Object.freeze({
    tipInset: 1,
    length: 13,
    halfWidth: 4.2,
    connectorLength: 32,
    labelFontSize: 22,
    xLabelInset: 13,
    xLabelGap: 9,
    xLabelMinGap: 4,
    xLabelBottomInset: 26,
    yLabelInset: 15,
    yLabelBaseline: 22
});

export function getScaledAxisArrowStyle(scale = 1) {
    const safeScale = Number.isFinite(Number(scale)) && Number(scale) > 0 ? Number(scale) : 1;
    return {
        tipInset: AXIS_ARROW_STYLE.tipInset * safeScale,
        baseInset: (AXIS_ARROW_STYLE.tipInset + AXIS_ARROW_STYLE.length) * safeScale,
        halfWidth: AXIS_ARROW_STYLE.halfWidth * safeScale,
        connectorLength: AXIS_ARROW_STYLE.connectorLength * safeScale,
        labelFontSize: AXIS_ARROW_STYLE.labelFontSize * safeScale,
        xLabelInset: AXIS_ARROW_STYLE.xLabelInset * safeScale,
        xLabelGap: AXIS_ARROW_STYLE.xLabelGap * safeScale,
        xLabelMinGap: AXIS_ARROW_STYLE.xLabelMinGap * safeScale,
        xLabelBottomInset: AXIS_ARROW_STYLE.xLabelBottomInset * safeScale,
        yLabelInset: AXIS_ARROW_STYLE.yLabelInset * safeScale,
        yLabelBaseline: AXIS_ARROW_STYLE.yLabelBaseline * safeScale
    };
}
