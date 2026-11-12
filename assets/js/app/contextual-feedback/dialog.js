import { AnnotationCanvas } from './annotation-canvas.js';
import { feedbackText } from './i18n.js';
import { registerDraftCleanup } from '../lightbox-drafts.js';
import { showFeedbackModal, hideFeedbackModal, syncFeedbackModalState } from './modal-surface.js';

const dialogsByDocument = new WeakMap();

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
    opener = documentRef.activeElement,
    onRequestScreenshot,
    onSubmit,
    onCancel,
    onDispose
}) {
    const retained = dialogsByDocument.get(documentRef);
    if (retained) {
        retained(opener);
        return;
    }
    const modal = documentRef.createElement('dialog');
    modal.className = 'contextual-feedback-modal';
    modal.dataset.feedbackIgnore = 'true';
    modal.setAttribute('aria-labelledby', 'contextualFeedbackTitle');
    modal.innerHTML = buildFeedbackDialogHtml();
    documentRef.body.append(modal);

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
    const privacySummary = modal.querySelector('[data-feedback-privacy-summary]');
    const feedbackNote = modal.querySelector('[data-feedback-note]');
    let screenshot = null;
    let annotationCanvas = null;
    let disposed = false;
    let returnFocus = opener;
    let pendingErrorReveal = null;

    function isCurrent() {
        return !disposed && dialogsByDocument.get(documentRef) === resumeDialogAfterCapture;
    }

    function revealError() {
        pendingErrorReveal = null;
        if (!isCurrent() || !modal.open || modal.hidden || !errorBox.textContent.trim()) return;
        const expectedMessage = errorBox.textContent;
        const expectedFocus = documentRef.activeElement;
        const request = {};
        pendingErrorReveal = request;
        errorBox.scrollIntoView({ block: 'nearest' });
        // Native focus scrolling can settle after the synchronous error reveal.
        documentRef.defaultView.requestAnimationFrame(() => {
            if (pendingErrorReveal !== request) return;
            pendingErrorReveal = null;
            const sameMessage = errorBox.textContent === expectedMessage;
            const sameFocus = documentRef.activeElement === expectedFocus;
            if (!isCurrent() || !modal.open || modal.hidden || !sameMessage || !sameFocus) return;
            errorBox.scrollIntoView({ block: 'nearest' });
        });
    }

    function dismiss() {
        if (submitButton.disabled || screenshotButton.disabled) return;
        pendingErrorReveal = null;
        onCancel?.();
        hideFeedbackModal(modal, returnFocus);
    }
    modal.querySelector('[data-feedback-close]').addEventListener('click', dismiss);
    modal.addEventListener('click', (event) => { if (event.target === modal) dismiss(); });
    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') event.stopPropagation();
    });
    modal.addEventListener('cancel', (event) => { event.preventDefault(); dismiss(); });
    dialogsByDocument.set(documentRef, resumeDialogAfterCapture);
    const unregisterCleanup = registerDraftCleanup(documentRef, () => { cleanup(); onCancel?.(); });

    for (const button of modal.querySelectorAll('[data-feedback-tool]')) {
        button.addEventListener('click', () => {
            if (!isCurrent() || !annotationCanvas || submitButton.disabled || screenshotButton.disabled) {
                return;
            }

            const tool = button.dataset.feedbackTool;
            annotationCanvas.setTool(tool);
            for (const item of modal.querySelectorAll('[data-feedback-tool]')) {
                item.classList.toggle('is-active', item === button);
            }
        });
    }

    undoButton.addEventListener('click', () => { if (isCurrent() && !submitButton.disabled) annotationCanvas?.undo(); });
    clearButton.addEventListener('click', () => { if (isCurrent() && !submitButton.disabled) annotationCanvas?.clear(); });
    pseudonymizationCheckbox.addEventListener('change', async (event) => {
        if (!isCurrent() || !annotationCanvas || !screenshot) {
            return;
        }

        const pseudonymizedScreenshotIsSafe = screenshot.privacySummary?.verified === true;
        const usePseudonymizedScreenshot = event.target.checked && pseudonymizedScreenshotIsSafe;
        event.target.checked = usePseudonymizedScreenshot;
        submitButton.disabled = true;
        screenshotButton.disabled = true;
        pseudonymizationCheckbox.disabled = true;
        const currentCanvas = annotationCanvas;
        modal.setAttribute('aria-busy', 'true');
        statusBox.textContent = feedbackText('dialog.switchingScreenshot');
        try {
            const screenshotBlob = usePseudonymizedScreenshot
                ? screenshot.screenshots.pseudonymized.blob
                : screenshot.screenshots.original.blob;
            await currentCanvas.setScreenshotBlob(screenshotBlob);
            if (!isCurrent() || annotationCanvas !== currentCanvas) return;
            updatePrivacyStatus(usePseudonymizedScreenshot);
        } finally {
            if (isCurrent() && annotationCanvas === currentCanvas) {
                submitButton.disabled = false;
                screenshotButton.disabled = false;
                pseudonymizationCheckbox.disabled = !pseudonymizedScreenshotIsSafe;
                statusBox.textContent = '';
                modal.removeAttribute('aria-busy');
            }
        }
    });

    screenshotButton.addEventListener('click', () => {
        void requestScreenshot();
    });
    removeScreenshotButton.addEventListener('click', removeScreenshot);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!isCurrent() || submitButton.disabled || screenshotButton.disabled) return;
        errorBox.textContent = '';
        const formData = new FormData(form);
        const comment = String(formData.get('comment') || '').trim();

        if (!comment) {
            errorBox.textContent = feedbackText('dialog.commentRequired');
            revealError();
            return;
        }

        const disabledStates = new Map([...modal.querySelectorAll('input, select, textarea, button')]
            .map(control => [control, control.disabled]));
        for (const control of disabledStates.keys()) control.disabled = true;
        modal.setAttribute('aria-busy', 'true');
        statusBox.textContent = feedbackText('dialog.uploading');

        try {
            const submission = await buildSubmission({
                annotationCanvas,
                screenshot,
                pseudonymizationCheckbox
            });
            if (!isCurrent()) return;
            await onSubmit({
                comment,
                severity: String(formData.get('severity') || 'normal'),
                category: String(formData.get('category') || 'bug'),
                ...submission
            });
            if (!isCurrent()) return;
            statusBox.textContent = feedbackText('dialog.delivered');
            cleanup();
        } catch (error) {
            if (!isCurrent()) return;
            for (const [control, disabled] of disabledStates) control.disabled = disabled;
            modal.removeAttribute('aria-busy');
            statusBox.textContent = '';
            errorBox.textContent = error instanceof Error ? error.message : feedbackText('dialog.submitFailed');
            revealError();
        }
    });

    resumeDialogAfterCapture();

    async function requestScreenshot() {
        if (!isCurrent() || submitButton.disabled || screenshotButton.disabled) return;
        errorBox.textContent = '';
        screenshotButton.disabled = true;
        suspendDialogForCapture();

        try {
            const nextScreenshot = await onRequestScreenshot?.();
            if (!isCurrent()) return;
            resumeDialogAfterCapture();
            if (nextScreenshot) {
                await installScreenshot(nextScreenshot);
            }
        } catch (error) {
            if (!isCurrent()) return;
            resumeDialogAfterCapture();
            errorBox.textContent = error instanceof Error ? error.message : feedbackText('dialog.captureFailed');
        } finally {
            if (isCurrent()) {
                screenshotButton.disabled = false;
                screenshotButton.focus();
                revealError();
            }
        }
    }

    async function installScreenshot(nextScreenshot) {
        annotationCanvas?.destroy();
        screenshot = nextScreenshot;
        const pseudonymizedScreenshotIsSafe = screenshot.privacySummary?.verified === true;
        pseudonymizationCheckbox.checked = pseudonymizedScreenshotIsSafe;
        pseudonymizationCheckbox.disabled = !pseudonymizedScreenshotIsSafe;
        updatePrivacyStatus(pseudonymizedScreenshotIsSafe);
        annotationCanvas = new AnnotationCanvas({
            canvas,
            screenshotBlob: pseudonymizedScreenshotIsSafe
                ? screenshot.screenshots.pseudonymized.blob
                : screenshot.screenshots.original.blob,
            viewport: canvasViewport
        });
        updateScreenshotState();
        const installedCanvas = annotationCanvas;
        await installedCanvas.initialize();
        if (!isCurrent() || annotationCanvas !== installedCanvas) installedCanvas.destroy();
    }

    function removeScreenshot() {
        if (!isCurrent() || submitButton.disabled || screenshotButton.disabled) return;
        annotationCanvas?.destroy();
        annotationCanvas = null;
        screenshot = null;
        pseudonymizationCheckbox.checked = true;
        pseudonymizationCheckbox.disabled = false;
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
        privacySummary.innerHTML = hasScreenshot
            ? formatPrivacySummary(screenshot.privacySummary)
            : '';
        feedbackNote.textContent = hasScreenshot
            ? feedbackText('dialog.noteWithScreenshot')
            : feedbackText('dialog.noteWithoutScreenshot');
        syncFeedbackModalState(documentRef);
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
        pendingErrorReveal = null;
        modal.classList.add('is-capturing');
        hideFeedbackModal(modal);
    }

    function resumeDialogAfterCapture(nextOpener = null) {
        if (!isCurrent()) return;
        if (nextOpener) returnFocus = nextOpener;
        modal.classList.remove('is-capturing');
        showFeedbackModal(modal);
        modal.querySelector('textarea[name="comment"]')?.focus();
    }

    function cleanup() {
        if (disposed) return;
        pendingErrorReveal = null;
        disposed = true;
        unregisterCleanup();
        if (dialogsByDocument.get(documentRef) === resumeDialogAfterCapture) dialogsByDocument.delete(documentRef);
        annotationCanvas?.destroy();
        onDispose?.();
        hideFeedbackModal(modal, returnFocus);
        modal.remove();
        syncFeedbackModalState(documentRef);
    }
}

