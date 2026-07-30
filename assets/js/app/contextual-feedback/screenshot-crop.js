export function calculateCanvasCrop({
    rect,
    documentSize,
    canvasSize,
    scrollX = 0,
    scrollY = 0
}) {
    const scaleX = canvasSize.width / documentSize.width;
    const scaleY = canvasSize.height / documentSize.height;

    return {
        sourceX: (scrollX + rect.x) * scaleX,
        sourceY: (scrollY + rect.y) * scaleY,
        sourceWidth: rect.width * scaleX,
        sourceHeight: rect.height * scaleY,
        targetWidth: Math.max(1, Math.round(rect.width)),
        targetHeight: Math.max(1, Math.round(rect.height))
    };
}
