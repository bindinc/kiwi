import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import en from '../../../../assets/js/i18n/en.js';
import nl from '../../../../assets/js/i18n/nl.js';
import { createActionRouter } from '../../../../assets/js/app/actions.js';
import i18n from '../../../../assets/js/i18n/index.js';
import { setAppLocale } from '../../../../assets/js/app/slices/localization-slice.js';
import { displaySearchResults, displayPaginatedResults, refreshSearchResultLabels, goToPage, searchCustomer, registerCustomerSearchSlice, __customerSearchTestUtils } from '../../../../assets/js/app/slices/customer-search-slice.js';

function createSearchMetadataFixture() {
    const ids = ['searchSummary', 'resultCount', 'resultCountLabel', 'searchResultsView', 'welcomeMessage',
        'customerDetail', 'resultsTitle', 'resultsRange', 'paginatedResults', 'pagination', 'searchPostalCode',
        'searchHouseNumber', 'searchName', 'searchCustomerNumber', 'searchEmail', 'searchIban', 'searchBirthDate', 'searchPhone'];
    const writes = [];
    const scrolls = [];
    const nodes = Object.fromEntries(ids.map(id => [id, {
        id, textContent: '', value: '', style: {}, attributes: {}, markup: '',
        set innerHTML(value) { this.markup = value; writes.push(id); },
        get innerHTML() { return this.markup; },
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name] ?? null; },
        scrollIntoView() { scrolls.push(id); }
    }]));
    // Read the real annotations so a static translation cannot silently replace populated metadata.
    const template = readFileSync(new URL('../../../../templates/base/index.html.twig', import.meta.url), 'utf8');
    for (const id of ['resultsTitle', 'resultsRange']) {
        const tag = template.match(new RegExp(`<[^>]+id="${id}"[^>]*>`))[0];
        for (const match of tag.matchAll(/([\w-]+)="([^"]*)"/g)) nodes[id].setAttribute(match[1], match[2]);
    }
    const mandants = [{ value: 'HMC', checked: true }];
    const activeElement = { name: 'retained form input' };
    const document = {
        documentElement: { lang: 'nl' }, activeElement,
        getElementById: id => nodes[id] || null,
        querySelectorAll(selector) {
            if (selector === '[data-i18n]') return Object.values(nodes).filter(node => node.getAttribute('data-i18n'));
            if (selector === 'input[name="searchMandants"]:checked') return mandants.filter(input => input.checked);
            return [];
        }
    };
    return { document, nodes, mandants, writes, scrolls, activeElement };
}

function syntheticSearchCustomers(count, prefix = 'synthetic') {
    return Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, firstName: 'Synthetic',
        lastName: `Customer ${index}`, postalCode: '1231AA', address: 'Synthetic street 1', city: 'Synthetic city', subscriptions: [] }));
}

async function withSearchMetadataFixture(run) {
    const names = ['document', 'i18n', 'refreshSearchResultLabels', 'kiwiApi', 'kiwiLegacyCustomerSearchBridge'];
    const previous = Object.fromEntries(names.map(name => [name, globalThis[name]]));
    const previousLocale = i18n.getLocale();
    const fixture = createSearchMetadataFixture();
    Object.assign(globalThis, { document: fixture.document, i18n, refreshSearchResultLabels });
    try { await run(fixture); }
    finally {
        __customerSearchTestUtils.resetSearchStateForTests();
        i18n.setLocale(previousLocale);
        for (const name of names) {
            if (previous[name] === undefined) delete globalThis[name];
            else globalThis[name] = previous[name];
        }
    }
}

