import { initFeedbackButton } from './button.js';
import { startElementPicker } from './element-picker.js';
import { describeElement } from './selector.js';
import { captureAreaScreenshot, captureElementScreenshot } from './screenshot.js';
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
            windowRef,
            onCancel() {
                resetButton(button);
            },
            async onSelect(selection) {
                await captureSelection(selection);
            }
        });
    }

    async function captureSelection(selection) {
        const selectedRect = selection.rect;
        const selectedElement = selection.kind === 'area'
            ? describeAreaSelection(selectedRect)
            : describeElement(selection.element, documentRef);
        button.title = 'Capturing screenshot...';

        try {
            const screenshot = selection.kind === 'area'
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
            await openFeedbackDialog({
                documentRef,
                screenshots: {
                    pseudonymized: screenshot.pseudonymized,
                    original: screenshot.original
                },
                selectedElement: screenshot.selectedElement,
                privacySummary: screenshot.privacySummary,
                onCancel() {
                    resetButton(button);
                },
                onRetake() {
                    openPicker();
                },
                async onSubmit({ comment, severity, category, teamsScreenshotVariant, annotations, screenshots }) {
                    const payload = buildFeedbackPayload({
                        comment,
                        severity,
                        category,
                        teamsScreenshotVariant,
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
                        screenshots
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

function describeAreaSelection(rect) {
    return {
        tag: 'area',
        label: 'Custom screenshot area',
        selector: 'viewport-area',
        textSample: null,
        dimensions: `${Math.round(rect.width)} × ${Math.round(rect.height)} px`
    };
}

async function submitFeedback({ apiUrl, payload, screenshots }) {
    const formData = new FormData();
    formData.set('payload', JSON.stringify(payload));
    formData.set('screenshot', screenshots.pseudonymized, 'kiwi-contextual-feedback-pseudonymized.png');
    formData.set('originalScreenshot', screenshots.original, 'kiwi-contextual-feedback-original.png');

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
