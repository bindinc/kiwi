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

// ============================================================================
// Birthday helpers (shared across NAW forms)
// ============================================================================

const BIRTHDAY_MONTHS = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maart' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Augustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
];

function populateBirthdayFields(prefix) {
    const daySelect = document.getElementById(`${prefix}BirthdayDay`);
    const monthSelect = document.getElementById(`${prefix}BirthdayMonth`);
    const yearSelect = document.getElementById(`${prefix}BirthdayYear`);

    if (!daySelect || !monthSelect || !yearSelect) return;

    // Populate Days
    if (daySelect.options.length <= 1) {
        for (let i = 1; i <= 31; i++) {
            const day = String(i).padStart(2, '0');
            const option = document.createElement('option');
            option.value = day;
            option.textContent = i;
            daySelect.appendChild(option);
        }
    }

    // Populate Months
    if (monthSelect.options.length <= 1) {
        BIRTHDAY_MONTHS.forEach(month => {
            const option = document.createElement('option');
            option.value = month.value;
            option.textContent = month.label;
            monthSelect.appendChild(option);
        });
    }

    // Populate Years
    if (yearSelect.options.length <= 1) {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 120;
        for (let year = currentYear; year >= startYear; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        }
    }
}

function buildBirthdayValue(prefix) {
    const day = document.getElementById(`${prefix}BirthdayDay`)?.value;
    const month = document.getElementById(`${prefix}BirthdayMonth`)?.value;
    const year = document.getElementById(`${prefix}BirthdayYear`)?.value;

    // If all empty, return empty string (valid, but empty)
    if (!day && !month && !year) return '';

    // If any is missing, return null (invalid)
    if (!day || !month || !year) return null;

    // Validate date
    const date = new Date(`${year}-${month}-${day}`);
    if (isNaN(date.getTime()) || date.getDate() !== parseInt(day) || date.getMonth() + 1 !== parseInt(month)) {
        return null; // Invalid date (e.g. 31 Feb)
    }

    return `${year}-${month}-${day}`;
}

function ensureBirthdayValue(prefix, required = false) {
    const birthday = buildBirthdayValue(prefix);

    if (birthday === null) {
         showToast(translate('forms.invalidBirthday', {}, 'Voer een geldige geboortedatum in'), 'error');
         return null;
    }

    if (!birthday && required) {
        showToast(translate('forms.invalidBirthday', {}, 'Voer een geldige geboortedatum in'), 'error');
        return null;
    }

    return birthday || '';
}

function setBirthdayFields(prefix, birthday) {
    const daySelect = document.getElementById(`${prefix}BirthdayDay`);
    const monthSelect = document.getElementById(`${prefix}BirthdayMonth`);
    const yearSelect = document.getElementById(`${prefix}BirthdayYear`);

    if (!daySelect || !monthSelect || !yearSelect) return;

    if (!birthday) {
        daySelect.value = '';
        monthSelect.value = '';
        yearSelect.value = '';
        return;
    }

    const [year, month, day] = birthday.split('-');
    if (year && month && day) {
        yearSelect.value = year;
        monthSelect.value = month;
        daySelect.value = day;
    }
}

// ============================================================================
// DRY: Reusable Customer Data Form Component
// ============================================================================

/**
 * Renders a unified customer data form into a container
 * @param {string} containerId - ID of the container element
 * @param {string} prefix - Prefix for all form field IDs (e.g., 'sub', 'article', 'transfer')
 * @param {object} config - Configuration options
 * @param {boolean} config.includePhone - Include phone field (default: true)
 * @param {boolean} config.includeEmail - Include email field (default: true)
 * @param {boolean} config.phoneRequired - Make phone required (default: false)
 * @param {boolean} config.emailRequired - Make email required (default: true)
 * @param {boolean} config.showSameAddressCheckbox - Show "same address" checkbox (default: false)
 */
function renderCustomerForm(containerId, prefix, config = {}) {
    const defaults = {
        includePhone: true,
        includeEmail: true,
        phoneRequired: false,
        emailRequired: true,
        showSameAddressCheckbox: false
    };
    const cfg = { ...defaults, ...config };
    const phonePlaceholderBase = translate('forms.phonePlaceholder', {}, 'Telefoonnummer');
    const emailPlaceholderBase = translate('forms.emailPlaceholder', {}, 'E-mailadres');
    const phonePlaceholder = `${phonePlaceholderBase}${cfg.phoneRequired ? '*' : ''}`;
    const emailPlaceholder = `${emailPlaceholderBase}${cfg.emailRequired ? '*' : ''}`;

    const html = `
        <h3 class="form-subtitle">${translate('forms.salutationLabel', {}, 'Aanhef *')}</h3>
        <div class="aanhef-row">
            <label><input type="radio" name="${prefix}Salutation" value="Dhr." required checked> ${translate('forms.salutationMr', {}, 'Dhr.')}</label>
            <label><input type="radio" name="${prefix}Salutation" value="Mevr."> ${translate('forms.salutationMrs', {}, 'Mevr.')}</label>
            <label><input type="radio" name="${prefix}Salutation" value="Anders"> ${translate('forms.salutationOther', {}, 'Anders')}</label>
        </div>
        
        <div class="form-row">
            <input type="text" id="${prefix}Initials" placeholder="${translate('forms.initialsPlaceholder', {}, 'Voorletters*')}" required>
            <input type="text" id="${prefix}MiddleName" placeholder="${translate('forms.middleNamePlaceholder', {}, 'Tussenvoegsel')}">
            <input type="text" id="${prefix}LastName" placeholder="${translate('forms.lastNamePlaceholder', {}, 'Achternaam*')}" required>
        </div>

        <div class="form-group">
            <label>${translate('forms.birthdayLabel', {}, 'Geboortedatum*')}</label>
            <div class="form-row">
                <select id="${prefix}BirthdayDay">
                    <option value="">${translate('forms.birthdayDayPlaceholder', {}, 'Dag')}</option>
                </select>
                <select id="${prefix}BirthdayMonth">
                    <option value="">${translate('forms.birthdayMonthPlaceholder', {}, 'Maand')}</option>
                </select>
                <select id="${prefix}BirthdayYear">
                    <option value="">${translate('forms.birthdayYearPlaceholder', {}, 'Jaar')}</option>
                </select>
            </div>
        </div>

        <div class="form-row">
            <input type="text" id="${prefix}PostalCode" placeholder="${translate('forms.postalCodePlaceholder', {}, 'Postcode*')}" pattern="^[1-9][0-9]{3}[a-zA-Z]{2}$" title="${translate('forms.postalCodeTitle', {}, 'Voer een geldige postcode in (bijv. 1234AB)')}" required>
            <input type="text" id="${prefix}HouseNumber" placeholder="${translate('forms.houseNumberPlaceholder', {}, 'Huisnr. (en letter)*')}" maxlength="7" pattern="^[1-9][0-9]{0,5}[A-Z]?$" title="${translate('forms.houseNumberTitle', {}, 'Voer een geldig huisnummer in (bijv. 123 of 123A)')}" required>
            <input type="text" id="${prefix}HouseExt" placeholder="${translate('forms.houseExtensionPlaceholder', {}, 'Toevoeging')}" maxlength="10">
        </div>
        
        <div class="form-row">
            <input type="text" id="${prefix}Address" placeholder="${translate('forms.streetPlaceholder', {}, 'Straat*')}" required>
            <input type="text" id="${prefix}City" placeholder="${translate('forms.cityPlaceholder', {}, 'Plaats*')}" required>
        </div>
        
        ${cfg.includePhone || cfg.includeEmail ? `
        <div class="form-row">
            ${cfg.includePhone ? `<input type="tel" id="${prefix}Phone" placeholder="${phonePlaceholder}" ${cfg.phoneRequired ? 'required' : ''}>` : ''}
            ${cfg.includeEmail ? `<input type="email" id="${prefix}Email" placeholder="${emailPlaceholder}" ${cfg.emailRequired ? 'required' : ''}>` : ''}
        </div>
        ` : ''}
        
        ${cfg.showSameAddressCheckbox ? `
        <div class="form-group">
            <label>
                <input type="checkbox" id="${prefix}SameAddress" data-action="toggle-customer-form-address" data-action-event="change" data-arg-prefix="${prefix}">
                ${translate('forms.sameAddressAsOriginalSubscriber', {}, 'Zelfde adres als originele abonnee')}
            </label>
        </div>
        ` : ''}
    `;

    document.getElementById(containerId).innerHTML = html;
    populateBirthdayFields(prefix);
}

/**
 * Gets customer data from a rendered customer form
 * @param {string} prefix - Prefix used when rendering the form
 * @returns {object} Customer data object
 */
function getCustomerFormData(prefix) {
    return {
        salutation: document.querySelector(`input[name="${prefix}Salutation"]:checked`)?.value || '',
        initials: document.getElementById(`${prefix}Initials`)?.value || '',
        middleName: document.getElementById(`${prefix}MiddleName`)?.value || '',
        lastName: document.getElementById(`${prefix}LastName`)?.value || '',
        birthday: buildBirthdayValue(prefix) || '',
        postalCode: document.getElementById(`${prefix}PostalCode`)?.value || '',
        houseNumber: document.getElementById(`${prefix}HouseNumber`)?.value || '',
        houseExt: document.getElementById(`${prefix}HouseExt`)?.value || '',
        address: document.getElementById(`${prefix}Address`)?.value || '',
        city: document.getElementById(`${prefix}City`)?.value || '',
        phone: document.getElementById(`${prefix}Phone`)?.value || '',
        email: document.getElementById(`${prefix}Email`)?.value || ''
    };
}

/**
 * Sets customer data in a rendered customer form
 * @param {string} prefix - Prefix used when rendering the form
 * @param {object} data - Customer data object
 */
function setCustomerFormData(prefix, data) {
    if (data.salutation) {
        const salutationRadio = document.querySelector(`input[name="${prefix}Salutation"][value="${data.salutation}"]`);
        if (salutationRadio) salutationRadio.checked = true;
    }
    if (data.initials) document.getElementById(`${prefix}Initials`).value = data.initials;
    if (data.middleName) document.getElementById(`${prefix}MiddleName`).value = data.middleName;
    if (data.lastName) document.getElementById(`${prefix}LastName`).value = data.lastName;
    if (data.birthday) setBirthdayFields(prefix, data.birthday);
    if (data.postalCode) document.getElementById(`${prefix}PostalCode`).value = data.postalCode;
    if (data.houseNumber) document.getElementById(`${prefix}HouseNumber`).value = data.houseNumber;
    if (data.houseExt) document.getElementById(`${prefix}HouseExt`).value = data.houseExt;
    if (data.address) document.getElementById(`${prefix}Address`).value = data.address;
    if (data.city) document.getElementById(`${prefix}City`).value = data.city;
    if (data.phone && document.getElementById(`${prefix}Phone`)) document.getElementById(`${prefix}Phone`).value = data.phone;
    if (data.email && document.getElementById(`${prefix}Email`)) document.getElementById(`${prefix}Email`).value = data.email;
}

/**
 * Toggles address fields visibility (for "same address" checkbox)
 * @param {string} prefix - Prefix used when rendering the form
 */
function toggleCustomerFormAddress(prefix) {
    const checkbox = document.getElementById(`${prefix}SameAddress`);
    const addressFields = ['PostalCode', 'HouseNumber', 'HouseExt', 'Address', 'City'];
    
    addressFields.forEach(field => {
        const element = document.getElementById(`${prefix}${field}`);
        if (element) {
            if (checkbox.checked) {
                element.disabled = true;
                element.removeAttribute('required');
                element.style.opacity = '0.5';
            } else {
                element.disabled = false;
                if (!field.includes('HouseExt') && !field.includes('MiddleName')) {
                    element.setAttribute('required', '');
                }
                element.style.opacity = '1';
            }
        }
    });
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getSubscriptionRoleConfig(role) {
    if (role === 'recipient') {
        return {
            roleLabel: 'ontvanger',
            prefix: 'subRecipient',
            modeName: 'recipientMode',
            existingSectionId: 'recipientExistingSection',
            createSectionId: 'recipientCreateSection',
            createFormContainerId: 'recipientCreateForm',
            duplicateCheckId: 'recipientDuplicateCheck',
            searchQueryId: 'recipientSearchQuery',
            searchResultsId: 'recipientSearchResults',
            selectedPersonId: 'recipientSelectedPerson'
        };
    }

    if (role === 'requester') {
        return {
            roleLabel: 'aanvrager/betaler',
            prefix: 'subRequester',
            modeName: 'requesterMode',
            existingSectionId: 'requesterExistingSection',
            createSectionId: 'requesterCreateSection',
            createFormContainerId: 'requesterCreateForm',
            duplicateCheckId: 'requesterDuplicateCheck',
            searchQueryId: 'requesterSearchQuery',
            searchResultsId: 'requesterSearchResults',
            selectedPersonId: 'requesterSelectedPerson'
        };
    }

    return null;
}

function buildPersonDisplayName(person) {
    if (!person) {
        return '';
    }
    const middleName = person.middleName ? `${person.middleName} ` : '';
    return `${person.firstName || ''} ${middleName}${person.lastName || ''}`.trim();
}

function buildPersonDisplayAddress(person) {
    if (!person) {
        return '';
    }
    const postalCode = (person.postalCode || '').trim();
    const city = (person.city || '').trim();
    if (!postalCode && !city) {
        return '';
    }
    return `${postalCode} ${city}`.trim();
}

function formatPersonReference(personId) {
    return translate('common.personWithId', { id: personId }, `persoon #${personId}`);
}

function renderSubscriptionRoleSelectedPerson(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    const selectedNode = document.getElementById(cfg.selectedPersonId);
    if (!selectedNode) return;

    const selectedPerson = subscriptionRoleState[role].selectedPerson;
    if (!selectedPerson || selectedPerson.id === undefined || selectedPerson.id === null) {
        selectedNode.classList.add('empty');
        selectedNode.textContent = role === 'recipient'
            ? translate('subscription.recipientNotSelected', {}, 'Geen ontvanger geselecteerd')
            : translate('subscription.requesterNotSelected', {}, 'Geen aanvrager/betaler geselecteerd');
        return;
    }

    const name = escapeHtml(buildPersonDisplayName(selectedPerson) || formatPersonReference(selectedPerson.id));
    const address = escapeHtml(buildPersonDisplayAddress(selectedPerson));
    const personId = escapeHtml(formatPersonReference(selectedPerson.id));
    const addressLine = address ? ` · ${address}` : '';
    selectedNode.classList.remove('empty');
    selectedNode.innerHTML = `<strong>${name}</strong> · ${personId}${addressLine}`;
}

function renderRequesterSameSummary() {
    const summaryNode = document.getElementById('requesterSameSummary');
    if (!summaryNode) return;

    if (!subscriptionRoleState.requesterSameAsRecipient) {
        summaryNode.textContent = '';
        return;
    }

    const recipient = subscriptionRoleState.recipient.selectedPerson;
    if (recipient && recipient.id !== undefined && recipient.id !== null) {
        const name = escapeHtml(buildPersonDisplayName(recipient) || formatPersonReference(recipient.id));
        summaryNode.innerHTML = translate(
            'subscription.requesterFollowsRecipient',
            { name, person: formatPersonReference(recipient.id) },
            `Aanvrager/betaler volgt de ontvanger: <strong>${name}</strong> · ${formatPersonReference(recipient.id)}.`
        );
        return;
    }

    if (subscriptionRoleState.recipient.mode === 'create') {
        const initials = document.getElementById('subRecipientInitials')?.value?.trim() || '';
        const middleName = document.getElementById('subRecipientMiddleName')?.value?.trim() || '';
        const lastName = document.getElementById('subRecipientLastName')?.value?.trim() || '';
        const composedName = [initials, middleName, lastName].filter(Boolean).join(' ');
        if (composedName) {
            const safeComposedName = escapeHtml(composedName);
            summaryNode.innerHTML = translate(
                'subscription.requesterFollowsNewRecipient',
                { name: safeComposedName },
                `Aanvrager/betaler volgt de nieuwe ontvanger: <strong>${safeComposedName}</strong>.`
            );
            return;
        }
    }

    summaryNode.textContent = translate(
        'subscription.requesterFollowsSelectedRecipient',
        {},
        'Aanvrager/betaler volgt de geselecteerde ontvanger.'
    );
}

function clearSubscriptionRoleCreateForm(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    const formContainer = document.getElementById(cfg.createFormContainerId);
    if (!formContainer) return;

    formContainer.innerHTML = '';
    clearSubscriptionDuplicateUi(role);
}

function ensureSubscriptionRoleCreateForm(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    const formContainer = document.getElementById(cfg.createFormContainerId);
    if (!formContainer) return;

    if (formContainer.childElementCount === 0) {
        renderCustomerForm(cfg.createFormContainerId, cfg.prefix, {
            includePhone: true,
            includeEmail: true,
            phoneRequired: false,
            emailRequired: true
        });
    }

    bindSubscriptionDuplicateListeners(role);
    void evaluateSubscriptionDuplicateRole(role);
}

function setSubscriptionRoleMode(role, mode) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    subscriptionRoleState[role].mode = mode === 'create' ? 'create' : 'existing';

    const modeRadio = document.querySelector(`input[name="${cfg.modeName}"][value="${subscriptionRoleState[role].mode}"]`);
    if (modeRadio) {
        modeRadio.checked = true;
    }

    const existingSection = document.getElementById(cfg.existingSectionId);
    const createSection = document.getElementById(cfg.createSectionId);
    if (existingSection) existingSection.style.display = subscriptionRoleState[role].mode === 'existing' ? 'block' : 'none';
    if (createSection) createSection.style.display = subscriptionRoleState[role].mode === 'create' ? 'block' : 'none';

    if (subscriptionRoleState[role].mode === 'create') {
        ensureSubscriptionRoleCreateForm(role);
        subscriptionRoleState[role].selectedPerson = null;
        renderSubscriptionRoleSelectedPerson(role);
    } else {
        resetSubscriptionDuplicateRoleState(role);
        clearSubscriptionRoleCreateForm(role);
    }

    if (role === 'recipient' && subscriptionRoleState.requesterSameAsRecipient) {
        renderRequesterSameSummary();
    }
}

