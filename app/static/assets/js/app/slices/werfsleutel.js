const OFFERS_API_URL = '/api/v1/catalog/offers';
const WERFSLEUTEL_SEARCH_LIMIT = 5;
const WERFSLEUTEL_FULL_SYNC_LIMIT = 250;
const WERFSLEUTEL_SEARCH_DEBOUNCE_MS = 180;
const WERFSLEUTEL_CACHE_TTL_MS = 15 * 60 * 1000;
const FALLBACK_APP_LOCALE = 'nl';
const DATE_LOCALE_BY_APP_LOCALE = {
    nl: 'nl-NL',
    en: 'en-US'
};
const SUBSCRIPTION_DURATION_DESCRIPTION_BY_KEY = {
    '1-jaar': '1 jaar - Jaarlijks betaald',
    '2-jaar': '2 jaar - Jaarlijks betaald (5% korting)',
    '3-jaar': '3 jaar - Jaarlijks betaald (10% korting)',
    '1-jaar-maandelijks': '1 jaar - Maandelijks betaald',
    '2-jaar-maandelijks': '2 jaar - Maandelijks betaald',
    '3-jaar-maandelijks': '3 jaar - Maandelijks betaald'
};

const euroFormattersByLocale = {};

const werfsleutelSliceState = {
    catalog: [],
    channels: {},
    loadAttempted: false,
    searchDebounceTimer: null,
    catalogSyncPromise: null,
    catalogSyncedAt: 0,
    selectedKey: null,
    selectedChannel: null,
    visibleMatches: [],
    activeIndex: -1,
    latestQuery: ''
};

function getGlobalScope() {
    if (typeof window !== 'undefined') {
        return window;
    }

    if (typeof globalThis !== 'undefined') {
        return globalThis;
    }

    return null;
}

function getDocument() {
    if (typeof document === 'undefined') {
        return null;
    }
    return document;
}

function normalizeAppLocale(locale) {
    if (!locale) {
        return FALLBACK_APP_LOCALE;
    }
    return String(locale).split('-')[0].toLowerCase();
}

function getAppLocale() {
    const globalScope = getGlobalScope();
    const i18nLocale = globalScope && globalScope.i18n && typeof globalScope.i18n.getLocale === 'function'
        ? globalScope.i18n.getLocale()
        : null;
    const documentLocale = getDocument() && getDocument().documentElement
        ? getDocument().documentElement.lang
        : null;
    const normalizedLocale = normalizeAppLocale(i18nLocale || documentLocale || FALLBACK_APP_LOCALE);

    if (!DATE_LOCALE_BY_APP_LOCALE[normalizedLocale]) {
        return FALLBACK_APP_LOCALE;
    }

    return normalizedLocale;
}

function getDateLocaleForApp() {
    const appLocale = getAppLocale();
    return DATE_LOCALE_BY_APP_LOCALE[appLocale] || DATE_LOCALE_BY_APP_LOCALE[FALLBACK_APP_LOCALE];
}

function translate(key, fallback) {
    const globalScope = getGlobalScope();
    const hasTranslator = globalScope && globalScope.i18n && typeof globalScope.i18n.t === 'function';
    if (hasTranslator) {
        const translatedValue = globalScope.i18n.t(key, {});
        if (translatedValue !== undefined && translatedValue !== null && translatedValue !== key) {
            return translatedValue;
        }
    }
    return fallback !== undefined ? fallback : key;
}

function notifyUser(message, type = 'info') {
    const globalScope = getGlobalScope();
    if (globalScope && typeof globalScope.showToast === 'function') {
        globalScope.showToast(message, type);
        return;
    }

    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
        console.warn(`[werfsleutel:${type}] ${message}`);
    }
}

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

function formatEuro(amount) {
    const numberValue = Number(amount);
    const safeAmount = Number.isFinite(numberValue) ? numberValue : 0;
    return getEuroFormatter().format(safeAmount);
}

function getApiClient() {
    const globalScope = getGlobalScope();
    const hasApiClient = globalScope && globalScope.kiwiApi && typeof globalScope.kiwiApi.get === 'function';
    return hasApiClient ? globalScope.kiwiApi : null;
}

