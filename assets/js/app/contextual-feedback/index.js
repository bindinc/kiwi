import { initFeedbackButton } from './button.js';
import { startElementPicker } from './element-picker.js';
import { describeElement } from './selector.js';
import { captureAreaScreenshot, captureElementScreenshot } from './screenshot.js';
import { openFeedbackDialog } from './dialog.js';
import { feedbackApiError, feedbackText } from './i18n.js';
import { buildFeedbackPayload } from './payload.js';
import { initContextualFeedbackSettings } from './settings-modal.js';

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
    button.disabled = true;
    button.classList.add('is-active');

    await openFeedbackDialog({
        documentRef,
        onRequestScreenshot: captureScreenshot,
        onCancel() {
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
            resetButton(button);
        }
    });

    async function captureScreenshot() {
        button.title = feedbackText('picker.selectTarget');
        const selection = await selectScreenshotTarget({ documentRef, windowRef });
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
            button.title = feedbackText('button.title');
        }
    }
}

function selectScreenshotTarget({ documentRef, windowRef }) {
    return new Promise((resolve) => {
        startElementPicker({
            documentRef,
            windowRef,
            onCancel() {
                resolve(null);
            },
            onSelect(selection) {
                resolve(selection);
            }
        });
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
