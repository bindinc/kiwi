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
    screenshotBlob,
    selectedElement,
    privacySummary = {},
    onSubmit,
    onCancel,
    onRetake
}) {
    const modal = documentRef.createElement('div');
    modal.className = 'contextual-feedback-modal';
    modal.dataset.feedbackIgnore = 'true';
    modal.innerHTML = dialogTemplate(selectedElement, privacySummary);
    documentRef.body.append(modal);
    documentRef.body.classList.add('contextual-feedback-reviewing');

    const canvas = modal.querySelector('[data-feedback-canvas]');
    const canvasViewport = modal.querySelector('[data-feedback-canvas-wrap]');
    const form = modal.querySelector('[data-feedback-form]');
    const errorBox = modal.querySelector('[data-feedback-error]');
    const statusBox = modal.querySelector('[data-feedback-status]');
    const submitButton = modal.querySelector('[data-feedback-submit]');
    const annotationCanvas = new AnnotationCanvas({ canvas, screenshotBlob, viewport: canvasViewport });
    await annotationCanvas.initialize();

    modal.querySelector('[data-feedback-close]').addEventListener('click', () => {
        cleanup();
        onCancel?.();
    });

    for (const button of modal.querySelectorAll('[data-feedback-tool]')) {
        button.addEventListener('click', () => {
            const tool = button.dataset.feedbackTool;
            annotationCanvas.setTool(tool);
            for (const item of modal.querySelectorAll('[data-feedback-tool]')) {
                item.classList.toggle('is-active', item === button);
            }
        });
    }

    modal.querySelector('[data-feedback-undo]').addEventListener('click', () => annotationCanvas.undo());
    modal.querySelector('[data-feedback-clear]').addEventListener('click', () => annotationCanvas.clear());
    modal.querySelector('[data-feedback-retake]').addEventListener('click', () => {
        cleanup();
        onRetake?.();
    });

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
            const finalBlob = await annotationCanvas.exportFinalPngBlob();
            await onSubmit({
                comment,
                severity: String(formData.get('severity') || 'normal'),
                category: String(formData.get('category') || 'bug'),
                annotations: annotationCanvas.getAnnotations(),
                screenshotBlob: finalBlob
            });
            statusBox.textContent = 'Delivered.';
            cleanup();
        } catch (error) {
            submitButton.disabled = false;
            statusBox.textContent = '';
            errorBox.textContent = error instanceof Error ? error.message : 'Could not submit feedback.';
        }
    });

    function cleanup() {
        annotationCanvas.destroy();
        modal.remove();
        documentRef.body.classList.remove('contextual-feedback-reviewing');
    }
}

function dialogTemplate(selectedElement, privacySummary) {
    const toolButtons = TOOLS.map(([tool, label, title], index) => `
        <button type="button" class="contextual-feedback-tool${index === 0 ? ' is-active' : ''}" data-feedback-tool="${tool}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}">${escapeHtml(label)}</button>
    `).join('');
    const hiddenElements = Number(privacySummary.hiddenElements || 0);
    const hiddenTypes = Array.isArray(privacySummary.hiddenElementTypes) && privacySummary.hiddenElementTypes.length > 0
        ? privacySummary.hiddenElementTypes.join(', ')
        : 'media or marked private regions';
    const hiddenTooltip = `${hiddenElements} hidden: ${hiddenTypes}. These are hidden because they cannot be pseudonymized reliably.`;
    const hiddenBadge = hiddenElements > 0
        ? `<span class="is-warning" title="${escapeHtml(hiddenTooltip)}">Some media hidden</span>`
        : '<span>No hidden regions</span>';

    return `
        <div class="contextual-feedback-panel" role="dialog" aria-modal="true" aria-labelledby="contextualFeedbackTitle">
            <header class="contextual-feedback-panel-header">
                <div>
                    <h2 id="contextualFeedbackTitle">Contextual feedback</h2>
                    <p>${escapeHtml(selectedElement.label)} <span>${escapeHtml(selectedElement.selector)}</span></p>
                </div>
                <button type="button" class="contextual-feedback-close" data-feedback-close aria-label="Close">x</button>
            </header>
            <div class="contextual-feedback-workspace">
                <div class="contextual-feedback-toolbar">${toolButtons}</div>
                <div class="contextual-feedback-canvas-wrap" data-feedback-canvas-wrap>
                    <div class="contextual-feedback-privacy-status" aria-label="Screenshot privacy status">
                        <span>Pseudo data applied</span>
                        ${hiddenBadge}
                        <span>Manual redaction available</span>
                    </div>
                    <canvas data-feedback-canvas></canvas>
                </div>
            </div>
            <form class="contextual-feedback-form" data-feedback-form>
                <label>
                    <span>Comment</span>
                    <textarea name="comment" maxlength="4000" required></textarea>
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
                <p class="contextual-feedback-note">The modal shows only the selected element crop with pseudo data. Teams receives the annotated crop, your comment, severity, category, page route, viewport, and the sanitized selected-element selector.</p>
                <div class="contextual-feedback-actions">
                    <div>
                        <button type="button" data-feedback-retake>Retake screenshot</button>
                        <button type="button" data-feedback-undo>Undo</button>
                        <button type="button" data-feedback-clear>Clear</button>
                    </div>
                    <button type="submit" data-feedback-submit>Submit</button>
                </div>
                <p class="contextual-feedback-status" data-feedback-status></p>
                <p class="contextual-feedback-error" data-feedback-error></p>
            </form>
        </div>
    `;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
