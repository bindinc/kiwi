import assert from 'node:assert/strict';
import { coerceActionValue, createActionRouter, extractActionPayload } from './actions.js';
import { registerCallQueueAgentStatusSlices } from './slices/index.js';
import { configureContactHistorySliceDependencies, registerContactHistorySlice } from './slices/contact-history-slice.js';
import { configureCustomerDetailSliceDependencies, registerCustomerDetailSlice } from './slices/customer-detail-slice.js';
import { registerLocalizationSlice } from './slices/localization-slice.js';

function testCoerceActionValue() {
    assert.equal(coerceActionValue('true'), true);
    assert.equal(coerceActionValue('false'), false);
    assert.equal(coerceActionValue('42'), 42);
    assert.equal(coerceActionValue('4.2'), 4.2);
    assert.deepEqual(coerceActionValue('{"customerId":12}'), { customerId: 12 });
    assert.equal(coerceActionValue('value'), 'value');
}

function testExtractActionPayload() {
    const payload = extractActionPayload({
        action: 'select-customer',
        argCustomerId: '123',
        argForce: 'true',
        argMeta: '{"source":"search"}'
    });

    assert.deepEqual(payload, {
        customerId: 123,
        force: true,
        meta: { source: 'search' }
    });
}

function testRouterDispatch() {
    const listeners = {};
    const root = {
        addEventListener(eventType, handler) {
            listeners[eventType] = handler;
        },
        removeEventListener(eventType) {
            delete listeners[eventType];
        }
    };

    let invocation = null;
    const router = createActionRouter({
        root,
        eventTypes: ['click']
    });

    router.register('select-customer', (payload, context) => {
        invocation = {
            payload,
            actionName: context.actionName
        };
    });

    router.install();
    assert.equal(typeof listeners.click, 'function');

    let stopPropagationCalled = false;
    const actionElement = {
        dataset: {
            action: 'select-customer',
            argCustomerId: '81',
            actionStopPropagation: 'true'
        }
    };
    const event = {
        type: 'click',
        stopPropagation() {
            stopPropagationCalled = true;
        },
        target: {
            closest(selector) {
                if (selector === '[data-action]') {
                    return actionElement;
                }
                return null;
            }
        }
    };

    listeners.click(event);
    assert.deepEqual(invocation, {
        payload: { customerId: 81 },
        actionName: 'select-customer'
    });
    assert.equal(stopPropagationCalled, true);
}

function createDelegatedEvent(actionElement, eventType, options = {}) {
    return {
        type: eventType,
        target: {
            closest(selector) {
                if (selector === '[data-action]') {
                    return actionElement;
                }
                return null;
            }
        },
        stopPropagation: options.stopPropagation || (() => {}),
        preventDefault: options.preventDefault || (() => {})
    };
}

function createToggleClassList(initialValues = []) {
    const classes = new Set(initialValues);
    return {
        toggle(className, forcedState) {
            if (forcedState === true) {
                classes.add(className);
                return true;
            }
            if (forcedState === false) {
                classes.delete(className);
                return false;
            }
            if (classes.has(className)) {
                classes.delete(className);
                return false;
            }
            classes.add(className);
            return true;
        },
        contains(className) {
            return classes.has(className);
        }
    };
}