async function testNativeLocaleRefreshKeepsRealSearchMetadataAndRetainedWorkspace() {
    await withSearchMetadataFixture(async ({ document, nodes, mandants, writes, scrolls, activeElement }) => {
        let requests = 0;
        globalThis.kiwiApi = { get() { requests++; }, post() { requests++; }, request() { requests++; } };
        for (const count of [0, 1, 3, 25]) {
            nodes.searchPostalCode.value = '1231AA'; nodes.searchHouseNumber.value = '1'; nodes.searchName.value = 'MixedCase';
            mandants[0].checked = true;
            const customers = syntheticSearchCustomers(count);
            const selectedCustomer = customers.at(-1) || { id: 'selected-outside-results' };
            globalThis.kiwiLegacyCustomerSearchBridge = { getCurrentCustomer: () => selectedCustomer };
            setAppLocale('nl');
            displaySearchResults(customers);
            if (count > 20) goToPage(2);
            const expectedStart = count ? (count > 20 ? 21 : 1) : 0;
            const expectedEnd = count > 20 ? 25 : count;
            assert.equal(nodes.resultsRange.textContent, `Toont ${expectedStart}-${expectedEnd} van ${count}`);
            const rowMarkup = nodes.paginatedResults.innerHTML;
            if (count > 20) assert.ok(rowMarkup.includes('aria-current="true"'));
            nodes.searchName.value = 'Unsent draft'; nodes.searchPostalCode.value = '9999ZZ'; mandants[0].checked = false;
            nodes.customerDetail.style.display = 'block'; nodes.searchResultsView.style.display = 'none';
            const stateBefore = __customerSearchTestUtils.getSearchStateSnapshot();
            const writesBefore = writes.length;
            const scrollsBefore = scrolls.length;
            for (const locale of ['en', 'nl']) {
                setAppLocale(locale);
                const query = locale === 'en' ? '1231AA 1 • Name: MixedCase • Mandant: TROS' : '1231AA 1 • Naam: MixedCase • Mandant: TROS';
                assert.equal(nodes.resultsTitle.textContent, `${locale === 'en' ? 'Search results' : 'Zoekresultaten'}: "${query}"`);
                assert.equal(nodes.resultsRange.textContent, locale === 'en'
                    ? `Showing ${expectedStart}-${expectedEnd} of ${count}` : `Toont ${expectedStart}-${expectedEnd} van ${count}`);
                assert.equal(nodes.resultCount.textContent, String(count));
                assert.equal(nodes.resultCountLabel.textContent, locale === 'en' ? (count === 1 ? 'customer found' : 'customers found') : (count === 1 ? 'klant gevonden' : 'klanten gevonden'));
                assert.equal(nodes.paginatedResults.innerHTML, rowMarkup);
                assert.equal(writes.length, writesBefore, 'locale changes do not rebuild rows, pagination, welcome or retained detail');
                assert.equal(scrolls.length, scrollsBefore);
                assert.equal(document.activeElement, activeElement);
                assert.equal(nodes.customerDetail.style.display, 'block');
                assert.equal(nodes.searchResultsView.style.display, 'none');
                assert.equal(globalThis.kiwiLegacyCustomerSearchBridge.getCurrentCustomer(), selectedCustomer);
                assert.deepEqual(__customerSearchTestUtils.getSearchStateSnapshot(), stateBefore);
                assert.equal(nodes.searchName.value, 'Unsent draft');
                assert.equal(nodes.searchPostalCode.value, '9999ZZ');
                assert.equal(mandants[0].checked, false);
                assert.equal(nodes.resultsTitle.getAttribute('data-i18n-params'), null);
            }
        }
        assert.equal(requests, 0, 'locale changes cannot search or load subscription summaries');
    });
}

