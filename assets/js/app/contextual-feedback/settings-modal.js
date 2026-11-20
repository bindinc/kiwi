import { interfaceIcon } from '../interface-icons.js';
import { feedbackApiError, feedbackText } from './i18n.js';
import { registerDraftCleanup } from '../lightbox-drafts.js';
import { showFeedbackModal, hideFeedbackModal, syncFeedbackModalState } from './modal-surface.js';

const settingsByDocument = new WeakMap();

export function initContextualFeedbackSettings({ documentRef = document } = {}) {
    const button = documentRef.getElementById('contextualFeedbackSettingsButton');
    if (!button) {
        return null;
    }

    button.addEventListener('click', () => {
        void openSettingsModal({ button, documentRef });
    });

    return button;
}

async function openSettingsModal({ button, documentRef }) {
    const settingsUrl = button.dataset.contextualFeedbackSettingsUrl;
    if (!settingsUrl) return;

    const opener = documentRef.activeElement && documentRef.activeElement !== documentRef.body
        ? documentRef.activeElement : button;
    button.disabled = true;
    button.classList.add('is-active');
    const retained = settingsByDocument.get(documentRef);
    if (retained) {
        retained.show(opener);
        await retained.load();
        return;
    }
    const modal = renderSettingsModal(documentRef);
    const session = wireSettingsModal({
        modal,
        settingsUrl,
        documentRef,
        opener,
        onClose() {
            button.disabled = false;
            button.classList.remove('is-active');
        }
    });
    session.show();
    await session.load();
}

async function fetchSettings(settingsUrl) {
    const response = await fetch(settingsUrl, {
        method: 'GET',
        credentials: 'same-origin'
    });
    const payload = await readJson(response);

    if (!response.ok) {
        throw new Error(feedbackApiError(payload, 'settings.loadFailed'));
    }

    return payload;
}

function renderSettingsModal(documentRef) {
    const modal = documentRef.createElement('dialog');
    modal.className = 'contextual-feedback-settings-modal';
    modal.dataset.feedbackIgnore = 'true';
    modal.setAttribute('aria-labelledby', 'contextualFeedbackSettingsTitle');
    modal.innerHTML = `
        <div class="contextual-feedback-settings-panel">
            <header class="contextual-feedback-panel-header">
                <h2 id="contextualFeedbackSettingsTitle" data-i18n="contextualFeedback.settings.title">${escapeHtml(feedbackText('settings.title'))}</h2>
                <button type="button" class="contextual-feedback-close" data-feedback-settings-close data-i18n-aria-label="contextualFeedback.dialog.close" aria-label="${escapeHtml(feedbackText('dialog.close'))}">${interfaceIcon('close')}</button>
            </header>
            <div class="contextual-feedback-settings-form">
                <p data-feedback-settings-load-status role="status">${escapeHtml(feedbackText('settings.loading'))}</p>
                <p data-feedback-settings-load-error class="contextual-feedback-error" role="alert" data-feedback-sensitive="opaque-text"></p>
                <button type="button" data-feedback-settings-retry data-i18n="contextualFeedback.settings.retry" hidden>${escapeHtml(feedbackText('settings.retry'))}</button>
            </div>
        </div>`;
    documentRef.body.append(modal);
    return modal;
}

