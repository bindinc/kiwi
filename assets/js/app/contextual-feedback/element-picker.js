import { describeElement } from './selector.js';

export const MINIMUM_AREA_SIZE = 10;

export function startElementPicker({
    documentRef = document,
    windowRef = documentRef.defaultView || window,
    onSelect,
    onCancel
}) {
    const overlay = documentRef.createElement('div');
    overlay.className = 'contextual-feedback-picker-overlay';
    overlay.dataset.feedbackIgnore = 'true';

    const outline = documentRef.createElement('div');
    outline.className = 'contextual-feedback-picker-outline';
    outline.dataset.feedbackIgnore = 'true';

    const label = documentRef.createElement('div');
    label.className = 'contextual-feedback-picker-label';
    label.dataset.feedbackIgnore = 'true';
    label.setAttribute('aria-live', 'polite');

    documentRef.body.append(overlay, outline, label);

    let hoveredElement = null;
    let dragStart = null;
    let activePointerId = null;
    let hasDragged = false;
    let completedDrag = null;
    let disposed = false;

    function updateHover(clientX, clientY) {
        const nextElement = findPickableElement(documentRef, clientX, clientY);
        hoveredElement = nextElement;

        if (!nextElement) {
            outline.hidden = true;
            label.hidden = true;
            return;
        }

        const rect = nextElement.getBoundingClientRect();
        const description = describeElement(nextElement, documentRef);
        outline.hidden = false;
        label.hidden = false;
        outline.style.left = `${rect.left}px`;
        outline.style.top = `${rect.top}px`;
        outline.style.width = `${rect.width}px`;
        outline.style.height = `${rect.height}px`;
        label.style.left = `${Math.max(8, rect.left)}px`;
        label.style.top = `${Math.max(8, rect.top - 30)}px`;
        label.textContent = `${description.tag} - ${description.label}`;
    }

    function updateArea(clientX, clientY) {
        const rect = normalizeAreaRect(
            dragStart,
            { x: clientX, y: clientY },
            { width: windowRef.innerWidth, height: windowRef.innerHeight }
        );

        outline.hidden = false;
        label.hidden = false;
        outline.classList.add('is-area');
        outline.classList.toggle('is-invalid', !isValidAreaRect(rect));
        outline.style.left = `${rect.x}px`;
        outline.style.top = `${rect.y}px`;
        outline.style.width = `${rect.width}px`;
        outline.style.height = `${rect.height}px`;
        label.style.left = `${Math.max(8, rect.x)}px`;
        label.style.top = `${Math.max(8, rect.y - 30)}px`;
        label.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`;

        return rect;
    }

    function showMinimumAreaHint(rect) {
        outline.hidden = false;
        label.hidden = false;
        outline.classList.add('is-area', 'is-invalid');
        outline.style.left = `${rect.x}px`;
        outline.style.top = `${rect.y}px`;
        outline.style.width = `${rect.width}px`;
        outline.style.height = `${rect.height}px`;
        label.style.left = `${Math.max(8, rect.x)}px`;
        label.style.top = `${Math.max(8, rect.y - 30)}px`;
        label.textContent = `Select an area of at least ${MINIMUM_AREA_SIZE} × ${MINIMUM_AREA_SIZE} px`;
    }

    function preventAppEvent(event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
    }

    function handlePointerDown(event) {
        preventAppEvent(event);
        if (event.button !== 0) {
            return;
        }

        dragStart = clampPoint(
            { x: event.clientX, y: event.clientY },
            { width: windowRef.innerWidth, height: windowRef.innerHeight }
        );
        activePointerId = event.pointerId;
        hasDragged = false;
        completedDrag = null;
        overlay.setPointerCapture?.(event.pointerId);
    }

    function handlePointerMove(event) {
        preventAppEvent(event);
        if (dragStart && event.pointerId === activePointerId) {
            const currentPoint = clampPoint(
                { x: event.clientX, y: event.clientY },
                { width: windowRef.innerWidth, height: windowRef.innerHeight }
            );
            const pointerMoved = currentPoint.x !== dragStart.x || currentPoint.y !== dragStart.y;
            hasDragged = hasDragged || pointerMoved;

            if (hasDragged) {
                updateArea(currentPoint.x, currentPoint.y);
            }
            return;
        }

        outline.classList.remove('is-area', 'is-invalid');
        updateHover(event.clientX, event.clientY);
    }

    function handlePointerUp(event) {
        preventAppEvent(event);
        if (!dragStart || event.pointerId !== activePointerId) {
            return;
        }

        if (hasDragged) {
            completedDrag = normalizeAreaRect(
                dragStart,
                { x: event.clientX, y: event.clientY },
                { width: windowRef.innerWidth, height: windowRef.innerHeight }
            );
        }

        overlay.releasePointerCapture?.(event.pointerId);
        dragStart = null;
        activePointerId = null;
        hasDragged = false;
    }

    function handlePointerCancel(event) {
        preventAppEvent(event);
        if (event.pointerId !== activePointerId) {
            return;
        }

        overlay.releasePointerCapture?.(event.pointerId);
        dragStart = null;
        activePointerId = null;
        hasDragged = false;
        completedDrag = null;
        outline.classList.remove('is-area', 'is-invalid');
        updateHover(event.clientX, event.clientY);
    }

    function handleClick(event) {
        preventAppEvent(event);
        if (completedDrag) {
            const selectedArea = completedDrag;
            completedDrag = null;

            if (!isValidAreaRect(selectedArea)) {
                showMinimumAreaHint(selectedArea);
                return;
            }

            cleanup();
            onSelect?.({
                kind: 'area',
                rect: selectedArea
            });
            return;
        }

        const selectedElement = findPickableElement(documentRef, event.clientX, event.clientY) || hoveredElement;
        if (!selectedElement) {
            return;
        }

        const rect = selectedElement.getBoundingClientRect();
        cleanup();
        onSelect?.({
            kind: 'element',
            element: selectedElement,
            rect: copyRect(rect)
        });
    }

    function handleKeyDown(event) {
        if (event.key !== 'Escape') {
            return;
        }

        preventAppEvent(event);
        cleanup();
        onCancel?.();
    }

    function cleanup() {
        if (disposed) {
            return;
        }

        disposed = true;
        documentRef.removeEventListener('pointermove', handlePointerMove, true);
        documentRef.removeEventListener('pointerdown', handlePointerDown, true);
        documentRef.removeEventListener('pointerup', handlePointerUp, true);
        documentRef.removeEventListener('pointercancel', handlePointerCancel, true);
        documentRef.removeEventListener('click', handleClick, true);
        documentRef.removeEventListener('keydown', handleKeyDown, true);
        overlay.remove();
        outline.remove();
        label.remove();
    }

    documentRef.addEventListener('pointermove', handlePointerMove, true);
    documentRef.addEventListener('pointerdown', handlePointerDown, true);
    documentRef.addEventListener('pointerup', handlePointerUp, true);
    documentRef.addEventListener('pointercancel', handlePointerCancel, true);
    documentRef.addEventListener('click', handleClick, true);
    documentRef.addEventListener('keydown', handleKeyDown, true);

    return cleanup;
}

export function normalizeAreaRect(start, end, viewport) {
    const safeStart = clampPoint(start, viewport);
    const safeEnd = clampPoint(end, viewport);

    return {
        x: Math.min(safeStart.x, safeEnd.x),
        y: Math.min(safeStart.y, safeEnd.y),
        width: Math.abs(safeEnd.x - safeStart.x),
        height: Math.abs(safeEnd.y - safeStart.y)
    };
}

export function isValidAreaRect(rect) {
    return rect.width >= MINIMUM_AREA_SIZE && rect.height >= MINIMUM_AREA_SIZE;
}

export function findPickableElement(documentRef, clientX, clientY) {
    const elements = typeof documentRef.elementsFromPoint === 'function'
        ? documentRef.elementsFromPoint(clientX, clientY)
        : [documentRef.elementFromPoint(clientX, clientY)];

    for (const element of elements) {
        if (!element || element.nodeType !== 1) {
            continue;
        }

        if (element.closest('[data-feedback-ignore]')) {
            continue;
        }

        if (['HTML', 'BODY'].includes(element.tagName)) {
            continue;
        }

        return element;
    }

    return null;
}

function clampPoint(point, viewport) {
    return {
        x: Math.max(0, Math.min(Number(viewport.width || 0), Number(point.x || 0))),
        y: Math.max(0, Math.min(Number(viewport.height || 0), Number(point.y || 0)))
    };
}

function copyRect(rect) {
    return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
    };
}
