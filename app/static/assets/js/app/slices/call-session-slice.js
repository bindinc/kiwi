function resolveCustomerId(payload) {
    if (!payload || payload.customerId === undefined || payload.customerId === null || payload.customerId === '') {
        return null;
    }

    return payload.customerId;
}

export function registerCallSessionSlice(actionRouter, bridge) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function' || !bridge) {
        return;
    }

    actionRouter.registerMany({
        'call-session.toggle-hold'() {
            bridge.invoke('toggleCallHold');
        },
        'call-session.end'() {
            bridge.invoke('endCallSession');
        },
        'call-session.identify-current-customer'() {
            bridge.invoke('identifyCurrentCustomerAsCaller');
        },
        'call-session.identify-caller'(payload, context) {
            if (context.event && typeof context.event.stopPropagation === 'function') {
                context.event.stopPropagation();
            }

            const customerId = resolveCustomerId(payload);
            if (customerId === null) {
                return;
            }

            bridge.invoke('identifyCallerAsCustomer', [customerId]);
        }
    });
}
