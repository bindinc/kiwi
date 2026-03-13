// State and utility functions previously in app.js.
// Exposed as window globals so classic runtime scripts
// (call-agent-runtime.js, subscription-role-runtime.js) can access them
// at call time without import statements.

import { getGlobalScope } from './services.js';

// ---------------------------------------------------------------------------
// Mutable state — wrapped in an object so we can expose via
// Object.defineProperty with get/set on the global scope.
// ---------------------------------------------------------------------------

const state = {
    customers: [],
    currentCustomer: null,
    selectedOffer: null,
    searchState: {
        results: [],
        currentPage: 1,
        itemsPerPage: 20,
        sortBy: 'name',
        sortOrder: 'asc'
    },
    contactHistoryState: {
        currentPage: 1,
        itemsPerPage: 6,
        highlightId: null,
        lastEntry: null
    },
    bootstrapState: null,
    callSession: {
        active: false,
        callerType: 'anonymous',
        customerId: null,
        customerName: null,
        serviceNumber: null,
        waitTime: 0,
        startTime: null,
        pendingIdentification: null,
        durationInterval: null,
        recordingActive: false,
        totalHoldTime: 0,
        holdStartTime: null,
        onHold: false
    },
    lastCallSession: null,
    agentStatus: {
        current: 'ready',
        preferred: 'ready',
        statusBeforeCall: null,
        canReceiveCalls: true,
        sessionStartTime: Date.now(),
        callsHandled: 0,
        sessionTimerInterval: null,
        acwStartTime: null,
        breakStartTime: null,
        acwInterval: null
    },
    callQueue: {
        enabled: false,
        queue: [],
        currentPosition: 0,
        autoAdvance: true,
        waitTimeInterval: null
    },
    serviceNumbers: {},
    teamsSyncNoticeShown: false
};

// ---------------------------------------------------------------------------
// Constants used by runtime scripts
// ---------------------------------------------------------------------------

const agentStatusLabelConfig = {
    ready: { key: 'agentStatus.ready', fallback: 'Beschikbaar' },
    in_call: { key: 'agentStatus.in_call', fallback: 'In gesprek' },
    busy: { key: 'agentStatus.busy', fallback: 'Bezet' },
    dnd: { key: 'agentStatus.dnd', fallback: 'Niet storen' },
    brb: { key: 'agentStatus.brb', fallback: 'Ben zo terug' },
    away: { key: 'agentStatus.away', fallback: 'Als afwezig weergeven' },
    offline: { key: 'agentStatus.offline', fallback: 'Offline' },
    acw: { key: 'agentStatus.acw', fallback: 'Nabewerkingstijd' }
};

const agentStatuses = {
    ready: { label: '', color: '#4ade80', badge: '✓', textColor: '#052e16' },
    in_call: { label: '', color: '#ef4444', badge: '●', textColor: '#7f1d1d' },
    busy: { label: '', color: '#ef4444', badge: '●', textColor: '#7f1d1d' },
    dnd: { label: '', color: '#dc2626', badge: '⛔', textColor: '#7f1d1d' },
    brb: { label: '', color: '#f59e0b', badge: '↺', textColor: '#78350f' },
    away: { label: '', color: '#fbbf24', badge: '◔', textColor: '#713f12' },
    offline: { label: '', color: '#9ca3af', badge: '−', textColor: '#111827' },
    acw: { label: '', color: '#facc15', badge: '~', textColor: '#422006' }
};

const agentStatusAliases = { break: 'away' };
const transientAgentStatuses = new Set(['in_call']);

const subscriptionRoleState = {
    recipient: { mode: 'existing', selectedPerson: null, searchResults: [] },
    requester: { mode: 'existing', selectedPerson: null, searchResults: [] },
    requesterSameAsRecipient: true
};

function createSubscriptionDuplicateRoleState() {
    return {
        debounceTimer: null,
        requestVersion: 0,
        lastApiStartedAt: 0,
        lastApiFingerprint: '',
        lastFingerprint: 'none',
        acknowledgedFingerprint: '',
        expandedFingerprint: '',
        isExpanded: false,
        isChecking: false,
        apiWarning: '',
        cache: {},
        resolvedFingerprints: {},
        strongMatches: []
    };
}

