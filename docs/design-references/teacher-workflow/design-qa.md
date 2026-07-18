# Teacher exam workflow design QA

## Comparison inputs

- Reference: `selected-canvas-dock-target.png` (1672×941)
- Desktop implementation: `implementation-1672x941.jpg` (browser viewport 1672×941)
- Working-state implementation: `implementation-cylinder-1672x941.jpg` (browser viewport 1672×941)
- Responsive implementation: `implementation-1280x720.jpg` (browser viewport 1280×720)
- Verified state: guest workspace, canvas-first layout, right exam-quality panel, bottom AI generation dock, selected curved solid, and unsupported-chart warning

The reference and implementation were inspected together in one comparison pass at the same 1672×941 viewport. The implementation intentionally retains GraphA's established category rail, header controls, property tabs, fonts, and tokens while matching the reference's canvas-first hierarchy, persistent right-side review surface, and bottom command dock.

## QA passes

### Layout, spacing, and responsiveness

- At 1672×941 the canvas occupies the dominant center region. The 320 px tool panel and 320 px property panel remain outside the canvas, and the 154 px generation dock begins exactly where the main canvas row ends.
- At 1280×720 the left tool panel collapses to 60 px while the right property panel stays usable. The canvas and dock share the same horizontal region and do not overlap.
- Document dimensions matched the viewport at both sizes, with no unintended page scrollbars.

### Typography, colors, icons, and surfaces

- Existing GraphA dark surfaces, purple primary action, Material Symbols icon family, border radii, and compact Korean typography are preserved consistently.
- Status text wraps inside the right review card and command dock without clipping at both tested viewports.
- Selected geometry uses the existing orange selection highlight; the stored object color remains black for print output.

### States, interactions, and accessibility

- Canvas receives focus and exposes the accessible name `수학 시험 그림 편집 캔버스`.
- Unsupported statistical-chart requests keep the original prompt, show `확인이 필요한 요청`, and explain the unsupported families in Korean.
- Manual `도형 → 원기둥 → 만들기` creates one editable curved solid with hidden-curve controls and a dashed hidden arc.
- Export modal exposes PNG/SVG choices and the `HWP용 · 80 mm · 300 dpi` preset can be selected.
- Browser console error log was empty after the core interaction pass.

## Findings and fixes

1. Resolved P1 · support coverage: `막대그래프` and `원그래프` were initially treated as generic supported graphs. Added explicit excluded families and regression tests.
2. Resolved P2 · content: the warning initially exposed internal identifiers such as `barChart` and `pieChart`. Added Korean display labels for all disclosed excluded and approximated families.
3. Resolved P2 · browser interaction verification: the icon-only export control required a stable DOM-node interaction in the test harness. The control itself remained reachable by its accessible name and the export modal/preset worked correctly.

No unresolved P0, P1, or P2 issues remain in the tested teacher production flow.

final result: passed
