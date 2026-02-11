function getLegacyFunction(functionName) {
    if (typeof window === 'undefined') {
        return null;
    }

    const candidate = window[functionName];
    return typeof candidate === 'function' ? candidate : null;
}

function callLegacy(functionName, ...args) {
    const legacyFunction = getLegacyFunction(functionName);
    if (!legacyFunction) {
        console.warn(`[kiwi-actions] Missing legacy handler "${functionName}"`);
        return undefined;
    }

    return legacyFunction(...args);
}

export function registerCustomerSubscriptionActions(actionRouter) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'identify-current-customer-as-caller': () => {
            callLegacy('identifyCurrentCustomerAsCaller');
        },
        'close-form': (payload) => {
            callLegacy('closeForm', payload.formId);
        },
        'identify-caller-as-customer': (payload) => {
            callLegacy('identifyCallerAsCustomer', payload.customerId);
        }
    });
}