function wireSettingsModal({ modal, settingsUrl, documentRef, opener, onClose }) {
    let disposed = false;
    let loading = false;
    let loaded = false;
    let saving = false;
    let returnFocus = opener;
    const session = { show, load };
    settingsByDocument.set(documentRef, session);
    const unregisterCleanup = registerDraftCleanup(documentRef, cleanup);

    function isCurrent() {
        return !disposed && settingsByDocument.get(documentRef) === session;
    }
    function show(nextOpener = null) {
        if (!isCurrent()) return;
        if (nextOpener) returnFocus = nextOpener;
        const roles = modal.querySelector('[data-feedback-settings-allowed-roles]');
        if (roles) {
            roles.textContent = feedbackText('settings.allowedRoles', { roles: roles.dataset.feedbackSettingsAllowedRoles });
        }
        showFeedbackModal(modal);
        modal.querySelector('input')?.focus();
    }
    function close() {
        if (!isCurrent()) return;
        onClose?.();
        hideFeedbackModal(modal, returnFocus);
    }
    function cleanup() {
        if (disposed) return;
        const ownsSession = settingsByDocument.get(documentRef) === session;
        disposed = true;
        unregisterCleanup();
        if (ownsSession) {
            settingsByDocument.delete(documentRef);
            onClose?.();
        }
        hideFeedbackModal(modal, ownsSession ? returnFocus : null);
        modal.remove();
        syncFeedbackModalState(documentRef);
    }
    modal.addEventListener('click', (event) => {
        if (event.target === modal || event.target.closest?.('[data-feedback-settings-close]')) close();
        if (event.target.closest?.('[data-feedback-settings-retry]')) void load();
    });
    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') event.stopPropagation();
    });
    modal.addEventListener('cancel', (event) => { event.preventDefault(); close(); });

    async function load() {
        if (!isCurrent() || loading || loaded) return;
        loading = true;
        const status = modal.querySelector('[data-feedback-settings-load-status]');
        const errorBox = modal.querySelector('[data-feedback-settings-load-error]');
        const retry = modal.querySelector('[data-feedback-settings-retry]');
        setSettingsStatus(status, 'settings.loading');
        errorBox.textContent = '';
        retry.hidden = true;
        retry.disabled = true;
        try {
            const settings = await fetchSettings(settingsUrl);
            if (!isCurrent()) return;
            modal.innerHTML = buildFeedbackSettingsHtml(settings);
            loaded = true;
            if (modal.open) modal.querySelector('input')?.focus();
        } catch (error) {
            if (!isCurrent()) return;
            setSettingsStatus(status, null);
            errorBox.textContent = error instanceof Error ? error.message : feedbackText('settings.loadFailed');
            retry.hidden = false;
        } finally {
            if (isCurrent()) {
                loading = false;
                retry.disabled = false;
            }
        }
    }

    modal.addEventListener('submit', async (event) => {
        const form = modal.querySelector('[data-feedback-settings-form]');
        if (event.target !== form) return;
        event.preventDefault();
        if (!isCurrent() || saving) return;
        saving = true;
        const errorBox = form.querySelector('[data-feedback-settings-error]');
        const statusBox = form.querySelector('[data-feedback-settings-status]');
        const feedbackButton = documentRef.getElementById('contextualFeedbackButton');
        const payload = buildSettingsPayload(form);
        const disabledStates = new Map([...form.querySelectorAll('input, select, textarea, button')]
            .map(control => [control, control.disabled]));
        for (const control of disabledStates.keys()) control.disabled = true;
        form.setAttribute('aria-busy', 'true');
        errorBox.textContent = '';
        setSettingsStatus(statusBox, 'settings.saving');

        try {
            const nextSettings = await saveSettings(settingsUrl, payload);
            if (!isCurrent()) return;
            setSettingsStatus(statusBox, 'settings.saved');
            form.querySelector('[name="webhookUrl"]').value = '';
            form.querySelector('[name="originalDataWebhookUrl"]').value = '';
            setSettingsStatus(form.querySelector('[data-webhook-configured]'), configuredStatusKey(nextSettings.teamsWebhookConfigured));
            form.querySelector('[data-webhook-source]').textContent = nextSettings.teamsWebhookSource;
            setSettingsStatus(form.querySelector('[data-original-data-webhook-configured]'), configuredStatusKey(nextSettings.originalDataWebhookConfigured));
            form.querySelector('[data-original-data-webhook-source]').textContent = nextSettings.originalDataWebhookSource;
            if (feedbackButton) feedbackButton.hidden = !nextSettings.feedbackEnabled;
        } catch (error) {
            if (!isCurrent()) return;
            setSettingsStatus(statusBox, null);
            errorBox.textContent = error instanceof Error ? error.message : feedbackText('settings.saveFailed');
        } finally {
            if (isCurrent()) {
                saving = false;
                form.removeAttribute('aria-busy');
                for (const [control, disabled] of disabledStates) control.disabled = disabled;
            }
        }
    });
    return session;
}

async function saveSettings(settingsUrl, payload) {
    const response = await fetch(settingsUrl, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': document.querySelector('meta[name="kiwi-csrf-token"]')?.content || ''
        },
        body: JSON.stringify(payload)
    });
    const responsePayload = await readJson(response);

    if (!response.ok) {
        throw new Error(feedbackApiError(responsePayload, 'settings.saveFailed'));
    }

    return responsePayload;
}