export async function buildSubmission({ annotationCanvas, screenshot, pseudonymizationCheckbox }) {
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
    const usePseudonymizedScreenshot = screenshot.privacySummary?.verified === true
        && pseudonymizationCheckbox.checked;

    return {
        selectionKind: screenshot.selectionKind,
        teamsScreenshotVariant: usePseudonymizedScreenshot ? 'pseudonymized' : 'original',
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
        <div class="contextual-feedback-panel">
            <header class="contextual-feedback-panel-header">
                <div>
                    <h2 id="contextualFeedbackTitle">${escapeHtml(feedbackText('dialog.title'))}</h2>
                    <p data-feedback-selection-summary>${escapeHtml(feedbackText('dialog.noScreenshot'))}</p>
                </div>
                <button type="button" class="contextual-feedback-close" data-feedback-close aria-label="${escapeHtml(feedbackText('dialog.close'))}">✕</button>
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
                                <strong data-feedback-visible-privacy aria-live="polite">${escapeHtml(feedbackText('dialog.pseudoDataSelected'))}</strong>
                                <span data-feedback-privacy-destination>${escapeHtml(feedbackText('dialog.standardTeamsDestination'))}</span>
                                <span id="contextualFeedbackPrivacyDetails" class="contextual-feedback-privacy-summary" data-feedback-privacy-summary aria-live="polite"></span>
                            </span>
                        </div>
                        <label class="contextual-feedback-screenshot-toggle">
                            <input type="checkbox" data-feedback-pseudonymized aria-describedby="contextualFeedbackPrivacyDetails" checked>
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
                <p class="contextual-feedback-error" data-feedback-error role="alert" data-feedback-sensitive="opaque-text"></p>
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

export function formatPrivacySummary(privacySummary = {}) {
    if (privacySummary.verified !== true) {
        const unresolvedValues = Number(privacySummary.unresolvedValues || 0);
        const details = feedbackText('privacy.verificationFailedDetails', { count: unresolvedValues });
        return `<span class="is-critical" title="${escapeHtml(details)}">${escapeHtml(feedbackText('privacy.verificationFailed'))}</span>`;
    }

    const resourceFailures = Number(privacySummary.resourceFailures || 0);
    if (resourceFailures > 0) {
        return `<span class="is-warning">${escapeHtml(feedbackText('privacy.resourceFailures', { count: resourceFailures }))}</span>`;
    }

    return '';
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
