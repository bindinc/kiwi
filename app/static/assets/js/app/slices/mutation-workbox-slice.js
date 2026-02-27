import { getGlobalScope } from '../services.js';

const DEFAULT_API_ENDPOINTS = {
    mutationsApiUrl: '/api/v1/mutations'
};

const POLL_INTERVAL_MS = 15000;
const PANEL_VISIBILITY_KEY = 'kiwi.mutations.workbox.visible';
const PERSONAL_INFO_KEYS = new Set([
    'firstName', 'middleName', 'lastName', 'email', 'phone',
    'address', 'postalCode', 'houseNumber', 'houseExt', 'city'
]);
const SUBSCRIPTION_KEYS = new Set([
    'magazine', 'duration', 'durationLabel', 'status', 'startDate'
]);
let refreshTimerId = null;
let refreshInFlightPromise = null;
let isWorkboxVisible = true;
let detailsModalListenerInstalled = false;

function getDocumentRef() {
    if (typeof document !== 'undefined') {
        return document;
    }

    const globalScope = getGlobalScope();
    return globalScope && globalScope.document ? globalScope.document : null;
}

function getElementById(elementId) {
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.getElementById !== 'function') {
        return null;
    }
    return documentRef.getElementById(elementId);
}

function translateMutation(key, params = {}, fallback = key) {
    const globalScope = getGlobalScope();
    if (!globalScope || !globalScope.i18n || typeof globalScope.i18n.t !== 'function') {
        return fallback;
    }

    const translatedValue = globalScope.i18n.t(key, params);
    if (translatedValue === undefined || translatedValue === null || translatedValue === key) {
        return fallback;
    }

    return translatedValue;
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatDateTime(rawValue) {
    if (!rawValue) {
        return '-';
    }

    const parsedDate = new Date(rawValue);
    if (Number.isNaN(parsedDate.getTime())) {
        return '-';
    }
    return parsedDate.toLocaleString('nl-NL');
}

function normalizeEmail(rawValue) {
    if (typeof rawValue !== 'string') {
        return '';
    }
    return rawValue.trim().toLowerCase();
}

function readAgentIdentityContext() {
    const documentRef = getDocumentRef();
    const rootDataset = documentRef && documentRef.documentElement
        ? documentRef.documentElement.dataset || {}
        : {};

    const globalScope = getGlobalScope();
    const agentTrigger = getElementById('agentProfileTrigger');
    const avatarImage = agentTrigger && typeof agentTrigger.querySelector === 'function'
        ? agentTrigger.querySelector('.agent-avatar img')
        : null;
    const avatarFallback = agentTrigger && typeof agentTrigger.querySelector === 'function'
        ? agentTrigger.querySelector('.agent-avatar span')
        : null;

    return {
        email: normalizeEmail(
            rootDataset.kiwiAgentEmail
            || (globalScope && globalScope.kiwiAgentEmail)
            || ''
        ),
        photoUrl: avatarImage && avatarImage.getAttribute
            ? String(avatarImage.getAttribute('src') || '').trim()
            : '',
        fallbackInitials: avatarFallback && typeof avatarFallback.textContent === 'string'
            ? avatarFallback.textContent.trim()
            : '',
    };
}

function buildInitials(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) {
        return '??';
    }

    const usernamePart = value.includes('@') ? value.split('@')[0] : value;
    const normalized = usernamePart
        .replaceAll('.', ' ')
        .replaceAll('_', ' ')
        .replaceAll('-', ' ')
        .trim();

    if (!normalized) {
        return value.slice(0, 2).toUpperCase();
    }

    const tokens = normalized.split(/\s+/).filter(Boolean);
    const initials = tokens.slice(0, 2).map((token) => token[0] || '').join('').toUpperCase();
    return initials || value.slice(0, 2).toUpperCase();
}