function toggleRequesterSameAsRecipient() {
    const sameCheckbox = document.getElementById('requesterSameAsRecipient');
    const requesterDetails = document.getElementById('requesterRoleDetails');
    const sameSummary = document.getElementById('requesterSameSummary');
    if (!sameCheckbox) {
        return;
    }

    subscriptionRoleState.requesterSameAsRecipient = sameCheckbox.checked;
    if (requesterDetails) {
        requesterDetails.style.display = sameCheckbox.checked ? 'none' : 'block';
    }
    if (sameSummary) {
        sameSummary.style.display = sameCheckbox.checked ? 'block' : 'none';
    }

    if (sameCheckbox.checked) {
        resetSubscriptionDuplicateRoleState('requester');
        clearSubscriptionRoleCreateForm('requester');
        renderRequesterSameSummary();
    } else if (subscriptionRoleState.requester.mode === 'create') {
        ensureSubscriptionRoleCreateForm('requester');
    }
}

function getSelectedSubscriptionRolePersonId(role) {
    const selectedPerson = subscriptionRoleState[role]?.selectedPerson;
    if (!selectedPerson || selectedPerson.id === undefined || selectedPerson.id === null) {
        return null;
    }

    const personId = Number(selectedPerson.id);
    return Number.isFinite(personId) ? personId : null;
}

function hasSameSelectedExistingRecipientAndRequester() {
    const recipientIsExisting = subscriptionRoleState.recipient.mode === 'existing';
    const requesterIsExisting = subscriptionRoleState.requester.mode === 'existing';
    if (!recipientIsExisting || !requesterIsExisting) {
        return false;
    }

    const recipientId = getSelectedSubscriptionRolePersonId('recipient');
    const requesterId = getSelectedSubscriptionRolePersonId('requester');
    if (recipientId === null || requesterId === null) {
        return false;
    }

    return recipientId === requesterId;
}

function normalizeRequesterSameAsRecipientSelection(options = {}) {
    const { silent = false } = options;
    if (subscriptionRoleState.requesterSameAsRecipient) {
        return false;
    }

    if (!hasSameSelectedExistingRecipientAndRequester()) {
        return false;
    }

    const sameCheckbox = document.getElementById('requesterSameAsRecipient');
    if (sameCheckbox && !sameCheckbox.checked) {
        sameCheckbox.checked = true;
    }

    toggleRequesterSameAsRecipient();

    if (!silent) {
        showToast(
            translate(
                'subscription.samePersonAutoEnabled',
                {},
                'Ontvanger en aanvrager zijn dezelfde persoon. "Zelfde persoon als ontvanger" is automatisch ingeschakeld.'
            ),
            'info'
        );
    }

    return true;
}

function normalizeRoleSearchQuery(value) {
    return String(value || '').trim();
}

function getSubscriptionDuplicateRoleState(role) {
    return subscriptionDuplicateState[role] || null;
}

function clearSubscriptionDuplicateDebounceTimer(roleDuplicateState) {
    if (!roleDuplicateState || !roleDuplicateState.debounceTimer) {
        return;
    }
    window.clearTimeout(roleDuplicateState.debounceTimer);
    roleDuplicateState.debounceTimer = null;
}

function clearSubscriptionDuplicateUi(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    const duplicateNode = document.getElementById(cfg.duplicateCheckId);
    if (!duplicateNode) return;

    duplicateNode.classList.add('hidden');
    duplicateNode.innerHTML = '';
}

function resetSubscriptionDuplicateRoleState(role) {
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState) {
        return;
    }

    clearSubscriptionDuplicateDebounceTimer(roleDuplicateState);
    roleDuplicateState.requestVersion += 1;
    roleDuplicateState.lastApiStartedAt = 0;
    roleDuplicateState.lastApiFingerprint = '';
    roleDuplicateState.lastFingerprint = 'none';
    roleDuplicateState.acknowledgedFingerprint = '';
    roleDuplicateState.expandedFingerprint = '';
    roleDuplicateState.isExpanded = false;
    roleDuplicateState.isChecking = false;
    roleDuplicateState.apiWarning = '';
    roleDuplicateState.cache = {};
    roleDuplicateState.resolvedFingerprints = {};
    roleDuplicateState.strongMatches = [];
    clearSubscriptionDuplicateUi(role);
}

function resetAllSubscriptionDuplicateStates() {
    resetSubscriptionDuplicateRoleState('recipient');
    resetSubscriptionDuplicateRoleState('requester');
}

function normalizeDuplicatePostalCode(value) {
    return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function normalizeDuplicateHouseToken(houseNumber, houseExt = '') {
    const combined = `${String(houseNumber || '').trim()}${String(houseExt || '').trim()}`;
    return combined.replace(/\s+/g, '').toUpperCase();
}

function normalizeDuplicateEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeDuplicateLastName(value) {
    return normalizeNameFragment(String(value || '').trim());
}

function buildSubscriptionDuplicateFingerprint(normalizedInput) {
    if (
        normalizedInput.postalCode
        && normalizedInput.houseToken
        && normalizedInput.lastNameNormalized
    ) {
        return `address:${normalizedInput.postalCode}:${normalizedInput.houseToken}:${normalizedInput.lastNameNormalized}`;
    }

    if (normalizedInput.email) {
        return `email:${normalizedInput.email}`;
    }

    if (normalizedInput.phoneDigits.length >= 9 && normalizedInput.lastNameNormalized) {
        return `phone:${normalizedInput.phoneDigits}:${normalizedInput.lastNameNormalized}`;
    }

    return 'none';
}

function normalizeSubscriptionDuplicateInput(data) {
    const lastNameRaw = String(data.lastName || '').trim();
    const middleNameRaw = String(data.middleName || '').trim();
    const postalCode = normalizeDuplicatePostalCode(data.postalCode);
    const houseToken = normalizeDuplicateHouseToken(data.houseNumber, data.houseExt);
    const email = normalizeDuplicateEmail(data.email);
    const phoneDigits = normalizePhone(String(data.phone || ''));
    const lastNameNormalized = normalizeDuplicateLastName(lastNameRaw);
    const fullLastNameNormalized = normalizeDuplicateLastName(`${middleNameRaw} ${lastNameRaw}`.trim());

    return {
        lastNameRaw,
        middleNameRaw,
        postalCode,
        houseToken,
        email,
        phoneDigits,
        lastNameNormalized,
        fullLastNameNormalized,
        fingerprint: buildSubscriptionDuplicateFingerprint({
            postalCode,
            houseToken,
            email,
            phoneDigits,
            lastNameNormalized
        })
    };
}

function collectSubscriptionRoleDuplicateInput(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) {
        return null;
    }

    const roleState = subscriptionRoleState[role];
    if (!roleState || roleState.mode !== 'create') {
        return null;
    }

    const data = getCustomerFormData(cfg.prefix);
    return normalizeSubscriptionDuplicateInput(data);
}

function buildSubscriptionDuplicateApiRequest(normalizedInput) {
    if (!normalizedInput || normalizedInput.fingerprint === 'none') {
        return null;
    }

    const params = new URLSearchParams({
        page: '1',
        pageSize: String(DUPLICATE_CHECK_FETCH_LIMIT),
        sortBy: 'name'
    });

    if (normalizedInput.fingerprint.startsWith('address:')) {
        params.set('postalCode', normalizedInput.postalCode);
        params.set('houseNumber', normalizedInput.houseToken);
        params.set('name', normalizedInput.lastNameRaw.toLowerCase());
    } else if (normalizedInput.fingerprint.startsWith('email:')) {
        params.set('email', normalizedInput.email);
    } else if (normalizedInput.fingerprint.startsWith('phone:')) {
        params.set('phone', normalizedInput.phoneDigits);
    } else {
        return null;
    }

    return {
        fingerprint: normalizedInput.fingerprint,
        params
    };
}

function normalizeCandidateHouseToken(candidate) {
    return normalizeDuplicateHouseToken(candidate.houseNumber, candidate.houseExt || '');
}

function isStrongDuplicateCandidate(candidate, normalizedInput) {
    if (!candidate || !normalizedInput) {
        return false;
    }

    const candidateEmail = normalizeDuplicateEmail(candidate.email);
    const candidatePhone = normalizePhone(String(candidate.phone || ''));
    const candidatePostalCode = normalizeDuplicatePostalCode(candidate.postalCode);
    const candidateHouseToken = normalizeCandidateHouseToken(candidate);
    const candidateLastName = normalizeDuplicateLastName(candidate.lastName);

    const emailMatch = Boolean(
        normalizedInput.email
        && candidateEmail
        && normalizedInput.email === candidateEmail
    );

    const phoneMatch = Boolean(
        normalizedInput.phoneDigits.length >= 9
        && candidatePhone
        && normalizedInput.phoneDigits === candidatePhone
    );

    const lastNameMatches = Boolean(
        candidateLastName
        && (
            candidateLastName === normalizedInput.lastNameNormalized
            || (normalizedInput.fullLastNameNormalized && candidateLastName === normalizedInput.fullLastNameNormalized)
        )
    );

    const addressMatch = Boolean(
        normalizedInput.postalCode
        && normalizedInput.houseToken
        && normalizedInput.lastNameNormalized
        && candidatePostalCode === normalizedInput.postalCode
        && candidateHouseToken === normalizedInput.houseToken
        && lastNameMatches
    );

    return emailMatch || phoneMatch || addressMatch;
}

function findStrongDuplicateMatches(normalizedInput, persons) {
    if (!normalizedInput || !Array.isArray(persons) || persons.length === 0) {
        return [];
    }

    const matches = [];
    const seenIds = new Set();
    for (const person of persons) {
        if (!person || person.id === undefined || person.id === null) {
            continue;
        }
        const personId = Number(person.id);
        if (seenIds.has(personId)) {
            continue;
        }
        if (!isStrongDuplicateCandidate(person, normalizedInput)) {
            continue;
        }
        seenIds.add(personId);
        matches.push(person);
    }

    return matches;
}

function mergeDuplicateMatchLists(primaryMatches, secondaryMatches) {
    const merged = [];
    const seenIds = new Set();

    for (const candidate of [...(primaryMatches || []), ...(secondaryMatches || [])]) {
        if (!candidate || candidate.id === undefined || candidate.id === null) {
            continue;
        }
        const candidateId = Number(candidate.id);
        if (seenIds.has(candidateId)) {
            continue;
        }
        seenIds.add(candidateId);
        merged.push(candidate);
    }

    return merged;
}

function getFreshSubscriptionDuplicateCacheEntry(roleDuplicateState, fingerprint) {
    if (!roleDuplicateState || !fingerprint || fingerprint === 'none') {
        return null;
    }

    const cacheEntry = roleDuplicateState.cache[fingerprint];
    if (!cacheEntry) {
        return null;
    }

    if (Date.now() - cacheEntry.cachedAt > DUPLICATE_CHECK_CACHE_TTL_MS) {
        delete roleDuplicateState.cache[fingerprint];
        return null;
    }

    return cacheEntry;
}

function refreshSubscriptionDuplicateMatches(role, normalizedInput) {
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState || !normalizedInput) {
        return [];
    }

    const localStrongMatches = findStrongDuplicateMatches(normalizedInput, customers);
    const cacheEntry = getFreshSubscriptionDuplicateCacheEntry(roleDuplicateState, normalizedInput.fingerprint);
    const cachedStrongMatches = cacheEntry ? cacheEntry.matches : [];

    roleDuplicateState.strongMatches = mergeDuplicateMatchLists(localStrongMatches, cachedStrongMatches);
    return roleDuplicateState.strongMatches;
}

function renderSubscriptionDuplicateCheck(role) {
    const cfg = getSubscriptionRoleConfig(role);
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!cfg || !roleDuplicateState) return;

    const duplicateNode = document.getElementById(cfg.duplicateCheckId);
    if (!duplicateNode) return;

    const roleState = subscriptionRoleState[role];
    if (!roleState || roleState.mode !== 'create') {
        clearSubscriptionDuplicateUi(role);
        return;
    }

    const matches = roleDuplicateState.strongMatches || [];
    const hasMatches = matches.length > 0;
    const hasFingerprint = roleDuplicateState.lastFingerprint !== 'none';
    const shouldShowChecking = hasFingerprint && roleDuplicateState.isChecking;
    const shouldShowWarning = Boolean(roleDuplicateState.apiWarning);

    if (!hasMatches && !shouldShowChecking && !shouldShowWarning) {
        clearSubscriptionDuplicateUi(role);
        return;
    }

    duplicateNode.classList.remove('hidden');

    if (!hasMatches) {
        const checkingLine = shouldShowChecking
            ? `<div class="subscription-duplicate-inline-status">${escapeHtml(translate('subscription.duplicateCheck.checking', {}, 'Zoeken naar bestaande personen...'))}</div>`
            : '';
        const warningLine = shouldShowWarning
            ? `<div class="subscription-duplicate-inline-status muted">${escapeHtml(roleDuplicateState.apiWarning)}</div>`
            : '';
        duplicateNode.innerHTML = `${checkingLine}${warningLine}`;
        return;
    }

    const isExpanded = roleDuplicateState.isExpanded && roleDuplicateState.expandedFingerprint === roleDuplicateState.lastFingerprint;
    const toggleLabel = isExpanded
        ? translate('subscription.duplicateCheck.hideMatches', {}, 'Verberg matches')
        : translate('subscription.duplicateCheck.showMatches', {}, 'Toon matches');
    const duplicateTitle = translate(
        'subscription.duplicateCheck.possibleFound',
        { count: matches.length },
        `Mogelijk bestaande persoon gevonden (${matches.length}).`
    );
    const createAnywayLabel = translate('subscription.duplicateCheck.createAnyway', {}, 'Toch nieuwe persoon');
    const useExistingLabel = translate('subscription.duplicateCheck.useExisting', {}, 'Gebruik bestaande');
    const visibleMatches = matches.slice(0, DUPLICATE_CHECK_VISIBLE_LIMIT);

    const matchRows = visibleMatches.map((person) => {
        const safeId = escapeHtml(person.id);
        const safeName = escapeHtml(buildPersonDisplayName(person) || `Persoon #${person.id}`);
        const safeAddress = escapeHtml(buildPersonDisplayAddress(person));
        const safeAddressLine = safeAddress ? ` · ${safeAddress}` : '';
        return `
            <div class="subscription-duplicate-item">
                <div>
                    <strong>${safeName}</strong>
                    <div class="subscription-duplicate-item-meta">persoon #${safeId}${safeAddressLine}</div>
                </div>
                <button type="button" class="subscription-duplicate-action" data-action="select-subscription-duplicate-person" data-arg-role="${role}" data-arg-person-id="${Number(person.id)}">${escapeHtml(useExistingLabel)}</button>
            </div>
        `;
    }).join('');

    const moreMatchesLine = matches.length > DUPLICATE_CHECK_VISIBLE_LIMIT
        ? `<div class="subscription-duplicate-more">Nog ${matches.length - DUPLICATE_CHECK_VISIBLE_LIMIT} mogelijke match(es).</div>`
        : '';
    const checkingLine = shouldShowChecking
        ? `<div class="subscription-duplicate-inline-status">${escapeHtml(translate('subscription.duplicateCheck.checking', {}, 'Zoeken naar bestaande personen...'))}</div>`
        : '';
    const warningLine = shouldShowWarning
        ? `<div class="subscription-duplicate-inline-status muted">${escapeHtml(roleDuplicateState.apiWarning)}</div>`
        : '';

    duplicateNode.innerHTML = `
        <div class="subscription-duplicate-banner">
            <div class="subscription-duplicate-header">
                <div class="subscription-duplicate-title">${escapeHtml(duplicateTitle)}</div>
                <div class="subscription-duplicate-actions">
                    <button type="button" class="subscription-duplicate-action" data-action="toggle-subscription-duplicate-matches" data-arg-role="${role}">${escapeHtml(toggleLabel)}</button>
                    <button type="button" class="subscription-duplicate-action warning" data-action="acknowledge-subscription-duplicate-warning" data-arg-role="${role}">${escapeHtml(createAnywayLabel)}</button>
                </div>
            </div>
            ${checkingLine}
            ${warningLine}
            ${isExpanded ? `<div class="subscription-duplicate-list">${matchRows}</div>${moreMatchesLine}` : ''}
        </div>
    `;
}

