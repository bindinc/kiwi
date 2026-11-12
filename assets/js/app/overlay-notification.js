const notifications = new WeakMap();
const observedDocuments = new WeakSet();
const overlaySelector = 'dialog[open], .form-container, .modal';

function isVisible(overlay) {
    return overlay && !overlay.hidden && overlay.getClientRects?.().length > 0;
}

function activeOverlay(documentRef) {
    const focused = documentRef.activeElement?.closest?.(overlaySelector);
    if (isVisible(focused)) return focused;
    const visible = [...documentRef.querySelectorAll?.(overlaySelector) || []].filter(isVisible);
    return visible.findLast(overlay => overlay.tagName === 'DIALOG') || visible.at(-1);
}

function clearNotification(overlay) {
    const current = notifications.get(overlay);
    if (!current) return;
    current.observer?.disconnect();
    if (current.timeout !== null) clearTimeout(current.timeout);
    current.notice.remove();
    notifications.delete(overlay);
}

function observeAttempts(documentRef) {
    if (observedDocuments.has(documentRef)) return;
    observedDocuments.add(documentRef);
    documentRef.addEventListener('submit', event => {
        clearNotification(event.target.closest?.(overlaySelector));
    }, true);
    documentRef.addEventListener('click', event => {
        const action = event.target.closest?.('button');
        if (action?.matches('.btn-primary, [type="submit"], [data-service-commit]')) {
            clearNotification(action.closest(overlaySelector));
        }
    }, true);
}

export function renderOverlayNotification(documentRef, message, type) {
    const overlay = activeOverlay(documentRef);
    if (!overlay) return false;
    const actions = overlay.querySelector('.form-actions, .modal-actions, .contextual-feedback-actions');
    const host = actions || overlay.querySelector('.modal-body, .card') || overlay;
    if (host.closest?.('[data-feedback-public]')) return false;

    clearNotification(overlay);
    const notice = documentRef.createElement('p');
    notice.className = `overlay-notification ${type}`;
    notice.setAttribute('role', type === 'error' ? 'alert' : 'status');
    notice.setAttribute('aria-atomic', 'true');
    notice.setAttribute('data-feedback-sensitive', 'opaque-text');
    notice.textContent = message;
    host.prepend(notice);
    const current = { notice, observer: null, timeout: null };
    notifications.set(overlay, current);
    observeAttempts(documentRef);

    const Observer = documentRef.defaultView?.MutationObserver;
    if (Observer) {
        current.observer = new Observer(() => {
            if (!isVisible(overlay) || (overlay.tagName === 'DIALOG' && !overlay.open)) {
                clearNotification(overlay);
            }
        });
        current.observer.observe(overlay, { attributes: true, attributeFilter: ['style', 'class', 'hidden', 'open'] });
    }
    if (type !== 'error') {
        current.timeout = setTimeout(() => {
            if (notifications.get(overlay) === current) clearNotification(overlay);
        }, 3000);
    }
    // Reveal the message and its actions together without moving keyboard focus.
    (actions || notice).scrollIntoView?.({ block: 'nearest' });
    return true;
}
