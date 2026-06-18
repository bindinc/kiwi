const TOOL_COLORS = {
    rectangle: '#ef4444',
    arrow: '#ef4444',
    pin: '#f97316',
    text: '#111827',
    textBubbleBorder: '#2563eb',
    blur: '#111827'
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.12;

export class AnnotationCanvas {
    constructor({ canvas, screenshotBlob, viewport = null }) {
        this.canvas = canvas;
        this.viewport = viewport;
        this.context = canvas.getContext('2d');
        this.screenshotBlob = screenshotBlob;
        this.tool = 'hand';
        this.zoom = 1;
        this.controlKeyActive = false;
        this.annotations = [];
        this.draft = null;
        this.image = null;
        this.dragStart = null;
        this.panStart = null;
        this.textDrag = null;
        this.changeHandler = null;

        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
    }

    async initialize() {
        this.image = await loadImage(this.screenshotBlob);
        this.canvas.width = this.image.width;
        this.canvas.height = this.image.height;
        this.canvas.classList.add('is-zoomable');
        this.applyZoom();
        this.updateCursor();
        this.annotations = [];
        this.viewport?.addEventListener('pointerdown', this.handlePointerDown);
        this.viewport?.addEventListener('pointermove', this.handlePointerMove);
        this.viewport?.addEventListener('pointerup', this.handlePointerUp);
        this.viewport?.addEventListener('pointercancel', this.handlePointerUp);
        this.viewport?.addEventListener('wheel', this.handleWheel, { passive: false });
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        this.render();
    }

    destroy() {
        this.viewport?.removeEventListener('pointerdown', this.handlePointerDown);
        this.viewport?.removeEventListener('pointermove', this.handlePointerMove);
        this.viewport?.removeEventListener('pointerup', this.handlePointerUp);
        this.viewport?.removeEventListener('pointercancel', this.handlePointerUp);
        this.viewport?.removeEventListener('wheel', this.handleWheel);
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.canvas.classList.remove('is-zoomable', 'is-panning');
    }

    setTool(tool) {
        this.tool = tool;
        this.updateCursor();
    }

    undo() {
        if (this.annotations.length === 0) {
            return;
        }

        this.annotations.pop();
        this.render();
        this.changeHandler?.(this.getAnnotations());
    }

    clear() {
        this.annotations = [];
        this.render();
        this.changeHandler?.(this.getAnnotations());
    }

    getAnnotations() {
        return this.annotations.map((annotation) => ({ ...annotation }));
    }

    async exportFinalPngBlob() {
        this.render({ includeDraft: false });

        return new Promise((resolve, reject) => {
            this.canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Could not render annotated screenshot.'));
                }
            }, 'image/png');
        });
    }

    handlePointerDown(event) {
        if (this.tool === 'hand') {
            this.beginPan(event);
            return;
        }

        if (event.target !== this.canvas) {
            return;
        }

        const point = canvasPoint(this.canvas, event);
        if (this.tool === 'pin') {
            this.annotations.push({
                type: 'pin',
                x: point.x,
                y: point.y,
                color: TOOL_COLORS.pin
            });
            this.render();
            this.changeHandler?.(this.getAnnotations());
            return;
        }

        if (this.tool === 'text') {
            const textAnnotation = this.findTextAnnotation(point);
            if (textAnnotation) {
                event.currentTarget?.setPointerCapture?.(event.pointerId);
                this.textDrag = {
                    annotation: textAnnotation,
                    start: point,
                    originalX: textAnnotation.x,
                    originalY: textAnnotation.y,
                    moved: false
                };
                return;
            }

            const text = window.prompt('Label') || '';
            if (text.trim()) {
                const annotation = {
                    type: 'text',
                    x: point.x,
                    y: point.y,
                    text: text.trim().slice(0, 80),
                    color: TOOL_COLORS.text
                };
                this.normalizeTextAnnotation(annotation);
                this.annotations.push(annotation);
                this.render();
                this.changeHandler?.(this.getAnnotations());
            }
            return;
        }

        event.currentTarget?.setPointerCapture?.(event.pointerId);
        this.dragStart = point;
        this.draft = this.createShape(point, point);
    }

    handlePointerMove(event) {
        if (this.panStart) {
            this.panTo(event);
            return;
        }

        if (this.textDrag) {
            this.moveTextAnnotation(canvasPoint(this.canvas, event));
            return;
        }

        if (!this.dragStart || !this.draft) {
            return;
        }

        this.draft = this.createShape(this.dragStart, canvasPoint(this.canvas, event));
        this.render();
    }

    handlePointerUp(event) {
        if (this.panStart) {
            this.endPan(event);
            return;
        }

        if (this.textDrag) {
            this.finishTextMove(event);
            return;
        }

        if (!this.dragStart || !this.draft) {
            return;
        }

        event.currentTarget?.releasePointerCapture?.(event.pointerId);
        const finalShape = this.createShape(this.dragStart, canvasPoint(this.canvas, event));
        this.dragStart = null;
        this.draft = null;

        if (Math.abs(finalShape.width || finalShape.endX - finalShape.x) < 4 && Math.abs(finalShape.height || finalShape.endY - finalShape.y) < 4) {
            this.render();
            return;
        }

        this.annotations.push(finalShape);
        this.render();
        this.changeHandler?.(this.getAnnotations());
    }

    handleWheel(event) {
        if (!event.ctrlKey && !this.controlKeyActive) {
            return;
        }

        event.preventDefault();
        const direction = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        this.zoomAt(event.clientX, event.clientY, this.zoom * direction);
    }

    handleKeyDown(event) {
        if (event.key === 'Control') {
            this.controlKeyActive = true;
        }
    }

    handleKeyUp(event) {
        if (event.key === 'Control') {
            this.controlKeyActive = false;
        }
    }

    createShape(start, end) {
        if (this.tool === 'arrow') {
            return {
                type: 'arrow',
                x: start.x,
                y: start.y,
                endX: end.x,
                endY: end.y,
                color: TOOL_COLORS.arrow
            };
        }

        return {
            type: this.tool === 'blur' ? 'blur' : 'rectangle',
            x: Math.min(start.x, end.x),
            y: Math.min(start.y, end.y),
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y),
            color: this.tool === 'blur' ? TOOL_COLORS.blur : TOOL_COLORS.rectangle
        };
    }

    render({ includeDraft = true } = {}) {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.drawImage(this.image, 0, 0);

        for (const annotation of this.annotations) {
            drawAnnotation(this.context, annotation);
        }

        if (includeDraft && this.draft) {
            drawAnnotation(this.context, this.draft);
        }
    }

    findTextAnnotation(point) {
        for (let index = this.annotations.length - 1; index >= 0; index -= 1) {
            const annotation = this.annotations[index];
            if (annotation.type !== 'text') {
                continue;
            }

            if (pointInRect(point, textBubbleBounds(this.context, annotation))) {
                return annotation;
            }
        }

        return null;
    }

    moveTextAnnotation(point) {
        const deltaX = point.x - this.textDrag.start.x;
        const deltaY = point.y - this.textDrag.start.y;
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
            this.textDrag.moved = true;
        }

        this.textDrag.annotation.x = this.textDrag.originalX + deltaX;
        this.textDrag.annotation.y = this.textDrag.originalY + deltaY;
        this.normalizeTextAnnotation(this.textDrag.annotation);
        this.render();
    }

    finishTextMove(event) {
        event.currentTarget?.releasePointerCapture?.(event.pointerId);
        const textDrag = this.textDrag;
        this.textDrag = null;

        if (!textDrag.moved) {
            const nextText = window.prompt('Label', textDrag.annotation.text) || '';
            if (nextText.trim()) {
                textDrag.annotation.text = nextText.trim().slice(0, 80);
                this.normalizeTextAnnotation(textDrag.annotation);
            }
        }

        this.render();
        this.changeHandler?.(this.getAnnotations());
    }

    beginPan(event) {
        if (!this.viewport) {
            return;
        }

        event.preventDefault();
        event.currentTarget?.setPointerCapture?.(event.pointerId);
        this.panStart = {
            clientX: event.clientX,
            clientY: event.clientY,
            scrollLeft: this.viewport.scrollLeft,
            scrollTop: this.viewport.scrollTop
        };
        this.canvas.classList.add('is-panning');
    }

    panTo(event) {
        if (!this.viewport || !this.panStart) {
            return;
        }

        event.preventDefault();
        this.viewport.scrollLeft = this.panStart.scrollLeft + this.panStart.clientX - event.clientX;
        this.viewport.scrollTop = this.panStart.scrollTop + this.panStart.clientY - event.clientY;
    }

    endPan(event) {
        event.currentTarget?.releasePointerCapture?.(event.pointerId);
        this.panStart = null;
        this.canvas.classList.remove('is-panning');
    }

    zoomAt(clientX, clientY, nextZoom) {
        if (!this.viewport) {
            return;
        }

        const previousZoom = this.zoom;
        const normalizedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
        if (normalizedZoom === previousZoom) {
            return;
        }

        const canvasRect = this.canvas.getBoundingClientRect();
        const viewportRect = this.viewport.getBoundingClientRect();
        const viewportX = clientX - viewportRect.left;
        const viewportY = clientY - viewportRect.top;
        const canvasX = clientX - canvasRect.left;
        const canvasY = clientY - canvasRect.top;
        const zoomRatio = normalizedZoom / previousZoom;

        this.zoom = normalizedZoom;
        this.applyZoom();
        this.viewport.scrollLeft += canvasX * zoomRatio - canvasX;
        this.viewport.scrollTop += canvasY * zoomRatio - canvasY;
        this.viewport.scrollLeft = Math.max(0, this.viewport.scrollLeft - Math.max(0, viewportX - canvasX));
        this.viewport.scrollTop = Math.max(0, this.viewport.scrollTop - Math.max(0, viewportY - canvasY));
    }

    applyZoom() {
        this.canvas.style.width = `${Math.round(this.canvas.width * this.zoom)}px`;
        this.canvas.style.height = `${Math.round(this.canvas.height * this.zoom)}px`;
    }

    updateCursor() {
        this.canvas.classList.toggle('is-hand-tool', this.tool === 'hand');
    }

    normalizeTextAnnotation(annotation) {
        const bounds = textBubbleBounds(this.context, annotation);
        const maxX = Math.max(0, this.canvas.width - bounds.width);
        const minY = bounds.height + bounds.tailSize;

        annotation.x = clamp(annotation.x, 0, maxX);
        annotation.y = clamp(annotation.y, minY, this.canvas.height);
    }
}

