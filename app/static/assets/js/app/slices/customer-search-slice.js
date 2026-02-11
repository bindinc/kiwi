import { getGlobalScope } from '../services.js';

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

const searchState = {
    results: [],
    currentPage: 1,
    itemsPerPage: 20,
    sortBy: 'name'
};

let compatibilityExportsInstalled = false;

function getLegacySearchBridge() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return null;
    }

    const bridge = globalScope.kiwiLegacyCustomerSearchBridge;
    if (!bridge || typeof bridge !== 'object') {
        return null;
    }

    return bridge;
}

function readLegacyCustomers() {
    const bridge = getLegacySearchBridge();
    if (!bridge || typeof bridge.getCustomers !== 'function') {
        return [];
    }

    const customers = bridge.getCustomers();
    return Array.isArray(customers) ? customers : [];
}

function readLegacyCurrentCustomer() {
    const bridge = getLegacySearchBridge();
    if (!bridge || typeof bridge.getCurrentCustomer !== 'function') {
        return null;
    }

    return bridge.getCurrentCustomer() || null;
}

function writeLegacyCurrentCustomer(customer) {
    const bridge = getLegacySearchBridge();
    if (!bridge || typeof bridge.setCurrentCustomer !== 'function') {
        return;
    }

    bridge.setCurrentCustomer(customer);
}

function readLegacyCallSession() {
    const bridge = getLegacySearchBridge();
    if (!bridge || typeof bridge.getCallSession !== 'function') {
        return null;
    }

    const callSession = bridge.getCallSession();
    return callSession && typeof callSession === 'object' ? callSession : null;
}