function buildSettingsPayload(form) {
    const formData = new FormData(form);
    const webhookUrl = String(formData.get('webhookUrl') || '').trim();
    const originalDataWebhookUrl = String(formData.get('originalDataWebhookUrl') || '').trim();
    const payload = {
        feedbackEnabled: formData.get('feedbackEnabled') === 'on',
        publicBaseUrl: String(formData.get('publicBaseUrl') || '').trim(),
        imageTtlDays: Number(formData.get('imageTtlDays') || 14),
        maxImageBytes: Number(formData.get('maxImageBytes') || 3145728),
        clearWebhookUrl: formData.get('clearWebhookUrl') === 'on',
        clearOriginalDataWebhookUrl: formData.get('clearOriginalDataWebhookUrl') === 'on'
    };

    if (webhookUrl) {
        payload.webhookUrl = webhookUrl;
    }

    if (originalDataWebhookUrl) {
        payload.originalDataWebhookUrl = originalDataWebhookUrl;
    }

    return payload;
}

export function buildFeedbackSettingsHtml(settings) {
    const webhookPlaceholderKey = settings.teamsWebhookConfigured ? 'settings.keepWebhookPlaceholder' : 'settings.webhookPlaceholder';
    const originalWebhookPlaceholderKey = settings.originalDataWebhookConfigured ? 'settings.keepOriginalWebhookPlaceholder' : 'settings.originalWebhookPlaceholder';
    const webhookStatusKey = configuredStatusKey(settings.teamsWebhookConfigured);
    const originalWebhookStatusKey = configuredStatusKey(settings.originalDataWebhookConfigured);
    const roles = settings.allowedRoles.join(', ');

    return `
        <div class="contextual-feedback-settings-panel">
            <header class="contextual-feedback-panel-header">
                <div>
                    <h2 id="contextualFeedbackSettingsTitle" data-i18n="contextualFeedback.settings.title">${escapeHtml(feedbackText('settings.title'))}</h2>
                    <p data-i18n="contextualFeedback.settings.subtitle">${escapeHtml(feedbackText('settings.subtitle'))}</p>
                </div>
                <button type="button" class="contextual-feedback-close" data-feedback-settings-close data-i18n-aria-label="contextualFeedback.dialog.close" aria-label="${escapeHtml(feedbackText('dialog.close'))}">${interfaceIcon('close')}</button>
            </header>
            <form class="contextual-feedback-settings-form" data-feedback-settings-form>
                <section>
                    <h3 data-i18n="contextualFeedback.settings.feedbackButton">${escapeHtml(feedbackText('settings.feedbackButton'))}</h3>
                    <label class="contextual-feedback-switch">
                        <input type="checkbox" name="feedbackEnabled"${settings.feedbackEnabled ? ' checked' : ''}>
                        <span data-i18n="contextualFeedback.settings.enabled">${escapeHtml(feedbackText('settings.enabled'))}</span>
                    </label>
                    <p data-feedback-settings-allowed-roles="${escapeHtml(roles)}">${escapeHtml(feedbackText('settings.allowedRoles', { roles }))}</p>
                </section>
                <section>
                    <h3 data-i18n="contextualFeedback.settings.teamsConnector">${escapeHtml(feedbackText('settings.teamsConnector'))}</h3>
                    <div class="contextual-feedback-settings-status-row">
                        <span data-i18n="contextualFeedback.settings.status">${escapeHtml(feedbackText('settings.status'))}</span>
                        <strong data-webhook-configured data-i18n="contextualFeedback.${webhookStatusKey}">${escapeHtml(feedbackText(webhookStatusKey))}</strong>
                    </div>
                    <div class="contextual-feedback-settings-status-row">
                        <span data-i18n="contextualFeedback.settings.source">${escapeHtml(feedbackText('settings.source'))}</span>
                        <strong data-webhook-source>${escapeHtml(settings.teamsWebhookSource)}</strong>
                    </div>
                    <label>
                        <span data-i18n="contextualFeedback.settings.webhookUrl">${escapeHtml(feedbackText('settings.webhookUrl'))}</span>
                        <input type="password" name="webhookUrl" autocomplete="off" data-i18n-placeholder="contextualFeedback.${webhookPlaceholderKey}" placeholder="${escapeHtml(feedbackText(webhookPlaceholderKey))}">
                    </label>
                    <label class="contextual-feedback-switch">
                        <input type="checkbox" name="clearWebhookUrl">
                        <span data-i18n="contextualFeedback.settings.clearWebhook">${escapeHtml(feedbackText('settings.clearWebhook'))}</span>
                    </label>
                    <h3 data-i18n="contextualFeedback.settings.originalWorkflow">${escapeHtml(feedbackText('settings.originalWorkflow'))}</h3>
                    <div class="contextual-feedback-settings-status-row">
                        <span data-i18n="contextualFeedback.settings.status">${escapeHtml(feedbackText('settings.status'))}</span>
                        <strong data-original-data-webhook-configured data-i18n="contextualFeedback.${originalWebhookStatusKey}">${escapeHtml(feedbackText(originalWebhookStatusKey))}</strong>
                    </div>
                    <div class="contextual-feedback-settings-status-row">
                        <span data-i18n="contextualFeedback.settings.source">${escapeHtml(feedbackText('settings.source'))}</span>
                        <strong data-original-data-webhook-source>${escapeHtml(settings.originalDataWebhookSource)}</strong>
                    </div>
                    <label>
                        <span data-i18n="contextualFeedback.settings.originalWebhookUrl">${escapeHtml(feedbackText('settings.originalWebhookUrl'))}</span>
                        <input type="password" name="originalDataWebhookUrl" autocomplete="off" data-i18n-placeholder="contextualFeedback.${originalWebhookPlaceholderKey}" placeholder="${escapeHtml(feedbackText(originalWebhookPlaceholderKey))}">
                    </label>
                    <label class="contextual-feedback-switch">
                        <input type="checkbox" name="clearOriginalDataWebhookUrl">
                        <span data-i18n="contextualFeedback.settings.clearOriginalWebhook">${escapeHtml(feedbackText('settings.clearOriginalWebhook'))}</span>
                    </label>
                    <label>
                        <span data-i18n="contextualFeedback.settings.publicBaseUrl">${escapeHtml(feedbackText('settings.publicBaseUrl'))}</span>
                        <input type="url" name="publicBaseUrl" value="${escapeHtml(settings.publicBaseUrl)}" required>
                    </label>
                    <div class="contextual-feedback-form-row">
                        <label>
                            <span data-i18n="contextualFeedback.settings.imageTtlDays">${escapeHtml(feedbackText('settings.imageTtlDays'))}</span>
                            <input type="number" name="imageTtlDays" min="1" max="14" step="1" value="${Number(settings.imageTtlDays)}" required>
                        </label>
                        <label>
                            <span data-i18n="contextualFeedback.settings.maxImageBytes">${escapeHtml(feedbackText('settings.maxImageBytes'))}</span>
                            <input type="number" name="maxImageBytes" min="1" max="10485760" step="1" value="${Number(settings.maxImageBytes)}" required>
                        </label>
                    </div>
                </section>
                <div class="contextual-feedback-actions">
                    <button type="button" data-feedback-settings-close data-i18n="contextualFeedback.settings.cancel">${escapeHtml(feedbackText('settings.cancel'))}</button>
                    <button type="submit" data-i18n="contextualFeedback.settings.save">${escapeHtml(feedbackText('settings.save'))}</button>
                </div>
                <p class="contextual-feedback-status" data-feedback-settings-status role="status"></p>
                <p class="contextual-feedback-error" data-feedback-settings-error role="alert" data-feedback-sensitive="opaque-text"></p>
            </form>
        </div>
    `;
}

function configuredStatusKey(isConfigured) {
    return isConfigured ? 'settings.configured' : 'settings.notConfigured';
}

function setSettingsStatus(element, key) {
    if (key) {
        element.setAttribute('data-i18n', `contextualFeedback.${key}`);
        element.textContent = feedbackText(key);
    } else {
        element.removeAttribute('data-i18n');
        element.textContent = '';
    }
}

async function readJson(response) {
    try {
        return await response.json();
    } catch {
        return null;
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
