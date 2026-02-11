function resolveCustomerId(payload) {
    if (!payload || payload.customerId === undefined || payload.customerId === null || payload.customerId === '') {
        return null;
    }

    return payload.customerId;
}

export function registerCallSessionSlice(actionRouter, runtime) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function' || !runtime) {
        return;
    }

    actionRouter.registerMany({
        'call-session.toggle-hold'() {
            runtime.toggleCallHold();
        },
        'call-session.end'() {
            runtime.endCallSession();
        },
        'call-session.identify-current-customer'() {
            runtime.identifyCurrentCustomerAsCaller();
        },
        'call-session.identify-caller'(payload, context) {
            if (context.event && typeof context.event.stopPropagation === 'function') {
                context.event.stopPropagation();
            }

            const customerId = resolveCustomerId(payload);
            if (customerId === null) {
                return;
            }

            runtime.identifyCallerAsCustomer(customerId);
        }
    });
}