const subscriptionDuplicateState = {
    recipient: createSubscriptionDuplicateRoleState(),
    requester: createSubscriptionDuplicateRoleState()
};

const recordingConfig = { enabled: true, requireConsent: true, autoStart: true };
const ACW_DEFAULT_DURATION = 120;

const DUPLICATE_CHECK_DEBOUNCE_MS = 750;
const DUPLICATE_CHECK_MIN_API_INTERVAL_MS = 1500;
const DUPLICATE_CHECK_CACHE_TTL_MS = 90 * 1000;
const DUPLICATE_CHECK_FETCH_LIMIT = 5;
const DUPLICATE_CHECK_VISIBLE_LIMIT = 3;
const SUBSCRIPTION_DUPLICATE_INPUT_FIELDS = [
    'Initials', 'MiddleName', 'LastName', 'PostalCode',
    'HouseNumber', 'HouseExt', 'Address', 'City', 'Email', 'Phone'
];

// ---------------------------------------------------------------------------
// API endpoints (hardcoded — bootstrap-slice owns the canonical set)
// ---------------------------------------------------------------------------

const bootstrapApiUrl = '/api/v1/bootstrap';
const offersApiUrl = '/api/v1/catalog/offers';
const personsStateApiUrl = '/api/v1/persons/state';
const personsApiUrl = '/api/v1/persons';
const subscriptionsApiUrl = '/api/v1/subscriptions';
const workflowsApiUrl = '/api/v1/workflows';
const callQueueApiUrl = '/api/v1/call-queue';
const callSessionApiUrl = '/api/v1/call-session';
const debugResetApiUrl = '/api/v1/debug/reset-poc-state';
const agentStatusApiUrl = '/api/v1/agent-status';

// ---------------------------------------------------------------------------
// Subscription pricing helpers (fallback; module helpers take precedence)
// ---------------------------------------------------------------------------

const APP_SUBSCRIPTION_HELPERS_NAMESPACE = 'kiwiSubscriptionIdentityPricingHelpers';

const fallbackSubscriptionHelpers = (() => {
    const pricingTable = {
        '1-jaar': { price: 52.00, perMonth: 4.33, description: '1 jaar - Jaarlijks betaald' },
        '2-jaar': { price: 98.00, perMonth: 4.08, description: '2 jaar - Jaarlijks betaald (5% korting)' },
        '3-jaar': { price: 140.00, perMonth: 3.89, description: '3 jaar - Jaarlijks betaald (10% korting)' },
        '1-jaar-maandelijks': { price: 54.00, perMonth: 4.50, description: '1 jaar - Maandelijks betaald' },
        '2-jaar-maandelijks': { price: 104.40, perMonth: 4.35, description: '2 jaar - Maandelijks betaald' },
        '3-jaar-maandelijks': { price: 151.20, perMonth: 4.20, description: '3 jaar - Maandelijks betaald' }
    };
    const euroFormattersByLocale = {};

    function resolveLocale(locale) {
        return (typeof locale === 'string' && locale.trim()) ? locale : 'nl-NL';
    }

    function getEuroFormatter(locale) {
        const resolvedLocale = resolveLocale(locale);
        if (!euroFormattersByLocale[resolvedLocale]) {
            euroFormattersByLocale[resolvedLocale] = new Intl.NumberFormat(resolvedLocale, {
                style: 'currency', currency: 'EUR', minimumFractionDigits: 2
            });
        }
        return euroFormattersByLocale[resolvedLocale];
    }

    function formatEuro(amount, options = {}) {
        const numericValue = Number(amount);
        const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
        return getEuroFormatter(options.locale).format(safeValue);
    }

    function getPricingDisplay(duration) {
        const pricing = pricingTable[duration];
        return pricing ? `€${pricing.perMonth.toFixed(2)}/maand (${pricing.description})` : '';
    }

    function getSubscriptionDurationDisplay(subscription) {
        if (!subscription) return 'Oude prijsstructuur';
        if (subscription.duration && pricingTable[subscription.duration]) {
            return getPricingDisplay(subscription.duration);
        }
        if (subscription.durationLabel) return subscription.durationLabel;
        if (subscription.duration) return subscription.duration;
        return 'Oude prijsstructuur';
    }

    return { subscriptionPricing: pricingTable, formatEuro, getSubscriptionDurationDisplay };
})();