function testCallQueueAgentStatusSlices() {
    const listeners = {};
    const root = {
        addEventListener(eventType, handler) {
            listeners[eventType] = handler;
        },
        removeEventListener(eventType) {
            delete listeners[eventType];
        }
    };

    const router = createActionRouter({
        root,
        eventTypes: ['click', 'change']
    });
    registerCallQueueAgentStatusSlices(router);
    router.install();

    const expectedActions = [
        'agent-status.toggle-menu',
        'agent-status.set',
        'call-session.toggle-hold',
        'call-session.end',
        'call-session.identify-current-customer',
        'call-session.identify-caller',
        'queue.accept-next',
        'queue.debug-generate',
        'queue.debug-clear',
        'acw.manual-finish',
        'disposition.update-outcomes',
        'disposition.toggle-follow-up',
        'disposition.cancel',
        'disposition.save',
        'debug.close-modal',
        'debug.toggle-known-caller',
        'debug.start-call',
        'debug.end-call',
        'debug.full-reset'
    ];
    assert.deepEqual(
        router.getRegisteredActions().slice().sort(),
        expectedActions.slice().sort()
    );

    const observedCalls = [];
    const runtimeMethodNames = [
        'toggleStatusMenu',
        'setAgentStatus',
        'identifyCallerAsCustomer',
        'updateDispositionOutcomes',
        'debugGenerateQueue'
    ];
    const previousRuntimeNamespace = globalThis.kiwiCallAgentRuntime;
    globalThis.kiwiCallAgentRuntime = {};
    for (const methodName of runtimeMethodNames) {
        globalThis.kiwiCallAgentRuntime[methodName] = (...args) => {
            observedCalls.push({ methodName, args });
        };
    }

    try {
        const toggleMenuElement = {
            dataset: {
                action: 'agent-status.toggle-menu',
                actionEvent: 'click'
            }
        };
        const toggleMenuEvent = createDelegatedEvent(toggleMenuElement, 'click');
        listeners.click(toggleMenuEvent);
        assert.equal(observedCalls[0].methodName, 'toggleStatusMenu');
        assert.equal(observedCalls[0].args.length, 1);
        assert.equal(observedCalls[0].args[0], toggleMenuEvent);

        const statusElement = {
            dataset: {
                action: 'agent-status.set',
                statusOption: 'busy',
                actionEvent: 'click'
            }
        };
        listeners.click(createDelegatedEvent(statusElement, 'click'));
        assert.deepEqual(observedCalls[1], {
            methodName: 'setAgentStatus',
            args: ['busy']
        });

        let stopPropagationCalls = 0;
        const identifyElement = {
            dataset: {
                action: 'call-session.identify-caller',
                actionEvent: 'click',
                argCustomerId: '81'
            }
        };
        listeners.click(
            createDelegatedEvent(identifyElement, 'click', {
                stopPropagation() {
                    stopPropagationCalls += 1;
                }
            })
        );
        assert.equal(stopPropagationCalls, 1);
        assert.deepEqual(observedCalls[2], {
            methodName: 'identifyCallerAsCustomer',
            args: [81]
        });

        const outcomesElement = {
            dataset: {
                action: 'disposition.update-outcomes',
                actionEvent: 'change'
            }
        };
        listeners.change(createDelegatedEvent(outcomesElement, 'change'));
        assert.deepEqual(observedCalls[3], {
            methodName: 'updateDispositionOutcomes',
            args: []
        });

        const queueGenerateElement = {
            dataset: {
                action: 'queue.debug-generate',
                actionEvent: 'click'
            }
        };
        listeners.click(createDelegatedEvent(queueGenerateElement, 'click'));
        assert.deepEqual(observedCalls[4], {
            methodName: 'debugGenerateQueue',
            args: []
        });
    } finally {
        if (previousRuntimeNamespace === undefined) {
            delete globalThis.kiwiCallAgentRuntime;
        } else {
            globalThis.kiwiCallAgentRuntime = previousRuntimeNamespace;
        }
    }
}

function testLocalizationSlice() {
    const listeners = {};
    const root = {
        addEventListener(eventType, handler) {
            listeners[eventType] = handler;
        },
        removeEventListener(eventType) {
            delete listeners[eventType];
        }
    };

    const router = createActionRouter({
        root,
        eventTypes: ['click']
    });
    registerLocalizationSlice(router);
    router.install();

    const registeredActions = router.getRegisteredActions();
    assert.equal(registeredActions.includes('localization.set-locale'), true);

    const previousI18n = globalThis.i18n;
    let currentLocale = 'nl';
    const localeSwitches = [];
    globalThis.i18n = {
        setLocale(locale) {
            currentLocale = locale;
            localeSwitches.push(locale);
            return locale;
        },
        getLocale() {
            return currentLocale;
        },
        availableLocales() {
            return ['nl', 'en'];
        },
        t(key) {
            return key;
        }
    };

    try {
        const localeElement = {
            dataset: {
                action: 'localization.set-locale',
                actionEvent: 'click',
                localeOption: 'en'
            }
        };
        listeners.click(createDelegatedEvent(localeElement, 'click'));

        assert.deepEqual(localeSwitches, ['en']);
        assert.equal(globalThis.getAppLocale(), 'en');
    } finally {
        if (previousI18n === undefined) {
            delete globalThis.i18n;
        } else {
            globalThis.i18n = previousI18n;
        }
    }
}