async function testAcceptedQuerySnapshotSurvivesPendingAndOutOfOrderSearches() {
    await withSearchMetadataFixture(async ({ nodes }) => {
        const pending = [];
        let posts = 0;
        globalThis.kiwiApi = {
            get(url) { return new Promise(resolve => pending.push({ url, resolve })); },
            post() { posts++; }
        };
        nodes.searchName.value = 'Accepted MixedCase';
        displaySearchResults(syntheticSearchCustomers(1, 'accepted'));
        nodes.searchName.value = 'Older MixedCase';
        const olderSearch = searchCustomer();
        nodes.searchName.value = 'Latest MixedCase';
        const latestSearch = searchCustomer();
        nodes.searchName.value = 'Unsent draft';
        setAppLocale('en');
        assert.ok(nodes.resultsTitle.textContent.includes('Name: Accepted MixedCase'), 'pending requests do not replace accepted query metadata');
        pending[1].resolve({ items: syntheticSearchCustomers(3, 'latest') });
        await latestSearch;
        assert.ok(nodes.resultsTitle.textContent.includes('Name: Latest MixedCase'));
        assert.equal(nodes.resultsRange.textContent, 'Showing 1-3 of 3');
        const accepted = __customerSearchTestUtils.getSearchStateSnapshot();
        pending[0].resolve({ items: syntheticSearchCustomers(2, 'older') });
        await olderSearch;
        assert.deepEqual(__customerSearchTestUtils.getSearchStateSnapshot(), accepted);
        assert.ok(nodes.resultsTitle.textContent.includes('Name: Latest MixedCase'));
        setAppLocale('nl');
        assert.ok(nodes.resultsTitle.textContent.includes('Naam: Latest MixedCase'));
        assert.equal(nodes.resultsRange.textContent, 'Toont 1-3 van 3');
        assert.equal(nodes.searchName.value, 'Unsent draft');
        assert.equal(new URL(pending[1].url, 'https://synthetic.invalid').searchParams.get('name'), 'latest mixedcase', 'business query normalization remains unchanged');
        assert.equal(pending.length, 2);
        assert.equal(posts, 0);
    });
}

function testSearchSummaryCountsAndLiveLocaleChange() {
    const previousDocument = globalThis.document;
    const previousI18n = globalThis.i18n;
    const previousLocale = i18n.getLocale();
    const ids = ['searchSummary', 'resultCount', 'resultCountLabel', 'searchResultsView', 'welcomeMessage',
        'customerDetail', 'resultsTitle', 'resultsRange', 'paginatedResults'];
    const nodes = Object.fromEntries(ids.map(id => [id, {
        textContent: '', style: {}, attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name]; }
    }]));
    globalThis.document = {
        documentElement: { lang: 'nl' },
        getElementById: id => nodes[id] || null,
        querySelectorAll: selector => selector === '[data-i18n]' ? [nodes.resultCountLabel] : []
    };
    globalThis.i18n = i18n;
    try {
        for (const count of [0, 1, 3]) {
            const customers = Array.from({ length: count }, (_, index) => ({
                id: `synthetic-${index}`, firstName: 'Synthetic', lastName: 'Customer', subscriptions: []
            }));
            __customerSearchTestUtils.setSearchResultsForTests(customers);
            setAppLocale('nl');
            displayPaginatedResults();
            const generation = __customerSearchTestUtils.getSearchStateSnapshot().generation;
            assert.equal(nodes.resultCount.textContent, String(count), 'the count node stays numeric-only');
            assert.equal(nodes.resultCountLabel.textContent, count === 1 ? 'klant gevonden' : 'klanten gevonden');
            assert.equal(nodes.searchSummary.style.display, count > 0 ? 'block' : 'none', 'zero-result visibility is unchanged');
            setAppLocale('en');
            assert.equal(nodes.resultCountLabel.textContent, count === 1 ? 'customer found' : 'customers found');
            assert.equal(nodes.resultCount.textContent, String(count));
            assert.equal(__customerSearchTestUtils.getSearchStateSnapshot().generation, generation, 'changing language does not rerun or replace the search');
            setAppLocale('nl');
            assert.equal(nodes.resultCountLabel.textContent, count === 1 ? 'klant gevonden' : 'klanten gevonden');
        }
    } finally {
        __customerSearchTestUtils.resetSearchStateForTests();
        i18n.setLocale(previousLocale);
        globalThis.document = previousDocument;
        globalThis.i18n = previousI18n;
    }
}

function createRouter() {
    const root = {
        addEventListener() {},
        removeEventListener() {}
    };

    return createActionRouter({
        root,
        eventTypes: ['click', 'keydown', 'change']
    });
}

