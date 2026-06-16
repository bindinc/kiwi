import { describeElement } from './selector.js';

export function startElementPicker({ documentRef = document, onSelect, onCancel }) {
    const overlay = documentRef.createElement('div');
    overlay.className = 'contextual-feedback-picker-overlay';
    overlay.dataset.feedbackIgnore = 'true';

    const outline = documentRef.createElement('div');
    outline.className = 'contextual-feedback-picker-outline';
    outline.dataset.feedbackIgnore = 'true';

    const label = documentRef.createElement('div');
    label.className = 'contextual-feedback-picker-label';
    label.dataset.feedbackIgnore = 'true';

    documentRef.body.append(overlay, outline, label);

    let hoveredElement = null;
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

    function preventAppEvent(event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
    }

    function handlePointerMove(event) {
        preventAppEvent(event);
        updateHover(event.clientX, event.clientY);
    }

    function handleClick(event) {
        preventAppEvent(event);
        if (!hoveredElement) {
            return;
        }

        const selectedElement = hoveredElement;
        cleanup();
        onSelect?.(selectedElement);
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
        documentRef.removeEventListener('pointerdown', preventAppEvent, true);
        documentRef.removeEventListener('pointerup', preventAppEvent, true);
        documentRef.removeEventListener('click', handleClick, true);
        documentRef.removeEventListener('keydown', handleKeyDown, true);
        overlay.remove();
        outline.remove();
        label.remove();
    }

    documentRef.addEventListener('pointermove', handlePointerMove, true);
    documentRef.addEventListener('pointerdown', preventAppEvent, true);
    documentRef.addEventListener('pointerup', preventAppEvent, true);
    documentRef.addEventListener('click', handleClick, true);
    documentRef.addEventListener('keydown', handleKeyDown, true);

    return cleanup;
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
