import { getGlobalScope } from '../services.js';

const DEFAULT_API_ENDPOINTS = {
    personsApiUrl: '/api/v1/persons',
    subscriptionsApiUrl: '/api/v1/subscriptions',
    workflowsApiUrl: '/api/v1/workflows'
};

const SUBSCRIPTION_DURATION_DESCRIPTION_BY_KEY = {
    '1-jaar': '1 jaar - Jaarlijks betaald',
    '2-jaar': '2 jaar - Jaarlijks betaald (5% korting)',
    '3-jaar': '3 jaar - Jaarlijks betaald (10% korting)',
    '1-jaar-maandelijks': '1 jaar - Maandelijks betaald',
    '2-jaar-maandelijks': '2 jaar - Maandelijks betaald',
    '3-jaar-maandelijks': '3 jaar - Maandelijks betaald'
};

const STATUS_NAME_BY_KEY = {
    active: 'Actief',
    paused: 'Gepauzeerd',
    cancelled: 'Opgezegd'
};

let compatibilityExportsInstalled = false;

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

function getInputValue(elementId) {
    const element = getElementById(elementId);
    if (!element || typeof element.value !== 'string') {
        return '';
    }

    return element.value;
}

function setInputValue(elementId, value) {
    const element = getElementById(elementId);
    if (!element || !('value' in element)) {
        return;
    }

    element.value = value;
}

function showElement(elementId, displayValue) {
    const element = getElementById(elementId);
    if (!element || !element.style) {
        return;
    }

    element.style.display = displayValue;
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

function readCustomers() {
    const bridge = getLegacyCustomerBridge();
    if (!bridge || typeof bridge.getCustomers !== 'function') {
        return [];
    }

    const customers = bridge.getCustomers();
    return Array.isArray(customers) ? customers : [];
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

function getCheckedValue(inputName, fallback = '') {
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
        return fallback;
    }

    const input = documentRef.querySelector(`input[name="${inputName}"]:checked`);
    if (!input || typeof input.value !== 'string') {
        return fallback;
    }

    return input.value;
}

function setCheckedValue(inputName, value) {
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.querySelector !== 'function') {
        return;
    }

    const targetInput = documentRef.querySelector(`input[name="${inputName}"][value="${value}"]`);
    if (!targetInput) {
        return;
    }

    targetInput.checked = true;
}

function closeForm(formId) {
    const closeFormFn = getLegacyFunction('closeForm');
    if (closeFormFn) {
        closeFormFn(formId);
        return;
    }

    showElement(formId, 'none');
}

function parseNumericValue(rawValue) {
    const value = Number(rawValue);
    return Number.isFinite(value) ? value : null;
}

function parsePersonIdFromPayload(payload) {
    if (!payload || payload.personId === undefined || payload.personId === null) {
        return null;
    }

    return parseNumericValue(payload.personId);
}

function getWerfsleutelSliceApi() {
    const globalScope = getGlobalScope();
    if (!globalScope || !globalScope.kiwiWerfsleutelSlice || typeof globalScope.kiwiWerfsleutelSlice !== 'object') {
        return null;
    }

    return globalScope.kiwiWerfsleutelSlice;
}

function resetWerfsleutelPickerState() {
    const werfsleutelSliceApi = getWerfsleutelSliceApi();
    if (werfsleutelSliceApi && typeof werfsleutelSliceApi.resetPicker === 'function') {
        werfsleutelSliceApi.resetPicker();
        return;
    }

    callLegacyFunction('resetWerfsleutelPicker');
}

function refreshWerfsleutelCatalogIfStale() {
    const werfsleutelSliceApi = getWerfsleutelSliceApi();
    if (werfsleutelSliceApi && typeof werfsleutelSliceApi.refreshCatalogIfStale === 'function') {
        werfsleutelSliceApi.refreshCatalogIfStale();
        return;
    }

    callLegacyFunction('triggerWerfsleutelBackgroundRefreshIfStale');
}

