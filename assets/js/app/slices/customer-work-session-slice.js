import {
    createCustomerDisplaySummary,
    createCustomerWorkSession
} from '../customer-work-session.js';
import { getGlobalScope } from '../services.js';

const CUSTOMER_WORK_SESSION_NAMESPACE = 'kiwiCustomerWorkSession';
const customerWorkSession = createCustomerWorkSession();
let dependenciesResolver = null;

export function configureCustomerWorkSessionSliceDependencies(resolver) {
    dependenciesResolver = typeof resolver === 'function' ? resolver : null;
}

function resolveDependencies() {
    if (!dependenciesResolver) {
        return null;
    }

    const dependencies = dependenciesResolver();
    return dependencies && typeof dependencies === 'object' ? dependencies : null;
}

function translate(key, fallback, params = {}) {
    const dependencies = resolveDependencies();
    if (dependencies && typeof dependencies.translate === 'function') {
        return dependencies.translate(key, params, fallback);
    }
    return fallback;
}

function showToast(message, type) {
    const dependencies = resolveDependencies();
    if (dependencies && typeof dependencies.showToast === 'function') {
        dependencies.showToast(message, type);
    }
}

function getElement(elementId) {
    if (typeof document === 'undefined') {
        return null;
    }
    return document.getElementById(elementId);
}

function setText(elementId, value) {
    const element = getElement(elementId);
    if (element) {
        element.textContent = value;
    }
}

function setHidden(elementId, hidden) {
    const element = getElement(elementId);
    if (element) {
        element.hidden = hidden;
    }
}

function renderCustomerWorkSession() {
    const snapshot = customerWorkSession.getSnapshot();
    const summary = createCustomerDisplaySummary(snapshot.activeCustomer);
    const hasActiveCustomer = Boolean(snapshot.customerReference && summary);

    setHidden('customerWorkSessionBar', !hasActiveCustomer);
    if (!hasActiveCustomer) {
        return;
    }

    setText('customerWorkSessionName', summary.name);
    setText('customerWorkSessionPersonId', summary.personId);
    setText('customerWorkSessionSource', summary.sourceLabel);

    const endButton = getElement('endCustomerWorkSessionButton');
    if (endButton) {
        endButton.disabled = snapshot.resetBlocked;
        endButton.setAttribute('aria-disabled', String(snapshot.resetBlocked));
    }

    setHidden('customerWorkSessionPendingMutation', !snapshot.resetBlocked);
}

export function startCustomerSelection(customer) {
    const context = customerWorkSession.startCustomerSelection(customer);
    if (context.blocked) {
        const activeCustomerMessage = translate(
            'customerWorkSession.activeCustomerBlocksSelection',
            'Beëindig eerst de huidige klantwerksessie voordat je een andere klant opent.'
        );
        showToast(
            context.reason === 'active_customer'
                ? activeCustomerMessage
                : translate(
                    'customerWorkSession.resetBlocked',
                    'Wacht totdat de lopende aanvraag een duidelijke status heeft.'
                ),
            'warning'
        );
        return context;
    }

    renderCustomerWorkSession();
    return context;
}

export function confirmCustomerSelection(context, customer) {
    const confirmed = customerWorkSession.confirmCustomer(context, customer);
    if (confirmed) {
        renderCustomerWorkSession();
    }
    return confirmed;
}

export function abandonCustomerSelection(context) {
    const abandoned = customerWorkSession.abandonCustomerSelection(context);
    if (abandoned) {
        renderCustomerWorkSession();
    }
    return abandoned;
}

export function isCustomerContextCurrent(context) {
    return customerWorkSession.isCurrent(context);
}

export function beginCustomerMutation(submissionId) {
    const context = customerWorkSession.beginMutation(submissionId);
    renderCustomerWorkSession();
    return context;
}

export function finishCustomerMutation(submissionId, options = {}) {
    customerWorkSession.finishMutation(submissionId, options);
    renderCustomerWorkSession();
}

export function resolveCustomerMutation(submissionId) {
    customerWorkSession.resolveMutation(submissionId);
    renderCustomerWorkSession();
}

export function getCustomerRequestContext() {
    return customerWorkSession.getRequestContext();
}

export function getCustomerRequestHeaders() {
    return customerWorkSession.getRequestHeaders();
}

export function showQueuedCustomerChoice(details = {}) {
    const count = Number(details.queuedCount) || 1;
    setText(
        'queuedCustomerChoiceStatus',
        count === 1
            ? translate('customerWorkSession.queuedOne', '1 aanvraag staat in de wachtrij.')
            : translate(
                'customerWorkSession.queuedMany',
                `${count} aanvragen staan in de wachtrij.`,
                { count }
            )
    );
    setText('queuedCustomerChoiceRecipient', details.recipientLabel || '—');
    setText('queuedCustomerChoiceRequester', details.requesterLabel || details.recipientLabel || '—');
    setHidden('queuedCustomerChoice', false);
}

export function continueCustomerWorkSession() {
    setHidden('queuedCustomerChoice', true);
}

export async function endCustomerWorkSession() {
    if (customerWorkSession.hasBlockingMutation()) {
        showToast(
            translate(
                'customerWorkSession.resetBlocked',
                'Wacht totdat de lopende aanvraag een duidelijke status heeft.'
            ),
            'warning'
        );
        return false;
    }

    const context = customerWorkSession.getRequestContext();
    const dependencies = resolveDependencies();
    const apiClient = dependencies && typeof dependencies.getApiClient === 'function'
        ? dependencies.getApiClient()
        : null;

    if (context.customerReference && apiClient && typeof apiClient.post === 'function') {
        try {
            await apiClient.post('/api/v1/customer-work-sessions/reset', context);
        } catch (error) {
            showToast(
                translate(
                    'customerWorkSession.resetFailed',
                    'De klantwerksessie kon niet veilig worden beëindigd.'
                ),
                'error'
            );
            return false;
        }
    }

    const reset = customerWorkSession.reset();
    if (!reset) {
        return false;
    }

    if (dependencies && typeof dependencies.resetCustomerBoundState === 'function') {
        dependencies.resetCustomerBoundState();
    }

    setHidden('queuedCustomerChoice', true);
    renderCustomerWorkSession();
    showToast(
        translate('customerWorkSession.resetComplete', 'Klantwerksessie beëindigd. Klaar voor een nieuwe klant.'),
        'success'
    );
    return true;
}

function exposeCustomerWorkSessionApi() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope[CUSTOMER_WORK_SESSION_NAMESPACE] = {
        abandonCustomerSelection,
        beginMutation: beginCustomerMutation,
        confirmCustomerSelection,
        continueCustomerWorkSession,
        endCustomerWorkSession,
        finishMutation: finishCustomerMutation,
        getRequestContext: getCustomerRequestContext,
        getRequestHeaders: getCustomerRequestHeaders,
        isCurrent: isCustomerContextCurrent,
        resolveMutation: resolveCustomerMutation,
        showQueuedCustomerChoice,
        startCustomerSelection
    };
}

export function registerCustomerWorkSessionSlice(actionRouter) {
    exposeCustomerWorkSessionApi();
    renderCustomerWorkSession();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'customer-work-session.continue': () => {
            continueCustomerWorkSession();
        },
        'customer-work-session.end': () => {
            void endCustomerWorkSession();
        }
    });
}

export const __customerWorkSessionTestUtils = {
    customerWorkSession,
    renderCustomerWorkSession
};
