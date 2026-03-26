const OFFERS_API_URL = '/api/v1/webabo/offers';
const WERFSLEUTEL_SEARCH_LIMIT = 5;
const WERFSLEUTEL_FULL_SYNC_LIMIT = 250;
const WERFSLEUTEL_SEARCH_DEBOUNCE_MS = 180;
const WERFSLEUTEL_CACHE_TTL_MS = 15 * 60 * 1000;
const SALES_CODE_COMBINATION_ENDPOINT_SUFFIX = '/salescodecombinations';
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
const CHANNEL_DETAIL_BY_CODE = {
    EM: 'E-mail',
    ET: 'Eigen titels',
    IB: 'Inbound',
    IN: 'Inbound',
    IS: 'Interne sites',
    OL: 'Online',
    OU: 'Outbound',
    PR: 'Print',
    TM: 'Telemarketing'
};
const CHANNEL_FAMILY_BY_CODE = {
    EM: { label: 'E-mail', icon: 'mail' },
    OL: { label: 'Online', icon: 'web' },
    PR: { label: 'Print', icon: 'print' },
    TM: { label: 'Telemarketing', icon: 'phone' }
};
const CHANNEL_PREFIX_ALIASES = {
    'TM/IN': 'TM/IB'
};

const euroFormattersByLocale = {};

