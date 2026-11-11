import { registerDraftCleanup } from './lightbox-drafts.js';

const requestsByForm = new WeakMap();
const cleanupByForm = new WeakMap();

export function beginServiceFormRequest(form, message) {
    if (form && requestsByForm.has(form)) return null;

    const controls = Array.from(form?.querySelectorAll?.('[data-service-commit]') || []);
    const statuses = Array.from(form?.querySelectorAll?.('[data-service-status]') || []);
    const request = {
        form,
        controls: controls.map(control => ({ control, disabled: control.disabled,
            busy: control.getAttribute?.('aria-busy') ?? null })),
        statuses,
        isCurrent() { return !form || requestsByForm.get(form) === request; }
    };
    if (form) {
        requestsByForm.set(form, request);
        const documentRef = form.ownerDocument || globalThis.document;
        if (documentRef) {
            let cleanup = cleanupByForm.get(form);
            if (!cleanup) {
                cleanup = () => resetServiceFormFeedback(form);
                cleanupByForm.set(form, cleanup);
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

    if (request.form) requestsByForm.delete(request.form);
    for (const { control, disabled, busy } of request.controls) {
        control.disabled = disabled;
        if (busy === null) control.removeAttribute?.('aria-busy');
        else control.setAttribute?.('aria-busy', busy);
    }
    for (const status of request.statuses) status.textContent = '';
}

export function resetServiceFormFeedback(form) {
    if (form) finishServiceFormRequest(requestsByForm.get(form));
}
