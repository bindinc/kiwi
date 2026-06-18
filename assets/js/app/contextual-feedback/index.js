import { initFeedbackButton } from './button.js';
import { startElementPicker } from './element-picker.js';
import { describeElement } from './selector.js';
import { captureElementScreenshot } from './screenshot.js';
import { openFeedbackDialog } from './dialog.js';
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

    openPicker();

    function openPicker() {
        button.title = 'Select an element for feedback';

        startElementPicker({
            documentRef,
            onCancel() {
                resetButton(button);
            },
            async onSelect(element) {
                await captureSelection(element);
            }
        });
    }

    async function captureSelection(element) {
        const selectedRect = element.getBoundingClientRect();
        const selectedElement = describeElement(element, documentRef);
        button.title = 'Capturing screenshot...';

        try {
            const screenshot = await captureElementScreenshot({
                element,
                selectedElement,
                documentRef,
                windowRef
            });
            await openFeedbackDialog({
                documentRef,
                screenshotBlob: screenshot.blob,
                selectedElement: screenshot.selectedElement,
                privacySummary: screenshot.privacySummary,
                onCancel() {
                    resetButton(button);
                },
                onRetake() {
                    openPicker();
                },
                async onSubmit({ comment, severity, category, annotations, screenshotBlob }) {
                    const payload = buildFeedbackPayload({
                        comment,
                        severity,
                        category,
                        selectedElement: screenshot.selectedElement,
                        selectedRect,
                        annotations,
                        locationRef: windowRef.location,
                        windowRef,
                        navigatorRef: windowRef.navigator
                    });

                    await submitFeedback({
                        apiUrl: button.dataset.contextualFeedbackApiUrl || '/api/v1/development-feedback',
                        payload,
                        screenshotBlob
                    });
                    resetButton(button);
                }
            });
        } catch (error) {
            resetButton(button);
            windowRef.alert(error instanceof Error ? error.message : 'Could not capture feedback.');
        }
    }
}

async function submitFeedback({ apiUrl, payload, screenshotBlob }) {
    const formData = new FormData();
    formData.set('payload', JSON.stringify(payload));
    formData.set('screenshot', screenshotBlob, 'kiwi-contextual-feedback.png');

    const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        credentials: 'same-origin'
    });

    const responsePayload = await readJsonResponse(response);
    if (!response.ok) {
        const message = responsePayload?.error?.message || 'Could not submit feedback.';
        throw new Error(message);
    }

    if (responsePayload?.teamsDeliveryStatus && responsePayload.teamsDeliveryStatus !== 'sent') {
        throw new Error(responsePayload.warning || 'Feedback was stored, but Teams delivery did not complete.');
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
    button.title = 'Contextual feedback';
}
