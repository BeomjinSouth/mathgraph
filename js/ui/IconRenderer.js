const STROKE = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const STROKE_THIN = 'fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"';
const STROKE_SOFT = 'fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" opacity="0.42"';
const FILL = 'fill="currentColor"';

const icon = (body) => body;

const ICONS = {
    arrow_selector_tool: icon(`
        <path ${STROKE} d="M5 3.8 14.2 20l1.3-6.1 5.4-2.9L5 3.8Z"/>
        <path ${STROKE_SOFT} d="M14.2 13.7 18.8 19"/>
    `),
    near_me: icon(`
        <path ${STROKE} d="M5.2 4.4 19.5 12 5.2 19.6l3.3-7.6-3.3-7.6Z"/>
        <path ${STROKE_SOFT} d="M8.6 12H18"/>
    `),
    undo: icon(`
        <path ${STROKE} d="M9 8H4.4V3.6"/>
        <path ${STROKE} d="M4.8 8.1A8.2 8.2 0 1 1 7.1 18"/>
        <path ${STROKE_SOFT} d="M9.2 15.6h5.4"/>
    `),
    redo: icon(`
        <path ${STROKE} d="M15 8h4.6V3.6"/>
        <path ${STROKE} d="M19.2 8.1A8.2 8.2 0 1 0 16.9 18"/>
        <path ${STROKE_SOFT} d="M9.4 15.6h5.4"/>
    `),
    download: icon(`
        <path ${STROKE} d="M12 4.2v10.4"/>
        <path ${STROKE} d="m7.7 10.2 4.3 4.4 4.3-4.4"/>
        <path ${STROKE} d="M5 18.8h14"/>
        <path ${STROKE_SOFT} d="M7 20.8h10"/>
    `),
    crop_free: icon(`
        <path ${STROKE} d="M4.5 9V4.5H9"/>
        <path ${STROKE} d="M15 4.5h4.5V9"/>
        <path ${STROKE} d="M19.5 15v4.5H15"/>
        <path ${STROKE} d="M9 19.5H4.5V15"/>
        <path ${STROKE_SOFT} d="M8 8h8v8H8Z"/>
    `),
    save: icon(`
        <path ${STROKE} d="M4.8 4.2h10.7l3.7 3.7v11.9H4.8V4.2Z"/>
        <path ${STROKE_THIN} d="M8.2 4.2v4.6h6.4V4.2"/>
        <path ${STROKE_THIN} d="M8.2 19.8v-5.4h7.6v5.4"/>
    `),
    folder_open: icon(`
        <path ${STROKE} d="M3.8 19V5.4h5.4l1.9 2.1h9.1V19H3.8Z"/>
        <path ${STROKE_SOFT} d="M3.8 10.3h16.4"/>
    `),
    logout: icon(`
        <path ${STROKE} d="M14.4 4.4H5v15.2h9.4"/>
        <path ${STROKE} d="M10.8 12h9.4"/>
        <path ${STROKE} d="m17 8.6 3.2 3.4L17 15.4"/>
    `),
    fiber_manual_record: icon(`
        <circle cx="12" cy="12" r="4.6" ${FILL}/>
        <circle cx="12" cy="12" r="7.6" ${STROKE_SOFT}/>
    `),
    radio_button_unchecked: icon(`
        <circle cx="12" cy="12" r="7.4" ${STROKE}/>
        <circle cx="12" cy="12" r="2.1" ${STROKE_SOFT}/>
    `),
    radio_button_checked: icon(`
        <circle cx="12" cy="12" r="7.4" ${STROKE}/>
        <circle cx="12" cy="12" r="3.1" ${FILL}/>
    `),
    commit: icon(`
        <path ${STROKE} d="M4 12h6"/>
        <circle cx="12" cy="12" r="3" ${STROKE}/>
        <path ${STROKE} d="M14 12h6"/>
        <path ${STROKE_SOFT} d="M12 5v2.2M12 16.8V19"/>
    `),
    hub: icon(`
        <circle cx="12" cy="12" r="2.8" ${STROKE}/>
        <circle cx="5.8" cy="6.4" r="2" ${STROKE_THIN}/>
        <circle cx="18.2" cy="6.4" r="2" ${STROKE_THIN}/>
        <circle cx="12" cy="19" r="2" ${STROKE_THIN}/>
        <path ${STROKE_SOFT} d="M9.9 10.1 7.3 7.9M14.1 10.1l2.6-2.2M12 14.8V17"/>
    `),
    horizontal_rule: icon(`
        <path ${STROKE} d="M4 12h16"/>
        <circle cx="5.2" cy="12" r="1.7" ${FILL}/>
        <circle cx="18.8" cy="12" r="1.7" ${FILL}/>
    `),
    diagonal_line: icon(`
        <path ${STROKE} d="M5 18.5 19 5.5"/>
        <path ${STROKE_SOFT} d="M6 13.8V18h4.1M14 5.6h4.1V9.8"/>
    `),
    linear_scale: icon(`
        <path ${STROKE} d="M4 13h16"/>
        <path ${STROKE_SOFT} d="M6 9v8M10 10.5v5M14 10.5v5M18 9v8"/>
    `),
    show_chart: icon(`
        <path ${STROKE} d="M4.5 17.5 9 12.8l3.5 2.6L19.5 6"/>
        <path ${STROKE_SOFT} d="M4 20h16M4 5v15"/>
    `),
    trending_flat: icon(`
        <path ${STROKE} d="M4 12h14"/>
        <path ${STROKE} d="m14.8 7.3 4.8 4.7-4.8 4.7"/>
        <path ${STROKE_SOFT} d="M7 8.8v6.4"/>
    `),
    arrow_right_alt: icon(`
        <path ${STROKE} d="M4 12h14.2"/>
        <path ${STROKE} d="m14 7 5 5-5 5"/>
    `),
    arrow_forward: icon(`
        <path ${STROKE} d="M4.5 17.5 16.5 5.5"/>
        <path ${STROKE} d="M10.8 5.5h5.7v5.7"/>
        <circle cx="4.6" cy="17.4" r="1.6" ${FILL}/>
    `),
    arrow_outward: icon(`
        <path ${STROKE} d="M6 18 18 6"/>
        <path ${STROKE} d="M11 6h7v7"/>
        <path ${STROKE_SOFT} d="M5.5 5.5h5M5.5 5.5v5"/>
    `),
    filter_tilt_shift: icon(`
        <circle cx="12" cy="12" r="7.5" ${STROKE}/>
        <circle cx="8.4" cy="9.2" r="1.5" ${FILL}/>
        <circle cx="15.8" cy="9.7" r="1.5" ${FILL}/>
        <circle cx="12.1" cy="16" r="1.5" ${FILL}/>
    `),
    rss_feed: icon(`
        <path ${STROKE} d="M5.5 16.5c3.5-5 8-7.4 13-7.6"/>
        <path ${STROKE_SOFT} d="M7.4 19c2.8-2.7 5.9-4 9.4-3.8"/>
        <circle cx="5.7" cy="18.4" r="1.5" ${FILL}/>
    `),
    line_curve: icon(`
        <path ${STROKE} d="M4.5 16.5C8 8 12.3 8 19.5 13.2"/>
        <path ${STROKE_SOFT} d="M6 19h12"/>
    `),
    donut_small: icon(`
        <path ${STROKE} d="M12 12V4.7A7.3 7.3 0 1 1 5.7 15.7Z"/>
        <circle cx="12" cy="12" r="2.5" ${STROKE_SOFT}/>
    `),
    pie_chart: icon(`
        <path ${STROKE} d="M12 12V4.7A7.3 7.3 0 1 1 5.7 15.7Z"/>
        <path ${STROKE_SOFT} d="M12 12h7.3"/>
    `),
    nightlight_round: icon(`
        <path ${STROKE} d="M15.2 4.6a7.5 7.5 0 1 0 3.9 13.6A8.2 8.2 0 0 1 15.2 4.6Z"/>
        <path ${STROKE_SOFT} d="M8 12h6.5"/>
    `),
    incomplete_circle: icon(`
        <path ${STROKE} d="M18.5 7.2A7.5 7.5 0 1 1 10.4 4.8"/>
        <path ${STROKE_SOFT} d="M12 4.5h5v5"/>
    `),
    lens: icon(`
        <path ${STROKE} d="M8.3 5.8c4 2 6.2 4.1 6.2 6.2s-2.2 4.2-6.2 6.2"/>
        <path ${STROKE} d="M15.7 5.8c-4 2-6.2 4.1-6.2 6.2s2.2 4.2 6.2 6.2"/>
        <path ${STROKE_SOFT} d="M12 6.6c1.7 1.7 2.5 3.5 2.5 5.4s-.8 3.7-2.5 5.4"/>
    `),
    pentagon: icon(`
        <path ${STROKE} d="m12 4.4 7.2 5.2-2.8 8.4H7.6L4.8 9.6 12 4.4Z"/>
        <path ${STROKE_SOFT} d="M7.6 18 12 4.4l4.4 13.6M4.8 9.6h14.4"/>
    `),
    format_color_fill: icon(`
        <path ${STROKE} d="m6.4 12.2 5.1-5.1 5.1 5.1-5.1 5.1-5.1-5.1Z"/>
        <path ${STROKE_SOFT} d="M9.2 4.5 17.5 12.8"/>
        <path ${FILL} d="M17.7 16.2c1.4 1.5 2.1 2.7 2.1 3.5a2.1 2.1 0 0 1-4.2 0c0-.8.7-2 2.1-3.5Z"/>
    `),
    view_in_ar: icon(`
        <path ${STROKE} d="m12 4.5 6.5 3.7v7.6L12 19.5l-6.5-3.7V8.2L12 4.5Z"/>
        <path ${STROKE_SOFT} d="M5.5 8.2 12 12l6.5-3.8M12 12v7.5"/>
    `),
    deployed_code: icon(`
        <path ${STROKE} d="m12 4.5 6.5 3.7v7.6L12 19.5l-6.5-3.7V8.2L12 4.5Z"/>
        <path ${STROKE_SOFT} d="M8.2 10.4 12 12.5l3.8-2.1M8.2 14.2 12 16.3l3.8-2.1"/>
    `),
    details: icon(`
        <path ${STROKE} d="M12 4.5 19 18H5L12 4.5Z"/>
        <path ${STROKE_SOFT} d="M12 4.5v13.5M8.6 11.6h6.8"/>
    `),
    change_history: icon(`
        <path ${STROKE} d="M12 4.5 19 18H5L12 4.5Z"/>
        <path ${STROKE_SOFT} d="M12 4.5 8.4 18M12 4.5 15.6 18"/>
    `),
    construction: icon(`
        <path ${STROKE} d="M6 18.5 12 5.5l6 13"/>
        <path ${STROKE_SOFT} d="M8.3 13.5h7.4M6.7 16.7h10.6"/>
        <circle cx="12" cy="5.5" r="1.4" ${FILL}/>
    `),
    drag_handle: icon(`
        <path ${STROKE} d="M5 9h14M5 15h14"/>
        <path ${STROKE_SOFT} d="M8 6.5v11M16 6.5v11"/>
    `),
    add: icon(`
        <path ${STROKE} d="M12 5v14M5 12h14"/>
    `),
    remove: icon(`
        <path ${STROKE} d="M5 12h14"/>
    `),
    vertical_align_center: icon(`
        <path ${STROKE} d="M5 12h14"/>
        <path ${STROKE_SOFT} d="M12 5v14M8.2 7.8l3.8 4.2-3.8 4.2M15.8 7.8 12 12l3.8 4.2"/>
    `),
    call_split: icon(`
        <path ${STROKE} d="M5 19c4.5-4.2 5.8-8.2 4-14"/>
        <path ${STROKE} d="M19 19c-4.5-4.2-5.8-8.2-4-14"/>
        <path ${STROKE_SOFT} d="M12 5v14"/>
    `),
    motion_photos_pause: icon(`
        <circle cx="10" cy="12" r="5.8" ${STROKE}/>
        <path ${STROKE} d="M15 8.4h4M15 15.6h4"/>
        <path ${STROKE_SOFT} d="M10 6.2v11.6"/>
    `),
    query_stats: icon(`
        <path ${STROKE_SOFT} d="M4 19.5h16M4 5v14.5"/>
        <path ${STROKE} d="M5 16c3.2-7.4 6.1-7.4 8.8 0 1.5 4 3.2 3.2 5.2-.8"/>
        <circle cx="13.8" cy="16" r="1.5" ${FILL}/>
    `),
    architecture: icon(`
        <path ${STROKE} d="M5 18.5 17.5 6"/>
        <path ${STROKE_SOFT} d="M7.2 16.2 12 19.3M10.1 13.4l4.8 3.1M13 10.5l4.8 3.1"/>
        <path ${STROKE} d="M15.4 4.6h4v4"/>
    `),
    angle: icon(`
        <path ${STROKE} d="M5 18.5h14"/>
        <path ${STROKE} d="M5 18.5 16 7.5"/>
        <path ${STROKE_SOFT} d="M9 18.5a4 4 0 0 0-1.1-2.8"/>
    `),
    square_foot: icon(`
        <path ${STROKE} d="M5 18h14"/>
        <path ${STROKE} d="M5 18V5"/>
        <path ${STROKE_SOFT} d="M5 13h5v5"/>
    `),
    straighten: icon(`
        <path ${STROKE} d="M4.5 15.5h15"/>
        <path ${STROKE_SOFT} d="M6.5 12v7M10 13.5v4M13.5 12v7M17 13.5v4"/>
    `),
    timeline: icon(`
        <path ${STROKE} d="M4 12h16"/>
        <path ${STROKE_SOFT} d="M6 9v6M10 9v6M14 9v6M18 9v6"/>
        <circle cx="8" cy="12" r="1.3" ${FILL}/>
        <circle cx="16" cy="12" r="1.3" ${FILL}/>
    `),
    functions: icon(`
        <path ${STROKE} d="M8.2 19c2.3-8.7 3.6-13.4 7.9-13.4"/>
        <path ${STROKE_SOFT} d="M6 10.5h10.5M10.2 14.4l4.9 4.6M15.1 14.4l-4.9 4.6"/>
    `),
    ssid_chart: icon(`
        <path ${STROKE_SOFT} d="M4 19.5h16M4 5v14.5"/>
        <path ${STROKE} d="M5.2 16.5c3.2-6.6 5.2-7.6 7.8-2.1 1.6 3.5 3.4 3.2 5.8-3.5"/>
    `),
    center_focus_strong: icon(`
        <path ${STROKE} d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4"/>
        <circle cx="12" cy="12" r="2.7" ${STROKE_SOFT}/>
    `),
    stars: icon(`
        <path ${STROKE} d="m12 4.2 1.6 4.5 4.6 1.5-4.6 1.6-1.6 4.4-1.6-4.4-4.6-1.6 4.6-1.5L12 4.2Z"/>
        <path ${STROKE_SOFT} d="m18.4 15.3.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8Z"/>
    `),
    left_panel_close: icon(`
        <rect x="4.5" y="5" width="15" height="14" rx="2" ${STROKE}/>
        <path ${STROKE_SOFT} d="M9 5v14"/>
        <path ${STROKE} d="m14.7 9-3 3 3 3"/>
    `),
    left_panel_open: icon(`
        <rect x="4.5" y="5" width="15" height="14" rx="2" ${STROKE}/>
        <path ${STROKE_SOFT} d="M9 5v14"/>
        <path ${STROKE} d="m11.5 9 3 3-3 3"/>
    `),
    right_panel_close: icon(`
        <rect x="4.5" y="5" width="15" height="14" rx="2" ${STROKE}/>
        <path ${STROKE_SOFT} d="M15 5v14"/>
        <path ${STROKE} d="m9.3 9 3 3-3 3"/>
    `),
    right_panel_open: icon(`
        <rect x="4.5" y="5" width="15" height="14" rx="2" ${STROKE}/>
        <path ${STROKE_SOFT} d="M15 5v14"/>
        <path ${STROKE} d="m12.5 9-3 3 3 3"/>
    `),
    visibility: icon(`
        <path ${STROKE} d="M4 12s3-5.6 8-5.6 8 5.6 8 5.6-3 5.6-8 5.6S4 12 4 12Z"/>
        <circle cx="12" cy="12" r="2.5" ${STROKE_SOFT}/>
    `),
    visibility_off: icon(`
        <path ${STROKE} d="M4 12s3-5.6 8-5.6c1.3 0 2.5.4 3.6 1"/>
        <path ${STROKE} d="M19.7 11.6s-3 6-7.7 6c-1.5 0-2.8-.4-4-1.1"/>
        <path ${STROKE} d="M5 5 19 19"/>
    `),
    select_all: icon(`
        <rect x="6.5" y="6.5" width="11" height="11" rx="1.8" ${STROKE}/>
        <path ${STROKE_SOFT} d="M4 9V5.5C4 4.7 4.7 4 5.5 4H9M15 4h3.5c.8 0 1.5.7 1.5 1.5V9M20 15v3.5c0 .8-.7 1.5-1.5 1.5H15M9 20H5.5C4.7 20 4 19.3 4 18.5V15"/>
    `),
    palette: icon(`
        <path ${STROKE} d="M12 4.7A7.4 7.4 0 0 0 4.6 12c0 4 3.2 7.3 7.2 7.3h1.3c1.2 0 1.7-1.5.8-2.2-.7-.5-.3-1.6.6-1.6h1.2A4.1 4.1 0 0 0 19.8 11 7.5 7.5 0 0 0 12 4.7Z"/>
        <circle cx="8.7" cy="11" r="1" ${FILL}/>
        <circle cx="11.8" cy="8.7" r="1" ${FILL}/>
        <circle cx="15" cy="11.1" r="1" ${FILL}/>
    `),
    list: icon(`
        <path ${STROKE} d="M9 7h10M9 12h10M9 17h10"/>
        <circle cx="5.5" cy="7" r="1.2" ${FILL}/>
        <circle cx="5.5" cy="12" r="1.2" ${FILL}/>
        <circle cx="5.5" cy="17" r="1.2" ${FILL}/>
    `),
    settings: icon(`
        <circle cx="12" cy="12" r="2.7" ${STROKE}/>
        <path ${STROKE} d="M12 4.4v2.1M12 17.5v2.1M5.4 8.2l1.8 1M16.8 14.8l1.8 1M5.4 15.8l1.8-1M16.8 9.2l1.8-1"/>
        <path ${STROKE_SOFT} d="M8.8 5.5 7.5 7.6M16.5 16.4l-1.3 2.1M5.5 12H8M16 12h2.5"/>
    `),
    touch_app: icon(`
        <path ${STROKE} d="M9.2 11.6V5.9a1.8 1.8 0 0 1 3.6 0v6.6"/>
        <path ${STROKE} d="M12.8 10.7h1.4a1.7 1.7 0 0 1 1.7 1.7v.7h.9a1.7 1.7 0 0 1 1.7 1.7v1.4c0 2.2-1.8 3.8-4 3.8h-3.1c-1.2 0-2.3-.5-3.1-1.4l-2.6-2.9a1.6 1.6 0 0 1 2.2-2.3l1.3 1.1"/>
        <path ${STROKE_SOFT} d="M6.5 5.6a5.2 5.2 0 0 1 8.8 0"/>
    `),
    content_copy: icon(`
        <rect x="8" y="7" width="10" height="12" rx="2" ${STROKE}/>
        <path ${STROKE_SOFT} d="M6 16H5.5A1.5 1.5 0 0 1 4 14.5v-8A1.5 1.5 0 0 1 5.5 5H13"/>
    `),
    content_paste: icon(`
        <path ${STROKE} d="M8.2 6.5h7.6"/>
        <rect x="6" y="7.5" width="12" height="12" rx="2" ${STROKE}/>
        <path ${STROKE_SOFT} d="M9.2 11.2h5.6M9.2 15h5.6"/>
        <path ${STROKE} d="M9.5 4.8h5l.8 2.2H8.7l.8-2.2Z"/>
    `),
    delete: icon(`
        <path ${STROKE} d="M6 7h12"/>
        <path ${STROKE} d="M9 7V5.5C9 4.7 9.7 4 10.5 4h3C14.3 4 15 4.7 15 5.5V7"/>
        <path ${STROKE} d="M8 9.5 9 19h6l1-9.5"/>
        <path ${STROKE_SOFT} d="M11 11.5v5M13 11.5v5"/>
    `),
    add_circle_outline: icon(`
        <circle cx="12" cy="12" r="7.5" ${STROKE}/>
        <path ${STROKE} d="M12 8v8M8 12h8"/>
    `),
    smart_toy: icon(`
        <rect x="5.2" y="8" width="13.6" height="9.5" rx="3" ${STROKE}/>
        <path ${STROKE_SOFT} d="M12 8V5.2M9 5.2h6"/>
        <circle cx="9.3" cy="12.5" r="1" ${FILL}/>
        <circle cx="14.7" cy="12.5" r="1" ${FILL}/>
        <path ${STROKE_SOFT} d="M9.5 15.2h5"/>
    `),
    expand_less: icon(`
        <path ${STROKE} d="m6.5 14.5 5.5-5 5.5 5"/>
    `),
    add_photo_alternate: icon(`
        <rect x="4.5" y="5.5" width="15" height="13" rx="2" ${STROKE}/>
        <path ${STROKE_SOFT} d="m6.8 16 3.8-4 2.8 2.8 2-2.1 2.8 3.3"/>
        <circle cx="15.8" cy="9.4" r="1.2" ${FILL}/>
        <path ${STROKE} d="M8.5 8.5h4M10.5 6.5v4"/>
    `),
    send: icon(`
        <path ${STROKE} d="M4.8 5.2 20 12 4.8 18.8l2.3-6.8-2.3-6.8Z"/>
        <path ${STROKE_SOFT} d="M7.2 12H20"/>
    `),
    close: icon(`
        <path ${STROKE} d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/>
    `),
    help: icon(`
        <circle cx="12" cy="12" r="7.5" ${STROKE}/>
        <path ${STROKE} d="M9.8 9.5a2.4 2.4 0 0 1 4.6.9c0 1.7-1.6 2.2-2.4 3.2"/>
        <circle cx="12" cy="17" r=".8" ${FILL}/>
    `),
    menu_book: icon(`
        <path ${STROKE} d="M4.8 6.2c2.7-.9 5-.4 7.2 1.4v11c-2.2-1.8-4.5-2.3-7.2-1.4v-11Z"/>
        <path ${STROKE} d="M19.2 6.2c-2.7-.9-5-.4-7.2 1.4v11c2.2-1.8 4.5-2.3 7.2-1.4v-11Z"/>
        <path ${STROKE_SOFT} d="M8 9.2h2.2M8 12h2.2M13.8 9.2H16M13.8 12H16"/>
    `),
    mouse: icon(`
        <rect x="7.5" y="4.5" width="9" height="15" rx="4.5" ${STROKE}/>
        <path ${STROKE_SOFT} d="M12 4.5v6M7.5 10.5h9"/>
    `),
    keyboard: icon(`
        <rect x="4" y="7" width="16" height="10" rx="2" ${STROKE}/>
        <path ${STROKE_SOFT} d="M7 10h.1M10 10h.1M13 10h.1M16 10h.1M7 13h.1M10 13h.1M13 13h4"/>
    `),
    lightbulb: icon(`
        <path ${STROKE} d="M8.4 11.2a3.6 3.6 0 1 1 7.2 0c0 1.4-.8 2.3-1.5 3.1-.5.6-.8 1.1-.8 1.9h-2.6c0-.8-.3-1.3-.8-1.9-.7-.8-1.5-1.7-1.5-3.1Z"/>
        <path ${STROKE_SOFT} d="M10.3 19h3.4M9.5 21h5M12 3v1.2M5.7 6l.9.9M18.3 6l-.9.9"/>
    `),
    ads_click: icon(`
        <circle cx="12" cy="12" r="7.4" ${STROKE_SOFT}/>
        <path ${STROKE} d="M9 7.8 15.8 18l.9-4.1 3.3-1.8L9 7.8Z"/>
        <path ${STROKE_SOFT} d="M4.5 12h2.2M12 4.5v2.2"/>
    `),
    drag_pan: icon(`
        <path ${STROKE} d="M12 4.5v15M4.5 12h15"/>
        <path ${STROKE} d="m8.8 7.8 3.2-3.3 3.2 3.3M8.8 16.2l3.2 3.3 3.2-3.3M7.8 8.8 4.5 12l3.3 3.2M16.2 8.8l3.3 3.2-3.3 3.2"/>
    `),
    pan_tool: icon(`
        <path ${STROKE} d="M8.5 12.5V6.4a1.4 1.4 0 0 1 2.8 0v5.1"/>
        <path ${STROKE} d="M11.3 11V5.6a1.4 1.4 0 0 1 2.8 0V12"/>
        <path ${STROKE} d="M14.1 12V7.2a1.4 1.4 0 0 1 2.8 0v6"/>
        <path ${STROKE} d="M8.5 12.4 7.1 11a1.5 1.5 0 0 0-2.1 2.1l3.2 4c.8 1 1.9 1.5 3.2 1.5h2.8c2.2 0 3.8-1.7 3.8-3.8v-3.2"/>
    `),
    library_add_check: icon(`
        <path ${STROKE} d="M5 7.5h9M5 12h6M5 16.5h5"/>
        <path ${STROKE} d="m13.2 16.3 2.1 2.1 4.5-5"/>
        <path ${STROKE_SOFT} d="M17.5 5.5v5M15 8h5"/>
    `),
    circle: icon(`
        <circle cx="12" cy="12" r="7.4" ${STROKE}/>
    `),
    interests: icon(`
        <path ${STROKE} d="M7 5.5h7.5L17 8v10.5H7v-13Z"/>
        <path ${STROKE_SOFT} d="M14.5 5.5V8H17M9.2 11h5.5M9.2 14h5.5"/>
    `)
};