function clearWerfsleutelSearchDebounceTimer() {
    if (!werfsleutelSliceState.searchDebounceTimer) {
        return;
    }

    const globalScope = getGlobalScope();
    if (globalScope && typeof globalScope.clearTimeout === 'function') {
        globalScope.clearTimeout(werfsleutelSliceState.searchDebounceTimer);
    } else {
        clearTimeout(werfsleutelSliceState.searchDebounceTimer);
    }
    werfsleutelSliceState.searchDebounceTimer = null;
}

function isActivationKey(event) {
    return event && (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar');
}

export function isWerfsleutelBarcodeQuery(value) {
    return /^\d{6,}$/.test(String(value || '').trim());
}

function isWerfsleutelCatalogStale() {
    if (!werfsleutelSliceState.catalogSyncedAt) {
        return true;
    }
    return Date.now() - werfsleutelSliceState.catalogSyncedAt > WERFSLEUTEL_CACHE_TTL_MS;
}

function normalizeWerfsleutelItem(item) {
    if (!item || typeof item !== 'object') {
        return null;
    }

    const salesCode = String(item.salesCode || '').trim();
    if (!salesCode) {
        return null;
    }

    const allowedChannels = Array.isArray(item.allowedChannels)
        ? item.allowedChannels.filter(Boolean).map((value) => String(value))
        : [];
    const priceValue = Number(item.price);

    return {
        ...item,
        salesCode,
        title: String(item.title || ''),
        price: Number.isFinite(priceValue) ? priceValue : 0,
        barcode: item.barcode === undefined || item.barcode === null ? '' : String(item.barcode),
        magazine: item.magazine === undefined || item.magazine === null ? '' : String(item.magazine),
        allowedChannels,
        isActive: item.isActive !== false
    };
}

function rememberWerfsleutels(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return;
    }

    const catalogByCode = new Map(
        werfsleutelSliceState.catalog
            .filter((item) => item && item.salesCode)
            .map((item) => [item.salesCode.toLowerCase(), item])
    );

    for (const item of items) {
        const normalizedItem = normalizeWerfsleutelItem(item);
        if (!normalizedItem) {
            continue;
        }
        catalogByCode.set(normalizedItem.salesCode.toLowerCase(), normalizedItem);
    }

    werfsleutelSliceState.catalog = Array.from(catalogByCode.values());
}

function getWerfsleutelBySalesCode(salesCode) {
    const normalizedSalesCode = String(salesCode || '').trim().toLowerCase();
    if (!normalizedSalesCode) {
        return null;
    }

    return werfsleutelSliceState.catalog.find(
        (item) => item.salesCode.toLowerCase() === normalizedSalesCode
    ) || null;
}

function findWerfsleutelByBarcode(rawValue) {
    const normalizedBarcode = String(rawValue || '').replace(/[^0-9]/g, '');
    if (!normalizedBarcode) {
        return null;
    }

    return werfsleutelSliceState.catalog.find(
        (item) => String(item.barcode || '') === normalizedBarcode
    ) || null;
}

function filterWerfsleutelCatalog(query) {
    const normalizedQuery = String(query || '').trim().toLowerCase();
    if (!normalizedQuery) {
        return werfsleutelSliceState.catalog.slice(0, WERFSLEUTEL_SEARCH_LIMIT);
    }

    return werfsleutelSliceState.catalog.filter((item) => {
        const salesCodeMatches = item.salesCode.toLowerCase().includes(normalizedQuery);
        const titleMatches = item.title.toLowerCase().includes(normalizedQuery);
        const priceMatches = String(item.price).includes(normalizedQuery);
        const barcodeMatches = String(item.barcode || '').includes(normalizedQuery);
        const magazineMatches = String(item.magazine || '').toLowerCase().includes(normalizedQuery);
        return salesCodeMatches || titleMatches || priceMatches || barcodeMatches || magazineMatches;
    }).slice(0, WERFSLEUTEL_SEARCH_LIMIT);
}

