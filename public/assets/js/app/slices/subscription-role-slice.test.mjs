import assert from 'node:assert/strict';

import { createActionRouter } from '../actions.js';
import { registerSubscriptionRoleSlice } from './subscription-role-slice.js';

function createDelegatedEvent(actionElement, eventType, overrides = {}) {
    return {
        type: eventType,
        key: overrides.key,
        target: {
            closest(selector) {
                if (selector === '[data-action]') {
                    return actionElement;
                }
                return null;
            }
        },
        stopPropagation: overrides.stopPropagation || (() => {}),
        preventDefault: overrides.preventDefault || (() => {})
    };
}

function createActionRouterHarness() {
    const listeners = {};
    const root = {
        addEventListener(eventType, listener) {
            listeners[eventType] = listener;
        },
        removeEventListener(eventType) {
            delete listeners[eventType];
        }
    };

    const router = createActionRouter({
        root,
        eventTypes: ['click', 'change']
    });

    registerSubscriptionRoleSlice(router);
    router.install();

    return { listeners, router };
}

function testSubscriptionRoleSliceRegistersExpectedActions() {
    const { router } = createActionRouterHarness();

    const expectedActions = [
        'toggle-customer-form-address',
        'set-subscription-role-mode',
        'search-subscription-role-person',
        'toggle-requester-same-as-recipient',
        'select-subscription-duplicate-person',
        'toggle-subscription-duplicate-matches',
        'acknowledge-subscription-duplicate-warning',
        'select-subscription-role-person'
    ];

    assert.deepEqual(
        router.getRegisteredActions().slice().sort(),
        expectedActions.slice().sort()
    );
}

function testSubscriptionRoleSliceDispatchesRuntimeMethods() {
    const previousRuntime = globalThis.kiwiSubscriptionRoleRuntime;
    const observedCalls = [];

    globalThis.kiwiSubscriptionRoleRuntime = {
        acknowledgeSubscriptionDuplicateWarning: (...args) => observedCalls.push({ method: 'acknowledgeSubscriptionDuplicateWarning', args }),
        searchSubscriptionRolePerson: (...args) => observedCalls.push({ method: 'searchSubscriptionRolePerson', args }),
        selectSubscriptionDuplicatePerson: (...args) => observedCalls.push({ method: 'selectSubscriptionDuplicatePerson', args }),
        selectSubscriptionRolePerson: (...args) => observedCalls.push({ method: 'selectSubscriptionRolePerson', args }),
        setSubscriptionRoleMode: (...args) => observedCalls.push({ method: 'setSubscriptionRoleMode', args }),
        toggleCustomerFormAddress: (...args) => observedCalls.push({ method: 'toggleCustomerFormAddress', args }),
        toggleRequesterSameAsRecipient: (...args) => observedCalls.push({ method: 'toggleRequesterSameAsRecipient', args }),
        toggleSubscriptionDuplicateMatches: (...args) => observedCalls.push({ method: 'toggleSubscriptionDuplicateMatches', args })
    };

    try {
        const { listeners } = createActionRouterHarness();

        listeners.change(createDelegatedEvent({
            dataset: {
                action: 'toggle-customer-form-address',
                argPrefix: 'subRequester'
            }
        }, 'change'));

        listeners.change(createDelegatedEvent({
            dataset: {
                action: 'set-subscription-role-mode',
                argRole: 'recipient',
                value: 'create'
            },
            value: 'create'
        }, 'change'));

        listeners.click(createDelegatedEvent({
            dataset: {
                action: 'search-subscription-role-person',
                argRole: 'requester'
            }
        }, 'click'));

        listeners.click(createDelegatedEvent({
            dataset: {
                action: 'toggle-requester-same-as-recipient'
            }
        }, 'click'));

        listeners.click(createDelegatedEvent({
            dataset: {
                action: 'select-subscription-duplicate-person',
                argRole: 'requester',
                argPersonId: '82'
            }
        }, 'click'));

        listeners.click(createDelegatedEvent({
            dataset: {
                action: 'toggle-subscription-duplicate-matches',
                argRole: 'recipient'
            }
        }, 'click'));

        listeners.click(createDelegatedEvent({
            dataset: {
                action: 'acknowledge-subscription-duplicate-warning',
                argRole: 'recipient'
            }
        }, 'click'));

        listeners.click(createDelegatedEvent({
            dataset: {
                action: 'select-subscription-role-person',
                argRole: 'recipient',
                argPersonId: '51'
            }
        }, 'click'));

        listeners.click(createDelegatedEvent({
            dataset: {
                action: 'set-subscription-role-mode',
                argRole: 'invalid',
                value: 'create'
            },
            value: 'create'
        }, 'click'));

        listeners.click(createDelegatedEvent({
            dataset: {
                action: 'select-subscription-role-person',
                argRole: 'recipient',
                argPersonId: 'invalid'
            }
        }, 'click'));

        assert.deepEqual(observedCalls, [
            { method: 'toggleCustomerFormAddress', args: ['subRequester'] },
            { method: 'setSubscriptionRoleMode', args: ['recipient', 'create'] },
            { method: 'searchSubscriptionRolePerson', args: ['requester'] },
            { method: 'toggleRequesterSameAsRecipient', args: [] },
            { method: 'selectSubscriptionDuplicatePerson', args: ['requester', 82] },
            { method: 'toggleSubscriptionDuplicateMatches', args: ['recipient'] },
            { method: 'acknowledgeSubscriptionDuplicateWarning', args: ['recipient'] },
            { method: 'selectSubscriptionRolePerson', args: ['recipient', 51] }
        ]);
    } finally {
        if (previousRuntime === undefined) {
            delete globalThis.kiwiSubscriptionRoleRuntime;
        } else {
            globalThis.kiwiSubscriptionRoleRuntime = previousRuntime;
        }
    }
}

function run() {
    testSubscriptionRoleSliceRegistersExpectedActions();
    testSubscriptionRoleSliceDispatchesRuntimeMethods();
    console.log('subscription role slice tests passed');
}

run();
