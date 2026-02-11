import { getGlobalScope } from '../services.js';

const WINBACK_SLICE_NAMESPACE = 'kiwiWinbackSlice';

const DEFAULT_API_ENDPOINTS = {
    offersApiUrl: '/api/v1/catalog/offers',
    subscriptionsApiUrl: '/api/v1/subscriptions'
};

const winbackState = {
    selectedOffer: null,
    cancellingSubscriptionId: null,
    isWinbackForEndedSub: false,
    deceasedSubscriptionActions: null,
    restitutionRevertSubId: null
};
const changeHandlerByElement = new WeakMap();

function getDocumentRef() {
    if (typeof document === 'undefined') {
        return null;
    }

    return document;
}

function getElementById(elementId) {
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.getElementById !== 'function') {
        return null;
    }

    return documentRef.getElementById(elementId);
}

function querySelector(selector) {
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
        return null;
    }

    return documentRef.querySelector(selector);
}

function querySelectorAll(selector) {
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.querySelectorAll !== 'function') {
        return [];
    }

    return Array.from(documentRef.querySelectorAll(selector));
}

function parseNumericValue(rawValue) {
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : null;
}

function getLegacyCustomerBridge() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return null;
    }

    const bridge = globalScope.kiwiLegacyCustomerSearchBridge;
    if (!bridge || typeof bridge !== 'object') {
        return null;
    }

    return bridge;
}

function readCurrentCustomer() {
    const bridge = getLegacyCustomerBridge();
    if (!bridge || typeof bridge.getCurrentCustomer !== 'function') {
        return null;
    }

    return bridge.getCurrentCustomer() || null;
}

function getCustomerSubscriptions(customer) {
    if (!customer || !Array.isArray(customer.subscriptions)) {
        return [];
    }

    return customer.subscriptions;
}

function findSubscription(customer, subscriptionId) {
    const subscriptions = getCustomerSubscriptions(customer);
    return subscriptions.find((subscription) => Number(subscription.id) === Number(subscriptionId)) || null;
}

function getApiClient() {
    const globalScope = getGlobalScope();
    if (!globalScope || !globalScope.kiwiApi) {
        return null;
    }

    return globalScope.kiwiApi;
}

function getApiEndpoints() {
    const globalScope = getGlobalScope();
    const bootstrapSlice = globalScope ? globalScope.kiwiBootstrapSlice : null;
    if (!bootstrapSlice || typeof bootstrapSlice.getApiEndpoints !== 'function') {
        return {
            ...DEFAULT_API_ENDPOINTS
        };
    }

    return {
        ...DEFAULT_API_ENDPOINTS,
        ...(bootstrapSlice.getApiEndpoints() || {})
    };
}

function getLegacyFunction(functionName) {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return null;
    }

    const legacyFunction = globalScope[functionName];
    return typeof legacyFunction === 'function' ? legacyFunction : null;
}

function callLegacyFunction(functionName, ...args) {
    const legacyFunction = getLegacyFunction(functionName);
    if (!legacyFunction) {
        return undefined;
    }

    return legacyFunction(...args);
}

function translateKey(key, params = {}, fallback = key) {
    const globalScope = getGlobalScope();
    if (!globalScope || !globalScope.i18n || typeof globalScope.i18n.t !== 'function') {
        return fallback;
    }

    const translatedValue = globalScope.i18n.t(key, params);
    if (translatedValue === undefined || translatedValue === null || translatedValue === key) {
        return fallback;
    }

    return translatedValue;
}

function showToast(message, type = 'success') {
    const globalScope = getGlobalScope();
    if (!globalScope || typeof globalScope.showToast !== 'function') {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error(message);
        }
        return;
    }

    globalScope.showToast(message, type);
}