function testRegistersItemFiveActions() {
    const router = createRouter();
    registerCustomerSearchSlice(router);

    const actionNames = router.getRegisteredActions();
    const expectedActionNames = [
        'search-handle-keypress',
        'toggle-additional-filters',
        'search-customer',
        'sort-results',
        'go-to-page',
        'scroll-to-results',
        'clear-search-results',
        'close-customer-detail'
    ];

    for (const actionName of expectedActionNames) {
        assert.equal(actionNames.includes(actionName), true, `missing action ${actionName}`);
    }
}

function testInstallsLegacyCompatibilityExports() {
    const previousValues = {
        searchCustomer: globalThis.searchCustomer,
        setAdditionalFiltersOpen: globalThis.setAdditionalFiltersOpen,
        closeCustomerDetail: globalThis.closeCustomerDetail
    };

    try {
        const router = createRouter();
        registerCustomerSearchSlice(router);

        assert.equal(typeof globalThis.searchCustomer, 'function');
        assert.equal(typeof globalThis.setAdditionalFiltersOpen, 'function');
        assert.equal(typeof globalThis.closeCustomerDetail, 'function');
    } finally {
        if (previousValues.searchCustomer === undefined) {
            delete globalThis.searchCustomer;
        } else {
            globalThis.searchCustomer = previousValues.searchCustomer;
        }

        if (previousValues.setAdditionalFiltersOpen === undefined) {
            delete globalThis.setAdditionalFiltersOpen;
        } else {
            globalThis.setAdditionalFiltersOpen = previousValues.setAdditionalFiltersOpen;
        }

        if (previousValues.closeCustomerDetail === undefined) {
            delete globalThis.closeCustomerDetail;
        } else {
            globalThis.closeCustomerDetail = previousValues.closeCustomerDetail;
        }
    }
}

function testPageNumbersAndNormalizationHelpers() {
    assert.equal(__customerSearchTestUtils.normalizePhone('+31 (0)6-1234-5678'), '310612345678');

    assert.deepEqual(__customerSearchTestUtils.getPageNumbers(1, 4), [1, 2, 3, 4]);
    assert.deepEqual(
        __customerSearchTestUtils.getPageNumbers(8, 12),
        [1, '...', 7, 8, 9, '...', 12]
    );
}

function testSortResultsList() {
    const customers = [
        {
            firstName: 'Zoe',
            lastName: 'Bakker',
            postalCode: '3000AA',
            subscriptions: [{ status: 'active' }, { status: 'ended' }]
        },
        {
            firstName: 'Anna',
            lastName: 'Bakker',
            postalCode: '1000AA',
            subscriptions: []
        },
        {
            firstName: 'Ben',
            lastName: 'Albers',
            postalCode: '2000AA',
            subscriptions: [{ status: 'active' }, { status: 'active' }, { status: 'ended' }]
        }
    ];

    const byName = customers.map((customer) => ({ ...customer, subscriptions: customer.subscriptions.slice() }));
    __customerSearchTestUtils.sortResultsList(byName, 'name');
    assert.deepEqual(
        byName.map((customer) => `${customer.lastName}:${customer.firstName}`),
        ['Albers:Ben', 'Bakker:Anna', 'Bakker:Zoe']
    );

    const byPostal = customers.map((customer) => ({ ...customer, subscriptions: customer.subscriptions.slice() }));
    __customerSearchTestUtils.sortResultsList(byPostal, 'postal');
    assert.deepEqual(
        byPostal.map((customer) => customer.postalCode),
        ['1000AA', '2000AA', '3000AA']
    );

    const bySubscriptions = customers.map((customer) => ({ ...customer, subscriptions: customer.subscriptions.slice() }));
    __customerSearchTestUtils.sortResultsList(bySubscriptions, 'subscriptions');
    assert.deepEqual(
        bySubscriptions.map((customer) => customer.firstName),
        ['Ben', 'Zoe', 'Anna']
    );
}

