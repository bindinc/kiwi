import { createSubscriptionRoleRuntimeClient } from './subscription-role-runtime-client.js';

function isSupportedRole(role) {
    return role === 'recipient' || role === 'requester';
}

function parsePersonId(rawValue) {
    const personId = Number(rawValue);
    return Number.isFinite(personId) ? personId : null;
}

function resolveRoleMode(payload, context) {
    if (payload && typeof payload.mode === 'string' && payload.mode) {
        return payload.mode;
    }

    if (context && context.element && typeof context.element.value === 'string') {
        return context.element.value;
    }

    return 'existing';
}

export function registerSubscriptionRoleSlice(actionRouter, options = {}) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    const runtime = createSubscriptionRoleRuntimeClient(options);

    actionRouter.registerMany({
        'toggle-customer-form-address': (payload) => {
            if (!payload.prefix) {
                return;
            }
            runtime.toggleCustomerFormAddress(payload.prefix);
        },
        'set-subscription-role-mode': (payload, context) => {
            if (!isSupportedRole(payload.role)) {
                return;
            }
            runtime.setSubscriptionRoleMode(payload.role, resolveRoleMode(payload, context));
        },
        'search-subscription-role-person': (payload) => {
            if (!isSupportedRole(payload.role)) {
                return;
            }
            runtime.searchSubscriptionRolePerson(payload.role);
        },
        'toggle-requester-same-as-recipient': () => {
            runtime.toggleRequesterSameAsRecipient();
        },
        'select-subscription-duplicate-person': (payload) => {
            if (!isSupportedRole(payload.role)) {
                return;
            }

            const personId = parsePersonId(payload.personId);
            if (personId === null) {
                return;
            }

            runtime.selectSubscriptionDuplicatePerson(payload.role, personId);
        },
        'toggle-subscription-duplicate-matches': (payload) => {
            if (!isSupportedRole(payload.role)) {
                return;
            }
            runtime.toggleSubscriptionDuplicateMatches(payload.role);
        },
        'acknowledge-subscription-duplicate-warning': (payload) => {
            if (!isSupportedRole(payload.role)) {
                return;
            }
            runtime.acknowledgeSubscriptionDuplicateWarning(payload.role);
        },
        'select-subscription-role-person': (payload) => {
            if (!isSupportedRole(payload.role)) {
                return;
            }

            const personId = parsePersonId(payload.personId);
            if (personId === null) {
                return;
            }

            runtime.selectSubscriptionRolePerson(payload.role, personId);
        }
    });
}
