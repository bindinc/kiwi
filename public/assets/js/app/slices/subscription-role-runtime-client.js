import { getGlobalScope } from '../services.js';

const RUNTIME_NAMESPACE = 'kiwiSubscriptionRoleRuntime';

function resolveRuntimeMethod(methodName) {
    if (typeof methodName !== 'string' || methodName.length === 0) {
        return null;
    }

    const globalScope = getGlobalScope();
    if (!globalScope) {
        return null;
    }

    const runtimeNamespace = globalScope[RUNTIME_NAMESPACE];
    if (runtimeNamespace && typeof runtimeNamespace[methodName] === 'function') {
        return runtimeNamespace[methodName].bind(runtimeNamespace);
    }

    const fallbackMethod = globalScope[methodName];
    if (typeof fallbackMethod === 'function') {
        return fallbackMethod;
    }

    return null;
}

export function createSubscriptionRoleRuntimeClient(options = {}) {
    const logger = options.logger || (typeof console !== 'undefined' ? console : null);
    const logPrefix = options.logPrefix || '[kiwi-actions]';

    function invoke(methodName, args = []) {
        const runtimeMethod = resolveRuntimeMethod(methodName);
        if (!runtimeMethod) {
            if (logger && typeof logger.warn === 'function') {
                logger.warn(`${logPrefix} Missing subscription-role runtime handler "${methodName}"`);
            }
            return;
        }

        runtimeMethod(...args);
    }

    function invokeAsync(methodName, args = []) {
        const runtimeMethod = resolveRuntimeMethod(methodName);
        if (!runtimeMethod) {
            if (logger && typeof logger.warn === 'function') {
                logger.warn(`${logPrefix} Missing subscription-role runtime handler "${methodName}"`);
            }
            return;
        }

        Promise.resolve(runtimeMethod(...args)).catch((error) => {
            if (logger && typeof logger.error === 'function') {
                logger.error(`${logPrefix} Subscription-role runtime handler "${methodName}" failed.`, error);
            }
        });
    }

    return {
        acknowledgeSubscriptionDuplicateWarning(role) {
            invoke('acknowledgeSubscriptionDuplicateWarning', [role]);
        },
        searchSubscriptionRolePerson(role) {
            invokeAsync('searchSubscriptionRolePerson', [role]);
        },
        selectSubscriptionDuplicatePerson(role, personId) {
            invoke('selectSubscriptionDuplicatePerson', [role, personId]);
        },
        selectSubscriptionRolePerson(role, personId) {
            invoke('selectSubscriptionRolePerson', [role, personId]);
        },
        setSubscriptionRoleMode(role, mode) {
            invoke('setSubscriptionRoleMode', [role, mode]);
        },
        toggleCustomerFormAddress(prefix) {
            invoke('toggleCustomerFormAddress', [prefix]);
        },
        toggleRequesterSameAsRecipient() {
            invoke('toggleRequesterSameAsRecipient');
        },
        toggleSubscriptionDuplicateMatches(role) {
            invoke('toggleSubscriptionDuplicateMatches', [role]);
        }
    };
}