function testRenderCustomerRowShowsMandantBadgeForRecognizedMandant() {
    const previousBasePath = globalThis.kiwiBasePath;
    const previousAssetPaths = globalThis.kiwiAssetPaths;

    globalThis.kiwiBasePath = '/kiwi';
    globalThis.kiwiAssetPaths = {
        avrotrosLogo: '/assets/img/avrotros-logo.svg',
        kroncrvLogo: '/assets/img/kroncrv-logo.svg'
    };

    try {
        const markup = __customerSearchTestUtils.renderCustomerRow({
            id: 41,
            personId: '12345',
            firstName: 'Demo',
            middleName: '',
            lastName: 'Gebruiker',
            address: 'Teststraat 1',
            postalCode: '1217AA',
            city: 'Hilversum',
            subscriptions: [],
            divisionId: '14',
            mandant: 'HMC'
        });

        assert.equal(markup.includes('avrotros-logo.svg'), true);
        assert.equal(markup.includes('alt="AVROTROS"'), true);
        assert.equal(markup.includes('12345'), true);
    } finally {
        if (previousBasePath === undefined) {
            delete globalThis.kiwiBasePath;
        } else {
            globalThis.kiwiBasePath = previousBasePath;
        }

        if (previousAssetPaths === undefined) {
            delete globalThis.kiwiAssetPaths;
        } else {
            globalThis.kiwiAssetPaths = previousAssetPaths;
        }
    }
}

function testSubscriptionApiBadgesDistinguishLoadingUnavailableAndLoadedStates() {
    const loadingMarkup = __customerSearchTestUtils.buildSubscriptionBadges({
        sourceSystem: 'subscription-api'
    });
    assert.equal(loadingMarkup.includes('Abonnementstatus laden'), true);
    assert.equal(loadingMarkup.includes('Geen actief'), false);

    const unavailableMarkup = __customerSearchTestUtils.buildSubscriptionBadges({
        sourceSystem: 'subscription-api',
        subscriptionSummary: { state: 'unavailable' }
    });
    assert.equal(unavailableMarkup.includes('Status niet beschikbaar'), true);
    assert.equal(unavailableMarkup.includes('Geen actief'), false);

    const loadedMarkup = __customerSearchTestUtils.buildSubscriptionBadges({
        sourceSystem: 'subscription-api',
        subscriptionSummary: {
            state: 'loaded',
            activeCount: 1,
            activeSubscriptions: [{ magazine: 'Mikrogids' }],
            inactiveSubscription: { magazine: 'NCRV-gids' }
        }
    });
    assert.equal(loadedMarkup.includes('Mikrogids'), true);
    assert.equal(loadedMarkup.includes('NCRV-gids'), false);

    const confirmedEmptyMarkup = __customerSearchTestUtils.buildSubscriptionBadges({
        sourceSystem: 'subscription-api',
        subscriptionSummary: {
            state: 'loaded',
            activeCount: 0,
            activeSubscriptions: [],
            inactiveSubscription: null
        }
    });
    assert.equal(confirmedEmptyMarkup.includes('Geen actief'), true);
}

function testSubscriptionStatusTranslationsStayAligned() {
    const translationKeys = [
        'subscriptionStatusLoading',
        'subscriptionStatusUnavailable',
        'subscriptionNoneActive',
        'subscriptionEnded'
    ];

    for (const translationKey of translationKeys) {
        assert.equal(typeof nl.search[translationKey], 'string');
        assert.equal(typeof en.search[translationKey], 'string');
    }

    assert.equal(en.search.subscriptionStatusLoading, 'Loading subscription status…');
    assert.equal(nl.search.subscriptionStatusLoading, 'Abonnementstatus laden…');
}

