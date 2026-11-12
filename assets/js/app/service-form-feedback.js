import { registerDraftCleanup } from './lightbox-drafts.js';

const requestsByOwner = new WeakMap();
const cleanupByOwner = new WeakMap();

export function beginServiceFormRequest(form, message, options = {}) {
    const owner = options.owner || form;
    if (owner && requestsByOwner.has(owner)) return null;

    const controlSelector = options.controlSelector || '[data-service-commit]';
    const statusSelector = options.statusSelector || '[data-service-status]';
    const controls = Array.from(form?.querySelectorAll?.(controlSelector) || []);
    const statuses = Array.from(form?.querySelectorAll?.(statusSelector) || []);
    const request = {
        form,
        owner,
        controls: controls.map(control => ({ control, disabled: control.disabled,
            busy: control.getAttribute?.('aria-busy') ?? null })),
        statuses,
        isCurrent() { return !owner || requestsByOwner.get(owner) === request; }
    };
    if (owner) {
        requestsByOwner.set(owner, request);
        const documentRef = form?.ownerDocument || globalThis.document;
        if (documentRef) {
            let cleanup = cleanupByOwner.get(owner);
            if (!cleanup) {
                cleanup = () => resetServiceFormFeedback(owner);
                cleanupByOwner.set(owner, cleanup);
            }
            // Workspace reset clears its callback set, so every new claim registers again.
            registerDraftCleanup(documentRef, cleanup);
        }
    }
    for (const { control } of request.controls) {
        control.disabled = true;
        control.setAttribute?.('aria-busy', 'true');
    }
    for (const status of statuses) status.textContent = message;
    return request;
}

export function finishServiceFormRequest(request) {
    if (!request || !request.isCurrent()) return;

    if (request.owner) requestsByOwner.delete(request.owner);
    for (const { control, disabled, busy } of request.controls) {
        control.disabled = disabled;
        if (busy === null) control.removeAttribute?.('aria-busy');
        else control.setAttribute?.('aria-busy', busy);
    }
    for (const status of request.statuses) status.textContent = '';
}

export function resetServiceFormFeedback(owner) {
    if (owner) finishServiceFormRequest(requestsByOwner.get(owner));
}