function formatActorLabel(createdByUser, currentAgentContext) {
    const normalizedCreatedBy = normalizeEmail(createdByUser);
    if (!normalizedCreatedBy) {
        return 'onbekend';
    }

    const usernamePart = normalizedCreatedBy.includes('@')
        ? normalizedCreatedBy.split('@')[0]
        : normalizedCreatedBy;
    return usernamePart || 'onbekend';
}

function renderActorAvatar(createdByUser, currentAgentContext) {
    const normalizedCreatedBy = normalizeEmail(createdByUser);
    const isCurrentAgent = Boolean(
        normalizedCreatedBy
        && currentAgentContext.email
        && normalizedCreatedBy === currentAgentContext.email
    );
    const hasCurrentPhoto = Boolean(isCurrentAgent && currentAgentContext.photoUrl);

    if (hasCurrentPhoto) {
        return `
            <span class="mutation-workbox-avatar" aria-hidden="true">
                <img class="mutation-workbox-avatar-image" src="${escapeHtml(currentAgentContext.photoUrl)}" alt="">
            </span>
        `;
    }

    const initials = buildInitials(createdByUser || currentAgentContext.fallbackInitials || '');
    return `
        <span class="mutation-workbox-avatar mutation-workbox-avatar-fallback" aria-hidden="true">${escapeHtml(initials)}</span>
    `;
}

function getRequestPayload(item) {
    if (!item || typeof item !== 'object') {
        return {};
    }

    const requestPayload = item.requestPayload;
    if (!requestPayload || typeof requestPayload !== 'object') {
        return {};
    }
    return requestPayload;
}

function getKnownCustomers() {
    const globalScope = getGlobalScope();
    const customers = globalScope ? globalScope.customers : null;
    return Array.isArray(customers) ? customers : [];
}

function findCustomerLastName(customerId) {
    const parsedCustomerId = Number(customerId);
    if (!Number.isFinite(parsedCustomerId)) {
        return '';
    }

    const customers = getKnownCustomers();
    const customer = customers.find((candidate) => Number(candidate.id) === parsedCustomerId);
    if (!customer) {
        return '';
    }

    return String(customer.lastName || '').trim();
}

function getLastNameFromRequestPayload(requestPayload) {
    if (!requestPayload || typeof requestPayload !== 'object') {
        return '';
    }

    const recipient = requestPayload.recipient && typeof requestPayload.recipient === 'object'
        ? requestPayload.recipient
        : null;
    if (!recipient) {
        return '';
    }

    const person = recipient.person && typeof recipient.person === 'object'
        ? recipient.person
        : null;
    if (!person) {
        return '';
    }

    return String(person.lastName || '').trim();
}

function resolveCustomerLastName(item) {
    const fromCache = findCustomerLastName(item.customerId);
    if (fromCache) {
        return fromCache;
    }

    const requestPayload = getRequestPayload(item);
    const fromPayload = getLastNameFromRequestPayload(requestPayload);
    if (fromPayload) {
        return fromPayload;
    }

    return 'Klant';
}

