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

let contactHistoryHighlightTimer = initialAppDataState.contactHistoryHighlightTimer;

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

// Currency formatter reused for werfsleutels and notes
const euroFormattersByLocale = {};

function getEuroFormatter() {
    const locale = getDateLocaleForApp();
    if (!euroFormattersByLocale[locale]) {
        euroFormattersByLocale[locale] = new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        });
    }

    return euroFormattersByLocale[locale];
}

let werfsleutelCatalog = [];
let werfsleutelLoadAttempted = false;
const WERFSLEUTEL_SEARCH_LIMIT = 5;
const WERFSLEUTEL_FULL_SYNC_LIMIT = 250;
const WERFSLEUTEL_SEARCH_DEBOUNCE_MS = 180;
const WERFSLEUTEL_CACHE_TTL_MS = 15 * 60 * 1000;
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
let werfsleutelSearchDebounceTimer = null;
let werfsleutelCatalogSyncPromise = null;
let werfsleutelCatalogSyncedAt = 0;

let werfsleutelChannels = {};

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
    if (canReadSelection) {
        const sliceSelection = werfsleutelSliceApi.getSelection();
        return {
            selectedKey: sliceSelection?.selectedKey || null,
            selectedChannel: sliceSelection?.selectedChannel || null,
            selectedChannelMeta: sliceSelection?.selectedChannelMeta || null
        };
    }

    const selectedChannel = werfsleutelState.selectedChannel;
    return {
        selectedKey: werfsleutelState.selectedKey,
        selectedChannel,
        selectedChannelMeta: selectedChannel ? (werfsleutelChannels[selectedChannel] || null) : null
    };
}

function getWerfsleutelOfferDetailsFromActiveSlice(selectedWerfsleutelKey) {
    const werfsleutelSliceApi = getWerfsleutelSliceApi();
    const canComputeOfferDetails = werfsleutelSliceApi && typeof werfsleutelSliceApi.getOfferDetails === 'function';
    if (canComputeOfferDetails) {
        return werfsleutelSliceApi.getOfferDetails(selectedWerfsleutelKey);
    }

    return getWerfsleutelOfferDetails(selectedWerfsleutelKey);
}

const werfsleutelState = {
    selectedKey: null,
    selectedChannel: null
};

const werfsleutelPickerState = {
    visibleMatches: [],
    activeIndex: -1,
    latestQuery: ''
};

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

async function ensureWerfsleutelsLoaded() {
    if (!werfsleutelLoadAttempted || werfsleutelCatalog.length === 0) {
        werfsleutelLoadAttempted = true;
        await syncWerfsleutelsCatalog({ force: true });
        return;
    }

    if (isWerfsleutelCatalogStale()) {
        void syncWerfsleutelsCatalog({ force: true, background: true });
    }
}

function isWerfsleutelCatalogStale() {
    if (!werfsleutelCatalogSyncedAt) {
        return true;
    }
    return Date.now() - werfsleutelCatalogSyncedAt > WERFSLEUTEL_CACHE_TTL_MS;
}

async function syncWerfsleutelsCatalog(options = {}) {
    const { force = false, background = false } = options;

    if (!window.kiwiApi) {
        if (!background) {
            console.warn(translate('werfsleutel.catalogUnavailable', {}, 'kiwiApi niet beschikbaar; werfsleutels konden niet geladen worden.'));
        }
        return werfsleutelCatalog;
    }

    const shouldRefresh = force || werfsleutelCatalog.length === 0 || isWerfsleutelCatalogStale();
    if (!shouldRefresh) {
        return werfsleutelCatalog;
    }

    if (werfsleutelCatalogSyncPromise) {
        return werfsleutelCatalogSyncPromise;
    }

    if (background) {
        console.info(translate('werfsleutel.catalogRefreshing', {}, 'Werfsleutels worden op de achtergrond ververst.'));
    }

    const query = new URLSearchParams({
        type: 'werfsleutels',
        limit: String(WERFSLEUTEL_FULL_SYNC_LIMIT)
    }).toString();

    werfsleutelCatalogSyncPromise = window.kiwiApi.get(`${offersApiUrl}?${query}`)
        .then((payload) => {
            const items = Array.isArray(payload && payload.items) ? payload.items : [];
            if (items.length > 0) {
                rememberWerfsleutels(items);
            }
            werfsleutelCatalogSyncedAt = Date.now();
            return werfsleutelCatalog;
        })
        .catch((error) => {
            console.warn(translate('werfsleutel.catalogRefreshFailed', {}, 'Werfsleutel verversen mislukt, bestaande lijst blijft actief.'), error);
            return werfsleutelCatalog;
        })
        .finally(() => {
            werfsleutelCatalogSyncPromise = null;
        });

    return werfsleutelCatalogSyncPromise;
}

function isWerfsleutelBarcodeQuery(value) {
    return /^\d{6,}$/.test(value);
}

function rememberWerfsleutels(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return;
    }

    const catalogByCode = new Map(
        werfsleutelCatalog
            .filter((item) => item && item.salesCode)
            .map((item) => [item.salesCode, item])
    );

    for (const item of items) {
        if (!item || !item.salesCode) {
            continue;
        }
        catalogByCode.set(item.salesCode, item);
    }

    werfsleutelCatalog = Array.from(catalogByCode.values());
}

async function searchWerfsleutelsViaApi(query) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || !window.kiwiApi) {
        return [];
    }

    const params = new URLSearchParams({
        type: 'werfsleutels',
        limit: String(WERFSLEUTEL_SEARCH_LIMIT)
    });

    if (isWerfsleutelBarcodeQuery(normalizedQuery)) {
        params.set('barcode', normalizedQuery.replace(/[^0-9]/g, ''));
    } else {
        params.set('query', normalizedQuery);
    }

    const payload = await window.kiwiApi.get(`${offersApiUrl}?${params.toString()}`);
    const items = Array.isArray(payload && payload.items) ? payload.items : [];
    rememberWerfsleutels(items);
    return items;
}

async function findWerfsleutelCandidate(query) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) {
        return null;
    }

    const isBarcodeLookup = isWerfsleutelBarcodeQuery(normalizedQuery);
    if (isBarcodeLookup) {
        const barcodeMatch = findWerfsleutelByBarcode(normalizedQuery);
        if (barcodeMatch) {
            return barcodeMatch;
        }
    }

    const normalizedSalesCode = normalizedQuery.toLowerCase();
    const exactLocalMatch = werfsleutelCatalog.find(
        (item) => item.salesCode.toLowerCase() === normalizedSalesCode
    );
    if (exactLocalMatch) {
        return exactLocalMatch;
    }

    if (!isBarcodeLookup) {
        const localMatches = filterWerfsleutelCatalog(normalizedQuery);
        if (localMatches.length > 0) {
            return localMatches[0];
        }
    }

    try {
        const apiMatches = await searchWerfsleutelsViaApi(normalizedQuery);
        if (!Array.isArray(apiMatches) || apiMatches.length === 0) {
            return null;
        }

        if (isBarcodeLookup) {
            const normalizedBarcode = normalizedQuery.replace(/[^0-9]/g, '');
            const barcodeMatch = apiMatches.find((item) => String(item.barcode || '') === normalizedBarcode);
            return barcodeMatch || apiMatches[0];
        }

        const exactApiMatch = apiMatches.find(
            (item) => item.salesCode.toLowerCase() === normalizedSalesCode
        );
        return exactApiMatch || apiMatches[0];
    } catch (error) {
        console.warn('Werfsleutel zoeken via API mislukt.', error);
        return null;
    }
}

function findWerfsleutelByBarcode(rawValue) {
    const normalizedBarcode = rawValue.replace(/[^0-9]/g, '');
    return werfsleutelCatalog.find((item) => String(item.barcode || '') === normalizedBarcode) || null;
}

function clearWerfsleutelSelection() {
    werfsleutelState.selectedKey = null;
    werfsleutelState.selectedChannel = null;
    renderWerfsleutelChannelOptions();
    updateWerfsleutelSummary();
}

