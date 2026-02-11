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

function readStepFromPayload(payload, context) {
    if (payload.step !== undefined) {
        return payload.step;
    }

    return context?.element?.dataset?.argStep;
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
        'complete-restitution-transfer': (_payload, context) => {
            callLegacy('completeRestitutionTransfer', context.event);
        },
        'toggle-restitution-transfer-address': () => {
            callLegacy('toggleRestitutionTransferAddress');
        },
        'winback-next-step': (payload, context) => {
            callLegacy('winbackNextStep', readStepFromPayload(payload, context));
        },
        'winback-prev-step': (payload, context) => {
            callLegacy('winbackPrevStep', readStepFromPayload(payload, context));
        },
        'process-deceased-subscriptions': () => {
            callLegacy('processDeceasedSubscriptions');
        },
        'complete-all-deceased-actions': () => {
            callLegacy('completeAllDeceasedActions');
        },
        'complete-winback': () => {
            callLegacy('completeWinback');
        },
        'select-customer': (payload) => {
            callLegacy('selectCustomer', payload.customerId);
        },
        'identify-caller-as-customer': (payload) => {
            callLegacy('identifyCallerAsCustomer', payload.customerId);
        },
        'cancel-subscription': (payload) => {
            callLegacy('cancelSubscription', payload.subId);
        },
        'start-winback-for-subscription': (payload) => {
            callLegacy('startWinbackForSubscription', payload.subId);
        },
        'revert-restitution': (payload) => {
            callLegacy('revertRestitution', payload.subId);
        },
        'change-contact-history-page': (payload) => {
            callLegacy('changeContactHistoryPage', payload.newPage);
        },
        'toggle-timeline-item': (payload) => {
            callLegacy('toggleTimelineItem', payload.entryDomId);
        },
        'select-offer': (payload, context) => {
            callLegacy('selectOffer', payload.offerId, payload.title, payload.description, context.event);
        }
    });
}