function resolveActionAndSubject(item) {
    const commandType = String(item.commandType || '');
    const requestPayload = getRequestPayload(item);

    if (commandType === 'subscription.signup') {
        const hasWerfsleutel = Boolean(requestPayload.subscription && requestPayload.subscription.werfsleutel);
        return {
            action: 'aangemeld',
            subject: hasWerfsleutel ? 'werfsleutel' : 'abonnement',
        };
    }

    if (commandType === 'subscription.update') {
        const payloadKeys = Object.keys(requestPayload);
        const changedPersonalInfo = payloadKeys.some((key) => PERSONAL_INFO_KEYS.has(key));
        const changedSubscription = payloadKeys.some((key) => SUBSCRIPTION_KEYS.has(key));

        if (changedPersonalInfo) {
            return { action: 'gewijzigd', subject: 'persoonsgegevens' };
        }
        if (changedSubscription) {
            return { action: 'gewijzigd', subject: 'abonnement' };
        }
        return { action: 'gewijzigd', subject: 'gegevens' };
    }

    if (commandType === 'subscription.cancel') {
        const result = String(requestPayload.result || '').trim().toLowerCase();
        if (result === 'accepted') {
            return { action: 'behouden', subject: 'winback' };
        }
        return { action: 'gestopt', subject: 'abonnement' };
    }

    if (commandType === 'subscription.deceased_actions') {
        const actions = Array.isArray(requestPayload.actions) ? requestPayload.actions : [];
        const actionKinds = new Set(
            actions
                .map((actionItem) => String(actionItem && actionItem.action ? actionItem.action : '').trim().toLowerCase())
                .filter(Boolean)
        );

        if (actionKinds.size === 1 && actionKinds.has('transfer')) {
            return { action: 'afgehandeld', subject: 'overzetting' };
        }
        if (actionKinds.size === 1 && (actionKinds.has('restitution') || actionKinds.has('cancel'))) {
            return { action: 'afgehandeld', subject: 'opzegging' };
        }
        return { action: 'afgehandeld', subject: 'overlijdensmutatie' };
    }

    return { action: 'verwerkt', subject: 'mutatie' };
}

function buildMutationLabel(item) {
    const lastName = resolveCustomerLastName(item);
    const parts = resolveActionAndSubject(item);
    return `${lastName} ${parts.action} ${parts.subject}`.trim();
}

function getApiClient() {
    const globalScope = getGlobalScope();
    if (!globalScope || !globalScope.kiwiApi) {
        return null;
    }
    return globalScope.kiwiApi;
}

function getApiEndpoints() {
    const globalScope = getGlobalScope();
    const bootstrapSlice = globalScope ? globalScope.kiwiBootstrapSlice : null;
    if (!bootstrapSlice || typeof bootstrapSlice.getApiEndpoints !== 'function') {
        return { ...DEFAULT_API_ENDPOINTS };
    }

    return {
        ...DEFAULT_API_ENDPOINTS,
        ...(bootstrapSlice.getApiEndpoints() || {})
    };
}

function getCurrentCustomerId() {
    const globalScope = getGlobalScope();
    const bridge = globalScope && globalScope.kiwiLegacyCustomerSearchBridge;
    if (!bridge || typeof bridge.getCurrentCustomer !== 'function') {
        return null;
    }

    const customer = bridge.getCurrentCustomer();
    if (!customer || customer.id === undefined || customer.id === null) {
        return null;
    }

    const parsed = Number(customer.id);
    if (Number.isFinite(parsed)) {
        return parsed;
    }
    return null;
}

function readPanelVisibilityPreference() {
    const globalScope = getGlobalScope();
    const storage = globalScope && globalScope.localStorage;
    if (!storage || typeof storage.getItem !== 'function') {
        return true;
    }

    try {
        const rawValue = storage.getItem(PANEL_VISIBILITY_KEY);
        if (rawValue === 'hidden') {
            return false;
        }
        if (rawValue === 'visible') {
            return true;
        }
    } catch (_error) {
        // Ignore read errors and fall back to visible.
    }

    return true;
}

function persistPanelVisibilityPreference(isVisible) {
    const globalScope = getGlobalScope();
    const storage = globalScope && globalScope.localStorage;
    if (!storage || typeof storage.setItem !== 'function') {
        return;
    }

    try {
        storage.setItem(PANEL_VISIBILITY_KEY, isVisible ? 'visible' : 'hidden');
    } catch (_error) {
        // Ignore write errors and keep runtime state only.
    }
}

