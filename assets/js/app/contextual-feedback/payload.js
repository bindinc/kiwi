export function buildFeedbackPayload({
    comment,
    severity,
    category,
    selectedElement,
    selectedRect,
    annotations,
    locationRef = window.location,
    windowRef = window,
    navigatorRef = window.navigator
}) {
    return {
        comment,
        severity,
        category,
        pageUrl: locationRef.href,
        routePath: `${locationRef.pathname}${locationRef.search || ''}`,
        userAgent: navigatorRef.userAgent || '',
        viewport: {
            width: Math.round(windowRef.innerWidth || 0),
            height: Math.round(windowRef.innerHeight || 0),
            devicePixelRatio: Number(windowRef.devicePixelRatio || 1)
        },
        selectedElement: {
            tag: selectedElement.tag,
            label: selectedElement.label,
            selector: selectedElement.selector,
            textSample: selectedElement.textSample,
            rect: {
                x: round(selectedRect.x),
                y: round(selectedRect.y),
                width: round(selectedRect.width),
                height: round(selectedRect.height)
            }
        },
        annotations
    };
}

function round(value) {
    return Math.round(Number(value) * 100) / 100;
}
