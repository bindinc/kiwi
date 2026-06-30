import assert from 'node:assert/strict';
import { createActionRouter } from '../../../../assets/js/app/actions.js';
import { registerCustomerSearchSlice, __customerSearchTestUtils } from '../../../../assets/js/app/slices/customer-search-slice.js';

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
        assert.equal(label.includes('Mandant: KRO-NCRV, HMC'), true);
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
}

function run() {
    testRegistersItemFiveActions();
    testInstallsLegacyCompatibilityExports();
    testPageNumbersAndNormalizationHelpers();
    testSortResultsList();
    testRenderCustomerRowShowsMandantBadgeForRecognizedMandant();
    testBuildSearchParamsIncludesEmailFilter();
    testFilterCustomersLocallyUsesMandantAndAdditionalFields();
    testBuildSearchQueryLabelIncludesEmailAndPhone();
    console.log('customer search slice tests passed');
}

run();