function inferMagazineFromTitle(title = '') {
    const normalized = title.toLowerCase();
    if (normalized.includes('avrobode')) return 'Avrobode';
    if (normalized.includes('mikrogids')) return 'Mikrogids';
    if (normalized.includes('ncrv')) return 'Ncrvgids';
    return translate('common.unknown', {}, 'Onbekend');
}

function deriveMagazineFromKey(key) {
    const unknownMagazine = translate('common.unknown', {}, 'Onbekend');
    if (!key) return unknownMagazine;
    if (key.magazine && key.magazine !== unknownMagazine) {
        return key.magazine;
    }
    return inferMagazineFromTitle(key.title || '');
}

function detectDurationKeyFromTitle(title = '') {
    const normalized = title.toLowerCase();
    const mentionsMonthly = normalized.includes('maandelijks') || normalized.includes('per maand') || normalized.includes('maand');

    if (normalized.includes('3 jaar') || normalized.includes('36 nummers')) {
        return mentionsMonthly ? '3-jaar-maandelijks' : '3-jaar';
    }
    if (normalized.includes('2 jaar') || normalized.includes('24 nummers')) {
        return mentionsMonthly ? '2-jaar-maandelijks' : '2-jaar';
    }
    if (normalized.includes('1 jaar') || normalized.includes('12 nummers') || normalized.includes('proef 12')) {
        return mentionsMonthly ? '1-jaar-maandelijks' : '1-jaar';
    }
    if (mentionsMonthly) {
        return '1-jaar-maandelijks';
    }
    return null;
}

function extractDurationLabelFromTitle(title = '') {
    if (!title) {
        return 'Looptijd onbekend';
    }
    const match = title.match(/(\d+)\s*(jaar|maand|maanden|nummers?)/i);
    if (match) {
        const unit = match[2].toLowerCase();
        const normalizedUnit = unit.startsWith('maand') ? 'maanden' : unit;
        return `${match[1]} ${normalizedUnit}`;
    }
    return translate('common.unknownDuration', {}, 'Looptijd onbekend');
}

function getWerfsleutelOfferDetails(key) {
    const magazine = deriveMagazineFromKey(key);
    const durationKey = detectDurationKeyFromTitle(key?.title);
    const durationLabel = durationKey
        ? subscriptionPricing[durationKey]?.description || extractDurationLabelFromTitle(key?.title)
        : extractDurationLabelFromTitle(key?.title);

    return {
        magazine,
        durationKey,
        durationLabel
    };
}

// Phase 5A: ACW Configuration
const ACW_DEFAULT_DURATION = 120; // 120 seconds

const MIN_SUB_NUMBER = 8099098;
const MAX_SUB_NUMBER = 12199098;
const NAME_INSERTION_PREFIXES = [
    'van der',
    'van den',
    'van de',
    'von der',
    'ten',
    'ter',
    'op de',
    'op den',
    'op',
    'aan de',
    'aan den',
    'aan',
    'bij',
    'uit de',
    'uit den',
    'uit',
    'de',
    'den',
    'der',
    'van',
    'von',
    'te'
];

function normalizeNameFragment(value) {
    return (value || '').replace(/[\s.]/g, '').toLowerCase();
}

function generateSubscriptionNumber(customerId, subscriptionId) {
    const range = MAX_SUB_NUMBER - MIN_SUB_NUMBER + 1;
    const seed = Math.abs((customerId * 73856093) ^ (subscriptionId * 193939));
    const offset = seed % range;
    return String(MIN_SUB_NUMBER + offset);
}

function formatEuro(amount) {
    const euroFormatter = getEuroFormatter();
    if (typeof amount !== 'number') {
        const numericValue = Number(amount);
        return euroFormatter.format(Number.isFinite(numericValue) ? numericValue : 0);
    }
    return euroFormatter.format(amount);
}

async function initWerfsleutelPicker() {
    await ensureWerfsleutelsLoaded();

    const input = document.getElementById('werfsleutelInput');
    if (!input) {
        return;
    }

    resetWerfsleutelPicker();
}

async function handleWerfsleutelInputKeyDown(event) {
    if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveWerfsleutelActiveSelection(1);
        return;
    }

    if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveWerfsleutelActiveSelection(-1);
        return;
    }

    if (event.key === 'Escape') {
        renderWerfsleutelSuggestions([], { hideWhenEmpty: true });
        return;
    }

    if (event.key !== 'Enter') {
        return;
    }

    event.preventDefault();

    if (werfsleutelSearchDebounceTimer) {
        window.clearTimeout(werfsleutelSearchDebounceTimer);
        werfsleutelSearchDebounceTimer = null;
    }

    const activeMatch = getActiveWerfsleutelMatch();
    if (activeMatch) {
        if (!activeMatch.isActive) {
            showToast(translate('werfsleutel.notActive', {}, 'Deze werfsleutel is niet meer actief.'), 'warning');
            return;
        }
        selectWerfsleutel(activeMatch.salesCode);
        return;
    }

    const input = document.getElementById('werfsleutelInput');
    const trimmed = input ? input.value.trim() : '';
    if (!trimmed) {
        return;
    }

    const candidate = await findWerfsleutelCandidate(trimmed);
    if (!candidate) {
        showToast(translate('werfsleutel.unknown', {}, 'Onbekende werfsleutel.'), 'error');
        return;
    }

    selectWerfsleutel(candidate.salesCode);
}

function handleWerfsleutelQuery(rawValue) {
    const query = rawValue.trim();
    werfsleutelPickerState.latestQuery = query;

    const selectedSalesCode = werfsleutelState.selectedKey?.salesCode || '';
    const queryMatchesSelection = selectedSalesCode.toLowerCase() === query.toLowerCase();
    if (selectedSalesCode && !queryMatchesSelection) {
        clearWerfsleutelSelection();
    }

    if (werfsleutelSearchDebounceTimer) {
        window.clearTimeout(werfsleutelSearchDebounceTimer);
        werfsleutelSearchDebounceTimer = null;
    }

    if (!query) {
        renderWerfsleutelSuggestions([], { hideWhenEmpty: true });
        return;
    }

    const localMatches = filterWerfsleutelCatalog(query);
    renderWerfsleutelSuggestions(localMatches);

    if (!isWerfsleutelBarcodeQuery(query) || findWerfsleutelByBarcode(query)) {
        return;
    }

    werfsleutelSearchDebounceTimer = window.setTimeout(async () => {
        const lookupQuery = query;
        try {
            await searchWerfsleutelsViaApi(lookupQuery);
        } catch (error) {
            console.warn('Werfsleutel barcode lookup via API mislukt.', error);
            return;
        }

        if (werfsleutelPickerState.latestQuery !== lookupQuery) {
            return;
        }

        const refreshedMatches = filterWerfsleutelCatalog(lookupQuery);
        renderWerfsleutelSuggestions(refreshedMatches);
        validateWerfsleutelBarcode(lookupQuery);
    }, WERFSLEUTEL_SEARCH_DEBOUNCE_MS);
}

function filterWerfsleutelCatalog(query) {
    if (!query) {
        return werfsleutelCatalog.slice(0, WERFSLEUTEL_SEARCH_LIMIT);
    }

    const normalized = query.toLowerCase();
    return werfsleutelCatalog.filter((item) => {
        return item.salesCode.toLowerCase().includes(normalized) ||
            item.title.toLowerCase().includes(normalized) ||
            String(item.price).includes(normalized) ||
            String(item.barcode || '').includes(normalized) ||
            String(item.magazine || '').toLowerCase().includes(normalized);
    }).slice(0, WERFSLEUTEL_SEARCH_LIMIT);
}