function setPanelVisibility(nextVisible, { persistPreference = true } = {}) {
    isWorkboxVisible = Boolean(nextVisible);

    const workboxPanel = getElementById('mutationWorkboxPanel');
    if (workboxPanel && workboxPanel.style) {
        workboxPanel.hidden = !isWorkboxVisible;
        workboxPanel.style.display = isWorkboxVisible ? '' : 'none';
    }

    const toggleButton = getElementById('mutationWorkboxToggle');
    if (toggleButton) {
        toggleButton.setAttribute('aria-expanded', String(isWorkboxVisible));
        if (toggleButton.classList && typeof toggleButton.classList.toggle === 'function') {
            toggleButton.classList.toggle('is-active', isWorkboxVisible);
        }
    }

    if (persistPreference) {
        persistPanelVisibilityPreference(isWorkboxVisible);
    }
}

function setToggleBadge(pendingCount, failedCount) {
    const badgeElement = getElementById('mutationWorkboxToggleCount');
    if (!badgeElement || !badgeElement.style) {
        return;
    }

    const outstanding = Number(pendingCount || 0) + Number(failedCount || 0);
    if (outstanding > 0) {
        badgeElement.textContent = String(outstanding);
        badgeElement.style.display = 'inline-flex';
        return;
    }

    badgeElement.textContent = '';
    badgeElement.style.display = 'none';
}

function renderSummary(summary) {
    const summaryElement = getElementById('mutationWorkboxSummary');
    if (!summaryElement) {
        return;
    }

    if (!summary || typeof summary !== 'object') {
        summaryElement.textContent = 'Geen mutatiegegevens beschikbaar';
        setToggleBadge(0, 0);
        return;
    }

    const pending = Number(summary.pending || 0);
    const failed = Number(summary.failed || 0);
    const delivered = Number(summary.delivered || 0);

    summaryElement.textContent = `Pending: ${pending} • Failed: ${failed} • Delivered: ${delivered}`;
    setToggleBadge(pending, failed);

    const customerStatusElement = getElementById('customerMutationStatus');
    if (!customerStatusElement || !customerStatusElement.style) {
        return;
    }

    if (pending > 0 || failed > 0) {
        customerStatusElement.textContent = `Mutaties: ${pending} pending, ${failed} failed`;
        customerStatusElement.style.display = 'inline';
    } else {
        customerStatusElement.textContent = '';
        customerStatusElement.style.display = 'none';
    }
}

function renderItems(items) {
    const listElement = getElementById('mutationWorkboxList');
    if (!listElement) {
        return;
    }

    if (!Array.isArray(items) || items.length === 0) {
        listElement.innerHTML = '<p class="empty-state-small">Geen mutaties in werkbak</p>';
        return;
    }

    const currentAgentContext = readAgentIdentityContext();
    const rows = items.map((item) => {
        const mutationId = String(item.id || '');
        const status = String(item.status || 'onbekend');
        const mutationLabel = buildMutationLabel(item);
        const createdAt = formatDateTime(item.createdAt);
        const actorLabel = formatActorLabel(item.createdByUser, currentAgentContext);
        const actorAvatar = renderActorAvatar(item.createdByUser, currentAgentContext);
        const canRetry = status === 'failed' || status === 'cancelled';
        const canCancel = status === 'queued' || status === 'retry_scheduled' || status === 'dispatching';

        const errorText = item.lastErrorMessage
            ? `<div class="mutation-workbox-error">${escapeHtml(String(item.lastErrorMessage))}</div>`
            : '';

        const detailsButton = mutationId
            ? `<button class="btn btn-small btn-secondary" type="button" data-action="mutations.details" data-arg-mutation-id="${escapeHtml(mutationId)}">Details</button>`
            : '';
        const retryButton = canRetry
            ? `<button class="btn btn-small" type="button" data-action="mutations.retry" data-arg-mutation-id="${escapeHtml(mutationId)}">Retry</button>`
            : '';
        const cancelButton = canCancel
            ? `<button class="btn btn-small btn-danger" type="button" data-action="mutations.cancel" data-arg-mutation-id="${escapeHtml(mutationId)}">Annuleer</button>`
            : '';

        return `
            <div class="mutation-workbox-item">
                <div class="mutation-workbox-main">
                    <div class="mutation-workbox-title">
                        ${actorAvatar}
                        <strong class="mutation-workbox-description">${escapeHtml(mutationLabel)}</strong>
                    </div>
                    <span class="mutation-workbox-status">${escapeHtml(status)}</span>
                </div>
                <div class="mutation-workbox-meta">${escapeHtml(createdAt)} • door ${escapeHtml(actorLabel)}</div>
                ${errorText}
                <div class="mutation-workbox-actions">
                    ${detailsButton}
                    ${retryButton}
                    ${cancelButton}
                </div>
            </div>
        `;
    });

    listElement.innerHTML = rows.join('');
}