function getSubscriptionHelpers() {
    const globalScope = getGlobalScope();
    if (!globalScope) return fallbackSubscriptionHelpers;

    const helperNamespace = globalScope[APP_SUBSCRIPTION_HELPERS_NAMESPACE];
    if (!helperNamespace || typeof helperNamespace !== 'object') return fallbackSubscriptionHelpers;

    const hasPricingTable = helperNamespace.subscriptionPricing && typeof helperNamespace.subscriptionPricing === 'object';
    const hasFormatHelper = typeof helperNamespace.formatEuro === 'function';
    const hasDurationHelper = typeof helperNamespace.getSubscriptionDurationDisplay === 'function';
    if (!hasPricingTable || !hasFormatHelper || !hasDurationHelper) return fallbackSubscriptionHelpers;

    return helperNamespace;
}

// Resolve lazily — subscription helpers are installed by the module system
// before runtime scripts call any function that reads these.
let subscriptionHelpers = null;
let subscriptionPricing = null;
let formatEuro = null;
let getSubscriptionDurationDisplay = null;

function ensureSubscriptionHelpersResolved() {
    if (subscriptionHelpers) return;
    subscriptionHelpers = getSubscriptionHelpers();
    subscriptionPricing = subscriptionHelpers.subscriptionPricing;

    const globalScope = getGlobalScope();
    const getDateLocale = (globalScope && typeof globalScope.getDateLocaleForApp === 'function')
        ? globalScope.getDateLocaleForApp
        : () => 'nl-NL';

    formatEuro = (amount) => subscriptionHelpers.formatEuro(amount, { locale: getDateLocale() });
    getSubscriptionDurationDisplay = (sub) => subscriptionHelpers.getSubscriptionDurationDisplay(sub);
}

// ---------------------------------------------------------------------------
// Slice infrastructure (call-time resolution via window)
// ---------------------------------------------------------------------------

const CUSTOMER_DETAIL_SLICE_NAMESPACE = 'kiwiCustomerDetailSlice';
const CONTACT_HISTORY_SLICE_NAMESPACE = 'kiwiContactHistorySlice';
const ORDER_SLICE_NAMESPACE = 'kiwiOrderSlice';
const DELIVERY_REMARKS_SLICE_NAMESPACE = 'kiwiDeliveryRemarksSlice';
const APP_SHELL_SLICE_NAMESPACE = 'kiwiAppShellSlice';

function getSliceApi(namespace) {
    const globalScope = getGlobalScope();
    if (!globalScope) return null;
    const sliceApi = globalScope[namespace];
    return (sliceApi && typeof sliceApi === 'object') ? sliceApi : null;
}

function invokeSliceMethod(namespace, methodName, args = []) {
    const sliceApi = getSliceApi(namespace);
    if (!sliceApi) return undefined;
    const handler = sliceApi[methodName];
    return typeof handler === 'function' ? handler(...args) : undefined;
}

function invokeSliceMethodAsync(namespace, methodName, args = []) {
    return Promise.resolve(invokeSliceMethod(namespace, methodName, args));
}

// ---------------------------------------------------------------------------
// Werfsleutel helpers (delegating to werfsleutel slice)
// ---------------------------------------------------------------------------

function getWerfsleutelSliceApi() {
    const globalScope = getGlobalScope();
    if (!globalScope) return null;
    const sliceApi = globalScope.kiwiWerfsleutelSlice;
    return (sliceApi && typeof sliceApi === 'object') ? sliceApi : null;
}

function syncWerfsleutelCatalogMetadataIntoSlice(options = {}) {
    const api = getWerfsleutelSliceApi();
    if (!api || typeof api.setCatalogMetadata !== 'function') return;
    const channels = (options.channels && typeof options.channels === 'object') ? options.channels : {};
    const catalog = Array.isArray(options.catalog) ? options.catalog : undefined;
    api.setCatalogMetadata({ channels, catalog });
}

