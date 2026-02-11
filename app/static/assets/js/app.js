const kiwiBootstrapSlice = (typeof window !== 'undefined' && window.kiwiBootstrapSlice)
    ? window.kiwiBootstrapSlice
    : null;

const initialAppDataState = kiwiBootstrapSlice && typeof kiwiBootstrapSlice.createInitialAppDataState === 'function'
    ? kiwiBootstrapSlice.createInitialAppDataState()
    : {
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
        contactHistoryHighlightTimer: null,
        bootstrapState: null
    };

// Sample Data Storage
let customers = initialAppDataState.customers;
let currentCustomer = initialAppDataState.currentCustomer;
let selectedOffer = initialAppDataState.selectedOffer;

// Search State Management (for pagination)
let searchState = initialAppDataState.searchState;

const contactHistoryState = initialAppDataState.contactHistoryState;

const apiEndpoints = kiwiBootstrapSlice && typeof kiwiBootstrapSlice.getApiEndpoints === 'function'
    ? kiwiBootstrapSlice.getApiEndpoints()
    : {
        bootstrapApiUrl: '/api/v1/bootstrap',
        offersApiUrl: '/api/v1/catalog/offers',
        personsStateApiUrl: '/api/v1/persons/state',
        personsApiUrl: '/api/v1/persons',
        subscriptionsApiUrl: '/api/v1/subscriptions',
        workflowsApiUrl: '/api/v1/workflows',
        callQueueApiUrl: '/api/v1/call-queue',
        callSessionApiUrl: '/api/v1/call-session',
        debugResetApiUrl: '/api/v1/debug/reset-poc-state',
        agentStatusApiUrl: '/api/v1/agent-status'
    };

const bootstrapApiUrl = apiEndpoints.bootstrapApiUrl;
const offersApiUrl = apiEndpoints.offersApiUrl;
const personsStateApiUrl = apiEndpoints.personsStateApiUrl;
const personsApiUrl = apiEndpoints.personsApiUrl;
const subscriptionsApiUrl = apiEndpoints.subscriptionsApiUrl;
const workflowsApiUrl = apiEndpoints.workflowsApiUrl;
const callQueueApiUrl = apiEndpoints.callQueueApiUrl;
const callSessionApiUrl = apiEndpoints.callSessionApiUrl;
const debugResetApiUrl = apiEndpoints.debugResetApiUrl;
const agentStatusApiUrl = apiEndpoints.agentStatusApiUrl;

let bootstrapState = initialAppDataState.bootstrapState;

function upsertCustomerInCache(customer) {
    const canUseBootstrapSlice = kiwiBootstrapSlice && typeof kiwiBootstrapSlice.upsertCustomerInCache === 'function';
    if (!canUseBootstrapSlice) {
        return;
    }

    kiwiBootstrapSlice.upsertCustomerInCache(customer, {
        customers,
        currentCustomer,
        setCustomers(nextCustomers) {
            customers = nextCustomers;
        },
        setCurrentCustomer(nextCustomer) {
            currentCustomer = nextCustomer;
        }
    });
}

// Phase 1A: Call Session State Management
let callSession = {
    active: false,              // Is er momenteel een actieve call?
    callerType: 'anonymous',    // 'anonymous' of 'identified'
    customerId: null,           // ID van geïdentificeerde klant
    customerName: null,         // Naam van geïdentificeerde klant
    serviceNumber: null,        // Welk service nummer werd gebeld
    waitTime: 0,                // Wachttijd in seconden
    startTime: null,            // Timestamp wanneer call startte
    pendingIdentification: null, // Tijdelijke opslag voor klant die nog niet gekoppeld is
    durationInterval: null,     // Timer interval voor gespreksduur
    recordingActive: false,     // Is recording actief
    totalHoldTime: 0,           // Totale hold tijd
    holdStartTime: null,        // Wanneer hold startte
    onHold: false               // Is call momenteel on hold
};

// Last completed call session data (for ACW/disposition)
let lastCallSession = null;

if (typeof window !== 'undefined') {
    window.kiwiLegacyCustomerSearchBridge = {
        getCustomers() {
            return customers;
        },
        getCurrentCustomer() {
            return currentCustomer;
        },
        setCurrentCustomer(customer) {
            currentCustomer = customer;
        },
        getCallSession() {
            return callSession;
        }
    };
}

// Phase 1B: Agent Status State Management
let agentStatus = {
    current: 'ready',           // ready, busy, dnd, brb, away, offline, acw
    preferred: 'ready',         // external/manual status that should survive non-call events
    statusBeforeCall: null,     // snapshot used to restore status after an active call
    canReceiveCalls: true,      // Can receive calls on page load
    sessionStartTime: Date.now(),
    callsHandled: 0,
    sessionTimerInterval: null,
    acwStartTime: null,
    breakStartTime: null,
    acwInterval: null
};

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

// Agent Status Definitions
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

function refreshAgentStatusLabels() {
    for (const [status, statusConfig] of Object.entries(agentStatuses)) {
        const labelConfig = agentStatusLabelConfig[status];
        if (!labelConfig) {
            continue;
        }
        statusConfig.label = translate(labelConfig.key, {}, labelConfig.fallback);
    }
}

