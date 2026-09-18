// Drafts live only in this page's memory and are discarded with the customer workspace.
let formDrafts = new WeakMap();
const cleanupByDocument = new WeakMap();

export function resumeFormDraft(container, context = '') {
    if (!container) return false;
    if (formDrafts.get(container) === context) {
        container.style.display = 'flex';
        return true;
    }
    formDrafts.set(container, context);
    return false;
}

export function clearFormDraft(container) {
    if (container) formDrafts.delete(container);
}

export function registerDraftCleanup(documentRef, cleanup) {
    let callbacks = cleanupByDocument.get(documentRef);
    if (!callbacks) {
        callbacks = new Set();
        cleanupByDocument.set(documentRef, callbacks);
    }
    callbacks.add(cleanup);
    return () => callbacks.delete(cleanup);
}

export function resetLightboxDrafts(documentRef) {
    formDrafts = new WeakMap();
    const callbacks = cleanupByDocument.get(documentRef);
    if (!callbacks) return;
    for (const cleanup of [...callbacks]) cleanup();
    callbacks.clear();
}
