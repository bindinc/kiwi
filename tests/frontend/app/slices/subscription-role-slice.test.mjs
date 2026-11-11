import assert from 'node:assert/strict';

import { createActionRouter } from '../../../../assets/js/app/actions.js';
import { registerSubscriptionRoleSlice } from '../../../../assets/js/app/slices/subscription-role-slice.js';

function createDelegatedEvent(actionElement, eventType, overrides = {}) {
    return {
        type: eventType,
        key: overrides.key,
        keyCode: overrides.keyCode,
        target: {
            tagName: overrides.targetTagName,
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
        eventTypes: ['click', 'change', 'keydown']
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
        'search-subscription-role-person-keypress',
        'toggle-requester-same-as-recipient',
        'use-active-customer-for-subscription-role',
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
        toggleSubscriptionDuplicateMatches: (...args) => observedCalls.push({ method: 'toggleSubscriptionDuplicateMatches', args }),
        useActiveCustomerForSubscriptionRole: (...args) => observedCalls.push({ method: 'useActiveCustomerForSubscriptionRole', args })
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

        listeners.keydown(createDelegatedEvent({
            dataset: {
                action: 'search-subscription-role-person-keypress',
                argRole: 'recipient'
            }
        }, 'keydown', { key: 'Tab' }));

        listeners.keydown(createDelegatedEvent({
            dataset: {
                action: 'search-subscription-role-person-keypress',
                argRole: 'recipient'
            }
        }, 'keydown', { key: 'Enter', targetTagName: 'INPUT' }));

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
            { method: 'searchSubscriptionRolePerson', args: ['recipient'] },
            { method: 'toggleRequesterSameAsRecipient', args: [] },
            { method: 'selectSubscriptionDuplicatePerson', args: ['requester', 82] },
            { method: 'toggleSubscriptionDuplicateMatches', args: ['recipient'] },
            { method: 'acknowledgeSubscriptionDuplicateWarning', args: ['recipient'] },
            { method: 'selectSubscriptionRolePerson', args: ['recipient', 51] }
        ]);

        listeners.click(createDelegatedEvent({ dataset: {
            action: 'use-active-customer-for-subscription-role', argRole: 'requester'
        } }, 'click'));
        listeners.click(createDelegatedEvent({ dataset: {
            action: 'select-subscription-role-person', argRole: 'recipient', argPersonId: '51', argResultIndex: '1'
        } }, 'click'));
        assert.deepEqual(observedCalls.slice(-2), [
            { method: 'useActiveCustomerForSubscriptionRole', args: ['requester'] },
            { method: 'selectSubscriptionRolePerson', args: ['recipient', 51, 1] }
        ]);
    } finally {
        if (previousRuntime === undefined) {
            delete globalThis.kiwiSubscriptionRoleRuntime;
        } else {
            globalThis.kiwiSubscriptionRoleRuntime = previousRuntime;
        }
    }
}

function testSearchShortcutOnlyHandlesEnterFromInputs() {
    const previousRuntime = globalThis.kiwiSubscriptionRoleRuntime;
    const searchedRoles = [];
    globalThis.kiwiSubscriptionRoleRuntime = {
        searchSubscriptionRolePerson: role => searchedRoles.push(role)
    };

    try {
        const { listeners } = createActionRouterHarness();
        for (const role of ['recipient', 'requester']) {
            const wrapper = { tagName: 'DIV', dataset: {
                action: 'search-subscription-role-person-keypress', actionEvent: 'keydown', argRole: role
            } };
            for (const key of [{ key: 'Enter' }, { keyCode: 13 }]) {
                let prevented = 0;
                const callsBefore = searchedRoles.length;
                listeners.keydown(createDelegatedEvent(wrapper, 'keydown', {
                    ...key, targetTagName: 'INPUT', preventDefault: () => prevented++
                }));
                assert.deepEqual(searchedRoles.slice(callsBefore), [role]);
                assert.equal(prevented, 1);
            }

            for (const tagName of ['SUMMARY', 'BUTTON', 'SELECT', 'TEXTAREA', 'DIV']) {
                for (const key of ['Enter', ' ']) {
                    let prevented = 0;
                    const callsBefore = searchedRoles.length;
                    listeners.keydown(createDelegatedEvent(wrapper, 'keydown', {
                        key, targetTagName: tagName, preventDefault: () => prevented++
                    }));
                    assert.equal(prevented, 0, `${role} ${tagName} ${key} retains native behavior`);
                    assert.equal(searchedRoles.length, callsBefore);
                }
            }

            const searchButton = { tagName: 'BUTTON', dataset: {
                action: 'search-subscription-role-person', argRole: role
            } };
            let buttonPrevented = 0;
            const callsBeforeButton = searchedRoles.length;
            listeners.keydown(createDelegatedEvent(searchButton, 'keydown', {
                key: 'Enter', targetTagName: 'BUTTON', preventDefault: () => buttonPrevented++
            }));
            assert.equal(buttonPrevented, 0);
            assert.equal(searchedRoles.length, callsBeforeButton);
            listeners.click(createDelegatedEvent(searchButton, 'click', { targetTagName: 'BUTTON' }));
            assert.deepEqual(searchedRoles.slice(callsBeforeButton), [role]);

            for (const key of ['Tab', ' ', 'Escape']) {
                let prevented = 0;
                const callsBefore = searchedRoles.length;
                listeners.keydown(createDelegatedEvent(wrapper, 'keydown', {
                    key, targetTagName: 'INPUT', preventDefault: () => prevented++
                }));
                assert.equal(prevented, 0);
                assert.equal(searchedRoles.length, callsBefore);
            }
        }
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
    testSearchShortcutOnlyHandlesEnterFromInputs();
    console.log('subscription role slice tests passed');
}

run();
