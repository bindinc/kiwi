import assert from 'node:assert/strict';
import { openFeedbackDialog } from '../../../../assets/js/app/contextual-feedback/dialog.js';
import { AnnotationCanvas } from '../../../../assets/js/app/contextual-feedback/annotation-canvas.js';
import { initContextualFeedbackSettings } from '../../../../assets/js/app/contextual-feedback/settings-modal.js';
import { registerHooks } from 'node:module';
// Network rendering is outside these controller tests; no SDK call is made.
const sdkHook = registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier === 'https://cdn.jsdelivr.net/npm/dom-to-image-more@3.10.1/+esm') {
            return { url: 'data:text/javascript,export default {}', shortCircuit: true };
        }
        return nextResolve(specifier, context);
    }
});
const { initContextualFeedbackFeature } = await import('../../../../assets/js/app/contextual-feedback/index.js');
sdkHook.deregister();
import { resetLightboxDrafts } from '../../../../assets/js/app/lightbox-drafts.js';
import { createFeedbackDocument, FeedbackFormData, deferred, settle } from '../../support/feedback-dom.mjs';

const originalFormData = globalThis.FormData;
const originalFetch = globalThis.fetch;
const originalDocument = globalThis.document;
const originalWindow = globalThis.window;
const originalInitialize = AnnotationCanvas.prototype.initialize;
const originalDestroy = AnnotationCanvas.prototype.destroy;
globalThis.FormData = FeedbackFormData;
AnnotationCanvas.prototype.initialize = async function () {};
AnnotationCanvas.prototype.destroy = function () { this.destroyed = true; };
const screenshot = {
    selectionKind: 'element', selectedElement: { tag: 'div', label: 'Synthetic target', selector: '#synthetic' },
    selectedRect: { x: 0, y: 0, width: 100, height: 50 }, privacySummary: { verified: true },
    screenshots: { pseudonymized: { blob: 'synthetic-pseudo' }, original: { blob: 'synthetic-original' } }
};
function setup() {
    const documentRef = createFeedbackDocument();
    const button = documentRef.createElement('button');
    documentRef.body.append(button);
    button.focus();
    return { documentRef, button };
}
const modalFor = documentRef => documentRef.querySelector('dialog.contextual-feedback-modal');
const settingsFor = documentRef => documentRef.querySelector('dialog.contextual-feedback-settings-modal');
async function requestImage(modal) {
    await modal.querySelector('[data-feedback-add-screenshot]').emit('click');
    await settle();
}
async function feedbackShieldAndRetainedDraft() {
    const { documentRef, button } = setup();
    const options = { documentRef, opener: button, onRequestScreenshot: async () => screenshot, onSubmit: async () => {} };
    await openFeedbackDialog(options);
    const modal = modalFor(documentRef);
    const comment = modal.querySelector('[name="comment"]');
    comment.value = 'Retained synthetic draft';
    assert.equal(modal.open, true);
    assert.equal(documentRef.body.classList.contains('contextual-feedback-reviewing'), false);
    await requestImage(modal);
    assert.equal(documentRef.body.classList.contains('contextual-feedback-reviewing'), true);
    const escape = await modal.emit('keydown', { key: 'Escape' });
    assert.equal(escape.propagationStopped, true);
    const cancel = await modal.emit('cancel');
    assert.equal(cancel.defaultPrevented, true);
    assert.equal(modal.open, false);
    assert.equal(documentRef.activeElement, button);
    assert.equal(documentRef.body.classList.contains('contextual-feedback-overlay-open'), false);
    assert.equal(documentRef.body.classList.contains('contextual-feedback-reviewing'), false);
    await openFeedbackDialog(options);
    assert.equal(modalFor(documentRef), modal);
    assert.equal(comment.value, 'Retained synthetic draft');
    assert.equal(documentRef.body.classList.contains('contextual-feedback-reviewing'), true);
    await modal.querySelector('[data-feedback-remove-screenshot]').emit('click');
    assert.equal(documentRef.body.classList.contains('contextual-feedback-reviewing'), false);
    resetLightboxDrafts(documentRef);
}
async function staleCaptureAndInitializeCannotRestoreOldDialog() {
    const { documentRef, button } = setup();
    const capture = deferred();
    await openFeedbackDialog({ documentRef, opener: button, onRequestScreenshot: () => capture.promise });
    const old = modalFor(documentRef);
    await requestImage(old);
    assert.equal(old.open, false, 'capture releases native inertness');
    assert.equal(documentRef.body.classList.contains('contextual-feedback-overlay-open'), false);
    resetLightboxDrafts(documentRef);
    await openFeedbackDialog({ documentRef, opener: button });
    const current = modalFor(documentRef);
    capture.resolve(screenshot);
    await settle();
    assert.equal(old.isConnected, false);
    assert.equal(old.open, false);
    assert.equal(current.open, true);
    assert.equal(current.classList.contains('has-screenshot'), false);
    assert.equal(documentRef.body.classList.contains('contextual-feedback-reviewing'), false);
    resetLightboxDrafts(documentRef);

    const initialize = deferred();
    let oldCanvas;
    AnnotationCanvas.prototype.initialize = function () { oldCanvas = this; return initialize.promise; };
    await openFeedbackDialog({ documentRef, onRequestScreenshot: async () => screenshot });
    await requestImage(modalFor(documentRef));
    resetLightboxDrafts(documentRef);
    await openFeedbackDialog({ documentRef });
    initialize.resolve();
    await settle();
    assert.equal(oldCanvas.destroyed, true);
    assert.equal(documentRef.body.classList.contains('contextual-feedback-reviewing'), false);
    resetLightboxDrafts(documentRef);
    AnnotationCanvas.prototype.initialize = async function () {};
}
async function staleSubmitCannotDeleteNewDialogOrShield() {
    const { documentRef, button } = setup();
    const submission = deferred();
    await openFeedbackDialog({ documentRef, opener: button, onSubmit: () => submission.promise });
    const old = modalFor(documentRef);
    old.querySelector('[name="comment"]').value = 'Synthetic submission';
    const pending = old.querySelector('form').emit('submit');
    await settle();
    assert.equal(old.querySelector('[data-feedback-close]').disabled, true);
    await old.emit('cancel');
    assert.equal(old.open, true, 'pending submission blocks dismissal');
    resetLightboxDrafts(documentRef);
    const options = { documentRef, onRequestScreenshot: async () => screenshot };
    await openFeedbackDialog(options);
    const current = modalFor(documentRef);
    await requestImage(current);
    submission.resolve();
    await pending;
    await openFeedbackDialog(options);
    assert.equal(modalFor(documentRef), current, 'stale success cannot delete the new owner');
    assert.equal(current.open, true);
    assert.equal(documentRef.body.classList.contains('contextual-feedback-reviewing'), true);
    resetLightboxDrafts(documentRef);
}
async function staleScreenshotSwitchAndExportCannotAffectNewOwner() {
    const { documentRef } = setup();
    const originalSwitch = AnnotationCanvas.prototype.setScreenshotBlob;
    const originalExport = AnnotationCanvas.prototype.exportFinalPngBlobFor;
    const originalAnnotations = AnnotationCanvas.prototype.getAnnotations;
    try {
        const switchImage = deferred();
        AnnotationCanvas.prototype.setScreenshotBlob = () => switchImage.promise;
        await openFeedbackDialog({ documentRef, onRequestScreenshot: async () => screenshot });
        const old = modalFor(documentRef);
        await requestImage(old);
        const checkbox = old.querySelector('[data-feedback-pseudonymized]');
        checkbox.checked = false;
        const switching = checkbox.emit('change');
        await settle();
        resetLightboxDrafts(documentRef);
        await openFeedbackDialog({ documentRef });
        const current = modalFor(documentRef);
        switchImage.resolve();
        await switching;
        assert.equal(current.classList.contains('has-screenshot'), false);
        assert.equal(documentRef.body.classList.contains('contextual-feedback-reviewing'), false);
        resetLightboxDrafts(documentRef);

        const exported = deferred();
        let submissions = 0;
        AnnotationCanvas.prototype.exportFinalPngBlobFor = () => exported.promise;
        AnnotationCanvas.prototype.getAnnotations = () => [];
        await openFeedbackDialog({ documentRef, onRequestScreenshot: async () => screenshot, onSubmit: async () => { submissions++; } });
        const exporting = modalFor(documentRef);
        await requestImage(exporting);
        exporting.querySelector('[name="comment"]').value = 'Synthetic image export';
        const pending = exporting.querySelector('form').emit('submit');
        await settle();
        resetLightboxDrafts(documentRef);
        await openFeedbackDialog({ documentRef });
        const newest = modalFor(documentRef);
        exported.resolve('synthetic-export');
        await pending;
        assert.equal(submissions, 0, 'reset during image export cannot start an obsolete request');
        assert.equal(modalFor(documentRef), newest);
        assert.equal(newest.open, true);
        resetLightboxDrafts(documentRef);
    } finally {
        AnnotationCanvas.prototype.setScreenshotBlob = originalSwitch;
        AnnotationCanvas.prototype.exportFinalPngBlobFor = originalExport;
        AnnotationCanvas.prototype.getAnnotations = originalAnnotations;
    }
}
async function submissionFailureRestoresControlsAndRetainsValues() {
    const { documentRef } = setup();
    let received;
    await openFeedbackDialog({ documentRef, onSubmit: async value => { received = value; throw new Error('Synthetic request failed'); } });
    const modal = modalFor(documentRef);
    modal.querySelector('[name="comment"]').value = '  Synthetic draft  ';
    await modal.querySelector('form').emit('submit');
    assert.equal(received.comment, 'Synthetic draft');
    assert.equal(received.selectionKind, 'none');
    assert.equal(received.screenshots, null);
    assert.equal(modal.querySelector('[name="comment"]').value, '  Synthetic draft  ');
    assert.equal(modal.querySelector('[data-feedback-submit]').disabled, false);
    assert.equal(modal.querySelector('[data-feedback-close]').disabled, false);
    assert.equal(modal.querySelector('[data-feedback-error]').textContent, 'Synthetic request failed');
    assert.equal(modal.querySelector('[data-feedback-error]').getAttribute('data-feedback-sensitive'), 'free-text');
    resetLightboxDrafts(documentRef);
}
const settings = {
    feedbackEnabled: true, allowedRoles: [], teamsWebhookConfigured: false, teamsWebhookSource: 'none',
    originalDataWebhookConfigured: false, originalDataWebhookSource: 'none', publicBaseUrl: 'https://example.test',
    imageTtlDays: 14, maxImageBytes: 3145728
};
const response = value => ({ ok: true, json: async () => value });
function setupSettings() {
    const result = setup();
    result.button.setAttribute('id', 'contextualFeedbackSettingsButton');
    result.button.dataset.contextualFeedbackSettingsUrl = '/synthetic/settings';
    const feedbackButton = result.documentRef.createElement('button');
    feedbackButton.setAttribute('id', 'contextualFeedbackButton');
    result.documentRef.body.append(feedbackButton);
    globalThis.document = result.documentRef;
    initContextualFeedbackSettings({ documentRef: result.documentRef });
    return { ...result, feedbackButton };
}
async function staleSettingsLoadAndSaveCannotMutateNewSession() {
    const { documentRef, button, feedbackButton } = setupSettings();
    const oldLoad = deferred();
    globalThis.fetch = () => oldLoad.promise;
    await button.emit('click');
    const old = settingsFor(documentRef);
    resetLightboxDrafts(documentRef);
    const newLoad = deferred();
    globalThis.fetch = () => newLoad.promise;
    await button.emit('click');
    const current = settingsFor(documentRef);
    oldLoad.resolve(response(settings));
    await settle();
    assert.equal(old.isConnected, false);
    assert.equal(current.querySelector('[data-feedback-settings-form]'), null);
    assert.equal(button.disabled, true, 'old load cannot unlock the current opener');
    newLoad.resolve(response(settings));
    await settle();
    const save = deferred();
    globalThis.fetch = () => save.promise;
    const oldForm = current.querySelector('form');
    const pending = current.emit('submit', { target: oldForm });
    await settle();
    resetLightboxDrafts(documentRef);
    globalThis.fetch = async () => response(settings);
    await button.emit('click');
    await settle();
    const newest = settingsFor(documentRef);
    const draft = newest.querySelector('[name="publicBaseUrl"]');
    draft.value = 'https://new-draft.example.test';
    save.resolve(response({ ...settings, feedbackEnabled: false }));
    await pending;
    assert.equal(draft.value, 'https://new-draft.example.test');
    assert.equal(feedbackButton.hidden, false, 'old save cannot alter the new feature state');
    assert.equal(button.disabled, true);
    assert.equal(newest.open, true);
    resetLightboxDrafts(documentRef);
}
async function settingsLoadFailureCanRetryAndRestoreOpener() {
    const { documentRef, button } = setupSettings();
    globalThis.fetch = async () => { throw new Error('Synthetic load failure'); };
    await button.emit('click');
    await settle();
    const modal = settingsFor(documentRef);
    assert.equal(modal.querySelector('[data-feedback-settings-load-error]').textContent, 'Synthetic load failure');
    const retry = modal.querySelector('[data-feedback-settings-retry]');
    assert.equal(retry.hidden, false);
    globalThis.fetch = async () => response(settings);
    await modal.emit('click', { target: retry });
    await settle();
    assert.ok(modal.querySelector('[data-feedback-settings-form]'));
    modal.querySelector('[name="publicBaseUrl"]').value = 'https://retained.example.test';
    await modal.emit('cancel');
    assert.equal(documentRef.activeElement, button);
    assert.equal(button.disabled, false);
    await button.emit('click');
    assert.equal(settingsFor(documentRef), modal);
    assert.equal(modal.querySelector('[name="publicBaseUrl"]').value, 'https://retained.example.test');
    resetLightboxDrafts(documentRef);
}
async function oldFeatureSubmissionCannotUnlockNewOpener() {
    const { documentRef, button } = setup();
    button.setAttribute('id', 'contextualFeedbackButton');
    globalThis.document = documentRef;
    const windowRef = { location: { href: 'https://example.test/kiwi', pathname: '/kiwi', search: '' }, navigator: { userAgent: 'Synthetic unit controller' } };
    globalThis.window = windowRef;
    initContextualFeedbackFeature({ documentRef, windowRef });
    const delivery = deferred();
    globalThis.fetch = () => delivery.promise;
    await button.emit('click');
    const old = modalFor(documentRef);
    old.querySelector('[name="comment"]').value = 'Synthetic feature submission';
    const pending = old.querySelector('form').emit('submit');
    await settle();
    resetLightboxDrafts(documentRef);
    await button.emit('click');
    const current = modalFor(documentRef);
    delivery.resolve(response({ teamsDeliveryStatus: 'sent' }));
    await pending;
    assert.equal(button.disabled, true);
    assert.equal(button.classList.contains('is-active'), true);
    assert.equal(current.open, true);
    await current.emit('cancel');
    assert.equal(button.disabled, false);
    resetLightboxDrafts(documentRef);
}
try {
    await feedbackShieldAndRetainedDraft();
    await staleCaptureAndInitializeCannotRestoreOldDialog();
    await staleSubmitCannotDeleteNewDialogOrShield();
    await staleScreenshotSwitchAndExportCannotAffectNewOwner();
    await submissionFailureRestoresControlsAndRetainsValues();
    await staleSettingsLoadAndSaveCannotMutateNewSession();
    await settingsLoadFailureCanRetryAndRestoreOpener();
    await oldFeatureSubmissionCannotUnlockNewOpener();
} finally {
    globalThis.FormData = originalFormData;
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    AnnotationCanvas.prototype.initialize = originalInitialize;
    AnnotationCanvas.prototype.destroy = originalDestroy;
}
