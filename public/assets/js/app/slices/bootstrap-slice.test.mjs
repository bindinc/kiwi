import assert from 'node:assert/strict';
import { createBootstrapSlice, installBootstrapSlice } from './bootstrap-slice.js';

function createSilentLogger() {
    return {
        warn() {},
        error() {}
    };
}

function createElement(initialValue = '') {
    return {
        value: initialValue,
        style: {
            display: ''
        },
        textContent: ''
    };
}

function testCreateInitialAppDataState() {
    const slice = createBootstrapSlice({ logger: createSilentLogger() });
    const firstState = slice.createInitialAppDataState();
    const secondState = slice.createInitialAppDataState();

    assert.deepEqual(firstState.searchState, {
        results: [],
        currentPage: 1,
        itemsPerPage: 20,
        sortBy: 'name',
        sortOrder: 'asc'
    });
    assert.deepEqual(firstState.contactHistoryState, {
        currentPage: 1,
        itemsPerPage: 6,
        highlightId: null,
        lastEntry: null
    });
    assert.notEqual(firstState.searchState, secondState.searchState);
    assert.notEqual(firstState.contactHistoryState, secondState.contactHistoryState);
}

function testUpsertCustomerInCache() {
    const slice = createBootstrapSlice({ logger: createSilentLogger() });
    const state = {
        customers: [{ id: 1, firstName: 'Jane' }],
        currentCustomer: { id: 1, firstName: 'Jane' },
        setCustomers(nextCustomers) {
            this.customers = nextCustomers;
        },
        setCurrentCustomer(nextCustomer) {
            this.currentCustomer = nextCustomer;
        }
    };

    slice.upsertCustomerInCache({ id: 1, firstName: 'Janet' }, state);
    assert.equal(state.customers.length, 1);
    assert.equal(state.customers[0].firstName, 'Janet');
    assert.equal(state.currentCustomer.firstName, 'Janet');

    slice.upsertCustomerInCache({ id: 2, firstName: 'Alex' }, state);
    assert.equal(state.customers.length, 2);
    assert.equal(state.customers[1].firstName, 'Alex');
}

async function testLoadBootstrapState() {
    const warnings = [];
    const slice = createBootstrapSlice({
        logger: {
            warn(message) {
                warnings.push(message);
            },
            error() {}
        }
    });

    const noApiResult = await slice.loadBootstrapState({});
    assert.equal(noApiResult, null);

    const payload = { customers: [{ id: 1 }] };
    const loadedPayload = await slice.loadBootstrapState({
        kiwiApi: {
            get() {
                return Promise.resolve(payload);
            }
        }
    });
    assert.equal(loadedPayload, payload);

    const failedPayload = await slice.loadBootstrapState({
        kiwiApi: {
            get() {
                return Promise.reject(new Error('boom'));
            }
        }
    });
    assert.equal(failedPayload, null);
    assert.equal(warnings.length, 1);
}

function testInitializeData() {
    const slice = createBootstrapSlice({ logger: createSilentLogger() });
    const fallbackData = slice.initializeData({
        bootstrapState: null,
        callQueue: { enabled: true },
        callSession: { active: false },
        werfsleutelCatalog: [{ salesCode: 'A1' }]
    });

    assert.deepEqual(fallbackData.customers, []);
    assert.deepEqual(fallbackData.serviceNumbers, {});
    assert.deepEqual(fallbackData.werfsleutelChannels, {});
    assert.deepEqual(fallbackData.werfsleutelCatalog, []);
    assert.equal(fallbackData.lastCallSession, null);

    const initializedData = slice.initializeData({
        bootstrapState: {
            customers: [{ id: 7 }],
            call_queue: { queue: [{ callId: 'c1' }] },
            call_session: { active: true },
            last_call_session: { id: 'last-call' },
            catalog: {
                serviceNumbers: { ALGEMEEN: { code: 'ALGEMEEN' } },
                werfsleutelChannels: { online: { label: 'Online' } }
            }
        },
        callQueue: { enabled: true, queue: [] },
        callSession: { active: false, callerType: 'anonymous' },
        werfsleutelCatalog: [{ salesCode: 'A1' }]
    });

    assert.deepEqual(initializedData.customers, [{ id: 7 }]);
    assert.deepEqual(initializedData.callQueue, {
        enabled: true,
        queue: [{ callId: 'c1' }]
    });
    assert.deepEqual(initializedData.callSession, {
        active: true,
        callerType: 'anonymous'
    });
    assert.deepEqual(initializedData.lastCallSession, { id: 'last-call' });
    assert.deepEqual(initializedData.serviceNumbers, { ALGEMEEN: { code: 'ALGEMEEN' } });
    assert.deepEqual(initializedData.werfsleutelChannels, { online: { label: 'Online' } });
    assert.deepEqual(initializedData.werfsleutelCatalog, [{ salesCode: 'A1' }]);
}