function renderWerfsleutelSuggestions(matches, options = {}) {
    const container = document.getElementById('werfsleutelSuggestions');
    const input = document.getElementById('werfsleutelInput');
    if (!container || !input) return;

    const { hideWhenEmpty = false, preserveActiveIndex = false } = options;

    if (!matches || matches.length === 0) {
        werfsleutelPickerState.visibleMatches = [];
        werfsleutelPickerState.activeIndex = -1;

        if (hideWhenEmpty) {
            container.innerHTML = '';
            container.classList.add('hidden');
        } else {
            container.innerHTML = `<div class="empty-state-small">${translate('werfsleutel.noMatches', {}, 'Geen werfsleutels gevonden')}</div>`;
            container.classList.remove('hidden');
        }
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        return;
    }

    werfsleutelPickerState.visibleMatches = matches.slice();
    if (!preserveActiveIndex) {
        werfsleutelPickerState.activeIndex = 0;
    } else if (werfsleutelPickerState.activeIndex >= werfsleutelPickerState.visibleMatches.length) {
        werfsleutelPickerState.activeIndex = werfsleutelPickerState.visibleMatches.length - 1;
    }

    container.classList.remove('hidden');
    container.innerHTML = werfsleutelPickerState.visibleMatches.map((item, index) => `
        <button type="button"
                role="option"
                id="werfsleutelOption-${index}"
                aria-selected="${index === werfsleutelPickerState.activeIndex ? 'true' : 'false'}"
                class="werfsleutel-suggestion${item.isActive ? '' : ' inactive'}${index === werfsleutelPickerState.activeIndex ? ' active' : ''}"
                data-action="select-werfsleutel"
                data-arg-sales-code="${item.salesCode}"
                data-code="${item.salesCode}">
            <span class="code">${item.salesCode}</span>
            <span class="title">${item.title}</span>
            <span class="price">${formatEuro(item.price)}</span>
            <span class="status-pill ${item.isActive ? 'status-pill--success' : 'status-pill--warning'}">
                ${item.isActive ? 'Actief' : 'Inactief'}
            </span>
        </button>
    `).join('');

    container.querySelectorAll('.werfsleutel-suggestion').forEach((button, index) => {
        button.addEventListener('mouseenter', () => {
            if (werfsleutelPickerState.activeIndex === index) {
                return;
            }
            werfsleutelPickerState.activeIndex = index;
            renderWerfsleutelSuggestions(werfsleutelPickerState.visibleMatches, { preserveActiveIndex: true });
        });
    });

    const activeOption = container.querySelector(`#werfsleutelOption-${werfsleutelPickerState.activeIndex}`);
    input.setAttribute('aria-expanded', 'true');
    if (activeOption) {
        input.setAttribute('aria-activedescendant', activeOption.id);
        activeOption.scrollIntoView({ block: 'nearest' });
    } else {
        input.removeAttribute('aria-activedescendant');
    }
}

function getActiveWerfsleutelMatch() {
    if (werfsleutelPickerState.activeIndex < 0) {
        return null;
    }
    return werfsleutelPickerState.visibleMatches[werfsleutelPickerState.activeIndex] || null;
}

function moveWerfsleutelActiveSelection(delta) {
    if (werfsleutelPickerState.visibleMatches.length === 0) {
        const query = werfsleutelPickerState.latestQuery;
        if (!query) {
            return;
        }
        const matches = filterWerfsleutelCatalog(query);
        if (matches.length === 0) {
            return;
        }
        renderWerfsleutelSuggestions(matches);
    }

    const total = werfsleutelPickerState.visibleMatches.length;
    if (total === 0) {
        return;
    }

    const currentIndex = werfsleutelPickerState.activeIndex;
    if (currentIndex < 0) {
        werfsleutelPickerState.activeIndex = delta > 0 ? 0 : total - 1;
    } else {
        werfsleutelPickerState.activeIndex = (currentIndex + delta + total) % total;
    }

    renderWerfsleutelSuggestions(werfsleutelPickerState.visibleMatches, { preserveActiveIndex: true });
}

function selectWerfsleutel(salesCode) {
    const match = werfsleutelCatalog.find((item) => item.salesCode === salesCode);
    if (!match) {
        showToast(translate('werfsleutel.unknown', {}, 'Onbekende werfsleutel.'), 'error');
        return;
    }

    if (!match.isActive) {
        showToast(translate('werfsleutel.notActive', {}, 'Deze werfsleutel is niet meer actief.'), 'warning');
        return;
    }

    werfsleutelState.selectedKey = match;
    const input = document.getElementById('werfsleutelInput');

    if (input) {
        input.value = match.salesCode;
        werfsleutelPickerState.latestQuery = match.salesCode;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
    }

    if (!match.allowedChannels.includes(werfsleutelState.selectedChannel)) {
        werfsleutelState.selectedChannel = null;
    }

    renderWerfsleutelSuggestions([], { hideWhenEmpty: true });
    renderWerfsleutelChannelOptions();
    updateWerfsleutelSummary();
}

function validateWerfsleutelBarcode(rawValue) {
    const barcode = rawValue.replace(/[^0-9]/g, '');

    if (!barcode) {
        return;
    }

    const match = findWerfsleutelByBarcode(barcode);
    if (!match) {
        clearWerfsleutelSelection();
        return false;
    }

    if (!match.isActive) {
        clearWerfsleutelSelection();
        showToast(translate('werfsleutel.notActive', {}, 'Deze werfsleutel is niet meer actief.'), 'warning');
        return false;
    }

    selectWerfsleutel(match.salesCode);
    return true;
}

function renderWerfsleutelChannelOptions() {
    const container = document.getElementById('werfsleutelChannels');
    if (!container) return;

    const selectedKey = werfsleutelState.selectedKey;
    if (!selectedKey) {
        container.innerHTML = `<div class="empty-state-small">${translate('werfsleutel.selectKeyFirst', {}, 'Selecteer eerst een werfsleutel')}</div>`;
        return;
    }

    const allowedChannels = Array.isArray(selectedKey.allowedChannels) ? selectedKey.allowedChannels : [];
    const channelEntries = allowedChannels
        .filter((code) => werfsleutelChannels[code])
        .map((code) => [code, werfsleutelChannels[code]]);

    if (channelEntries.length === 0) {
        werfsleutelState.selectedChannel = null;
        container.innerHTML = `<div class="empty-state-small">${translate('werfsleutel.noChannels', {}, 'Geen kanalen beschikbaar voor deze werfsleutel')}</div>`;
        return;
    }

    const allowedCodes = channelEntries.map(([code]) => code);
    if (!allowedCodes.includes(werfsleutelState.selectedChannel)) {
        werfsleutelState.selectedChannel = null;
    }
    if (!werfsleutelState.selectedChannel && allowedCodes.length === 1) {
        werfsleutelState.selectedChannel = allowedCodes[0];
    }

    container.innerHTML = channelEntries.map(([code, meta]) => {
        const isSelected = werfsleutelState.selectedChannel === code;
        return `
            <button type="button"
                    class="channel-chip${isSelected ? ' selected' : ''}"
                    data-action="select-werfsleutel-channel"
                    data-arg-channel-code="${code}"
                    data-channel="${code}"
                    title="${meta.label}">
                <span class="channel-icon">${meta.icon}</span>
                <span class="channel-code">${code}</span>
                <span class="channel-label">${meta.label}</span>
            </button>
        `;
    }).join('');
}

function selectWerfsleutelChannel(channelCode) {
    if (!werfsleutelChannels[channelCode]) {
        showToast(translate('werfsleutel.unknownChannel', {}, 'Onbekend kanaal'), 'error');
        return;
    }

    const allowed = werfsleutelState.selectedKey?.allowedChannels ?? [];
    if (allowed.length > 0 && !allowed.includes(channelCode)) {
        showToast(translate('werfsleutel.channelMismatch', {}, 'Dit kanaal hoort niet bij de gekozen werfsleutel.'), 'warning');
        return;
    }

    werfsleutelState.selectedChannel = channelCode;
    renderWerfsleutelChannelOptions();
    updateWerfsleutelSummary();
}