refreshAgentStatusLabels();

const agentStatusAliases = {
    break: 'away'
};

let teamsSyncNoticeShown = false;
const transientAgentStatuses = new Set(['in_call']);

// Phase 1A: Service Number Configuration
let serviceNumbers = {};

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
        if (typeof locale === 'string' && locale.trim()) {
            return locale;
        }
        return 'nl-NL';
    }

    function getEuroFormatter(locale) {
        const resolvedLocale = resolveLocale(locale);
        if (!euroFormattersByLocale[resolvedLocale]) {
            euroFormattersByLocale[resolvedLocale] = new Intl.NumberFormat(resolvedLocale, {
                style: 'currency',
                currency: 'EUR',
                minimumFractionDigits: 2
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
        if (!pricing) {
            return '';
        }

        return `€${pricing.perMonth.toFixed(2)}/maand (${pricing.description})`;
    }

    function getSubscriptionDurationDisplay(subscription) {
        if (!subscription) {
            return 'Oude prijsstructuur';
        }

        if (subscription.duration && pricingTable[subscription.duration]) {
            return getPricingDisplay(subscription.duration);
        }

        if (subscription.durationLabel) {
            return subscription.durationLabel;
        }

        if (subscription.duration) {
            return subscription.duration;
        }

        return 'Oude prijsstructuur';
    }

    return {
        subscriptionPricing: pricingTable,
        formatEuro,
        getSubscriptionDurationDisplay
    };
})();

function getSubscriptionHelpers() {
    if (typeof window === 'undefined') {
        return fallbackSubscriptionHelpers;
    }

    const helperNamespace = window[APP_SUBSCRIPTION_HELPERS_NAMESPACE];
    if (!helperNamespace || typeof helperNamespace !== 'object') {
        return fallbackSubscriptionHelpers;
    }

    const hasPricingTable = helperNamespace.subscriptionPricing && typeof helperNamespace.subscriptionPricing === 'object';
    const hasFormatHelper = typeof helperNamespace.formatEuro === 'function';
    const hasDurationHelper = typeof helperNamespace.getSubscriptionDurationDisplay === 'function';
    if (!hasPricingTable || !hasFormatHelper || !hasDurationHelper) {
        return fallbackSubscriptionHelpers;
    }

    return helperNamespace;
}

const subscriptionHelpers = getSubscriptionHelpers();
const subscriptionPricing = subscriptionHelpers.subscriptionPricing;
const formatEuro = (amount) => subscriptionHelpers.formatEuro(amount, { locale: getDateLocaleForApp() });
const getSubscriptionDurationDisplay = (subscription) => subscriptionHelpers.getSubscriptionDurationDisplay(subscription);

const DUPLICATE_CHECK_DEBOUNCE_MS = 750;
const DUPLICATE_CHECK_MIN_API_INTERVAL_MS = 1500;
const DUPLICATE_CHECK_CACHE_TTL_MS = 90 * 1000;
const DUPLICATE_CHECK_FETCH_LIMIT = 5;
const DUPLICATE_CHECK_VISIBLE_LIMIT = 3;
const SUBSCRIPTION_DUPLICATE_INPUT_FIELDS = [
    'Initials',
    'MiddleName',
    'LastName',
    'PostalCode',
    'HouseNumber',
    'HouseExt',
    'Address',
    'City',
    'Email',
    'Phone'
];

function getWerfsleutelSliceApi() {
    if (typeof window === 'undefined') {
        return null;
    }

    const sliceApi = window.kiwiWerfsleutelSlice;
    if (!sliceApi || typeof sliceApi !== 'object') {
        return null;
    }

    return sliceApi;
}

function syncWerfsleutelCatalogMetadataIntoSlice(options = {}) {
    const werfsleutelSliceApi = getWerfsleutelSliceApi();
    const canSyncCatalogMetadata = werfsleutelSliceApi && typeof werfsleutelSliceApi.setCatalogMetadata === 'function';
    if (!canSyncCatalogMetadata) {
        return;
    }

    const channels = options.channels && typeof options.channels === 'object'
        ? options.channels
        : {};
    const catalog = Array.isArray(options.catalog) ? options.catalog : undefined;

    werfsleutelSliceApi.setCatalogMetadata({
        channels,
        catalog
    });
}

function getSelectedWerfsleutelState() {
    const werfsleutelSliceApi = getWerfsleutelSliceApi();
    const canReadSelection = werfsleutelSliceApi && typeof werfsleutelSliceApi.getSelection === 'function';
    if (!canReadSelection) {
        return {
            selectedKey: null,
            selectedChannel: null,
            selectedChannelMeta: null
        };
    }

    const sliceSelection = werfsleutelSliceApi.getSelection();
    return {
        selectedKey: sliceSelection?.selectedKey || null,
        selectedChannel: sliceSelection?.selectedChannel || null,
        selectedChannelMeta: sliceSelection?.selectedChannelMeta || null
    };
}

function getWerfsleutelOfferDetailsFromActiveSlice(selectedWerfsleutelKey) {
    const werfsleutelSliceApi = getWerfsleutelSliceApi();
    const canComputeOfferDetails = werfsleutelSliceApi && typeof werfsleutelSliceApi.getOfferDetails === 'function';
    if (!canComputeOfferDetails) {
        return {
            magazine: '',
            durationKey: '',
            durationLabel: ''
        };
    }

    const offerDetails = werfsleutelSliceApi.getOfferDetails(selectedWerfsleutelKey);
    return {
        magazine: offerDetails?.magazine || '',
        durationKey: offerDetails?.durationKey || '',
        durationLabel: offerDetails?.durationLabel || ''
    };
}

const subscriptionRoleState = {
    recipient: {
        mode: 'existing',
        selectedPerson: null,
        searchResults: []
    },
    requester: {
        mode: 'existing',
        selectedPerson: null,
        searchResults: []
    },
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

// Phase 5A: ACW Configuration
const ACW_DEFAULT_DURATION = 120; // 120 seconds

async function initWerfsleutelPicker() {
    const werfsleutelSliceApi = getWerfsleutelSliceApi();
    const canInitializePicker = werfsleutelSliceApi && typeof werfsleutelSliceApi.initializePicker === 'function';
    if (!canInitializePicker) {
        return;
    }

    await werfsleutelSliceApi.initializePicker();
}

function resetWerfsleutelPicker() {
    const werfsleutelSliceApi = getWerfsleutelSliceApi();
    const canResetPicker = werfsleutelSliceApi && typeof werfsleutelSliceApi.resetPicker === 'function';
    if (canResetPicker) {
        werfsleutelSliceApi.resetPicker();
    }
}

function triggerWerfsleutelBackgroundRefreshIfStale() {
    const werfsleutelSliceApi = getWerfsleutelSliceApi();
    const canRefreshCatalog = werfsleutelSliceApi && typeof werfsleutelSliceApi.refreshCatalogIfStale === 'function';
    if (canRefreshCatalog) {
        werfsleutelSliceApi.refreshCatalogIfStale();
    }
}

// Phase 6: Call Queue State Management
let callQueue = {
    enabled: false,           // Is queue mode geactiveerd
    queue: [],                // Array van wachtende bellers
    currentPosition: 0,       // Huidige positie in queue
    autoAdvance: true,        // Automatisch volgende nemen na gesprek
    waitTimeInterval: null    // Interval voor real-time wait time updates
};

// Phase 5A: Disposition Codes Configuration
const dispositionCategoryConfig = {
    subscription: {
        labelKey: 'disposition.category.subscription',
        labelFallback: 'Abonnement',
        outcomes: [
            { code: 'new_subscription', key: 'disposition.outcome.newSubscription', fallback: 'Nieuw abonnement afgesloten' },
            { code: 'subscription_changed', key: 'disposition.outcome.subscriptionChanged', fallback: 'Abonnement gewijzigd' },
            { code: 'subscription_cancelled', key: 'disposition.outcome.subscriptionCancelled', fallback: 'Abonnement opgezegd' },
            { code: 'subscription_paused', key: 'disposition.outcome.subscriptionPaused', fallback: 'Abonnement gepauzeerd' },
            { code: 'info_provided', key: 'disposition.outcome.infoProvided', fallback: 'Informatie verstrekt' }
        ]
    },
    delivery: {
        labelKey: 'disposition.category.delivery',
        labelFallback: 'Bezorging',
        outcomes: [
            { code: 'delivery_issue_resolved', key: 'disposition.outcome.deliveryIssueResolved', fallback: 'Bezorgprobleem opgelost' },
            { code: 'magazine_resent', key: 'disposition.outcome.magazineResent', fallback: 'Editie opnieuw verzonden' },
            { code: 'delivery_prefs_updated', key: 'disposition.outcome.deliveryPreferencesUpdated', fallback: 'Bezorgvoorkeuren aangepast' },
            { code: 'escalated_delivery', key: 'disposition.outcome.deliveryEscalated', fallback: 'Geëscaleerd naar bezorging' }
        ]
    },
    payment: {
        labelKey: 'disposition.category.payment',
        labelFallback: 'Betaling',
        outcomes: [
            { code: 'payment_resolved', key: 'disposition.outcome.paymentResolved', fallback: 'Betaling afgehandeld' },
            { code: 'payment_plan_arranged', key: 'disposition.outcome.paymentPlanArranged', fallback: 'Betalingsregeling getroffen' },
            { code: 'iban_updated', key: 'disposition.outcome.ibanUpdated', fallback: 'IBAN gegevens bijgewerkt' },
            { code: 'escalated_finance', key: 'disposition.outcome.financeEscalated', fallback: 'Geëscaleerd naar financiën' }
        ]
    },
    article_sale: {
        labelKey: 'disposition.category.articleSale',
        labelFallback: 'Artikel Verkoop',
        outcomes: [
            { code: 'article_sold', key: 'disposition.outcome.articleSold', fallback: 'Artikel verkocht' },
            { code: 'quote_provided', key: 'disposition.outcome.quoteProvided', fallback: 'Offerte verstrekt' },
            { code: 'no_sale', key: 'disposition.outcome.noSale', fallback: 'Geen verkoop' }
        ]
    },
    complaint: {
        labelKey: 'disposition.category.complaint',
        labelFallback: 'Klacht',
        outcomes: [
            { code: 'complaint_resolved', key: 'disposition.outcome.complaintResolved', fallback: 'Klacht opgelost' },
            { code: 'complaint_escalated', key: 'disposition.outcome.complaintEscalated', fallback: 'Klacht geëscaleerd' },
            { code: 'callback_scheduled', key: 'disposition.outcome.callbackScheduled', fallback: 'Terugbelafspraak gemaakt' }
        ]
    },
    general: {
        labelKey: 'disposition.category.general',
        labelFallback: 'Algemeen',
        outcomes: [
            { code: 'info_provided', key: 'disposition.outcome.infoProvided', fallback: 'Informatie verstrekt' },
            { code: 'transferred', key: 'disposition.outcome.transferred', fallback: 'Doorverbonden' },
            { code: 'customer_hung_up', key: 'disposition.outcome.customerHungUp', fallback: 'Klant opgehangen' },
            { code: 'wrong_number', key: 'disposition.outcome.wrongNumber', fallback: 'Verkeerd verbonden' },
            { code: 'no_answer_needed', key: 'disposition.outcome.noAnswerNeeded', fallback: 'Geen actie vereist' }
        ]
    }
};

function getDispositionCategories() {
    const resolvedCategories = {};
    for (const [categoryCode, categoryConfig] of Object.entries(dispositionCategoryConfig)) {
        resolvedCategories[categoryCode] = {
            label: translate(categoryConfig.labelKey, {}, categoryConfig.labelFallback),
            outcomes: categoryConfig.outcomes.map((outcomeConfig) => ({
                code: outcomeConfig.code,
                label: translate(outcomeConfig.key, {}, outcomeConfig.fallback)
            }))
        };
    }
    return resolvedCategories;
}

// Phase 2B: Recording Configuration
const recordingConfig = {
    enabled: true,
    requireConsent: true,
    autoStart: true
};

// End Session - Close current customer and return to clean slate
function endSession() {
    const handledBySlice = invokeSliceMethod('kiwiAppShellSlice', 'endSession');
    if (handledBySlice !== undefined) {
        return;
    }

    // End call if active (using new system)
    if (callSession.active) {
        endCallSession();
    }
    
    // Clear current customer
    currentCustomer = null;
    selectedOffer = null;
    
    // Hide customer detail
    document.getElementById('customerDetail').style.display = 'none';
    
    // Show welcome message
    document.getElementById('welcomeMessage').style.display = 'block';
    
    // Hide end call button
    const endCallBtn = document.getElementById('endCallBtn');
    if (endCallBtn) endCallBtn.style.display = 'none';
    
    // Clear search form
    document.getElementById('searchName').value = '';
    document.getElementById('searchPostalCode').value = '';
    document.getElementById('searchHouseNumber').value = '';
    const phoneInput = document.getElementById('searchPhone');
    if (phoneInput) phoneInput.value = '';
    const emailInput = document.getElementById('searchEmail');
    if (emailInput) emailInput.value = '';
    setAdditionalFiltersOpen(false);
    
    // Hide search results
    const searchResults = document.getElementById('searchResults');
    searchResults.style.display = 'none';
    document.getElementById('resultsContainer').innerHTML = '';
    
    // Close any open forms
    closeForm('newSubscriptionForm');
    closeForm('articleSaleForm');
    closeForm('editCustomerForm');
    closeForm('editSubscriptionForm');
    closeForm('resendMagazineForm');
    closeForm('winbackFlowForm');
    
    // Update action buttons
    updateCustomerActionButtons();
    
    // Scroll to top for clean start
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Optional: Show a brief confirmation
    console.log('Session ended - Ready for next customer');
}

// Subscription role helpers moved to app/subscription-role-runtime.js.
// ============================================================================
// PHASE 1: CALL SESSION MANAGEMENT
// ============================================================================

function generateContactHistoryId() {
    return `ch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function pushContactHistory(customer, entry, options = {}) {
    if (!customer) {
        return null;
    }

    const {
        highlight = false,
        persist = true,
        refresh = true,
        moveToFirstPage = false
    } = options;

    const normalizedEntry = {
        id: entry.id || generateContactHistoryId(),
        type: entry.type || 'default',
        date: entry.date || new Date().toISOString(),
        description: entry.description || ''
    };

    if (!Array.isArray(customer.contactHistory)) {
        customer.contactHistory = [];
    }

    customer.contactHistory.unshift(normalizedEntry);

    if (persist) {
        if (window.kiwiApi && customer.id !== undefined && customer.id !== null) {
            window.kiwiApi
                .post(`${personsApiUrl}/${customer.id}/contact-history`, normalizedEntry)
                .then((savedEntry) => {
                    if (savedEntry && savedEntry.id) {
                        normalizedEntry.id = savedEntry.id;
                    }
                })
                .catch((error) => {
                    console.warn('Kon contacthistorie niet opslaan via API', error);
                });
        } else {
            saveCustomers();
        }
    }

    const isCurrentCustomer = currentCustomer && currentCustomer.id === customer.id;

    if (isCurrentCustomer && (highlight || moveToFirstPage)) {
        contactHistoryState.currentPage = 1;
    }

    if (highlight && isCurrentCustomer) {
        contactHistoryState.highlightId = normalizedEntry.id;

        if (contactHistoryHighlightTimer) {
            clearTimeout(contactHistoryHighlightTimer);
        }

        contactHistoryHighlightTimer = setTimeout(() => {
            contactHistoryState.highlightId = null;
            if (currentCustomer && currentCustomer.id === customer.id) {
                displayContactHistory();
            }
            contactHistoryHighlightTimer = null;
        }, 5000);
    }

    if (refresh && isCurrentCustomer) {
        displayContactHistory();
    }

    contactHistoryState.lastEntry = {
        id: normalizedEntry.id,
        type: normalizedEntry.type,
        createdAt: Date.now()
    };

    return normalizedEntry;
}

// Helper function to add contact moment to customer history
function addContactMoment(customerId, type, description) {
    const customer = customers.find(c => c.id === customerId);
    if (!customer) return;

    pushContactHistory(
        customer,
        {
            type: type,
            description: description
        },
        { highlight: true }
    );
}

async function initializeKiwiApplication() {
    const canUseBootstrapSlice = kiwiBootstrapSlice && typeof kiwiBootstrapSlice.initializeKiwiApplication === 'function';
    if (!canUseBootstrapSlice) {
        return;
    }

    const scheduleInterval = (callback, timeout) => {
        if (typeof window !== 'undefined' && typeof window.setInterval === 'function') {
            return window.setInterval(callback, timeout);
        }
        return setInterval(callback, timeout);
    };

    await kiwiBootstrapSlice.initializeKiwiApplication({
        applyLocaleToUi,
        loadBootstrapState,
        initializeData,
        initializeQueue,
        updateTime,
        setInterval: scheduleInterval,
        updateCustomerActionButtons,
        populateBirthdayFields,
        initDeliveryDatePicker,
        initArticleSearch,
        initWerfsleutelPicker,
        startAgentWorkSessionTimer,
        updateAgentStatusDisplay,
        initializeAgentStatusFromBackend,
        setAdditionalFiltersOpen,
        documentRef: document
    });
}

// Initialize App
const canInstallBootstrapInitialization = kiwiBootstrapSlice && typeof kiwiBootstrapSlice.installInitializationHook === 'function';
if (canInstallBootstrapInitialization) {
    kiwiBootstrapSlice.installInitializationHook({
        documentRef: document,
        initializeKiwiApplication
    });
} else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        void initializeKiwiApplication();
    }, { once: true });
} else {
    void initializeKiwiApplication();
}

async function loadBootstrapState() {
    const canUseBootstrapSlice = kiwiBootstrapSlice && typeof kiwiBootstrapSlice.loadBootstrapState === 'function';
    if (!canUseBootstrapSlice) {
        bootstrapState = null;
        return;
    }

    bootstrapState = await kiwiBootstrapSlice.loadBootstrapState({
        kiwiApi: window.kiwiApi,
        bootstrapApiUrl
    });
}

// Initialize API-backed state
function initializeData() {
    const canUseBootstrapSlice = kiwiBootstrapSlice && typeof kiwiBootstrapSlice.initializeData === 'function';
    if (!canUseBootstrapSlice) {
        return;
    }

    const initializedState = kiwiBootstrapSlice.initializeData({
        bootstrapState,
        callQueue,
        callSession,
        werfsleutelCatalog: []
    });
    const hasInitializedState = initializedState && typeof initializedState === 'object';
    if (!hasInitializedState) {
        return;
    }

    customers = initializedState.customers;
    lastCallSession = initializedState.lastCallSession;
    serviceNumbers = initializedState.serviceNumbers;
    callQueue = initializedState.callQueue;
    callSession = initializedState.callSession;
    const werfsleutelChannels = initializedState.werfsleutelChannels;
    const werfsleutelCatalog = initializedState.werfsleutelCatalog;

    syncWerfsleutelCatalogMetadataIntoSlice({
        channels: werfsleutelChannels,
        catalog: werfsleutelCatalog
    });
}

// Persist Customers to authenticated API state
function saveCustomers() {
    const canUseBootstrapSlice = kiwiBootstrapSlice && typeof kiwiBootstrapSlice.saveCustomers === 'function';
    if (!canUseBootstrapSlice) {
        return;
    }

    kiwiBootstrapSlice.saveCustomers({
        kiwiApi: window.kiwiApi,
        personsStateApiUrl,
        customers
    });
}

// Update Customer Action Buttons visibility
function updateCustomerActionButtons() {
    const canUseBootstrapSlice = kiwiBootstrapSlice && typeof kiwiBootstrapSlice.updateCustomerActionButtons === 'function';
    if (!canUseBootstrapSlice) {
        return;
    }

    kiwiBootstrapSlice.updateCustomerActionButtons({
        documentRef: document,
        currentCustomer
    });
}

// Update Time Display
function updateTime() {
    const canUseBootstrapSlice = kiwiBootstrapSlice && typeof kiwiBootstrapSlice.updateTime === 'function';
    if (!canUseBootstrapSlice) {
        return;
    }

    kiwiBootstrapSlice.updateTime({
        documentRef: document,
        getDateLocaleForApp
    });
}

// Search Customer
function normalizePhone(value = '') {
    return value.replace(/\D/g, '');
}

// Customer search, pagination, and filter handlers are now implemented in
// app/static/assets/js/app/slices/customer-search-slice.js.

const CUSTOMER_DETAIL_SLICE_NAMESPACE = 'kiwiCustomerDetailSlice';
const CONTACT_HISTORY_SLICE_NAMESPACE = 'kiwiContactHistorySlice';
const WINBACK_SLICE_NAMESPACE = 'kiwiWinbackSlice';
const ORDER_SLICE_NAMESPACE = 'kiwiOrderSlice';
const DELIVERY_REMARKS_SLICE_NAMESPACE = 'kiwiDeliveryRemarksSlice';
const APP_SHELL_SLICE_NAMESPACE = 'kiwiAppShellSlice';

function getSliceApi(namespace) {
    if (typeof window === 'undefined') {
        return null;
    }

    const sliceApi = window[namespace];
    if (!sliceApi || typeof sliceApi !== 'object') {
        return null;
    }

    return sliceApi;
}

function invokeSliceMethod(namespace, methodName, args = []) {
    const sliceApi = getSliceApi(namespace);
    if (!sliceApi) {
        return undefined;
    }

    const handler = sliceApi[methodName];
    if (typeof handler !== 'function') {
        return undefined;
    }

    return handler(...args);
}

function invokeSliceMethodAsync(namespace, methodName, args = []) {
    return Promise.resolve(invokeSliceMethod(namespace, methodName, args));
}

function getCustomerDetailSliceDependencies() {
    return {
        findCustomerById(customerId) {
            const numericLookupId = Number(customerId);
            const hasNumericLookup = Number.isFinite(numericLookupId);

            return customers.find((customer) => {
                if (!customer || customer.id === undefined || customer.id === null) {
                    return false;
                }

                if (hasNumericLookup) {
                    const customerIdNumber = Number(customer.id);
                    if (Number.isFinite(customerIdNumber)) {
                        return customerIdNumber === numericLookupId;
                    }
                }

                return String(customer.id) === String(customerId);
            }) || null;
        },
        upsertCustomerInCache,
        getCurrentCustomer() {
            return currentCustomer;
        },
        setCurrentCustomer(customer) {
            currentCustomer = customer;
        },
        getContactHistoryState() {
            return contactHistoryState;
        },
        resetContactHistoryViewState() {
            invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'resetContactHistoryViewState');
        },
        getApiClient() {
            return window.kiwiApi || null;
        },
        saveCustomers,
        translate,
        showToast,
        displayArticles,
        updateCustomerActionButtons,
        updateIdentifyCallerButtons,
        getSubscriptionRequesterMetaLine,
        getDateLocaleForApp,
        personsApiUrl
    };
}

function getOrderSliceDependencies() {
    return {
        getCurrentCustomer() {
            return currentCustomer;
        },
        getCustomers() {
            return customers;
        },
        getOrderItems() {
            return typeof orderItems !== 'undefined' ? orderItems : [];
        },
        resetOrderItems() {
            if (typeof orderItems === 'undefined') {
                return;
            }
            orderItems = [];
        },
        async renderOrderItems() {
            if (typeof renderOrderItems !== 'function') {
                return;
            }
            await renderOrderItems();
        },
        async getOrderData() {
            if (typeof getOrderData !== 'function') {
                return null;
            }
            return getOrderData();
        },
        getApiClient() {
            return window.kiwiApi || null;
        },
        getWorkflowsApiUrl() {
            return workflowsApiUrl;
        },
        setBirthdayFields,
        ensureBirthdayValue,
        initDeliveryDatePicker,
        closeForm,
        showToast,
        translate,
        formatDate,
        saveCustomers,
        upsertCustomerInCache,
        pushContactHistory,
        showSuccessIdentificationPrompt,
        selectCustomer
    };
}

function getDeliveryRemarksSliceDependencies() {
    return {
        getCurrentCustomer() {
            return currentCustomer;
        },
        getApiClient() {
            return window.kiwiApi || null;
        },
        getPersonsApiUrl() {
            return personsApiUrl;
        },
        getAgentName() {
            const agentNameElement = document.getElementById('agentName');
            if (!agentNameElement) {
                return '';
            }
            return agentNameElement.textContent || '';
        },
        translate,
        showToast,
        selectCustomer,
        pushContactHistory,
        saveCustomers
    };
}

function getAppShellSliceDependencies() {
    return {
        getCurrentCustomer() {
            return currentCustomer;
        },
        getContactHistoryState() {
            return contactHistoryState;
        },
        pushContactHistory,
        resetAllSubscriptionDuplicateStates,
        isCallSessionActive() {
            return Boolean(callSession && callSession.active);
        },
        endCallSession,
        setCurrentCustomer(customer) {
            currentCustomer = customer;
        },
        setSelectedOffer(offer) {
            selectedOffer = offer;
        },
        setAdditionalFiltersOpen,
        updateCustomerActionButtons,
        closeDebugModal,
        openDebugModal,
        closeStatusMenu
    };
}

if (typeof window !== 'undefined') {
    const previousLegacySliceDependencies = window.kiwiLegacySliceDependencies
        && typeof window.kiwiLegacySliceDependencies === 'object'
        ? window.kiwiLegacySliceDependencies
        : {};
    window.kiwiLegacySliceDependencies = {
        ...previousLegacySliceDependencies,
        getCustomerDetailSliceDependencies,
        getOrderSliceDependencies,
        getDeliveryRemarksSliceDependencies,
        getAppShellSliceDependencies
    };
}

// Select Customer
async function selectCustomer(customerId) {
    await invokeSliceMethodAsync(CUSTOMER_DETAIL_SLICE_NAMESPACE, 'selectCustomer', [customerId]);
}

// Display Deceased Status Banner
function displayDeceasedStatusBanner() {
    invokeSliceMethod(CUSTOMER_DETAIL_SLICE_NAMESPACE, 'displayDeceasedStatusBanner');
}

// Display Subscriptions
function displaySubscriptions() {
    invokeSliceMethod(CUSTOMER_DETAIL_SLICE_NAMESPACE, 'displaySubscriptions');
}

// Display Contact History
function displayContactHistory() {
    invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'displayContactHistory');
}

// Toggle Timeline Item (Accordion)
function toggleTimelineItem(entryDomId) {
    invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'toggleTimelineItem', [entryDomId]);
}

function changeContactHistoryPage(newPage) {
    invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'changeContactHistoryPage', [newPage]);
}

function generateContactHistoryId() {
    const generatedId = invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'generateContactHistoryId');
    if (typeof generatedId === 'string' && generatedId.length > 0) {
        return generatedId;
    }

    return `ch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function pushContactHistory(customer, entry, options = {}) {
    const pushedEntry = invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'pushContactHistory', [
        customer,
        entry,
        options
    ]);

    return pushedEntry || null;
}

function addContactMoment(customerId, type, description) {
    const contactMoment = invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'addContactMoment', [
        customerId,
        type,
        description
    ]);

    return contactMoment || null;
}

// Format Date
function formatDate(dateString) {
    const formattedDate = invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'formatDate', [dateString]);
    if (typeof formattedDate === 'string') {
        return formattedDate;
    }

    const date = new Date(dateString);
    return date.toLocaleDateString(getDateLocaleForApp(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Format DateTime
function formatDateTime(dateString) {
    const formattedDateTime = invokeSliceMethod(CONTACT_HISTORY_SLICE_NAMESPACE, 'formatDateTime', [dateString]);
    if (typeof formattedDateTime === 'string') {
        return formattedDateTime;
    }

    const date = new Date(dateString);
    return date.toLocaleDateString(getDateLocaleForApp(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Cancel Subscription (triggers winback flow)
function cancelSubscription(subId) {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'cancelSubscription', [subId]);
}

// Start Winback Flow for an Ended Subscription
function startWinbackForSubscription(subId) {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'startWinbackForSubscription', [subId]);
}

// Show Winback Flow
function showWinbackFlow() {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'showWinbackFlow');
}

// Winback Next Step
async function winbackNextStep(stepNumber) {
    await invokeSliceMethodAsync(WINBACK_SLICE_NAMESPACE, 'winbackNextStep', [stepNumber]);
}

// Winback Previous Step
function winbackPrevStep(stepNumber) {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'winbackPrevStep', [stepNumber]);
}

// Generate Winback Offers
async function generateWinbackOffers(reason) {
    await invokeSliceMethodAsync(WINBACK_SLICE_NAMESPACE, 'generateWinbackOffers', [reason]);
}

// Select Offer
function selectOffer(offerId, title, description, domEvent) {
    const selectedElement = domEvent && domEvent.currentTarget ? domEvent.currentTarget : domEvent;
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'selectOffer', [offerId, title, description, selectedElement]);
}

// Generate Winback Script
function generateWinbackScript() {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'generateWinbackScript');
}

