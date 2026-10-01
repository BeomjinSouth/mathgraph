/** Authoritative annotation supplement shared by every AI provider and reference retrieval.
 * Worked examples and interaction contract: docs/치수-배치와-곡선-화살표-사용법.md
 */
export const ANNOTATION_GUIDANCE = `
Angle/length annotation rules (current runtime supplement):
- angleDimension supports leaderMode: auto|always|none (default auto), leaderCurvature: -300..300 screen pixels (default 28), labelPlacement: centered|legacy. Use centered for new figures; legacy only preserves old files.
- Keep a short angle value next to its own arc on the interior bisector. If an acute angle, crowded intersection, neighboring arcs or a long expression make it overlap geometry, move that angleDimension.labelOffset into nearby free space and use leaderMode:auto. The runtime draws a curved arrow FROM the text box TO its own angle arc once the text is detached. Use always when the user explicitly requests the arrow; none only when requested or when the relationship is already unambiguous. Never replace this with an independent vector/annotationArrow, duplicate angle, or an arrow pointing at the vertex.
- The arrow follows the text, arc radius and vertex geometry. Change leaderCurvature to route around another label; inspect the actual render for crossings. Do not claim automatic avoidance of all edges. Hidden values do not draw leaders. Preserve existing manual offsets in patch mode.
- lengthDimension supports curvature (signed screen pixels), dashLength and dashGap (1..40 pixels, defaults 7/7), labelOnCurve (boolean), labelT (0.1..0.9, default 0.5). For new length labels use labelOnCurve:true and omit labelOffset; the text occupies a gap on its curve. Dragging attached text changes curve curvature and its position along the curve. Use labelOnCurve:false only for explicitly free labels or preserved legacy offsets.
- Prefer a calm 7px dash / 7px gap, and readable dimension text (typically 18..24px for a 1000px drawing). Do not put length numbers away from their dimension curve. Place different side measurements outside the polygon and stagger overlapping measurements.
- Put point names just outside the adjacent polygon angle; point labelOffset is a screen-pixel bottom baseline, dimension labelOffset is a mathematical-coordinate displacement. Preserve teachers' explicit coordinates and offsets. Check letters, arc/text association, dashed gaps and arrow direction in the rendered figure, then verify save/reload.
Examples:
{"op":"update","id":"existingAngle","labelOffset":{"x":-1.2,"y":0.8},"leaderMode":"always","leaderCurvature":24}
{"op":"create","id":"length_AB","type":"lengthDimension","segmentId":"AB","labelOnCurve":true,"labelT":0.5,"curvature":-60,"dashLength":7,"dashGap":8,"labelFontSize":20}
`;