function toggleSubscriptionDuplicateMatches(role) {
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState || roleDuplicateState.lastFingerprint === 'none') {
        return;
    }

    const shouldExpand = !(roleDuplicateState.isExpanded && roleDuplicateState.expandedFingerprint === roleDuplicateState.lastFingerprint);
    roleDuplicateState.isExpanded = shouldExpand;
    roleDuplicateState.expandedFingerprint = shouldExpand ? roleDuplicateState.lastFingerprint : '';
    renderSubscriptionDuplicateCheck(role);
}

function acknowledgeSubscriptionDuplicateWarning(role) {
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState || roleDuplicateState.lastFingerprint === 'none') {
        return;
    }

    roleDuplicateState.acknowledgedFingerprint = roleDuplicateState.lastFingerprint;
    roleDuplicateState.isExpanded = false;
    roleDuplicateState.expandedFingerprint = '';
    renderSubscriptionDuplicateCheck(role);
}

function selectSubscriptionDuplicatePerson(role, personId) {
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState) {
        return;
    }

    const selectedPerson = (roleDuplicateState.strongMatches || [])
        .find((entry) => Number(entry.id) === Number(personId));
    if (!selectedPerson) {
        showToast(translate('subscription.duplicateCheck.personNotFoundControlList', {}, 'Geselecteerde persoon niet gevonden in controlelijst'), 'error');
        return;
    }

    upsertCustomerInCache(selectedPerson);
    subscriptionRoleState[role].searchResults = [selectedPerson];
    subscriptionRoleState[role].selectedPerson = selectedPerson;
    setSubscriptionRoleMode(role, 'existing');
    renderSubscriptionRoleSelectedPerson(role);

    if (role === 'recipient' && subscriptionRoleState.requesterSameAsRecipient) {
        renderRequesterSameSummary();
    }
}

function waitForTimeout(milliseconds) {
    if (milliseconds <= 0) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        window.setTimeout(resolve, milliseconds);
    });
}

async function runSubscriptionDuplicateApiCheck(role, expectedFingerprint, options = {}) {
    const { force = false } = options;
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState || !window.kiwiApi || !expectedFingerprint || expectedFingerprint === 'none') {
        return;
    }

    const roleState = subscriptionRoleState[role];
    if (!roleState || roleState.mode !== 'create') {
        return;
    }

    const normalizedInput = collectSubscriptionRoleDuplicateInput(role);
    if (!normalizedInput || normalizedInput.fingerprint !== expectedFingerprint) {
        roleDuplicateState.isChecking = false;
        renderSubscriptionDuplicateCheck(role);
        return;
    }

    const cacheEntry = getFreshSubscriptionDuplicateCacheEntry(roleDuplicateState, expectedFingerprint);
    if (cacheEntry) {
        roleDuplicateState.resolvedFingerprints[expectedFingerprint] = true;
        refreshSubscriptionDuplicateMatches(role, normalizedInput);
        roleDuplicateState.isChecking = false;
        renderSubscriptionDuplicateCheck(role);
        return;
    }

    if (!force && roleDuplicateState.resolvedFingerprints[expectedFingerprint]) {
        roleDuplicateState.isChecking = false;
        renderSubscriptionDuplicateCheck(role);
        return;
    }

    const apiRequest = buildSubscriptionDuplicateApiRequest(normalizedInput);
    if (!apiRequest || apiRequest.fingerprint !== expectedFingerprint) {
        roleDuplicateState.isChecking = false;
        renderSubscriptionDuplicateCheck(role);
        return;
    }

    const elapsedSinceLastApi = Date.now() - roleDuplicateState.lastApiStartedAt;
    const minimumWait = Math.max(0, DUPLICATE_CHECK_MIN_API_INTERVAL_MS - elapsedSinceLastApi);
    await waitForTimeout(minimumWait);

    const postWaitInput = collectSubscriptionRoleDuplicateInput(role);
    if (!postWaitInput || postWaitInput.fingerprint !== expectedFingerprint) {
        roleDuplicateState.isChecking = false;
        renderSubscriptionDuplicateCheck(role);
        return;
    }

    const requestVersion = roleDuplicateState.requestVersion + 1;
    roleDuplicateState.requestVersion = requestVersion;
    roleDuplicateState.lastApiStartedAt = Date.now();
    roleDuplicateState.lastApiFingerprint = expectedFingerprint;
    roleDuplicateState.apiWarning = '';
    roleDuplicateState.isChecking = true;
    renderSubscriptionDuplicateCheck(role);

    try {
        const payload = await window.kiwiApi.get(`${personsApiUrl}?${apiRequest.params.toString()}`);
        if (requestVersion !== roleDuplicateState.requestVersion) {
            return;
        }

        const latestInput = collectSubscriptionRoleDuplicateInput(role);
        if (!latestInput || latestInput.fingerprint !== expectedFingerprint) {
            return;
        }

        const items = Array.isArray(payload && payload.items) ? payload.items : [];
        const apiStrongMatches = findStrongDuplicateMatches(latestInput, items);
        roleDuplicateState.cache[expectedFingerprint] = {
            cachedAt: Date.now(),
            matches: apiStrongMatches
        };
        roleDuplicateState.resolvedFingerprints[expectedFingerprint] = true;
        refreshSubscriptionDuplicateMatches(role, latestInput);
        roleDuplicateState.isChecking = false;
        roleDuplicateState.apiWarning = '';
        renderSubscriptionDuplicateCheck(role);
    } catch (error) {
        if (requestVersion !== roleDuplicateState.requestVersion) {
            return;
        }

        const latestInput = collectSubscriptionRoleDuplicateInput(role);
        if (!latestInput || latestInput.fingerprint !== expectedFingerprint) {
            return;
        }

        roleDuplicateState.resolvedFingerprints[expectedFingerprint] = true;
        roleDuplicateState.isChecking = false;
        roleDuplicateState.apiWarning = translate(
            'subscription.duplicateCheck.apiFallback',
            {},
            'Controle via backend tijdelijk niet beschikbaar. Lokale controle blijft actief.'
        );
        refreshSubscriptionDuplicateMatches(role, latestInput);
        renderSubscriptionDuplicateCheck(role);
        console.warn('Achtergrondcontrole van dubbele personen via API mislukt.', error);
    }
}

function scheduleSubscriptionDuplicateApiCheck(role, expectedFingerprint) {
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState || !expectedFingerprint || expectedFingerprint === 'none') {
        return;
    }

    clearSubscriptionDuplicateDebounceTimer(roleDuplicateState);
    const elapsedSinceLastApi = Date.now() - roleDuplicateState.lastApiStartedAt;
    const minimumWait = Math.max(0, DUPLICATE_CHECK_MIN_API_INTERVAL_MS - elapsedSinceLastApi);
    const waitMs = Math.max(DUPLICATE_CHECK_DEBOUNCE_MS, minimumWait);

    roleDuplicateState.isChecking = true;
    roleDuplicateState.apiWarning = '';
    renderSubscriptionDuplicateCheck(role);

    roleDuplicateState.debounceTimer = window.setTimeout(() => {
        roleDuplicateState.debounceTimer = null;
        void runSubscriptionDuplicateApiCheck(role, expectedFingerprint);
    }, waitMs);
}

async function evaluateSubscriptionDuplicateRole(role, options = {}) {
    const { forceApi = false } = options;
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState) {
        return {
            fingerprint: 'none',
            strongMatches: []
        };
    }

    const normalizedInput = collectSubscriptionRoleDuplicateInput(role);
    if (!normalizedInput) {
        clearSubscriptionDuplicateDebounceTimer(roleDuplicateState);
        roleDuplicateState.isChecking = false;
        roleDuplicateState.strongMatches = [];
        roleDuplicateState.lastFingerprint = 'none';
        renderSubscriptionDuplicateCheck(role);
        return {
            fingerprint: 'none',
            strongMatches: []
        };
    }

    const previousFingerprint = roleDuplicateState.lastFingerprint;
    roleDuplicateState.lastFingerprint = normalizedInput.fingerprint;
    if (previousFingerprint !== normalizedInput.fingerprint) {
        roleDuplicateState.isExpanded = false;
        roleDuplicateState.expandedFingerprint = '';
        roleDuplicateState.apiWarning = '';
    }

    refreshSubscriptionDuplicateMatches(role, normalizedInput);
    roleDuplicateState.isChecking = false;
    renderSubscriptionDuplicateCheck(role);

    const apiRequest = buildSubscriptionDuplicateApiRequest(normalizedInput);
    if (!apiRequest || !window.kiwiApi) {
        clearSubscriptionDuplicateDebounceTimer(roleDuplicateState);
        return {
            fingerprint: normalizedInput.fingerprint,
            strongMatches: roleDuplicateState.strongMatches
        };
    }

    const cacheEntry = getFreshSubscriptionDuplicateCacheEntry(roleDuplicateState, normalizedInput.fingerprint);
    if (cacheEntry) {
        roleDuplicateState.resolvedFingerprints[normalizedInput.fingerprint] = true;
        refreshSubscriptionDuplicateMatches(role, normalizedInput);
        renderSubscriptionDuplicateCheck(role);
        return {
            fingerprint: normalizedInput.fingerprint,
            strongMatches: roleDuplicateState.strongMatches
        };
    }

    if (roleDuplicateState.resolvedFingerprints[normalizedInput.fingerprint] && !forceApi) {
        return {
            fingerprint: normalizedInput.fingerprint,
            strongMatches: roleDuplicateState.strongMatches
        };
    }

    if (forceApi) {
        await runSubscriptionDuplicateApiCheck(role, normalizedInput.fingerprint, { force: true });
        return {
            fingerprint: roleDuplicateState.lastFingerprint,
            strongMatches: roleDuplicateState.strongMatches
        };
    }

    scheduleSubscriptionDuplicateApiCheck(role, normalizedInput.fingerprint);
    return {
        fingerprint: normalizedInput.fingerprint,
        strongMatches: roleDuplicateState.strongMatches
    };
}

function bindSubscriptionDuplicateListeners(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    for (const inputSuffix of SUBSCRIPTION_DUPLICATE_INPUT_FIELDS) {
        const inputNode = document.getElementById(`${cfg.prefix}${inputSuffix}`);
        if (!inputNode || inputNode.dataset.subscriptionDuplicateBound === 'true') {
            continue;
        }

        inputNode.dataset.subscriptionDuplicateBound = 'true';
        inputNode.addEventListener('input', () => {
            void evaluateSubscriptionDuplicateRole(role);
            if (role === 'recipient' && subscriptionRoleState.requesterSameAsRecipient) {
                renderRequesterSameSummary();
            }
        });
        inputNode.addEventListener('blur', () => {
            void evaluateSubscriptionDuplicateRole(role);
        });
    }
}

async function validateSubscriptionDuplicateSubmitGuard() {
    const rolesToCheck = [];
    if (subscriptionRoleState.recipient.mode === 'create') {
        rolesToCheck.push('recipient');
    }
    if (!subscriptionRoleState.requesterSameAsRecipient && subscriptionRoleState.requester.mode === 'create') {
        rolesToCheck.push('requester');
    }

    for (const role of rolesToCheck) {
        await evaluateSubscriptionDuplicateRole(role, { forceApi: true });
        const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
        if (!roleDuplicateState) {
            continue;
        }

        const fingerprint = roleDuplicateState.lastFingerprint;
        const hasStrongMatches = Array.isArray(roleDuplicateState.strongMatches) && roleDuplicateState.strongMatches.length > 0;
        const isAcknowledged = fingerprint !== 'none' && roleDuplicateState.acknowledgedFingerprint === fingerprint;
        if (!hasStrongMatches || isAcknowledged) {
            continue;
        }

        roleDuplicateState.isExpanded = true;
        roleDuplicateState.expandedFingerprint = fingerprint;
        renderSubscriptionDuplicateCheck(role);

        const roleLabel = getSubscriptionRoleConfig(role)?.roleLabel || 'persoon';
        showToast(
            translate(
                'subscription.duplicateCheck.submitAdvisory',
                { roleLabel },
                `Controleer mogelijke bestaande ${roleLabel} voordat u doorgaat.`
            ),
            'warning'
        );
        return false;
    }

    return true;
}

function searchPersonsLocallyForRole(query) {
    const normalizedQuery = normalizeRoleSearchQuery(query).toLowerCase();
    if (!normalizedQuery) {
        return [];
    }

    return customers.filter((person) => {
        const name = buildPersonDisplayName(person).toLowerCase();
        const email = (person.email || '').toLowerCase();
        const phone = normalizePhone(person.phone || '');
        const postalCode = (person.postalCode || '').toLowerCase();
        const queryPhone = normalizePhone(normalizedQuery);
        return name.includes(normalizedQuery)
            || email.includes(normalizedQuery)
            || postalCode.includes(normalizedQuery)
            || (queryPhone && phone.includes(queryPhone));
    }).slice(0, 10);
}

function renderSubscriptionRoleSearchResults(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    const resultsNode = document.getElementById(cfg.searchResultsId);
    if (!resultsNode) return;

    const results = subscriptionRoleState[role].searchResults || [];
    if (results.length === 0) {
        resultsNode.innerHTML = '';
        return;
    }

    resultsNode.innerHTML = results.map((person) => {
        const safeName = escapeHtml(buildPersonDisplayName(person) || formatPersonReference(person.id));
        const safeAddress = escapeHtml(buildPersonDisplayAddress(person));
        const safeId = escapeHtml(formatPersonReference(person.id));
        const safeAddressLine = safeAddress ? ` · ${safeAddress}` : '';
        const selectLabel = escapeHtml(translate('subscription.search.selectButton', {}, 'Selecteer'));
        return `
            <div class="party-search-result">
                <div>
                    <strong>${safeName}</strong>
                    <div class="party-search-result-meta">${safeId}${safeAddressLine}</div>
                </div>
                <button type="button" class="btn btn-small" data-action="select-subscription-role-person" data-arg-role="${role}" data-arg-person-id="${Number(person.id)}">${selectLabel}</button>
            </div>
        `;
    }).join('');
}

async function searchSubscriptionRolePerson(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    const query = normalizeRoleSearchQuery(document.getElementById(cfg.searchQueryId)?.value);
    if (!query) {
        showToast(translate('subscription.search.enterQuery', {}, 'Voer eerst een zoekterm in'), 'warning');
        return;
    }

    let results = [];
    if (window.kiwiApi) {
        const params = new URLSearchParams({
            page: '1',
            pageSize: '10',
            sortBy: 'name'
        });

        if (query.includes('@')) {
            params.set('email', query.toLowerCase());
        } else {
            const numericPhone = normalizePhone(query);
            if (numericPhone.length >= 6) {
                params.set('phone', numericPhone);
            } else {
                params.set('name', query.toLowerCase());
            }
        }

        try {
            const payload = await window.kiwiApi.get(`${personsApiUrl}?${params.toString()}`);
            results = Array.isArray(payload && payload.items) ? payload.items : [];
        } catch (error) {
            showToast(error.message || translate('subscription.search.failed', {}, 'Zoeken van personen mislukt'), 'error');
            return;
        }
    } else {
        results = searchPersonsLocallyForRole(query);
    }

    subscriptionRoleState[role].searchResults = results;
    renderSubscriptionRoleSearchResults(role);
}

function selectSubscriptionRolePerson(role, personId) {
    const selected = (subscriptionRoleState[role].searchResults || [])
        .find((entry) => Number(entry.id) === Number(personId));
    if (!selected) {
        showToast(translate('subscription.search.personNotFound', {}, 'Geselecteerde persoon niet gevonden in zoekresultaat'), 'error');
        return;
    }

    subscriptionRoleState[role].selectedPerson = selected;
    renderSubscriptionRoleSelectedPerson(role);

    const cfg = getSubscriptionRoleConfig(role);
    const resultsNode = document.getElementById(cfg.searchResultsId);
    if (resultsNode) {
        resultsNode.innerHTML = '';
    }

    if (role === 'recipient' && subscriptionRoleState.requesterSameAsRecipient) {
        renderRequesterSameSummary();
    }

    if (!subscriptionRoleState.requesterSameAsRecipient) {
        normalizeRequesterSameAsRecipientSelection();
    }
}

function resetSubscriptionRoleState() {
    subscriptionRoleState.recipient.mode = 'existing';
    subscriptionRoleState.recipient.selectedPerson = null;
    subscriptionRoleState.recipient.searchResults = [];
    subscriptionRoleState.requester.mode = 'existing';
    subscriptionRoleState.requester.selectedPerson = null;
    subscriptionRoleState.requester.searchResults = [];
    subscriptionRoleState.requesterSameAsRecipient = true;
    resetAllSubscriptionDuplicateStates();
}