function getSelectedWerfsleutelState() {
    const api = getWerfsleutelSliceApi();
    if (!api || typeof api.getSelection !== 'function') {
        return { selectedKey: null, selectedChannel: null, selectedChannelMeta: null };
    }
    const s = api.getSelection();
    return {
        selectedKey: s?.selectedKey || null,
        selectedChannel: s?.selectedChannel || null,
        selectedChannelMeta: s?.selectedChannelMeta || null
    };
}

function getWerfsleutelOfferDetailsFromActiveSlice(selectedWerfsleutelKey) {
    const api = getWerfsleutelSliceApi();
    if (!api || typeof api.getOfferDetails !== 'function') {
        return { magazine: '', durationKey: '', durationLabel: '' };
    }
    const d = api.getOfferDetails(selectedWerfsleutelKey);
    return {
        magazine: d?.magazine || '',
        durationKey: d?.durationKey || '',
        durationLabel: d?.durationLabel || ''
    };
}

async function initWerfsleutelPicker() {
    const api = getWerfsleutelSliceApi();
    if (api && typeof api.initializePicker === 'function') {
        await api.initializePicker();
    }
}

function resetWerfsleutelPicker() {
    const api = getWerfsleutelSliceApi();
    if (api && typeof api.resetPicker === 'function') api.resetPicker();
}

function triggerWerfsleutelBackgroundRefreshIfStale() {
    const api = getWerfsleutelSliceApi();
    if (api && typeof api.refreshCatalogIfStale === 'function') api.refreshCatalogIfStale();
}

// ---------------------------------------------------------------------------
// Bootstrap helpers (resolve bootstrap-slice lazily via window)
// ---------------------------------------------------------------------------

function resolveBootstrapSlice() {
    const globalScope = getGlobalScope();
    return (globalScope && globalScope.kiwiBootstrapSlice) ? globalScope.kiwiBootstrapSlice : null;
}

function upsertCustomerInCache(customer) {
    const bs = resolveBootstrapSlice();
    if (!bs || typeof bs.upsertCustomerInCache !== 'function') return;
    bs.upsertCustomerInCache(customer, {
        customers: state.customers,
        currentCustomer: state.currentCustomer,
        setCustomers(v) { state.customers = v; },
        setCurrentCustomer(v) { state.currentCustomer = v; }
    });
}

function saveCustomers() {
    const bs = resolveBootstrapSlice();
    if (!bs || typeof bs.saveCustomers !== 'function') return;
    const globalScope = getGlobalScope();
    bs.saveCustomers({
        kiwiApi: globalScope?.kiwiApi,
        personsStateApiUrl,
        customers: state.customers
    });
}

function updateCustomerActionButtons() {
    const bs = resolveBootstrapSlice();
    if (!bs || typeof bs.updateCustomerActionButtons !== 'function') return;
    bs.updateCustomerActionButtons({ documentRef: document, currentCustomer: state.currentCustomer });
}

function updateTime() {
    const bs = resolveBootstrapSlice();
    if (!bs || typeof bs.updateTime !== 'function') return;
    const globalScope = getGlobalScope();
    const getLocale = (globalScope && typeof globalScope.getDateLocaleForApp === 'function')
        ? globalScope.getDateLocaleForApp
        : () => 'nl-NL';
    bs.updateTime({ documentRef: document, getDateLocaleForApp: getLocale });
}

function refreshAgentStatusLabels() {
    const globalScope = getGlobalScope();
    const tr = (globalScope && typeof globalScope.translate === 'function')
        ? globalScope.translate
        : (key, _opts, fallback) => fallback || key;

    for (const [statusKey, statusConfig] of Object.entries(agentStatuses)) {
        const labelConfig = agentStatusLabelConfig[statusKey];
        if (!labelConfig) continue;
        statusConfig.label = tr(labelConfig.key, {}, labelConfig.fallback);
    }
}