function getSelectedWerfsleutelSelection() {
    const legacySelector = getLegacyFunction('getSelectedWerfsleutelState');
    if (!legacySelector) {
        return {
            selectedKey: null,
            selectedChannel: null,
            selectedChannelMeta: null
        };
    }

    const selection = legacySelector();
    return {
        selectedKey: selection?.selectedKey || null,
        selectedChannel: selection?.selectedChannel || null,
        selectedChannelMeta: selection?.selectedChannelMeta || null
    };
}

function getWerfsleutelOfferDetails(selectionKey) {
    const offerResolver = getLegacyFunction('getWerfsleutelOfferDetailsFromActiveSlice');
    if (!offerResolver) {
        return {
            magazine: '',
            durationKey: '',
            durationLabel: ''
        };
    }

    return offerResolver(selectionKey) || {
        magazine: '',
        durationKey: '',
        durationLabel: ''
    };
}

function formatEuro(amount) {
    const formatter = new Intl.NumberFormat(getDateLocaleForApp(), {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2
    });
    return formatter.format(Number(amount || 0));
}

function getSubscriptionDurationDescription(durationKey, durationLabel) {
    if (!durationKey) {
        return durationLabel;
    }

    return SUBSCRIPTION_DURATION_DESCRIPTION_BY_KEY[durationKey] || durationLabel;
}

function initializeSubscriptionRolesForForm() {
    callLegacyFunction('initializeSubscriptionRolesForForm');
    callLegacyFunction('renderRequesterSameSummary');
}

async function validateDuplicateSubmitGuard() {
    const validator = getLegacyFunction('validateSubscriptionDuplicateSubmitGuard');
    if (!validator) {
        return true;
    }

    return Boolean(await validator());
}

function buildSubscriptionRolePayload(role, options = {}) {
    const payloadBuilder = getLegacyFunction('buildSubscriptionRolePayload');
    if (!payloadBuilder) {
        return null;
    }

    return payloadBuilder(role, options);
}

function normalizeRequesterSameAsRecipientSelection() {
    callLegacyFunction('normalizeRequesterSameAsRecipientSelection', { silent: true });
}

function toggleRequesterSameAsRecipient() {
    callLegacyFunction('toggleRequesterSameAsRecipient');
}

function upsertCustomerInCache(customer) {
    callLegacyFunction('upsertCustomerInCache', customer);
}

async function selectCustomer(customerId) {
    const selectCustomerFn = getLegacyFunction('selectCustomer');
    if (!selectCustomerFn) {
        return;
    }

    await selectCustomerFn(customerId);
}

function showSuccessIdentificationPrompt(customerId, customerName) {
    callLegacyFunction('showSuccessIdentificationPrompt', customerId, customerName);
}

function pushContactHistory(customer, entry) {
    callLegacyFunction('pushContactHistory', customer, entry, {
        highlight: true,
        persist: false
    });
}

function saveCustomers() {
    callLegacyFunction('saveCustomers');
}

function refreshContactHistory() {
    callLegacyFunction('displayContactHistory');
}

function splitHouseNumber(value) {
    const match = String(value || '').match(/^(\d+)(.*)$/);
    if (!match) {
        return {
            houseNumber: value || '',
            houseExt: ''
        };
    }

    return {
        houseNumber: match[1] || '',
        houseExt: match[2] || ''
    };
}

function getSubscriptionChanges(previousSubscription, nextSubscription) {
    const changes = [];

    if (previousSubscription.magazine !== nextSubscription.magazine) {
        changes.push(`Magazine gewijzigd van ${previousSubscription.magazine} naar ${nextSubscription.magazine}`);
    }

    if (previousSubscription.duration !== nextSubscription.duration) {
        const previousDuration = getSubscriptionDurationDescription(previousSubscription.duration, 'onbekend');
        const nextDuration = getSubscriptionDurationDescription(nextSubscription.duration, 'onbekend');
        changes.push(`Duur gewijzigd van ${previousDuration} naar ${nextDuration}`);
    }

    if (previousSubscription.status !== nextSubscription.status) {
        const previousStatus = STATUS_NAME_BY_KEY[previousSubscription.status] || previousSubscription.status;
        const nextStatus = STATUS_NAME_BY_KEY[nextSubscription.status] || nextSubscription.status;
        changes.push(`Status gewijzigd van ${previousStatus} naar ${nextStatus}`);
    }

    return changes;
}