function testContactHistorySlice() {
    const listeners = {};
    const root = {
        addEventListener(eventType, handler) {
            listeners[eventType] = handler;
        },
        removeEventListener(eventType) {
            delete listeners[eventType];
        }
    };

    const previousDocument = globalThis.document;
    const previousContactHistoryNamespace = globalThis.kiwiContactHistorySlice;

    const contactHistoryState = {
        currentPage: 1,
        itemsPerPage: 1,
        highlightId: null,
        lastEntry: null
    };
    const currentCustomer = {
        id: 17,
        contactHistory: [
            { id: 'a', type: 'default', date: '2025-01-01T10:00:00Z', description: 'Een' },
            { id: 'b', type: 'default', date: '2025-01-02T10:00:00Z', description: 'Twee' }
        ]
    };

    const historyContainer = { innerHTML: '' };
    const contentNode = {
        classList: createToggleClassList(['expanded'])
    };
    const expandNode = {
        classList: createToggleClassList(['expanded'])
    };

    const customerDetailDependencies = {
        getCurrentCustomer() {
            return currentCustomer;
        },
        getContactHistoryState() {
            return contactHistoryState;
        },
        translate(_key, _params, fallback) {
            return fallback;
        },
        getDateLocaleForApp() {
            return 'nl-NL';
        }
    };
    configureContactHistorySliceDependencies(() => customerDetailDependencies);
    globalThis.document = {
        getElementById(id) {
            if (id === 'contactHistory') {
                return historyContainer;
            }
            if (id === 'content-row-1') {
                return contentNode;
            }
            if (id === 'expand-row-1') {
                return expandNode;
            }
            return null;
        }
    };

    try {
        const router = createActionRouter({
            root,
            eventTypes: ['click']
        });
        registerContactHistorySlice(router);
        router.install();

        const registeredActions = router.getRegisteredActions().slice().sort();
        assert.equal(registeredActions.includes('toggle-timeline-item'), true);
        assert.equal(registeredActions.includes('change-contact-history-page'), true);
        assert.equal(typeof globalThis.kiwiContactHistorySlice.displayContactHistory, 'function');

        const changePageElement = {
            dataset: {
                action: 'change-contact-history-page',
                actionEvent: 'click',
                argNewPage: '2'
            }
        };
        listeners.click(createDelegatedEvent(changePageElement, 'click'));
        assert.equal(contactHistoryState.currentPage, 2);

        const toggleItemElement = {
            dataset: {
                action: 'toggle-timeline-item',
                actionEvent: 'click',
                argEntryDomId: 'row-1'
            }
        };
        listeners.click(createDelegatedEvent(toggleItemElement, 'click'));
        assert.equal(contentNode.classList.contains('expanded'), false);
        assert.equal(expandNode.classList.contains('expanded'), false);
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }

        if (previousContactHistoryNamespace === undefined) {
            delete globalThis.kiwiContactHistorySlice;
        } else {
            globalThis.kiwiContactHistorySlice = previousContactHistoryNamespace;
        }

        configureContactHistorySliceDependencies(null);
    }
}