function testAppliesSummariesByPersonAndCredentialContext() {
    const customers = [
        { personId: '100', credentialKey: 'tvk', sourceSystem: 'subscription-api' },
        { personId: '100', credentialKey: 'kroncrv', sourceSystem: 'subscription-api' }
    ];

    assert.equal(__customerSearchTestUtils.getCustomersMissingSubscriptionSummary(customers).length, 2);

    __customerSearchTestUtils.applySubscriptionSummaries(customers, [{
        personId: '100',
        credentialKey: 'tvk',
        state: 'loaded',
        activeCount: 1,
        activeSubscriptions: [{ magazine: 'Mikrogids' }],
        inactiveSubscription: null
    }]);

    assert.equal(customers[0].subscriptionSummary.state, 'loaded');
    assert.equal(customers[1].subscriptionSummary, undefined);
    assert.equal(__customerSearchTestUtils.getCustomersMissingSubscriptionSummary(customers).length, 1);
}

function testSubscriptionSortUsesLoadedCountsAndPlacesUnavailableLast() {
    const customers = [
        {
            firstName: 'Zoe',
            lastName: 'Bakker',
            personId: '1',
            credentialKey: 'tvk',
            sourceSystem: 'subscription-api',
            subscriptionSummary: { state: 'loaded', activeCount: 1 }
        },
        {
            firstName: 'Anna',
            lastName: 'Albers',
            personId: '2',
            credentialKey: 'tvk',
            sourceSystem: 'subscription-api',
            subscriptionSummary: { state: 'unavailable', activeCount: null }
        },
        {
            firstName: 'Ben',
            lastName: 'Bakker',
            personId: '3',
            credentialKey: 'tvk',
            sourceSystem: 'subscription-api',
            subscriptionSummary: { state: 'loaded', activeCount: 2 }
        }
    ];

    __customerSearchTestUtils.sortResultsList(customers, 'subscriptions');

    assert.deepEqual(customers.map((customer) => customer.firstName), ['Ben', 'Zoe', 'Anna']);
}

async function testLoadsVisiblePageThenRemainingResultsForSubscriptionSort() {
    const previousKiwiApi = globalThis.kiwiApi;
    const requests = [];
    const customers = Array.from({ length: 25 }, (_value, index) => ({
        id: index + 1,
        personId: String(index + 1),
        credentialKey: 'tvk',
        sourceSystem: 'subscription-api',
        firstName: `Klant ${index + 1}`,
        lastName: 'Test'
    }));

    globalThis.kiwiApi = {
        async post(url, payload) {
            requests.push({ url, payload });
            return {
                items: payload.persons.map((person) => ({
                    ...person,
                    state: 'loaded',
                    activeCount: Number(person.personId) % 3,
                    activeSubscriptions: [],
                    inactiveSubscription: null
                }))
            };
        }
    };

    try {
        __customerSearchTestUtils.setSearchResultsForTests(customers);
        const generation = __customerSearchTestUtils.getSearchStateSnapshot().generation;

        await __customerSearchTestUtils.loadVisibleSubscriptionSummaries(generation);

        assert.equal(requests.length, 1);
        assert.equal(requests[0].url, '/api/v1/persons/subscription-summaries');
        assert.equal(requests[0].payload.persons.length, 20);
        assert.equal(customers.slice(0, 20).every((customer) => customer.subscriptionSummary?.state === 'loaded'), true);
        assert.equal(customers.slice(20).every((customer) => customer.subscriptionSummary === undefined), true);

        await __customerSearchTestUtils.loadAllSubscriptionSummaries(generation);

        assert.equal(requests.length, 2);
        assert.equal(requests[1].payload.persons.length, 5);
        assert.equal(customers.every((customer) => customer.subscriptionSummary?.state === 'loaded'), true);
    } finally {
        __customerSearchTestUtils.resetSearchStateForTests();
        if (previousKiwiApi === undefined) {
            delete globalThis.kiwiApi;
        } else {
            globalThis.kiwiApi = previousKiwiApi;
        }
    }
}

