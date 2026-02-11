import assert from 'node:assert/strict';
import { coerceActionValue, createActionRouter, extractActionPayload } from './actions.js';

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

function run() {
    testCoerceActionValue();
    testExtractActionPayload();
    testRouterDispatch();
    console.log('actions router tests passed');
}

run();
