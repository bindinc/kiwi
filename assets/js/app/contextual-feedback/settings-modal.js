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
        window.alert(error instanceof Error ? error.message : 'Could not load feedback settings.');
    }
}

async function fetchSettings(settingsUrl) {
    const response = await fetch(settingsUrl, {
        method: 'GET',
        credentials: 'same-origin'
    });
    const payload = await readJson(response);

    if (!response.ok) {
        throw new Error(payload?.error?.message || 'Could not load feedback settings.');
    }

    return payload;
}

function renderSettingsModal(documentRef, settings) {
    const modal = documentRef.createElement('div');
    modal.className = 'contextual-feedback-settings-modal';
    modal.dataset.feedbackIgnore = 'true';
    modal.innerHTML = settingsTemplate(settings);
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
        statusBox.textContent = 'Saving...';

        try {
            const nextSettings = await saveSettings(settingsUrl, buildSettingsPayload(form));
            statusBox.textContent = 'Saved.';
            form.querySelector('[name="webhookUrl"]').value = '';
            form.querySelector('[data-webhook-configured]').textContent = nextSettings.teamsWebhookConfigured ? 'Configured' : 'Not configured';
            form.querySelector('[data-webhook-source]').textContent = nextSettings.teamsWebhookSource;
            if (feedbackButton) {
                feedbackButton.hidden = !nextSettings.feedbackEnabled;
            }
        } catch (error) {
            statusBox.textContent = '';
            errorBox.textContent = error instanceof Error ? error.message : 'Could not save feedback settings.';
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
        throw new Error(responsePayload?.error?.message || 'Could not save feedback settings.');
    }

    return responsePayload;
}

function buildSettingsPayload(form) {
    const formData = new FormData(form);
    const webhookUrl = String(formData.get('webhookUrl') || '').trim();
    const payload = {
        feedbackEnabled: formData.get('feedbackEnabled') === 'on',
        publicBaseUrl: String(formData.get('publicBaseUrl') || '').trim(),
        imageTtlDays: Number(formData.get('imageTtlDays') || 30),
        maxImageBytes: Number(formData.get('maxImageBytes') || 3145728),
        clearWebhookUrl: formData.get('clearWebhookUrl') === 'on'
    };

    if (webhookUrl) {
        payload.webhookUrl = webhookUrl;
    }

    return payload;
}

function settingsTemplate(settings) {
    return `
        <div class="contextual-feedback-settings-panel" role="dialog" aria-modal="true" aria-labelledby="contextualFeedbackSettingsTitle">
            <header class="contextual-feedback-panel-header">
                <div>
                    <h2 id="contextualFeedbackSettingsTitle">Settings</h2>
                    <p>Contextual feedback and Microsoft Teams connector</p>
                </div>
                <button type="button" class="contextual-feedback-close" data-feedback-settings-close aria-label="Close">x</button>
            </header>
            <form class="contextual-feedback-settings-form" data-feedback-settings-form>
                <section>
                    <h3>Feedback button</h3>
                    <label class="contextual-feedback-switch">
                        <input type="checkbox" name="feedbackEnabled"${settings.feedbackEnabled ? ' checked' : ''}>
                        <span>Enabled for allowed Kiwi roles</span>
                    </label>
                    <p>Allowed roles: ${escapeHtml(settings.allowedRoles.join(', '))}</p>
                </section>
                <section>
                    <h3>Microsoft Teams connector</h3>
                    <div class="contextual-feedback-settings-status-row">
                        <span>Status</span>
                        <strong data-webhook-configured>${settings.teamsWebhookConfigured ? 'Configured' : 'Not configured'}</strong>
                    </div>
                    <div class="contextual-feedback-settings-status-row">
                        <span>Source</span>
                        <strong data-webhook-source>${escapeHtml(settings.teamsWebhookSource)}</strong>
                    </div>
                    <label>
                        <span>Webhook URL</span>
                        <input type="password" name="webhookUrl" autocomplete="off" placeholder="${settings.teamsWebhookConfigured ? 'Leave empty to keep existing webhook' : 'Paste Teams Workflows webhook URL'}">
                    </label>
                    <label class="contextual-feedback-switch">
                        <input type="checkbox" name="clearWebhookUrl">
                        <span>Clear stored webhook URL</span>
                    </label>
                    <label>
                        <span>Public base URL</span>
                        <input type="url" name="publicBaseUrl" value="${escapeHtml(settings.publicBaseUrl)}" required>
                    </label>
                    <div class="contextual-feedback-form-row">
                        <label>
                            <span>Image TTL days</span>
                            <input type="number" name="imageTtlDays" min="1" max="365" step="1" value="${Number(settings.imageTtlDays)}" required>
                        </label>
                        <label>
                            <span>Max image bytes</span>
                            <input type="number" name="maxImageBytes" min="1" max="10485760" step="1" value="${Number(settings.maxImageBytes)}" required>
                        </label>
                    </div>
                </section>
                <div class="contextual-feedback-actions">
                    <button type="button" data-feedback-settings-close>Cancel</button>
                    <button type="submit">Save</button>
                </div>
                <p class="contextual-feedback-status" data-feedback-settings-status></p>
                <p class="contextual-feedback-error" data-feedback-settings-error></p>
            </form>
        </div>
    `;
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