async function syncWerfsleutelsCatalog(options = {}) {
    const forceRefresh = options.force === true;
    const isBackgroundRefresh = options.background === true;
    const apiClient = getApiClient();
    if (!apiClient) {
        if (!isBackgroundRefresh) {
            console.warn(
                translate(
                    'werfsleutel.catalogUnavailable',
                    'kiwiApi niet beschikbaar; werfsleutels konden niet geladen worden.'
                )
            );
        }
        return werfsleutelSliceState.catalog;
    }

    const shouldRefreshCatalog = forceRefresh
        || werfsleutelSliceState.catalog.length === 0
        || isWerfsleutelCatalogStale();
    if (!shouldRefreshCatalog) {
        return werfsleutelSliceState.catalog;
    }

    if (werfsleutelSliceState.catalogSyncPromise) {
        return werfsleutelSliceState.catalogSyncPromise;
    }

    if (isBackgroundRefresh) {
        console.info(
            translate(
                'werfsleutel.catalogRefreshing',
                'Werfsleutels worden op de achtergrond ververst.'
            )
        );
    }

    const query = new URLSearchParams({
        type: 'werfsleutels',
        limit: String(WERFSLEUTEL_FULL_SYNC_LIMIT)
    }).toString();

    werfsleutelSliceState.catalogSyncPromise = apiClient.get(`${OFFERS_API_URL}?${query}`)
        .then((payload) => {
            const items = Array.isArray(payload && payload.items) ? payload.items : [];
            if (items.length > 0) {
                rememberWerfsleutels(items);
            }
            werfsleutelSliceState.catalogSyncedAt = Date.now();
            return werfsleutelSliceState.catalog;
        })
        .catch((error) => {
            console.warn(
                translate(
                    'werfsleutel.catalogRefreshFailed',
                    'Werfsleutel verversen mislukt, bestaande lijst blijft actief.'
                ),
                error
            );
            return werfsleutelSliceState.catalog;
        })
        .finally(() => {
            werfsleutelSliceState.catalogSyncPromise = null;
        });

    return werfsleutelSliceState.catalogSyncPromise;
}

async function ensureWerfsleutelsLoaded() {
    if (!werfsleutelSliceState.loadAttempted || werfsleutelSliceState.catalog.length === 0) {
        werfsleutelSliceState.loadAttempted = true;
        await syncWerfsleutelsCatalog({ force: true });
        return;
    }

    if (isWerfsleutelCatalogStale()) {
        void syncWerfsleutelsCatalog({ force: true, background: true });
    }
}

async function searchWerfsleutelsViaApi(query) {
    const normalizedQuery = String(query || '').trim();
    const apiClient = getApiClient();
    if (!normalizedQuery || !apiClient) {
        return [];
    }

    const queryParams = new URLSearchParams({
        type: 'werfsleutels',
        limit: String(WERFSLEUTEL_SEARCH_LIMIT)
    });

    if (isWerfsleutelBarcodeQuery(normalizedQuery)) {
        queryParams.set('barcode', normalizedQuery.replace(/[^0-9]/g, ''));
    } else {
        queryParams.set('query', normalizedQuery);
    }

    const payload = await apiClient.get(`${OFFERS_API_URL}?${queryParams.toString()}`);
    const items = Array.isArray(payload && payload.items) ? payload.items : [];
    rememberWerfsleutels(items);
    return items;
}

async function findWerfsleutelCandidate(query) {
    const normalizedQuery = String(query || '').trim();
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

    const exactCatalogMatch = getWerfsleutelBySalesCode(normalizedQuery);
    if (exactCatalogMatch) {
        return exactCatalogMatch;
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
            return apiMatches.find(
                (item) => String(item.barcode || '') === normalizedBarcode
            ) || normalizeWerfsleutelItem(apiMatches[0]);
        }

        const exactApiMatch = apiMatches.find((item) => {
            const itemSalesCode = item && item.salesCode ? String(item.salesCode).toLowerCase() : '';
            return itemSalesCode === normalizedQuery.toLowerCase();
        });
        return normalizeWerfsleutelItem(exactApiMatch || apiMatches[0]);
    } catch (error) {
        console.warn('Werfsleutel zoeken via API mislukt.', error);
        return null;
    }
}

