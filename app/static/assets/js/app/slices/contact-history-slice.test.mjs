import assert from 'node:assert/strict';
import { createActionRouter } from '../actions.js';
import {
    __contactHistoryTestUtils,
    addContactMoment,
    pushContactHistory,
    registerContactHistorySlice,
    resetContactHistoryViewState
} from './contact-history-slice.js';

function createRouter() {
    const root = {
        addEventListener() {},
        removeEventListener() {}
    };

    return createActionRouter({
        root,
        eventTypes: ['click', 'change']
    });
}

function withGlobalState(testFn) {
    const previousValues = {
        kiwiContactHistorySlice: globalThis.kiwiContactHistorySlice,
        kiwiGetCustomerDetailSliceDependencies: globalThis.kiwiGetCustomerDetailSliceDependencies,
        document: globalThis.document,
        setTimeout: globalThis.setTimeout,
        clearTimeout: globalThis.clearTimeout
    };

    const restoreValue = (key, value) => {
        if (value === undefined) {
            delete globalThis[key];
            return;
        }

        globalThis[key] = value;
    };

    try {
        __contactHistoryTestUtils.clearContactHistoryHighlightTimer();
        testFn();
    } finally {
        __contactHistoryTestUtils.clearContactHistoryHighlightTimer();
        restoreValue('kiwiContactHistorySlice', previousValues.kiwiContactHistorySlice);
        restoreValue('kiwiGetCustomerDetailSliceDependencies', previousValues.kiwiGetCustomerDetailSliceDependencies);
        restoreValue('document', previousValues.document);
        restoreValue('setTimeout', previousValues.setTimeout);
        restoreValue('clearTimeout', previousValues.clearTimeout);
    }
}

function testRegistersItemSixteenActionsAndNamespace() {
    withGlobalState(() => {
        globalThis.kiwiGetCustomerDetailSliceDependencies = () => ({
            getCurrentCustomer() {
                return null;
            },
            getContactHistoryState() {
                return {
                    currentPage: 1,
                    itemsPerPage: 6,
                    highlightId: null,
                    lastEntry: null
                };
            }
        });

        const router = createRouter();
        registerContactHistorySlice(router);

        const actionNames = router.getRegisteredActions();
        assert.equal(actionNames.includes('toggle-timeline-item'), true);
        assert.equal(actionNames.includes('change-contact-history-page'), true);
        assert.equal(typeof globalThis.kiwiContactHistorySlice, 'object');
        assert.equal(typeof globalThis.kiwiContactHistorySlice.pushContactHistory, 'function');
        assert.equal(typeof globalThis.kiwiContactHistorySlice.addContactMoment, 'function');
        assert.equal(typeof globalThis.kiwiContactHistorySlice.resetContactHistoryViewState, 'function');
    });
}

function testPushContactHistoryTracksHighlightAndPersistsViaSaveCustomers() {
    withGlobalState(() => {
        const customer = {
            id: 7,
            contactHistory: []
        };
        const contactHistoryState = {
            currentPage: 4,
            itemsPerPage: 6,
            highlightId: null,
            lastEntry: null
        };
        let savedCustomersCount = 0;
        const timeoutCallbacks = [];
        const clearedTimeoutIds = [];

        globalThis.setTimeout = (callback) => {
            timeoutCallbacks.push(callback);
            return timeoutCallbacks.length;
        };
        globalThis.clearTimeout = (timerId) => {
            clearedTimeoutIds.push(timerId);
        };
        globalThis.kiwiGetCustomerDetailSliceDependencies = () => ({
            findCustomerById(customerId) {
                return Number(customerId) === 7 ? customer : null;
            },
            getCurrentCustomer() {
                return customer;
            },
            getContactHistoryState() {
                return contactHistoryState;
            },
            getApiClient() {
                return null;
            },
            personsApiUrl: '/api/v1/persons',
            saveCustomers() {
                savedCustomersCount += 1;
            }
        });

        const firstEntry = pushContactHistory(
            customer,
            {
                type: 'call_identified',
                description: 'Beller geïdentificeerd'
            },
            { highlight: true, moveToFirstPage: true }
        );

        assert.equal(typeof firstEntry.id, 'string');
        assert.equal(customer.contactHistory.length, 1);
        assert.equal(customer.contactHistory[0].description, 'Beller geïdentificeerd');
        assert.equal(savedCustomersCount, 1);
        assert.equal(contactHistoryState.currentPage, 1);
        assert.equal(contactHistoryState.highlightId, firstEntry.id);
        assert.equal(contactHistoryState.lastEntry.id, firstEntry.id);
        assert.equal(contactHistoryState.lastEntry.type, 'call_identified');

        const secondEntry = pushContactHistory(
            customer,
            {
                type: 'call_hold',
                description: 'Gesprek in wacht'
            },
            { highlight: true }
        );

        assert.equal(savedCustomersCount, 2);
        assert.equal(customer.contactHistory.length, 2);
        assert.equal(customer.contactHistory[0].id, secondEntry.id);
        assert.equal(clearedTimeoutIds.includes(1), true);

        const latestCallback = timeoutCallbacks[timeoutCallbacks.length - 1];
        latestCallback();
        assert.equal(contactHistoryState.highlightId, null);
    });
}