// Handle Deceased Options - Show all subscriptions
function winbackHandleDeceased() {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'winbackHandleDeceased');
}

// Process Deceased Subscriptions
function processDeceasedSubscriptions() {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'processDeceasedSubscriptions');
}

// Show Deceased Refund Form
function showDeceasedRefundForm() {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'showDeceasedRefundForm');
}

// Show Deceased Transfer Form
function showDeceasedTransferForm() {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'showDeceasedTransferForm');
}

// Show Deceased Combined Form
function showDeceasedCombinedForm() {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'showDeceasedCombinedForm');
}

// Revert Restitution - Transfer subscription to another person (deceased cannot have active subscriptions)
function revertRestitution(subscriptionId) {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'revertRestitution', [subscriptionId]);
}

// Show Transfer Form for Restitution Revert
function showRestitutionTransferForm(subscription) {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'showRestitutionTransferForm', [subscription]);
}

// Toggle Address Fields for Restitution Transfer
function toggleRestitutionTransferAddress() {
    invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'toggleRestitutionTransferAddress');
}

// Complete Restitution Transfer
async function completeRestitutionTransfer(event) {
    await invokeSliceMethodAsync(WINBACK_SLICE_NAMESPACE, 'completeRestitutionTransfer', [event]);
}

// Complete All Deceased Actions
async function completeAllDeceasedActions() {
    await invokeSliceMethodAsync(WINBACK_SLICE_NAMESPACE, 'completeAllDeceasedActions');
}