// ---------------------------------------------------------------------------
// Delegating functions (slice proxies)
// ---------------------------------------------------------------------------

function endSession() {
    invokeSliceMethod(APP_SHELL_SLICE_NAMESPACE, 'endSession');
}

function closeForm(formId) {
    invokeSliceMethod(APP_SHELL_SLICE_NAMESPACE, 'closeForm', [formId]);
}

function mapToastTypeToContactType(toastType) {
    const mapped = invokeSliceMethod(APP_SHELL_SLICE_NAMESPACE, 'mapToastTypeToContactType', [toastType]);
    return typeof mapped === 'string' ? mapped : 'notification_success';
}

function showToast(message, type = 'success') {
    invokeSliceMethod(APP_SHELL_SLICE_NAMESPACE, 'showToast', [message, type]);
}

const isDebugModalEnabled = () => {
    const result = invokeSliceMethod(APP_SHELL_SLICE_NAMESPACE, 'isDebugModalEnabled');
    return typeof result === 'boolean' ? result : true;
};

function normalizePhone(value = '') {
    return value.replace(/\D/g, '');
}

// ---------------------------------------------------------------------------
// Slice dependency getters (used by slice configuration in index.js via
// window.kiwiLegacySliceDependencies)
// ---------------------------------------------------------------------------

function getCustomerDetailSliceDependencies() {
    const globalScope = getGlobalScope();
    return {
        findCustomerById(customerId) {
            const numId = Number(customerId);
            const hasNumeric = Number.isFinite(numId);
            return state.customers.find((c) => {
                if (!c || c.id === undefined || c.id === null) return false;
                if (hasNumeric) {
                    const cid = Number(c.id);
                    if (Number.isFinite(cid)) return cid === numId;
                }
                return String(c.id) === String(customerId);
            }) || null;
        },
        upsertCustomerInCache,
        getCurrentCustomer: () => state.currentCustomer,
        setCurrentCustomer: (v) => { state.currentCustomer = v; },
        getContactHistoryState: () => state.contactHistoryState,
        resetContactHistoryViewState() {
            invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'resetContactHistoryViewState');
        },
        getApiClient: () => (globalScope?.kiwiApi || null),
        saveCustomers,
        translate: globalScope?.translate || ((k, _o, f) => f || k),
        showToast,
        displayArticles() { invokeSliceMethod(ORDER_SLICE_NAMESPACE, 'displayArticles'); },
        updateCustomerActionButtons,
        updateIdentifyCallerButtons: globalScope?.updateIdentifyCallerButtons || (() => {}),
        getSubscriptionRequesterMetaLine: globalScope?.getSubscriptionRequesterMetaLine || (() => ''),
        getDateLocaleForApp: globalScope?.getDateLocaleForApp || (() => 'nl-NL'),
        personsApiUrl
    };
}

function getOrderSliceDependencies() {
    const globalScope = getGlobalScope();
    return {
        getCurrentCustomer: () => state.currentCustomer,
        getCustomers: () => state.customers,
        getOrderItems() {
            return (globalScope && typeof globalScope.orderItems !== 'undefined') ? globalScope.orderItems : [];
        },
        resetOrderItems() {
            if (globalScope && typeof globalScope.orderItems !== 'undefined') globalScope.orderItems = [];
        },
        async renderOrderItems() {
            if (globalScope && typeof globalScope.renderOrderItems === 'function') await globalScope.renderOrderItems();
        },
        async getOrderData() {
            if (globalScope && typeof globalScope.getOrderData === 'function') return globalScope.getOrderData();
            return null;
        },
        getApiClient: () => (globalScope?.kiwiApi || null),
        getWorkflowsApiUrl: () => workflowsApiUrl,
        setBirthdayFields: globalScope?.setBirthdayFields || (() => {}),
        ensureBirthdayValue: globalScope?.ensureBirthdayValue || (() => {}),
        initDeliveryDatePicker: globalScope?.initDeliveryDatePicker || (() => {}),
        closeForm,
        showToast,
        translate: globalScope?.translate || ((k, _o, f) => f || k),
        formatDate(dateString) {
            return invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'formatDate', [dateString]);
        },
        saveCustomers,
        upsertCustomerInCache,
        pushContactHistory(customer, entry, options) {
            return invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'pushContactHistory', [customer, entry, options]) || null;
        },
        showSuccessIdentificationPrompt: globalScope?.showSuccessIdentificationPrompt || (() => {}),
        async selectCustomer(customerId) {
            await invokeSliceMethodAsync(CUSTOMER_DETAIL_SLICE_NAMESPACE, 'selectCustomer', [customerId]);
        }
    };
}

