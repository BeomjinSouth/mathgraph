const COMPACT_VIEWPORT_MAX_WIDTH = 900;

export function isCompactViewport(width) {
    return Number(width) <= COMPACT_VIEWPORT_MAX_WIDTH;
}

export function nextCompactPanelState(state, action) {
    const current = {
        toolOpen: Boolean(state?.toolOpen),
        propertyOpen: Boolean(state?.propertyOpen)
    };

    switch (action) {
        case 'openTool':
            return { toolOpen: true, propertyOpen: false };
        case 'openProperty':
            return { toolOpen: false, propertyOpen: true };
        case 'toggleTool':
            return current.toolOpen
                ? { toolOpen: false, propertyOpen: false }
                : { toolOpen: true, propertyOpen: false };
        case 'toggleProperty':
            return current.propertyOpen
                ? { toolOpen: false, propertyOpen: false }
                : { toolOpen: false, propertyOpen: true };
        default:
            return current;
    }
}

export function createAnimationFrameCoalescer(callback, requestFrame = requestAnimationFrame) {
    let framePending = false;

    return () => {
        if (framePending) return;
        framePending = true;
        requestFrame(() => {
            framePending = false;
            callback();
        });
    };
}