// Get Transfer Data from Form (using unified customer form component)
function getTransferDataFromForm(formVersion) {
    return invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'getTransferDataFromForm', [formVersion]);
}

// Get Refund Data from Form
function getRefundDataFromForm(formVersion) {
    return invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'getRefundDataFromForm', [formVersion]);
}

// Validate Transfer Data
function validateTransferData(data) {
    const result = invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'validateTransferData', [data]);
    return result === true;
}

// Validate Refund Data
function validateRefundData(data) {
    const result = invokeSliceMethod(WINBACK_SLICE_NAMESPACE, 'validateRefundData', [data]);
    return result === true;
}

// Complete Winback
async function completeWinback() {
    await invokeSliceMethodAsync(WINBACK_SLICE_NAMESPACE, 'completeWinback');
}

// ========== ARTICLE SALES FUNCTIONS ==========

// Display Articles
function displayArticles() {
    invokeSliceMethod(ORDER_SLICE_NAMESPACE, 'displayArticles');
}

// Show Article Sale Form
function showArticleSale() {
    invokeSliceMethod(ORDER_SLICE_NAMESPACE, 'showArticleSale');
}

// Add Delivery Remark
function addDeliveryRemark(remark) {
    invokeSliceMethod(ORDER_SLICE_NAMESPACE, 'addDeliveryRemark', [remark]);
}