const werfsleutelSliceState = {
    catalog: [],
    channels: {},
    loadAttempted: false,
    searchDebounceTimer: null,
    catalogSyncPromise: null,
    catalogSyncedAt: 0,
    selectedOffers: [],
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

function normalizeCombinationCodes(rawCodes) {
    const normalizedCodes = Array.isArray(rawCodes)
        ? rawCodes
            .map((value) => String(value || '').trim().toUpperCase())
            .filter(Boolean)
        : [];

    return Array.from(new Set(normalizedCodes));
}

function resolveCombinationPresentation(codes) {
    const combinationKey = normalizeCombinationCodes(codes).join('/');
    const exactMeta = werfsleutelSliceState.channels[combinationKey];
    if (exactMeta) {
        return {
            label: String(exactMeta.label || translate('werfsleutel.defaultCombinationLabel', 'Kanaalcombinatie')),
            icon: String(exactMeta.icon || 'route')
        };
    }

    const prefixKey = combinationKey
        .split('/')
        .slice(0, 2)
        .join('/');
    const prefixMeta = werfsleutelSliceState.channels[prefixKey]
        || werfsleutelSliceState.channels[CHANNEL_PREFIX_ALIASES[prefixKey] || ''];
    if (prefixMeta) {
        return {
            label: String(prefixMeta.label || translate('werfsleutel.defaultCombinationLabel', 'Kanaalcombinatie')),
            icon: String(prefixMeta.icon || 'route')
        };
    }

    const familyCode = normalizeCombinationCodes(codes)[0] || '';
    const familyMeta = CHANNEL_FAMILY_BY_CODE[familyCode];
    if (familyMeta) {
        return familyMeta;
    }

    return {
        label: translate('werfsleutel.defaultCombinationLabel', 'Kanaalcombinatie'),
        icon: 'route'
    };
}

function normalizeCombinationOption(item, fallbackSource = 'offer-fallback') {
    if (!item) {
        return null;
    }

    const rawCodes = Array.isArray(item.codes)
        ? item.codes
        : typeof item === 'string'
            ? item.split('/')
            : [];
    const codes = normalizeCombinationCodes(rawCodes);
    if (codes.length === 0) {
        return null;
    }

    const key = String(item.key || codes.join('/'));
    const presentation = resolveCombinationPresentation(codes);
    const detail = item.detail
        ? String(item.detail)
        : codes.map((code) => CHANNEL_DETAIL_BY_CODE[code] || code).join(' / ');

    return {
        key,
        codes,
        displayCode: String(item.displayCode || codes.join(' / ')),
        label: String(item.label || presentation.label),
        icon: String(item.icon || presentation.icon),
        detail,
        description: String(item.description || ''),
        source: String(item.source || fallbackSource)
    };
}

function buildFallbackCombinationOptions(offer) {
    const allowedChannels = Array.isArray(offer && offer.allowedChannels)
        ? offer.allowedChannels
        : [];

    return allowedChannels
        .map((allowedChannel) => normalizeCombinationOption(allowedChannel, 'offer-fallback'))
        .filter(Boolean);
}

function buildSalesCodeCombinationUrl(salesCode) {
    return `${OFFERS_API_URL}/${encodeURIComponent(String(salesCode || '').trim())}${SALES_CODE_COMBINATION_ENDPOINT_SUFFIX}`;
}

function findSelectedOfferEntryIndex(salesCode) {
    const normalizedSalesCode = String(salesCode || '').trim().toLowerCase();
    return werfsleutelSliceState.selectedOffers.findIndex(
        (entry) => String(entry.offer && entry.offer.salesCode || '').trim().toLowerCase() === normalizedSalesCode
    );
}

function findSelectedOfferEntry(salesCode) {
    const entryIndex = findSelectedOfferEntryIndex(salesCode);
    return entryIndex >= 0 ? werfsleutelSliceState.selectedOffers[entryIndex] : null;
}

function getSelectedCombinationCount() {
    return werfsleutelSliceState.selectedOffers.filter((entry) => Boolean(entry.selectedCombinationKey)).length;
}

function getFirstIncompleteOfferIndex() {
    return werfsleutelSliceState.selectedOffers.findIndex((entry) => !entry.selectedCombinationKey);
}

function ensureFirstIncompleteOfferExpanded() {
    const firstIncompleteIndex = getFirstIncompleteOfferIndex();
    if (firstIncompleteIndex < 0) {
        return;
    }

    const firstIncompleteEntry = werfsleutelSliceState.selectedOffers[firstIncompleteIndex];
    if (!firstIncompleteEntry || firstIncompleteEntry.isExpanded !== false) {
        return;
    }

    werfsleutelSliceState.selectedOffers[firstIncompleteIndex] = {
        ...firstIncompleteEntry,
        isExpanded: true
    };
}

function getSelectionCountLabel(count) {
    if (count === 1) {
        return translate('werfsleutel.selectionCountSingle', '1 product toegevoegd');
    }

    return translate('werfsleutel.selectionCountMultiple', '{count} producten toegevoegd')
        .replace('{count}', String(count));
}

function getSummaryStatusLabel(offerCount, openCount) {
    if (openCount === 0) {
        return translate('werfsleutel.summaryStatusComplete', '{count}/{total} compleet')
            .replace('{count}', String(offerCount))
            .replace('{total}', String(offerCount));
    }

    return translate('werfsleutel.summaryStatusOpen', '{count}/{total} open')
        .replace('{count}', String(openCount))
        .replace('{total}', String(offerCount));
}

function getSummaryLeadText(openCount) {
    if (openCount === 0) {
        return translate('werfsleutel.summaryLeadComplete', 'Alle kanaalcombinaties zijn gekozen.');
    }

    if (openCount === 1) {
        return translate('werfsleutel.summaryLeadPendingSingle', 'Nog 1 kanaalcombinatie kiezen.');
    }

    return translate('werfsleutel.summaryLeadPendingMultiple', 'Nog {count} kanaalcombinaties kiezen.')
        .replace('{count}', String(openCount));
}

function getSummaryHintText(openCount) {
    if (openCount === 0) {
        return translate('werfsleutel.summaryHintComplete', 'Alle producten zijn compleet ingesteld.');
    }

    return translate('werfsleutel.summaryHintPending', 'Kies hieronder per product de juiste combinatie.');
}

function toggleSelectedOfferExpansion(salesCode) {
    const entryIndex = findSelectedOfferEntryIndex(salesCode);
    if (entryIndex < 0) {
        return;
    }

    const entry = werfsleutelSliceState.selectedOffers[entryIndex];
    const nextExpandedState = entry.isExpanded === false;
    if (!nextExpandedState && entryIndex === getFirstIncompleteOfferIndex()) {
        return;
    }

    werfsleutelSliceState.selectedOffers[entryIndex] = {
        ...entry,
        isExpanded: nextExpandedState
    };
    renderSelectedOfferList();
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

function renderSelectedOfferList() {
    const documentRef = getDocument();
    const container = documentRef ? documentRef.getElementById('subscriptionOfferSelections') : null;
    if (!container) {
        return;
    }

    if (!Array.isArray(werfsleutelSliceState.selectedOffers) || werfsleutelSliceState.selectedOffers.length === 0) {
        container.innerHTML = `<div class="empty-state-small">${translate('werfsleutel.noOffersSelected', 'Nog geen aanbiedingen toegevoegd')}</div>`;
        return;
    }

    ensureFirstIncompleteOfferExpanded();

    container.innerHTML = werfsleutelSliceState.selectedOffers.map((entry) => {
        const offer = entry.offer || {};
        const offerDetails = getWerfsleutelOfferDetails(offer);
        const isExpanded = entry.isExpanded !== false;
        const normalizedOfferTitle = String(offer.title || '').trim();
        const unknownLabel = translate('common.unknown', 'Onbekend');
        const metaParts = [];
        if (offerDetails.magazine && offerDetails.magazine !== unknownLabel && offerDetails.magazine !== normalizedOfferTitle) {
            metaParts.push(offerDetails.magazine);
        }
        const priceLabel = formatEuro(offer.price);
        const hasSelectedCombination = Boolean(entry.selectedCombinationKey);
        const statusLabel = translate('werfsleutel.channelRequiredHint', 'Open');
        const combinationOptions = Array.isArray(entry.combinationOptions) ? entry.combinationOptions : [];
        const selectedOption = combinationOptions.find((option) => option.key === entry.selectedCombinationKey) || null;
        const toggleLabel = isExpanded
            ? translate('werfsleutel.collapseOffer', 'Kanaalkeuze inklappen')
            : translate('werfsleutel.expandOffer', 'Kanaalkeuze openen');
        const selectedChannelBadgeMarkup = selectedOption
            ? `<span class="subscription-offer-channel-code" title="${escapeHtml(selectedOption.label || selectedOption.detail || '')}">${escapeHtml(selectedOption.displayCode)}</span>`
            : '';
        const optionMarkup = entry.loadingCombinations && combinationOptions.length === 0
            ? `<div class="empty-state-small">${translate('werfsleutel.loadingCombinations', 'Kanaalcombinaties laden...')}</div>`
            : combinationOptions.length === 0
                ? `<div class="empty-state-small">${translate('werfsleutel.noChannels', 'Geen kanalen beschikbaar voor deze werfsleutel')}</div>`
                : combinationOptions.map((option) => {
                    const isSelected = entry.selectedCombinationKey === option.key;
                    return `
                        <button type="button"
                                class="${isSelected ? 'channel-chip selected' : 'channel-chip'}"
                                data-action="select-werfsleutel-channel"
                                data-arg-sales-code="${escapeHtml(offer.salesCode)}"
                                data-arg-combination-key="${escapeHtml(option.key)}"
                                title="${escapeHtml(option.detail || option.label)}">
                            <span class="channel-icon">${escapeHtml(option.icon)}</span>
                            <span class="channel-code">${escapeHtml(option.displayCode)}</span>
                            <span class="channel-label">${escapeHtml(option.label)}</span>
                            <span class="channel-detail">${escapeHtml(option.detail)}</span>
                        </button>
                    `;
                }).join('');
        const warningMarkup = entry.combinationError
            ? `<div class="subscription-offer-warning">${escapeHtml(entry.combinationError)}</div>`
            : '';
        const offerMetaBadges = [];

        if (offer.salesCode) {
            offerMetaBadges.push(`<span class="subscription-offer-code">${escapeHtml(offer.salesCode)}</span>`);
        }

        if (selectedChannelBadgeMarkup) {
            offerMetaBadges.push(selectedChannelBadgeMarkup);
        }

        offerMetaBadges.push(
            ...metaParts.map((metaPart) => `<span class="subscription-offer-meta-badge">${escapeHtml(metaPart)}</span>`)
        );

        const metaMarkup = offerMetaBadges.length > 0
            ? `<span class="subscription-offer-meta">${offerMetaBadges.join('')}</span>`
            : '';
        const statusMarkup = hasSelectedCombination
            ? ''
            : `<span class="status-pill status-pill--warning">${escapeHtml(statusLabel)}</span>`;

        return `
            <article class="subscription-offer-card ${isExpanded ? 'is-expanded' : 'is-collapsed'}">
                <div class="subscription-offer-header">
                    <button type="button"
                            class="subscription-offer-toggle"
                            data-action="toggle-subscription-offer"
                            data-arg-sales-code="${escapeHtml(offer.salesCode)}"
                            aria-expanded="${isExpanded ? 'true' : 'false'}"
                            title="${escapeHtml(toggleLabel)}">
                        <span class="subscription-offer-toggle-main">
                            <span class="subscription-offer-title-row">
                                <strong class="subscription-offer-title">${escapeHtml(offer.title || translate('werfsleutel.unknownTitle', 'Onbekende werfsleutel'))}</strong>
                                <span class="subscription-offer-price">${escapeHtml(priceLabel)}</span>
                            </span>
                            ${metaMarkup}
                        </span>
                        <span class="subscription-offer-toggle-side">
                            ${statusMarkup}
                            <span class="subscription-offer-chevron" aria-hidden="true">${isExpanded ? '▾' : '▸'}</span>
                        </span>
                    </button>
                    <button type="button"
                            class="btn btn-secondary ghost btn-small"
                            data-action="remove-subscription-offer"
                            data-arg-sales-code="${escapeHtml(offer.salesCode)}">
                        ${escapeHtml(translate('werfsleutel.removeOffer', 'Verwijderen'))}
                    </button>
                </div>
                ${isExpanded ? `<div class="channel-options">${optionMarkup}</div>` : ''}
                ${warningMarkup}
            </article>
        `;
    }).join('');
}

function updateWerfsleutelSummary() {
    const documentRef = getDocument();
    const summary = documentRef ? documentRef.getElementById('werfsleutelSummary') : null;
    if (!summary) {
        return;
    }

    const offerCount = werfsleutelSliceState.selectedOffers.length;
    if (offerCount === 0) {
        summary.classList.remove('visible', 'is-complete', 'is-pending');
        summary.textContent = '';
        return;
    }

    const selectedCombinationCount = getSelectedCombinationCount();
    const openCount = Math.max(offerCount - selectedCombinationCount, 0);
    const isComplete = openCount === 0;
    const statusLabel = getSummaryStatusLabel(offerCount, openCount);
    const leadText = getSummaryLeadText(openCount);
    const hintText = getSummaryHintText(openCount);

    summary.innerHTML = `
        <div class="werfsleutel-summary-row">
            <strong class="werfsleutel-summary-count">${escapeHtml(getSelectionCountLabel(offerCount))}</strong>
            <span class="werfsleutel-summary-badge ${isComplete ? 'is-complete' : 'is-open'}">${escapeHtml(statusLabel)}</span>
        </div>
        <p class="werfsleutel-summary-copy">
            <span class="werfsleutel-summary-lead">${escapeHtml(leadText)}</span>
            <span class="werfsleutel-summary-hint">${escapeHtml(hintText)}</span>
        </p>
    `;
    summary.classList.remove('is-complete', 'is-pending');
    summary.classList.add(isComplete ? 'is-complete' : 'is-pending');
    summary.classList.add('visible');
}

async function loadSalesCodeCombinationsForOffer(salesCode) {
    const entryIndex = findSelectedOfferEntryIndex(salesCode);
    if (entryIndex < 0) {
        return;
    }

    const apiClient = getApiClient();
    if (!apiClient || typeof apiClient.get !== 'function') {
        return;
    }

    const existingEntry = werfsleutelSliceState.selectedOffers[entryIndex];
    werfsleutelSliceState.selectedOffers[entryIndex] = {
        ...existingEntry,
        loadingCombinations: true,
        combinationError: null
    };
    renderSelectedOfferList();

    try {
        const payload = await apiClient.get(buildSalesCodeCombinationUrl(salesCode));
        const items = Array.isArray(payload && payload.items)
            ? payload.items.map((item) => normalizeCombinationOption(item, 'webabo-salescodecombinations')).filter(Boolean)
            : [];
        if (findSelectedOfferEntryIndex(salesCode) < 0) {
            return;
        }

        const currentEntry = findSelectedOfferEntry(salesCode);
        const nextCombinationOptions = items.length > 0 ? items : currentEntry.combinationOptions;
        const nextSelectedCombinationKey = currentEntry && items.some((item) => item.key === currentEntry.selectedCombinationKey)
            ? currentEntry.selectedCombinationKey
            : items.length === 1
                ? items[0].key
                : null;

        werfsleutelSliceState.selectedOffers[findSelectedOfferEntryIndex(salesCode)] = {
            ...currentEntry,
            combinationOptions: nextCombinationOptions,
            selectedCombinationKey: nextSelectedCombinationKey,
            loadingCombinations: false,
            isExpanded: nextSelectedCombinationKey && !currentEntry.selectedCombinationKey
                ? false
                : currentEntry.isExpanded,
            combinationError: payload && payload.warning
                ? String(payload.warning)
                : nextCombinationOptions.length > 0
                    ? null
                    : translate('werfsleutel.noChannels', 'Geen kanalen beschikbaar voor deze werfsleutel')
        };
    } catch (error) {
        const fallbackEntry = findSelectedOfferEntry(salesCode);
        if (!fallbackEntry) {
            return;
        }

        werfsleutelSliceState.selectedOffers[findSelectedOfferEntryIndex(salesCode)] = {
            ...fallbackEntry,
            loadingCombinations: false,
            combinationError: translate(
                'werfsleutel.salesCodeCombinationFallback',
                'Live kanaalcombinaties konden niet geladen worden; de bekende offerkanalen blijven beschikbaar.'
            )
        };
    }

    renderSelectedOfferList();
    updateWerfsleutelSummary();
}

function addSelectedOffer(salesCode) {
    const selectedItem = getWerfsleutelBySalesCode(salesCode);
    if (!selectedItem) {
        notifyUser(translate('werfsleutel.unknown', 'Onbekende werfsleutel.'), 'error');
        return;
    }

    if (!selectedItem.isActive) {
        notifyUser(translate('werfsleutel.notActive', 'Deze werfsleutel is niet meer actief.'), 'warning');
        return;
    }

    if (findSelectedOfferEntryIndex(selectedItem.salesCode) >= 0) {
        notifyUser(translate('werfsleutel.offerAlreadyAdded', 'Deze aanbieding staat al in de lijst.'), 'warning');
        return;
    }

    const fallbackCombinationOptions = buildFallbackCombinationOptions(selectedItem);
    werfsleutelSliceState.selectedOffers.push({
        offer: selectedItem,
        combinationOptions: fallbackCombinationOptions,
        selectedCombinationKey: fallbackCombinationOptions.length === 1 ? fallbackCombinationOptions[0].key : null,
        isExpanded: true,
        loadingCombinations: true,
        combinationError: null
    });

    const documentRef = getDocument();
    const input = documentRef ? documentRef.getElementById('werfsleutelInput') : null;
    if (input) {
        input.value = '';
        input.setAttribute('aria-expanded', 'false');
        input.removeAttribute('aria-activedescendant');
    }

    werfsleutelSliceState.latestQuery = '';
    renderWerfsleutelSuggestions([], { hideWhenEmpty: true });
    renderSelectedOfferList();
    updateWerfsleutelSummary();

    void loadSalesCodeCombinationsForOffer(selectedItem.salesCode);
}

function removeSelectedOffer(salesCode) {
    const entryIndex = findSelectedOfferEntryIndex(salesCode);
    if (entryIndex < 0) {
        return;
    }

    werfsleutelSliceState.selectedOffers.splice(entryIndex, 1);
    renderSelectedOfferList();
    updateWerfsleutelSummary();
}

function validateWerfsleutelBarcode(rawValue) {
    const barcode = String(rawValue || '').replace(/[^0-9]/g, '');
    if (!barcode) {
        return false;
    }

    const match = findWerfsleutelByBarcode(barcode);
    if (!match) {
        return false;
    }

    if (!match.isActive) {
        notifyUser(translate('werfsleutel.notActive', 'Deze werfsleutel is niet meer actief.'), 'warning');
        return false;
    }

    addSelectedOffer(match.salesCode);
    return true;
}

function selectWerfsleutelChannel(salesCode, combinationKey) {
    const entryIndex = findSelectedOfferEntryIndex(salesCode);
    if (entryIndex < 0) {
        return;
    }

    const entry = werfsleutelSliceState.selectedOffers[entryIndex];
    const selectedOption = Array.isArray(entry.combinationOptions)
        ? entry.combinationOptions.find((option) => option.key === combinationKey)
        : null;
    if (!selectedOption) {
        notifyUser(translate('werfsleutel.unknownChannel', 'Onbekend kanaal'), 'error');
        return;
    }

    werfsleutelSliceState.selectedOffers[entryIndex] = {
        ...entry,
        selectedCombinationKey: selectedOption.key,
        isExpanded: false
    };
    renderSelectedOfferList();
    updateWerfsleutelSummary();
}

function handleWerfsleutelQuery(rawValue) {
    const query = String(rawValue || '').trim();
    werfsleutelSliceState.latestQuery = query;

    clearWerfsleutelSearchDebounceTimer();

    if (!query) {
        renderWerfsleutelSuggestions([], { hideWhenEmpty: true });
        return;
    }

    const localMatches = filterWerfsleutelCatalog(query);
    renderWerfsleutelSuggestions(localMatches);

    const isBarcodeLookup = isWerfsleutelBarcodeQuery(query);
    const localBarcodeMatch = isBarcodeLookup ? findWerfsleutelByBarcode(query) : null;
    const shouldSearchViaApi = query.length >= 2 || isBarcodeLookup;

    if (!shouldSearchViaApi || (isBarcodeLookup && localBarcodeMatch)) {
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
            console.warn('Werfsleutel lookup via API mislukt.', error);
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
        addSelectedOffer(activeMatch.salesCode);
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

    addSelectedOffer(candidate.salesCode);
}

function resetWerfsleutelPicker() {
    clearWerfsleutelSearchDebounceTimer();
    werfsleutelSliceState.selectedOffers = [];
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
    renderSelectedOfferList();
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
    const inferredMagazine = inferMagazineFromTitle(key.title || '');
    if (inferredMagazine !== unknownMagazine) {
        return inferredMagazine;
    }

    if (key.title) {
        return String(key.title);
    }

    return unknownMagazine;
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

    werfsleutelSliceState.selectedOffers = werfsleutelSliceState.selectedOffers.map((entry) => {
        const refreshedOffer = getWerfsleutelBySalesCode(entry.offer && entry.offer.salesCode ? entry.offer.salesCode : '')
            || entry.offer;
        const fallbackCombinationOptions = buildFallbackCombinationOptions(refreshedOffer);
        const nextCombinationOptions = Array.isArray(entry.combinationOptions) && entry.combinationOptions.length > 0
            ? entry.combinationOptions
            : fallbackCombinationOptions;
        const hasSelectedCombination = nextCombinationOptions.some((option) => option.key === entry.selectedCombinationKey);

        return {
            ...entry,
            offer: refreshedOffer,
            combinationOptions: nextCombinationOptions,
            isExpanded: entry.isExpanded !== false,
            selectedCombinationKey: hasSelectedCombination
                ? entry.selectedCombinationKey
                : nextCombinationOptions.length === 1
                    ? nextCombinationOptions[0].key
                    : null
        };
    });

    const hasQuery = Boolean(werfsleutelSliceState.latestQuery);
    if (hasQuery) {
        renderWerfsleutelSuggestions(filterWerfsleutelCatalog(werfsleutelSliceState.latestQuery), {
            preserveActiveIndex: true
        });
    }
    renderSelectedOfferList();
    updateWerfsleutelSummary();
}

function getSelections() {
    return werfsleutelSliceState.selectedOffers.map((entry) => {
        const selectedChannelMeta = Array.isArray(entry.combinationOptions)
            ? entry.combinationOptions.find((option) => option.key === entry.selectedCombinationKey) || null
            : null;

        return {
            selectedKey: entry.offer || null,
            selectedChannel: selectedChannelMeta ? selectedChannelMeta.key : null,
            selectedChannelMeta
        };
    });
}

function getSelection() {
    const selections = getSelections();
    if (selections.length !== 1) {
        return {
            selectedKey: null,
            selectedChannel: null,
            selectedChannelMeta: null
        };
    }

    const [selection] = selections;
    return {
        selectedKey: selection.selectedKey || null,
        selectedChannel: selection.selectedChannel || null,
        selectedChannelMeta: selection.selectedChannelMeta || null
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
        getSelections,
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

            addSelectedOffer(payload.salesCode);
        },
        'select-werfsleutel-channel': (payload) => {
            if (!payload.salesCode || !payload.combinationKey) {
                return;
            }
            selectWerfsleutelChannel(payload.salesCode, payload.combinationKey);
        },
        'toggle-subscription-offer': (payload) => {
            if (!payload.salesCode) {
                return;
            }

            toggleSelectedOfferExpansion(payload.salesCode);
        },
        'remove-subscription-offer': (payload) => {
            if (!payload.salesCode) {
                return;
            }

            removeSelectedOffer(payload.salesCode);
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
    werfsleutelSliceState.selectedOffers = [];
    werfsleutelSliceState.visibleMatches = [];
    werfsleutelSliceState.activeIndex = -1;
    werfsleutelSliceState.latestQuery = '';

    for (const localeKey of Object.keys(euroFormattersByLocale)) {
        delete euroFormattersByLocale[localeKey];
    }
}