function renderDetailsEvents(events) {
    const eventsElement = getElementById('mutationDetailsEvents');
    if (!eventsElement) {
        return;
    }

    if (!Array.isArray(events) || events.length === 0) {
        eventsElement.innerHTML = `<p class="empty-state-small">${escapeHtml(
            translateMutation('mutationWorkbox.detailsModal.emptyHistory', {}, 'Geen eventgeschiedenis beschikbaar')
        )}</p>`;
        return;
    }

    const rows = events.map((event) => {
        const eventType = escapeHtml(
            event.eventType || translateMutation('mutationWorkbox.detailsModal.unknown', {}, 'onbekend')
        );
        const createdAt = escapeHtml(formatDateTime(event.createdAt));
        const previousStatus = event.previousStatus ? escapeHtml(event.previousStatus) : '-';
        const nextStatus = event.nextStatus ? escapeHtml(event.nextStatus) : '-';
        const attemptCount = Number.isFinite(Number(event.attemptCount)) ? Number(event.attemptCount) : '-';

        const errorParts = [];
        if (event.errorCode) {
            errorParts.push(
                translateMutation('mutationWorkbox.detailsModal.errorCode', { value: event.errorCode }, `code: ${event.errorCode}`)
            );
        }
        if (event.errorMessage) {
            errorParts.push(
                translateMutation('mutationWorkbox.detailsModal.errorMessage', { value: event.errorMessage }, `melding: ${event.errorMessage}`)
            );
        }
        const errorBlock = errorParts.length > 0
            ? `<div class="mutation-details-event-error">${escapeHtml(errorParts.join(' • '))}</div>`
            : '';

        let metadataBlock = '';
        if (event.metadata && typeof event.metadata === 'object' && Object.keys(event.metadata).length > 0) {
            metadataBlock = `<div class="mutation-details-event-metadata">${escapeHtml(JSON.stringify(event.metadata, null, 2))}</div>`;
        }

        return `
            <div class="mutation-details-event">
                <div class="mutation-details-event-main">
                    <span class="mutation-details-event-name">${eventType}</span>
                    <span class="mutation-details-event-date">${createdAt}</span>
                </div>
                <div class="mutation-details-event-meta">${escapeHtml(
                    translateMutation(
                        'mutationWorkbox.detailsModal.statusTransition',
                        { from: previousStatus, to: nextStatus, attempt: attemptCount },
                        `Status: ${previousStatus} → ${nextStatus} • Poging: ${attemptCount}`
                    )
                )}</div>
                ${errorBlock}
                ${metadataBlock}
            </div>
        `;
    });

    eventsElement.innerHTML = rows.join('');
}