function getActiveWerfsleutelMatch() {
    if (werfsleutelSliceState.activeIndex < 0) {
        return null;
    }
    return werfsleutelSliceState.visibleMatches[werfsleutelSliceState.activeIndex] || null;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderWerfsleutelSuggestions(matches, options = {}) {
    const documentRef = getDocument();
    const container = documentRef ? documentRef.getElementById('werfsleutelSuggestions') : null;
    const input = documentRef ? documentRef.getElementById('werfsleutelInput') : null;
    if (!container || !input) {
        return;
    }

    const hideWhenEmpty = options.hideWhenEmpty === true;
    const preserveActiveIndex = options.preserveActiveIndex === true;

    if (!Array.isArray(matches) || matches.length === 0) {
        werfsleutelSliceState.visibleMatches = [];
        werfsleutelSliceState.activeIndex = -1;

        if (hideWhenEmpty) {
            container.innerHTML = '';
            container.classList.add('hidden');
        } else {
            container.innerHTML = `<div class="empty-state-small">${translate('werfsleutel.noMatches', 'Geen werfsleutels gevonden')}</div>`;
            container.classList.remove('hidden');
        }

        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
        return;
    }

    werfsleutelSliceState.visibleMatches = matches.slice();
    if (!preserveActiveIndex) {
        werfsleutelSliceState.activeIndex = 0;
    } else if (werfsleutelSliceState.activeIndex >= werfsleutelSliceState.visibleMatches.length) {
        werfsleutelSliceState.activeIndex = werfsleutelSliceState.visibleMatches.length - 1;
    }

    container.classList.remove('hidden');
    container.innerHTML = werfsleutelSliceState.visibleMatches.map((item, index) => {
        const isActiveOption = index === werfsleutelSliceState.activeIndex;
        const statusLabel = item.isActive ? 'Actief' : 'Inactief';
        const statusClass = item.isActive ? 'status-pill--success' : 'status-pill--warning';
        const suggestionClassName = item.isActive
            ? `werfsleutel-suggestion${isActiveOption ? ' active' : ''}`
            : `werfsleutel-suggestion inactive${isActiveOption ? ' active' : ''}`;

        return `
        <button type="button"
                role="option"
                id="werfsleutelOption-${index}"
                aria-selected="${isActiveOption ? 'true' : 'false'}"
                class="${suggestionClassName}"
                data-action="select-werfsleutel"
                data-arg-sales-code="${escapeHtml(item.salesCode)}"
                data-code="${escapeHtml(item.salesCode)}">
            <span class="code">${escapeHtml(item.salesCode)}</span>
            <span class="title">${escapeHtml(item.title)}</span>
            <span class="price">${escapeHtml(formatEuro(item.price))}</span>
            <span class="status-pill ${statusClass}">
                ${statusLabel}
            </span>
        </button>
    `;
    }).join('');

    container.querySelectorAll('.werfsleutel-suggestion').forEach((button, index) => {
        button.addEventListener('mouseenter', () => {
            if (werfsleutelSliceState.activeIndex === index) {
                return;
            }
            werfsleutelSliceState.activeIndex = index;
            renderWerfsleutelSuggestions(werfsleutelSliceState.visibleMatches, { preserveActiveIndex: true });
        });
    });

    const activeOption = container.querySelector(`#werfsleutelOption-${werfsleutelSliceState.activeIndex}`);
    input.setAttribute('aria-expanded', 'true');
    if (activeOption) {
        input.setAttribute('aria-activedescendant', activeOption.id);
        activeOption.scrollIntoView({ block: 'nearest' });
    } else {
        input.removeAttribute('aria-activedescendant');
    }
}

function moveWerfsleutelActiveSelection(delta) {
    if (werfsleutelSliceState.visibleMatches.length === 0) {
        const query = werfsleutelSliceState.latestQuery;
        if (!query) {
            return;
        }

        const matches = filterWerfsleutelCatalog(query);
        if (matches.length === 0) {
            return;
        }

        renderWerfsleutelSuggestions(matches);
    }

    const totalMatches = werfsleutelSliceState.visibleMatches.length;
    if (totalMatches === 0) {
        return;
    }

    const currentIndex = werfsleutelSliceState.activeIndex;
    if (currentIndex < 0) {
        werfsleutelSliceState.activeIndex = delta > 0 ? 0 : totalMatches - 1;
    } else {
        werfsleutelSliceState.activeIndex = (currentIndex + delta + totalMatches) % totalMatches;
    }

    renderWerfsleutelSuggestions(werfsleutelSliceState.visibleMatches, { preserveActiveIndex: true });
}

function renderWerfsleutelChannelOptions() {
    const documentRef = getDocument();
    const container = documentRef ? documentRef.getElementById('werfsleutelChannels') : null;
    if (!container) {
        return;
    }

    const selectedKey = werfsleutelSliceState.selectedKey;
    if (!selectedKey) {
        container.innerHTML = `<div class="empty-state-small">${translate('werfsleutel.selectKeyFirst', 'Selecteer eerst een werfsleutel')}</div>`;
        return;
    }

    const allowedChannels = Array.isArray(selectedKey.allowedChannels)
        ? selectedKey.allowedChannels
        : [];
    const channelEntries = allowedChannels
        .filter((channelCode) => werfsleutelSliceState.channels[channelCode])
        .map((channelCode) => [channelCode, werfsleutelSliceState.channels[channelCode]]);

    if (channelEntries.length === 0) {
        werfsleutelSliceState.selectedChannel = null;
        container.innerHTML = `<div class="empty-state-small">${translate('werfsleutel.noChannels', 'Geen kanalen beschikbaar voor deze werfsleutel')}</div>`;
        return;
    }

    const allowedChannelCodes = channelEntries.map(([channelCode]) => channelCode);
    if (!allowedChannelCodes.includes(werfsleutelSliceState.selectedChannel)) {
        werfsleutelSliceState.selectedChannel = null;
    }
    if (!werfsleutelSliceState.selectedChannel && allowedChannelCodes.length === 1) {
        werfsleutelSliceState.selectedChannel = allowedChannelCodes[0];
    }

    container.innerHTML = channelEntries.map(([channelCode, channelMeta]) => {
        const isSelected = werfsleutelSliceState.selectedChannel === channelCode;
        const channelClassName = isSelected ? 'channel-chip selected' : 'channel-chip';
        return `
            <button type="button"
                    class="${channelClassName}"
                    data-action="select-werfsleutel-channel"
                    data-arg-channel-code="${escapeHtml(channelCode)}"
                    data-channel="${escapeHtml(channelCode)}"
                    title="${escapeHtml(channelMeta.label)}">
                <span class="channel-icon">${escapeHtml(channelMeta.icon)}</span>
                <span class="channel-code">${escapeHtml(channelCode)}</span>
                <span class="channel-label">${escapeHtml(channelMeta.label)}</span>
            </button>
        `;
    }).join('');
}

function updateWerfsleutelSummary() {
    const documentRef = getDocument();
    const summary = documentRef ? documentRef.getElementById('werfsleutelSummary') : null;
    if (!summary) {
        return;
    }

    const selectedKey = werfsleutelSliceState.selectedKey;
    if (!selectedKey) {
        summary.classList.remove('visible');
        summary.textContent = '';
        return;
    }

    const selectedChannelCode = werfsleutelSliceState.selectedChannel;
    const channelMeta = selectedChannelCode ? werfsleutelSliceState.channels[selectedChannelCode] : null;
    const channelLabel = selectedChannelCode && channelMeta
        ? `${selectedChannelCode} · ${channelMeta.label}`
        : translate('werfsleutel.selectChannel', 'Kies een kanaal voor deze werfsleutel.');
    const hasSelectedChannel = Boolean(selectedChannelCode && channelMeta);
    const statusClass = hasSelectedChannel ? 'status-pill--success' : 'status-pill--warning';
    const statusLabel = hasSelectedChannel
        ? translate('werfsleutel.channelSelected', 'Kanaal gekozen')
        : translate('werfsleutel.channelRequiredHint', 'Kanaal nog kiezen');

    summary.innerHTML = `
        <div>
            <strong>${escapeHtml(selectedKey.salesCode)}</strong> - ${escapeHtml(selectedKey.title)} (${escapeHtml(formatEuro(selectedKey.price))})
        </div>
        <div class="werfsleutel-summary-status">
            <span class="status-pill ${statusClass}">${escapeHtml(statusLabel)}</span>
            <span>${escapeHtml(channelLabel)}</span>
        </div>
    `;
    summary.classList.add('visible');
}

function clearWerfsleutelSelection() {
    werfsleutelSliceState.selectedKey = null;
    werfsleutelSliceState.selectedChannel = null;
    renderWerfsleutelChannelOptions();
    updateWerfsleutelSummary();
}

function selectWerfsleutel(salesCode) {
    const selectedItem = getWerfsleutelBySalesCode(salesCode);
    if (!selectedItem) {
        notifyUser(translate('werfsleutel.unknown', 'Onbekende werfsleutel.'), 'error');
        return;
    }

    if (!selectedItem.isActive) {
        notifyUser(translate('werfsleutel.notActive', 'Deze werfsleutel is niet meer actief.'), 'warning');
        return;
    }

    werfsleutelSliceState.selectedKey = selectedItem;
    const documentRef = getDocument();
    const input = documentRef ? documentRef.getElementById('werfsleutelInput') : null;
    if (input) {
        input.value = selectedItem.salesCode;
        werfsleutelSliceState.latestQuery = selectedItem.salesCode;
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
    }

    if (!selectedItem.allowedChannels.includes(werfsleutelSliceState.selectedChannel)) {
        werfsleutelSliceState.selectedChannel = null;
    }

    renderWerfsleutelSuggestions([], { hideWhenEmpty: true });
    renderWerfsleutelChannelOptions();
    updateWerfsleutelSummary();
}

function validateWerfsleutelBarcode(rawValue) {
    const barcode = String(rawValue || '').replace(/[^0-9]/g, '');
    if (!barcode) {
        return false;
    }

    const match = findWerfsleutelByBarcode(barcode);
    if (!match) {
        clearWerfsleutelSelection();
        return false;
    }

    if (!match.isActive) {
        clearWerfsleutelSelection();
        notifyUser(translate('werfsleutel.notActive', 'Deze werfsleutel is niet meer actief.'), 'warning');
        return false;
    }

    selectWerfsleutel(match.salesCode);
    return true;
}

function selectWerfsleutelChannel(channelCode) {
    const selectedChannelMeta = werfsleutelSliceState.channels[channelCode];
    if (!selectedChannelMeta) {
        notifyUser(translate('werfsleutel.unknownChannel', 'Onbekend kanaal'), 'error');
        return;
    }

    const allowedChannels = werfsleutelSliceState.selectedKey && Array.isArray(werfsleutelSliceState.selectedKey.allowedChannels)
        ? werfsleutelSliceState.selectedKey.allowedChannels
        : [];
    const channelIsAllowed = allowedChannels.length === 0 || allowedChannels.includes(channelCode);
    if (!channelIsAllowed) {
        notifyUser(
            translate('werfsleutel.channelMismatch', 'Dit kanaal hoort niet bij de gekozen werfsleutel.'),
            'warning'
        );
        return;
    }

    werfsleutelSliceState.selectedChannel = channelCode;
    renderWerfsleutelChannelOptions();
    updateWerfsleutelSummary();
}

function handleWerfsleutelQuery(rawValue) {
    const query = String(rawValue || '').trim();
    werfsleutelSliceState.latestQuery = query;

    const selectedSalesCode = werfsleutelSliceState.selectedKey
        ? werfsleutelSliceState.selectedKey.salesCode
        : '';
    const queryMatchesSelection = selectedSalesCode.toLowerCase() === query.toLowerCase();
    if (selectedSalesCode && !queryMatchesSelection) {
        clearWerfsleutelSelection();
    }

    clearWerfsleutelSearchDebounceTimer();

    if (!query) {
        renderWerfsleutelSuggestions([], { hideWhenEmpty: true });
        return;
    }

    const localMatches = filterWerfsleutelCatalog(query);
    renderWerfsleutelSuggestions(localMatches);

    if (!isWerfsleutelBarcodeQuery(query) || findWerfsleutelByBarcode(query)) {
        return;
    }

    const globalScope = getGlobalScope();
    const scheduleTimer = globalScope && typeof globalScope.setTimeout === 'function'
        ? globalScope.setTimeout.bind(globalScope)
        : setTimeout;

    werfsleutelSliceState.searchDebounceTimer = scheduleTimer(async () => {
        const lookupQuery = query;
        try {
            await searchWerfsleutelsViaApi(lookupQuery);
        } catch (error) {
            console.warn('Werfsleutel barcode lookup via API mislukt.', error);
            return;
        }

        if (werfsleutelSliceState.latestQuery !== lookupQuery) {
            return;
        }

        const refreshedMatches = filterWerfsleutelCatalog(lookupQuery);
        renderWerfsleutelSuggestions(refreshedMatches);
        validateWerfsleutelBarcode(lookupQuery);
    }, WERFSLEUTEL_SEARCH_DEBOUNCE_MS);
}

async function handleWerfsleutelInputKeyDown(event) {
    if (!event) {
        return;
    }

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
    clearWerfsleutelSearchDebounceTimer();

    const activeMatch = getActiveWerfsleutelMatch();
    if (activeMatch) {
        if (!activeMatch.isActive) {
            notifyUser(translate('werfsleutel.notActive', 'Deze werfsleutel is niet meer actief.'), 'warning');
            return;
        }
        selectWerfsleutel(activeMatch.salesCode);
        return;
    }

    const documentRef = getDocument();
    const input = documentRef ? documentRef.getElementById('werfsleutelInput') : null;
    const trimmedQuery = input ? input.value.trim() : '';
    if (!trimmedQuery) {
        return;
    }

    const candidate = await findWerfsleutelCandidate(trimmedQuery);
    if (!candidate) {
        notifyUser(translate('werfsleutel.unknown', 'Onbekende werfsleutel.'), 'error');
        return;
    }

    selectWerfsleutel(candidate.salesCode);
}

function resetWerfsleutelPicker() {
    clearWerfsleutelSearchDebounceTimer();
    werfsleutelSliceState.selectedKey = null;
    werfsleutelSliceState.selectedChannel = null;
    werfsleutelSliceState.visibleMatches = [];
    werfsleutelSliceState.activeIndex = -1;
    werfsleutelSliceState.latestQuery = '';

    const documentRef = getDocument();
    const input = documentRef ? documentRef.getElementById('werfsleutelInput') : null;
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
        const documentRef = getDocument();
        const input = documentRef ? documentRef.getElementById('werfsleutelInput') : null;
        const query = input ? input.value.trim() : '';
        if (!query) {
            return;
        }

        renderWerfsleutelSuggestions(filterWerfsleutelCatalog(query));
    });
}

