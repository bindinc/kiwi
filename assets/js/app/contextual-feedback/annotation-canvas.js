const TOOL_COLORS = {
    rectangle: '#ef4444',
    arrow: '#ef4444',
    pin: '#f97316',
    text: '#111827',
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
        this.annotations = [];
        this.draft = null;
        this.image = null;
        this.dragStart = null;
        this.panStart = null;
        this.changeHandler = null;

        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
    }

    async initialize() {
        this.image = await loadImage(this.screenshotBlob);
        this.canvas.width = this.image.width;
        this.canvas.height = this.image.height;
        this.canvas.classList.add('is-zoomable');
        this.applyZoom();
        this.updateCursor();
        this.annotations = [];
        this.canvas.addEventListener('pointerdown', this.handlePointerDown);
        this.canvas.addEventListener('pointermove', this.handlePointerMove);
        this.canvas.addEventListener('pointerup', this.handlePointerUp);
        this.canvas.addEventListener('pointercancel', this.handlePointerUp);
        this.viewport?.addEventListener('wheel', this.handleWheel, { passive: false });
        this.render();
    }

    destroy() {
        this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
        this.canvas.removeEventListener('pointermove', this.handlePointerMove);
        this.canvas.removeEventListener('pointerup', this.handlePointerUp);
        this.canvas.removeEventListener('pointercancel', this.handlePointerUp);
        this.viewport?.removeEventListener('wheel', this.handleWheel);
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
            const text = window.prompt('Label') || '';
            if (text.trim()) {
                this.annotations.push({
                    type: 'text',
                    x: point.x,
                    y: point.y,
                    text: text.trim().slice(0, 80),
                    color: TOOL_COLORS.text
                });
                this.render();
                this.changeHandler?.(this.getAnnotations());
            }
            return;
        }

        this.canvas.setPointerCapture?.(event.pointerId);
        this.dragStart = point;
        this.draft = this.createShape(point, point);
    }

    handlePointerMove(event) {
        if (this.panStart) {
            this.panTo(event);
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

        if (!this.dragStart || !this.draft) {
            return;
        }

        this.canvas.releasePointerCapture?.(event.pointerId);
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
        if (!event.ctrlKey) {
            return;
        }

        event.preventDefault();
        const direction = event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        this.zoomAt(event.clientX, event.clientY, this.zoom * direction);
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

    beginPan(event) {
        if (!this.viewport) {
            return;
        }

        event.preventDefault();
        this.canvas.setPointerCapture?.(event.pointerId);
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
        this.canvas.releasePointerCapture?.(event.pointerId);
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

        const viewportRect = this.viewport.getBoundingClientRect();
        const viewportX = clientX - viewportRect.left;
        const viewportY = clientY - viewportRect.top;
        const imageX = viewportX + this.viewport.scrollLeft;
        const imageY = viewportY + this.viewport.scrollTop;
        const zoomRatio = normalizedZoom / previousZoom;

        this.zoom = normalizedZoom;
        this.applyZoom();
        this.viewport.scrollLeft = imageX * zoomRatio - viewportX;
        this.viewport.scrollTop = imageY * zoomRatio - viewportY;
    }

    applyZoom() {
        this.canvas.style.width = `${Math.round(this.canvas.width * this.zoom)}px`;
        this.canvas.style.height = `${Math.round(this.canvas.height * this.zoom)}px`;
    }

    updateCursor() {
        this.canvas.classList.toggle('is-hand-tool', this.tool === 'hand');
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
        context.font = '16px sans-serif';
        context.lineWidth = 4;
        context.strokeStyle = '#ffffff';
        context.strokeText(annotation.text, annotation.x, annotation.y);
        context.fillText(annotation.text, annotation.x, annotation.y);
    }

    if (annotation.type === 'blur') {
        context.globalAlpha = 0.9;
        context.fillRect(annotation.x, annotation.y, annotation.width, annotation.height);
    }

    context.restore();
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