function getDateLocaleForApp() {
    const legacyFunction = getLegacyFunction('getDateLocaleForApp');
    if (legacyFunction) {
        return legacyFunction();
    }

    return 'nl-NL';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString(getDateLocaleForApp(), {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

function closeForm(formId) {
    const closeFormFn = getLegacyFunction('closeForm');
    if (closeFormFn) {
        closeFormFn(formId);
        return;
    }

    const form = getElementById(formId);
    if (form && form.style) {
        form.style.display = 'none';
    }
}

function saveCustomers() {
    callLegacyFunction('saveCustomers');
}

function pushContactHistory(customer, entry) {
    callLegacyFunction('pushContactHistory', customer, entry, {
        highlight: true,
        persist: false
    });
}

async function selectCustomer(customerId) {
    const selectCustomerFn = getLegacyFunction('selectCustomer');
    if (!selectCustomerFn) {
        return;
    }

    await Promise.resolve(selectCustomerFn(customerId));
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function hideAllWinbackSteps() {
    const winbackSteps = querySelectorAll('.winback-step');
    for (const step of winbackSteps) {
        if (step.style) {
            step.style.display = 'none';
        }
    }
}

function showWinbackStep(stepNumber) {
    hideAllWinbackSteps();

    const targetStep = getElementById(`winbackStep${stepNumber}`);
    if (targetStep && targetStep.style) {
        targetStep.style.display = 'block';
    }
}

function setActiveStepIndicator(stepNumber) {
    const allIndicators = querySelectorAll('.step');
    for (const indicator of allIndicators) {
        if (indicator.classList) {
            indicator.classList.remove('active');
        }
    }

    const activeIndicator = querySelector(`[data-step="${stepNumber}"]`);
    if (activeIndicator && activeIndicator.classList) {
        activeIndicator.classList.add('active');
    }
}

function getTransferActions() {
    if (!Array.isArray(winbackState.deceasedSubscriptionActions)) {
        return [];
    }

    return winbackState.deceasedSubscriptionActions.filter((subscriptionAction) => subscriptionAction.action === 'transfer');
}

function getRefundActions() {
    if (!Array.isArray(winbackState.deceasedSubscriptionActions)) {
        return [];
    }

    return winbackState.deceasedSubscriptionActions.filter((subscriptionAction) => subscriptionAction.action === 'cancel_refund');
}

function readTextInputValue(elementId) {
    const element = getElementById(elementId);
    if (!element || typeof element.value !== 'string') {
        return '';
    }

    return element.value.trim();
}

function isElementVisible(elementId) {
    const element = getElementById(elementId);
    if (!element || !element.style) {
        return false;
    }

    return element.style.display !== 'none';
}

function buildTransferRecipientName(transferData) {
    const middleName = transferData.middleName ? `${transferData.middleName} ` : '';
    return `${transferData.salutation} ${transferData.firstName} ${middleName}${transferData.lastName}`.trim();
}

function readStepFromPayload(payload = {}, context) {
    if (payload.step !== undefined && payload.step !== null) {
        return payload.step;
    }

    return context && context.element && context.element.dataset
        ? context.element.dataset.argStep
        : undefined;
}

function resolveSubscriptionId(rawValue) {
    if (rawValue === undefined || rawValue === null) {
        return null;
    }

    const numericValue = parseNumericValue(rawValue);
    return numericValue === null ? null : numericValue;
}

function readTransferFormData(prefix) {
    const customerFormData = callLegacyFunction('getCustomerFormData', prefix);
    const hasCustomerFormData = customerFormData && typeof customerFormData === 'object';
    if (!hasCustomerFormData) {
        showToast(translateKey('forms.newSubscriberRequired', {}, 'Vul alle verplichte velden in voor de nieuwe abonnee'), 'error');
        return null;
    }

    const birthday = callLegacyFunction('ensureBirthdayValue', prefix, false);
    if (birthday === null) {
        return null;
    }

    const currentCustomer = readCurrentCustomer();
    const sameAddressCheckbox = getElementById(`${prefix}SameAddress`);
    const shouldUseCurrentCustomerAddress = Boolean(sameAddressCheckbox && sameAddressCheckbox.checked && currentCustomer);

    const postalCode = shouldUseCurrentCustomerAddress
        ? currentCustomer.postalCode
        : customerFormData.postalCode;
    const houseNumber = shouldUseCurrentCustomerAddress
        ? currentCustomer.houseNumber
        : customerFormData.houseNumber;
    const address = shouldUseCurrentCustomerAddress
        ? currentCustomer.address
        : customerFormData.address;
    const city = shouldUseCurrentCustomerAddress
        ? currentCustomer.city
        : customerFormData.city;

    return {
        salutation: customerFormData.salutation,
        firstName: customerFormData.initials,
        middleName: customerFormData.middleName,
        lastName: customerFormData.lastName,
        birthday,
        email: customerFormData.email,
        phone: customerFormData.phone,
        postalCode,
        houseNumber,
        address,
        city
    };
}

function readRefundFormData(suffix = '') {
    return {
        email: readTextInputValue(`refundEmail${suffix}`),
        notes: readTextInputValue(`refundNotes${suffix}`)
    };
}

function setInnerHtml(elementId, htmlValue) {
    const element = getElementById(elementId);
    if (!element) {
        return;
    }

    element.innerHTML = htmlValue;
}

function setTextContent(elementId, textValue) {
    const element = getElementById(elementId);
    if (!element) {
        return;
    }

    element.textContent = textValue;
}

function setDisplayValue(elementId, displayValue) {
    const element = getElementById(elementId);
    if (!element || !element.style) {
        return;
    }

    element.style.display = displayValue;
}

function setRequiredForRestitutionAddressFields(isRequired) {
    const requiredElementIds = [
        'restitutionTransferPostalCode',
        'restitutionTransferHouseNumber',
        'restitutionTransferAddress',
        'restitutionTransferCity'
    ];

    for (const elementId of requiredElementIds) {
        const element = getElementById(elementId);
        if (!element) {
            continue;
        }

        element.required = isRequired;
    }
}

function registerSingleChangeHandler(element, handler) {
    const previousHandler = changeHandlerByElement.get(element);
    if (previousHandler) {
        element.removeEventListener('change', previousHandler);
    }

    element.addEventListener('change', handler);
    changeHandlerByElement.set(element, handler);
}

export function cancelSubscription(subscriptionId) {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        return;
    }

    const subscription = findSubscription(currentCustomer, subscriptionId);
    if (!subscription) {
        return;
    }

    winbackState.cancellingSubscriptionId = Number(subscription.id);
    winbackState.isWinbackForEndedSub = false;
    showWinbackFlow();
}

export function startWinbackForSubscription(subscriptionId) {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        return;
    }

    const subscription = findSubscription(currentCustomer, subscriptionId);
    if (!subscription) {
        return;
    }

    winbackState.cancellingSubscriptionId = Number(subscription.id);
    winbackState.isWinbackForEndedSub = true;
    showWinbackFlow();
}

export function showWinbackFlow() {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        showToast(translateKey('customer.selectFirst', {}, 'Selecteer eerst een klant'), 'error');
        return;
    }

    if (!winbackState.cancellingSubscriptionId) {
        const subscriptions = getCustomerSubscriptions(currentCustomer);
        const activeSubscription = subscriptions.find((subscription) => subscription.status === 'active');

        if (activeSubscription) {
            winbackState.cancellingSubscriptionId = Number(activeSubscription.id);
        } else if (subscriptions.length > 0) {
            winbackState.cancellingSubscriptionId = Number(subscriptions[0].id);
        }
    }

    showWinbackStep(1);
    setActiveStepIndicator(1);
    setDisplayValue('winbackFlow', 'flex');
}

export async function winbackNextStep(stepNumber) {
    const shouldValidateReasonSelection = Number(stepNumber) === 2;
    if (shouldValidateReasonSelection) {
        const selectedReason = querySelector('input[name="cancelReason"]:checked');
        if (!selectedReason) {
            showToast(translateKey('subscription.selectReason', {}, 'Selecteer een reden'), 'error');
            return;
        }

        const isDeceasedReason = selectedReason.value === 'deceased';
        if (isDeceasedReason) {
            winbackHandleDeceased();
            return;
        }

        await generateWinbackOffers(selectedReason.value);
    }

    const shouldValidateOfferSelection = Number(stepNumber) === 3;
    if (shouldValidateOfferSelection) {
        if (!winbackState.selectedOffer) {
            showToast(translateKey('subscription.selectOffer', {}, 'Selecteer een aanbod'), 'error');
            return;
        }

        generateWinbackScript();
    }

    showWinbackStep(stepNumber);
    setActiveStepIndicator(stepNumber);
}

export function winbackPrevStep(stepNumber) {
    const shouldShowDeceasedStep = stepNumber === '1b';
    if (shouldShowDeceasedStep) {
        showWinbackStep('1b');
        return;
    }

    const isStringStepNumber = typeof stepNumber === 'string';
    if (isStringStepNumber) {
        showWinbackStep(stepNumber);
        return;
    }

    void winbackNextStep(stepNumber);
}

export async function generateWinbackOffers(reason) {
    const apiClient = getApiClient();
    const canLoadOffers = apiClient && typeof apiClient.get === 'function';
    if (!canLoadOffers) {
        showToast(translateKey('winback.offersUnavailable', {}, 'Winback-aanbiedingen via backend zijn niet beschikbaar'), 'error');
        return;
    }

    const { offersApiUrl } = getApiEndpoints();
    let relevantOffers = [];

    try {
        const query = new URLSearchParams({
            type: 'winback',
            reason: reason || 'other'
        }).toString();
        const payload = await apiClient.get(`${offersApiUrl}?${query}`);
        relevantOffers = payload && Array.isArray(payload.items) ? payload.items : [];
    } catch (error) {
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn('Winback-aanbiedingen laden via backend mislukt.', error);
        }
        showToast(error.message || translateKey('winback.offersLoadFailed', {}, 'Winback-aanbiedingen laden mislukt'), 'error');
        return;
    }

    if (!relevantOffers.length) {
        showToast(translateKey('winback.offersNoneForReason', {}, 'Geen winback-aanbiedingen beschikbaar voor deze reden'), 'warning');
    }

    const offersMarkup = relevantOffers.map((offer) => {
        const safeOfferId = escapeHtml(String(offer.id ?? ''));
        const safeTitle = escapeHtml(String(offer.title || ''));
        const safeDescription = escapeHtml(String(offer.description || ''));
        const safeDiscount = escapeHtml(String(offer.discount || ''));

        return `
        <div class="offer-card" data-action="select-offer" data-arg-offer-id="${safeOfferId}" data-arg-title="${safeTitle}" data-arg-description="${safeDescription}">
            <div class="offer-title">${safeTitle}</div>
            <div class="offer-description">${safeDescription}</div>
            <div class="offer-discount">${safeDiscount}</div>
        </div>
    `;
    }).join('');

    setInnerHtml('winbackOffers', offersMarkup);
}