async function initWerfsleutelPicker() {
    await ensureWerfsleutelsLoaded();

    const documentRef = getDocument();
    const input = documentRef ? documentRef.getElementById('werfsleutelInput') : null;
    if (!input) {
        return;
    }

    resetWerfsleutelPicker();
}

function inferMagazineFromTitle(title = '') {
    const normalizedTitle = String(title).toLowerCase();
    if (normalizedTitle.includes('avrobode')) {
        return 'Avrobode';
    }
    if (normalizedTitle.includes('mikrogids')) {
        return 'Mikrogids';
    }
    if (normalizedTitle.includes('ncrv')) {
        return 'Ncrvgids';
    }
    return translate('common.unknown', 'Onbekend');
}

function deriveMagazineFromKey(key) {
    const unknownMagazine = translate('common.unknown', 'Onbekend');
    if (!key) {
        return unknownMagazine;
    }
    if (key.magazine && key.magazine !== unknownMagazine) {
        return key.magazine;
    }
    return inferMagazineFromTitle(key.title || '');
}

export function detectDurationKeyFromTitle(title = '') {
    const normalizedTitle = String(title).toLowerCase();
    const mentionsMonthly = normalizedTitle.includes('maandelijks')
        || normalizedTitle.includes('per maand')
        || normalizedTitle.includes('maand');

    if (normalizedTitle.includes('3 jaar') || normalizedTitle.includes('36 nummers')) {
        return mentionsMonthly ? '3-jaar-maandelijks' : '3-jaar';
    }
    if (normalizedTitle.includes('2 jaar') || normalizedTitle.includes('24 nummers')) {
        return mentionsMonthly ? '2-jaar-maandelijks' : '2-jaar';
    }
    if (
        normalizedTitle.includes('1 jaar')
        || normalizedTitle.includes('12 nummers')
        || normalizedTitle.includes('proef 12')
    ) {
        return mentionsMonthly ? '1-jaar-maandelijks' : '1-jaar';
    }
    if (mentionsMonthly) {
        return '1-jaar-maandelijks';
    }
    return null;
}

