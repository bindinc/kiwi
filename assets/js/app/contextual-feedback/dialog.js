import { AnnotationCanvas } from './annotation-canvas.js';

const TOOLS = [
    ['hand', '✥', 'Hand'],
    ['rectangle', '□', 'Rectangle'],
    ['arrow', '↗', 'Arrow'],
    ['pin', '!', 'Pin'],
    ['text', 'T', 'Text'],
    ['blur', '■', 'Redact']
];

export async function openFeedbackDialog({
    documentRef = document,
    onRequestScreenshot,
    onSubmit,
    onCancel
}) {
    const modal = documentRef.createElement('div');
    modal.className = 'contextual-feedback-modal';
    modal.dataset.feedbackIgnore = 'true';
    modal.innerHTML = dialogTemplate();
    documentRef.body.append(modal);
    documentRef.body.classList.add('contextual-feedback-reviewing');

    const canvas = modal.querySelector('[data-feedback-canvas]');
    const canvasViewport = modal.querySelector('[data-feedback-canvas-wrap]');
    const workspace = modal.querySelector('[data-feedback-workspace]');
    const form = modal.querySelector('[data-feedback-form]');
    const errorBox = modal.querySelector('[data-feedback-error]');
    const statusBox = modal.querySelector('[data-feedback-status]');
    const submitButton = modal.querySelector('[data-feedback-submit]');
    const screenshotButton = modal.querySelector('[data-feedback-add-screenshot]');
    const removeScreenshotButton = modal.querySelector('[data-feedback-remove-screenshot]');
    const undoButton = modal.querySelector('[data-feedback-undo]');
    const clearButton = modal.querySelector('[data-feedback-clear]');
    const pseudonymizationCheckbox = modal.querySelector('[data-feedback-pseudonymized]');
    const selectionSummary = modal.querySelector('[data-feedback-selection-summary]');
    const privacySummary = modal.querySelector('[data-feedback-privacy-summary]');
    const feedbackNote = modal.querySelector('[data-feedback-note]');
    let screenshot = null;
    let annotationCanvas = null;

    modal.querySelector('[data-feedback-close]').addEventListener('click', () => {
        cleanup();
        onCancel?.();
    });

    for (const button of modal.querySelectorAll('[data-feedback-tool]')) {
        button.addEventListener('click', () => {
            if (!annotationCanvas) {
                return;
            }

            const tool = button.dataset.feedbackTool;
            annotationCanvas.setTool(tool);
            for (const item of modal.querySelectorAll('[data-feedback-tool]')) {
                item.classList.toggle('is-active', item === button);
            }
        });
    }

    undoButton.addEventListener('click', () => annotationCanvas?.undo());
    clearButton.addEventListener('click', () => annotationCanvas?.clear());
    pseudonymizationCheckbox.addEventListener('change', async (event) => {
        if (!annotationCanvas || !screenshot) {
            return;
        }

        const usePseudonymizedScreenshot = event.target.checked;
        submitButton.disabled = true;
        statusBox.textContent = 'Switching screenshot...';
        try {
            const screenshotBlob = usePseudonymizedScreenshot
                ? screenshot.screenshots.pseudonymized.blob
                : screenshot.screenshots.original.blob;
            await annotationCanvas.setScreenshotBlob(screenshotBlob);
            modal.querySelector('[data-feedback-visible-privacy]').textContent = usePseudonymizedScreenshot
                ? 'Send pseudo-data screenshot to Teams'
                : 'Send original-data screenshot to restricted Teams workflow';
        } finally {
            submitButton.disabled = false;
            statusBox.textContent = '';
        }
    });

    screenshotButton.addEventListener('click', () => {
        void requestScreenshot();
    });
    removeScreenshotButton.addEventListener('click', removeScreenshot);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorBox.textContent = '';
        const formData = new FormData(form);
        const comment = String(formData.get('comment') || '').trim();

        if (!comment) {
            errorBox.textContent = 'Comment is required.';
            return;
        }

        submitButton.disabled = true;
        statusBox.textContent = 'Uploading...';

        try {
            const submission = await buildSubmission({
                annotationCanvas,
                screenshot,
                pseudonymizationCheckbox
            });
            await onSubmit({
                comment,
                severity: String(formData.get('severity') || 'normal'),
                category: String(formData.get('category') || 'bug'),
                ...submission
            });
            statusBox.textContent = 'Delivered.';
            cleanup();
        } catch (error) {
            submitButton.disabled = false;
            statusBox.textContent = '';
            errorBox.textContent = error instanceof Error ? error.message : 'Could not submit feedback.';
        }
    });

    modal.querySelector('textarea[name="comment"]')?.focus();

    async function requestScreenshot() {
        errorBox.textContent = '';
        screenshotButton.disabled = true;
        suspendDialogForCapture();

        try {
            const nextScreenshot = await onRequestScreenshot?.();
            resumeDialogAfterCapture();
            if (nextScreenshot) {
                await installScreenshot(nextScreenshot);
            }
        } catch (error) {
            resumeDialogAfterCapture();
            errorBox.textContent = error instanceof Error ? error.message : 'Could not capture feedback.';
        } finally {
            screenshotButton.disabled = false;
            screenshotButton.focus();
        }
    }

    async function installScreenshot(nextScreenshot) {
        annotationCanvas?.destroy();
        screenshot = nextScreenshot;
        pseudonymizationCheckbox.checked = true;
        modal.querySelector('[data-feedback-visible-privacy]').textContent = 'Send pseudo-data screenshot to Teams';
        annotationCanvas = new AnnotationCanvas({
            canvas,
            screenshotBlob: screenshot.screenshots.pseudonymized.blob,
            viewport: canvasViewport
        });
        updateScreenshotState();
        await annotationCanvas.initialize();
    }

    function removeScreenshot() {
        annotationCanvas?.destroy();
        annotationCanvas = null;
        screenshot = null;
        pseudonymizationCheckbox.checked = true;
        updateScreenshotState();
        screenshotButton.focus();
    }

    function updateScreenshotState() {
        const hasScreenshot = screenshot !== null;
        modal.classList.toggle('has-screenshot', hasScreenshot);
        workspace.hidden = !hasScreenshot;
        removeScreenshotButton.hidden = !hasScreenshot;
        undoButton.hidden = !hasScreenshot;
        clearButton.hidden = !hasScreenshot;
        screenshotButton.textContent = hasScreenshot ? 'Replace screenshot' : 'Add screenshot';
        selectionSummary.innerHTML = hasScreenshot
            ? formatSelectionSummary(screenshot.selectedElement)
            : 'No screenshot attached';
        privacySummary.innerHTML = hasScreenshot
            ? formatPrivacySummary(screenshot.privacySummary)
            : '';
        feedbackNote.textContent = hasScreenshot
            ? 'Kiwi stores both annotated screenshot variants. Only the selected screenshot is delivered to Teams.'
            : 'A screenshot is optional. Text-only feedback is sent to the regular Teams workflow.';
    }

    function suspendDialogForCapture() {
        modal.hidden = true;
        modal.classList.add('is-capturing');
        documentRef.body.classList.remove('contextual-feedback-reviewing');
    }

    function resumeDialogAfterCapture() {
        modal.hidden = false;
        modal.classList.remove('is-capturing');
        documentRef.body.classList.add('contextual-feedback-reviewing');
    }

    function cleanup() {
        annotationCanvas?.destroy();
        modal.remove();
        documentRef.body.classList.remove('contextual-feedback-reviewing');
    }
}