export function selectOffer(offerId, title, description, selectedElement = null) {
    winbackState.selectedOffer = {
        id: offerId,
        title,
        description
    };

    const offerCards = querySelectorAll('.offer-card');
    for (const offerCard of offerCards) {
        if (offerCard.classList) {
            offerCard.classList.remove('selected');
        }
    }

    if (selectedElement && selectedElement.classList) {
        selectedElement.classList.add('selected');
    }
}

export function generateWinbackScript() {
    if (!winbackState.selectedOffer) {
        return;
    }

    const scriptElement = getElementById('winbackScript');
    if (!scriptElement) {
        return;
    }

    scriptElement.innerHTML = `
        <strong>${translateKey('winback.offerScriptTitle', {}, 'Script voor aanbod presentatie:')}</strong><br><br>
        "${translateKey('winback.offerScriptIntro', {}, 'Ik begrijp dat u het abonnement wilt opzeggen. We waarderen u als klant enorm en willen graag dat u blijft. Daarom wil ik u een speciaal aanbod doen:')}<br><br>
        <strong>${winbackState.selectedOffer.title}</strong><br>
        ${winbackState.selectedOffer.description}<br><br>
        ${translateKey('winback.offerScriptQuestion', {}, 'Zou dit u helpen om het abonnement aan te houden?')}"
    `;
}

