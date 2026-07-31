import { AnnotationCanvas } from './annotation-canvas.js';
import { feedbackText } from './i18n.js';

const TOOLS = [
    ['hand', '✥'],
    ['rectangle', '□'],
    ['arrow', '↗'],
    ['pin', '!'],
    ['text', 'T'],
    ['blur', '■']
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
    modal.innerHTML = buildFeedbackDialogHtml();
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
    const privacyStatus = modal.querySelector('[data-feedback-privacy-status]');
    const privacyDestination = modal.querySelector('[data-feedback-privacy-destination]');
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
        statusBox.textContent = feedbackText('dialog.switchingScreenshot');
        try {
            const screenshotBlob = usePseudonymizedScreenshot
                ? screenshot.screenshots.pseudonymized.blob
                : screenshot.screenshots.original.blob;
            await annotationCanvas.setScreenshotBlob(screenshotBlob);
            updatePrivacyStatus(usePseudonymizedScreenshot);
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
            errorBox.textContent = feedbackText('dialog.commentRequired');
            return;
        }

        submitButton.disabled = true;
        statusBox.textContent = feedbackText('dialog.uploading');

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
            statusBox.textContent = feedbackText('dialog.delivered');
            cleanup();
        } catch (error) {
            submitButton.disabled = false;
            statusBox.textContent = '';
            errorBox.textContent = error instanceof Error ? error.message : feedbackText('dialog.submitFailed');
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
            errorBox.textContent = error instanceof Error ? error.message : feedbackText('dialog.captureFailed');
        } finally {
            screenshotButton.disabled = false;
            screenshotButton.focus();
        }
    }

    async function installScreenshot(nextScreenshot) {
        annotationCanvas?.destroy();
        screenshot = nextScreenshot;
        pseudonymizationCheckbox.checked = true;
        updatePrivacyStatus(true);
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
        updatePrivacyStatus(true);
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
        screenshotButton.textContent = hasScreenshot
            ? feedbackText('dialog.replaceScreenshot')
            : feedbackText('dialog.addScreenshot');
        selectionSummary.innerHTML = hasScreenshot
            ? formatSelectionSummary(screenshot.selectedElement)
            : feedbackText('dialog.noScreenshot');
        feedbackNote.textContent = hasScreenshot
            ? feedbackText('dialog.noteWithScreenshot')
            : feedbackText('dialog.noteWithoutScreenshot');
    }

    function updatePrivacyStatus(usePseudonymizedScreenshot) {
        privacyStatus.classList.toggle('is-original', !usePseudonymizedScreenshot);
        modal.querySelector('[data-feedback-visible-privacy]').textContent = usePseudonymizedScreenshot
            ? feedbackText('dialog.pseudoDataSelected')
            : feedbackText('dialog.originalDataSelected');
        privacyDestination.textContent = usePseudonymizedScreenshot
            ? feedbackText('dialog.standardTeamsDestination')
            : feedbackText('dialog.restrictedTeamsDestination');
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

export function buildFeedbackDialogHtml() {
    const toolButtons = TOOLS.map(([tool, label], index) => {
        const title = feedbackText(`tools.${tool}`);

        return `
        <button type="button" class="contextual-feedback-tool${index === 0 ? ' is-active' : ''}" data-feedback-tool="${tool}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${escapeHtml(label)}</button>
    `;
    }).join('');

    return `
        <div class="contextual-feedback-panel" role="dialog" aria-modal="true" aria-labelledby="contextualFeedbackTitle">
            <header class="contextual-feedback-panel-header">
                <div>
                    <h2 id="contextualFeedbackTitle">${escapeHtml(feedbackText('dialog.title'))}</h2>
                    <p data-feedback-selection-summary>${escapeHtml(feedbackText('dialog.noScreenshot'))}</p>
                </div>
                <button type="button" class="contextual-feedback-close" data-feedback-close aria-label="${escapeHtml(feedbackText('dialog.close'))}">x</button>
            </header>
            <div class="contextual-feedback-workspace" data-feedback-workspace hidden>
                <div class="contextual-feedback-toolbar">${toolButtons}</div>
                <div class="contextual-feedback-canvas-wrap" data-feedback-canvas-wrap>
                    <div class="contextual-feedback-privacy-status" data-feedback-privacy-status aria-label="${escapeHtml(feedbackText('dialog.screenshotPrivacyStatus'))}">
                        <div class="contextual-feedback-privacy-primary">
                            <span class="contextual-feedback-privacy-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24">
                                    <path d="M12 3 5 6v5c0 4.5 2.7 7.7 7 10 4.3-2.3 7-5.5 7-10V6l-7-3Z"></path>
                                    <path d="m9 12 2 2 4-4"></path>
                                </svg>
                            </span>
                            <span class="contextual-feedback-privacy-copy">
                                <strong data-feedback-visible-privacy>${escapeHtml(feedbackText('dialog.pseudoDataSelected'))}</strong>
                                <span data-feedback-privacy-destination>${escapeHtml(feedbackText('dialog.standardTeamsDestination'))}</span>
                            </span>
                        </div>
                        <label class="contextual-feedback-screenshot-toggle">
                            <input type="checkbox" data-feedback-pseudonymized checked>
                            <span class="contextual-feedback-switch-track" aria-hidden="true"></span>
                            <span>${escapeHtml(feedbackText('dialog.usePseudoData'))}</span>
                        </label>
                    </div>
                    <canvas data-feedback-canvas></canvas>
                </div>
            </div>
            <form class="contextual-feedback-form" data-feedback-form>
                <label>
                    <span>${escapeHtml(feedbackText('dialog.comment'))} <small>(${escapeHtml(feedbackText('dialog.required'))})</small></span>
                    <textarea name="comment" maxlength="4000" required placeholder="${escapeHtml(feedbackText('dialog.commentPlaceholder'))}"></textarea>
                </label>
                <div class="contextual-feedback-form-row">
                    <label>
                        <span>${escapeHtml(feedbackText('dialog.severity'))}</span>
                        <select name="severity">
                            <option value="normal">${escapeHtml(feedbackText('dialog.severityNormal'))}</option>
                            <option value="low">${escapeHtml(feedbackText('dialog.severityLow'))}</option>
                            <option value="high">${escapeHtml(feedbackText('dialog.severityHigh'))}</option>
                            <option value="blocking">${escapeHtml(feedbackText('dialog.severityBlocking'))}</option>
                        </select>
                    </label>
                    <label>
                        <span>${escapeHtml(feedbackText('dialog.category'))}</span>
                        <select name="category">
                            <option value="bug">${escapeHtml(feedbackText('dialog.categoryBug'))}</option>
                            <option value="chore">${escapeHtml(feedbackText('dialog.categoryChore'))}</option>
                            <option value="feature_request">${escapeHtml(feedbackText('dialog.categoryFeatureRequest'))}</option>
                            <option value="regression">${escapeHtml(feedbackText('dialog.categoryRegression'))}</option>
                        </select>
                    </label>
                </div>
                <p class="contextual-feedback-note" data-feedback-note>${escapeHtml(feedbackText('dialog.noteWithoutScreenshot'))}</p>
                <div class="contextual-feedback-actions">
                    <div>
                        <button type="button" data-feedback-add-screenshot>${escapeHtml(feedbackText('dialog.addScreenshot'))}</button>
                        <button type="button" data-feedback-remove-screenshot hidden>${escapeHtml(feedbackText('dialog.removeScreenshot'))}</button>
                        <button type="button" data-feedback-undo hidden>${escapeHtml(feedbackText('dialog.undo'))}</button>
                        <button type="button" data-feedback-clear hidden>${escapeHtml(feedbackText('dialog.clear'))}</button>
                    </div>
                    <button type="submit" data-feedback-submit>${escapeHtml(feedbackText('dialog.send'))}</button>
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

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