async function testSaveCustomers() {
    const saveCalls = [];
    const errors = [];
    const slice = createBootstrapSlice({
        logger: {
            warn() {},
            error(message) {
                errors.push(message);
            }
        }
    });

    slice.saveCustomers({
        kiwiApi: {
            put(url, payload) {
                saveCalls.push({ url, payload });
                return Promise.resolve();
            }
        },
        personsStateApiUrl: '/api/v1/persons/state',
        customers: [{ id: 99 }]
    });

    assert.deepEqual(saveCalls, [{
        url: '/api/v1/persons/state',
        payload: {
            customers: [{ id: 99 }]
        }
    }]);

    slice.saveCustomers({
        kiwiApi: {
            put() {
                return Promise.reject(new Error('save failed'));
            }
        },
        customers: [{ id: 100 }]
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(errors.length, 1);
}

function testUpdateCustomerActionButtons() {
    const slice = createBootstrapSlice({ logger: createSilentLogger() });
    const resendButton = createElement();
    const winbackButton = createElement();
    const documentRef = {
        getElementById(id) {
            if (id === 'resendMagazineBtn') {
                return resendButton;
            }
            if (id === 'winbackFlowBtn') {
                return winbackButton;
            }
            return null;
        }
    };

    slice.updateCustomerActionButtons({
        documentRef,
        currentCustomer: null
    });
    assert.equal(resendButton.style.display, 'none');
    assert.equal(winbackButton.style.display, 'none');

    slice.updateCustomerActionButtons({
        documentRef,
        currentCustomer: { id: 1 }
    });
    assert.equal(resendButton.style.display, 'inline-flex');
    assert.equal(winbackButton.style.display, 'inline-flex');
}

function testUpdateTime() {
    const slice = createBootstrapSlice({ logger: createSilentLogger() });
    const currentTimeElement = createElement();
    const documentRef = {
        getElementById(id) {
            if (id === 'currentTime') {
                return currentTimeElement;
            }
            return null;
        }
    };

    slice.updateTime({
        documentRef,
        getDateLocaleForApp() {
            return 'en-US';
        }
    });

    assert.ok(currentTimeElement.textContent.length > 0);
    assert.ok(currentTimeElement.textContent.includes(' - '));
}

async function testInitializeKiwiApplication() {
    const slice = createBootstrapSlice({ logger: createSilentLogger() });
    const callCounters = {
        applyLocaleToUi: 0,
        loadBootstrapState: 0,
        initializeData: 0,
        initializeQueue: 0,
        updateTime: 0,
        setInterval: 0,
        updateCustomerActionButtons: 0,
        populateBirthdayFields: [],
        initDeliveryDatePicker: 0,
        initArticleSearch: 0,
        initWerfsleutelPicker: 0,
        startAgentWorkSessionTimer: 0,
        updateAgentStatusDisplay: 0,
        initializeAgentStatusFromBackend: 0,
        setAdditionalFiltersOpen: []
    };
    let observedInterval = null;
    const searchName = createElement('jan');
    const searchPhone = createElement('');
    const searchEmail = createElement('');
    const documentRef = {
        getElementById(id) {
            if (id === 'searchName') {
                return searchName;
            }
            if (id === 'searchPhone') {
                return searchPhone;
            }
            if (id === 'searchEmail') {
                return searchEmail;
            }
            return null;
        }
    };

    const dependencies = {
        applyLocaleToUi() {
            callCounters.applyLocaleToUi += 1;
        },
        async loadBootstrapState() {
            callCounters.loadBootstrapState += 1;
        },
        initializeData() {
            callCounters.initializeData += 1;
        },
        initializeQueue() {
            callCounters.initializeQueue += 1;
        },
        updateTime() {
            callCounters.updateTime += 1;
        },
        setInterval(callback, timeout) {
            callCounters.setInterval += 1;
            observedInterval = { callback, timeout };
            return 1;
        },
        updateCustomerActionButtons() {
            callCounters.updateCustomerActionButtons += 1;
        },
        populateBirthdayFields(formType) {
            callCounters.populateBirthdayFields.push(formType);
        },
        initDeliveryDatePicker() {
            callCounters.initDeliveryDatePicker += 1;
        },
        initArticleSearch() {
            callCounters.initArticleSearch += 1;
        },
        initWerfsleutelPicker() {
            callCounters.initWerfsleutelPicker += 1;
            return Promise.resolve();
        },
        startAgentWorkSessionTimer() {
            callCounters.startAgentWorkSessionTimer += 1;
        },
        updateAgentStatusDisplay() {
            callCounters.updateAgentStatusDisplay += 1;
        },
        initializeAgentStatusFromBackend() {
            callCounters.initializeAgentStatusFromBackend += 1;
        },
        setAdditionalFiltersOpen(nextIsOpen) {
            callCounters.setAdditionalFiltersOpen.push(nextIsOpen);
        },
        documentRef
    };

    await slice.initializeKiwiApplication(dependencies);
    await slice.initializeKiwiApplication(dependencies);

    assert.equal(callCounters.applyLocaleToUi, 1);
    assert.equal(callCounters.loadBootstrapState, 1);
    assert.equal(callCounters.initializeData, 1);
    assert.equal(callCounters.initializeQueue, 1);
    assert.equal(callCounters.updateTime, 1);
    assert.equal(callCounters.setInterval, 1);
    assert.equal(callCounters.updateCustomerActionButtons, 1);
    assert.deepEqual(callCounters.populateBirthdayFields, ['article', 'edit']);
    assert.equal(callCounters.initDeliveryDatePicker, 1);
    assert.equal(callCounters.initArticleSearch, 1);
    assert.equal(callCounters.initWerfsleutelPicker, 1);
    assert.equal(callCounters.startAgentWorkSessionTimer, 1);
    assert.equal(callCounters.updateAgentStatusDisplay, 1);
    assert.equal(callCounters.initializeAgentStatusFromBackend, 1);
    assert.deepEqual(callCounters.setAdditionalFiltersOpen, [true]);
    assert.deepEqual(observedInterval, {
        callback: dependencies.updateTime,
        timeout: 1000
    });
}

async function testInstallInitializationHook() {
    const slice = createBootstrapSlice({ logger: createSilentLogger() });
    let initializeCalls = 0;
    let domReadyHandler = null;
    const loadingDocumentRef = {
        readyState: 'loading',
        addEventListener(eventName, callback, options) {
            assert.equal(eventName, 'DOMContentLoaded');
            assert.deepEqual(options, { once: true });
            domReadyHandler = callback;
        }
    };

    slice.installInitializationHook({
        documentRef: loadingDocumentRef,
        async initializeKiwiApplication() {
            initializeCalls += 1;
        }
    });
    assert.equal(initializeCalls, 0);

    await domReadyHandler();
    assert.equal(initializeCalls, 1);

    const completeDocumentRef = {
        readyState: 'complete',
        addEventListener() {
            throw new Error('Should not register DOMContentLoaded when already complete');
        }
    };
    slice.installInitializationHook({
        documentRef: completeDocumentRef,
        async initializeKiwiApplication() {
            initializeCalls += 1;
        }
    });

    assert.equal(initializeCalls, 2);
}

function testInstallBootstrapSliceNamespace() {
    const globalScope = {};
    const installed = installBootstrapSlice({
        globalScope
    });
    assert.equal(globalScope.kiwiBootstrapSlice, installed);

    const reused = installBootstrapSlice({
        globalScope
    });
    assert.equal(reused, installed);
}

async function run() {
    testCreateInitialAppDataState();
    testUpsertCustomerInCache();
    await testLoadBootstrapState();
    testInitializeData();
    await testSaveCustomers();
    testUpdateCustomerActionButtons();
    testUpdateTime();
    await testInitializeKiwiApplication();
    await testInstallInitializationHook();
    testInstallBootstrapSliceNamespace();
    console.log('bootstrap slice tests passed');
}

run();