export function winbackHandleDeceased() {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        return;
    }

    const activeSubscriptions = getCustomerSubscriptions(currentCustomer)
        .filter((subscription) => subscription.status === 'active');
    if (activeSubscriptions.length === 0) {
        showToast(translateKey('subscription.noneActive', {}, 'Geen actieve abonnementen gevonden'), 'error');
        return;
    }

    setTextContent('deceasedSubCount', String(activeSubscriptions.length));

    const subscriptionCardsMarkup = activeSubscriptions.map((subscription) => `
        <div class="deceased-subscription-card" data-sub-id="${subscription.id}">
            <div class="deceased-sub-header">
                <h4>📰 ${escapeHtml(subscription.magazine)}</h4>
                <span class="sub-start-date">Start: ${formatDate(subscription.startDate)}</span>
            </div>
            <div class="form-group">
                <label>Actie voor dit abonnement:</label>
                <div class="radio-group">
                    <label class="radio-option">
                        <input type="radio" name="action_${subscription.id}" value="cancel_refund" required>
                        <span>${translateKey('subscription.actionCancelWithRefund', {}, 'Opzeggen met restitutie')}</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="action_${subscription.id}" value="transfer" required>
                        <span>${translateKey('subscription.actionTransferToOther', {}, 'Overzetten op andere persoon')}</span>
                    </label>
                </div>
            </div>
        </div>
    `).join('');

    setInnerHtml('deceasedSubscriptionsList', subscriptionCardsMarkup);
    showWinbackStep('1b');
}

export function processDeceasedSubscriptions() {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        return;
    }

    const activeSubscriptions = getCustomerSubscriptions(currentCustomer)
        .filter((subscription) => subscription.status === 'active');
    const subscriptionActions = [];

    for (const subscription of activeSubscriptions) {
        const selectedAction = querySelector(`input[name="action_${subscription.id}"]:checked`);
        if (!selectedAction) {
            showToast(
                translateKey('subscription.selectAction', { magazine: subscription.magazine }, `Selecteer een actie voor ${subscription.magazine}`),
                'error'
            );
            return;
        }

        subscriptionActions.push({
            subscription,
            action: selectedAction.value
        });
    }

    winbackState.deceasedSubscriptionActions = subscriptionActions;

    const needsTransfer = subscriptionActions.some((subscriptionAction) => subscriptionAction.action === 'transfer');
    const needsRefund = subscriptionActions.some((subscriptionAction) => subscriptionAction.action === 'cancel_refund');

    if (needsTransfer && needsRefund) {
        showDeceasedCombinedForm();
        return;
    }

    if (needsTransfer) {
        showDeceasedTransferForm();
        return;
    }

    showDeceasedRefundForm();
}