async function testPushContactHistoryPersistsViaApiWhenAvailable() {
    const previousProvider = globalThis.kiwiGetCustomerDetailSliceDependencies;
    try {
        const customer = {
            id: 17,
            contactHistory: []
        };
        const contactHistoryState = {
            currentPage: 1,
            itemsPerPage: 6,
            highlightId: null,
            lastEntry: null
        };
        const postCalls = [];
        let saveCustomersCount = 0;

        globalThis.kiwiGetCustomerDetailSliceDependencies = () => ({
            findCustomerById(customerId) {
                return Number(customerId) === 17 ? customer : null;
            },
            getCurrentCustomer() {
                return customer;
            },
            getContactHistoryState() {
                return contactHistoryState;
            },
            getApiClient() {
                return {
                    post(url, payload) {
                        postCalls.push({ url, payload });
                        return Promise.resolve({ id: 'server-entry-id' });
                    }
                };
            },
            personsApiUrl: '/api/v1/persons',
            saveCustomers() {
                saveCustomersCount += 1;
            }
        });

        const entry = pushContactHistory(
            customer,
            {
                type: 'notification_success',
                description: 'Opgeslagen'
            },
            { highlight: false, refresh: false }
        );

        assert.equal(postCalls.length, 1);
        assert.equal(postCalls[0].url, '/api/v1/persons/17/contact-history');
        assert.equal(postCalls[0].payload.description, 'Opgeslagen');
        assert.equal(saveCustomersCount, 0);

        await Promise.resolve();
        assert.equal(entry.id, 'server-entry-id');
    } finally {
        __contactHistoryTestUtils.clearContactHistoryHighlightTimer();
        if (previousProvider === undefined) {
            delete globalThis.kiwiGetCustomerDetailSliceDependencies;
        } else {
            globalThis.kiwiGetCustomerDetailSliceDependencies = previousProvider;
        }
    }
}

function testAddContactMomentResolvesCustomerById() {
    withGlobalState(() => {
        const targetCustomer = {
            id: 23,
            contactHistory: []
        };
        const contactHistoryState = {
            currentPage: 2,
            itemsPerPage: 6,
            highlightId: null,
            lastEntry: null
        };

        globalThis.kiwiGetCustomerDetailSliceDependencies = () => ({
            findCustomerById(customerId) {
                return Number(customerId) === 23 ? targetCustomer : null;
            },
            getCurrentCustomer() {
                return targetCustomer;
            },
            getContactHistoryState() {
                return contactHistoryState;
            },
            getApiClient() {
                return null;
            },
            personsApiUrl: '/api/v1/persons',
            saveCustomers() {}
        });

        const entry = addContactMoment(23, 'call_identified', 'Beller gekoppeld');

        assert.equal(targetCustomer.contactHistory.length, 1);
        assert.equal(targetCustomer.contactHistory[0].type, 'call_identified');
        assert.equal(targetCustomer.contactHistory[0].description, 'Beller gekoppeld');
        assert.equal(contactHistoryState.currentPage, 1);
        assert.equal(contactHistoryState.highlightId, entry.id);
    });
}

function testResetContactHistoryViewStateClearsTimerAndState() {
    withGlobalState(() => {
        const customer = {
            id: 8,
            contactHistory: []
        };
        const contactHistoryState = {
            currentPage: 3,
            itemsPerPage: 6,
            highlightId: null,
            lastEntry: {
                id: 'entry-1',
                type: 'notification_info',
                createdAt: Date.now()
            }
        };
        const clearedTimeoutIds = [];

        globalThis.setTimeout = () => 99;
        globalThis.clearTimeout = (timerId) => {
            clearedTimeoutIds.push(timerId);
        };
        globalThis.kiwiGetCustomerDetailSliceDependencies = () => ({
            findCustomerById(customerId) {
                return Number(customerId) === 8 ? customer : null;
            },
            getCurrentCustomer() {
                return customer;
            },
            getContactHistoryState() {
                return contactHistoryState;
            },
            getApiClient() {
                return null;
            },
            personsApiUrl: '/api/v1/persons',
            saveCustomers() {}
        });

        pushContactHistory(
            customer,
            {
                type: 'notification_info',
                description: 'Info'
            },
            { highlight: true, persist: false, refresh: false }
        );
        assert.equal(contactHistoryState.highlightId !== null, true);

        resetContactHistoryViewState();
        assert.equal(contactHistoryState.currentPage, 1);
        assert.equal(contactHistoryState.highlightId, null);
        assert.equal(contactHistoryState.lastEntry, null);
        assert.equal(clearedTimeoutIds.includes(99), true);
    });
}

async function run() {
    testRegistersItemSixteenActionsAndNamespace();
    testPushContactHistoryTracksHighlightAndPersistsViaSaveCustomers();
    await testPushContactHistoryPersistsViaApiWhenAvailable();
    testAddContactMomentResolvesCustomerById();
    testResetContactHistoryViewStateClearsTimerAndState();
    console.log('contact history slice tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