export function extractDurationLabelFromTitle(title = '') {
    const normalizedTitle = String(title || '');
    if (!normalizedTitle) {
        return translate('common.unknownDuration', 'Looptijd onbekend');
    }

    const durationMatch = normalizedTitle.match(/(\d+)\s*(jaar|maand|maanden|nummers?)/i);
    if (durationMatch) {
        const unit = durationMatch[2].toLowerCase();
        const normalizedUnit = unit.startsWith('maand') ? 'maanden' : unit;
        return `${durationMatch[1]} ${normalizedUnit}`;
    }

    return translate('common.unknownDuration', 'Looptijd onbekend');
}

export function getWerfsleutelOfferDetails(key) {
    const magazine = deriveMagazineFromKey(key);
    const durationKey = detectDurationKeyFromTitle(key && key.title ? key.title : '');
    const durationLabelFromPlan = durationKey ? SUBSCRIPTION_DURATION_DESCRIPTION_BY_KEY[durationKey] : null;
    const durationLabel = durationLabelFromPlan || extractDurationLabelFromTitle(key && key.title ? key.title : '');

    return {
        magazine,
        durationKey,
        durationLabel
    };
}

function setCatalogMetadata(metadata = {}) {
    const hasChannels = metadata && metadata.channels && typeof metadata.channels === 'object';
    if (hasChannels) {
        werfsleutelSliceState.channels = { ...metadata.channels };
    }

    if (Array.isArray(metadata.catalog)) {
        rememberWerfsleutels(metadata.catalog);
    }

    const selectedSalesCode = werfsleutelSliceState.selectedKey
        ? werfsleutelSliceState.selectedKey.salesCode
        : null;
    if (selectedSalesCode) {
        werfsleutelSliceState.selectedKey = getWerfsleutelBySalesCode(selectedSalesCode);
    }

    if (werfsleutelSliceState.selectedKey) {
        const allowedChannels = Array.isArray(werfsleutelSliceState.selectedKey.allowedChannels)
            ? werfsleutelSliceState.selectedKey.allowedChannels
            : [];
        if (!allowedChannels.includes(werfsleutelSliceState.selectedChannel)) {
            werfsleutelSliceState.selectedChannel = null;
        }
    } else {
        werfsleutelSliceState.selectedChannel = null;
    }

    const hasQuery = Boolean(werfsleutelSliceState.latestQuery);
    if (hasQuery) {
        renderWerfsleutelSuggestions(filterWerfsleutelCatalog(werfsleutelSliceState.latestQuery), {
            preserveActiveIndex: true
        });
    }
    renderWerfsleutelChannelOptions();
    updateWerfsleutelSummary();
}