function updateWerfsleutelSummary() {
    const summary = document.getElementById('werfsleutelSummary');
    if (!summary) return;

    if (!werfsleutelState.selectedKey) {
        summary.classList.remove('visible');
        summary.textContent = '';
        return;
    }

    const channelCode = werfsleutelState.selectedChannel;
    const channelLabel = channelCode
        ? `${channelCode} · ${werfsleutelChannels[channelCode].label}`
        : translate('werfsleutel.selectChannel', {}, 'Kies een kanaal voor deze werfsleutel.');
    const key = werfsleutelState.selectedKey;
    const hasChannel = Boolean(channelCode);
    const statusClass = hasChannel ? 'status-pill--success' : 'status-pill--warning';
    const statusLabel = hasChannel
        ? translate('werfsleutel.channelSelected', {}, 'Kanaal gekozen')
        : translate('werfsleutel.channelRequiredHint', {}, 'Kanaal nog kiezen');

    summary.innerHTML = `
        <div>
            <strong>${key.salesCode}</strong> - ${key.title} (${formatEuro(key.price)})
        </div>
        <div class="werfsleutel-summary-status">
            <span class="status-pill ${statusClass}">${statusLabel}</span>
            <span>${channelLabel}</span>
        </div>
    `;
    summary.classList.add('visible');
}

function resetWerfsleutelPicker() {
    werfsleutelState.selectedKey = null;
    werfsleutelState.selectedChannel = null;
    werfsleutelPickerState.visibleMatches = [];
    werfsleutelPickerState.activeIndex = -1;
    werfsleutelPickerState.latestQuery = '';

    const input = document.getElementById('werfsleutelInput');
    if (input) {
        input.value = '';
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
    }

    renderWerfsleutelSuggestions([], { hideWhenEmpty: true });
    renderWerfsleutelChannelOptions();
    updateWerfsleutelSummary();
}