function renderMutationDetails(details) {
    const detailPayload = details && typeof details === 'object' ? details : {};

    const summaryLines = [];
    if (detailPayload.failureClass) {
        summaryLines.push(
            translateMutation(
                'mutationWorkbox.detailsModal.failureClass',
                { value: detailPayload.failureClass },
                `Failure class: ${detailPayload.failureClass}`
            )
        );
    }
    if (detailPayload.lastHttpStatus) {
        summaryLines.push(
            translateMutation(
                'mutationWorkbox.detailsModal.httpStatus',
                { value: detailPayload.lastHttpStatus },
                `HTTP status: ${detailPayload.lastHttpStatus}`
            )
        );
    }

    const summaryElement = getElementById('mutationDetailsSummary');
    if (summaryElement) {
        summaryElement.textContent = summaryLines.length > 0
            ? summaryLines.join(' • ')
            : translateMutation(
                'mutationWorkbox.detailsModal.noActiveFailure',
                {},
                'Geen actieve foutstatus op deze mutatie.'
            );
    }

    const fieldMap = {
        mutationDetailsId: detailPayload.id || '-',
        mutationDetailsCommandType: detailPayload.commandType || '-',
        mutationDetailsStatus: detailPayload.status || '-',
        mutationDetailsAttempts: `${Number(detailPayload.attemptCount || 0)} / ${Number(detailPayload.maxAttempts || 0) || '-'}`,
        mutationDetailsNextAttempt: formatDateTime(detailPayload.nextAttemptAt),
        mutationDetailsLastError: detailPayload.lastErrorMessage || detailPayload.lastErrorCode || '-',
    };

    Object.entries(fieldMap).forEach(([elementId, value]) => {
        const element = getElementById(elementId);
        if (element) {
            element.textContent = String(value);
        }
    });

    const requestElement = getElementById('mutationDetailsRequest');
    if (requestElement) {
        const requestPayload = detailPayload.requestPayload && typeof detailPayload.requestPayload === 'object'
            ? detailPayload.requestPayload
            : null;
        const requestOverview = {
            customerId: detailPayload.customerId ?? null,
            subscriptionId: detailPayload.subscriptionId ?? null,
            request: requestPayload || {},
        };

        const hasRequestContent = (requestOverview.customerId !== null)
            || (requestOverview.subscriptionId !== null)
            || Object.keys(requestOverview.request).length > 0;
        requestElement.textContent = hasRequestContent
            ? JSON.stringify(requestOverview, null, 2)
            : translateMutation('mutationWorkbox.detailsModal.emptyRequest', {}, 'Geen request details beschikbaar');
    }

    renderDetailsEvents(detailPayload.events);
}

function openDetailsModal() {
    const modal = getElementById('mutationDetailsModal');
    if (!modal || !modal.style) {
        return;
    }

    modal.style.display = 'flex';
    if (modal.classList && typeof modal.classList.add === 'function') {
        modal.classList.add('show');
    }
    if (typeof modal.setAttribute === 'function') {
        modal.setAttribute('aria-hidden', 'false');
    }
}

function closeDetailsModal() {
    const modal = getElementById('mutationDetailsModal');
    if (!modal || !modal.style) {
        return;
    }

    modal.style.display = 'none';
    if (modal.classList && typeof modal.classList.remove === 'function') {
        modal.classList.remove('show');
    }
    if (typeof modal.setAttribute === 'function') {
        modal.setAttribute('aria-hidden', 'true');
    }
}

function installDetailsModalBackdropClose() {
    if (detailsModalListenerInstalled) {
        return;
    }

    const modal = getElementById('mutationDetailsModal');
    if (!modal || typeof modal.addEventListener !== 'function') {
        return;
    }

    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeDetailsModal();
        }
    });
    detailsModalListenerInstalled = true;
}

async function fetchWorkboxData() {
    const apiClient = getApiClient();
    if (!apiClient || typeof apiClient.get !== 'function') {
        return;
    }

    const { mutationsApiUrl } = getApiEndpoints();
    const customerId = getCurrentCustomerId();
    const summaryQuery = customerId === null ? '' : `?customerId=${customerId}`;
    const listQuery = customerId === null ? '?limit=15' : `?customerId=${customerId}&limit=15`;

    const [summaryPayload, listPayload] = await Promise.all([
        apiClient.get(`${mutationsApiUrl}/summary${summaryQuery}`),
        apiClient.get(`${mutationsApiUrl}${listQuery}`)
    ]);

    renderSummary(summaryPayload && summaryPayload.summary ? summaryPayload.summary : null);
    renderItems(listPayload && Array.isArray(listPayload.items) ? listPayload.items : []);
}

