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
        dependencies.showToast(message, type, { recordContactHistory: false });
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
    renderAddressCheck(snapshot);
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

function renderAddressCheck(snapshot) {
    const customer = snapshot.activeCustomer;
    const blocked = Boolean(customer) && (snapshot.selectionPending || customer.addressValidation?.status !== 'confirmed');
    setHidden('customerAddressGate', !blocked);
    setText('customerAddressGateMessage', snapshot.selectionPending
        ? translate('customerWorkSession.addressChecking', 'Adres wordt gecontroleerd. Je kunt gegevens aanpassen; opslaan kan na bevestiging.')
        : translate('customerWorkSession.addressBlocked', 'Dit adres is nog niet bevestigd. Je kunt gegevens aanpassen. Corrigeer het adres voordat je wijzigingen opslaat.'));
    const retry = getElement('customerAddressRetry');
    if (retry) retry.disabled = snapshot.selectionPending;
}

export function addressAllowsMutation(method, url, payload) {
    const snapshot = customerWorkSession.getSnapshot();
    if (!snapshot.customerReference) return true;
    if (!snapshot.selectionPending && snapshot.activeCustomer?.addressValidation?.status === 'confirmed') return true;
    // A correction can save the complete profile atomically; its address is checked by the server.
    const ownPerson = encodeURIComponent(snapshot.customerReference.personId);
    const path = url.split('?')[0];
    const correction = method === 'PATCH' && (path === `/api/v1/persons/${ownPerson}` || path === `/api/v1/persons/${ownPerson}/address`);
    if (correction && payload?.postalCode && payload?.houseNumber && payload?.city) return true;
    showToast(translate('customerWorkSession.addressSaveBlocked', 'Opslaan kan pas nadat het klantadres is bevestigd. Gebruik Adres corrigeren; je invoer blijft behouden.'), 'warning');
    return false;
}

export function rejectCustomerAddress(context) {
    if (!customerWorkSession.isCurrent(context)) return;
    const customer = customerWorkSession.getSnapshot().activeCustomer;
    if (customer) customer.addressValidation = { status: 'blocked' };
    renderCustomerWorkSession();
}

export function acceptCorrectedCustomer(customer) {
    const context = customerWorkSession.getRequestContext();
    if (customerWorkSession.confirmCustomer(context, customer)) renderCustomerWorkSession();
}

function correctCustomerAddress() {
    const form = getElement('editCustomerForm');
    if (!form || form.style.display === 'none') getGlobalScope()?.editCustomer?.();
    getElement('editPostalCode')?.focus();
}

async function retryCustomerAddress() {
    const customer = customerWorkSession.getSnapshot().activeCustomer;
    if (customer) await getGlobalScope()?.kiwiCustomerDetailSlice?.selectCustomer(customer.id);
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

export async function confirmCustomerSelection(context, customer) {
    if (!customerWorkSession.canConfirmCustomer(context, customer)) {
        abandonCustomerSelection(context);
        return false;
    }

    if (context.previousContext) {
        const dependencies = resolveDependencies();
        const apiClient = dependencies?.getApiClient?.();
        try {
            if (!apiClient || typeof apiClient.post !== 'function'
                || typeof dependencies.resetCustomerBoundState !== 'function') {
                throw new Error('Customer reset audit is unavailable.');
            }
            await apiClient.post('/api/v1/customer-work-sessions/reset', context.previousContext, {
                skipCustomerContext: true
            });
        } catch (error) {
            if (abandonCustomerSelection(context)) {
                showToast(
                    translate('customerWorkSession.resetFailed', 'De klantwerksessie kon niet veilig worden beëindigd.'),
                    'error'
                );
            }
            return false;
        }

        if (!customerWorkSession.isCurrent(context)) {
            return false;
        }
        dependencies.resetCustomerBoundState();
        setHidden('queuedCustomerChoice', true);
    }

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

export function markCustomerWorkSessionChanged() {
    customerWorkSession.markChanged();
}

function trackCustomerDraft(event) {
    const target = event.target;
    const editor = target?.closest?.('.form-container, #editDeliveryRemarksModal');
    if (!editor) {
        return;
    }
    if (event.type === 'click') {
        const action = target.closest('[data-action]')?.dataset.action;
        const isDismissal = action === 'close-form' || action === 'close-article-sale-form';
        if (!action || isDismissal) {
            return;
        }
    }
    markCustomerWorkSessionChanged();
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

    if (customerWorkSession.getSnapshot().selectionPending) {
        customerWorkSession.abandonCustomerSelection(customerWorkSession.getRequestContext());
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

    if (!customerWorkSession.isCurrent(context)) {
        return false;
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
        addressAllowsMutation,
        acceptCorrectedCustomer,
        rejectCustomerAddress,
        beginMutation: beginCustomerMutation,
        confirmCustomerSelection,
        continueCustomerWorkSession,
        endCustomerWorkSession,
        finishMutation: finishCustomerMutation,
        getRequestContext: getCustomerRequestContext,
        getRequestHeaders: getCustomerRequestHeaders,
        isCurrent: isCustomerContextCurrent,
        markChanged: markCustomerWorkSessionChanged,
        resolveMutation: resolveCustomerMutation,
        showQueuedCustomerChoice,
        startCustomerSelection
    };
}

export function registerCustomerWorkSessionSlice(actionRouter) {
    exposeCustomerWorkSessionApi();
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        for (const eventType of ['input', 'change', 'click']) {
            document.addEventListener(eventType, trackCustomerDraft, true);
        }
    }
    renderCustomerWorkSession();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'customer-address.correct': correctCustomerAddress,
        'customer-address.retry': () => { void retryCustomerAddress(); },
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
    renderCustomerWorkSession,
    trackCustomerDraft
};