async function testCustomerDetailSlice() {
    const listeners = {};
    const root = {
        addEventListener(eventType, handler) {
            listeners[eventType] = handler;
        },
        removeEventListener(eventType) {
            delete listeners[eventType];
        }
    };

    const previousDocument = globalThis.document;
    const previousScrollTo = globalThis.scrollTo;
    const previousCustomerDetailNamespace = globalThis.kiwiCustomerDetailSlice;
    const previousContactHistoryNamespace = globalThis.kiwiContactHistorySlice;
    const previousKiwiApi = globalThis.kiwiApi;

    const cachedCustomer = {
        id: 81,
        salutation: 'Dhr.',
        firstName: 'Jan',
        middleName: '',
        lastName: 'Jansen',
        address: 'Dorpsstraat 1',
        postalCode: '1234AB',
        city: 'Hilversum',
        email: 'jan@example.com',
        phone: '0612345678',
        subscriptions: [],
        contactHistory: []
    };

    const contactHistoryState = {
        currentPage: 3,
        itemsPerPage: 6,
        highlightId: 'x',
        lastEntry: { id: 'x' }
    };
    let currentCustomer = null;
    let resetContactHistoryViewStateCalls = 0;
    let displayArticlesCalls = 0;
    let updateCustomerActionButtonsCalls = 0;
    let updateIdentifyCallerButtonsCalls = 0;
    let scrollToCalls = 0;

    const elements = {
        welcomeMessage: { style: { display: 'block' } },
        searchResultsView: { style: { display: 'block' } },
        customerDetail: {
            style: { display: 'none' },
            querySelector() {
                return null;
            }
        },
        customerName: { textContent: '' },
        customerAddress: { textContent: '' },
        customerEmail: { textContent: '' },
        customerPhone: { textContent: '' },
        subscriptionsList: { innerHTML: '' },
        contactHistory: { innerHTML: '' }
    };

    const customerDetailDependencies = {
        findCustomerById(customerId) {
            return Number(customerId) === cachedCustomer.id ? cachedCustomer : null;
        },
        upsertCustomerInCache() {},
        getCurrentCustomer() {
            return currentCustomer;
        },
        setCurrentCustomer(customer) {
            currentCustomer = customer;
        },
        getContactHistoryState() {
            return contactHistoryState;
        },
        resetContactHistoryViewState() {
            resetContactHistoryViewStateCalls += 1;
            contactHistoryState.currentPage = 1;
            contactHistoryState.highlightId = null;
            contactHistoryState.lastEntry = null;
        },
        translate(_key, _params, fallback) {
            return fallback;
        },
        showToast() {},
        displayArticles() {
            displayArticlesCalls += 1;
        },
        updateCustomerActionButtons() {
            updateCustomerActionButtonsCalls += 1;
        },
        updateIdentifyCallerButtons() {
            updateIdentifyCallerButtonsCalls += 1;
        },
        getSubscriptionRequesterMetaLine() {
            return '';
        },
        getDateLocaleForApp() {
            return 'nl-NL';
        },
        personsApiUrl: '/api/v1/persons'
    };
    configureContactHistorySliceDependencies(() => customerDetailDependencies);
    configureCustomerDetailSliceDependencies(() => customerDetailDependencies);
    globalThis.document = {
        getElementById(id) {
            return elements[id] || null;
        },
        querySelector() {
            return null;
        }
    };
    globalThis.scrollTo = () => {
        scrollToCalls += 1;
    };
    delete globalThis.kiwiApi;

    try {
        const router = createActionRouter({
            root,
            eventTypes: ['click']
        });
        registerContactHistorySlice(router);
        registerCustomerDetailSlice(router);
        router.install();

        const registeredActions = router.getRegisteredActions().slice().sort();
        assert.equal(registeredActions.includes('select-customer'), true);
        assert.equal(typeof globalThis.kiwiCustomerDetailSlice.selectCustomer, 'function');

        const selectCustomerElement = {
            dataset: {
                action: 'select-customer',
                actionEvent: 'click',
                argCustomerId: '81'
            }
        };
        listeners.click(createDelegatedEvent(selectCustomerElement, 'click'));
        await Promise.resolve();

        assert.equal(currentCustomer.id, 81);
        assert.equal(resetContactHistoryViewStateCalls, 1);
        assert.equal(displayArticlesCalls, 1);
        assert.equal(updateCustomerActionButtonsCalls, 1);
        assert.equal(updateIdentifyCallerButtonsCalls, 1);
        assert.equal(scrollToCalls, 1);
        assert.equal(elements.welcomeMessage.style.display, 'none');
        assert.equal(elements.searchResultsView.style.display, 'none');
        assert.equal(elements.customerDetail.style.display, 'block');
        assert.equal(elements.customerName.textContent, 'Dhr. Jan Jansen');
        assert.equal(elements.subscriptionsList.innerHTML.includes('Geen abonnementen'), true);
        assert.equal(elements.contactHistory.innerHTML.includes('Geen contactgeschiedenis beschikbaar'), true);
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }

        if (previousScrollTo === undefined) {
            delete globalThis.scrollTo;
        } else {
            globalThis.scrollTo = previousScrollTo;
        }

        if (previousCustomerDetailNamespace === undefined) {
            delete globalThis.kiwiCustomerDetailSlice;
        } else {
            globalThis.kiwiCustomerDetailSlice = previousCustomerDetailNamespace;
        }

        if (previousContactHistoryNamespace === undefined) {
            delete globalThis.kiwiContactHistorySlice;
        } else {
            globalThis.kiwiContactHistorySlice = previousContactHistoryNamespace;
        }

        if (previousKiwiApi === undefined) {
            delete globalThis.kiwiApi;
        } else {
            globalThis.kiwiApi = previousKiwiApi;
        }

        configureContactHistorySliceDependencies(null);
        configureCustomerDetailSliceDependencies(null);
    }
}

async function run() {
    testCoerceActionValue();
    testExtractActionPayload();
    testRouterDispatch();
    testCallQueueAgentStatusSlices();
    testLocalizationSlice();
    testContactHistorySlice();
    await testCustomerDetailSlice();
    console.log('actions router tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