export function showNewSubscription() {
    const form = getElementById('subscriptionForm');
    if (form && typeof form.reset === 'function') {
        form.reset();
    }

    const today = new Date().toISOString().split('T')[0];
    setInputValue('subStartDate', today);

    resetWerfsleutelPickerState();
    refreshWerfsleutelCatalogIfStale();

    initializeSubscriptionRolesForForm();
    showElement('newSubscriptionForm', 'flex');
}

export async function createSubscription(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    const werfsleutelSelection = getSelectedWerfsleutelSelection();
    const selectedWerfsleutelKey = werfsleutelSelection.selectedKey;
    const selectedWerfsleutelChannel = werfsleutelSelection.selectedChannel;

    if (!selectedWerfsleutelKey) {
        showToast(translateKey('werfsleutel.selectKey', {}, 'Selecteer eerst een actieve werfsleutel.'), 'error');
        return;
    }

    if (!selectedWerfsleutelChannel) {
        showToast(translateKey('werfsleutel.selectChannel', {}, 'Kies een kanaal voor deze werfsleutel.'), 'error');
        return;
    }

    const offerDetails = getWerfsleutelOfferDetails(selectedWerfsleutelKey);
    const formData = {
        magazine: offerDetails.magazine,
        duration: offerDetails.durationKey || '',
        durationLabel: offerDetails.durationLabel,
        startDate: getInputValue('subStartDate'),
        paymentMethod: getCheckedValue('subPayment'),
        iban: getInputValue('subIBAN'),
        optinEmail: getCheckedValue('subOptinEmail'),
        optinPhone: getCheckedValue('subOptinPhone'),
        optinPost: getCheckedValue('subOptinPost'),
        werfsleutel: selectedWerfsleutelKey.salesCode,
        werfsleutelTitle: selectedWerfsleutelKey.title,
        werfsleutelPrice: selectedWerfsleutelKey.price,
        werfsleutelChannel: selectedWerfsleutelChannel,
        werfsleutelChannelLabel: werfsleutelSelection.selectedChannelMeta?.label || ''
    };

    const optinData = {
        optinEmail: formData.optinEmail,
        optinPhone: formData.optinPhone,
        optinPost: formData.optinPost
    };

    const recipientPayload = buildSubscriptionRolePayload('recipient', { optinData });
    if (!recipientPayload) {
        return;
    }

    normalizeRequesterSameAsRecipientSelection();

    let requesterPayload = buildSubscriptionRolePayload('requester');
    if (!requesterPayload) {
        return;
    }

    const recipientPersonId = parsePersonIdFromPayload(recipientPayload);
    const requesterPersonId = parsePersonIdFromPayload(requesterPayload);
    const requesterSameAsRecipientCheckbox = getElementById('requesterSameAsRecipient');
    const requesterShouldFollowRecipient = (
        recipientPersonId !== null
        && requesterPersonId !== null
        && recipientPersonId === requesterPersonId
        && requesterSameAsRecipientCheckbox
        && requesterSameAsRecipientCheckbox.checked === false
    );

    if (requesterShouldFollowRecipient) {
        requesterPayload = { sameAsRecipient: true };
        requesterSameAsRecipientCheckbox.checked = true;
        toggleRequesterSameAsRecipient();
    }

    const duplicateGuardPassed = await validateDuplicateSubmitGuard();
    if (!duplicateGuardPassed) {
        return;
    }

    const werfsleutelChannelLabel = formData.werfsleutelChannelLabel
        || translateKey('werfsleutel.unknownChannel', {}, 'Onbekend kanaal');
    const werfsleutelNote = `Werfsleutel ${formData.werfsleutel} (${formData.werfsleutelTitle}, ${formatEuro(formData.werfsleutelPrice)}) via ${formData.werfsleutelChannel} (${werfsleutelChannelLabel})`;
    const durationDisplay = getSubscriptionDurationDescription(formData.duration, formData.durationLabel);

    const apiClient = getApiClient();
    if (!apiClient || typeof apiClient.post !== 'function') {
        showToast(translateKey('subscription.createRequiresBackend', {}, 'Abonnement aanmaken vereist backend API'), 'error');
        return;
    }

    const currentCustomer = readCurrentCustomer();
    const hadCurrentCustomer = Boolean(currentCustomer);
    const subscriptionPayload = {
        magazine: formData.magazine,
        duration: formData.duration,
        durationLabel: formData.durationLabel,
        startDate: formData.startDate,
        status: 'active',
        lastEdition: new Date().toISOString().split('T')[0]
    };

    const isExistingRecipient = recipientPayload.personId !== undefined && recipientPayload.personId !== null;
    const contactEntry = {
        type: isExistingRecipient ? 'Extra abonnement' : 'Nieuw abonnement',
        description: isExistingRecipient
            ? `Extra abonnement ${formData.magazine} (${durationDisplay}) toegevoegd. ${werfsleutelNote}.`
            : `Abonnement ${formData.magazine} (${durationDisplay}) aangemaakt via telefonische bestelling. ${werfsleutelNote}.`
    };

    const payload = {
        recipient: recipientPayload,
        requester: requesterPayload,
        subscription: subscriptionPayload,
        contactEntry
    };

    const { workflowsApiUrl } = getApiEndpoints();

    try {
        const response = await apiClient.post(`${workflowsApiUrl}/subscription-signup`, payload);
        const savedRecipient = response && response.recipient ? response.recipient : null;
        const savedRequester = response && response.requester ? response.requester : null;
        const createdRecipient = Boolean(response && response.createdRecipient);

        if (savedRecipient) {
            upsertCustomerInCache(savedRecipient);
        }

        if (savedRequester) {
            upsertCustomerInCache(savedRequester);
        }

        closeForm('newSubscriptionForm');
        showToast(
            createdRecipient
                ? translateKey('subscription.created', {}, 'Nieuw abonnement succesvol aangemaakt!')
                : translateKey('subscription.extraAdded', {}, 'Extra abonnement succesvol toegevoegd!'),
            'success'
        );

        if (savedRecipient && savedRecipient.id) {
            await selectCustomer(savedRecipient.id);
            if (createdRecipient && !hadCurrentCustomer) {
                showSuccessIdentificationPrompt(savedRecipient.id, `${savedRecipient.firstName} ${savedRecipient.lastName}`);
            }
        }
    } catch (error) {
        showToast(error.message || translateKey('subscription.createFailed', {}, 'Abonnement aanmaken via backend mislukt'), 'error');
        return;
    }

    const form = getElementById('subscriptionForm');
    if (form && typeof form.reset === 'function') {
        form.reset();
    }

    resetWerfsleutelPickerState();
    initializeSubscriptionRolesForForm();
}