function createPersonPayloadFromForm(prefix, optinData = null) {
    const data = getCustomerFormData(prefix);
    const birthday = ensureBirthdayValue(prefix, false);
    if (birthday === null) {
        return null;
    }

    const initials = data.initials.trim();
    const middleName = data.middleName.trim();
    const lastName = data.lastName.trim();
    const street = data.address.trim();
    const houseNumber = data.houseNumber.trim();
    const houseExt = data.houseExt.trim();
    const combinedHouseNumber = `${houseNumber}${houseExt}`.trim();

    if (!initials || !lastName || !street || !houseNumber || !data.postalCode.trim() || !data.city.trim() || !data.email.trim()) {
        showToast(translate('forms.required', {}, 'Vul alle verplichte velden in'), 'error');
        return null;
    }

    const fullLastName = middleName ? `${middleName} ${lastName}` : lastName;
    const personPayload = {
        salutation: data.salutation,
        firstName: initials,
        middleName: middleName,
        lastName: fullLastName,
        birthday: birthday,
        postalCode: data.postalCode.trim().toUpperCase(),
        houseNumber: combinedHouseNumber,
        address: `${street} ${combinedHouseNumber}`.trim(),
        city: data.city.trim(),
        email: data.email.trim(),
        phone: data.phone.trim()
    };

    if (optinData) {
        personPayload.optinEmail = optinData.optinEmail;
        personPayload.optinPhone = optinData.optinPhone;
        personPayload.optinPost = optinData.optinPost;
    }

    return personPayload;
}

function buildSubscriptionRolePayload(role, options = {}) {
    if (role === 'requester' && subscriptionRoleState.requesterSameAsRecipient) {
        return { sameAsRecipient: true };
    }

    const roleState = subscriptionRoleState[role];
    const cfg = getSubscriptionRoleConfig(role);
    if (!roleState || !cfg) {
        showToast(translate('subscription.roleUnknown', {}, 'Onbekende persoonsrol in abonnement flow'), 'error');
        return null;
    }

    if (roleState.mode === 'existing') {
        if (!roleState.selectedPerson || roleState.selectedPerson.id === undefined || roleState.selectedPerson.id === null) {
            const message = role === 'recipient'
                ? translate('subscription.selectRecipientOrCreate', {}, 'Selecteer een ontvanger of kies "Nieuwe persoon".')
                : translate('subscription.selectRequesterOrCreate', {}, 'Selecteer een aanvrager/betaler of kies "Nieuwe persoon".');
            showToast(message, 'error');
            return null;
        }
        return { personId: Number(roleState.selectedPerson.id) };
    }

    if (roleState.mode === 'create') {
        const personPayload = createPersonPayloadFromForm(cfg.prefix, options.optinData || null);
        if (!personPayload) {
            return null;
        }
        return { person: personPayload };
    }

    showToast(translate('subscription.roleInvalid', {}, 'Persoonsrol onjuist ingesteld'), 'error');
    return null;
}

function initializeSubscriptionRolesForForm() {
    resetSubscriptionRoleState();

    const recipientSearchQuery = document.getElementById('recipientSearchQuery');
    if (recipientSearchQuery) recipientSearchQuery.value = '';
    const requesterSearchQuery = document.getElementById('requesterSearchQuery');
    if (requesterSearchQuery) requesterSearchQuery.value = '';

    setSubscriptionRoleMode('recipient', 'existing');
    setSubscriptionRoleMode('requester', 'existing');

    if (currentCustomer) {
        subscriptionRoleState.recipient.selectedPerson = currentCustomer;
        renderSubscriptionRoleSelectedPerson('recipient');
    } else {
        setSubscriptionRoleMode('recipient', 'create');
    }

    const sameCheckbox = document.getElementById('requesterSameAsRecipient');
    if (sameCheckbox) {
        sameCheckbox.checked = true;
    }
    toggleRequesterSameAsRecipient();
}

// ============================================================================
// End of DRY Component
// ============================================================================

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

function getSearchFilters() {
    const postalCode = document.getElementById('searchPostalCode').value.toUpperCase().trim();
    const houseNumber = document.getElementById('searchHouseNumber').value.trim();
    const nameInput = document.getElementById('searchName');
    const phoneInput = document.getElementById('searchPhone');
    const emailInput = document.getElementById('searchEmail');

    const name = nameInput ? nameInput.value.toLowerCase().trim() : '';
    const phone = normalizePhone(phoneInput ? phoneInput.value : '');
    const email = emailInput ? emailInput.value.toLowerCase().trim() : '';

    return { postalCode, houseNumber, name, phone, email };
}

function matchesCustomerName(customer, nameQuery) {
    if (!nameQuery) return true;

    const nameCandidates = [
        customer.firstName,
        customer.lastName,
        `${customer.firstName} ${customer.lastName}`,
        customer.middleName ? `${customer.firstName} ${customer.middleName} ${customer.lastName}` : null
    ]
        .filter(Boolean)
        .map(value => value.toLowerCase());

    return nameCandidates.some(value => value.includes(nameQuery));
}

function matchesCustomerPhone(customer, phoneQuery) {
    if (!phoneQuery) return true;

    const customerPhone = normalizePhone(customer.phone || '');
    return customerPhone.includes(phoneQuery);
}

function matchesCustomerEmail(customer, emailQuery) {
    if (!emailQuery) return true;

    const customerEmail = (customer.email || '').toLowerCase();
    return customerEmail.includes(emailQuery);
}

function buildSearchQueryLabel() {
    const postalCode = document.getElementById('searchPostalCode').value.trim();
    const houseNumber = document.getElementById('searchHouseNumber').value.trim();
    const nameInput = document.getElementById('searchName');
    const name = nameInput ? nameInput.value.trim() : '';

    const labelParts = [];
    
    if (postalCode || houseNumber) {
        const addressLabel = [postalCode, houseNumber].filter(Boolean).join(' ');
        labelParts.push(addressLabel);
    }
    if (name) {
        labelParts.push(
            translate('search.nameFilterLabel', { name }, `Naam: ${name}`)
        );
    }

    return labelParts.length
        ? labelParts.join(' • ')
        : translate('search.allCustomers', {}, 'alle klanten');
}

function setAdditionalFiltersOpen(isOpen) {
    const panel = document.getElementById('additionalFiltersPanel');
    const toggle = document.getElementById('additionalFiltersToggle');

    if (!panel || !toggle) return;

    if (isOpen) {
        panel.classList.add('is-open');
        panel.style.display = 'grid';
    } else {
        panel.classList.remove('is-open');
        panel.style.display = 'none';
    }
    toggle.setAttribute('aria-expanded', String(isOpen));
}

function toggleAdditionalFilters() {
    const panel = document.getElementById('additionalFiltersPanel');
    if (!panel) return;

    const willOpen = !panel.classList.contains('is-open');
    setAdditionalFiltersOpen(willOpen);
}

async function searchCustomer() {
    const filters = getSearchFilters();
    let results = [];

    if (window.kiwiApi) {
        const query = new URLSearchParams();
        if (filters.postalCode) query.set('postalCode', filters.postalCode);
        if (filters.houseNumber) query.set('houseNumber', filters.houseNumber);
        if (filters.name) query.set('name', filters.name);
        if (filters.phone) query.set('phone', filters.phone);
        if (filters.email) query.set('email', filters.email);
        query.set('sortBy', searchState.sortBy || 'name');
        query.set('page', '1');
        query.set('pageSize', '200');

        try {
            const payload = await window.kiwiApi.get(`/api/v1/persons?${query.toString()}`);
            results = Array.isArray(payload && payload.items) ? payload.items : [];
        } catch (error) {
            console.error('Kon klanten niet zoeken via API', error);
            showToast(translate('search.backendFailed', {}, 'Zoeken via backend mislukt'), 'error');
            return;
        }
    } else {
        results = customers.filter(customer => {
            const matchPostal = !filters.postalCode || customer.postalCode === filters.postalCode;
            const matchHouse = !filters.houseNumber || customer.houseNumber === filters.houseNumber;
            const matchName = matchesCustomerName(customer, filters.name);
            const matchPhone = matchesCustomerPhone(customer, filters.phone);
            const matchEmail = matchesCustomerEmail(customer, filters.email);
            
            return matchPostal && matchHouse && matchName && matchPhone && matchEmail;
        });
    }

    // Update search state
    searchState.results = results;
    searchState.currentPage = 1;
    searchState.sortBy = 'name';
    
    // Sort results
    sortResultsData();
    
    // Display results
    displayPaginatedResults();
}

// Handle Enter key press in search fields
function handleSearchKeyPress(event) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        searchCustomer();
    }
}

