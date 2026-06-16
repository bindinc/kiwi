const TOOL_COLORS = {
    selected: '#f97316',
    rectangle: '#ef4444',
    arrow: '#ef4444',
    pin: '#f97316',
    text: '#111827',
    blur: '#111827'
};

export class AnnotationCanvas {
    constructor({ canvas, screenshotBlob, selectedRect }) {
        this.canvas = canvas;
        this.context = canvas.getContext('2d');
        this.screenshotBlob = screenshotBlob;
        this.selectedRect = selectedRect;
        this.tool = 'pointer';
        this.annotations = [];
        this.draft = null;
        this.image = null;
        this.dragStart = null;
        this.changeHandler = null;

        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this);
    }

    async initialize() {
        this.image = await loadImage(this.screenshotBlob);
        this.canvas.width = this.image.width;
        this.canvas.height = this.image.height;
        this.annotations = [{
            type: 'rectangle',
            x: this.selectedRect.x,
            y: this.selectedRect.y,
            width: this.selectedRect.width,
            height: this.selectedRect.height,
            color: TOOL_COLORS.selected
        }];
        this.canvas.addEventListener('pointerdown', this.handlePointerDown);
        this.canvas.addEventListener('pointermove', this.handlePointerMove);
        this.canvas.addEventListener('pointerup', this.handlePointerUp);
        this.render();
    }

    destroy() {
        this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
        this.canvas.removeEventListener('pointermove', this.handlePointerMove);
        this.canvas.removeEventListener('pointerup', this.handlePointerUp);
    }

    setTool(tool) {
        this.tool = tool;
    }

    undo() {
        if (this.annotations.length <= 1) {
            return;
        }

        this.annotations.pop();
        this.render();
        this.changeHandler?.(this.getAnnotations());
    }

    clear() {
        this.annotations = this.annotations.slice(0, 1);
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
        if (this.tool === 'pointer') {
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
        if (!this.dragStart || !this.draft) {
            return;
        }

        this.draft = this.createShape(this.dragStart, canvasPoint(this.canvas, event));
        this.render();
    }

    handlePointerUp(event) {
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