async function buildSubmission({ annotationCanvas, screenshot, pseudonymizationCheckbox }) {
    if (!annotationCanvas || !screenshot) {
        return {
            selectionKind: 'none',
            teamsScreenshotVariant: null,
            selectedElement: null,
            selectedRect: null,
            annotations: [],
            screenshots: null
        };
    }

    const pseudonymizedBlob = await annotationCanvas.exportFinalPngBlobFor(screenshot.screenshots.pseudonymized.blob);
    const originalBlob = await annotationCanvas.exportFinalPngBlobFor(screenshot.screenshots.original.blob);

    return {
        selectionKind: screenshot.selectionKind,
        teamsScreenshotVariant: pseudonymizationCheckbox.checked ? 'pseudonymized' : 'original',
        selectedElement: screenshot.selectedElement,
        selectedRect: screenshot.selectedRect,
        annotations: annotationCanvas.getAnnotations(),
        screenshots: {
            pseudonymized: pseudonymizedBlob,
            original: originalBlob
        }
    };
}

function dialogTemplate() {
    const toolButtons = TOOLS.map(([tool, label, title], index) => `
        <button type="button" class="contextual-feedback-tool${index === 0 ? ' is-active' : ''}" data-feedback-tool="${tool}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${escapeHtml(label)}</button>
    `).join('');

    return `
        <div class="contextual-feedback-panel" role="dialog" aria-modal="true" aria-labelledby="contextualFeedbackTitle">
            <header class="contextual-feedback-panel-header">
                <div>
                    <h2 id="contextualFeedbackTitle">Send feedback</h2>
                    <p data-feedback-selection-summary>No screenshot attached</p>
                </div>
                <button type="button" class="contextual-feedback-close" data-feedback-close aria-label="Close">x</button>
            </header>
            <div class="contextual-feedback-workspace" data-feedback-workspace hidden>
                <div class="contextual-feedback-toolbar">${toolButtons}</div>
                <div class="contextual-feedback-canvas-wrap" data-feedback-canvas-wrap>
                    <div class="contextual-feedback-privacy-status" aria-label="Screenshot privacy status">
                        <label class="contextual-feedback-screenshot-toggle">
                            <input type="checkbox" data-feedback-pseudonymized checked>
                            <span data-feedback-visible-privacy>Send pseudo-data screenshot to Teams</span>
                        </label>
                        <span data-feedback-privacy-summary></span>
                        <span>Manual redaction available</span>
                    </div>
                    <canvas data-feedback-canvas></canvas>
                </div>
            </div>
            <form class="contextual-feedback-form" data-feedback-form>
                <label>
                    <span>Comment <small>(required)</small></span>
                    <textarea name="comment" maxlength="4000" required placeholder="What did you expect, and what happened?"></textarea>
                </label>
                <div class="contextual-feedback-form-row">
                    <label>
                        <span>Severity</span>
                        <select name="severity">
                            <option value="normal">Normal</option>
                            <option value="low">Low</option>
                            <option value="high">High</option>
                            <option value="blocking">Blocking</option>
                        </select>
                    </label>
                    <label>
                        <span>Category</span>
                        <select name="category">
                            <option value="bug">Bug</option>
                            <option value="chore">Chore</option>
                            <option value="feature_request">Feature Request</option>
                            <option value="regression">Regression</option>
                        </select>
                    </label>
                </div>
                <p class="contextual-feedback-note" data-feedback-note>A screenshot is optional. Text-only feedback is sent to the regular Teams workflow.</p>
                <div class="contextual-feedback-actions">
                    <div>
                        <button type="button" data-feedback-add-screenshot>Add screenshot</button>
                        <button type="button" data-feedback-remove-screenshot hidden>Remove screenshot</button>
                        <button type="button" data-feedback-undo hidden>Undo</button>
                        <button type="button" data-feedback-clear hidden>Clear</button>
                    </div>
                    <button type="submit" data-feedback-submit>Send feedback</button>
                </div>
                <p class="contextual-feedback-status" data-feedback-status aria-live="polite"></p>
                <p class="contextual-feedback-error" data-feedback-error role="alert"></p>
            </form>
        </div>
    `;
}

function formatSelectionSummary(selectedElement) {
    if (selectedElement.tag === 'area') {
        return `${escapeHtml(selectedElement.label)} <span>${escapeHtml(selectedElement.dimensions)}</span>`;
    }

    return `${escapeHtml(selectedElement.label)} <span>${escapeHtml(selectedElement.selector)}</span>`;
}

function formatPrivacySummary(privacySummary = {}) {
    const hiddenElements = Number(privacySummary.hiddenElements || 0);
    if (hiddenElements < 1) {
        return 'No hidden regions';
    }

    const hiddenTypes = Array.isArray(privacySummary.hiddenElementTypes) && privacySummary.hiddenElementTypes.length > 0
        ? privacySummary.hiddenElementTypes.join(', ')
        : 'media or marked private regions';
    const tooltip = `${hiddenElements} hidden: ${hiddenTypes}. These are hidden because they cannot be pseudonymized reliably.`;

    return `<span class="is-warning" title="${escapeHtml(tooltip)}">Some media hidden</span>`;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