// Display Paginated Results
function displayPaginatedResults() {
    const { results, currentPage, itemsPerPage } = searchState;
    
    // Update summary in left panel
    const searchSummary = document.getElementById('searchSummary');
    const resultCount = document.getElementById('resultCount');
    resultCount.textContent = results.length;
    searchSummary.style.display = results.length > 0 ? 'block' : 'none';
    
    // Show/hide views
    const searchResultsView = document.getElementById('searchResultsView');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const customerDetail = document.getElementById('customerDetail');
    
    if (results.length === 0) {
        // Show empty state in center panel
        searchResultsView.style.display = 'none';
        customerDetail.style.display = 'none';
        welcomeMessage.style.display = 'flex';
        welcomeMessage.innerHTML = `
            <div class="empty-state">
                <span class="empty-icon">🔍</span>
                <h2>${translate('search.noneFoundTitle', {}, 'Geen klanten gevonden')}</h2>
                <p>${translate('search.noneFoundDescription', {}, 'Pas je zoekcriteria aan en probeer opnieuw')}</p>
            </div>
        `;
        return;
    }
    
    // Hide welcome and customer detail, show results view
    welcomeMessage.style.display = 'none';
    customerDetail.style.display = 'none';
    searchResultsView.style.display = 'block';
    
    // Calculate pagination
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageResults = results.slice(startIdx, endIdx);
    
    // Update results title and range
    const searchQuery = buildSearchQueryLabel();
    document.getElementById('resultsTitle').textContent = translate(
        'search.resultsTitle',
        { query: searchQuery },
        `🔍 Zoekresultaten: "${searchQuery}"`
    );
    document.getElementById('resultsRange').textContent = translate(
        'search.resultsRange',
        { start: startIdx + 1, end: Math.min(endIdx, results.length), total: results.length },
        `Toont ${startIdx + 1}-${Math.min(endIdx, results.length)} van ${results.length}`
    );
    
    // Render results
    const container = document.getElementById('paginatedResults');
    container.innerHTML = pageResults.map(customer => renderCustomerRow(customer)).join('');
    
    // Render pagination
    renderPagination();
    
    // Scroll to top of results
    searchResultsView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Render a single customer row
function getCustomerInitials(customer) {
    const providedInitials = customer.initials?.trim();
    if (providedInitials) return providedInitials;

    const firstName = (customer.firstName || '').replace(/\./g, ' ').trim();
    if (!firstName) return '';

    const initials = firstName
        .split(/[\s-]+/)
        .filter(Boolean)
        .map(part => part[0].toUpperCase())
        .join('.');

    return initials ? `${initials}.` : '';
}

function splitLastNameComponents(customer) {
    let lastName = (customer.lastName || '').trim();
    let insertion = (customer.middleName || '').trim();

    if (!insertion && lastName.includes(' ')) {
        const lower = lastName.toLowerCase();
        const matchedPrefix = NAME_INSERTION_PREFIXES.find(prefix => lower.startsWith(`${prefix} `));
        if (matchedPrefix) {
            insertion = lastName.substring(0, matchedPrefix.length);
            const remainder = lastName.substring(matchedPrefix.length).trim();
            if (remainder) {
                lastName = remainder;
            } else {
                // If no remainder, fallback to original lastName
                insertion = (customer.middleName || '').trim();
            }
        }
    }

    return { lastName, insertion };
}

function buildNameRest(customer) {
    const restParts = [];
    if (customer.salutation) restParts.push(customer.salutation.trim());
    if (customer.firstName) restParts.push(customer.firstName.trim());
    return restParts.join(' ').trim();
}

function getInitialsDisplay(customer) {
    const initials = getCustomerInitials(customer) || '-';
    const rest = buildNameRest(customer);
    const showRest = rest && normalizeNameFragment(rest) !== normalizeNameFragment(initials);
    return {
        initials,
        rest: showRest ? rest : ''
    };
}

function formatLastNameSection(customer) {
    const { lastName, insertion } = splitLastNameComponents(customer);

    if (!lastName && !insertion) return '';
    if (!lastName) return insertion;

    return insertion
        ? `<span class="last-name">${lastName}</span>, ${insertion}`
        : `<span class="last-name">${lastName}</span>`;
}

function renderCustomerRow(customer) {
    const lastNameSection = formatLastNameSection(customer) || '-';
    const { initials, rest } = getInitialsDisplay(customer);
    const viewActionLabel = translate('search.viewAction', {}, 'Bekijken');
    
    const activeSubscriptions = customer.subscriptions.filter(s => s.status === 'active');
    const inactiveSubscriptions = customer.subscriptions.filter(s => s.status !== 'active');
    
    // Build subscription badges with subscription numbers
    let subscriptionBadges = '';
    if (activeSubscriptions.length > 0) {
        subscriptionBadges = activeSubscriptions.map(s => 
            `<span class="subscription-badge active">${s.magazine}</span>`
        ).join('');
    }
    if (inactiveSubscriptions.length > 0 && activeSubscriptions.length === 0) {
        subscriptionBadges = `<span class="subscription-badge inactive">${inactiveSubscriptions[0].magazine} (beëindigd)</span>`;
    }
    if (!subscriptionBadges) {
        subscriptionBadges = '<span style="color: var(--text-secondary); font-size: 0.875rem;">Geen actief</span>';
    }
    
    // Get primary active subscription number (or first subscription if no active)
    let subscriberNumber = '-';
    const primarySubscription = activeSubscriptions.length > 0 
        ? activeSubscriptions[0] 
        : customer.subscriptions[0];
    
    if (primarySubscription) {
        subscriberNumber = generateSubscriptionNumber(customer.id, primarySubscription.id);
    }
    
    // Show identify button only during anonymous call
    const showIdentifyBtn = callSession.active && callSession.callerType === 'anonymous';
    
    return `
        <tr class="result-row" data-action="select-customer" data-arg-customer-id="${customer.id}">
            <td class="result-row-lastname">${lastNameSection}</td>
            <td class="result-row-initials">
                <span class="initials-value">${initials}</span>
            </td>
            <td class="result-row-address">
                <span>${customer.address}</span><br>
                <span>${customer.postalCode} ${customer.city}</span>
            </td>
            <td class="result-row-subscriptions">${subscriptionBadges}</td>
            <td class="result-row-subscriber-number">${subscriberNumber}</td>
            <td class="result-row-actions">
                <button class="btn btn-small" type="button" data-action="select-customer" data-arg-customer-id="${customer.id}" data-action-stop-propagation="true">
                    ${viewActionLabel}
                </button>
                ${showIdentifyBtn ? `
                    <button class="btn btn-small btn-primary btn-identify-caller"
                            type="button"
                            data-action="call-session.identify-caller"
                            data-arg-customer-id="${customer.id}"
                            data-action-stop-propagation="true">
                        👤 Identificeer
                    </button>
                ` : ''}
            </td>
        </tr>
    `;
}

// Render Pagination Controls
function renderPagination() {
    const { results, currentPage, itemsPerPage } = searchState;
    const totalPages = Math.ceil(results.length / itemsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let html = '';
    
    // Previous button
    html += `<button class="page-btn" type="button" data-action="go-to-page" data-arg-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
        ← Vorige
    </button>`;
    
    // Page numbers (with smart ellipsis)
    const pageNumbers = getPageNumbers(currentPage, totalPages);
    pageNumbers.forEach(page => {
        if (page === '...') {
            html += `<span class="page-ellipsis">...</span>`;
        } else {
            const activeClass = page === currentPage ? 'active' : '';
            html += `<button class="page-btn ${activeClass}" type="button" data-action="go-to-page" data-arg-page="${page}">${page}</button>`;
        }
    });
    
    // Next button
    html += `<button class="page-btn" type="button" data-action="go-to-page" data-arg-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
        Volgende →
    </button>`;
    
    pagination.innerHTML = html;
}

// Get page numbers with smart ellipsis
function getPageNumbers(currentPage, totalPages) {
    const pages = [];
    const maxVisible = 7; // Maximum number of page buttons to show
    
    if (totalPages <= maxVisible) {
        // Show all pages
        for (let i = 1; i <= totalPages; i++) {
            pages.push(i);
        }
    } else {
        // Always show first page
        pages.push(1);
        
        // Calculate range around current page
        let rangeStart = Math.max(2, currentPage - 1);
        let rangeEnd = Math.min(totalPages - 1, currentPage + 1);
        
        // Adjust range if near start or end
        if (currentPage <= 3) {
            rangeEnd = Math.min(5, totalPages - 1);
        }
        if (currentPage >= totalPages - 2) {
            rangeStart = Math.max(2, totalPages - 4);
        }
        
        // Add ellipsis before range if needed
        if (rangeStart > 2) {
            pages.push('...');
        }
        
        // Add range
        for (let i = rangeStart; i <= rangeEnd; i++) {
            pages.push(i);
        }
        
        // Add ellipsis after range if needed
        if (rangeEnd < totalPages - 1) {
            pages.push('...');
        }
        
        // Always show last page
        pages.push(totalPages);
    }
    
    return pages;
}

// Go to specific page
function goToPage(page) {
    const totalPages = Math.ceil(searchState.results.length / searchState.itemsPerPage);
    
    if (page < 1 || page > totalPages) return;
    
    searchState.currentPage = page;
    displayPaginatedResults();
}

// Scroll to results (from left panel button)
function scrollToResults() {
    // Hide customer detail and welcome message
    document.getElementById('customerDetail').style.display = 'none';
    document.getElementById('welcomeMessage').style.display = 'none';
    
    // Show search results view
    const searchResultsView = document.getElementById('searchResultsView');
    searchResultsView.style.display = 'block';
    
    // Scroll to results
    searchResultsView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Clear search results and return to previous state
function clearSearchResults() {
    // Clear search state
    searchState.results = [];
    searchState.currentPage = 1;
    
    // Hide search results view and summary
    document.getElementById('searchResultsView').style.display = 'none';
    document.getElementById('searchSummary').style.display = 'none';
    
    // Clear search input fields
    document.getElementById('searchName').value = '';
    document.getElementById('searchPostalCode').value = '';
    document.getElementById('searchHouseNumber').value = '';
    const phoneInput = document.getElementById('searchPhone');
    if (phoneInput) phoneInput.value = '';
    const emailInput = document.getElementById('searchEmail');
    if (emailInput) emailInput.value = '';
    setAdditionalFiltersOpen(false);
    
    // Always restore welcome message HTML (in case it was overwritten by empty search)
    const welcomeMessage = document.getElementById('welcomeMessage');
    welcomeMessage.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">👤</span>
            <h2>${translate('welcome.title', {}, 'Welkom bij Klantenservice')}</h2>
            <p>${translate('welcome.description', {}, 'Zoek een klant of start een nieuwe actie')}</p>
        </div>
    `;
    
    // Check if there was a customer loaded before the search
    if (currentCustomer) {
        // Show the previously loaded customer detail
        document.getElementById('customerDetail').style.display = 'block';
        welcomeMessage.style.display = 'none';
    } else {
        // No customer was loaded, show welcome message
        document.getElementById('customerDetail').style.display = 'none';
        welcomeMessage.style.display = 'flex';
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Close customer detail and return to welcome screen
function closeCustomerDetail() {
    // Clear current customer
    currentCustomer = null;
    
    // Hide customer detail
    document.getElementById('customerDetail').style.display = 'none';
    
    // Restore and show welcome message
    const welcomeMessage = document.getElementById('welcomeMessage');
    welcomeMessage.innerHTML = `
        <div class="empty-state">
            <span class="empty-icon">👤</span>
            <h2>${translate('welcome.title', {}, 'Welkom bij Klantenservice')}</h2>
            <p>${translate('welcome.description', {}, 'Zoek een klant of start een nieuwe actie')}</p>
        </div>
    `;
    welcomeMessage.style.display = 'flex';
    
    // Hide search results if visible
    document.getElementById('searchResultsView').style.display = 'none';
    document.getElementById('searchSummary').style.display = 'none';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Sort results
function sortResults(sortBy) {
    searchState.sortBy = sortBy;
    searchState.currentPage = 1; // Reset to first page when sorting
    sortResultsData();
    displayPaginatedResults();
}

// Sort results data
function sortResultsData() {
    const { sortBy } = searchState;
    
    searchState.results.sort((a, b) => {
        switch(sortBy) {
            case 'name':
                // Sort by last name, then first name
                const lastNameCompare = a.lastName.localeCompare(b.lastName);
                if (lastNameCompare !== 0) return lastNameCompare;
                return a.firstName.localeCompare(b.firstName);
            
            case 'postal':
                return a.postalCode.localeCompare(b.postalCode);
            
            case 'subscriptions':
                // Sort by number of active subscriptions (descending)
                const aActive = a.subscriptions.filter(s => s.status === 'active').length;
                const bActive = b.subscriptions.filter(s => s.status === 'active').length;
                return bActive - aActive;
            
            default:
                return 0;
        }
    });
}

// Legacy Display Search Results (keep for backward compatibility but not used)
function displaySearchResults(results) {
    // This function is now replaced by displayPaginatedResults
    // Keeping it for backward compatibility
    searchState.results = results;
    searchState.currentPage = 1;
    displayPaginatedResults();
}

// Select Customer
async function selectCustomer(customerId) {
    let customer = customers.find(c => c.id === customerId);

    if (window.kiwiApi) {
        try {
            customer = await window.kiwiApi.get(`/api/v1/persons/${customerId}`);
            const existingIndex = customers.findIndex(c => c.id === customerId);
            if (existingIndex >= 0) {
                customers[existingIndex] = customer;
            } else {
                customers.push(customer);
            }
        } catch (error) {
            console.error('Kon klantdetail niet laden via API', error);
            showToast(translate('customer.detailLoadFailed', {}, 'Kon klantdetail niet laden'), 'error');
            return;
        }
    }

    currentCustomer = customer;
    if (!currentCustomer) return;

    contactHistoryState.currentPage = 1;
    contactHistoryState.highlightId = null;
    contactHistoryState.lastEntry = null;
    if (contactHistoryHighlightTimer) {
        clearTimeout(contactHistoryHighlightTimer);
        contactHistoryHighlightTimer = null;
    }

    // Hide welcome message and search results view
    document.getElementById('welcomeMessage').style.display = 'none';
    document.getElementById('searchResultsView').style.display = 'none';
    
    // Show customer detail
    const customerDetail = document.getElementById('customerDetail');
    customerDetail.style.display = 'block';

    // Populate customer info
    const fullName = currentCustomer.middleName 
        ? `${currentCustomer.salutation || ''} ${currentCustomer.firstName} ${currentCustomer.middleName} ${currentCustomer.lastName}`.trim()
        : `${currentCustomer.salutation || ''} ${currentCustomer.firstName} ${currentCustomer.lastName}`.trim();
    
    document.getElementById('customerName').textContent = fullName;
    document.getElementById('customerAddress').textContent = 
        `${currentCustomer.address}, ${currentCustomer.postalCode} ${currentCustomer.city}`;
    document.getElementById('customerEmail').textContent = currentCustomer.email;
    document.getElementById('customerPhone').textContent = currentCustomer.phone;

    // Show deceased status banner if applicable
    displayDeceasedStatusBanner();

    // Display subscriptions
    displaySubscriptions();

    // Display articles
    displayArticles();

    // Display contact history
    displayContactHistory();

    // Update action buttons visibility
    updateCustomerActionButtons();
    
    // Update identify caller button visibility
    updateIdentifyCallerButtons();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Display Deceased Status Banner
function displayDeceasedStatusBanner() {
    // Remove any existing banner first
    const existingBanner = document.querySelector('.deceased-status-banner');
    if (existingBanner) {
        existingBanner.remove();
    }

    // Check if customer is deceased by looking at contact history
    if (!currentCustomer || !currentCustomer.contactHistory) return;
    
    const hasDeceasedEntry = currentCustomer.contactHistory.some(entry => 
        entry.type.toLowerCase().includes('overlijden') || 
        entry.description.toLowerCase().includes('overlijden')
    );

    if (hasDeceasedEntry) {
        // Create and insert the banner
        const banner = document.createElement('div');
        banner.className = 'deceased-status-banner';
        banner.innerHTML = `
            <div class="deceased-banner-icon">⚠️</div>
            <div class="deceased-banner-content">
                <strong>${translate('customer.deceasedBannerTitle', {}, 'Deze klant is overleden')}</strong>
                <p>${translate('customer.deceasedBannerDescription', {}, 'Let op bij het verwerken van abonnementen en bestellingen')}</p>
            </div>
        `;
        
        // Insert after customer header
        const customerDetail = document.getElementById('customerDetail');
        const customerHeader = customerDetail.querySelector('.customer-header');
        if (customerHeader && customerHeader.parentNode) {
            // Insert after the customer-header div
            customerHeader.parentNode.insertBefore(banner, customerHeader.nextSibling);
        }
    }
}

// Display Subscriptions
function displaySubscriptions() {
    const subscriptionsList = document.getElementById('subscriptionsList');
    
    if (currentCustomer.subscriptions.length === 0) {
        subscriptionsList.innerHTML = `<p class="empty-state-small">${translate('subscription.none', {}, 'Geen abonnementen')}</p>`;
        return;
    }

    // Separate active, ended, restituted, and transferred subscriptions
    const activeSubscriptions = currentCustomer.subscriptions.filter(sub => sub.status === 'active');
    const endedSubscriptions = currentCustomer.subscriptions.filter(sub => sub.status === 'ended' || sub.status === 'cancelled');
    const restitutedSubscriptions = currentCustomer.subscriptions.filter(sub => sub.status === 'restituted');
    const transferredSubscriptions = currentCustomer.subscriptions.filter(sub => sub.status === 'transferred');

    let html = '';

    // Display active subscriptions
    if (activeSubscriptions.length > 0) {
        html += `<div class="subscription-group"><h4 class="subscription-group-title">${translate('subscription.groupActive', {}, 'Actieve Abonnementen')}</h4>`;
        html += activeSubscriptions.map(sub => {
            const pricingInfo = getSubscriptionDurationDisplay(sub);
            const requesterMeta = getSubscriptionRequesterMetaLine(sub);
            
            return `
                <div class="subscription-item">
                    <div class="subscription-info">
                        <div class="subscription-name">📰 ${sub.magazine}</div>
                        <div class="subscription-details">
                            ${translate('subscription.startLabel', {}, 'Start')}: ${formatDate(sub.startDate)} • 
                            ${translate('subscription.lastEditionLabel', {}, 'Laatste editie')}: ${formatDate(sub.lastEdition)}<br>
                            ${pricingInfo}${requesterMeta}
                        </div>
                    </div>
                    <div class="subscription-actions">
                        <span class="subscription-status status-active">${translate('subscription.statusActive', {}, 'Actief')}</span>
                        <button class="icon-btn" type="button" data-action="edit-subscription" data-arg-sub-id="${sub.id}" title="${translate('subscription.editTitle', {}, 'Bewerken')}">✏️</button>
                        <button class="icon-btn" type="button" data-action="cancel-subscription" data-arg-sub-id="${sub.id}" title="${translate('subscription.cancelTitle', {}, 'Opzeggen')}">🚫</button>
                    </div>
                </div>
            `;
        }).join('');
        html += '</div>';
    }

    // Display ended subscriptions
    if (endedSubscriptions.length > 0) {
        html += `<div class="subscription-group"><h4 class="subscription-group-title">${translate('subscription.groupEnded', {}, 'Beëindigde Abonnementen')}</h4>`;
        html += endedSubscriptions.map(sub => {
            const pricingInfo = getSubscriptionDurationDisplay(sub);
            const requesterMeta = getSubscriptionRequesterMetaLine(sub);
            const statusClass = sub.status === 'cancelled' ? 'status-cancelled' : 'status-ended';
            const statusText = sub.status === 'cancelled'
                ? translate('subscription.statusCancelled', {}, 'Opgezegd')
                : translate('subscription.statusEnded', {}, 'Beëindigd');
            
            return `
                <div class="subscription-item subscription-ended">
                    <div class="subscription-info">
                        <div class="subscription-name">📰 ${sub.magazine}</div>
                        <div class="subscription-details">
                            ${translate('subscription.startLabel', {}, 'Start')}: ${formatDate(sub.startDate)} • 
                            ${sub.endDate ? `${translate('subscription.endLabel', {}, 'Einde')}: ${formatDate(sub.endDate)} • ` : ''}
                            ${translate('subscription.lastEditionLabel', {}, 'Laatste editie')}: ${formatDate(sub.lastEdition)}<br>
                            ${pricingInfo}${requesterMeta}
                        </div>
                    </div>
                    <div class="subscription-actions">
                        <span class="subscription-status ${statusClass}">${statusText}</span>
                        <button class="btn btn-small btn-winback" type="button" data-action="start-winback-for-subscription" data-arg-sub-id="${sub.id}" title="${translate('subscription.winbackTitle', {}, 'Winback/Opzegging')}">
                            ${translate('subscription.winbackAction', {}, '🎯 Winback/Opzegging')}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        html += '</div>';
    }

    // Display restituted subscriptions (cancelled with refund due to deceased)
    if (restitutedSubscriptions.length > 0) {
        html += `<div class="subscription-group"><h4 class="subscription-group-title">${translate('subscription.groupRestituted', {}, 'Gerestitueerde Abonnementen')}</h4>`;
        html += restitutedSubscriptions.map(sub => {
            const pricingInfo = getSubscriptionDurationDisplay(sub);
            const requesterMeta = getSubscriptionRequesterMetaLine(sub);
            const refundInfo = sub.refundInfo
                ? `<br>${translate('subscription.refundToLabel', {}, 'Restitutie naar')}: ${sub.refundInfo.email}`
                : '';
            
            return `
                <div class="subscription-item subscription-restituted">
                    <div class="subscription-info">
                        <div class="subscription-name">📰 ${sub.magazine}</div>
                        <div class="subscription-details">
                            ${translate('subscription.startLabel', {}, 'Start')}: ${formatDate(sub.startDate)} • 
                            ${sub.endDate ? `${translate('subscription.endLabel', {}, 'Einde')}: ${formatDate(sub.endDate)} • ` : ''}
                            ${translate('subscription.lastEditionLabel', {}, 'Laatste editie')}: ${formatDate(sub.lastEdition)}<br>
                            ${pricingInfo}${requesterMeta}${refundInfo}
                        </div>
                    </div>
                    <div class="subscription-actions">
                        <span class="subscription-status status-restituted">${translate('subscription.statusRestituted', {}, 'Gerestitueerd')}</span>
                        <button class="btn btn-small btn-secondary" type="button" data-action="revert-restitution" data-arg-sub-id="${sub.id}" title="${translate('subscription.transferToOtherTitle', {}, 'Overzetten naar andere persoon')}">
                            ${translate('subscription.transferAction', {}, '🔄 Overzetten')}
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        html += '</div>';
    }

    // Display transferred subscriptions (transferred to another person due to deceased)
    if (transferredSubscriptions.length > 0) {
        html += `<div class="subscription-group"><h4 class="subscription-group-title">${translate('subscription.groupTransferred', {}, 'Overgezette Abonnementen')}</h4>`;
        html += transferredSubscriptions.map(sub => {
            const pricingInfo = getSubscriptionDurationDisplay(sub);
            const requesterMeta = getSubscriptionRequesterMetaLine(sub);
            let transferInfo = '';
            if (sub.transferredTo) {
                const transferName = sub.transferredTo.middleName 
                    ? `${sub.transferredTo.firstName} ${sub.transferredTo.middleName} ${sub.transferredTo.lastName}`
                    : `${sub.transferredTo.firstName} ${sub.transferredTo.lastName}`;
                transferInfo = `<br>${translate('subscription.transferredToLabel', {}, 'Overgezet naar')}: ${transferName} (${sub.transferredTo.email})`;
            }
            
            return `
                <div class="subscription-item subscription-transferred">
                    <div class="subscription-info">
                        <div class="subscription-name">📰 ${sub.magazine}</div>
                        <div class="subscription-details">
                            Start: ${formatDate(sub.startDate)} • 
                            Laatste editie: ${formatDate(sub.lastEdition)}<br>
                            ${pricingInfo}${requesterMeta}${transferInfo}
                        </div>
                    </div>
                    <div class="subscription-actions">
                        <span class="subscription-status status-transferred">Overgezet</span>
                    </div>
                </div>
            `;
        }).join('');
        html += '</div>';
    }

    subscriptionsList.innerHTML = html;
}

// Phase 5B: Extended Contact Types for Better Display
const contactTypeLabelConfig = {
    // Call-related
    'call_started_anonymous': { key: 'contactHistory.type.callStartedAnonymous', fallback: 'Anonieme call gestart', icon: '📞', color: '#fbbf24' },
    'call_started_identified': { key: 'contactHistory.type.callStartedIdentified', fallback: 'Call gestart', icon: '📞', color: '#3b82f6' },
    'call_identified': { key: 'contactHistory.type.callIdentified', fallback: 'Beller geïdentificeerd', icon: '👤', color: '#10b981' },
    'call_ended_by_agent': { key: 'contactHistory.type.callEndedByAgent', fallback: 'Call beëindigd (agent)', icon: '📞', color: '#6b7280' },
    'call_ended_by_customer': { key: 'contactHistory.type.callEndedByCustomer', fallback: 'Call beëindigd (klant)', icon: '📞', color: '#ef4444' },
    'call_disposition': { key: 'contactHistory.type.callDisposition', fallback: 'Gesprek afgerond', icon: '📋', color: '#3b82f6' },
    'call_hold': { key: 'contactHistory.type.callHold', fallback: 'Gesprek in wacht', icon: '⏸️', color: '#f59e0b' },
    'call_resumed': { key: 'contactHistory.type.callResumed', fallback: 'Gesprek hervat', icon: '▶️', color: '#10b981' },
    'recording_started': { key: 'contactHistory.type.recordingStarted', fallback: 'Opname gestart', icon: '🔴', color: '#dc2626' },

    // ACW and follow-up
    'acw_completed': { key: 'contactHistory.type.acwCompleted', fallback: 'Nabewerking voltooid', icon: '✅', color: '#10b981' },
    'follow_up_scheduled': { key: 'contactHistory.type.followUpScheduled', fallback: 'Follow-up gepland', icon: '📅', color: '#8b5cf6' },

    // Agent status
    'agent_status_change': { key: 'contactHistory.type.agentStatusChange', fallback: 'Agent status gewijzigd', icon: '🔄', color: '#6b7280' },

    // Subscription-related
    'subscription_created': { key: 'contactHistory.type.subscriptionCreated', fallback: 'Abonnement aangemaakt', icon: '➕', color: '#10b981' },
    'subscription_changed': { key: 'contactHistory.type.subscriptionChanged', fallback: 'Abonnement gewijzigd', icon: '✏️', color: '#3b82f6' },
    'subscription_cancelled': { key: 'contactHistory.type.subscriptionCancelled', fallback: 'Abonnement opgezegd', icon: '❌', color: '#ef4444' },

    // Article sales
    'article_sold': { key: 'contactHistory.type.articleSold', fallback: 'Artikel verkocht', icon: '🛒', color: '#10b981' },

    // Delivery
    'magazine_resent': { key: 'contactHistory.type.magazineResent', fallback: 'Editie opnieuw verzonden', icon: '📬', color: '#3b82f6' },

    // Default
    'notification_success': { key: 'contactHistory.type.notification', fallback: 'Melding', icon: '✅', color: '#10b981' },
    'notification_info': { key: 'contactHistory.type.notification', fallback: 'Melding', icon: 'ℹ️', color: '#3b82f6' },
    'notification_warning': { key: 'contactHistory.type.notification', fallback: 'Melding', icon: '⚠️', color: '#f59e0b' },
    'notification_error': { key: 'contactHistory.type.notification', fallback: 'Melding', icon: '❗', color: '#ef4444' },
    'default': { key: 'contactHistory.type.default', fallback: 'Contact', icon: '📝', color: '#6b7280' }
};

// Get Contact Type Display Info
function getContactTypeInfo(type) {
    const config = contactTypeLabelConfig[type] || contactTypeLabelConfig.default;
    return {
        label: translate(config.key, {}, config.fallback),
        icon: config.icon,
        color: config.color
    };
}

// Display Contact History
function displayContactHistory() {
    const historyContainer = document.getElementById('contactHistory');

    if (!historyContainer) {
        return;
    }

    if (!currentCustomer || !Array.isArray(currentCustomer.contactHistory) || currentCustomer.contactHistory.length === 0) {
        historyContainer.innerHTML = `<div class="empty-state-small"><p>${translate('contactHistory.none', {}, 'Geen contactgeschiedenis beschikbaar')}</p></div>`;
        return;
    }

    const sortedHistory = [...currentCustomer.contactHistory].sort((a, b) =>
        new Date(b.date) - new Date(a.date)
    );

    const totalItems = sortedHistory.length;
    const itemsPerPage = contactHistoryState.itemsPerPage;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));

    if (contactHistoryState.currentPage > totalPages) {
        contactHistoryState.currentPage = totalPages;
    }

    if (contactHistoryState.currentPage < 1) {
        contactHistoryState.currentPage = 1;
    }

    const startIndex = (contactHistoryState.currentPage - 1) * itemsPerPage;
    const pageItems = sortedHistory.slice(startIndex, startIndex + itemsPerPage);

    const paginationMarkup = totalPages > 1
        ? `
        <div class="timeline-pagination">
            <button type="button" class="timeline-nav-btn" ${contactHistoryState.currentPage === 1 ? 'disabled' : ''} data-action="change-contact-history-page" data-arg-new-page="${contactHistoryState.currentPage - 1}">← Vorige</button>
            <span class="timeline-page-indicator">Pagina ${contactHistoryState.currentPage} van ${totalPages}</span>
            <button type="button" class="timeline-nav-btn" ${contactHistoryState.currentPage >= totalPages ? 'disabled' : ''} data-action="change-contact-history-page" data-arg-new-page="${contactHistoryState.currentPage + 1}">Volgende →</button>
        </div>
        `
        : '';

    const timelineItems = pageItems.map((item, index) => {
        const typeInfo = getContactTypeInfo(item.type);
        const rawId = String(item.id ?? `${startIndex + index}`);
        const sanitizedId = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
        const entryDomId = sanitizedId ? `ch-${sanitizedId}` : `ch-entry-${startIndex + index}`;
        const isHighlighted = contactHistoryState.highlightId && String(contactHistoryState.highlightId) === String(item.id);
        const highlightClass = isHighlighted ? ' timeline-item--highlight' : '';

        const descriptionHtml = (item.description || '').replace(/\n/g, '<br>');

        return `
        <div class="timeline-item${highlightClass}" data-contact-id="${rawId}">
            <div class="timeline-dot" style="background-color: ${typeInfo.color}"></div>
            <div class="timeline-header" data-action="toggle-timeline-item" data-arg-entry-dom-id="${entryDomId}">
                <span class="timeline-type" style="color: ${typeInfo.color}">
                    ${typeInfo.icon} ${typeInfo.label}
                </span>
                <span class="timeline-expand expanded" id="expand-${entryDomId}">▼</span>
                <span class="timeline-date">${formatDateTime(item.date)}</span>
            </div>
            <div class="timeline-content expanded" id="content-${entryDomId}">
                ${descriptionHtml}
            </div>
        </div>
        `;
    }).join('');

    historyContainer.innerHTML = `
        ${paginationMarkup}
        <div class="timeline-list">
            ${timelineItems}
        </div>
        ${paginationMarkup}
    `;
}

// Toggle Timeline Item (Accordion)
function toggleTimelineItem(entryDomId) {
    const content = document.getElementById(`content-${entryDomId}`);
    const expand = document.getElementById(`expand-${entryDomId}`);

    if (!content || !expand) {
        return;
    }

    const isExpanded = content.classList.toggle('expanded');
    expand.classList.toggle('expanded', isExpanded);
}

function changeContactHistoryPage(newPage) {
    if (!currentCustomer) {
        return;
    }

    const totalItems = currentCustomer.contactHistory ? currentCustomer.contactHistory.length : 0;
    const totalPages = Math.max(1, Math.ceil(totalItems / contactHistoryState.itemsPerPage));
    const targetPage = Math.min(Math.max(newPage, 1), totalPages);

    if (targetPage === contactHistoryState.currentPage) {
        return;
    }

    contactHistoryState.currentPage = targetPage;
    displayContactHistory();
}

// Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(getDateLocaleForApp(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Format DateTime
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(getDateLocaleForApp(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Show New Subscription Form
function showNewSubscription() {
    // Set today's date as default start date
    const today = new Date().toISOString().split('T')[0];
    const form = document.getElementById('subscriptionForm');
    if (form) {
        form.reset();
    }
    document.getElementById('subStartDate').value = today;

    const werfsleutelSliceApi = getWerfsleutelSliceApi();
    const canResetPickerFromSlice = werfsleutelSliceApi && typeof werfsleutelSliceApi.resetPicker === 'function';
    const canRefreshCatalogFromSlice = werfsleutelSliceApi && typeof werfsleutelSliceApi.refreshCatalogIfStale === 'function';

    if (canResetPickerFromSlice) {
        werfsleutelSliceApi.resetPicker();
    } else {
        resetWerfsleutelPicker();
    }

    if (canRefreshCatalogFromSlice) {
        werfsleutelSliceApi.refreshCatalogIfStale();
    } else {
        triggerWerfsleutelBackgroundRefreshIfStale();
    }

    initializeSubscriptionRolesForForm();
    renderRequesterSameSummary();
    document.getElementById('newSubscriptionForm').style.display = 'flex';
}

// Create Subscription
async function createSubscription(event) {
    event.preventDefault();

    const werfsleutelSelection = getSelectedWerfsleutelState();
    const selectedWerfsleutelKey = werfsleutelSelection.selectedKey;
    const selectedWerfsleutelChannel = werfsleutelSelection.selectedChannel;
    const selectedWerfsleutelChannelMeta = werfsleutelSelection.selectedChannelMeta;

    if (!selectedWerfsleutelKey) {
        showToast(translate('werfsleutel.selectKey', {}, 'Selecteer eerst een actieve werfsleutel.'), 'error');
        return;
    }

    if (!selectedWerfsleutelChannel) {
        showToast(translate('werfsleutel.selectChannel', {}, 'Kies een kanaal voor deze werfsleutel.'), 'error');
        return;
    }

    const offerDetails = getWerfsleutelOfferDetailsFromActiveSlice(selectedWerfsleutelKey);
    const formData = {
        magazine: offerDetails.magazine,
        duration: offerDetails.durationKey || '',
        durationLabel: offerDetails.durationLabel,
        startDate: document.getElementById('subStartDate').value,
        paymentMethod: document.querySelector('input[name="subPayment"]:checked').value,
        iban: document.getElementById('subIBAN')?.value || '',
        optinEmail: document.querySelector('input[name="subOptinEmail"]:checked').value,
        optinPhone: document.querySelector('input[name="subOptinPhone"]:checked').value,
        optinPost: document.querySelector('input[name="subOptinPost"]:checked').value,
        werfsleutel: selectedWerfsleutelKey.salesCode,
        werfsleutelTitle: selectedWerfsleutelKey.title,
        werfsleutelPrice: selectedWerfsleutelKey.price,
        werfsleutelChannel: selectedWerfsleutelChannel,
        werfsleutelChannelLabel: selectedWerfsleutelChannelMeta?.label || ''
    };

    const optinData = {
        optinEmail: document.querySelector('input[name="subOptinEmail"]:checked').value,
        optinPhone: document.querySelector('input[name="subOptinPhone"]:checked').value,
        optinPost: document.querySelector('input[name="subOptinPost"]:checked').value
    };

    const recipientPayload = buildSubscriptionRolePayload('recipient', { optinData });
    if (!recipientPayload) {
        return;
    }

    normalizeRequesterSameAsRecipientSelection({ silent: true });

    let requesterPayload = buildSubscriptionRolePayload('requester');
    if (!requesterPayload) {
        return;
    }

    const recipientPersonId = recipientPayload.personId !== undefined ? Number(recipientPayload.personId) : null;
    const requesterPersonId = requesterPayload.personId !== undefined ? Number(requesterPayload.personId) : null;
    const requesterShouldFollowRecipient = (
        !subscriptionRoleState.requesterSameAsRecipient
        && recipientPersonId !== null
        && requesterPersonId !== null
        && recipientPersonId === requesterPersonId
    );
    if (requesterShouldFollowRecipient) {
        requesterPayload = { sameAsRecipient: true };
        const sameCheckbox = document.getElementById('requesterSameAsRecipient');
        if (sameCheckbox && !sameCheckbox.checked) {
            sameCheckbox.checked = true;
        }
        toggleRequesterSameAsRecipient();
    }

    const duplicateGuardPassed = await validateSubscriptionDuplicateSubmitGuard();
    if (!duplicateGuardPassed) {
        return;
    }

    const werfsleutelChannelLabel = formData.werfsleutelChannelLabel || translate('werfsleutel.unknownChannel', {}, 'Onbekend kanaal');
    const werfsleutelNote = `Werfsleutel ${formData.werfsleutel} (${formData.werfsleutelTitle}, ${formatEuro(formData.werfsleutelPrice)}) via ${formData.werfsleutelChannel} (${werfsleutelChannelLabel})`;
    const durationDisplay = formData.duration
        ? (subscriptionPricing[formData.duration]?.description || formData.durationLabel)
        : formData.durationLabel;

    if (!window.kiwiApi) {
        showToast(translate('subscription.createRequiresBackend', {}, 'Abonnement aanmaken vereist backend API'), 'error');
        return;
    }

    const hadCurrentCustomer = Boolean(currentCustomer);
    const subscriptionPayload = {
        magazine: formData.magazine,
        duration: formData.duration,
        durationLabel: formData.durationLabel,
        startDate: formData.startDate,
        status: 'active',
        lastEdition: new Date().toISOString().split('T')[0]
    };

    const contactEntry = {
        type: subscriptionRoleState.recipient.mode === 'existing' ? 'Extra abonnement' : 'Nieuw abonnement',
        description: subscriptionRoleState.recipient.mode === 'existing'
            ? `Extra abonnement ${formData.magazine} (${durationDisplay}) toegevoegd. ${werfsleutelNote}.`
            : `Abonnement ${formData.magazine} (${durationDisplay}) aangemaakt via telefonische bestelling. ${werfsleutelNote}.`
    };

    const payload = {
        recipient: recipientPayload,
        requester: requesterPayload,
        subscription: subscriptionPayload,
        contactEntry
    };

    try {
        const response = await window.kiwiApi.post(`${workflowsApiUrl}/subscription-signup`, payload);
        const savedRecipient = response && response.recipient ? response.recipient : null;
        const savedRequester = response && response.requester ? response.requester : null;
        const createdRecipient = Boolean(response && response.createdRecipient);

        if (savedRecipient) {
            upsertCustomerInCache(savedRecipient);
        }
        if (savedRequester) {
            upsertCustomerInCache(savedRequester);
        }

        closeForm('newSubscriptionForm');
        showToast(
            createdRecipient
                ? translate('subscription.created', {}, 'Nieuw abonnement succesvol aangemaakt!')
                : translate('subscription.extraAdded', {}, 'Extra abonnement succesvol toegevoegd!'),
            'success'
        );

        if (savedRecipient && savedRecipient.id) {
            await selectCustomer(savedRecipient.id);
            if (createdRecipient && !hadCurrentCustomer) {
                showSuccessIdentificationPrompt(savedRecipient.id, `${savedRecipient.firstName} ${savedRecipient.lastName}`);
            }
        }
    } catch (error) {
        showToast(error.message || translate('subscription.createFailed', {}, 'Abonnement aanmaken via backend mislukt'), 'error');
        return;
    }

    const form = document.getElementById('subscriptionForm');
    if (form) {
        form.reset();
    }
    resetWerfsleutelPicker();
    initializeSubscriptionRolesForForm();
}

function getSubscriptionRequesterMetaLine(subscription) {
    if (!subscription || subscription.requesterPersonId === undefined || subscription.requesterPersonId === null) {
        return '';
    }
    if (currentCustomer && Number(subscription.requesterPersonId) === Number(currentCustomer.id)) {
        return '';
    }
    return `<br>${translate(
        'subscription.requestedPaidByPerson',
        { personId: subscription.requesterPersonId },
        `Aangevraagd/betaald door persoon #${subscription.requesterPersonId}`
    )}`;
}

// Edit Customer
function editCustomer() {
    if (!currentCustomer) return;

    document.getElementById('editCustomerId').value = currentCustomer.id;
    
    // Set salutation
    const salutation = currentCustomer.salutation || 'Dhr.';
    document.querySelector(`input[name="editSalutation"][value="${salutation}"]`).checked = true;
    
    // Handle name fields
    document.getElementById('editInitials').value = currentCustomer.firstName;
    document.getElementById('editMiddleName').value = currentCustomer.middleName || '';
    document.getElementById('editLastName').value = currentCustomer.lastName;
    
    // Handle address fields
    document.getElementById('editPostalCode').value = currentCustomer.postalCode;
    const houseNumberMatch = currentCustomer.houseNumber?.match(/^(\d+)(.*)$/);
    document.getElementById('editHouseNumber').value = houseNumberMatch ? houseNumberMatch[1] : currentCustomer.houseNumber;
    document.getElementById('editHouseExt').value = houseNumberMatch && houseNumberMatch[2] ? houseNumberMatch[2] : '';
    document.getElementById('editAddress').value = currentCustomer.address.replace(/ \d+.*$/, '');
    document.getElementById('editCity').value = currentCustomer.city;
    setBirthdayFields('edit', currentCustomer.birthday);

    // Contact info
    document.getElementById('editEmail').value = currentCustomer.email;
    document.getElementById('editPhone').value = currentCustomer.phone;
    
    // Set optin preferences (default to 'yes' if not set)
    const optinEmail = currentCustomer.optinEmail || 'yes';
    const optinPhone = currentCustomer.optinPhone || 'yes';
    const optinPost = currentCustomer.optinPost || 'yes';
    
    document.querySelector(`input[name="editOptinEmail"][value="${optinEmail}"]`).checked = true;
    document.querySelector(`input[name="editOptinPhone"][value="${optinPhone}"]`).checked = true;
    document.querySelector(`input[name="editOptinPost"][value="${optinPost}"]`).checked = true;

    document.getElementById('editCustomerForm').style.display = 'flex';
}

// Save Customer Edit
async function saveCustomerEdit(event) {
    event.preventDefault();

    const customerId = parseInt(document.getElementById('editCustomerId').value);
    const customer = customers.find(c => c.id === customerId);

    if (!customer) return;

    const birthday = ensureBirthdayValue('edit', false);
    if (birthday === null) return;

    const updates = {
        salutation: document.querySelector('input[name="editSalutation"]:checked').value,
        firstName: document.getElementById('editInitials').value,
        middleName: document.getElementById('editMiddleName').value,
        lastName: document.getElementById('editLastName').value,
        birthday: birthday,
        postalCode: document.getElementById('editPostalCode').value.toUpperCase()
    };

    const houseNumber = document.getElementById('editHouseNumber').value;
    const houseExt = document.getElementById('editHouseExt').value;
    updates.houseNumber = houseExt ? `${houseNumber}${houseExt}` : houseNumber;
    updates.address = `${document.getElementById('editAddress').value} ${updates.houseNumber}`;
    updates.city = document.getElementById('editCity').value;
    updates.email = document.getElementById('editEmail').value;
    updates.phone = document.getElementById('editPhone').value;
    updates.optinEmail = document.querySelector('input[name="editOptinEmail"]:checked').value;
    updates.optinPhone = document.querySelector('input[name="editOptinPhone"]:checked').value;
    updates.optinPost = document.querySelector('input[name="editOptinPost"]:checked').value;

    if (window.kiwiApi) {
        try {
            await window.kiwiApi.patch(`${personsApiUrl}/${customerId}`, updates);
            await window.kiwiApi.post(`${personsApiUrl}/${customerId}/contact-history`, {
                type: 'Gegevens gewijzigd',
                description: 'Klantgegevens bijgewerkt.'
            });
            closeForm('editCustomerForm');
            showToast(translate('customer.updated', {}, 'Klantgegevens succesvol bijgewerkt!'), 'success');
            await selectCustomer(customerId);
        } catch (error) {
            showToast(error.message || translate('customer.updateFailed', {}, 'Klantgegevens bijwerken via backend mislukt'), 'error');
        }
        return;
    }

    // Get form values
    customer.salutation = updates.salutation;
    customer.firstName = updates.firstName;
    customer.middleName = updates.middleName;
    customer.lastName = updates.lastName;
    customer.birthday = updates.birthday;
    customer.postalCode = updates.postalCode;
    customer.houseNumber = updates.houseNumber;
    customer.address = updates.address;
    customer.city = updates.city;
    customer.email = updates.email;
    customer.phone = updates.phone;
    customer.optinEmail = updates.optinEmail;
    customer.optinPhone = updates.optinPhone;
    customer.optinPost = updates.optinPost;

    // Add to contact history
    pushContactHistory(
        customer,
        {
            type: 'Gegevens gewijzigd',
            description: 'Klantgegevens bijgewerkt.'
        },
        { highlight: true, persist: false }
    );

    saveCustomers();
    closeForm('editCustomerForm');
    showToast(translate('customer.updated', {}, 'Klantgegevens succesvol bijgewerkt!'), 'success');
    
    // Refresh display
    selectCustomer(customerId);
}

// Show Resend Magazine Form
function showResendMagazine() {
    if (!currentCustomer) {
        showToast(translate('customer.selectFirst', {}, 'Selecteer eerst een klant'), 'error');
        return;
    }

    const select = document.getElementById('resendSubscription');
    select.innerHTML = `<option value="">${translate('resend.selectSubscription', {}, 'Selecteer abonnement...')}</option>` +
        currentCustomer.subscriptions.map(sub => 
            `<option value="${sub.id}">${sub.magazine} - ${translate('subscription.lastEditionLabel', {}, 'Laatste editie')}: ${formatDate(sub.lastEdition)}</option>`
        ).join('');

    document.getElementById('resendMagazineForm').style.display = 'flex';
}

// Resend Magazine
async function resendMagazine() {
    const subId = parseInt(document.getElementById('resendSubscription').value);
    const reason = document.getElementById('resendReason').value;
    
    if (!subId) {
        showToast(translate('subscription.selectOne', {}, 'Selecteer een abonnement'), 'error');
        return;
    }

    const subscription = currentCustomer.subscriptions.find(s => s.id === subId);
    if (!subscription) return;

    if (window.kiwiApi) {
        try {
            await window.kiwiApi.post(`${subscriptionsApiUrl}/${currentCustomer.id}/${subId}/complaint`, { reason });
            closeForm('resendMagazineForm');
            showToast(
                translate('resend.editionResent', { magazine: subscription.magazine }, `Editie van ${subscription.magazine} wordt opnieuw verzonden!`),
                'success'
            );
            await selectCustomer(currentCustomer.id);
        } catch (error) {
            showToast(error.message || translate('resend.failed', {}, 'Opnieuw verzenden via backend mislukt'), 'error');
        }
        return;
    }

    // Add to contact history
    const reasonText = {
        'not_received': 'niet ontvangen',
        'damaged': 'beschadigd',
        'lost': 'kwijt',
        'other': 'anders'
    }[reason];

    pushContactHistory(
        currentCustomer,
        {
            type: 'Editie verzonden',
            description: `Laatste editie van ${subscription.magazine} opnieuw verzonden. Reden: ${reasonText}.`
        },
        { highlight: true, persist: false }
    );

    saveCustomers();
    closeForm('resendMagazineForm');
    showToast(
        translate('resend.editionResent', { magazine: subscription.magazine }, `Editie van ${subscription.magazine} wordt opnieuw verzonden!`),
        'success'
    );
    
    // Refresh display
    displayContactHistory();
}

// Show Editorial Complaint Form
function showEditorialComplaintForm() {
    if (!currentCustomer) {
        showToast(translate('customer.selectFirst', {}, 'Selecteer eerst een klant'), 'error');
        return;
    }

    // Populate magazine dropdown with customer's subscriptions
    const select = document.getElementById('editorialComplaintMagazine');
    const uniqueMagazines = [...new Set(currentCustomer.subscriptions.map(sub => sub.magazine))];
    
    if (uniqueMagazines.length === 0) {
        select.innerHTML = `<option value="">${translate('subscription.noneAvailable', {}, 'Geen abonnementen beschikbaar')}</option>`;
    } else {
        select.innerHTML = `<option value="">${translate('forms.selectMagazinePlaceholder', {}, 'Selecteer magazine...')}</option>` +
            uniqueMagazines.map(mag => `<option value="${mag}">${mag}</option>`).join('');
    }

    // Reset form fields
    document.getElementById('editorialComplaintType').value = 'klacht';
    document.getElementById('editorialComplaintCategory').value = 'inhoud';
    document.getElementById('editorialComplaintDescription').value = '';
    document.getElementById('editorialComplaintEdition').value = '';
    document.getElementById('editorialComplaintFollowup').checked = false;

    document.getElementById('editorialComplaintForm').style.display = 'flex';
}

// Submit Editorial Complaint
async function submitEditorialComplaint() {
    const magazine = document.getElementById('editorialComplaintMagazine').value;
    const type = document.getElementById('editorialComplaintType').value;
    const category = document.getElementById('editorialComplaintCategory').value;
    const description = document.getElementById('editorialComplaintDescription').value.trim();
    const edition = document.getElementById('editorialComplaintEdition').value.trim();
    const followup = document.getElementById('editorialComplaintFollowup').checked;

    // Validation
    if (!magazine) {
        showToast(translate('forms.selectMagazine', {}, 'Selecteer een magazine'), 'error');
        return;
    }

    if (!description) {
        showToast(translate('forms.descriptionRequired', {}, 'Voer een beschrijving in'), 'error');
        return;
    }

    const typeLabels = {
        'klacht': 'Klacht',
        'opmerking': 'Opmerking',
        'suggestie': 'Suggestie',
        'compliment': 'Compliment'
    };

    const categoryLabels = {
        'inhoud': 'Inhoud artikel',
        'foto': 'Foto/afbeelding',
        'fout': 'Fout in tekst',
        'programma': 'TV/Radio programma',
        'puzzel': 'Puzzel',
        'advertentie': 'Advertentie',
        'overig': 'Overig'
    };

    if (window.kiwiApi) {
        try {
            await window.kiwiApi.post(`${personsApiUrl}/${currentCustomer.id}/editorial-complaints`, {
                magazine,
                type,
                category,
                description,
                edition,
                followup
            });
            closeForm('editorialComplaintForm');
            showToast(
                translate('editorial.registered', { typeLabel: typeLabels[type] }, `${typeLabels[type]} voor redactie geregistreerd!`),
                'success'
            );
            await selectCustomer(currentCustomer.id);
        } catch (error) {
            showToast(error.message || translate('editorial.registerFailed', {}, 'Redactie-item registreren via backend mislukt'), 'error');
        }
        return;
    }

    // Build contact history description
    let historyDescription = `${typeLabels[type]} voor redactie ${magazine} - ${categoryLabels[category]}. ${description}`;
    
    if (edition) {
        historyDescription += ` Editie: ${edition}.`;
    }
    
    if (followup) {
        historyDescription += ' Klant verwacht terugkoppeling.';
    }

    // Add to contact history
    pushContactHistory(
        currentCustomer,
        {
            type: `Redactie ${typeLabels[type]}`,
            description: historyDescription
        },
        { highlight: true, persist: false }
    );

    saveCustomers();
    closeForm('editorialComplaintForm');
    showToast(
        translate('editorial.registered', { typeLabel: typeLabels[type] }, `${typeLabels[type]} voor redactie geregistreerd!`),
        'success'
    );
    
    // Refresh display
    displayContactHistory();
}

// Edit Subscription
// Edit Subscription
function editSubscription(subId) {
    if (!currentCustomer) return;
    
    const subscription = currentCustomer.subscriptions.find(s => s.id === subId);
    if (!subscription) {
        showToast(translate('subscription.notFound', {}, 'Abonnement niet gevonden'), 'error');
        return;
    }
    
    // Populate form with current subscription data
    document.getElementById('editSubId').value = subId;
    document.getElementById('editSubMagazine').value = subscription.magazine;
    document.getElementById('editSubDuration').value = subscription.duration || '1-jaar';
    document.getElementById('editSubStartDate').value = subscription.startDate;
    document.getElementById('editSubStatus').value = subscription.status || 'active';
    
    // Show form
    document.getElementById('editSubscriptionForm').style.display = 'flex';
}

// Save Subscription Edit
async function saveSubscriptionEdit(event) {
    event.preventDefault();
    
    if (!currentCustomer) return;
    
    const subId = parseInt(document.getElementById('editSubId').value);
    const subscription = currentCustomer.subscriptions.find(s => s.id === subId);
    
    if (!subscription) {
        showToast(translate('subscription.notFound', {}, 'Abonnement niet gevonden'), 'error');
        return;
    }
    
    // Store old values for history
    const oldMagazine = subscription.magazine;
    const oldDuration = subscription.duration;
    const oldStatus = subscription.status;
    
    const updates = {
        magazine: document.getElementById('editSubMagazine').value,
        duration: document.getElementById('editSubDuration').value,
        startDate: document.getElementById('editSubStartDate').value,
        status: document.getElementById('editSubStatus').value
    };

    if (window.kiwiApi) {
        try {
            await window.kiwiApi.patch(`${subscriptionsApiUrl}/${currentCustomer.id}/${subId}`, updates);

            const oldPricing = subscriptionPricing[oldDuration]?.description || 'onbekend';
            const newPricing = subscriptionPricing[updates.duration]?.description || 'onbekend';
            const statusNames = {
                'active': 'Actief',
                'paused': 'Gepauzeerd',
                'cancelled': 'Opgezegd'
            };
            const changes = [];
            if (oldMagazine !== updates.magazine) {
                changes.push(`Magazine gewijzigd van ${oldMagazine} naar ${updates.magazine}`);
            }
            if (oldDuration !== updates.duration) {
                changes.push(`Duur gewijzigd van ${oldPricing} naar ${newPricing}`);
            }
            if (oldStatus !== updates.status) {
                changes.push(`Status gewijzigd van ${statusNames[oldStatus]} naar ${statusNames[updates.status]}`);
            }

            await window.kiwiApi.post(`${personsApiUrl}/${currentCustomer.id}/contact-history`, {
                type: 'Abonnement gewijzigd',
                description: `Abonnement bewerkt. ${changes.join('. ')}.`
            });

            closeForm('editSubscriptionForm');
            showToast(translate('subscription.updated', {}, 'Abonnement succesvol bijgewerkt!'), 'success');
            await selectCustomer(currentCustomer.id);
        } catch (error) {
            showToast(error.message || translate('subscription.updateFailed', {}, 'Abonnement bijwerken via backend mislukt'), 'error');
        }
        return;
    }

    // Update subscription
    subscription.magazine = updates.magazine;
    subscription.duration = updates.duration;
    subscription.startDate = updates.startDate;
    subscription.status = updates.status;
    
    // Build change description
    let changes = [];
    if (oldMagazine !== subscription.magazine) {
        changes.push(`Magazine gewijzigd van ${oldMagazine} naar ${subscription.magazine}`);
    }
    if (oldDuration !== subscription.duration) {
        const oldPricing = subscriptionPricing[oldDuration]?.description || 'onbekend';
        const newPricing = subscriptionPricing[subscription.duration]?.description || 'onbekend';
        changes.push(`Duur gewijzigd van ${oldPricing} naar ${newPricing}`);
    }
    if (oldStatus !== subscription.status) {
        const statusNames = {
            'active': 'Actief',
            'paused': 'Gepauzeerd',
            'cancelled': 'Opgezegd'
        };
        changes.push(`Status gewijzigd van ${statusNames[oldStatus]} naar ${statusNames[subscription.status]}`);
    }
    
    // Add to contact history
    pushContactHistory(
        currentCustomer,
        {
            type: 'Abonnement gewijzigd',
            description: `Abonnement bewerkt. ${changes.join('. ')}.`
        },
        { highlight: true, persist: false }
    );

    saveCustomers();
    closeForm('editSubscriptionForm');
    showToast(translate('subscription.updated', {}, 'Abonnement succesvol bijgewerkt!'), 'success');
    
    // Refresh display
    selectCustomer(currentCustomer.id);
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
    const articlesList = document.getElementById('articlesList');
    
    if (!currentCustomer || !currentCustomer.articles || currentCustomer.articles.length === 0) {
        articlesList.innerHTML = `<p class="empty-state-small">${translate('articleOrders.none', {}, 'Geen artikelen')}</p>`;
        return;
    }

    // Sort articles by order date (newest first)
    const sortedArticles = [...currentCustomer.articles].sort((a, b) => 
        new Date(b.orderDate) - new Date(a.orderDate)
    );

    let html = '<div class="articles-group">';
    html += sortedArticles.map(order => {
        const deliveryStatusClass = {
            'ordered': 'status-ordered',
            'in_transit': 'status-transit',
            'delivered': 'status-delivered',
            'returned': 'status-returned'
        }[order.deliveryStatus] || 'status-ordered';
        
        const deliveryStatusText = {
            'ordered': translate('articleOrders.deliveryStatusOrdered', {}, 'Besteld'),
            'in_transit': translate('articleOrders.deliveryStatusInTransit', {}, 'Onderweg'),
            'delivered': translate('articleOrders.deliveryStatusDelivered', {}, 'Afgeleverd'),
            'returned': translate('articleOrders.deliveryStatusReturned', {}, 'Geretourneerd')
        }[order.deliveryStatus] || translate('articleOrders.deliveryStatusOrdered', {}, 'Besteld');
        
        const paymentStatusClass = {
            'pending': 'status-pending',
            'paid': 'status-paid',
            'refunded': 'status-refunded'
        }[order.paymentStatus] || 'status-pending';
        
        const paymentStatusText = {
            'pending': translate('articleOrders.paymentStatusPending', {}, 'In behandeling'),
            'paid': translate('articleOrders.paymentStatusPaid', {}, 'Betaald'),
            'refunded': translate('articleOrders.paymentStatusRefunded', {}, 'Terugbetaald')
        }[order.paymentStatus] || translate('articleOrders.paymentStatusPending', {}, 'In behandeling');
        
        // Calculate if return is still possible
        const returnPossible = order.returnDeadline && new Date(order.returnDeadline) > new Date();
        
        // Check if this is a multi-item order (new format) or single item (old format)
        const isMultiItemOrder = order.items && Array.isArray(order.items);
        
        let itemsDisplay = '';
        let priceDisplay = '';
        
        if (isMultiItemOrder) {
            // New format: multiple items with discounts
            itemsDisplay = order.items.map(item => 
                `${item.name} (${item.quantity}x à €${item.unitPrice.toFixed(2)})`
            ).join('<br>');
            
            priceDisplay = `
                <strong>${translate('articleOrders.subtotalLabel', {}, 'Subtotaal')}:</strong> €${order.subtotal.toFixed(2)}<br>
                ${order.totalDiscount > 0 ? `<strong>${translate('articleOrders.discountLabel', {}, 'Korting')}:</strong> <span style="color: #059669;">-€${order.totalDiscount.toFixed(2)}</span> 
                (${order.discounts.map(d => d.type).join(', ')})<br>` : ''}
                <strong>${translate('articleOrders.totalLabel', {}, 'Totaal')}:</strong> €${order.total.toFixed(2)}
            `;
        } else {
            // Old format: single item (backward compatibility)
            itemsDisplay = `${order.articleName || translate('articleOrders.itemFallback', {}, 'Artikel')} (${order.quantity}x)`;
            priceDisplay = `<strong>${translate('articleOrders.priceLabel', {}, 'Prijs')}:</strong> €${order.price.toFixed(2)}`;
        }
        
        return `
            <div class="article-item">
                <div class="article-info">
                    <div class="article-name">${translate('articleOrders.orderNumber', { id: order.id }, `🛒 Bestelling #${order.id}`)}</div>
                    <div class="article-details">
                        <strong>${translate('articleOrders.itemsLabel', {}, 'Artikelen')}:</strong><br>${itemsDisplay}<br>
                        ${priceDisplay}<br>
                        <strong>${translate('articleOrders.orderedLabel', {}, 'Besteld')}:</strong> ${formatDate(order.orderDate)} • 
                        <strong>${translate('articleOrders.desiredDeliveryLabel', {}, 'Gewenste levering')}:</strong> ${formatDate(order.desiredDeliveryDate)}
                        ${order.actualDeliveryDate ? `<br><strong>${translate('articleOrders.deliveredLabel', {}, 'Geleverd')}:</strong> ${formatDate(order.actualDeliveryDate)}` : ''}
                        ${order.trackingNumber ? `<br><strong>${translate('articleOrders.trackingLabel', {}, 'Track & Trace')}:</strong> ${order.trackingNumber}` : ''}
                        ${order.notes ? `<br><strong>${translate('articleOrders.remarkLabel', {}, 'Opmerking')}:</strong> ${order.notes}` : ''}
                        ${returnPossible ? `<br><strong>${translate('articleOrders.returnPossibleUntilLabel', {}, 'Retour mogelijk tot')}:</strong> ${formatDate(order.returnDeadline)}` : ''}
                    </div>
                </div>
                <div class="article-actions">
                    <span class="article-status ${deliveryStatusClass}">${deliveryStatusText}</span>
                    <span class="article-status ${paymentStatusClass}">${paymentStatusText}</span>
                </div>
            </div>
        `;
    }).join('');
    html += '</div>';

    articlesList.innerHTML = html;
}

// Show Article Sale Form
function showArticleSale() {
    // Prefill customer data if a customer is currently selected
    if (currentCustomer) {
        const salutation = currentCustomer.salutation || 'Dhr.';
        document.querySelector(`input[name="articleSalutation"][value="${salutation}"]`).checked = true;
        
        document.getElementById('articleInitials').value = currentCustomer.firstName;
        document.getElementById('articleMiddleName').value = currentCustomer.middleName || '';
        document.getElementById('articleLastName').value = currentCustomer.lastName;
        document.getElementById('articlePostalCode').value = currentCustomer.postalCode;
        
        // Handle house number
        const houseNumberMatch = currentCustomer.houseNumber?.match(/^(\d+)(.*)$/);
        if (houseNumberMatch) {
            document.getElementById('articleHouseNumber').value = houseNumberMatch[1];
            document.getElementById('articleHouseExt').value = houseNumberMatch[2] || '';
        } else {
            document.getElementById('articleHouseNumber').value = currentCustomer.houseNumber;
        }
        
        // Extract street name from address (remove house number)
        const streetName = currentCustomer.address.replace(/\s+\d+.*$/, '');
        document.getElementById('articleAddress').value = streetName;

        document.getElementById('articleCity').value = currentCustomer.city;
        document.getElementById('articleEmail').value = currentCustomer.email;
        document.getElementById('articlePhone').value = currentCustomer.phone;
        setBirthdayFields('article', currentCustomer.birthday);

        // Prefill delivery remarks from customer profile if available
        if (currentCustomer.deliveryRemarks && currentCustomer.deliveryRemarks.default) {
            document.getElementById('articleNotes').value = currentCustomer.deliveryRemarks.default;
        }
    } else {
        // Clear form if no customer selected
        document.getElementById('articleForm').reset();
        setBirthdayFields('article');
    }
    
    // Initialize delivery date picker with recommended date
    initDeliveryDatePicker();
    
    // Clear article search and order items
    document.getElementById('articleSearch').value = '';
    document.getElementById('articleName').value = '';
    document.getElementById('articlePrice').value = '€0,00';
    orderItems = [];
    renderOrderItems();
    
    document.getElementById('articleSaleForm').style.display = 'flex';
}

// Add Delivery Remark
function addDeliveryRemark(remark) {
    const notesField = document.getElementById('articleNotes');
    const currentValue = notesField.value.trim();
    
    if (currentValue) {
        // Append to existing notes
        notesField.value = currentValue + '\n' + remark;
    } else {
        // Set as first note
        notesField.value = remark;
    }
    
    // Visual feedback
    notesField.focus();
    notesField.scrollTop = notesField.scrollHeight;
}

function addDeliveryRemarkByKey(key) {
    const resolvedRemark = translate(key, {}, key);
    addDeliveryRemark(resolvedRemark);
}

// Update Article Price - handled by article-search.js

// Create Article Sale
async function createArticleSale(event) {
    event.preventDefault();

    // Check if there are items in the order
    if (!orderItems || orderItems.length === 0) {
        showToast(translate('articleOrders.addItem', {}, 'Voeg minimaal één artikel toe aan de bestelling'), 'error');
        return;
    }

    const salutation = document.querySelector('input[name="articleSalutation"]:checked').value;
    const initials = document.getElementById('articleInitials').value;
    const middleName = document.getElementById('articleMiddleName').value;
    const lastName = document.getElementById('articleLastName').value;
    const houseNumber = document.getElementById('articleHouseNumber').value;
    const houseExt = document.getElementById('articleHouseExt').value;
    const birthday = ensureBirthdayValue('article', false);

    if (birthday === null) {
        return;
    }

    // Get order data
    let orderData;
    try {
        orderData = await getOrderData();
    } catch (error) {
        showToast(error.message || translate('articleOrders.calculationFailed', {}, 'Bestelberekening via backend mislukt'), 'error');
        return;
    }
    
    const formData = {
        salutation: salutation,
        firstName: initials,
        middleName: middleName,
        lastName: lastName,
        postalCode: document.getElementById('articlePostalCode').value.toUpperCase(),
        houseNumber: houseExt ? `${houseNumber}${houseExt}` : houseNumber,
        address: `${document.getElementById('articleAddress').value} ${houseNumber}${houseExt}`,
        city: document.getElementById('articleCity').value,
        email: document.getElementById('articleEmail').value,
        phone: document.getElementById('articlePhone').value,
        birthday: birthday,
        desiredDeliveryDate: document.getElementById('articleDesiredDelivery').value,
        paymentMethod: document.querySelector('input[name="articlePayment"]:checked').value,
        notes: document.getElementById('articleNotes').value
    };

    // Generate tracking number
    const trackingNumber = '3SABCD' + Math.random().toString().substr(2, 10) + 'NL';
    
    // Calculate return deadline (14 days after desired delivery)
    const returnDeadline = new Date(formData.desiredDeliveryDate);
    returnDeadline.setDate(returnDeadline.getDate() + 14);
    const returnDeadlineStr = returnDeadline.toISOString().split('T')[0];

    // Create order object with all items
    const newOrder = {
        id: Date.now(),
        orderDate: new Date().toISOString().split('T')[0],
        desiredDeliveryDate: formData.desiredDeliveryDate,
        deliveryStatus: 'ordered',
        trackingNumber: trackingNumber,
        paymentStatus: 'paid', // Assume immediate payment via iDEAL/card
        paymentMethod: formData.paymentMethod,
        paymentDate: new Date().toISOString().split('T')[0],
        actualDeliveryDate: null,
        returnDeadline: returnDeadlineStr,
        notes: formData.notes,
        items: orderData.items,
        subtotal: orderData.subtotal,
        discounts: orderData.discounts,
        totalDiscount: orderData.totalDiscount,
        total: orderData.total,
        couponCode: orderData.couponCode
    };

    // Build order description for contact history
    const itemsDescription = orderData.items.map(item => 
        `${item.name} (${item.quantity}x à €${item.unitPrice.toFixed(2)})`
    ).join(', ');
    
    let discountDescription = '';
    if (orderData.discounts.length > 0) {
        const discountDetails = orderData.discounts.map(d => {
            if (d.isCoupon) {
                return `${d.type} "${d.description}" -€${d.amount.toFixed(2)}`;
            }
            return `${d.type} -€${d.amount.toFixed(2)}`;
        }).join(', ');
        discountDescription = ` Kortingen: ${discountDetails}.`;
    }
    
    const couponNote = orderData.couponCode ? ` Kortingscode: ${orderData.couponCode}.` : '';
    const fullLastName = middleName ? `${middleName} ${lastName}` : lastName;
    const contactDescription = `Artikel bestelling: ${itemsDescription}. Subtotaal: €${orderData.subtotal.toFixed(2)}.${discountDescription}${couponNote} Totaal: €${orderData.total.toFixed(2)}. Gewenste levering: ${formatDate(formData.desiredDeliveryDate)}. Betaling: ${formData.paymentMethod}.${formData.notes ? ' Opmerkingen: ' + formData.notes : ''}`;
    const hadCurrentCustomer = Boolean(currentCustomer);

    if (window.kiwiApi) {
        const orderPayload = {
            orderDate: new Date().toISOString().split('T')[0],
            desiredDeliveryDate: formData.desiredDeliveryDate,
            deliveryStatus: 'ordered',
            trackingNumber: trackingNumber,
            paymentStatus: 'paid',
            paymentMethod: formData.paymentMethod,
            paymentDate: new Date().toISOString().split('T')[0],
            actualDeliveryDate: null,
            returnDeadline: returnDeadlineStr,
            notes: formData.notes,
            items: orderData.items,
            couponCode: orderData.couponCode || null
        };
        const payload = {
            order: orderPayload,
            contactEntry: {
                type: 'Artikel bestelling',
                description: contactDescription
            }
        };

        if (currentCustomer) {
            payload.customerId = currentCustomer.id;
        } else {
            payload.customer = {
                salutation: formData.salutation,
                firstName: formData.firstName,
                middleName: formData.middleName,
                lastName: fullLastName,
                birthday: formData.birthday,
                postalCode: formData.postalCode,
                houseNumber: formData.houseNumber,
                address: formData.address,
                city: formData.city,
                email: formData.email,
                phone: formData.phone,
                subscriptions: [],
                articles: [],
                contactHistory: []
            };
        }

        try {
            const response = await window.kiwiApi.post(`${workflowsApiUrl}/article-order`, payload);
            const savedCustomer = response && response.customer ? response.customer : null;
            if (savedCustomer) {
                upsertCustomerInCache(savedCustomer);
            }

            orderItems = [];
            renderOrderItems();

            closeForm('articleSaleForm');
            showToast(
                hadCurrentCustomer
                    ? translate('articleOrders.created', {}, 'Artikel bestelling succesvol aangemaakt!')
                    : translate('articleOrders.createdWithCustomer', {}, 'Nieuwe klant en artikel bestelling succesvol aangemaakt!'),
                'success'
            );

            if (savedCustomer && savedCustomer.id) {
                await selectCustomer(savedCustomer.id);
                if (!hadCurrentCustomer) {
                    showSuccessIdentificationPrompt(savedCustomer.id, `${savedCustomer.firstName} ${savedCustomer.lastName}`);
                }
            }
        } catch (error) {
            showToast(error.message || translate('articleOrders.createFailed', {}, 'Artikel bestelling aanmaken via backend mislukt'), 'error');
            return;
        }

        document.getElementById('articleForm').reset();
        return;
    }
    
    // Check if this is for an existing customer
    if (currentCustomer) {
        // Add order to existing customer
        if (!currentCustomer.articles) {
            currentCustomer.articles = [];
        }
        currentCustomer.articles.push(newOrder);
        currentCustomer.birthday = birthday;
        
        pushContactHistory(
            currentCustomer,
            {
                type: 'Artikel bestelling',
                description: contactDescription
            },
            { highlight: true, persist: false }
        );

        saveCustomers();
        
        // Clear order items
        orderItems = [];
        renderOrderItems();
        
        closeForm('articleSaleForm');
        showToast(translate('articleOrders.created', {}, 'Artikel bestelling succesvol aangemaakt!'), 'success');
        
        // Refresh display
        selectCustomer(currentCustomer.id);
    } else {
        // Create new customer with order
        const newCustomer = {
            id: customers.length > 0 ? Math.max(...customers.map(c => c.id)) + 1 : 1,
            salutation: formData.salutation,
            firstName: formData.firstName,
            middleName: formData.middleName,
            lastName: fullLastName,
            birthday: formData.birthday,
            postalCode: formData.postalCode,
            houseNumber: formData.houseNumber,
            address: formData.address,
            city: formData.city,
            email: formData.email,
            phone: formData.phone,
            subscriptions: [],
            articles: [newOrder],
            contactHistory: [
                {
                    id: 1,
                    type: 'Artikel bestelling',
                    date: new Date().toISOString(),
                    description: contactDescription
                }
            ]
        };

        customers.push(newCustomer);
        saveCustomers();
        
        // Clear order items
        orderItems = [];
        renderOrderItems();
        
        closeForm('articleSaleForm');
        showToast(translate('articleOrders.createdWithCustomer', {}, 'Nieuwe klant en artikel bestelling succesvol aangemaakt!'), 'success');
        
        // Select the new customer
        selectCustomer(newCustomer.id);
        
        // PHASE 4: Show identification prompt if anonymous call active
        showSuccessIdentificationPrompt(newCustomer.id, `${formData.firstName} ${fullLastName}`);
    }
    
    // Reset form
    document.getElementById('articleForm').reset();
}

// Edit Delivery Remarks
function editDeliveryRemarks() {
    if (!currentCustomer) return;
    
    const modal = document.getElementById('editDeliveryRemarksModal');
    const customerName = document.getElementById('editRemarksCustomerName');
    const remarksTextarea = document.getElementById('editCustomerDeliveryRemarks');
    
    // Set customer name
    const fullName = currentCustomer.middleName 
        ? `${currentCustomer.firstName} ${currentCustomer.middleName} ${currentCustomer.lastName}`
        : `${currentCustomer.firstName} ${currentCustomer.lastName}`;
    customerName.textContent = fullName;
    
    // Set current remarks
    remarksTextarea.value = currentCustomer.deliveryRemarks?.default || '';
    
    // Show modal
    modal.style.display = 'flex';
}

// Add Delivery Remark to Modal
function addDeliveryRemarkToModal(remark) {
    const notesField = document.getElementById('editCustomerDeliveryRemarks');
    const currentValue = notesField.value.trim();
    
    if (currentValue) {
        // Append to existing notes
        notesField.value = currentValue + '\n' + remark;
    } else {
        // Set as first note
        notesField.value = remark;
    }
    
    // Visual feedback
    notesField.focus();
    notesField.scrollTop = notesField.scrollHeight;
}

function addDeliveryRemarkToModalByKey(key) {
    const resolvedRemark = translate(key, {}, key);
    addDeliveryRemarkToModal(resolvedRemark);
}

// Save Delivery Remarks
async function saveDeliveryRemarks() {
    if (!currentCustomer) return;
    
    const newRemarks = document.getElementById('editCustomerDeliveryRemarks').value.trim();

    if (window.kiwiApi) {
        try {
            const payload = await window.kiwiApi.put(`${personsApiUrl}/${currentCustomer.id}/delivery-remarks`, {
                default: newRemarks,
                updatedBy: document.getElementById('agentName').textContent
            });
            if (payload && payload.deliveryRemarks) {
                currentCustomer.deliveryRemarks = payload.deliveryRemarks;
            }
            closeEditRemarksModal();
            showToast(translate('delivery.remarksSaved', {}, 'Bezorgvoorkeuren opgeslagen!'), 'success');
            await selectCustomer(currentCustomer.id);
        } catch (error) {
            showToast(error.message || translate('delivery.saveFailed', {}, 'Bezorgvoorkeuren opslaan via backend mislukt'), 'error');
        }
        return;
    }
    
    // Initialize deliveryRemarks object if it doesn't exist
    if (!currentCustomer.deliveryRemarks) {
        currentCustomer.deliveryRemarks = {
            default: '',
            lastUpdated: null,
            history: []
        };
    }
    
    // Save to history
    if (currentCustomer.deliveryRemarks.default !== newRemarks) {
        currentCustomer.deliveryRemarks.history.unshift({
            date: new Date().toISOString(),
            remark: newRemarks,
            updatedBy: document.getElementById('agentName').textContent
        });
        
        // Add to contact history
        pushContactHistory(
            currentCustomer,
            {
                type: 'Bezorgvoorkeuren gewijzigd',
                description: `Bezorgvoorkeuren bijgewerkt: "${newRemarks || '(leeg)'}"`
            },
            { highlight: true, persist: false }
        );
    }
    
    // Update current remarks
    currentCustomer.deliveryRemarks.default = newRemarks;
    currentCustomer.deliveryRemarks.lastUpdated = new Date().toISOString();
    
    // Save to storage
    saveCustomers();
    
    // Close modal
    closeEditRemarksModal();
    
    showToast(translate('delivery.remarksSaved', {}, 'Bezorgvoorkeuren opgeslagen!'), 'success');
}

// Close Edit Remarks Modal
function closeEditRemarksModal() {
    const modal = document.getElementById('editDeliveryRemarksModal');
    modal.style.display = 'none';
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