async function testIgnoresSubscriptionSummariesFromAnOlderSearch() {
    const previousKiwiApi = globalThis.kiwiApi;
    let resolveRequest;
    const oldCustomers = [{
        id: 1,
        personId: '1',
        credentialKey: 'tvk',
        sourceSystem: 'subscription-api'
    }];
    const newCustomers = [{
        id: 2,
        personId: '2',
        credentialKey: 'tvk',
        sourceSystem: 'subscription-api'
    }];

    globalThis.kiwiApi = {
        post() {
            return new Promise((resolve) => {
                resolveRequest = resolve;
            });
        }
    };

    try {
        __customerSearchTestUtils.setSearchResultsForTests(oldCustomers);
        const oldGeneration = __customerSearchTestUtils.getSearchStateSnapshot().generation;
        const pendingLoad = __customerSearchTestUtils.loadVisibleSubscriptionSummaries(oldGeneration);
        await Promise.resolve();

        __customerSearchTestUtils.setSearchResultsForTests(newCustomers);
        resolveRequest({
            items: [{
                personId: '1',
                credentialKey: 'tvk',
                state: 'loaded',
                activeCount: 1,
                activeSubscriptions: [{ magazine: 'Mikrogids' }],
                inactiveSubscription: null
            }]
        });
        await pendingLoad;

        assert.equal(oldCustomers[0].subscriptionSummary.state, 'loading');
        assert.equal(newCustomers[0].subscriptionSummary, undefined);
    } finally {
        __customerSearchTestUtils.resetSearchStateForTests();
        if (previousKiwiApi === undefined) {
            delete globalThis.kiwiApi;
        } else {
            globalThis.kiwiApi = previousKiwiApi;
        }
    }
}

function testBuildSearchParamsIncludesEmailFilter() {
    const params = __customerSearchTestUtils.buildSearchParams({
        postalCode: '',
        houseNumber: '',
        name: '',
        customerNumber: '11860448',
        email: 'klant@example.org',
        iban: 'NL00BANK0123456789',
        birthDate: '1980-07-22',
        phone: '',
        mandants: ['KRONCRV', 'HMC']
    });

    assert.equal(params.get('customerNumber'), '11860448');
    assert.equal(params.get('email'), 'klant@example.org');
    assert.equal(params.get('iban'), 'NL00BANK0123456789');
    assert.equal(params.get('birthDate'), '1980-07-22');
    assert.equal(params.get('mandants'), 'KRONCRV,HMC');
    assert.equal(params.get('page'), '1');
    assert.equal(params.get('pageSize'), '200');
}

function testFilterCustomersLocallyUsesMandantAndAdditionalFields() {
    const customers = [
        {
            id: 1,
            personId: '11860448',
            firstName: 'Jane',
            middleName: 'van',
            lastName: 'Dijk',
            postalCode: '1217AA',
            houseNumber: '12',
            email: 'jane@example.org',
            iban: 'NL00 BANK 0123 4567 89',
            birthday: '1980-07-22',
            phone: '0612345678',
            mandant: 'HMC'
        },
        {
            id: 2,
            personId: '200',
            firstName: 'Piet',
            middleName: '',
            lastName: 'Bakker',
            postalCode: '1217AA',
            houseNumber: '12',
            email: 'piet@example.org',
            iban: 'NL00BANK0000000000',
            birthday: '1980-07-22',
            phone: '0612345678',
            mandant: 'KRONCRV'
        }
    ];

    const results = __customerSearchTestUtils.filterCustomersLocally(customers, {
        postalCode: '1217AA',
        houseNumber: '12',
        name: 'jane',
        customerNumber: '118604',
        email: 'jane@example.org',
        iban: 'NL00BANK0123',
        birthDate: '1980-07-22',
        phone: '061234',
        mandants: ['HMC']
    });

    assert.deepEqual(results.map((customer) => customer.id), [1]);
}