function translateKey(key, params = {}, fallback = key) {
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

function showToast(message, type = 'success') {
    const globalScope = getGlobalScope();
    if (!globalScope || typeof globalScope.showToast !== 'function') {
        console.error(message);
        return;
    }

    globalScope.showToast(message, type);
}

function normalizePhone(value = '') {
    return String(value || '').replace(/\D/g, '');
}

function generateSubscriptionNumber(customerId, subscriptionId) {
    const globalScope = getGlobalScope();
    if (globalScope && typeof globalScope.generateSubscriptionNumber === 'function') {
        return globalScope.generateSubscriptionNumber(customerId, subscriptionId);
    }

    const numericCustomerId = Number(customerId);
    const numericSubscriptionId = Number(subscriptionId);
    if (!Number.isFinite(numericCustomerId) || !Number.isFinite(numericSubscriptionId)) {
        return '-';
    }

    const range = MAX_SUB_NUMBER - MIN_SUB_NUMBER + 1;
    const seed = Math.abs((numericCustomerId * 73856093) ^ (numericSubscriptionId * 193939));
    const offset = seed % range;
    return String(MIN_SUB_NUMBER + offset);
}

function getElementValueById(elementId) {
    if (typeof document === 'undefined') {
        return '';
    }

    const input = document.getElementById(elementId);
    if (!input || typeof input.value !== 'string') {
        return '';
    }

    return input.value;
}

function setElementDisplay(element, displayValue) {
    if (!element || !element.style) {
        return;
    }

    element.style.display = displayValue;
}

function getSearchFilters() {
    const postalCode = getElementValueById('searchPostalCode').toUpperCase().trim();
    const houseNumber = getElementValueById('searchHouseNumber').trim();
    const name = getElementValueById('searchName').toLowerCase().trim();
    const phone = normalizePhone(getElementValueById('searchPhone'));
    const email = getElementValueById('searchEmail').toLowerCase().trim();

    return {
        postalCode,
        houseNumber,
        name,
        phone,
        email
    };
}

function matchesCustomerName(customer, nameQuery) {
    if (!nameQuery) {
        return true;
    }

    const firstName = String(customer.firstName || '').trim();
    const middleName = String(customer.middleName || '').trim();
    const lastName = String(customer.lastName || '').trim();

    const nameCandidates = [
        firstName,
        lastName,
        `${firstName} ${lastName}`,
        middleName ? `${firstName} ${middleName} ${lastName}` : ''
    ]
        .filter(Boolean)
        .map((value) => value.toLowerCase());

    return nameCandidates.some((value) => value.includes(nameQuery));
}

function matchesCustomerPhone(customer, phoneQuery) {
    if (!phoneQuery) {
        return true;
    }

    const customerPhone = normalizePhone(customer.phone || '');
    return customerPhone.includes(phoneQuery);
}

function matchesCustomerEmail(customer, emailQuery) {
    if (!emailQuery) {
        return true;
    }

    const customerEmail = String(customer.email || '').toLowerCase();
    return customerEmail.includes(emailQuery);
}

function buildSearchQueryLabel() {
    const postalCode = getElementValueById('searchPostalCode').trim();
    const houseNumber = getElementValueById('searchHouseNumber').trim();
    const name = getElementValueById('searchName').trim();

    const labelParts = [];

    if (postalCode || houseNumber) {
        labelParts.push([postalCode, houseNumber].filter(Boolean).join(' '));
    }

    if (name) {
        labelParts.push(translateKey('search.nameFilterLabel', { name }, `Naam: ${name}`));
    }

    if (labelParts.length === 0) {
        return translateKey('search.allCustomers', {}, 'alle klanten');
    }

    return labelParts.join(' • ');
}

function getWelcomeMessageMarkup() {
    return `
        <div class="empty-state">
            <span class="empty-icon">👤</span>
            <h2>${translateKey('welcome.title', {}, 'Welkom bij Klantenservice')}</h2>
            <p>${translateKey('welcome.description', {}, 'Zoek een klant of start een nieuwe actie')}</p>
        </div>
    `;
}

function getSearchEmptyStateMarkup() {
    return `
        <div class="empty-state">
            <span class="empty-icon">🔍</span>
            <h2>${translateKey('search.noneFoundTitle', {}, 'Geen klanten gevonden')}</h2>
            <p>${translateKey('search.noneFoundDescription', {}, 'Pas je zoekcriteria aan en probeer opnieuw')}</p>
        </div>
    `;
}

export function setAdditionalFiltersOpen(isOpen) {
    if (typeof document === 'undefined') {
        return;
    }

    const panel = document.getElementById('additionalFiltersPanel');
    const toggle = document.getElementById('additionalFiltersToggle');

    if (!panel || !toggle) {
        return;
    }

    if (isOpen) {
        panel.classList.add('is-open');
        setElementDisplay(panel, 'grid');
    } else {
        panel.classList.remove('is-open');
        setElementDisplay(panel, 'none');
    }

    toggle.setAttribute('aria-expanded', String(isOpen));
}

export function toggleAdditionalFilters() {
    if (typeof document === 'undefined') {
        return;
    }

    const panel = document.getElementById('additionalFiltersPanel');
    if (!panel) {
        return;
    }

    const willOpen = !panel.classList.contains('is-open');
    setAdditionalFiltersOpen(willOpen);
}

function setSearchResults(results) {
    searchState.results = Array.isArray(results) ? results : [];
    searchState.currentPage = 1;
    searchState.sortBy = 'name';
}

function buildSearchParams(filters) {
    const query = new URLSearchParams();

    if (filters.postalCode) {
        query.set('postalCode', filters.postalCode);
    }
    if (filters.houseNumber) {
        query.set('houseNumber', filters.houseNumber);
    }
    if (filters.name) {
        query.set('name', filters.name);
    }
    if (filters.phone) {
        query.set('phone', filters.phone);
    }
    if (filters.email) {
        query.set('email', filters.email);
    }

    query.set('sortBy', searchState.sortBy || 'name');
    query.set('page', '1');
    query.set('pageSize', '200');

    return query;
}

function filterCustomersLocally(customers, filters) {
    return customers.filter((customer) => {
        const matchPostal = !filters.postalCode || String(customer.postalCode || '') === filters.postalCode;
        const matchHouse = !filters.houseNumber || String(customer.houseNumber || '') === filters.houseNumber;
        const matchName = matchesCustomerName(customer, filters.name);
        const matchPhone = matchesCustomerPhone(customer, filters.phone);
        const matchEmail = matchesCustomerEmail(customer, filters.email);

        return matchPostal && matchHouse && matchName && matchPhone && matchEmail;
    });
}

export async function searchCustomer() {
    const filters = getSearchFilters();
    const globalScope = getGlobalScope();
    let results = [];

    if (globalScope && globalScope.kiwiApi && typeof globalScope.kiwiApi.get === 'function') {
        const query = buildSearchParams(filters);

        try {
            const payload = await globalScope.kiwiApi.get(`/api/v1/persons?${query.toString()}`);
            results = Array.isArray(payload && payload.items) ? payload.items : [];
        } catch (error) {
            console.error('Kon klanten niet zoeken via API', error);
            showToast(translateKey('search.backendFailed', {}, 'Zoeken via backend mislukt'), 'error');
            return;
        }
    } else {
        const customers = readLegacyCustomers();
        results = filterCustomersLocally(customers, filters);
    }

    setSearchResults(results);
    sortResultsData();
    displayPaginatedResults();
}

export function handleSearchKeyPress(event) {
    if (!event) {
        return;
    }

    const pressedEnter = event.key === 'Enter' || event.keyCode === 13;
    if (!pressedEnter) {
        return;
    }

    if (typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    void searchCustomer();
}

function getCustomerInitials(customer) {
    const providedInitials = String(customer.initials || '').trim();
    if (providedInitials) {
        return providedInitials;
    }

    const firstName = String(customer.firstName || '').replace(/\./g, ' ').trim();
    if (!firstName) {
        return '';
    }

    const initials = firstName
        .split(/[\s-]+/)
        .filter(Boolean)
        .map((part) => part[0].toUpperCase())
        .join('.');

    return initials ? `${initials}.` : '';
}

function splitLastNameComponents(customer) {
    let lastName = String(customer.lastName || '').trim();
    let insertion = String(customer.middleName || '').trim();

    if (!insertion && lastName.includes(' ')) {
        const normalizedLastName = lastName.toLowerCase();
        const matchedPrefix = NAME_INSERTION_PREFIXES.find((prefix) => normalizedLastName.startsWith(`${prefix} `));

        if (matchedPrefix) {
            insertion = lastName.substring(0, matchedPrefix.length);
            const lastNameRemainder = lastName.substring(matchedPrefix.length).trim();
            if (lastNameRemainder) {
                lastName = lastNameRemainder;
            } else {
                insertion = String(customer.middleName || '').trim();
            }
        }
    }

    return {
        lastName,
        insertion
    };
}

function formatLastNameSection(customer) {
    const { lastName, insertion } = splitLastNameComponents(customer);

    if (!lastName && !insertion) {
        return '';
    }

    if (!lastName) {
        return insertion;
    }

    return insertion
        ? `<span class="last-name">${lastName}</span>, ${insertion}`
        : `<span class="last-name">${lastName}</span>`;
}

function getCustomerSubscriptions(customer) {
    return Array.isArray(customer.subscriptions) ? customer.subscriptions : [];
}

function buildSubscriptionBadges(customer) {
    const subscriptions = getCustomerSubscriptions(customer);
    const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active');
    const inactiveSubscriptions = subscriptions.filter((subscription) => subscription.status !== 'active');

    if (activeSubscriptions.length > 0) {
        return activeSubscriptions
            .map((subscription) => `<span class="subscription-badge active">${subscription.magazine}</span>`)
            .join('');
    }

    if (inactiveSubscriptions.length > 0) {
        return `<span class="subscription-badge inactive">${inactiveSubscriptions[0].magazine} (beëindigd)</span>`;
    }

    return '<span style="color: var(--text-secondary); font-size: 0.875rem;">Geen actief</span>';
}

function buildSubscriberNumber(customer) {
    const subscriptions = getCustomerSubscriptions(customer);
    const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === 'active');
    const primarySubscription = activeSubscriptions.length > 0
        ? activeSubscriptions[0]
        : subscriptions[0];

    if (!primarySubscription) {
        return '-';
    }

    return generateSubscriptionNumber(customer.id, primarySubscription.id);
}

function shouldShowIdentifyButton() {
    const callSession = readLegacyCallSession();
    return Boolean(callSession && callSession.active && callSession.callerType === 'anonymous');
}

function renderCustomerRow(customer) {
    const lastNameSection = formatLastNameSection(customer) || '-';
    const initials = getCustomerInitials(customer) || '-';
    const subscriptionBadges = buildSubscriptionBadges(customer);
    const subscriberNumber = buildSubscriberNumber(customer);
    const showIdentifyButton = shouldShowIdentifyButton();
    const viewActionLabel = translateKey('search.viewAction', {}, 'Bekijken');

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
                ${showIdentifyButton ? `
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

function getPageNumbers(currentPage, totalPages) {
    const pages = [];
    const maxVisiblePages = 7;

    if (totalPages <= maxVisiblePages) {
        for (let pageIndex = 1; pageIndex <= totalPages; pageIndex += 1) {
            pages.push(pageIndex);
        }
        return pages;
    }

    pages.push(1);

    let rangeStart = Math.max(2, currentPage - 1);
    let rangeEnd = Math.min(totalPages - 1, currentPage + 1);

    if (currentPage <= 3) {
        rangeEnd = Math.min(5, totalPages - 1);
    }
    if (currentPage >= totalPages - 2) {
        rangeStart = Math.max(2, totalPages - 4);
    }

    if (rangeStart > 2) {
        pages.push('...');
    }

    for (let pageIndex = rangeStart; pageIndex <= rangeEnd; pageIndex += 1) {
        pages.push(pageIndex);
    }

    if (rangeEnd < totalPages - 1) {
        pages.push('...');
    }

    pages.push(totalPages);
    return pages;
}

function renderPagination() {
    if (typeof document === 'undefined') {
        return;
    }

    const pagination = document.getElementById('pagination');
    if (!pagination) {
        return;
    }

    const totalPages = Math.ceil(searchState.results.length / searchState.itemsPerPage);
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }

    const { currentPage } = searchState;
    let html = '';

    html += `<button class="page-btn" type="button" data-action="go-to-page" data-arg-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>
        ← Vorige
    </button>`;

    const pageNumbers = getPageNumbers(currentPage, totalPages);
    pageNumbers.forEach((pageNumber) => {
        if (pageNumber === '...') {
            html += '<span class="page-ellipsis">...</span>';
            return;
        }

        const activeClass = pageNumber === currentPage ? 'active' : '';
        html += `<button class="page-btn ${activeClass}" type="button" data-action="go-to-page" data-arg-page="${pageNumber}">${pageNumber}</button>`;
    });

    html += `<button class="page-btn" type="button" data-action="go-to-page" data-arg-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>
        Volgende →
    </button>`;

    pagination.innerHTML = html;
}

export function displayPaginatedResults() {
    if (typeof document === 'undefined') {
        return;
    }

    const searchSummary = document.getElementById('searchSummary');
    const resultCount = document.getElementById('resultCount');
    const searchResultsView = document.getElementById('searchResultsView');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const customerDetail = document.getElementById('customerDetail');
    const resultsTitle = document.getElementById('resultsTitle');
    const resultsRange = document.getElementById('resultsRange');
    const paginatedResults = document.getElementById('paginatedResults');

    if (
        !searchSummary
        || !resultCount
        || !searchResultsView
        || !welcomeMessage
        || !customerDetail
        || !resultsTitle
        || !resultsRange
        || !paginatedResults
    ) {
        return;
    }

    const { results, currentPage, itemsPerPage } = searchState;

    resultCount.textContent = String(results.length);
    setElementDisplay(searchSummary, results.length > 0 ? 'block' : 'none');

    if (results.length === 0) {
        setElementDisplay(searchResultsView, 'none');
        setElementDisplay(customerDetail, 'none');
        setElementDisplay(welcomeMessage, 'flex');
        welcomeMessage.innerHTML = getSearchEmptyStateMarkup();
        return;
    }

    const pageStartIndex = (currentPage - 1) * itemsPerPage;
    const pageEndIndex = pageStartIndex + itemsPerPage;
    const pageResults = results.slice(pageStartIndex, pageEndIndex);

    const searchQueryLabel = buildSearchQueryLabel();
    resultsTitle.textContent = translateKey(
        'search.resultsTitle',
        { query: searchQueryLabel },
        `🔍 Zoekresultaten: "${searchQueryLabel}"`
    );
    resultsRange.textContent = translateKey(
        'search.resultsRange',
        {
            start: pageStartIndex + 1,
            end: Math.min(pageEndIndex, results.length),
            total: results.length
        },
        `Toont ${pageStartIndex + 1}-${Math.min(pageEndIndex, results.length)} van ${results.length}`
    );

    paginatedResults.innerHTML = pageResults.map((customer) => renderCustomerRow(customer)).join('');

    setElementDisplay(welcomeMessage, 'none');
    setElementDisplay(customerDetail, 'none');
    setElementDisplay(searchResultsView, 'block');

    renderPagination();

    if (typeof searchResultsView.scrollIntoView === 'function') {
        searchResultsView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

export function goToPage(page) {
    const targetPage = Number(page);
    if (!Number.isFinite(targetPage)) {
        return;
    }

    const totalPages = Math.ceil(searchState.results.length / searchState.itemsPerPage);
    if (targetPage < 1 || targetPage > totalPages) {
        return;
    }

    searchState.currentPage = targetPage;
    displayPaginatedResults();
}

export function scrollToResults() {
    if (typeof document === 'undefined') {
        return;
    }

    const customerDetail = document.getElementById('customerDetail');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const searchResultsView = document.getElementById('searchResultsView');

    if (!customerDetail || !welcomeMessage || !searchResultsView) {
        return;
    }

    setElementDisplay(customerDetail, 'none');
    setElementDisplay(welcomeMessage, 'none');
    setElementDisplay(searchResultsView, 'block');

    if (typeof searchResultsView.scrollIntoView === 'function') {
        searchResultsView.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function clearSearchInputValue(inputId) {
    if (typeof document === 'undefined') {
        return;
    }

    const input = document.getElementById(inputId);
    if (!input || typeof input.value !== 'string') {
        return;
    }

    input.value = '';
}

function resetSearchState() {
    searchState.results = [];
    searchState.currentPage = 1;
    searchState.sortBy = 'name';
}

export function clearSearchResults() {
    if (typeof document === 'undefined') {
        return;
    }

    resetSearchState();

    const searchResultsView = document.getElementById('searchResultsView');
    const searchSummary = document.getElementById('searchSummary');
    const customerDetail = document.getElementById('customerDetail');
    const welcomeMessage = document.getElementById('welcomeMessage');

    if (!searchResultsView || !searchSummary || !customerDetail || !welcomeMessage) {
        return;
    }

    setElementDisplay(searchResultsView, 'none');
    setElementDisplay(searchSummary, 'none');

    clearSearchInputValue('searchName');
    clearSearchInputValue('searchPostalCode');
    clearSearchInputValue('searchHouseNumber');
    clearSearchInputValue('searchPhone');
    clearSearchInputValue('searchEmail');

    setAdditionalFiltersOpen(false);

    welcomeMessage.innerHTML = getWelcomeMessageMarkup();

    const currentCustomer = readLegacyCurrentCustomer();
    if (currentCustomer) {
        setElementDisplay(customerDetail, 'block');
        setElementDisplay(welcomeMessage, 'none');
    } else {
        setElementDisplay(customerDetail, 'none');
        setElementDisplay(welcomeMessage, 'flex');
    }

    const globalScope = getGlobalScope();
    if (globalScope && typeof globalScope.scrollTo === 'function') {
        globalScope.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

export function closeCustomerDetail() {
    if (typeof document === 'undefined') {
        return;
    }

    writeLegacyCurrentCustomer(null);

    const customerDetail = document.getElementById('customerDetail');
    const searchResultsView = document.getElementById('searchResultsView');
    const searchSummary = document.getElementById('searchSummary');
    const welcomeMessage = document.getElementById('welcomeMessage');

    if (!customerDetail || !searchResultsView || !searchSummary || !welcomeMessage) {
        return;
    }

    setElementDisplay(customerDetail, 'none');
    setElementDisplay(searchResultsView, 'none');
    setElementDisplay(searchSummary, 'none');

    welcomeMessage.innerHTML = getWelcomeMessageMarkup();
    setElementDisplay(welcomeMessage, 'flex');

    const globalScope = getGlobalScope();
    if (globalScope && typeof globalScope.scrollTo === 'function') {
        globalScope.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function sortResultsList(results, sortBy) {
    results.sort((customerA, customerB) => {
        if (sortBy === 'name') {
            const customerALastName = String(customerA.lastName || '');
            const customerBLastName = String(customerB.lastName || '');
            const lastNameComparison = customerALastName.localeCompare(customerBLastName);
            if (lastNameComparison !== 0) {
                return lastNameComparison;
            }

            const customerAFirstName = String(customerA.firstName || '');
            const customerBFirstName = String(customerB.firstName || '');
            return customerAFirstName.localeCompare(customerBFirstName);
        }

        if (sortBy === 'postal') {
            return String(customerA.postalCode || '').localeCompare(String(customerB.postalCode || ''));
        }

        if (sortBy === 'subscriptions') {
            const customerAActiveCount = getCustomerSubscriptions(customerA)
                .filter((subscription) => subscription.status === 'active')
                .length;
            const customerBActiveCount = getCustomerSubscriptions(customerB)
                .filter((subscription) => subscription.status === 'active')
                .length;

            return customerBActiveCount - customerAActiveCount;
        }

        return 0;
    });
}

function sortResultsData() {
    sortResultsList(searchState.results, searchState.sortBy);
}

export function sortResults(sortBy) {
    if (!sortBy) {
        return;
    }

    searchState.sortBy = sortBy;
    searchState.currentPage = 1;
    sortResultsData();
    displayPaginatedResults();
}

export function displaySearchResults(results) {
    setSearchResults(results);
    displayPaginatedResults();
}

function installLegacyCompatibilityExports() {
    if (compatibilityExportsInstalled) {
        return;
    }

    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope.setAdditionalFiltersOpen = setAdditionalFiltersOpen;
    globalScope.toggleAdditionalFilters = toggleAdditionalFilters;
    globalScope.searchCustomer = searchCustomer;
    globalScope.handleSearchKeyPress = handleSearchKeyPress;
    globalScope.displayPaginatedResults = displayPaginatedResults;
    globalScope.goToPage = goToPage;
    globalScope.scrollToResults = scrollToResults;
    globalScope.clearSearchResults = clearSearchResults;
    globalScope.closeCustomerDetail = closeCustomerDetail;
    globalScope.sortResults = sortResults;
    globalScope.displaySearchResults = displaySearchResults;

    compatibilityExportsInstalled = true;
}

export function registerCustomerSearchSlice(actionRouter) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    installLegacyCompatibilityExports();

    actionRouter.registerMany({
        'search-handle-keypress': (_payload, context) => {
            handleSearchKeyPress(context.event);
        },
        'toggle-additional-filters': () => {
            toggleAdditionalFilters();
        },
        'search-customer': () => {
            void searchCustomer();
        },
        'sort-results': (_payload, context) => {
            const sortBy = context.element && typeof context.element.value === 'string'
                ? context.element.value
                : null;
            if (!sortBy) {
                return;
            }
            sortResults(sortBy);
        },
        'go-to-page': (payload) => {
            goToPage(payload.page);
        },
        'scroll-to-results': () => {
            scrollToResults();
        },
        'clear-search-results': () => {
            clearSearchResults();
        },
        'close-customer-detail': () => {
            closeCustomerDetail();
        }
    });
}

export const __customerSearchTestUtils = {
    getPageNumbers,
    normalizePhone,
    resetSearchStateForTests() {
        resetSearchState();
    },
    sortResultsList,
    getSearchStateSnapshot() {
        return {
            ...searchState,
            results: searchState.results.slice()
        };
    }
};