export function getSubscriptionRequesterMetaLine(subscription) {
    if (!subscription || subscription.requesterPersonId === undefined || subscription.requesterPersonId === null) {
        return '';
    }

    const currentCustomer = readCurrentCustomer();
    const isRequesterCurrentCustomer = currentCustomer
        && Number(subscription.requesterPersonId) === Number(currentCustomer.id);
    if (isRequesterCurrentCustomer) {
        return '';
    }

    return `<br>${translateKey(
        'subscription.requestedPaidByPerson',
        { personId: subscription.requesterPersonId },
        `Aangevraagd/betaald door persoon #${subscription.requesterPersonId}`
    )}`;
}

export function editCustomer() {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        return;
    }

    setInputValue('editCustomerId', currentCustomer.id);

    const salutation = currentCustomer.salutation || 'Dhr.';
    setCheckedValue('editSalutation', salutation);

    setInputValue('editInitials', currentCustomer.firstName || '');
    setInputValue('editMiddleName', currentCustomer.middleName || '');
    setInputValue('editLastName', currentCustomer.lastName || '');

    setInputValue('editPostalCode', currentCustomer.postalCode || '');
    const houseNumberParts = splitHouseNumber(currentCustomer.houseNumber || '');
    setInputValue('editHouseNumber', houseNumberParts.houseNumber);
    setInputValue('editHouseExt', houseNumberParts.houseExt);

    const streetName = String(currentCustomer.address || '').replace(/ \d+.*$/, '');
    setInputValue('editAddress', streetName);
    setInputValue('editCity', currentCustomer.city || '');

    callLegacyFunction('setBirthdayFields', 'edit', currentCustomer.birthday);

    setInputValue('editEmail', currentCustomer.email || '');
    setInputValue('editPhone', currentCustomer.phone || '');

    setCheckedValue('editOptinEmail', currentCustomer.optinEmail || 'yes');
    setCheckedValue('editOptinPhone', currentCustomer.optinPhone || 'yes');
    setCheckedValue('editOptinPost', currentCustomer.optinPost || 'yes');

    showElement('editCustomerForm', 'flex');
}

export async function saveCustomerEdit(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    const customerId = parseNumericValue(getInputValue('editCustomerId'));
    if (customerId === null) {
        return;
    }

    const customer = readCustomers().find((item) => item.id === customerId);
    if (!customer) {
        return;
    }

    const birthday = callLegacyFunction('ensureBirthdayValue', 'edit', false);
    if (birthday === null) {
        return;
    }

    const updates = {
        salutation: getCheckedValue('editSalutation'),
        firstName: getInputValue('editInitials'),
        middleName: getInputValue('editMiddleName'),
        lastName: getInputValue('editLastName'),
        birthday,
        postalCode: getInputValue('editPostalCode').toUpperCase(),
        city: getInputValue('editCity'),
        email: getInputValue('editEmail'),
        phone: getInputValue('editPhone'),
        optinEmail: getCheckedValue('editOptinEmail'),
        optinPhone: getCheckedValue('editOptinPhone'),
        optinPost: getCheckedValue('editOptinPost')
    };

    const houseNumber = getInputValue('editHouseNumber');
    const houseExt = getInputValue('editHouseExt');
    updates.houseNumber = houseExt ? `${houseNumber}${houseExt}` : houseNumber;
    updates.address = `${getInputValue('editAddress')} ${updates.houseNumber}`;

    const { personsApiUrl } = getApiEndpoints();
    const apiClient = getApiClient();
    if (apiClient && typeof apiClient.patch === 'function' && typeof apiClient.post === 'function') {
        try {
            await apiClient.patch(`${personsApiUrl}/${customerId}`, updates);
            await apiClient.post(`${personsApiUrl}/${customerId}/contact-history`, {
                type: 'Gegevens gewijzigd',
                description: 'Klantgegevens bijgewerkt.'
            });

            closeForm('editCustomerForm');
            showToast(translateKey('customer.updated', {}, 'Klantgegevens succesvol bijgewerkt!'), 'success');
            await selectCustomer(customerId);
        } catch (error) {
            showToast(error.message || translateKey('customer.updateFailed', {}, 'Klantgegevens bijwerken via backend mislukt'), 'error');
        }
        return;
    }

    customer.salutation = updates.salutation;
    customer.firstName = updates.firstName;
    customer.middleName = updates.middleName;
    customer.lastName = updates.lastName;
    customer.birthday = updates.birthday;
    customer.postalCode = updates.postalCode;
    customer.houseNumber = updates.houseNumber;
    customer.address = updates.address;
    customer.city = updates.city;
    customer.email = updates.email;
    customer.phone = updates.phone;
    customer.optinEmail = updates.optinEmail;
    customer.optinPhone = updates.optinPhone;
    customer.optinPost = updates.optinPost;

    pushContactHistory(customer, {
        type: 'Gegevens gewijzigd',
        description: 'Klantgegevens bijgewerkt.'
    });

    saveCustomers();
    closeForm('editCustomerForm');
    showToast(translateKey('customer.updated', {}, 'Klantgegevens succesvol bijgewerkt!'), 'success');
    await selectCustomer(customerId);
}

export function showResendMagazine() {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        showToast(translateKey('customer.selectFirst', {}, 'Selecteer eerst een klant'), 'error');
        return;
    }

    const subscriptionSelect = getElementById('resendSubscription');
    if (!subscriptionSelect) {
        return;
    }

    const subscriptions = Array.isArray(currentCustomer.subscriptions) ? currentCustomer.subscriptions : [];
    const defaultOption = `<option value="">${translateKey('resend.selectSubscription', {}, 'Selecteer abonnement...')}</option>`;
    const subscriptionOptions = subscriptions.map((subscription) => {
        const editionLabel = translateKey('subscription.lastEditionLabel', {}, 'Laatste editie');
        return `<option value="${subscription.id}">${subscription.magazine} - ${editionLabel}: ${formatDate(subscription.lastEdition)}</option>`;
    }).join('');

    subscriptionSelect.innerHTML = `${defaultOption}${subscriptionOptions}`;
    showElement('resendMagazineForm', 'flex');
}

export async function resendMagazine() {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        showToast(translateKey('customer.selectFirst', {}, 'Selecteer eerst een klant'), 'error');
        return;
    }

    const subscriptionId = parseNumericValue(getInputValue('resendSubscription'));
    const reason = getInputValue('resendReason');

    if (!subscriptionId) {
        showToast(translateKey('subscription.selectOne', {}, 'Selecteer een abonnement'), 'error');
        return;
    }

    const subscriptions = Array.isArray(currentCustomer.subscriptions) ? currentCustomer.subscriptions : [];
    const subscription = subscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) {
        return;
    }

    const { subscriptionsApiUrl } = getApiEndpoints();
    const apiClient = getApiClient();
    if (apiClient && typeof apiClient.post === 'function') {
        try {
            await apiClient.post(`${subscriptionsApiUrl}/${currentCustomer.id}/${subscriptionId}/complaint`, { reason });
            closeForm('resendMagazineForm');
            showToast(
                translateKey('resend.editionResent', { magazine: subscription.magazine }, `Editie van ${subscription.magazine} wordt opnieuw verzonden!`),
                'success'
            );
            await selectCustomer(currentCustomer.id);
        } catch (error) {
            showToast(error.message || translateKey('resend.failed', {}, 'Opnieuw verzenden via backend mislukt'), 'error');
        }
        return;
    }

    const reasonTextByKey = {
        not_received: 'niet ontvangen',
        damaged: 'beschadigd',
        lost: 'kwijt',
        other: 'anders'
    };

    pushContactHistory(currentCustomer, {
        type: 'Editie verzonden',
        description: `Laatste editie van ${subscription.magazine} opnieuw verzonden. Reden: ${reasonTextByKey[reason]}.`
    });

    saveCustomers();
    closeForm('resendMagazineForm');
    showToast(
        translateKey('resend.editionResent', { magazine: subscription.magazine }, `Editie van ${subscription.magazine} wordt opnieuw verzonden!`),
        'success'
    );

    refreshContactHistory();
}

export function showEditorialComplaintForm() {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        showToast(translateKey('customer.selectFirst', {}, 'Selecteer eerst een klant'), 'error');
        return;
    }

    const magazineSelect = getElementById('editorialComplaintMagazine');
    if (!magazineSelect) {
        return;
    }

    const subscriptions = Array.isArray(currentCustomer.subscriptions) ? currentCustomer.subscriptions : [];
    const uniqueMagazines = [...new Set(subscriptions.map((subscription) => subscription.magazine))];

    if (uniqueMagazines.length === 0) {
        magazineSelect.innerHTML = `<option value="">${translateKey('subscription.noneAvailable', {}, 'Geen abonnementen beschikbaar')}</option>`;
    } else {
        const defaultOption = `<option value="">${translateKey('forms.selectMagazinePlaceholder', {}, 'Selecteer magazine...')}</option>`;
        const options = uniqueMagazines.map((magazine) => `<option value="${magazine}">${magazine}</option>`).join('');
        magazineSelect.innerHTML = `${defaultOption}${options}`;
    }

    setInputValue('editorialComplaintType', 'klacht');
    setInputValue('editorialComplaintCategory', 'inhoud');
    setInputValue('editorialComplaintDescription', '');
    setInputValue('editorialComplaintEdition', '');

    const followupCheckbox = getElementById('editorialComplaintFollowup');
    if (followupCheckbox) {
        followupCheckbox.checked = false;
    }

    showElement('editorialComplaintForm', 'flex');
}

export async function submitEditorialComplaint() {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        showToast(translateKey('customer.selectFirst', {}, 'Selecteer eerst een klant'), 'error');
        return;
    }

    const magazine = getInputValue('editorialComplaintMagazine');
    const complaintType = getInputValue('editorialComplaintType');
    const complaintCategory = getInputValue('editorialComplaintCategory');
    const description = getInputValue('editorialComplaintDescription').trim();
    const edition = getInputValue('editorialComplaintEdition').trim();
    const followupCheckbox = getElementById('editorialComplaintFollowup');
    const followup = Boolean(followupCheckbox && followupCheckbox.checked);

    if (!magazine) {
        showToast(translateKey('forms.selectMagazine', {}, 'Selecteer een magazine'), 'error');
        return;
    }

    if (!description) {
        showToast(translateKey('forms.descriptionRequired', {}, 'Voer een beschrijving in'), 'error');
        return;
    }

    const typeLabels = {
        klacht: 'Klacht',
        opmerking: 'Opmerking',
        suggestie: 'Suggestie',
        compliment: 'Compliment'
    };

    const categoryLabels = {
        inhoud: 'Inhoud artikel',
        foto: 'Foto/afbeelding',
        fout: 'Fout in tekst',
        programma: 'TV/Radio programma',
        puzzel: 'Puzzel',
        advertentie: 'Advertentie',
        overig: 'Overig'
    };

    const { personsApiUrl } = getApiEndpoints();
    const apiClient = getApiClient();
    if (apiClient && typeof apiClient.post === 'function') {
        try {
            await apiClient.post(`${personsApiUrl}/${currentCustomer.id}/editorial-complaints`, {
                magazine,
                type: complaintType,
                category: complaintCategory,
                description,
                edition,
                followup
            });

            closeForm('editorialComplaintForm');
            showToast(
                translateKey('editorial.registered', { typeLabel: typeLabels[complaintType] }, `${typeLabels[complaintType]} voor redactie geregistreerd!`),
                'success'
            );
            await selectCustomer(currentCustomer.id);
        } catch (error) {
            showToast(error.message || translateKey('editorial.registerFailed', {}, 'Redactie-item registreren via backend mislukt'), 'error');
        }
        return;
    }

    let historyDescription = `${typeLabels[complaintType]} voor redactie ${magazine} - ${categoryLabels[complaintCategory]}. ${description}`;
    if (edition) {
        historyDescription += ` Editie: ${edition}.`;
    }
    if (followup) {
        historyDescription += ' Klant verwacht terugkoppeling.';
    }

    pushContactHistory(currentCustomer, {
        type: `Redactie ${typeLabels[complaintType]}`,
        description: historyDescription
    });

    saveCustomers();
    closeForm('editorialComplaintForm');
    showToast(
        translateKey('editorial.registered', { typeLabel: typeLabels[complaintType] }, `${typeLabels[complaintType]} voor redactie geregistreerd!`),
        'success'
    );

    refreshContactHistory();
}

export function editSubscription(subscriptionId) {
    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        return;
    }

    const subscriptions = Array.isArray(currentCustomer.subscriptions) ? currentCustomer.subscriptions : [];
    const subscription = subscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) {
        showToast(translateKey('subscription.notFound', {}, 'Abonnement niet gevonden'), 'error');
        return;
    }

    setInputValue('editSubId', subscriptionId);
    setInputValue('editSubMagazine', subscription.magazine);
    setInputValue('editSubDuration', subscription.duration || '1-jaar');
    setInputValue('editSubStartDate', subscription.startDate);
    setInputValue('editSubStatus', subscription.status || 'active');

    showElement('editSubscriptionForm', 'flex');
}

export async function saveSubscriptionEdit(event) {
    if (event && typeof event.preventDefault === 'function') {
        event.preventDefault();
    }

    const currentCustomer = readCurrentCustomer();
    if (!currentCustomer) {
        return;
    }

    const subscriptionId = parseNumericValue(getInputValue('editSubId'));
    if (subscriptionId === null) {
        return;
    }

    const subscriptions = Array.isArray(currentCustomer.subscriptions) ? currentCustomer.subscriptions : [];
    const subscription = subscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) {
        showToast(translateKey('subscription.notFound', {}, 'Abonnement niet gevonden'), 'error');
        return;
    }

    const updates = {
        magazine: getInputValue('editSubMagazine'),
        duration: getInputValue('editSubDuration'),
        startDate: getInputValue('editSubStartDate'),
        status: getInputValue('editSubStatus')
    };

    const previousValues = {
        magazine: subscription.magazine,
        duration: subscription.duration,
        status: subscription.status
    };

    const changeDescriptions = getSubscriptionChanges(previousValues, updates);
    const descriptionText = changeDescriptions.length > 0 ? changeDescriptions.join('. ') : 'Geen wijzigingen gedetecteerd';

    const { personsApiUrl, subscriptionsApiUrl } = getApiEndpoints();
    const apiClient = getApiClient();
    if (apiClient && typeof apiClient.patch === 'function' && typeof apiClient.post === 'function') {
        try {
            await apiClient.patch(`${subscriptionsApiUrl}/${currentCustomer.id}/${subscriptionId}`, updates);
            await apiClient.post(`${personsApiUrl}/${currentCustomer.id}/contact-history`, {
                type: 'Abonnement gewijzigd',
                description: `Abonnement bewerkt. ${descriptionText}.`
            });

            closeForm('editSubscriptionForm');
            showToast(translateKey('subscription.updated', {}, 'Abonnement succesvol bijgewerkt!'), 'success');
            await selectCustomer(currentCustomer.id);
        } catch (error) {
            showToast(error.message || translateKey('subscription.updateFailed', {}, 'Abonnement bijwerken via backend mislukt'), 'error');
        }
        return;
    }

    subscription.magazine = updates.magazine;
    subscription.duration = updates.duration;
    subscription.startDate = updates.startDate;
    subscription.status = updates.status;

    pushContactHistory(currentCustomer, {
        type: 'Abonnement gewijzigd',
        description: `Abonnement bewerkt. ${descriptionText}.`
    });

    saveCustomers();
    closeForm('editSubscriptionForm');
    showToast(translateKey('subscription.updated', {}, 'Abonnement succesvol bijgewerkt!'), 'success');
    await selectCustomer(currentCustomer.id);
}

function installLegacyCompatibilityExports() {
    if (compatibilityExportsInstalled) {
        return;
    }

    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope.showNewSubscription = showNewSubscription;
    globalScope.createSubscription = createSubscription;
    globalScope.getSubscriptionRequesterMetaLine = getSubscriptionRequesterMetaLine;
    globalScope.editCustomer = editCustomer;
    globalScope.saveCustomerEdit = saveCustomerEdit;
    globalScope.showResendMagazine = showResendMagazine;
    globalScope.resendMagazine = resendMagazine;
    globalScope.showEditorialComplaintForm = showEditorialComplaintForm;
    globalScope.submitEditorialComplaint = submitEditorialComplaint;
    globalScope.editSubscription = editSubscription;
    globalScope.saveSubscriptionEdit = saveSubscriptionEdit;

    compatibilityExportsInstalled = true;
}

export function registerSubscriptionWorkflowSlice(actionRouter) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    installLegacyCompatibilityExports();

    actionRouter.registerMany({
        'show-new-subscription': () => {
            showNewSubscription();
        },
        'create-subscription': (_payload, context) => {
            void createSubscription(context.event);
        },
        'edit-customer': () => {
            editCustomer();
        },
        'save-customer-edit': (_payload, context) => {
            void saveCustomerEdit(context.event);
        },
        'show-resend-magazine': () => {
            showResendMagazine();
        },
        'resend-magazine': () => {
            void resendMagazine();
        },
        'show-editorial-complaint-form': () => {
            showEditorialComplaintForm();
        },
        'submit-editorial-complaint': () => {
            void submitEditorialComplaint();
        },
        'edit-subscription': (payload) => {
            const subscriptionId = parseNumericValue(payload.subId);
            if (subscriptionId === null) {
                return;
            }
            editSubscription(subscriptionId);
        },
        'save-subscription-edit': (_payload, context) => {
            void saveSubscriptionEdit(context.event);
        }
    });
}

export const __subscriptionWorkflowTestUtils = {
    getSubscriptionChanges,
    getSubscriptionDurationDescription
};