function addDeliveryRemarkByKey(key) {
    invokeSliceMethod(ORDER_SLICE_NAMESPACE, 'addDeliveryRemarkByKey', [key]);
}

// Update Article Price - handled by article-search.js

// Create Article Sale
async function createArticleSale(event) {
    await invokeSliceMethodAsync(ORDER_SLICE_NAMESPACE, 'createArticleSale', [event]);
}

// Edit Delivery Remarks
function editDeliveryRemarks() {
    invokeSliceMethod(DELIVERY_REMARKS_SLICE_NAMESPACE, 'editDeliveryRemarks');
}

// Add Delivery Remark to Modal
function addDeliveryRemarkToModal(remark) {
    invokeSliceMethod(DELIVERY_REMARKS_SLICE_NAMESPACE, 'addDeliveryRemarkToModal', [remark]);
}

function addDeliveryRemarkToModalByKey(key) {
    invokeSliceMethod(DELIVERY_REMARKS_SLICE_NAMESPACE, 'addDeliveryRemarkToModalByKey', [key]);
}

// Save Delivery Remarks
async function saveDeliveryRemarks() {
    await invokeSliceMethodAsync(DELIVERY_REMARKS_SLICE_NAMESPACE, 'saveDeliveryRemarks');
}

// Close Edit Remarks Modal
function closeEditRemarksModal() {
    invokeSliceMethod(DELIVERY_REMARKS_SLICE_NAMESPACE, 'closeEditRemarksModal');
}

