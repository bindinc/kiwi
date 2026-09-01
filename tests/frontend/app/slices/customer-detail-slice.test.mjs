import assert from 'node:assert/strict';
import {
    __customerDetailTestUtils,
    configureCustomerDetailSliceDependencies,
    selectCustomer
} from '../../../../assets/js/app/slices/customer-detail-slice.js';

function createDeferred() {
    let resolve;
    const promise = new Promise((resolvePromise) => {
        resolve = resolvePromise;
    });

    return { promise, resolve };
}

function testBuildCustomerHeaderIncludesPersonId() {
    const header = __customerDetailTestUtils.buildCustomerHeader({
        salutation: 'Dhr.',
        firstName: 'Bart',
        middleName: 'de',
        lastName: 'Deijkers',
        personId: '12345'
    });

    assert.equal(header, 'Dhr. Bart de Deijkers (12345)');
}

function testBuildCustomerHeaderFallsBackToNameWithoutPersonId() {
    const header = __customerDetailTestUtils.buildCustomerHeader({
        firstName: 'Bart',
        lastName: 'Deijkers'
    });

    assert.equal(header, 'Bart Deijkers');
}

async function testLateCustomerAResponseCannotOverwriteCustomerB() {
    const previousDocument = globalThis.document;
    const previousApi = globalThis.kiwiApi;
    const previousScrollTo = globalThis.scrollTo;
    const responses = new Map([
        ['/api/v1/persons/1?sourceSystem=kiwi', createDeferred()],
        ['/api/v1/persons/2?sourceSystem=kiwi', createDeferred()]
    ]);
    const contexts = [];
    const upsertedCustomerIds = [];
    let currentContext = null;
    let currentCustomer = null;

    globalThis.document = {
        getElementById() {
            return null;
        },
        querySelector() {
            return null;
        },
        querySelectorAll() {
            return [];
        }
    };
    globalThis.scrollTo = () => {};
    globalThis.kiwiApi = {
        get(url) {
            return responses.get(url).promise;
        }
    };
    configureCustomerDetailSliceDependencies(() => ({
        personsApiUrl: '/api/v1/persons',
        findCustomerById(customerId) {
            return { id: customerId, personId: String(customerId), sourceSystem: 'kiwi' };
        },
        startCustomerSelection(customer) {
            const context = {
                workflowSessionId: `workflow-${customer.id}`,
                contextGeneration: contexts.length + 1,
                customerReference: { personId: String(customer.id) }
            };
            contexts.push(context);
            currentContext = context;
            return context;
        },
        isCustomerContextCurrent(context) {
            return context === currentContext;
        },
        confirmCustomerSelection(context) {
            return context === currentContext;
        },
        setCurrentCustomer(customer) {
            currentCustomer = customer;
        },
        getCurrentCustomer() {
            return currentCustomer;
        },
        upsertCustomerInCache(customer) {
            upsertedCustomerIds.push(customer.id);
        }
    }));

    try {
        const selectionA = selectCustomer(1);
        const selectionB = selectCustomer(2);

        responses.get('/api/v1/persons/2?sourceSystem=kiwi').resolve({
            id: 2,
            personId: '2',
            firstName: 'Customer B',
            sourceSystem: 'kiwi'
        });
        await selectionB;
        assert.equal(currentCustomer.personId, '2');

        responses.get('/api/v1/persons/1?sourceSystem=kiwi').resolve({
            id: 1,
            personId: '1',
            firstName: 'Customer A',
            sourceSystem: 'kiwi'
        });
        await selectionA;

        assert.equal(currentCustomer.personId, '2');
        assert.deepEqual(upsertedCustomerIds, [2]);
    } finally {
        configureCustomerDetailSliceDependencies(null);
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
        if (previousApi === undefined) {
            delete globalThis.kiwiApi;
        } else {
            globalThis.kiwiApi = previousApi;
        }
        if (previousScrollTo === undefined) {
            delete globalThis.scrollTo;
        } else {
            globalThis.scrollTo = previousScrollTo;
        }
    }
}

async function run() {
    testBuildCustomerHeaderIncludesPersonId();
    testBuildCustomerHeaderFallsBackToNameWithoutPersonId();
    await testLateCustomerAResponseCannotOverwriteCustomerB();
    console.log('customer detail slice tests passed');
}

await run();
