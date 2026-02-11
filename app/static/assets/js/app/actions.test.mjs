import assert from 'node:assert/strict';
import { coerceActionValue, createActionRouter, extractActionPayload } from './actions.js';
import { registerCallQueueAgentStatusSlices } from './slices/index.js';

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

    const actionElement = {
        dataset: {
            action: 'select-customer',
            argCustomerId: '81'
        }
    };
    const event = {
        type: 'click',
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
    const legacyFunctionNames = [
        'toggleStatusMenu',
        'setAgentStatus',
        'identifyCallerAsCustomer',
        'updateDispositionOutcomes',
        'debugGenerateQueue'
    ];
    const previousHandlers = new Map();

    for (const functionName of legacyFunctionNames) {
        previousHandlers.set(functionName, globalThis[functionName]);
        globalThis[functionName] = (...args) => {
            observedCalls.push({ functionName, args });
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
        assert.equal(observedCalls[0].functionName, 'toggleStatusMenu');
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
            functionName: 'setAgentStatus',
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
            functionName: 'identifyCallerAsCustomer',
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
            functionName: 'updateDispositionOutcomes',
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
            functionName: 'debugGenerateQueue',
            args: []
        });
    } finally {
        for (const functionName of legacyFunctionNames) {
            const previousHandler = previousHandlers.get(functionName);
            if (previousHandler === undefined) {
                delete globalThis[functionName];
            } else {
                globalThis[functionName] = previousHandler;
            }
        }
    }
}

function run() {
    testCoerceActionValue();
    testExtractActionPayload();
    testRouterDispatch();
    testCallQueueAgentStatusSlices();
    console.log('actions router tests passed');
}

run();
