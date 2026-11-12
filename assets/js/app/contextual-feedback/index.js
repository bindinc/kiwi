import { initFeedbackButton } from './button.js';
import { startElementPicker } from './element-picker.js';
import { describeElement } from './selector.js';
import { captureAreaScreenshot, captureElementScreenshot } from './screenshot.js';
import { openFeedbackDialog } from './dialog.js';
import { feedbackApiError, feedbackText } from './i18n.js';
import { buildFeedbackPayload } from './payload.js';
import { initContextualFeedbackSettings } from './settings-modal.js';

const flowsByDocument = new WeakMap();

export function initContextualFeedbackFeature({ documentRef = document, windowRef = window } = {}) {
    initContextualFeedbackSettings({ documentRef });

    return initFeedbackButton({
        documentRef,
        onClick(button) {
            void startFeedbackFlow({ button, documentRef, windowRef });
        }
    });
}

async function startFeedbackFlow({ button, documentRef, windowRef }) {
    const retained = flowsByDocument.get(documentRef);
    if (retained) {
        await retained.open();
        return;
    }
    const captureAbort = new AbortController();
    const flow = { open };
    flowsByDocument.set(documentRef, flow);
    await open();

    function isCurrent() {
        return flowsByDocument.get(documentRef) === flow;
    }

    async function open() {
        if (!isCurrent()) return;
        const opener = documentRef.activeElement && documentRef.activeElement !== documentRef.body
            ? documentRef.activeElement : button;
        button.disabled = true;
        button.classList.add('is-active');
        await openFeedbackDialog({
            documentRef,
            opener,
            onRequestScreenshot: captureScreenshot,
            onCancel() {
                if (isCurrent()) resetButton(button);
            },
            onDispose() {
                if (!isCurrent()) return;
                flowsByDocument.delete(documentRef);
                captureAbort.abort();
                resetButton(button);
            },
            async onSubmit({
                comment,
                severity,
                category,
                selectionKind,
                teamsScreenshotVariant,
                selectedElement,
                selectedRect,
                annotations,
                screenshots
            }) {
                const payload = buildFeedbackPayload({
                    comment,
                    severity,
                    category,
                    selectionKind,
                    teamsScreenshotVariant,
                    selectedElement,
                    selectedRect,
                    annotations,
                    locationRef: windowRef.location,
                    windowRef,
                    navigatorRef: windowRef.navigator
                });

                await submitFeedback({
                    apiUrl: button.dataset.contextualFeedbackApiUrl || '/api/v1/development-feedback',
                    payload,
                    screenshots
                });
                if (isCurrent()) resetButton(button);
            }
        });
    }

    async function captureScreenshot() {
        button.title = feedbackText('picker.selectTarget');
        const selection = await selectScreenshotTarget({ documentRef, windowRef, signal: captureAbort.signal });
        if (!isCurrent()) return null;
        if (!selection) {
            button.title = feedbackText('button.title');
            return null;
        }

        const selectedRect = selection.rect;
        const selectedElement = selection.kind === 'area'
            ? describeAreaSelection(selectedRect)
            : describeElement(selection.element, documentRef);
        button.title = feedbackText('capture.capturing');
        try {
            const capturedScreenshot = selection.kind === 'area'
                ? await captureAreaScreenshot({
                    rect: selectedRect,
                    selectedElement,
                    documentRef,
                    windowRef
                })
                : await captureElementScreenshot({
                    element: selection.element,
                    selectedElement,
                    documentRef,
                    windowRef
                });

            if (!isCurrent()) return null;
            return {
                selectionKind: selection.kind,
                selectedRect,
                selectedElement: capturedScreenshot.selectedElement,
                privacySummary: capturedScreenshot.privacySummary,
                screenshots: {
                    pseudonymized: capturedScreenshot.pseudonymized,
                    original: capturedScreenshot.original
                }
            };
        } finally {
            if (isCurrent()) button.title = feedbackText('button.title');
        }
    }
}

function selectScreenshotTarget({ documentRef, windowRef, signal }) {
    return new Promise((resolve) => {
        let cleanup = null;
        function finish(selection) {
            cleanup?.();
            signal?.removeEventListener('abort', cancel);
            resolve(selection);
        }
        function cancel() { finish(null); }
        cleanup = startElementPicker({
            documentRef,
            windowRef,
            onCancel: cancel,
            onSelect: finish
        });
        signal?.addEventListener('abort', cancel, { once: true });
        if (signal?.aborted) cancel();
    });
}

function describeAreaSelection(rect) {
    return {
        tag: 'area',
        label: feedbackText('picker.customArea'),
        selector: 'viewport-area',
        textSample: null,
        dimensions: `${Math.round(rect.width)} × ${Math.round(rect.height)} px`
    };
}

async function submitFeedback({ apiUrl, payload, screenshots }) {
    const formData = new FormData();
    formData.set('payload', JSON.stringify(payload));
    if (screenshots) {
        formData.set('screenshot', screenshots.pseudonymized, 'kiwi-contextual-feedback-pseudonymized.png');
        formData.set('originalScreenshot', screenshots.original, 'kiwi-contextual-feedback-original.png');
    }

    const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        headers: { 'X-CSRF-Token': document.querySelector('meta[name="kiwi-csrf-token"]')?.content || '' },
        credentials: 'same-origin'
    });

    const responsePayload = await readJsonResponse(response);
    if (!response.ok) {
        throw new Error(feedbackApiError(responsePayload, 'submission.failed'));
    }

    if (responsePayload?.teamsDeliveryStatus && responsePayload.teamsDeliveryStatus !== 'sent') {
        throw new Error(feedbackText('submission.storedWithWarning'));
    }
}

async function readJsonResponse(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function resetButton(button) {
    button.disabled = false;
    button.classList.remove('is-active');
    button.title = feedbackText('button.title');
}
