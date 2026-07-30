import { feedbackApiError, feedbackText } from './i18n.js';

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
    if (!settingsUrl) {
        return;
    }

    button.disabled = true;
    button.classList.add('is-active');

    try {
        const settings = await fetchSettings(settingsUrl);
        const modal = renderSettingsModal(documentRef, settings);
        wireSettingsModal({
            modal,
            settingsUrl,
            documentRef,
            onClose() {
                button.disabled = false;
                button.classList.remove('is-active');
            }
        });
    } catch (error) {
        button.disabled = false;
        button.classList.remove('is-active');
        window.alert(error instanceof Error ? error.message : feedbackText('settings.loadFailed'));
    }
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

function renderSettingsModal(documentRef, settings) {
    const modal = documentRef.createElement('div');
    modal.className = 'contextual-feedback-settings-modal';
    modal.dataset.feedbackIgnore = 'true';
    modal.innerHTML = buildFeedbackSettingsHtml(settings);
    documentRef.body.append(modal);

    return modal;
}

function wireSettingsModal({ modal, settingsUrl, documentRef, onClose }) {
    const form = modal.querySelector('[data-feedback-settings-form]');
    const errorBox = modal.querySelector('[data-feedback-settings-error]');
    const statusBox = modal.querySelector('[data-feedback-settings-status]');
    const feedbackButton = documentRef.getElementById('contextualFeedbackButton');

    for (const closeButton of modal.querySelectorAll('[data-feedback-settings-close]')) {
        closeButton.addEventListener('click', close);
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        errorBox.textContent = '';
        statusBox.textContent = feedbackText('settings.saving');

        try {
            const nextSettings = await saveSettings(settingsUrl, buildSettingsPayload(form));
            statusBox.textContent = feedbackText('settings.saved');
            form.querySelector('[name="webhookUrl"]').value = '';
            form.querySelector('[name="originalDataWebhookUrl"]').value = '';
            form.querySelector('[data-webhook-configured]').textContent = configuredStatus(nextSettings.teamsWebhookConfigured);
            form.querySelector('[data-webhook-source]').textContent = nextSettings.teamsWebhookSource;
            form.querySelector('[data-original-data-webhook-configured]').textContent = configuredStatus(nextSettings.originalDataWebhookConfigured);
            form.querySelector('[data-original-data-webhook-source]').textContent = nextSettings.originalDataWebhookSource;
            if (feedbackButton) {
                feedbackButton.hidden = !nextSettings.feedbackEnabled;
            }
        } catch (error) {
            statusBox.textContent = '';
            errorBox.textContent = error instanceof Error ? error.message : feedbackText('settings.saveFailed');
        }
    });

    function close() {
        modal.remove();
        onClose?.();
    }
}