const ALIASES = {
    point: 'fiber_manual_record',
    segment: 'horizontal_rule',
    line: 'show_chart',
    ray: 'trending_flat',
    vector: 'arrow_forward',
    polygon: 'pentagon',
    prism: 'deployed_code',
    pyramid: 'change_history'
};

function escapeAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function normalizeIconName(name) {
    return String(name || '').trim();
}

function resolveIconName(name) {
    const normalized = normalizeIconName(name);
    return ALIASES[normalized] || normalized;
}

export function getGeneratedIconName(target) {
    if (!target) return '';
    return normalizeIconName(target.dataset?.icon || target.getAttribute?.('data-icon') || target.textContent);
}

export function renderIcon(name) {
    const resolvedName = resolveIconName(name);
    const body = ICONS[resolvedName] || ICONS.interests;
    return `<svg class="generated-icon-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function setGeneratedIcon(target, name) {
    if (!target) return;

    const iconName = normalizeIconName(name) || 'interests';
    target.dataset.icon = iconName;
    target.innerHTML = renderIcon(iconName);
    target.classList.add('generated-icon');

    const hasExternalLabel = target.hasAttribute('aria-label') || target.closest?.('[aria-label]');
    if (!hasExternalLabel) {
        target.setAttribute('aria-hidden', 'true');
    }
}

export function hydrateGeneratedIcons(root = document) {
    const targets = [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches?.('.material-symbols-outlined')) {
        targets.push(root);
    }
    root.querySelectorAll?.('.material-symbols-outlined').forEach((target) => targets.push(target));

    for (const target of targets) {
        setGeneratedIcon(target, getGeneratedIconName(target));
    }
}

export function iconHTML(name, className = 'material-symbols-outlined') {
    const iconName = normalizeIconName(name) || 'interests';
    return `<span class="${escapeAttribute(className)}" data-icon="${escapeAttribute(iconName)}" aria-hidden="true">${renderIcon(iconName)}</span>`;
}