function getDeliveryRemarksSliceDependencies() {
    const globalScope = getGlobalScope();
    return {
        getCurrentCustomer: () => state.currentCustomer,
        getApiClient: () => (globalScope?.kiwiApi || null),
        getPersonsApiUrl: () => personsApiUrl,
        getAgentName() {
            const el = document.getElementById('agentName');
            return el ? (el.textContent || '') : '';
        },
        translate: globalScope?.translate || ((k, _o, f) => f || k),
        showToast,
        async selectCustomer(customerId) {
            await invokeSliceMethodAsync(CUSTOMER_DETAIL_SLICE_NAMESPACE, 'selectCustomer', [customerId]);
        },
        pushContactHistory(customer, entry, options) {
            return invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'pushContactHistory', [customer, entry, options]) || null;
        },
        saveCustomers
    };
}

function getAppShellSliceDependencies() {
    const globalScope = getGlobalScope();
    return {
        getCurrentCustomer: () => state.currentCustomer,
        getContactHistoryState: () => state.contactHistoryState,
        pushContactHistory(customer, entry, options) {
            return invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'pushContactHistory', [customer, entry, options]) || null;
        },
        resetAllSubscriptionDuplicateStates: globalScope?.resetAllSubscriptionDuplicateStates || (() => {}),
        isCallSessionActive: () => Boolean(state.callSession && state.callSession.active),
        endCallSession: globalScope?.endCallSession || (() => {}),
        setCurrentCustomer: (v) => { state.currentCustomer = v; },
        setSelectedOffer: (v) => { state.selectedOffer = v; },
        setAdditionalFiltersOpen: globalScope?.setAdditionalFiltersOpen || (() => {}),
        updateCustomerActionButtons,
        closeDebugModal: globalScope?.closeDebugModal || (() => {}),
        openDebugModal: globalScope?.openDebugModal || (() => {}),
        closeStatusMenu: globalScope?.closeStatusMenu || (() => {})
    };
}

// ---------------------------------------------------------------------------
// Apply bootstrap data — called by index.js after bootstrapSlice.initializeData()
// ---------------------------------------------------------------------------

export function applyBootstrapData(initializedState) {
    if (!initializedState || typeof initializedState !== 'object') return;

    state.customers = initializedState.customers;
    state.lastCallSession = initializedState.lastCallSession;
    state.serviceNumbers = initializedState.serviceNumbers;
    state.callQueue = initializedState.callQueue;
    state.callSession = initializedState.callSession;

    syncWerfsleutelCatalogMetadataIntoSlice({
        channels: initializedState.werfsleutelChannels,
        catalog: initializedState.werfsleutelCatalog
    });
}

// ---------------------------------------------------------------------------
// Install all state and functions onto the global scope so that classic
// runtime scripts (call-agent-runtime.js, subscription-role-runtime.js) can
// access them as bare identifiers.
// ---------------------------------------------------------------------------