export function showDeceasedRefundForm() {
    const currentCustomer = readCurrentCustomer();
    const refundActions = getRefundActions();

    const listHtml = `
        <p><strong>Op te zeggen abonnementen:</strong></p>
        <ul>
            ${refundActions.map((subscriptionAction) => `<li>📰 ${escapeHtml(subscriptionAction.subscription.magazine)}</li>`).join('')}
        </ul>
    `;

    setInnerHtml('refundSubscriptionsList', listHtml);
    showWinbackStep('1c');

    const refundEmailInput = getElementById('refundEmail');
    if (refundEmailInput && currentCustomer && currentCustomer.email) {
        refundEmailInput.placeholder = `Bijv. ${currentCustomer.email} of ander e-mailadres`;
    }
}

export function showDeceasedTransferForm() {
    const currentCustomer = readCurrentCustomer();
    const transferActions = getTransferActions();

    const listHtml = `
        <p><strong>Over te zetten abonnementen:</strong></p>
        <ul>
            ${transferActions.map((subscriptionAction) => `<li>📰 ${escapeHtml(subscriptionAction.subscription.magazine)}</li>`).join('')}
        </ul>
    `;

    setInnerHtml('transferSubscriptionsList', listHtml);
    showWinbackStep('1d');

    callLegacyFunction('renderCustomerForm', 'transferCustomerForm', 'transfer', {
        phoneRequired: true,
        emailRequired: true,
        showSameAddressCheckbox: true
    });

    const sameAddressCheckbox = getElementById('transferSameAddress');
    if (!sameAddressCheckbox) {
        return;
    }

    registerSingleChangeHandler(sameAddressCheckbox, () => {
        const shouldCopyAddress = sameAddressCheckbox.checked && currentCustomer;
        if (!shouldCopyAddress) {
            return;
        }

        callLegacyFunction('setCustomerFormData', 'transfer', {
            postalCode: currentCustomer.postalCode,
            houseNumber: currentCustomer.houseNumber,
            address: currentCustomer.address,
            city: currentCustomer.city
        });
    });
}

export function showDeceasedCombinedForm() {
    const currentCustomer = readCurrentCustomer();
    const transferActions = getTransferActions();
    const refundActions = getRefundActions();

    const transferListHtml = `
        <p><strong>Over te zetten abonnementen:</strong></p>
        <ul>
            ${transferActions.map((subscriptionAction) => `<li>📰 ${escapeHtml(subscriptionAction.subscription.magazine)}</li>`).join('')}
        </ul>
    `;

    const refundListHtml = `
        <p><strong>Op te zeggen abonnementen:</strong></p>
        <ul>
            ${refundActions.map((subscriptionAction) => `<li>📰 ${escapeHtml(subscriptionAction.subscription.magazine)}</li>`).join('')}
        </ul>
    `;

    setInnerHtml('combinedTransferList', transferListHtml);
    setInnerHtml('combinedRefundList', refundListHtml);
    showWinbackStep('1e');

    callLegacyFunction('renderCustomerForm', 'transfer2CustomerForm', 'transfer2', {
        phoneRequired: true,
        emailRequired: true,
        showSameAddressCheckbox: true
    });

    const sameAddressCheckbox = getElementById('transfer2SameAddress');
    if (!sameAddressCheckbox) {
        return;
    }

    registerSingleChangeHandler(sameAddressCheckbox, () => {
        const shouldCopyAddress = sameAddressCheckbox.checked && currentCustomer;
        if (!shouldCopyAddress) {
            return;
        }

        callLegacyFunction('setCustomerFormData', 'transfer2', {
            postalCode: currentCustomer.postalCode,
            houseNumber: currentCustomer.houseNumber,
            address: currentCustomer.address,
            city: currentCustomer.city
        });
    });
}

export function revertRestitution(subscriptionId) {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        return;
    }

    const subscription = findSubscription(currentCustomer, subscriptionId);
    const canRevertSubscription = subscription && subscription.status === 'restituted';
    if (!canRevertSubscription) {
        showToast(translateKey('subscription.notFoundOrRefund', {}, 'Abonnement niet gevonden of niet gerestitueerd'), 'error');
        return;
    }

    winbackState.restitutionRevertSubId = Number(subscription.id);
    showRestitutionTransferForm(subscription);
}

export function showRestitutionTransferForm(subscription) {
    setDisplayValue('restitutionTransferForm', 'flex');

    const titleElement = getElementById('restitutionTransferTitle');
    if (titleElement) {
        titleElement.textContent = translateKey(
            'subscription.transferTitleWithMagazine',
            { magazine: subscription.magazine },
            `${subscription.magazine} Overzetten`
        );
    }

    const sameAddressCheckbox = getElementById('restitutionTransferSameAddress');
    if (sameAddressCheckbox) {
        sameAddressCheckbox.checked = true;
    }

    toggleRestitutionTransferAddress();
}

export function toggleRestitutionTransferAddress() {
    const sameAddressCheckbox = getElementById('restitutionTransferSameAddress');
    const addressFields = getElementById('restitutionTransferAddressFields');
    if (!sameAddressCheckbox || !addressFields || !addressFields.style) {
        return;
    }

    const shouldUseSameAddress = sameAddressCheckbox.checked;
    addressFields.style.display = shouldUseSameAddress ? 'none' : 'block';
    setRequiredForRestitutionAddressFields(!shouldUseSameAddress);
}