function getSelection() {
    const selectedChannelCode = werfsleutelSliceState.selectedChannel;
    const selectedChannelMeta = selectedChannelCode
        ? werfsleutelSliceState.channels[selectedChannelCode] || null
        : null;
    return {
        selectedKey: werfsleutelSliceState.selectedKey,
        selectedChannel: selectedChannelCode,
        selectedChannelMeta
    };
}

function installWerfsleutelBridge() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope.kiwiWerfsleutelSlice = {
        ensureLoaded: ensureWerfsleutelsLoaded,
        initializePicker: initWerfsleutelPicker,
        resetPicker: resetWerfsleutelPicker,
        refreshCatalogIfStale: triggerWerfsleutelBackgroundRefreshIfStale,
        setCatalogMetadata,
        getSelection,
        getOfferDetails: getWerfsleutelOfferDetails
    };
}

installWerfsleutelBridge();

export function registerWerfsleutelActions(actionRouter) {
    installWerfsleutelBridge();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'handle-werfsleutel-input': (_payload, context) => {
            const hasContextEvent = context && context.event;
            const hasContextElement = context && context.element;
            if (!hasContextEvent || !hasContextElement) {
                return;
            }

            if (context.event.type === 'input') {
                handleWerfsleutelQuery(context.element.value || '');
                return;
            }

            if (context.event.type === 'keydown') {
                void handleWerfsleutelInputKeyDown(context.event).catch((error) => {
                    console.error('Werfsleutel keydown handler mislukt.', error);
                });
            }
        },
        'reset-werfsleutel-picker': () => {
            resetWerfsleutelPicker();
        },
        'select-werfsleutel': (payload, context) => {
            if (!payload.salesCode) {
                return;
            }

            const isKeyboardEvent = context && context.event && context.event.type === 'keydown';
            if (isKeyboardEvent) {
                if (!isActivationKey(context.event)) {
                    return;
                }
                context.event.preventDefault();
            }

            selectWerfsleutel(payload.salesCode);
        },
        'select-werfsleutel-channel': (payload) => {
            if (!payload.channelCode) {
                return;
            }
            selectWerfsleutelChannel(payload.channelCode);
        }
    });
}

export function __resetWerfsleutelSliceForTests() {
    clearWerfsleutelSearchDebounceTimer();
    werfsleutelSliceState.catalog = [];
    werfsleutelSliceState.channels = {};
    werfsleutelSliceState.loadAttempted = false;
    werfsleutelSliceState.catalogSyncPromise = null;
    werfsleutelSliceState.catalogSyncedAt = 0;
    werfsleutelSliceState.selectedKey = null;
    werfsleutelSliceState.selectedChannel = null;
    werfsleutelSliceState.visibleMatches = [];
    werfsleutelSliceState.activeIndex = -1;
    werfsleutelSliceState.latestQuery = '';

    for (const localeKey of Object.keys(euroFormattersByLocale)) {
        delete euroFormattersByLocale[localeKey];
    }
}