export function installLegacyAppState() {
    const globalScope = getGlobalScope();
    if (!globalScope) return;

    // Mutable state — use defineProperty so that classic-script assignments
    // like `customers = [...]` update the canonical state object.
    const mutableKeys = [
        'customers', 'currentCustomer', 'selectedOffer', 'searchState',
        'contactHistoryState', 'bootstrapState', 'callSession',
        'lastCallSession', 'agentStatus', 'callQueue', 'serviceNumbers',
        'teamsSyncNoticeShown'
    ];
    for (const key of mutableKeys) {
        Object.defineProperty(globalScope, key, {
            get() { return state[key]; },
            set(v) { state[key] = v; },
            configurable: true
        });
    }

    // Lazily-resolved subscription helpers
    ensureSubscriptionHelpersResolved();
    Object.defineProperty(globalScope, 'subscriptionPricing', {
        get() { ensureSubscriptionHelpersResolved(); return subscriptionPricing; },
        configurable: true
    });
    Object.defineProperty(globalScope, 'formatEuro', {
        get() { ensureSubscriptionHelpersResolved(); return formatEuro; },
        configurable: true
    });
    Object.defineProperty(globalScope, 'getSubscriptionDurationDisplay', {
        get() { ensureSubscriptionHelpersResolved(); return getSubscriptionDurationDisplay; },
        configurable: true
    });

    // Immutable constants
    const constantBindings = {
        agentStatusLabelConfig,
        agentStatuses,
        agentStatusAliases,
        transientAgentStatuses,
        subscriptionRoleState,
        subscriptionDuplicateState,
        recordingConfig,
        ACW_DEFAULT_DURATION,
        DUPLICATE_CHECK_DEBOUNCE_MS,
        DUPLICATE_CHECK_MIN_API_INTERVAL_MS,
        DUPLICATE_CHECK_CACHE_TTL_MS,
        DUPLICATE_CHECK_FETCH_LIMIT,
        DUPLICATE_CHECK_VISIBLE_LIMIT,
        SUBSCRIPTION_DUPLICATE_INPUT_FIELDS,
        bootstrapApiUrl,
        offersApiUrl,
        personsStateApiUrl,
        personsApiUrl,
        subscriptionsApiUrl,
        workflowsApiUrl,
        callQueueApiUrl,
        callSessionApiUrl,
        debugResetApiUrl,
        agentStatusApiUrl,
        APP_SUBSCRIPTION_HELPERS_NAMESPACE,
        fallbackSubscriptionHelpers
    };
    Object.assign(globalScope, constantBindings);

    // Functions
    const functionBindings = {
        upsertCustomerInCache,
        refreshAgentStatusLabels,
        getSubscriptionHelpers,
        getWerfsleutelSliceApi,
        syncWerfsleutelCatalogMetadataIntoSlice,
        getSelectedWerfsleutelState,
        getWerfsleutelOfferDetailsFromActiveSlice,
        createSubscriptionDuplicateRoleState,
        initWerfsleutelPicker,
        resetWerfsleutelPicker,
        triggerWerfsleutelBackgroundRefreshIfStale,
        endSession,
        closeForm,
        mapToastTypeToContactType,
        showToast,
        isDebugModalEnabled,
        normalizePhone,
        getSliceApi,
        invokeSliceMethod,
        invokeSliceMethodAsync,
        getCustomerDetailSliceDependencies,
        getOrderSliceDependencies,
        getDeliveryRemarksSliceDependencies,
        getAppShellSliceDependencies,
        saveCustomers,
        updateCustomerActionButtons,
        updateTime
    };
    Object.assign(globalScope, functionBindings);

    // Customer search bridge (used by customer-search-slice, subscription-workflow-slice, winback-slice)
    globalScope.kiwiLegacyCustomerSearchBridge = {
        getCustomers: () => state.customers,
        getCurrentCustomer: () => state.currentCustomer,
        setCurrentCustomer: (v) => { state.currentCustomer = v; },
        getCallSession: () => state.callSession
    };

    // Slice dependency bridge (used by index.js via createLegacySliceDependenciesResolver)
    const previousDeps = (globalScope.kiwiLegacySliceDependencies && typeof globalScope.kiwiLegacySliceDependencies === 'object')
        ? globalScope.kiwiLegacySliceDependencies
        : {};
    globalScope.kiwiLegacySliceDependencies = {
        ...previousDeps,
        getCustomerDetailSliceDependencies,
        getOrderSliceDependencies,
        getDeliveryRemarksSliceDependencies,
        getAppShellSliceDependencies
    };

    // Initialize agent status labels once translate is available
    refreshAgentStatusLabels();
}

// Expose low-level state for index.js bootstrap orchestration
export { state as legacyState };