function triggerWerfsleutelBackgroundRefreshIfStale() {
    if (!isWerfsleutelCatalogStale()) {
        return;
    }

    void syncWerfsleutelsCatalog({ force: true, background: true }).then(() => {
        const input = document.getElementById('werfsleutelInput');
        const query = input ? input.value.trim() : '';
        if (!query) {
            return;
        }
        renderWerfsleutelSuggestions(filterWerfsleutelCatalog(query));
    });
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


// Subscription Pricing Information
const subscriptionPricing = {
    '1-jaar': { price: 52.00, perMonth: 4.33, description: '1 jaar - Jaarlijks betaald' },
    '2-jaar': { price: 98.00, perMonth: 4.08, description: '2 jaar - Jaarlijks betaald (5% korting)' },
    '3-jaar': { price: 140.00, perMonth: 3.89, description: '3 jaar - Jaarlijks betaald (10% korting)' },
    '1-jaar-maandelijks': { price: 54.00, perMonth: 4.50, description: '1 jaar - Maandelijks betaald' },
    '2-jaar-maandelijks': { price: 104.40, perMonth: 4.35, description: '2 jaar - Maandelijks betaald' },
    '3-jaar-maandelijks': { price: 151.20, perMonth: 4.20, description: '3 jaar - Maandelijks betaald' }
};

// Helper function to get pricing display
function getPricingDisplay(duration) {
    const pricing = subscriptionPricing[duration];
    if (!pricing) return '';
    return `€${pricing.perMonth.toFixed(2)}/maand (${pricing.description})`;
}

function getSubscriptionDurationDisplay(subscription) {
    if (!subscription) {
        return 'Oude prijsstructuur';
    }

    if (subscription.duration && subscriptionPricing[subscription.duration]) {
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

// Start Call Session
function startCallSession() {
    // Toon sessie info in bovenbalk
    document.getElementById('sessionInfo').style.display = 'flex';
    
    // Update service nummer
    const serviceLabels = {
        'AVROBODE': translate('serviceNumbers.avrobode', {}, 'AVROBODE SERVICE'),
        'MIKROGIDS': translate('serviceNumbers.mikrogids', {}, 'MIKROGIDS SERVICE'),
        'NCRVGIDS': translate('serviceNumbers.ncrvgids', {}, 'NCRVGIDS SERVICE'),
        'ALGEMEEN': translate('serviceNumbers.algemeen', {}, 'ALGEMEEN SERVICE')
    };
    document.getElementById('sessionServiceNumber').textContent = 
        serviceLabels[callSession.serviceNumber] || callSession.serviceNumber;
    
    // Update wachttijd
    document.getElementById('sessionWaitTime').textContent = 
        formatTime(callSession.waitTime);
    
    // Update beller naam
    document.getElementById('sessionCallerName').textContent = 
        callSession.customerName || translate('calls.anonymousCaller', {}, 'Anonieme Beller');
    
    // Toon gesprek beëindigen knop
    document.getElementById('endCallBtn').style.display = 'inline-block';
    
    // Update agent status naar Busy
    autoSetAgentStatus('call_started');
    
    // Toon hold button
    const holdBtn = document.getElementById('holdCallBtn');
    if (holdBtn) {
        holdBtn.style.display = 'inline-block';
        holdBtn.innerHTML = translate('calls.holdButtonLabel', {}, '⏸️ In Wacht Zetten');
        holdBtn.classList.remove('on-hold');
    }
    
    // Toon debug end call button
    const debugEndBtn = document.getElementById('debugEndCallBtn');
    if (debugEndBtn) {
        debugEndBtn.style.display = 'block';
    }
    
    // Toon recording indicator (Phase 2B)
    if (recordingConfig.enabled) {
        const recordingIndicator = document.getElementById('recordingIndicator');
        if (recordingIndicator) {
            recordingIndicator.style.display = 'flex';
            callSession.recordingActive = true;
        }
    }
    
    // Start gespreksduur timer
    updateCallDuration();
    callSession.durationInterval = setInterval(updateCallDuration, 1000);
    
    // Update "Dit is de beller" knoppen zichtbaarheid
    updateIdentifyCallerButtons();
    saveCallSession();
}

// Update Call Duration Timer
function updateCallDuration() {
    if (!callSession.active) return;
    
    const elapsed = Math.floor((Date.now() - callSession.startTime) / 1000);
    document.getElementById('sessionDuration').textContent = formatTime(elapsed);
}


async function initializeKiwiApplication() {
    const canUseBootstrapSlice = kiwiBootstrapSlice && typeof kiwiBootstrapSlice.initializeKiwiApplication === 'function';
    if (!canUseBootstrapSlice) {
        return;
    }

    const initializeWerfsleutelPickerFromSlices = () => {
        const werfsleutelSliceApi = getWerfsleutelSliceApi();
        const canInitializeFromWerfsleutelSlice = werfsleutelSliceApi && typeof werfsleutelSliceApi.initializePicker === 'function';
        if (canInitializeFromWerfsleutelSlice) {
            return werfsleutelSliceApi.initializePicker();
        }
        return initWerfsleutelPicker();
    };

    await kiwiBootstrapSlice.initializeKiwiApplication({
        applyLocaleToUi,
        loadBootstrapState,
        initializeData,
        initializeQueue,
        updateTime,
        setInterval,
        updateCustomerActionButtons,
        populateBirthdayFields,
        initDeliveryDatePicker,
        initArticleSearch,
        initWerfsleutelPicker: initializeWerfsleutelPickerFromSlices,
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
        werfsleutelCatalog
    });
    const hasInitializedState = initializedState && typeof initializedState === 'object';
    if (!hasInitializedState) {
        return;
    }

    customers = initializedState.customers;
    lastCallSession = initializedState.lastCallSession;
    serviceNumbers = initializedState.serviceNumbers;
    werfsleutelChannels = initializedState.werfsleutelChannels;
    werfsleutelCatalog = initializedState.werfsleutelCatalog;
    callQueue = initializedState.callQueue;
    callSession = initializedState.callSession;

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
const CUSTOMER_DETAIL_DEPENDENCIES_PROVIDER = 'kiwiGetCustomerDetailSliceDependencies';
const ORDER_SLICE_NAMESPACE = 'kiwiOrderSlice';
const ORDER_SLICE_DEPENDENCIES_PROVIDER = 'kiwiGetOrderSliceDependencies';
const DELIVERY_REMARKS_SLICE_NAMESPACE = 'kiwiDeliveryRemarksSlice';
const DELIVERY_REMARKS_SLICE_DEPENDENCIES_PROVIDER = 'kiwiGetDeliveryRemarksSliceDependencies';

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
            contactHistoryState.currentPage = 1;
            contactHistoryState.highlightId = null;
            contactHistoryState.lastEntry = null;

            if (contactHistoryHighlightTimer) {
                clearTimeout(contactHistoryHighlightTimer);
                contactHistoryHighlightTimer = null;
            }
        },
        translate,
        showToast,
        displayArticles,
        updateCustomerActionButtons,
        updateIdentifyCallerButtons,
        getSubscriptionDurationDisplay,
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

if (typeof window !== 'undefined') {
    window[CUSTOMER_DETAIL_DEPENDENCIES_PROVIDER] = getCustomerDetailSliceDependencies;
    window[ORDER_SLICE_DEPENDENCIES_PROVIDER] = getOrderSliceDependencies;
    window[DELIVERY_REMARKS_SLICE_DEPENDENCIES_PROVIDER] = getDeliveryRemarksSliceDependencies;
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
    const subscription = currentCustomer.subscriptions.find(s => s.id === subId);
    if (!subscription) return;
    
    // Store subscription ID for winback flow
    window.cancellingSubscriptionId = subId;
    showWinbackFlow();
}

// Start Winback Flow for an Ended Subscription
function startWinbackForSubscription(subId) {
    if (!currentCustomer) return;
    
    const subscription = currentCustomer.subscriptions.find(s => s.id === subId);
    if (!subscription) return;
    
    // Store subscription ID for winback flow
    window.cancellingSubscriptionId = subId;
    window.isWinbackForEndedSub = true;
    showWinbackFlow();
}

// Show Winback Flow
function showWinbackFlow() {
    if (!currentCustomer) {
        showToast(translate('customer.selectFirst', {}, 'Selecteer eerst een klant'), 'error');
        return;
    }

    // If no subscription is selected yet, use the first active subscription
    if (!window.cancellingSubscriptionId && currentCustomer.subscriptions.length > 0) {
        const activeSubscription = currentCustomer.subscriptions.find(s => s.status === 'active');
        if (activeSubscription) {
            window.cancellingSubscriptionId = activeSubscription.id;
        } else if (currentCustomer.subscriptions.length > 0) {
            window.cancellingSubscriptionId = currentCustomer.subscriptions[0].id;
        }
    }

    // Reset winback flow
    document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
    document.getElementById('winbackStep1').style.display = 'block';
    
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    document.querySelector('[data-step="1"]').classList.add('active');

    document.getElementById('winbackFlow').style.display = 'flex';
}

// Winback Next Step
async function winbackNextStep(stepNumber) {
    // Validation
    if (stepNumber === 2) {
        const selectedReason = document.querySelector('input[name="cancelReason"]:checked');
        if (!selectedReason) {
            showToast(translate('subscription.selectReason', {}, 'Selecteer een reden'), 'error');
            return;
        }
        
        // Special handling for deceased
        if (selectedReason.value === 'deceased') {
            winbackHandleDeceased();
            return;
        }
        
        // Generate offers based on reason
        await generateWinbackOffers(selectedReason.value);
    }
    
    if (stepNumber === 3) {
        if (!selectedOffer) {
            showToast(translate('subscription.selectOffer', {}, 'Selecteer een aanbod'), 'error');
            return;
        }
        
        // Generate script for step 3
        generateWinbackScript();
    }

    // Hide all steps
    document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
    
    // Show selected step
    document.getElementById(`winbackStep${stepNumber}`).style.display = 'block';
    
    // Update step indicator
    document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
    document.querySelector(`[data-step="${stepNumber}"]`).classList.add('active');
}

// Winback Previous Step
function winbackPrevStep(stepNumber) {
    if (stepNumber === '1b') {
        document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
        document.getElementById('winbackStep1b').style.display = 'block';
    } else if (typeof stepNumber === 'string') {
        document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
        document.getElementById(`winbackStep${stepNumber}`).style.display = 'block';
    } else {
        winbackNextStep(stepNumber);
    }
}

// Generate Winback Offers
async function generateWinbackOffers(reason) {
    if (!window.kiwiApi) {
        showToast(translate('winback.offersUnavailable', {}, 'Winback-aanbiedingen via backend zijn niet beschikbaar'), 'error');
        return;
    }

    let relevantOffers = [];
    try {
        const query = new URLSearchParams({ type: 'winback', reason: reason || 'other' }).toString();
        const payload = await window.kiwiApi.get(`${offersApiUrl}?${query}`);
        relevantOffers = payload && Array.isArray(payload.items) ? payload.items : [];
    } catch (error) {
        console.warn('Winback-aanbiedingen laden via backend mislukt.', error);
        showToast(error.message || translate('winback.offersLoadFailed', {}, 'Winback-aanbiedingen laden mislukt'), 'error');
        return;
    }

    if (!relevantOffers.length) {
        showToast(translate('winback.offersNoneForReason', {}, 'Geen winback-aanbiedingen beschikbaar voor deze reden'), 'warning');
    }

    const offersContainer = document.getElementById('winbackOffers');
    
    offersContainer.innerHTML = relevantOffers.map(offer => {
        const safeTitle = escapeHtml(String(offer.title || ''));
        const safeDescription = escapeHtml(String(offer.description || ''));
        return `
        <div class="offer-card" data-action="select-offer" data-arg-offer-id="${offer.id}" data-arg-title="${safeTitle}" data-arg-description="${safeDescription}">
            <div class="offer-title">${offer.title}</div>
            <div class="offer-description">${offer.description}</div>
            <div class="offer-discount">${offer.discount}</div>
        </div>
    `;
    }).join('');
}

// Select Offer
function selectOffer(offerId, title, description, domEvent) {
    selectedOffer = { id: offerId, title, description };
    
    // Update UI
    document.querySelectorAll('.offer-card').forEach(card => {
        card.classList.remove('selected');
    });
    if (domEvent && domEvent.currentTarget) {
        domEvent.currentTarget.classList.add('selected');
    }
}

// Generate Winback Script
function generateWinbackScript() {
    if (!selectedOffer) return;
    
    const scriptElement = document.getElementById('winbackScript');
    scriptElement.innerHTML = `
        <strong>${translate('winback.offerScriptTitle', {}, 'Script voor aanbod presentatie:')}</strong><br><br>
        "${translate('winback.offerScriptIntro', {}, 'Ik begrijp dat u het abonnement wilt opzeggen. We waarderen u als klant enorm en willen graag dat u blijft. Daarom wil ik u een speciaal aanbod doen:')}<br><br>
        <strong>${selectedOffer.title}</strong><br>
        ${selectedOffer.description}<br><br>
        ${translate('winback.offerScriptQuestion', {}, 'Zou dit u helpen om het abonnement aan te houden?')}"
    `;
}

// Handle Deceased Options - Show all subscriptions
function winbackHandleDeceased() {
    const activeSubscriptions = currentCustomer.subscriptions.filter(s => s.status === 'active');
    
    if (activeSubscriptions.length === 0) {
        showToast(translate('subscription.noneActive', {}, 'Geen actieve abonnementen gevonden'), 'error');
        return;
    }
    
    // Update count
    document.getElementById('deceasedSubCount').textContent = activeSubscriptions.length;
    
    // Generate subscription cards
    const container = document.getElementById('deceasedSubscriptionsList');
    container.innerHTML = activeSubscriptions.map(sub => `
        <div class="deceased-subscription-card" data-sub-id="${sub.id}">
            <div class="deceased-sub-header">
                <h4>📰 ${sub.magazine}</h4>
                <span class="sub-start-date">Start: ${formatDate(sub.startDate)}</span>
            </div>
            <div class="form-group">
                <label>Actie voor dit abonnement:</label>
                <div class="radio-group">
                    <label class="radio-option">
                        <input type="radio" name="action_${sub.id}" value="cancel_refund" required>
                        <span>${translate('subscription.actionCancelWithRefund', {}, 'Opzeggen met restitutie')}</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="action_${sub.id}" value="transfer" required>
                        <span>${translate('subscription.actionTransferToOther', {}, 'Overzetten op andere persoon')}</span>
                    </label>
                </div>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
    document.getElementById('winbackStep1b').style.display = 'block';
}

// Process Deceased Subscriptions
function processDeceasedSubscriptions() {
    const activeSubscriptions = currentCustomer.subscriptions.filter(s => s.status === 'active');
    const subscriptionActions = [];
    
    // Collect all actions
    for (const sub of activeSubscriptions) {
        const selectedAction = document.querySelector(`input[name="action_${sub.id}"]:checked`);
        if (!selectedAction) {
            showToast(
                translate('subscription.selectAction', { magazine: sub.magazine }, `Selecteer een actie voor ${sub.magazine}`),
                'error'
            );
            return;
        }
        subscriptionActions.push({
            subscription: sub,
            action: selectedAction.value
        });
    }
    
    // Store for later processing
    window.deceasedSubscriptionActions = subscriptionActions;
    
    // Check if we need transfer form (if any subscription needs transfer)
    const needsTransfer = subscriptionActions.some(sa => sa.action === 'transfer');
    const needsRefund = subscriptionActions.some(sa => sa.action === 'cancel_refund');
    
    if (needsTransfer && needsRefund) {
        // Both actions needed, show combined form
        showDeceasedCombinedForm();
    } else if (needsTransfer) {
        // Only transfer
        showDeceasedTransferForm();
    } else {
        // Only refund
        showDeceasedRefundForm();
    }
}

// Show Deceased Refund Form
function showDeceasedRefundForm() {
    const refundSubs = window.deceasedSubscriptionActions.filter(sa => sa.action === 'cancel_refund');
    
    const listHtml = `
        <p><strong>Op te zeggen abonnementen:</strong></p>
        <ul>
            ${refundSubs.map(sa => `<li>📰 ${sa.subscription.magazine}</li>`).join('')}
        </ul>
    `;
    document.getElementById('refundSubscriptionsList').innerHTML = listHtml;
    
    document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
    document.getElementById('winbackStep1c').style.display = 'block';
    
    // Pre-fill email placeholder
    const refundEmailInput = document.getElementById('refundEmail');
    if (currentCustomer.email) {
        refundEmailInput.placeholder = `Bijv. ${currentCustomer.email} of ander e-mailadres`;
    }
}

// Show Deceased Transfer Form
function showDeceasedTransferForm() {
    const transferSubs = window.deceasedSubscriptionActions.filter(sa => sa.action === 'transfer');
    
    const listHtml = `
        <p><strong>Over te zetten abonnementen:</strong></p>
        <ul>
            ${transferSubs.map(sa => `<li>📰 ${sa.subscription.magazine}</li>`).join('')}
        </ul>
    `;
    document.getElementById('transferSubscriptionsList').innerHTML = listHtml;
    
    document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
    document.getElementById('winbackStep1d').style.display = 'block';
    
    // Render unified customer form
    renderCustomerForm('transferCustomerForm', 'transfer', {
        phoneRequired: true,
        emailRequired: true,
        showSameAddressCheckbox: true
    });
    
    // Setup same address functionality
    const checkbox = document.getElementById('transferSameAddress');
    checkbox.addEventListener('change', function() {
        if (this.checked && currentCustomer) {
            setCustomerFormData('transfer', {
                postalCode: currentCustomer.postalCode,
                houseNumber: currentCustomer.houseNumber,
                address: currentCustomer.address,
                city: currentCustomer.city
            });
        }
    });
}

// Show Deceased Combined Form
function showDeceasedCombinedForm() {
    const transferSubs = window.deceasedSubscriptionActions.filter(sa => sa.action === 'transfer');
    const refundSubs = window.deceasedSubscriptionActions.filter(sa => sa.action === 'cancel_refund');
    
    const transferListHtml = `
        <p><strong>Over te zetten abonnementen:</strong></p>
        <ul>
            ${transferSubs.map(sa => `<li>📰 ${sa.subscription.magazine}</li>`).join('')}
        </ul>
    `;
    document.getElementById('combinedTransferList').innerHTML = transferListHtml;
    
    const refundListHtml = `
        <p><strong>Op te zeggen abonnementen:</strong></p>
        <ul>
            ${refundSubs.map(sa => `<li>📰 ${sa.subscription.magazine}</li>`).join('')}
        </ul>
    `;
    document.getElementById('combinedRefundList').innerHTML = refundListHtml;
    
    document.querySelectorAll('.winback-step').forEach(step => step.style.display = 'none');
    document.getElementById('winbackStep1e').style.display = 'block';
    
    // Render unified customer form
    renderCustomerForm('transfer2CustomerForm', 'transfer2', {
        phoneRequired: true,
        emailRequired: true,
        showSameAddressCheckbox: true
    });
    
    // Setup same address functionality
    const checkbox = document.getElementById('transfer2SameAddress');
    checkbox.addEventListener('change', function() {
        if (this.checked && currentCustomer) {
            setCustomerFormData('transfer2', {
                postalCode: currentCustomer.postalCode,
                houseNumber: currentCustomer.houseNumber,
                address: currentCustomer.address,
                city: currentCustomer.city
            });
        }
    });
}

// Legacy functions removed - now using renderCustomerForm() with unified component

// Revert Restitution - Transfer subscription to another person (deceased cannot have active subscriptions)
function revertRestitution(subscriptionId) {
    const subscription = currentCustomer.subscriptions.find(s => s.id === subscriptionId);
    if (!subscription || subscription.status !== 'restituted') {
        showToast(translate('subscription.notFoundOrRefund', {}, 'Abonnement niet gevonden of niet gerestitueerd'), 'error');
        return;
    }
    
    // Store the subscription ID for the transfer form
    window.restitutionRevertSubId = subscriptionId;
    
    // Open transfer form
    showRestitutionTransferForm(subscription);
}

// Show Transfer Form for Restitution Revert
function showRestitutionTransferForm(subscription) {
    // Open the transfer form modal
    document.getElementById('restitutionTransferForm').style.display = 'flex';
    
    // Update form title
    document.getElementById('restitutionTransferTitle').textContent = translate(
        'subscription.transferTitleWithMagazine',
        { magazine: subscription.magazine },
        `${subscription.magazine} Overzetten`
    );
    
    // Pre-fill same address checkbox as checked by default
    document.getElementById('restitutionTransferSameAddress').checked = true;
    toggleRestitutionTransferAddress();
}

// Toggle Address Fields for Restitution Transfer
function toggleRestitutionTransferAddress() {
    const sameAddress = document.getElementById('restitutionTransferSameAddress').checked;
    const addressFields = document.getElementById('restitutionTransferAddressFields');
    
    if (sameAddress) {
        addressFields.style.display = 'none';
        // Remove required attribute
        document.getElementById('restitutionTransferPostalCode').removeAttribute('required');
        document.getElementById('restitutionTransferHouseNumber').removeAttribute('required');
        document.getElementById('restitutionTransferAddress').removeAttribute('required');
        document.getElementById('restitutionTransferCity').removeAttribute('required');
    } else {
        addressFields.style.display = 'block';
        // Add required attribute
        document.getElementById('restitutionTransferPostalCode').setAttribute('required', 'required');
        document.getElementById('restitutionTransferHouseNumber').setAttribute('required', 'required');
        document.getElementById('restitutionTransferAddress').setAttribute('required', 'required');
        document.getElementById('restitutionTransferCity').setAttribute('required', 'required');
    }
}

// Complete Restitution Transfer
async function completeRestitutionTransfer(event) {
    event.preventDefault();
    
    const subscriptionId = window.restitutionRevertSubId;
    const subscription = currentCustomer.subscriptions.find(s => s.id === subscriptionId);
    
    if (!subscription) {
        showToast(translate('subscription.notFound', {}, 'Abonnement niet gevonden'), 'error');
        return;
    }
    
    // Get form data
    const sameAddress = document.getElementById('restitutionTransferSameAddress').checked;
    const transferData = {
        salutation: document.getElementById('restitutionTransferSalutation').value,
        firstName: document.getElementById('restitutionTransferFirstName').value.trim(),
        middleName: document.getElementById('restitutionTransferMiddleName').value.trim(),
        lastName: document.getElementById('restitutionTransferLastName').value.trim(),
        email: document.getElementById('restitutionTransferEmail').value.trim(),
        phone: document.getElementById('restitutionTransferPhone').value.trim(),
        postalCode: sameAddress ? currentCustomer.postalCode : document.getElementById('restitutionTransferPostalCode').value.trim(),
        houseNumber: sameAddress ? currentCustomer.houseNumber : document.getElementById('restitutionTransferHouseNumber').value.trim(),
        address: sameAddress ? currentCustomer.address : document.getElementById('restitutionTransferAddress').value.trim(),
        city: sameAddress ? currentCustomer.city : document.getElementById('restitutionTransferCity').value.trim()
    };
    
    // Validate
    if (!transferData.firstName || !transferData.lastName || !transferData.email || !transferData.phone) {
        showToast(translate('forms.required', {}, 'Vul alle verplichte velden in'), 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(transferData.email)) {
        showToast(translate('forms.invalidEmail', {}, 'Voer een geldig e-mailadres in'), 'error');
        return;
    }
    
    // Add contact history entry
    const newCustomerName = transferData.middleName 
        ? `${transferData.salutation} ${transferData.firstName} ${transferData.middleName} ${transferData.lastName}`
        : `${transferData.salutation} ${transferData.firstName} ${transferData.lastName}`;

    if (window.kiwiApi) {
        try {
            await window.kiwiApi.post(
                `${subscriptionsApiUrl}/${currentCustomer.id}/${subscriptionId}/restitution-transfer`,
                { transferData }
            );
        } catch (error) {
            showToast(error.message || translate('subscription.transferFailed', {}, 'Overzetten via backend mislukt'), 'error');
            return;
        }
    } else {
        subscription.status = 'transferred';
        subscription.transferredTo = {
            ...transferData,
            transferDate: new Date().toISOString()
        };
        delete subscription.refundInfo;

        pushContactHistory(
            currentCustomer,
            {
                type: 'Restitutie Ongedaan - Abonnement Overgezet',
                description: `Restitutie van ${subscription.magazine} ongedaan gemaakt. Abonnement overgezet naar ${newCustomerName} (${transferData.email}) op ${transferData.address}, ${transferData.postalCode} ${transferData.city}.`
            },
            { highlight: true, persist: false }
        );

        saveCustomers();
    }
    
    // Close form
    closeForm('restitutionTransferForm');
    
    // Refresh display
    await selectCustomer(currentCustomer.id);
    
    showToast(
        translate('subscription.transferred', { magazine: subscription.magazine, name: newCustomerName }, `${subscription.magazine} overgezet naar ${newCustomerName}`),
        'success'
    );
    
    // Clear stored subscription ID
    window.restitutionRevertSubId = null;
}

// Complete All Deceased Actions
async function completeAllDeceasedActions() {
    // Determine which form is active
    const step1c = document.getElementById('winbackStep1c');
    const step1d = document.getElementById('winbackStep1d');
    const step1e = document.getElementById('winbackStep1e');
    
    let transferData = null;
    let refundData = null;
    
    // Get the active form and extract data
    if (step1e.style.display !== 'none') {
        // Combined form
        transferData = getTransferDataFromForm(2);
        refundData = getRefundDataFromForm(2);
    } else if (step1d.style.display !== 'none') {
        // Only transfer
        transferData = getTransferDataFromForm(1);
    } else if (step1c.style.display !== 'none') {
        // Only refund
        refundData = getRefundDataFromForm(1);
    }

    // Validate transfer data if needed
    const transferActions = window.deceasedSubscriptionActions.filter(sa => sa.action === 'transfer');
    if (transferActions.length > 0 && transferData === null) {
        return;
    }

    if (transferActions.length > 0 && transferData) {
        if (!validateTransferData(transferData)) {
            return; // Validation error already shown
        }
    }
    
    // Validate refund data if needed
    const refundActions = window.deceasedSubscriptionActions.filter(sa => sa.action === 'cancel_refund');
    if (refundActions.length > 0 && refundData) {
        if (!validateRefundData(refundData)) {
            return; // Validation error already shown
        }
    }
    
    const processedMagazines = [];
    const actionsPayload = [];

    for (const action of transferActions) {
        processedMagazines.push(`${action.subscription.magazine} (overgezet)`);
        actionsPayload.push({
            subscriptionId: action.subscription.id,
            action: 'transfer',
            transferData
        });
    }

    for (const action of refundActions) {
        processedMagazines.push(`${action.subscription.magazine} (gerestitueerd)`);
        actionsPayload.push({
            subscriptionId: action.subscription.id,
            action: 'cancel_refund',
            refundData
        });
    }
    
    // Create contact history entry
    let historyDescription = `Abonnementen verwerkt i.v.m. overlijden:\n`;
    
    if (transferActions.length > 0) {
        const newCustomerName = transferData.middleName 
            ? `${transferData.salutation} ${transferData.firstName} ${transferData.middleName} ${transferData.lastName}`
            : `${transferData.salutation} ${transferData.firstName} ${transferData.lastName}`;
        historyDescription += `\nOvergezet naar ${newCustomerName} (${transferData.email}):\n`;
        historyDescription += transferActions.map(a => `- ${a.subscription.magazine}`).join('\n');
    }
    
    if (refundActions.length > 0) {
        historyDescription += `\n\nOpgezegd met restitutie naar ${refundData.email}:\n`;
        historyDescription += refundActions.map(a => `- ${a.subscription.magazine}`).join('\n');
        if (refundData.notes) {
            historyDescription += `\nNotities: ${refundData.notes}`;
        }
    }
    
    if (window.kiwiApi) {
        try {
            await window.kiwiApi.post(`${subscriptionsApiUrl}/${currentCustomer.id}/deceased-actions`, {
                actions: actionsPayload
            });
        } catch (error) {
            showToast(error.message || translate('subscription.deceasedProcessFailed', {}, 'Verwerken overlijden via backend mislukt'), 'error');
            return;
        }
    } else {
        // Process all actions locally
        for (const action of transferActions) {
            action.subscription.transferredTo = {
                ...transferData,
                transferDate: new Date().toISOString()
            };
            action.subscription.status = 'transferred';
        }

        for (const action of refundActions) {
            action.subscription.status = 'restituted';
            action.subscription.endDate = new Date().toISOString();
            action.subscription.refundInfo = {
                email: refundData.email,
                notes: refundData.notes,
                refundDate: new Date().toISOString()
            };
        }

        pushContactHistory(
            currentCustomer,
            {
                type: 'Overlijden - Meerdere Abonnementen',
                description: historyDescription
            },
            { highlight: true, persist: false }
        );

        saveCustomers();
    }

    closeForm('winbackFlow');
    
    // Refresh display
    await selectCustomer(currentCustomer.id);
    
    showToast(
        translate(
            'subscription.processed',
            { count: processedMagazines.length },
            `${processedMagazines.length} abonnement(en) verwerkt. Bevestigingen worden verstuurd.`
        ),
        'success'
    );
    
    // Reset
    window.deceasedSubscriptionActions = null;
}

// Get Transfer Data from Form (using unified customer form component)
function getTransferDataFromForm(formVersion) {
    const prefix = formVersion === 2 ? 'transfer2' : 'transfer';
    const data = getCustomerFormData(prefix);
    const birthday = ensureBirthdayValue(prefix, false);

    if (birthday === null) {
        return null;
    }

    const sameAddress = document.getElementById(`${prefix}SameAddress`)?.checked || false;

    // If same address is checked, override with current customer address
    if (sameAddress && currentCustomer) {
        data.postalCode = currentCustomer.postalCode;
        data.houseNumber = currentCustomer.houseNumber;
        data.address = currentCustomer.address;
        data.city = currentCustomer.city;
    }
    
    // Convert initials to firstName for compatibility
    return {
        salutation: data.salutation,
        firstName: data.initials,
        middleName: data.middleName,
        lastName: data.lastName,
        birthday: birthday,
        email: data.email,
        phone: data.phone,
        postalCode: data.postalCode,
        houseNumber: data.houseNumber,
        address: data.address,
        city: data.city
    };
}

// Get Refund Data from Form
function getRefundDataFromForm(formVersion) {
    const suffix = formVersion === 2 ? '2' : '';
    return {
        email: document.getElementById(`refundEmail${suffix}`).value.trim(),
        notes: document.getElementById(`refundNotes${suffix}`).value.trim()
    };
}

// Validate Transfer Data
function validateTransferData(data) {
    if (!data.firstName || !data.lastName || !data.email || !data.phone || !data.birthday) {
        showToast(translate('forms.newSubscriberRequired', {}, 'Vul alle verplichte velden in voor de nieuwe abonnee'), 'error');
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        showToast(translate('forms.newSubscriberInvalidEmail', {}, 'Voer een geldig e-mailadres in voor de nieuwe abonnee'), 'error');
        return false;
    }
    
    if (!data.postalCode || !data.houseNumber || !data.address || !data.city) {
        showToast(translate('forms.newSubscriberAddressMissing', {}, 'Vul alle adresvelden in voor de nieuwe abonnee'), 'error');
        return false;
    }
    
    return true;
}

// Validate Refund Data
function validateRefundData(data) {
    if (!data.email) {
        showToast(translate('forms.refundEmailMissing', {}, 'Voer een e-mailadres in voor de restitutiebevestiging'), 'error');
        return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        showToast(translate('forms.refundEmailInvalid', {}, 'Voer een geldig e-mailadres in voor de restitutie'), 'error');
        return false;
    }
    
    return true;
}



// Complete Winback
async function completeWinback() {
    const result = document.querySelector('input[name="winbackResult"]:checked');
    
    if (!result) {
        showToast(translate('winback.selectOutcome', {}, 'Selecteer een resultaat'), 'error');
        return;
    }

    const subId = window.cancellingSubscriptionId;
    const subscription = currentCustomer.subscriptions.find(s => s.id === subId);
    
    if (window.kiwiApi) {
        try {
            await window.kiwiApi.post(`${subscriptionsApiUrl}/${currentCustomer.id}/${subId}`, {
                result: result.value,
                offer: selectedOffer
            });
        } catch (error) {
            showToast(error.message || translate('winback.saveFailed', {}, 'Winback opslaan via backend mislukt'), 'error');
            return;
        }
    } else if (result.value === 'accepted') {
        // Customer accepted offer
        pushContactHistory(
            currentCustomer,
            {
                type: 'Winback succesvol',
                description: `Klant accepteerde winback aanbod: ${selectedOffer.title}. Abonnement ${subscription.magazine} blijft actief.`
            },
            { highlight: true, persist: false }
        );
    } else {
        // Customer declined, cancel subscription
        currentCustomer.subscriptions = currentCustomer.subscriptions.filter(s => s.id !== subId);

        pushContactHistory(
            currentCustomer,
            {
                type: 'Abonnement opgezegd',
                description: `Klant heeft abonnement ${subscription.magazine} opgezegd na winback poging.`
            },
            { highlight: true, persist: false }
        );
    }

    if (!window.kiwiApi) {
        saveCustomers();
    }
    closeForm('winbackFlow');
    
    // Refresh display
    await selectCustomer(currentCustomer.id);

    if (result.value === 'accepted') {
        showToast(translate('winback.success', {}, 'Winback succesvol! Klant blijft abonnee.'), 'success');
    } else {
        showToast(translate('subscription.cancelled', {}, 'Abonnement opgezegd'), 'error');
    }
    
    // Reset
    selectedOffer = null;
    window.cancellingSubscriptionId = null;
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
    if (formId === 'newSubscriptionForm') {
        resetAllSubscriptionDuplicateStates();
    }

    const form = document.getElementById(formId);
    if (form) {
        form.style.display = 'none';
    }
}

function mapToastTypeToContactType(toastType) {
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
    if (currentCustomer) {
        const recentEntry = contactHistoryState.lastEntry;
        const now = Date.now();
        const justLoggedMutation = Boolean(
            recentEntry &&
            contactHistoryState.highlightId &&
            recentEntry.id === contactHistoryState.highlightId &&
            now - recentEntry.createdAt < 1500
        );

        if (type === 'success' && justLoggedMutation) {
            return;
        }

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

// Debug Mode - Secret Key Sequence
const isDebugModalEnabled = () => {
    const flags = window.featureFlags;
    if (!flags || typeof flags.isEnabled !== 'function') {
        return true;
    }

    return flags.isEnabled('debugModal');
};

let debugKeySequence = [];
const DEBUG_KEY = ']';
const DEBUG_KEY_COUNT = 4;

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    const debugFeatureEnabled = isDebugModalEnabled();

    // Debug mode activation - press ']' 4 times
    if (debugFeatureEnabled) {
        if (e.key === DEBUG_KEY) {
            debugKeySequence.push(Date.now());
            
            // Keep only recent keypresses (within 10 seconds)
            debugKeySequence = debugKeySequence.filter(time => Date.now() - time < 10000);
            
            // Check if we have 4 presses
            if (debugKeySequence.length >= DEBUG_KEY_COUNT) {
                openDebugModal();
                debugKeySequence = []; // Reset sequence
            }
        } else {
            // Reset sequence on any other key
            debugKeySequence = [];
        }
    }
    
    // Escape to close forms and modals
    if (e.key === 'Escape') {
        // Close debug modal if open
        const debugModal = document.getElementById('debugModal');
        if (debugModal.classList.contains('show')) {
            closeDebugModal();
            return;
        }
        
        // Close forms
        document.querySelectorAll('.form-container').forEach(form => {
            if (form.style.display === 'flex') {
                form.style.display = 'none';
            }
        });
    }
    
    // Ctrl/Cmd + K for search focus
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('searchName').focus();
    }
});


// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('debugModal');
    const statusMenu = document.getElementById('agentStatusMenu');
    const profileTrigger = document.getElementById('agentProfileTrigger');

    const clickInsideStatusMenu = statusMenu && statusMenu.contains(e.target);
    const clickOnProfileTrigger = profileTrigger && profileTrigger.contains(e.target);
    const menuIsOpen = statusMenu && !statusMenu.hidden;

    if (menuIsOpen && !clickInsideStatusMenu && !clickOnProfileTrigger) {
        closeStatusMenu();
    }

    if (e.target === modal) {
        closeDebugModal();
    }
});

// Handle payment method selection - show/hide IBAN field
document.addEventListener('change', (e) => {
    if (e.target.name === 'subPayment' || e.target.name === 'editPayment') {
        const additionalInput = e.target.closest('.payment-option').querySelector('.additional-input');
        if (additionalInput) {
            // Payment selected, IBAN field is shown via CSS
            const ibanInput = additionalInput.querySelector('input[type="text"]');
            if (ibanInput && e.target.value === 'automatisch') {
                ibanInput.setAttribute('required', 'required');
            } else if (ibanInput) {
                ibanInput.removeAttribute('required');
            }
        }
    }
});