function requestRefresh() {
    if (refreshInFlightPromise) {
        return refreshInFlightPromise;
    }

    refreshInFlightPromise = fetchWorkboxData()
        .catch((error) => {
            console.warn('Mutation workbox refresh failed', error);
            throw error;
        })
        .finally(() => {
            refreshInFlightPromise = null;
        });

    return refreshInFlightPromise;
}

function showToast(message, type = 'success') {
    const globalScope = getGlobalScope();
    if (globalScope && typeof globalScope.showToast === 'function') {
        globalScope.showToast(message, type);
    }
}

async function fetchMutationDetails(mutationId) {
    const apiClient = getApiClient();
    if (!apiClient || typeof apiClient.get !== 'function') {
        return;
    }

    if (!mutationId) {
        return;
    }

    const { mutationsApiUrl } = getApiEndpoints();
    const payload = await apiClient.get(`${mutationsApiUrl}/${mutationId}`);
    renderMutationDetails(payload);
    openDetailsModal();
}

async function retryMutation(mutationId) {
    const apiClient = getApiClient();
    if (!apiClient || typeof apiClient.post !== 'function') {
        return;
    }

    if (!mutationId) {
        return;
    }

    const { mutationsApiUrl } = getApiEndpoints();
    await apiClient.post(`${mutationsApiUrl}/${mutationId}/retry`, {});
    showToast('Mutatie opnieuw ingepland', 'success');
    await requestRefresh();
}

async function cancelMutation(mutationId) {
    const apiClient = getApiClient();
    if (!apiClient || typeof apiClient.post !== 'function') {
        return;
    }

    if (!mutationId) {
        return;
    }

    const { mutationsApiUrl } = getApiEndpoints();
    await apiClient.post(`${mutationsApiUrl}/${mutationId}/cancel`, {});
    showToast('Mutatie geannuleerd', 'info');
    await requestRefresh();
}

function startPolling() {
    if (refreshTimerId !== null) {
        return;
    }

    refreshTimerId = setInterval(() => {
        void requestRefresh().catch(() => {
            // poll errors are handled in requestRefresh, keep polling alive
        });
    }, POLL_INTERVAL_MS);
}

function exposeGlobals() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope.kiwiMutationWorkbox = {
        refresh: requestRefresh,
        togglePanel: () => setPanelVisibility(!isWorkboxVisible),
        openDetails: fetchMutationDetails,
    };
}

export function registerMutationWorkboxSlice(actionRouter) {
    exposeGlobals();
    setPanelVisibility(readPanelVisibilityPreference(), { persistPreference: false });
    installDetailsModalBackdropClose();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'mutations.toggle-panel': () => {
            setPanelVisibility(!isWorkboxVisible);
        },
        'mutations.refresh': () => {
            void requestRefresh().catch((error) => {
                showToast(error.message || 'Mutaties verversen mislukt', 'error');
            });
        },
        'mutations.details': (payload = {}) => {
            void fetchMutationDetails(payload.mutationId).catch((error) => {
                showToast(error.message || 'Mutatie details laden mislukt', 'error');
            });
        },
        'mutations.close-details': () => {
            closeDetailsModal();
        },
        'mutations.retry': (payload = {}) => {
            void retryMutation(payload.mutationId).catch((error) => {
                showToast(error.message || 'Mutatie retry mislukt', 'error');
            });
        },
        'mutations.cancel': (payload = {}) => {
            void cancelMutation(payload.mutationId).catch((error) => {
                showToast(error.message || 'Mutatie annuleren mislukt', 'error');
            });
        }
    });

    void requestRefresh().catch(() => {
        // Fail silently if API is disabled or unavailable; other slices should keep working.
    });

    startPolling();
}
