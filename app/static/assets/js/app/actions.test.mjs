import assert from 'node:assert/strict';
import { coerceActionValue, createActionRouter, extractActionPayload } from './actions.js';
import { registerCallQueueAgentStatusSlices } from './slices/index.js';
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

function run() {
    testCoerceActionValue();
    testExtractActionPayload();
    testRouterDispatch();
    testCallQueueAgentStatusSlices();
    testLocalizationSlice();
    console.log('actions router tests passed');
}

run();