function drawAnnotation(context, annotation) {
    context.save();
    context.strokeStyle = annotation.color || '#ef4444';
    context.fillStyle = annotation.color || '#ef4444';
    context.lineWidth = 3;

    if (annotation.type === 'rectangle') {
        context.strokeRect(annotation.x, annotation.y, annotation.width, annotation.height);
    }

    if (annotation.type === 'arrow') {
        drawArrow(context, annotation.x, annotation.y, annotation.endX, annotation.endY);
    }

    if (annotation.type === 'pin') {
        context.beginPath();
        context.arc(annotation.x, annotation.y, 9, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#ffffff';
        context.font = 'bold 12px sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('!', annotation.x, annotation.y + 1);
    }

    if (annotation.type === 'text') {
        drawTextBubble(context, annotation);
    }

    if (annotation.type === 'blur') {
        context.globalAlpha = 0.9;
        context.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
    }

    context.restore();
}

function drawTextBubble(context, annotation) {
    const bounds = textBubbleBounds(context, annotation);
    context.textAlign = 'left';
    context.textBaseline = 'top';

    context.fillStyle = '#ffffff';
    context.strokeStyle = TOOL_COLORS.textBubbleBorder;
    context.lineWidth = 2;
    roundedRect(context, bounds.x, bounds.y, bounds.width, bounds.height, bounds.radius);
    context.fill();
    context.stroke();

    context.beginPath();
    context.moveTo(bounds.x + 18, bounds.y + bounds.height - 1);
    context.lineTo(bounds.x + 18 + bounds.tailSize, bounds.y + bounds.height + bounds.tailSize);
    context.lineTo(bounds.x + 18 + bounds.tailSize * 2, bounds.y + bounds.height - 1);
    context.closePath();
    context.fill();
    context.stroke();

    context.fillStyle = annotation.color || TOOL_COLORS.text;
    context.fillText(annotation.text, bounds.x + bounds.paddingX, bounds.y + bounds.paddingY);
}

function textBubbleBounds(context, annotation) {
    const paddingX = 10;
    const paddingY = 7;
    const tailSize = 8;
    const fontSize = 15;
    context.font = `bold ${fontSize}px sans-serif`;
    const textMetrics = context.measureText(annotation.text);
    const width = Math.ceil(textMetrics.width) + paddingX * 2;
    const height = fontSize + paddingY * 2;

    return {
        x: annotation.x,
        y: Math.max(0, annotation.y - height - tailSize),
        width,
        height,
        radius: 8,
        paddingX,
        paddingY,
        tailSize
    };
}

function roundedRect(context, x, y, width, height, radius) {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
    context.closePath();
}

function drawArrow(context, startX, startY, endX, endY) {
    const angle = Math.atan2(endY - startY, endX - startX);
    const headLength = 14;

    context.beginPath();
    context.moveTo(startX, startY);
    context.lineTo(endX, endY);
    context.stroke();
    context.beginPath();
    context.moveTo(endX, endY);
    context.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
    context.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
    context.closePath();
    context.fill();
}

function canvasPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (event.clientX - rect.left) * scaleX,
        y: (event.clientY - rect.top) * scaleY
    };
}

function loadImage(blob) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(blob);
        const image = new Image();
        image.addEventListener('load', () => {
            URL.revokeObjectURL(url);
            resolve(image);
        }, { once: true });
        image.addEventListener('error', () => {
            URL.revokeObjectURL(url);
            reject(new Error('Could not load screenshot.'));
        }, { once: true });
        image.src = url;
    });
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function pointInRect(point, rect) {
    return point.x >= rect.x
        && point.x <= rect.x + rect.width
        && point.y >= rect.y
        && point.y <= rect.y + rect.height + rect.tailSize;
}
