export function calculateCanvasCrop({
    rect,
    documentSize,
    canvasSize,
    scrollX = 0,
    scrollY = 0
}) {
    const scaleX = canvasSize.width / documentSize.width;
    const scaleY = canvasSize.height / documentSize.height;
    const requestedX = (scrollX + rect.x) * scaleX;
    const requestedY = (scrollY + rect.y) * scaleY;
    const sourceX = clamp(requestedX, 0, canvasSize.width - 1);
    const sourceY = clamp(requestedY, 0, canvasSize.height - 1);
    const requestedWidth = Math.max(1, rect.width * scaleX);
    const requestedHeight = Math.max(1, rect.height * scaleY);
    const sourceWidth = Math.min(requestedWidth, canvasSize.width - sourceX);
    const sourceHeight = Math.min(requestedHeight, canvasSize.height - sourceY);

    return {
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        targetWidth: Math.max(1, Math.round(sourceWidth / scaleX)),
        targetHeight: Math.max(1, Math.round(sourceHeight / scaleY))
    };
}

function clamp(value, minimum, maximum) {
    return Math.min(Math.max(value, minimum), Math.max(minimum, maximum));
}