// Close Form
function closeForm(formId) {
    const handledBySlice = invokeSliceMethod(APP_SHELL_SLICE_NAMESPACE, 'closeForm', [formId]);
    if (handledBySlice !== undefined) {
        return;
    }

    if (formId === 'newSubscriptionForm') {
        resetAllSubscriptionDuplicateStates();
    }

    const form = document.getElementById(formId);
    if (form) {
        form.style.display = 'none';
    }
}

function mapToastTypeToContactType(toastType) {
    const mappedContactType = invokeSliceMethod(APP_SHELL_SLICE_NAMESPACE, 'mapToastTypeToContactType', [toastType]);
    if (typeof mappedContactType === 'string') {
        return mappedContactType;
    }

    switch (toastType) {
        case 'error':
            return 'notification_error';
        case 'warning':
            return 'notification_warning';
        case 'info':
            return 'notification_info';
        default:
            return 'notification_success';
    }
}

// Show Toast Notification (now backed by contact history)
function showToast(message, type = 'success') {
    const handledBySlice = invokeSliceMethod(APP_SHELL_SLICE_NAMESPACE, 'showToast', [message, type]);
    if (handledBySlice !== undefined) {
        return;
    }

    if (currentCustomer) {
        pushContactHistory(
            currentCustomer,
            {
                type: mapToastTypeToContactType(type),
                description: message
            },
            { highlight: true, moveToFirstPage: true }
        );
        return;
    }

    const toast = document.getElementById('toast');
    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function wireCallAgentRuntimeDependencies() {
    if (typeof window === 'undefined') {
        return;
    }

    const runtimeApi = window.kiwiCallAgentRuntime;
    const canConfigureRuntimeDependencies = runtimeApi && typeof runtimeApi.configureDependencies === 'function';
    if (!canConfigureRuntimeDependencies) {
        return;
    }

    runtimeApi.configureDependencies({
        addContactMoment,
        getDispositionCategories,
        selectCustomer,
        showToast
    });
}

wireCallAgentRuntimeDependencies();

const isDebugModalEnabled = () => {
    const debugModalEnabled = invokeSliceMethod(APP_SHELL_SLICE_NAMESPACE, 'isDebugModalEnabled');
    if (typeof debugModalEnabled === 'boolean') {
        return debugModalEnabled;
    }

    const flags = window.featureFlags;
    if (!flags || typeof flags.isEnabled !== 'function') {
        return true;
    }

    return flags.isEnabled('debugModal');
};
