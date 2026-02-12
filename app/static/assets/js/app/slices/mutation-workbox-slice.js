import { getGlobalScope } from '../services.js';

const DEFAULT_API_ENDPOINTS = {
    mutationsApiUrl: '/api/v1/mutations'
};

const POLL_INTERVAL_MS = 15000;
let refreshTimerId = null;

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

function renderSummary(summary) {
    const summaryElement = document.getElementById('mutationWorkboxSummary');
    if (!summaryElement) {
        return;
    }

    if (!summary || typeof summary !== 'object') {
        summaryElement.textContent = 'Geen mutatiegegevens beschikbaar';
        return;
    }

    const pending = Number(summary.pending || 0);
    const failed = Number(summary.failed || 0);
    const delivered = Number(summary.delivered || 0);

    summaryElement.textContent = `Pending: ${pending} • Failed: ${failed} • Delivered: ${delivered}`;

    const customerStatusElement = document.getElementById('customerMutationStatus');
    if (!customerStatusElement) {
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
    const listElement = document.getElementById('mutationWorkboxList');
    if (!listElement) {
        return;
    }

    if (!Array.isArray(items) || items.length === 0) {
        listElement.innerHTML = '<p class="empty-state-small">Geen mutaties in werkbak</p>';
        return;
    }

    const rows = items.map((item) => {
        const id = String(item.id || '');
        const status = String(item.status || 'onbekend');
        const commandType = String(item.commandType || 'onbekend');
        const createdAt = item.createdAt ? new Date(item.createdAt).toLocaleString('nl-NL') : '-';
        const canRetry = status === 'failed' || status === 'cancelled';
        const canCancel = status === 'queued' || status === 'retry_scheduled' || status === 'dispatching';

        const errorText = item.lastErrorMessage
            ? `<div class="mutation-workbox-error">${String(item.lastErrorMessage)}</div>`
            : '';

        return `
            <div class="mutation-workbox-item">
                <div class="mutation-workbox-main">
                    <strong>${commandType}</strong>
                    <span class="mutation-workbox-status">${status}</span>
                </div>
                <div class="mutation-workbox-meta">${createdAt}</div>
                ${errorText}
                <div class="mutation-workbox-actions">
                    <button class="btn btn-small btn-secondary" type="button" data-action="mutations.refresh">Vernieuwen</button>
                    ${canRetry ? `<button class="btn btn-small" type="button" data-action="mutations.retry" data-arg-mutation-id="${id}">Retry</button>` : ''}
                    ${canCancel ? `<button class="btn btn-small btn-danger" type="button" data-action="mutations.cancel" data-arg-mutation-id="${id}">Annuleer</button>` : ''}
                </div>
            </div>
        `;
    });

    listElement.innerHTML = rows.join('');
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

function showToast(message, type = 'success') {
    const globalScope = getGlobalScope();
    if (globalScope && typeof globalScope.showToast === 'function') {
        globalScope.showToast(message, type);
    }
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
    await fetchWorkboxData();
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
    await fetchWorkboxData();
}

function startPolling() {
    if (refreshTimerId !== null) {
        return;
    }

    refreshTimerId = setInterval(() => {
        void fetchWorkboxData().catch((error) => {
            console.warn('Mutation workbox refresh failed', error);
        });
    }, POLL_INTERVAL_MS);
}

function exposeGlobals() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope.kiwiMutationWorkbox = {
        refresh: fetchWorkboxData,
    };
}

export function registerMutationWorkboxSlice(actionRouter) {
    exposeGlobals();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'mutations.refresh': () => {
            void fetchWorkboxData().catch((error) => {
                showToast(error.message || 'Mutaties verversen mislukt', 'error');
            });
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

    void fetchWorkboxData().catch(() => {
        // Fail silently if API is disabled or unavailable; other slices should keep working.
    });

    startPolling();
}
