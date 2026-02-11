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
        'search-handle-keypress': (_payload, context) => {
            callLegacy('handleSearchKeyPress', context.event);
        },
        'toggle-additional-filters': () => {
            callLegacy('toggleAdditionalFilters');
        },
        'search-customer': () => {
            callLegacy('searchCustomer');
        },
        'scroll-to-results': () => {
            callLegacy('scrollToResults');
        },
        'show-new-subscription': () => {
            callLegacy('showNewSubscription');
        },
        'sort-results': (_payload, context) => {
            callLegacy('sortResults', context.element ? context.element.value : undefined);
        },
        'clear-search-results': () => {
            callLegacy('clearSearchResults');
        },
        'identify-current-customer-as-caller': () => {
            callLegacy('identifyCurrentCustomerAsCaller');
        },
        'edit-customer': () => {
            callLegacy('editCustomer');
        },
        'show-resend-magazine': () => {
            callLegacy('showResendMagazine');
        },
        'show-editorial-complaint-form': () => {
            callLegacy('showEditorialComplaintForm');
        },
        'close-customer-detail': () => {
            callLegacy('closeCustomerDetail');
        },
        'close-form': (payload) => {
            callLegacy('closeForm', payload.formId);
        },
        'create-subscription': (_payload, context) => {
            callLegacy('createSubscription', context.event);
        },
        'set-subscription-role-mode': (payload, context) => {
            callLegacy('setSubscriptionRoleMode', payload.role, context.element ? context.element.value : undefined);
        },
        'search-subscription-role-person': (payload) => {
            callLegacy('searchSubscriptionRolePerson', payload.role);
        },
        'toggle-requester-same-as-recipient': () => {
            callLegacy('toggleRequesterSameAsRecipient');
        },
        'save-customer-edit': (_payload, context) => {
            callLegacy('saveCustomerEdit', context.event);
        },
        'save-subscription-edit': (_payload, context) => {
            callLegacy('saveSubscriptionEdit', context.event);
        },
        'resend-magazine': () => {
            callLegacy('resendMagazine');
        },
        'submit-editorial-complaint': () => {
            callLegacy('submitEditorialComplaint');
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
        'toggle-customer-form-address': (payload) => {
            callLegacy('toggleCustomerFormAddress', payload.prefix);
        },
        'select-subscription-duplicate-person': (payload) => {
            callLegacy('selectSubscriptionDuplicatePerson', payload.role, payload.personId);
        },
        'toggle-subscription-duplicate-matches': (payload) => {
            callLegacy('toggleSubscriptionDuplicateMatches', payload.role);
        },
        'acknowledge-subscription-duplicate-warning': (payload) => {
            callLegacy('acknowledgeSubscriptionDuplicateWarning', payload.role);
        },
        'select-subscription-role-person': (payload) => {
            callLegacy('selectSubscriptionRolePerson', payload.role, payload.personId);
        },
        'identify-caller-as-customer': (payload) => {
            callLegacy('identifyCallerAsCustomer', payload.customerId);
        },
        'go-to-page': (payload) => {
            callLegacy('goToPage', payload.page);
        },
        'edit-subscription': (payload) => {
            callLegacy('editSubscription', payload.subId);
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
        'select-offer': (payload, context) => {
            callLegacy('selectOffer', payload.offerId, payload.title, payload.description, context.event);
        }
    });
}