function testBuildSearchQueryLabelIncludesEmailAndPhone() {
    const previousDocument = globalThis.document;

    try {
        globalThis.document = {
            querySelectorAll(selector) {
                if (selector !== 'input[name="searchMandants"]:checked') {
                    return [];
                }

                return [
                    { value: 'KRONCRV' },
                    { value: 'HMC' }
                ];
            },
            getElementById(id) {
                const values = {
                    searchPostalCode: { value: '' },
                    searchHouseNumber: { value: '' },
                    searchName: { value: 'Bakker' },
                    searchCustomerNumber: { value: '11860448' },
                    searchIban: { value: 'NL00BANK0123456789' },
                    searchBirthDate: { value: '1980-07-22' },
                    searchPhone: { value: '0612345678' },
                    searchEmail: { value: 'klant@example.org' }
                };

                return values[id] || null;
            }
        };

        const label = __customerSearchTestUtils.buildSearchQueryLabel();
        assert.equal(label.includes('Naam: Bakker'), true);
        assert.equal(label.includes('Klantnummer: 11860448'), true);
        assert.equal(label.includes('Telefoon: 0612345678'), true);
        assert.equal(label.includes('E-mail: klant@example.org'), true);
        assert.equal(label.includes('IBAN: NL00BANK0123456789'), true);
        assert.equal(label.includes('Geboortedatum: 1980-07-22'), true);
        assert.equal(label.includes('Mandant: KRO-NCRV, TROS'), true);
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
}

function testSelectedCustomerKeepsSourceIdentity() {
    const previousBridge = globalThis.kiwiLegacyCustomerSearchBridge;
    const customer = { id: 'same-person', personId: 'provider-reference', credentialKey: 'source-one', lastName: 'Sentinel', subscriptions: [] };
    let current = { ...customer };
    globalThis.kiwiLegacyCustomerSearchBridge = { getCurrentCustomer: () => current };
    try {
        assert.match(__customerSearchTestUtils.renderCustomerRow(customer), /aria-current="true"/);
        current = { ...customer, credentialKey: 'source-two' };
        assert.doesNotMatch(__customerSearchTestUtils.renderCustomerRow(customer), /aria-current="true"/);
        current = { ...customer, credentialKey: '' };
        assert.doesNotMatch(__customerSearchTestUtils.renderCustomerRow(customer), /aria-current="true"/);
        current = { ...customer };
        assert.doesNotMatch(__customerSearchTestUtils.renderCustomerRow({ ...customer, credentialKey: '' }), /aria-current="true"/);
        current = { ...customer, credentialKey: '' };
        assert.match(__customerSearchTestUtils.renderCustomerRow({ ...customer, credentialKey: '' }), /aria-current="true"/);
        current = { ...customer, credentialKey: '  source-one  ' };
        assert.match(__customerSearchTestUtils.renderCustomerRow(customer), /aria-current="true"/);
        current = { ...customer, id: 'another-person' };
        assert.doesNotMatch(__customerSearchTestUtils.renderCustomerRow(customer), /aria-current="true"/);
        current = null;
        assert.doesNotMatch(__customerSearchTestUtils.renderCustomerRow(customer), /aria-current="true"/);
    } finally { globalThis.kiwiLegacyCustomerSearchBridge = previousBridge; }
}

async function run() {
    testSearchSummaryCountsAndLiveLocaleChange();
    await testNativeLocaleRefreshKeepsRealSearchMetadataAndRetainedWorkspace();
    await testAcceptedQuerySnapshotSurvivesPendingAndOutOfOrderSearches();
    testSelectedCustomerKeepsSourceIdentity();
    testRegistersItemFiveActions();
    testInstallsLegacyCompatibilityExports();
    testPageNumbersAndNormalizationHelpers();
    testSortResultsList();
    testRenderCustomerRowShowsMandantBadgeForRecognizedMandant();
    testSubscriptionApiBadgesDistinguishLoadingUnavailableAndLoadedStates();
    testSubscriptionStatusTranslationsStayAligned();
    testAppliesSummariesByPersonAndCredentialContext();
    testSubscriptionSortUsesLoadedCountsAndPlacesUnavailableLast();
    await testLoadsVisiblePageThenRemainingResultsForSubscriptionSort();
    await testIgnoresSubscriptionSummariesFromAnOlderSearch();
    testBuildSearchParamsIncludesEmailFilter();
    testFilterCustomersLocallyUsesMandantAndAdditionalFields();
    testBuildSearchQueryLabelIncludesEmailAndPhone();
    console.log('customer search slice tests passed');
}

await run();
