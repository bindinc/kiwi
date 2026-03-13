import assert from 'node:assert/strict';
import { createActionRouter } from '../actions.js';
import { registerCustomerSearchSlice, __customerSearchTestUtils } from './customer-search-slice.js';

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

function run() {
    testRegistersItemFiveActions();
    testInstallsLegacyCompatibilityExports();
    testPageNumbersAndNormalizationHelpers();
    testSortResultsList();
    console.log('customer search slice tests passed');
}

run();