export async function completeRestitutionTransfer(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        return;
    }

    const subscriptionId = winbackState.restitutionRevertSubId;
    const subscription = findSubscription(currentCustomer, subscriptionId);
    if (!subscription) {
        showToast(translateKey('subscription.notFound', {}, 'Abonnement niet gevonden'), 'error');
        return;
    }

    const sameAddressCheckbox = getElementById('restitutionTransferSameAddress');
    const shouldUseSameAddress = Boolean(sameAddressCheckbox && sameAddressCheckbox.checked);

    const transferData = {
        salutation: readTextInputValue('restitutionTransferSalutation'),
        firstName: readTextInputValue('restitutionTransferFirstName'),
        middleName: readTextInputValue('restitutionTransferMiddleName'),
        lastName: readTextInputValue('restitutionTransferLastName'),
        email: readTextInputValue('restitutionTransferEmail'),
        phone: readTextInputValue('restitutionTransferPhone'),
        postalCode: shouldUseSameAddress ? currentCustomer.postalCode : readTextInputValue('restitutionTransferPostalCode'),
        houseNumber: shouldUseSameAddress ? currentCustomer.houseNumber : readTextInputValue('restitutionTransferHouseNumber'),
        address: shouldUseSameAddress ? currentCustomer.address : readTextInputValue('restitutionTransferAddress'),
        city: shouldUseSameAddress ? currentCustomer.city : readTextInputValue('restitutionTransferCity')
    };

    const hasRequiredIdentityFields = transferData.firstName && transferData.lastName && transferData.email && transferData.phone;
    if (!hasRequiredIdentityFields) {
        showToast(translateKey('forms.required', {}, 'Vul alle verplichte velden in'), 'error');
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasValidEmail = emailPattern.test(transferData.email);
    if (!hasValidEmail) {
        showToast(translateKey('forms.invalidEmail', {}, 'Voer een geldig e-mailadres in'), 'error');
        return;
    }

    const newCustomerName = buildTransferRecipientName(transferData);
    const apiClient = getApiClient();
    const canPersistTransferViaApi = apiClient && typeof apiClient.post === 'function';

    if (canPersistTransferViaApi) {
        const { subscriptionsApiUrl } = getApiEndpoints();

        try {
            await apiClient.post(
                `${subscriptionsApiUrl}/${currentCustomer.id}/${subscriptionId}/restitution-transfer`,
                { transferData }
            );
        } catch (error) {
            showToast(error.message || translateKey('subscription.transferFailed', {}, 'Overzetten via backend mislukt'), 'error');
            return;
        }
    } else {
        subscription.status = 'transferred';
        subscription.transferredTo = {
            ...transferData,
            transferDate: new Date().toISOString()
        };
        delete subscription.refundInfo;

        pushContactHistory(currentCustomer, {
            type: 'Restitutie Ongedaan - Abonnement Overgezet',
            description: `Restitutie van ${subscription.magazine} ongedaan gemaakt. Abonnement overgezet naar ${newCustomerName} (${transferData.email}) op ${transferData.address}, ${transferData.postalCode} ${transferData.city}.`
        });

        saveCustomers();
    }

    closeForm('restitutionTransferForm');
    await selectCustomer(currentCustomer.id);

    showToast(
        translateKey('subscription.transferred', { magazine: subscription.magazine, name: newCustomerName }, `${subscription.magazine} overgezet naar ${newCustomerName}`),
        'success'
    );

    winbackState.restitutionRevertSubId = null;
}

export function getTransferDataFromForm(formVersion) {
    const prefix = formVersion === 2 ? 'transfer2' : 'transfer';
    return readTransferFormData(prefix);
}

export function getRefundDataFromForm(formVersion) {
    const suffix = formVersion === 2 ? '2' : '';
    return readRefundFormData(suffix);
}