async function saveSettings(settingsUrl, payload) {
    const response = await fetch(settingsUrl, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
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
        imageTtlDays: Number(formData.get('imageTtlDays') || 30),
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
    const webhookPlaceholder = settings.teamsWebhookConfigured
        ? feedbackText('settings.keepWebhookPlaceholder')
        : feedbackText('settings.webhookPlaceholder');
    const originalWebhookPlaceholder = settings.originalDataWebhookConfigured
        ? feedbackText('settings.keepOriginalWebhookPlaceholder')
        : feedbackText('settings.originalWebhookPlaceholder');

    return `
        <div class="contextual-feedback-settings-panel" role="dialog" aria-modal="true" aria-labelledby="contextualFeedbackSettingsTitle">
            <header class="contextual-feedback-panel-header">
                <div>
                    <h2 id="contextualFeedbackSettingsTitle">${escapeHtml(feedbackText('settings.title'))}</h2>
                    <p>${escapeHtml(feedbackText('settings.subtitle'))}</p>
                </div>
                <button type="button" class="contextual-feedback-close" data-feedback-settings-close aria-label="${escapeHtml(feedbackText('dialog.close'))}">x</button>
            </header>
            <form class="contextual-feedback-settings-form" data-feedback-settings-form>
                <section>
                    <h3>${escapeHtml(feedbackText('settings.feedbackButton'))}</h3>
                    <label class="contextual-feedback-switch">
                        <input type="checkbox" name="feedbackEnabled"${settings.feedbackEnabled ? ' checked' : ''}>
                        <span>${escapeHtml(feedbackText('settings.enabled'))}</span>
                    </label>
                    <p>${escapeHtml(feedbackText('settings.allowedRoles', { roles: settings.allowedRoles.join(', ') }))}</p>
                </section>
                <section>
                    <h3>${escapeHtml(feedbackText('settings.teamsConnector'))}</h3>
                    <div class="contextual-feedback-settings-status-row">
                        <span>${escapeHtml(feedbackText('settings.status'))}</span>
                        <strong data-webhook-configured>${escapeHtml(configuredStatus(settings.teamsWebhookConfigured))}</strong>
                    </div>
                    <div class="contextual-feedback-settings-status-row">
                        <span>${escapeHtml(feedbackText('settings.source'))}</span>
                        <strong data-webhook-source>${escapeHtml(settings.teamsWebhookSource)}</strong>
                    </div>
                    <label>
                        <span>${escapeHtml(feedbackText('settings.webhookUrl'))}</span>
                        <input type="password" name="webhookUrl" autocomplete="off" placeholder="${escapeHtml(webhookPlaceholder)}">
                    </label>
                    <label class="contextual-feedback-switch">
                        <input type="checkbox" name="clearWebhookUrl">
                        <span>${escapeHtml(feedbackText('settings.clearWebhook'))}</span>
                    </label>
                    <h3>${escapeHtml(feedbackText('settings.originalWorkflow'))}</h3>
                    <div class="contextual-feedback-settings-status-row">
                        <span>${escapeHtml(feedbackText('settings.status'))}</span>
                        <strong data-original-data-webhook-configured>${escapeHtml(configuredStatus(settings.originalDataWebhookConfigured))}</strong>
                    </div>
                    <div class="contextual-feedback-settings-status-row">
                        <span>${escapeHtml(feedbackText('settings.source'))}</span>
                        <strong data-original-data-webhook-source>${escapeHtml(settings.originalDataWebhookSource)}</strong>
                    </div>
                    <label>
                        <span>${escapeHtml(feedbackText('settings.originalWebhookUrl'))}</span>
                        <input type="password" name="originalDataWebhookUrl" autocomplete="off" placeholder="${escapeHtml(originalWebhookPlaceholder)}">
                    </label>
                    <label class="contextual-feedback-switch">
                        <input type="checkbox" name="clearOriginalDataWebhookUrl">
                        <span>${escapeHtml(feedbackText('settings.clearOriginalWebhook'))}</span>
                    </label>
                    <label>
                        <span>${escapeHtml(feedbackText('settings.publicBaseUrl'))}</span>
                        <input type="url" name="publicBaseUrl" value="${escapeHtml(settings.publicBaseUrl)}" required>
                    </label>
                    <div class="contextual-feedback-form-row">
                        <label>
                            <span>${escapeHtml(feedbackText('settings.imageTtlDays'))}</span>
                            <input type="number" name="imageTtlDays" min="1" max="365" step="1" value="${Number(settings.imageTtlDays)}" required>
                        </label>
                        <label>
                            <span>${escapeHtml(feedbackText('settings.maxImageBytes'))}</span>
                            <input type="number" name="maxImageBytes" min="1" max="10485760" step="1" value="${Number(settings.maxImageBytes)}" required>
                        </label>
                    </div>
                </section>
                <div class="contextual-feedback-actions">
                    <button type="button" data-feedback-settings-close>${escapeHtml(feedbackText('settings.cancel'))}</button>
                    <button type="submit">${escapeHtml(feedbackText('settings.save'))}</button>
                </div>
                <p class="contextual-feedback-status" data-feedback-settings-status></p>
                <p class="contextual-feedback-error" data-feedback-settings-error></p>
            </form>
        </div>
    `;
}

function configuredStatus(isConfigured) {
    return isConfigured
        ? feedbackText('settings.configured')
        : feedbackText('settings.notConfigured');
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