export function validateTransferData(data) {
    const hasRequiredFields = data.firstName && data.lastName && data.email && data.phone && data.birthday;
    if (!hasRequiredFields) {
        showToast(translateKey('forms.newSubscriberRequired', {}, 'Vul alle verplichte velden in voor de nieuwe abonnee'), 'error');
        return false;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasValidEmail = emailPattern.test(data.email);
    if (!hasValidEmail) {
        showToast(translateKey('forms.newSubscriberInvalidEmail', {}, 'Voer een geldig e-mailadres in voor de nieuwe abonnee'), 'error');
        return false;
    }

    const hasAddress = data.postalCode && data.houseNumber && data.address && data.city;
    if (!hasAddress) {
        showToast(translateKey('forms.newSubscriberAddressMissing', {}, 'Vul alle adresvelden in voor de nieuwe abonnee'), 'error');
        return false;
    }

    return true;
}

export function validateRefundData(data) {
    if (!data.email) {
        showToast(translateKey('forms.refundEmailMissing', {}, 'Voer een e-mailadres in voor de restitutiebevestiging'), 'error');
        return false;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const hasValidEmail = emailPattern.test(data.email);
    if (!hasValidEmail) {
        showToast(translateKey('forms.refundEmailInvalid', {}, 'Voer een geldig e-mailadres in voor de restitutie'), 'error');
        return false;
    }

    return true;
}

export async function completeAllDeceasedActions() {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        return;
    }

    let transferData = null;
    let refundData = null;

    const isCombinedStepVisible = isElementVisible('winbackStep1e');
    const isTransferStepVisible = isElementVisible('winbackStep1d');
    const isRefundStepVisible = isElementVisible('winbackStep1c');

    if (isCombinedStepVisible) {
        transferData = getTransferDataFromForm(2);
        refundData = getRefundDataFromForm(2);
    } else if (isTransferStepVisible) {
        transferData = getTransferDataFromForm(1);
    } else if (isRefundStepVisible) {
        refundData = getRefundDataFromForm(1);
    }

    const transferActions = getTransferActions();
    if (transferActions.length > 0 && transferData === null) {
        return;
    }

    if (transferActions.length > 0 && !validateTransferData(transferData)) {
        return;
    }

    const refundActions = getRefundActions();
    if (refundActions.length > 0 && !validateRefundData(refundData)) {
        return;
    }

    const processedMagazines = [];
    const actionsPayload = [];

    for (const action of transferActions) {
        processedMagazines.push(`${action.subscription.magazine} (overgezet)`);
        actionsPayload.push({
            subscriptionId: action.subscription.id,
            action: 'transfer',
            transferData
        });
    }

    for (const action of refundActions) {
        processedMagazines.push(`${action.subscription.magazine} (gerestitueerd)`);
        actionsPayload.push({
            subscriptionId: action.subscription.id,
            action: 'cancel_refund',
            refundData
        });
    }

    let historyDescription = 'Abonnementen verwerkt i.v.m. overlijden:\n';

    if (transferActions.length > 0) {
        const newCustomerName = buildTransferRecipientName(transferData);
        historyDescription += `\nOvergezet naar ${newCustomerName} (${transferData.email}):\n`;
        historyDescription += transferActions.map((action) => `- ${action.subscription.magazine}`).join('\n');
    }

    if (refundActions.length > 0) {
        historyDescription += `\n\nOpgezegd met restitutie naar ${refundData.email}:\n`;
        historyDescription += refundActions.map((action) => `- ${action.subscription.magazine}`).join('\n');
        if (refundData.notes) {
            historyDescription += `\nNotities: ${refundData.notes}`;
        }
    }

    const apiClient = getApiClient();
    const canPersistActionsViaApi = apiClient && typeof apiClient.post === 'function';

    if (canPersistActionsViaApi) {
        const { subscriptionsApiUrl } = getApiEndpoints();

        try {
            await apiClient.post(`${subscriptionsApiUrl}/${currentCustomer.id}/deceased-actions`, {
                actions: actionsPayload
            });
        } catch (error) {
            showToast(error.message || translateKey('subscription.deceasedProcessFailed', {}, 'Verwerken overlijden via backend mislukt'), 'error');
            return;
        }
    } else {
        for (const action of transferActions) {
            action.subscription.transferredTo = {
                ...transferData,
                transferDate: new Date().toISOString()
            };
            action.subscription.status = 'transferred';
        }

        for (const action of refundActions) {
            action.subscription.status = 'restituted';
            action.subscription.endDate = new Date().toISOString();
            action.subscription.refundInfo = {
                email: refundData.email,
                notes: refundData.notes,
                refundDate: new Date().toISOString()
            };
        }

        pushContactHistory(currentCustomer, {
            type: 'Overlijden - Meerdere Abonnementen',
            description: historyDescription
        });

        saveCustomers();
    }

    closeForm('winbackFlow');
    await selectCustomer(currentCustomer.id);

    showToast(
        translateKey(
            'subscription.processed',
            { count: processedMagazines.length },
            `${processedMagazines.length} abonnement(en) verwerkt. Bevestigingen worden verstuurd.`
        ),
        'success'
    );

    winbackState.deceasedSubscriptionActions = null;
}

export async function completeWinback() {
    const resultInput = querySelector('input[name="winbackResult"]:checked');
    if (!resultInput) {
        showToast(translateKey('winback.selectOutcome', {}, 'Selecteer een resultaat'), 'error');
        return;
    }

    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        return;
    }

    const subscriptionId = winbackState.cancellingSubscriptionId;
    const subscription = findSubscription(currentCustomer, subscriptionId);
    if (!subscription) {
        showToast(translateKey('subscription.notFound', {}, 'Abonnement niet gevonden'), 'error');
        return;
    }

    const resultValue = resultInput.value;
    const apiClient = getApiClient();
    const canPersistViaApi = apiClient && typeof apiClient.post === 'function';

    if (canPersistViaApi) {
        const { subscriptionsApiUrl } = getApiEndpoints();

        try {
            await apiClient.post(`${subscriptionsApiUrl}/${currentCustomer.id}/${subscriptionId}`, {
                result: resultValue,
                offer: winbackState.selectedOffer
            });
        } catch (error) {
            showToast(error.message || translateKey('winback.saveFailed', {}, 'Winback opslaan via backend mislukt'), 'error');
            return;
        }
    } else if (resultValue === 'accepted') {
        const selectedOfferTitle = winbackState.selectedOffer ? winbackState.selectedOffer.title : 'aanbod';

        pushContactHistory(currentCustomer, {
            type: 'Winback succesvol',
            description: `Klant accepteerde winback aanbod: ${selectedOfferTitle}. Abonnement ${subscription.magazine} blijft actief.`
        });
    } else {
        currentCustomer.subscriptions = getCustomerSubscriptions(currentCustomer)
            .filter((customerSubscription) => Number(customerSubscription.id) !== Number(subscriptionId));

        pushContactHistory(currentCustomer, {
            type: 'Abonnement opgezegd',
            description: `Klant heeft abonnement ${subscription.magazine} opgezegd na winback poging.`
        });
    }

    if (!canPersistViaApi) {
        saveCustomers();
    }

    closeForm('winbackFlow');
    await selectCustomer(currentCustomer.id);

    if (resultValue === 'accepted') {
        showToast(translateKey('winback.success', {}, 'Winback succesvol! Klant blijft abonnee.'), 'success');
    } else {
        showToast(translateKey('subscription.cancelled', {}, 'Abonnement opgezegd'), 'error');
    }

    winbackState.selectedOffer = null;
    winbackState.cancellingSubscriptionId = null;
    winbackState.isWinbackForEndedSub = false;
}

function exposeWinbackSlice() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope[WINBACK_SLICE_NAMESPACE] = {
        cancelSubscription,
        startWinbackForSubscription,
        showWinbackFlow,
        winbackNextStep,
        winbackPrevStep,
        generateWinbackOffers,
        selectOffer,
        generateWinbackScript,
        winbackHandleDeceased,
        processDeceasedSubscriptions,
        showDeceasedRefundForm,
        showDeceasedTransferForm,
        showDeceasedCombinedForm,
        revertRestitution,
        showRestitutionTransferForm,
        toggleRestitutionTransferAddress,
        completeRestitutionTransfer,
        completeAllDeceasedActions,
        getTransferDataFromForm,
        getRefundDataFromForm,
        validateTransferData,
        validateRefundData,
        completeWinback
    };
}

export function registerWinbackSlice(actionRouter) {
    exposeWinbackSlice();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'cancel-subscription': (payload) => {
            const subscriptionId = resolveSubscriptionId(payload.subId);
            if (subscriptionId === null) {
                return;
            }

            cancelSubscription(subscriptionId);
        },
        'start-winback-for-subscription': (payload) => {
            const subscriptionId = resolveSubscriptionId(payload.subId);
            if (subscriptionId === null) {
                return;
            }

            startWinbackForSubscription(subscriptionId);
        },
        'winback-next-step': (payload, context) => {
            const stepNumber = readStepFromPayload(payload, context);
            if (stepNumber === undefined || stepNumber === null) {
                return;
            }

            void winbackNextStep(stepNumber);
        },
        'winback-prev-step': (payload, context) => {
            const stepNumber = readStepFromPayload(payload, context);
            if (stepNumber === undefined || stepNumber === null) {
                return;
            }

            winbackPrevStep(stepNumber);
        },
        'process-deceased-subscriptions': () => {
            processDeceasedSubscriptions();
        },
        'complete-all-deceased-actions': () => {
            void completeAllDeceasedActions();
        },
        'revert-restitution': (payload) => {
            const subscriptionId = resolveSubscriptionId(payload.subId);
            if (subscriptionId === null) {
                return;
            }

            revertRestitution(subscriptionId);
        },
        'toggle-restitution-transfer-address': () => {
            toggleRestitutionTransferAddress();
        },
        'complete-restitution-transfer': (_payload, context) => {
            void completeRestitutionTransfer(context.event);
        },
        'complete-winback': () => {
            void completeWinback();
        },
        'select-offer': (payload, context) => {
            selectOffer(payload.offerId, payload.title, payload.description, context.element);
        }
    });
}

export const __winbackTestUtils = {
    readStepFromPayload,
    resolveSubscriptionId,
    buildTransferRecipientName
};
