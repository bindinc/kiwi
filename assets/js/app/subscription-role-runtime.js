// Runtime extracted from app.js for subscription-role form, duplicate guard,
// and person role-selection domains.
// This file is loaded as a classic script before app.js.

// ============================================================================
// Birthday helpers (shared across NAW forms)
// ============================================================================

const LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE = 'kiwiSubscriptionIdentityPricingHelpers';

function resolveSharedNormalizeNameFragment() {
    const globalScope = typeof window !== 'undefined'
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : null);
    const helperNamespace = globalScope
        ? globalScope[LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE]
        : null;
    const normalizeFromHelpers = helperNamespace && typeof helperNamespace.normalizeNameFragment === 'function'
        ? helperNamespace.normalizeNameFragment
        : null;

    if (normalizeFromHelpers) {
        return normalizeFromHelpers;
    }

    return function normalizeLocalNameFragment(value) {
        return String(value || '').replace(/[\s.]/g, '').toLowerCase();
    };
}

const BIRTHDAY_MONTHS = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maart' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Augustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
];

function populateBirthdayFields(prefix) {
    const daySelect = document.getElementById(`${prefix}BirthdayDay`);
    const monthSelect = document.getElementById(`${prefix}BirthdayMonth`);
    const yearSelect = document.getElementById(`${prefix}BirthdayYear`);

    if (!daySelect || !monthSelect || !yearSelect) return;

    // Populate Days
    if (daySelect.options.length <= 1) {
        for (let i = 1; i <= 31; i++) {
            const day = String(i).padStart(2, '0');
            const option = document.createElement('option');
            option.value = day;
            option.textContent = i;
            daySelect.appendChild(option);
        }
    }

    // Populate Months
    if (monthSelect.options.length <= 1) {
        BIRTHDAY_MONTHS.forEach(month => {
            const option = document.createElement('option');
            option.value = month.value;
            option.textContent = month.label;
            monthSelect.appendChild(option);
        });
    }

    // Populate Years
    if (yearSelect.options.length <= 1) {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 120;
        for (let year = currentYear; year >= startYear; year--) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        }
    }
}

function buildBirthdayValue(prefix) {
    const day = document.getElementById(`${prefix}BirthdayDay`)?.value;
    const month = document.getElementById(`${prefix}BirthdayMonth`)?.value;
    const year = document.getElementById(`${prefix}BirthdayYear`)?.value;

    // If all empty, return empty string (valid, but empty)
    if (!day && !month && !year) return '';

    // If any is missing, return null (invalid)
    if (!day || !month || !year) return null;

    // Validate date
    const date = new Date(`${year}-${month}-${day}`);
    if (isNaN(date.getTime()) || date.getDate() !== parseInt(day) || date.getMonth() + 1 !== parseInt(month)) {
        return null; // Invalid date (e.g. 31 Feb)
    }

    return `${year}-${month}-${day}`;
}

function ensureBirthdayValue(prefix, required = false) {
    const birthday = buildBirthdayValue(prefix);

    if (birthday === null) {
         showToast(translate('forms.invalidBirthday', {}, 'Voer een geldige geboortedatum in'), 'error');
         return null;
    }

    if (!birthday && required) {
        showToast(translate('forms.invalidBirthday', {}, 'Voer een geldige geboortedatum in'), 'error');
        return null;
    }

    return birthday || '';
}

function setBirthdayFields(prefix, birthday) {
    const daySelect = document.getElementById(`${prefix}BirthdayDay`);
    const monthSelect = document.getElementById(`${prefix}BirthdayMonth`);
    const yearSelect = document.getElementById(`${prefix}BirthdayYear`);

    if (!daySelect || !monthSelect || !yearSelect) return;

    if (!birthday) {
        daySelect.value = '';
        monthSelect.value = '';
        yearSelect.value = '';
        return;
    }

    const [year, month, day] = birthday.split('-');
    if (year && month && day) {
        yearSelect.value = year;
        monthSelect.value = month;
        daySelect.value = day;
    }
}

// ============================================================================
// DRY: Reusable Customer Data Form Component
// ============================================================================

/**
 * Renders a unified customer data form into a container
 * @param {string} containerId - ID of the container element
 * @param {string} prefix - Prefix for all form field IDs (e.g., 'sub', 'article', 'transfer')
 * @param {object} config - Configuration options
 * @param {boolean} config.includePhone - Include phone field (default: true)
 * @param {boolean} config.includeEmail - Include email field (default: true)
 * @param {boolean} config.phoneRequired - Make phone required (default: false)
 * @param {boolean} config.emailRequired - Make email required (default: true)
 * @param {boolean} config.showSameAddressCheckbox - Show "same address" checkbox (default: false)
 */
function renderCustomerForm(containerId, prefix, config = {}) {
    const defaults = {
        includePhone: true,
        includeEmail: true,
        phoneRequired: false,
        emailRequired: true,
        showSameAddressCheckbox: false
    };
    const cfg = { ...defaults, ...config };
    const phonePlaceholderBase = translate('forms.phonePlaceholder', {}, 'Telefoonnummer');
    const emailPlaceholderBase = translate('forms.emailPlaceholder', {}, 'E-mailadres');
    const phonePlaceholder = `${phonePlaceholderBase}${cfg.phoneRequired ? '*' : ''}`;
    const emailPlaceholder = `${emailPlaceholderBase}${cfg.emailRequired ? '*' : ''}`;

    const html = `
        <h3 class="form-subtitle">${translate('forms.salutationLabel', {}, 'Aanhef *')}</h3>
        <div class="aanhef-row">
            <label><input type="radio" name="${prefix}Salutation" value="Dhr." required checked> ${translate('forms.salutationMr', {}, 'Dhr.')}</label>
            <label><input type="radio" name="${prefix}Salutation" value="Mevr."> ${translate('forms.salutationMrs', {}, 'Mevr.')}</label>
            <label><input type="radio" name="${prefix}Salutation" value="Anders"> ${translate('forms.salutationOther', {}, 'Anders')}</label>
        </div>
        
        <div class="form-row">
            <input type="text" id="${prefix}Initials" placeholder="${translate('forms.initialsPlaceholder', {}, 'Voorletters*')}" required>
            <input type="text" id="${prefix}MiddleName" placeholder="${translate('forms.middleNamePlaceholder', {}, 'Tussenvoegsel')}">
            <input type="text" id="${prefix}LastName" placeholder="${translate('forms.lastNamePlaceholder', {}, 'Achternaam*')}" required>
        </div>

        <div class="form-group">
            <label>${translate('forms.birthdayLabel', {}, 'Geboortedatum*')}</label>
            <div class="form-row">
                <select id="${prefix}BirthdayDay">
                    <option value="">${translate('forms.birthdayDayPlaceholder', {}, 'Dag')}</option>
                </select>
                <select id="${prefix}BirthdayMonth">
                    <option value="">${translate('forms.birthdayMonthPlaceholder', {}, 'Maand')}</option>
                </select>
                <select id="${prefix}BirthdayYear">
                    <option value="">${translate('forms.birthdayYearPlaceholder', {}, 'Jaar')}</option>
                </select>
            </div>
        </div>

        <div class="form-row">
            <input type="text" id="${prefix}PostalCode" placeholder="${translate('forms.postalCodePlaceholder', {}, 'Postcode*')}" pattern="^[1-9][0-9]{3}[a-zA-Z]{2}$" title="${translate('forms.postalCodeTitle', {}, 'Voer een geldige postcode in (bijv. 1234AB)')}" required>
            <input type="text" id="${prefix}HouseNumber" placeholder="${translate('forms.houseNumberPlaceholder', {}, 'Huisnr. (en letter)*')}" maxlength="7" pattern="^[1-9][0-9]{0,5}[A-Z]?$" title="${translate('forms.houseNumberTitle', {}, 'Voer een geldig huisnummer in (bijv. 123 of 123A)')}" required>
            <input type="text" id="${prefix}HouseExt" placeholder="${translate('forms.houseExtensionPlaceholder', {}, 'Toevoeging')}" maxlength="10">
        </div>
        
        <div class="form-row">
            <input type="text" id="${prefix}Address" placeholder="${translate('forms.streetPlaceholder', {}, 'Straat*')}" required>
            <input type="text" id="${prefix}City" placeholder="${translate('forms.cityPlaceholder', {}, 'Plaats*')}" required>
        </div>
        
        ${cfg.includePhone || cfg.includeEmail ? `
        <div class="form-row">
            ${cfg.includePhone ? `<input type="tel" id="${prefix}Phone" placeholder="${phonePlaceholder}" ${cfg.phoneRequired ? 'required' : ''}>` : ''}
            ${cfg.includeEmail ? `<input type="email" id="${prefix}Email" placeholder="${emailPlaceholder}" ${cfg.emailRequired ? 'required' : ''}>` : ''}
        </div>
        ` : ''}
        
        ${cfg.showSameAddressCheckbox ? `
        <div class="form-group">
            <label>
                <input type="checkbox" id="${prefix}SameAddress" data-action="toggle-customer-form-address" data-action-event="change" data-arg-prefix="${prefix}">
                ${translate('forms.sameAddressAsOriginalSubscriber', {}, 'Zelfde adres als originele abonnee')}
            </label>
        </div>
        ` : ''}
    `;

    document.getElementById(containerId).innerHTML = html;
    populateBirthdayFields(prefix);
}

/**
 * Gets customer data from a rendered customer form
 * @param {string} prefix - Prefix used when rendering the form
 * @returns {object} Customer data object
 */
function getCustomerFormData(prefix) {
    return {
        salutation: document.querySelector(`input[name="${prefix}Salutation"]:checked`)?.value || '',
        initials: document.getElementById(`${prefix}Initials`)?.value || '',
        middleName: document.getElementById(`${prefix}MiddleName`)?.value || '',
        lastName: document.getElementById(`${prefix}LastName`)?.value || '',
        birthday: buildBirthdayValue(prefix) || '',
        postalCode: document.getElementById(`${prefix}PostalCode`)?.value || '',
        houseNumber: document.getElementById(`${prefix}HouseNumber`)?.value || '',
        houseExt: document.getElementById(`${prefix}HouseExt`)?.value || '',
        address: document.getElementById(`${prefix}Address`)?.value || '',
        city: document.getElementById(`${prefix}City`)?.value || '',
        phone: document.getElementById(`${prefix}Phone`)?.value || '',
        email: document.getElementById(`${prefix}Email`)?.value || ''
    };
}

/**
 * Sets customer data in a rendered customer form
 * @param {string} prefix - Prefix used when rendering the form
 * @param {object} data - Customer data object
 */
function setCustomerFormData(prefix, data) {
    if (data.salutation) {
        const salutationRadio = document.querySelector(`input[name="${prefix}Salutation"][value="${data.salutation}"]`);
        if (salutationRadio) salutationRadio.checked = true;
    }
    if (data.initials) document.getElementById(`${prefix}Initials`).value = data.initials;
    if (data.middleName) document.getElementById(`${prefix}MiddleName`).value = data.middleName;
    if (data.lastName) document.getElementById(`${prefix}LastName`).value = data.lastName;
    if (data.birthday) setBirthdayFields(prefix, data.birthday);
    if (data.postalCode) document.getElementById(`${prefix}PostalCode`).value = data.postalCode;
    if (data.houseNumber) document.getElementById(`${prefix}HouseNumber`).value = data.houseNumber;
    if (data.houseExt) document.getElementById(`${prefix}HouseExt`).value = data.houseExt;
    if (data.address) document.getElementById(`${prefix}Address`).value = data.address;
    if (data.city) document.getElementById(`${prefix}City`).value = data.city;
    if (data.phone && document.getElementById(`${prefix}Phone`)) document.getElementById(`${prefix}Phone`).value = data.phone;
    if (data.email && document.getElementById(`${prefix}Email`)) document.getElementById(`${prefix}Email`).value = data.email;
}

/**
 * Toggles address fields visibility (for "same address" checkbox)
 * @param {string} prefix - Prefix used when rendering the form
 */
function toggleCustomerFormAddress(prefix) {
    const checkbox = document.getElementById(`${prefix}SameAddress`);
    const addressFields = ['PostalCode', 'HouseNumber', 'HouseExt', 'Address', 'City'];
    
    addressFields.forEach(field => {
        const element = document.getElementById(`${prefix}${field}`);
        if (element) {
            if (checkbox.checked) {
                element.disabled = true;
                element.removeAttribute('required');
                element.style.opacity = '0.5';
            } else {
                element.disabled = false;
                if (!field.includes('HouseExt') && !field.includes('MiddleName')) {
                    element.setAttribute('required', '');
                }
                element.style.opacity = '1';
            }
        }
    });
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getSubscriptionRoleConfig(role) {
    if (role === 'recipient') {
        return {
            roleLabel: 'ontvanger',
            prefix: 'subRecipient',
            modeName: 'recipientMode',
            existingSectionId: 'recipientExistingSection',
            createSectionId: 'recipientCreateSection',
            createFormContainerId: 'recipientCreateForm',
            duplicateCheckId: 'recipientDuplicateCheck',
            searchQueryId: 'recipientSearchQuery',
            searchResultsId: 'recipientSearchResults',
            selectedPersonId: 'recipientSelectedPerson'
        };
    }

    if (role === 'requester') {
        return {
            roleLabel: 'aanvrager/betaler',
            prefix: 'subRequester',
            modeName: 'requesterMode',
            existingSectionId: 'requesterExistingSection',
            createSectionId: 'requesterCreateSection',
            createFormContainerId: 'requesterCreateForm',
            duplicateCheckId: 'requesterDuplicateCheck',
            searchQueryId: 'requesterSearchQuery',
            searchResultsId: 'requesterSearchResults',
            selectedPersonId: 'requesterSelectedPerson'
        };
    }

    return null;
}

function buildPersonDisplayName(person) {
    if (!person) {
        return '';
    }
    const middleName = person.middleName ? `${person.middleName} ` : '';
    return `${person.firstName || ''} ${middleName}${person.lastName || ''}`.trim();
}

function buildPersonDisplayAddress(person) {
    if (!person) {
        return '';
    }
    const postalCode = (person.postalCode || '').trim();
    const city = (person.city || '').trim();
    if (!postalCode && !city) {
        return '';
    }
    return `${postalCode} ${city}`.trim();
}

function formatPersonReference(personId) {
    return translate('common.personWithId', { id: personId }, `persoon #${personId}`);
}

function renderSubscriptionRoleSelectedPerson(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    const selectedNode = document.getElementById(cfg.selectedPersonId);
    if (!selectedNode) return;

    const selectedPerson = subscriptionRoleState[role].selectedPerson;
    if (!selectedPerson || selectedPerson.id === undefined || selectedPerson.id === null) {
        selectedNode.classList.add('empty');
        selectedNode.textContent = role === 'recipient'
            ? translate('subscription.recipientNotSelected', {}, 'Geen ontvanger geselecteerd')
            : translate('subscription.requesterNotSelected', {}, 'Geen aanvrager/betaler geselecteerd');
        return;
    }

    const name = escapeHtml(buildPersonDisplayName(selectedPerson) || formatPersonReference(selectedPerson.id));
    const address = escapeHtml(buildPersonDisplayAddress(selectedPerson));
    const personId = escapeHtml(formatPersonReference(selectedPerson.id));
    const addressLine = address ? ` · ${address}` : '';
    selectedNode.classList.remove('empty');
    selectedNode.innerHTML = `<strong>${name}</strong> · ${personId}${addressLine}`;
}

function renderRequesterSameSummary() {
    const summaryNode = document.getElementById('requesterSameSummary');
    if (!summaryNode) return;

    if (!subscriptionRoleState.requesterSameAsRecipient) {
        summaryNode.textContent = '';
        return;
    }

    const recipient = subscriptionRoleState.recipient.selectedPerson;
    if (recipient && recipient.id !== undefined && recipient.id !== null) {
        const name = escapeHtml(buildPersonDisplayName(recipient) || formatPersonReference(recipient.id));
        summaryNode.innerHTML = translate(
            'subscription.requesterFollowsRecipient',
            { name, person: formatPersonReference(recipient.id) },
            `Aanvrager/betaler volgt de ontvanger: <strong>${name}</strong> · ${formatPersonReference(recipient.id)}.`
        );
        return;
    }

    if (subscriptionRoleState.recipient.mode === 'create') {
        const initials = document.getElementById('subRecipientInitials')?.value?.trim() || '';
        const middleName = document.getElementById('subRecipientMiddleName')?.value?.trim() || '';
        const lastName = document.getElementById('subRecipientLastName')?.value?.trim() || '';
        const composedName = [initials, middleName, lastName].filter(Boolean).join(' ');
        if (composedName) {
            const safeComposedName = escapeHtml(composedName);
            summaryNode.innerHTML = translate(
                'subscription.requesterFollowsNewRecipient',
                { name: safeComposedName },
                `Aanvrager/betaler volgt de nieuwe ontvanger: <strong>${safeComposedName}</strong>.`
            );
            return;
        }
    }

    summaryNode.textContent = translate(
        'subscription.requesterFollowsSelectedRecipient',
        {},
        'Aanvrager/betaler volgt de geselecteerde ontvanger.'
    );
}

function clearSubscriptionRoleCreateForm(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    const formContainer = document.getElementById(cfg.createFormContainerId);
    if (!formContainer) return;

    formContainer.innerHTML = '';
    clearSubscriptionDuplicateUi(role);
}

function ensureSubscriptionRoleCreateForm(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    const formContainer = document.getElementById(cfg.createFormContainerId);
    if (!formContainer) return;

    if (formContainer.childElementCount === 0) {
        renderCustomerForm(cfg.createFormContainerId, cfg.prefix, {
            includePhone: true,
            includeEmail: true,
            phoneRequired: false,
            emailRequired: true
        });
    }

    bindSubscriptionDuplicateListeners(role);
    void evaluateSubscriptionDuplicateRole(role);
}

function setSubscriptionRoleMode(role, mode) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    subscriptionRoleState[role].mode = mode === 'create' ? 'create' : 'existing';

    const modeRadio = document.querySelector(`input[name="${cfg.modeName}"][value="${subscriptionRoleState[role].mode}"]`);
    if (modeRadio) {
        modeRadio.checked = true;
    }

    const existingSection = document.getElementById(cfg.existingSectionId);
    const createSection = document.getElementById(cfg.createSectionId);
    if (existingSection) existingSection.style.display = subscriptionRoleState[role].mode === 'existing' ? 'block' : 'none';
    if (createSection) createSection.style.display = subscriptionRoleState[role].mode === 'create' ? 'block' : 'none';

    if (subscriptionRoleState[role].mode === 'create') {
        ensureSubscriptionRoleCreateForm(role);
        subscriptionRoleState[role].selectedPerson = null;
        renderSubscriptionRoleSelectedPerson(role);
    } else {
        resetSubscriptionDuplicateRoleState(role);
        clearSubscriptionRoleCreateForm(role);
    }

    if (role === 'recipient' && subscriptionRoleState.requesterSameAsRecipient) {
        renderRequesterSameSummary();
    }
}

function toggleRequesterSameAsRecipient() {
    const sameCheckbox = document.getElementById('requesterSameAsRecipient');
    const requesterDetails = document.getElementById('requesterRoleDetails');
    const sameSummary = document.getElementById('requesterSameSummary');
    if (!sameCheckbox) {
        return;
    }

    subscriptionRoleState.requesterSameAsRecipient = sameCheckbox.checked;
    if (requesterDetails) {
        requesterDetails.style.display = sameCheckbox.checked ? 'none' : 'block';
    }
    if (sameSummary) {
        sameSummary.style.display = sameCheckbox.checked ? 'block' : 'none';
    }

    if (sameCheckbox.checked) {
        resetSubscriptionDuplicateRoleState('requester');
        clearSubscriptionRoleCreateForm('requester');
        renderRequesterSameSummary();
    } else if (subscriptionRoleState.requester.mode === 'create') {
        ensureSubscriptionRoleCreateForm('requester');
    }
}

function getSelectedSubscriptionRolePersonId(role) {
    const selectedPerson = subscriptionRoleState[role]?.selectedPerson;
    if (!selectedPerson || selectedPerson.id === undefined || selectedPerson.id === null) {
        return null;
    }

    const personId = Number(selectedPerson.id);
    return Number.isFinite(personId) ? personId : null;
}

function hasSameSelectedExistingRecipientAndRequester() {
    const recipientIsExisting = subscriptionRoleState.recipient.mode === 'existing';
    const requesterIsExisting = subscriptionRoleState.requester.mode === 'existing';
    if (!recipientIsExisting || !requesterIsExisting) {
        return false;
    }

    const recipientId = getSelectedSubscriptionRolePersonId('recipient');
    const requesterId = getSelectedSubscriptionRolePersonId('requester');
    if (recipientId === null || requesterId === null) {
        return false;
    }

    return recipientId === requesterId;
}

function normalizeRequesterSameAsRecipientSelection(options = {}) {
    const { silent = false } = options;
    if (subscriptionRoleState.requesterSameAsRecipient) {
        return false;
    }

    if (!hasSameSelectedExistingRecipientAndRequester()) {
        return false;
    }

    const sameCheckbox = document.getElementById('requesterSameAsRecipient');
    if (sameCheckbox && !sameCheckbox.checked) {
        sameCheckbox.checked = true;
    }

    toggleRequesterSameAsRecipient();

    if (!silent) {
        showToast(
            translate(
                'subscription.samePersonAutoEnabled',
                {},
                'Ontvanger en aanvrager zijn dezelfde persoon. "Zelfde persoon als ontvanger" is automatisch ingeschakeld.'
            ),
            'info'
        );
    }

    return true;
}

function normalizeRoleSearchQuery(value) {
    return String(value || '').trim();
}

function getSubscriptionDuplicateRoleState(role) {
    return subscriptionDuplicateState[role] || null;
}

function clearSubscriptionDuplicateDebounceTimer(roleDuplicateState) {
    if (!roleDuplicateState || !roleDuplicateState.debounceTimer) {
        return;
    }
    window.clearTimeout(roleDuplicateState.debounceTimer);
    roleDuplicateState.debounceTimer = null;
}

function clearSubscriptionDuplicateUi(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    const duplicateNode = document.getElementById(cfg.duplicateCheckId);
    if (!duplicateNode) return;

    duplicateNode.classList.add('hidden');
    duplicateNode.innerHTML = '';
}

function resetSubscriptionDuplicateRoleState(role) {
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState) {
        return;
    }

    clearSubscriptionDuplicateDebounceTimer(roleDuplicateState);
    roleDuplicateState.requestVersion += 1;
    roleDuplicateState.lastApiStartedAt = 0;
    roleDuplicateState.lastApiFingerprint = '';
    roleDuplicateState.lastFingerprint = 'none';
    roleDuplicateState.acknowledgedFingerprint = '';
    roleDuplicateState.expandedFingerprint = '';
    roleDuplicateState.isExpanded = false;
    roleDuplicateState.isChecking = false;
    roleDuplicateState.apiWarning = '';
    roleDuplicateState.cache = {};
    roleDuplicateState.resolvedFingerprints = {};
    roleDuplicateState.strongMatches = [];
    clearSubscriptionDuplicateUi(role);
}

function resetAllSubscriptionDuplicateStates() {
    resetSubscriptionDuplicateRoleState('recipient');
    resetSubscriptionDuplicateRoleState('requester');
}

function normalizeDuplicatePostalCode(value) {
    return String(value || '').replace(/\s+/g, '').toUpperCase();
}

function normalizeDuplicateHouseToken(houseNumber, houseExt = '') {
    const combined = `${String(houseNumber || '').trim()}${String(houseExt || '').trim()}`;
    return combined.replace(/\s+/g, '').toUpperCase();
}

function normalizeDuplicateEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeDuplicateLastName(value) {
    const normalizeName = resolveSharedNormalizeNameFragment();
    return normalizeName(String(value || '').trim());
}

function buildSubscriptionDuplicateFingerprint(normalizedInput) {
    if (
        normalizedInput.postalCode
        && normalizedInput.houseToken
        && normalizedInput.lastNameNormalized
    ) {
        return `address:${normalizedInput.postalCode}:${normalizedInput.houseToken}:${normalizedInput.lastNameNormalized}`;
    }

    if (normalizedInput.email) {
        return `email:${normalizedInput.email}`;
    }

    if (normalizedInput.phoneDigits.length >= 9 && normalizedInput.lastNameNormalized) {
        return `phone:${normalizedInput.phoneDigits}:${normalizedInput.lastNameNormalized}`;
    }

    return 'none';
}

function normalizeSubscriptionDuplicateInput(data) {
    const lastNameRaw = String(data.lastName || '').trim();
    const middleNameRaw = String(data.middleName || '').trim();
    const postalCode = normalizeDuplicatePostalCode(data.postalCode);
    const houseToken = normalizeDuplicateHouseToken(data.houseNumber, data.houseExt);
    const email = normalizeDuplicateEmail(data.email);
    const phoneDigits = normalizePhone(String(data.phone || ''));
    const lastNameNormalized = normalizeDuplicateLastName(lastNameRaw);
    const fullLastNameNormalized = normalizeDuplicateLastName(`${middleNameRaw} ${lastNameRaw}`.trim());

    return {
        lastNameRaw,
        middleNameRaw,
        postalCode,
        houseToken,
        email,
        phoneDigits,
        lastNameNormalized,
        fullLastNameNormalized,
        fingerprint: buildSubscriptionDuplicateFingerprint({
            postalCode,
            houseToken,
            email,
            phoneDigits,
            lastNameNormalized
        })
    };
}

function collectSubscriptionRoleDuplicateInput(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) {
        return null;
    }

    const roleState = subscriptionRoleState[role];
    if (!roleState || roleState.mode !== 'create') {
        return null;
    }

    const data = getCustomerFormData(cfg.prefix);
    return normalizeSubscriptionDuplicateInput(data);
}

function buildSubscriptionDuplicateApiRequest(normalizedInput) {
    if (!normalizedInput || normalizedInput.fingerprint === 'none') {
        return null;
    }

    const params = new URLSearchParams({
        page: '1',
        pageSize: String(DUPLICATE_CHECK_FETCH_LIMIT),
        sortBy: 'name'
    });

    if (normalizedInput.fingerprint.startsWith('address:')) {
        params.set('postalCode', normalizedInput.postalCode);
        params.set('houseNumber', normalizedInput.houseToken);
        params.set('name', normalizedInput.lastNameRaw.toLowerCase());
    } else if (normalizedInput.fingerprint.startsWith('email:')) {
        params.set('email', normalizedInput.email);
    } else if (normalizedInput.fingerprint.startsWith('phone:')) {
        params.set('phone', normalizedInput.phoneDigits);
    } else {
        return null;
    }

    return {
        fingerprint: normalizedInput.fingerprint,
        params
    };
}

function normalizeCandidateHouseToken(candidate) {
    return normalizeDuplicateHouseToken(candidate.houseNumber, candidate.houseExt || '');
}

function isStrongDuplicateCandidate(candidate, normalizedInput) {
    if (!candidate || !normalizedInput) {
        return false;
    }

    const candidateEmail = normalizeDuplicateEmail(candidate.email);
    const candidatePhone = normalizePhone(String(candidate.phone || ''));
    const candidatePostalCode = normalizeDuplicatePostalCode(candidate.postalCode);
    const candidateHouseToken = normalizeCandidateHouseToken(candidate);
    const candidateLastName = normalizeDuplicateLastName(candidate.lastName);

    const emailMatch = Boolean(
        normalizedInput.email
        && candidateEmail
        && normalizedInput.email === candidateEmail
    );

    const phoneMatch = Boolean(
        normalizedInput.phoneDigits.length >= 9
        && candidatePhone
        && normalizedInput.phoneDigits === candidatePhone
    );

    const lastNameMatches = Boolean(
        candidateLastName
        && (
            candidateLastName === normalizedInput.lastNameNormalized
            || (normalizedInput.fullLastNameNormalized && candidateLastName === normalizedInput.fullLastNameNormalized)
        )
    );

    const addressMatch = Boolean(
        normalizedInput.postalCode
        && normalizedInput.houseToken
        && normalizedInput.lastNameNormalized
        && candidatePostalCode === normalizedInput.postalCode
        && candidateHouseToken === normalizedInput.houseToken
        && lastNameMatches
    );

    return emailMatch || phoneMatch || addressMatch;
}

function findStrongDuplicateMatches(normalizedInput, persons) {
    if (!normalizedInput || !Array.isArray(persons) || persons.length === 0) {
        return [];
    }

    const matches = [];
    const seenIds = new Set();
    for (const person of persons) {
        if (!person || person.id === undefined || person.id === null) {
            continue;
        }
        const personId = Number(person.id);
        if (seenIds.has(personId)) {
            continue;
        }
        if (!isStrongDuplicateCandidate(person, normalizedInput)) {
            continue;
        }
        seenIds.add(personId);
        matches.push(person);
    }

    return matches;
}

function mergeDuplicateMatchLists(primaryMatches, secondaryMatches) {
    const merged = [];
    const seenIds = new Set();

    for (const candidate of [...(primaryMatches || []), ...(secondaryMatches || [])]) {
        if (!candidate || candidate.id === undefined || candidate.id === null) {
            continue;
        }
        const candidateId = Number(candidate.id);
        if (seenIds.has(candidateId)) {
            continue;
        }
        seenIds.add(candidateId);
        merged.push(candidate);
    }

    return merged;
}

function getFreshSubscriptionDuplicateCacheEntry(roleDuplicateState, fingerprint) {
    if (!roleDuplicateState || !fingerprint || fingerprint === 'none') {
        return null;
    }

    const cacheEntry = roleDuplicateState.cache[fingerprint];
    if (!cacheEntry) {
        return null;
    }

    if (Date.now() - cacheEntry.cachedAt > DUPLICATE_CHECK_CACHE_TTL_MS) {
        delete roleDuplicateState.cache[fingerprint];
        return null;
    }

    return cacheEntry;
}

function refreshSubscriptionDuplicateMatches(role, normalizedInput) {
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState || !normalizedInput) {
        return [];
    }

    const localStrongMatches = findStrongDuplicateMatches(normalizedInput, customers);
    const cacheEntry = getFreshSubscriptionDuplicateCacheEntry(roleDuplicateState, normalizedInput.fingerprint);
    const cachedStrongMatches = cacheEntry ? cacheEntry.matches : [];

    roleDuplicateState.strongMatches = mergeDuplicateMatchLists(localStrongMatches, cachedStrongMatches);
    return roleDuplicateState.strongMatches;
}

function renderSubscriptionDuplicateCheck(role) {
    const cfg = getSubscriptionRoleConfig(role);
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!cfg || !roleDuplicateState) return;

    const duplicateNode = document.getElementById(cfg.duplicateCheckId);
    if (!duplicateNode) return;

    const roleState = subscriptionRoleState[role];
    if (!roleState || roleState.mode !== 'create') {
        clearSubscriptionDuplicateUi(role);
        return;
    }

    const matches = roleDuplicateState.strongMatches || [];
    const hasMatches = matches.length > 0;
    const hasFingerprint = roleDuplicateState.lastFingerprint !== 'none';
    const shouldShowChecking = hasFingerprint && roleDuplicateState.isChecking;
    const shouldShowWarning = Boolean(roleDuplicateState.apiWarning);

    if (!hasMatches && !shouldShowChecking && !shouldShowWarning) {
        clearSubscriptionDuplicateUi(role);
        return;
    }

    duplicateNode.classList.remove('hidden');

    if (!hasMatches) {
        const checkingLine = shouldShowChecking
            ? `<div class="subscription-duplicate-inline-status">${escapeHtml(translate('subscription.duplicateCheck.checking', {}, 'Zoeken naar bestaande personen...'))}</div>`
            : '';
        const warningLine = shouldShowWarning
            ? `<div class="subscription-duplicate-inline-status muted">${escapeHtml(roleDuplicateState.apiWarning)}</div>`
            : '';
        duplicateNode.innerHTML = `${checkingLine}${warningLine}`;
        return;
    }

    const isExpanded = roleDuplicateState.isExpanded && roleDuplicateState.expandedFingerprint === roleDuplicateState.lastFingerprint;
    const toggleLabel = isExpanded
        ? translate('subscription.duplicateCheck.hideMatches', {}, 'Verberg matches')
        : translate('subscription.duplicateCheck.showMatches', {}, 'Toon matches');
    const duplicateTitle = translate(
        'subscription.duplicateCheck.possibleFound',
        { count: matches.length },
        `Mogelijk bestaande persoon gevonden (${matches.length}).`
    );
    const createAnywayLabel = translate('subscription.duplicateCheck.createAnyway', {}, 'Toch nieuwe persoon');
    const useExistingLabel = translate('subscription.duplicateCheck.useExisting', {}, 'Gebruik bestaande');
    const visibleMatches = matches.slice(0, DUPLICATE_CHECK_VISIBLE_LIMIT);

    const matchRows = visibleMatches.map((person) => {
        const safeId = escapeHtml(person.id);
        const safeName = escapeHtml(buildPersonDisplayName(person) || `Persoon #${person.id}`);
        const safeAddress = escapeHtml(buildPersonDisplayAddress(person));
        const safeAddressLine = safeAddress ? ` · ${safeAddress}` : '';
        return `
            <div class="subscription-duplicate-item">
                <div>
                    <strong>${safeName}</strong>
                    <div class="subscription-duplicate-item-meta">persoon #${safeId}${safeAddressLine}</div>
                </div>
                <button type="button" class="subscription-duplicate-action" data-action="select-subscription-duplicate-person" data-arg-role="${role}" data-arg-person-id="${Number(person.id)}">${escapeHtml(useExistingLabel)}</button>
            </div>
        `;
    }).join('');

    const moreMatchesLine = matches.length > DUPLICATE_CHECK_VISIBLE_LIMIT
        ? `<div class="subscription-duplicate-more">Nog ${matches.length - DUPLICATE_CHECK_VISIBLE_LIMIT} mogelijke match(es).</div>`
        : '';
    const checkingLine = shouldShowChecking
        ? `<div class="subscription-duplicate-inline-status">${escapeHtml(translate('subscription.duplicateCheck.checking', {}, 'Zoeken naar bestaande personen...'))}</div>`
        : '';
    const warningLine = shouldShowWarning
        ? `<div class="subscription-duplicate-inline-status muted">${escapeHtml(roleDuplicateState.apiWarning)}</div>`
        : '';

    duplicateNode.innerHTML = `
        <div class="subscription-duplicate-banner">
            <div class="subscription-duplicate-header">
                <div class="subscription-duplicate-title">${escapeHtml(duplicateTitle)}</div>
                <div class="subscription-duplicate-actions">
                    <button type="button" class="subscription-duplicate-action" data-action="toggle-subscription-duplicate-matches" data-arg-role="${role}">${escapeHtml(toggleLabel)}</button>
                    <button type="button" class="subscription-duplicate-action warning" data-action="acknowledge-subscription-duplicate-warning" data-arg-role="${role}">${escapeHtml(createAnywayLabel)}</button>
                </div>
            </div>
            ${checkingLine}
            ${warningLine}
            ${isExpanded ? `<div class="subscription-duplicate-list">${matchRows}</div>${moreMatchesLine}` : ''}
        </div>
    `;
}

function toggleSubscriptionDuplicateMatches(role) {
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState || roleDuplicateState.lastFingerprint === 'none') {
        return;
    }

    const shouldExpand = !(roleDuplicateState.isExpanded && roleDuplicateState.expandedFingerprint === roleDuplicateState.lastFingerprint);
    roleDuplicateState.isExpanded = shouldExpand;
    roleDuplicateState.expandedFingerprint = shouldExpand ? roleDuplicateState.lastFingerprint : '';
    renderSubscriptionDuplicateCheck(role);
}

function acknowledgeSubscriptionDuplicateWarning(role) {
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState || roleDuplicateState.lastFingerprint === 'none') {
        return;
    }

    roleDuplicateState.acknowledgedFingerprint = roleDuplicateState.lastFingerprint;
    roleDuplicateState.isExpanded = false;
    roleDuplicateState.expandedFingerprint = '';
    renderSubscriptionDuplicateCheck(role);
}

function selectSubscriptionDuplicatePerson(role, personId) {
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState) {
        return;
    }

    const selectedPerson = (roleDuplicateState.strongMatches || [])
        .find((entry) => Number(entry.id) === Number(personId));
    if (!selectedPerson) {
        showToast(translate('subscription.duplicateCheck.personNotFoundControlList', {}, 'Geselecteerde persoon niet gevonden in controlelijst'), 'error');
        return;
    }

    upsertCustomerInCache(selectedPerson);
    subscriptionRoleState[role].searchResults = [selectedPerson];
    subscriptionRoleState[role].selectedPerson = selectedPerson;
    setSubscriptionRoleMode(role, 'existing');
    renderSubscriptionRoleSelectedPerson(role);

    if (role === 'recipient' && subscriptionRoleState.requesterSameAsRecipient) {
        renderRequesterSameSummary();
    }

    if (!subscriptionRoleState.requesterSameAsRecipient) {
        normalizeRequesterSameAsRecipientSelection();
    }
}

function waitForTimeout(milliseconds) {
    if (milliseconds <= 0) {
        return Promise.resolve();
    }
    return new Promise((resolve) => {
        window.setTimeout(resolve, milliseconds);
    });
}

async function runSubscriptionDuplicateApiCheck(role, expectedFingerprint, options = {}) {
    const { force = false } = options;
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState || !window.kiwiApi || !expectedFingerprint || expectedFingerprint === 'none') {
        return;
    }

    const roleState = subscriptionRoleState[role];
    if (!roleState || roleState.mode !== 'create') {
        return;
    }

    const normalizedInput = collectSubscriptionRoleDuplicateInput(role);
    if (!normalizedInput || normalizedInput.fingerprint !== expectedFingerprint) {
        roleDuplicateState.isChecking = false;
        renderSubscriptionDuplicateCheck(role);
        return;
    }

    const cacheEntry = getFreshSubscriptionDuplicateCacheEntry(roleDuplicateState, expectedFingerprint);
    if (cacheEntry) {
        roleDuplicateState.resolvedFingerprints[expectedFingerprint] = true;
        refreshSubscriptionDuplicateMatches(role, normalizedInput);
        roleDuplicateState.isChecking = false;
        renderSubscriptionDuplicateCheck(role);
        return;
    }

    if (!force && roleDuplicateState.resolvedFingerprints[expectedFingerprint]) {
        roleDuplicateState.isChecking = false;
        renderSubscriptionDuplicateCheck(role);
        return;
    }

    const apiRequest = buildSubscriptionDuplicateApiRequest(normalizedInput);
    if (!apiRequest || apiRequest.fingerprint !== expectedFingerprint) {
        roleDuplicateState.isChecking = false;
        renderSubscriptionDuplicateCheck(role);
        return;
    }

    const elapsedSinceLastApi = Date.now() - roleDuplicateState.lastApiStartedAt;
    const minimumWait = Math.max(0, DUPLICATE_CHECK_MIN_API_INTERVAL_MS - elapsedSinceLastApi);
    await waitForTimeout(minimumWait);

    const postWaitInput = collectSubscriptionRoleDuplicateInput(role);
    if (!postWaitInput || postWaitInput.fingerprint !== expectedFingerprint) {
        roleDuplicateState.isChecking = false;
        renderSubscriptionDuplicateCheck(role);
        return;
    }

    const requestVersion = roleDuplicateState.requestVersion + 1;
    roleDuplicateState.requestVersion = requestVersion;
    roleDuplicateState.lastApiStartedAt = Date.now();
    roleDuplicateState.lastApiFingerprint = expectedFingerprint;
    roleDuplicateState.apiWarning = '';
    roleDuplicateState.isChecking = true;
    renderSubscriptionDuplicateCheck(role);

    try {
        const payload = await window.kiwiApi.get(`${personsApiUrl}?${apiRequest.params.toString()}`);
        if (requestVersion !== roleDuplicateState.requestVersion) {
            return;
        }

        const latestInput = collectSubscriptionRoleDuplicateInput(role);
        if (!latestInput || latestInput.fingerprint !== expectedFingerprint) {
            return;
        }

        const items = Array.isArray(payload && payload.items) ? payload.items : [];
        const apiStrongMatches = findStrongDuplicateMatches(latestInput, items);
        roleDuplicateState.cache[expectedFingerprint] = {
            cachedAt: Date.now(),
            matches: apiStrongMatches
        };
        roleDuplicateState.resolvedFingerprints[expectedFingerprint] = true;
        refreshSubscriptionDuplicateMatches(role, latestInput);
        roleDuplicateState.isChecking = false;
        roleDuplicateState.apiWarning = '';
        renderSubscriptionDuplicateCheck(role);
    } catch (error) {
        if (requestVersion !== roleDuplicateState.requestVersion) {
            return;
        }

        const latestInput = collectSubscriptionRoleDuplicateInput(role);
        if (!latestInput || latestInput.fingerprint !== expectedFingerprint) {
            return;
        }

        roleDuplicateState.resolvedFingerprints[expectedFingerprint] = true;
        roleDuplicateState.isChecking = false;
        roleDuplicateState.apiWarning = translate(
            'subscription.duplicateCheck.apiFallback',
            {},
            'Controle via backend tijdelijk niet beschikbaar. Lokale controle blijft actief.'
        );
        refreshSubscriptionDuplicateMatches(role, latestInput);
        renderSubscriptionDuplicateCheck(role);
        console.warn('Achtergrondcontrole van dubbele personen via API mislukt.', error);
    }
}

function scheduleSubscriptionDuplicateApiCheck(role, expectedFingerprint) {
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState || !expectedFingerprint || expectedFingerprint === 'none') {
        return;
    }

    clearSubscriptionDuplicateDebounceTimer(roleDuplicateState);
    const elapsedSinceLastApi = Date.now() - roleDuplicateState.lastApiStartedAt;
    const minimumWait = Math.max(0, DUPLICATE_CHECK_MIN_API_INTERVAL_MS - elapsedSinceLastApi);
    const waitMs = Math.max(DUPLICATE_CHECK_DEBOUNCE_MS, minimumWait);

    roleDuplicateState.isChecking = true;
    roleDuplicateState.apiWarning = '';
    renderSubscriptionDuplicateCheck(role);

    roleDuplicateState.debounceTimer = window.setTimeout(() => {
        roleDuplicateState.debounceTimer = null;
        void runSubscriptionDuplicateApiCheck(role, expectedFingerprint);
    }, waitMs);
}

async function evaluateSubscriptionDuplicateRole(role, options = {}) {
    const { forceApi = false } = options;
    const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
    if (!roleDuplicateState) {
        return {
            fingerprint: 'none',
            strongMatches: []
        };
    }

    const normalizedInput = collectSubscriptionRoleDuplicateInput(role);
    if (!normalizedInput) {
        clearSubscriptionDuplicateDebounceTimer(roleDuplicateState);
        roleDuplicateState.isChecking = false;
        roleDuplicateState.strongMatches = [];
        roleDuplicateState.lastFingerprint = 'none';
        renderSubscriptionDuplicateCheck(role);
        return {
            fingerprint: 'none',
            strongMatches: []
        };
    }

    const previousFingerprint = roleDuplicateState.lastFingerprint;
    roleDuplicateState.lastFingerprint = normalizedInput.fingerprint;
    if (previousFingerprint !== normalizedInput.fingerprint) {
        roleDuplicateState.isExpanded = false;
        roleDuplicateState.expandedFingerprint = '';
        roleDuplicateState.apiWarning = '';
    }

    refreshSubscriptionDuplicateMatches(role, normalizedInput);
    roleDuplicateState.isChecking = false;
    renderSubscriptionDuplicateCheck(role);

    const apiRequest = buildSubscriptionDuplicateApiRequest(normalizedInput);
    if (!apiRequest || !window.kiwiApi) {
        clearSubscriptionDuplicateDebounceTimer(roleDuplicateState);
        return {
            fingerprint: normalizedInput.fingerprint,
            strongMatches: roleDuplicateState.strongMatches
        };
    }

    const cacheEntry = getFreshSubscriptionDuplicateCacheEntry(roleDuplicateState, normalizedInput.fingerprint);
    if (cacheEntry) {
        roleDuplicateState.resolvedFingerprints[normalizedInput.fingerprint] = true;
        refreshSubscriptionDuplicateMatches(role, normalizedInput);
        renderSubscriptionDuplicateCheck(role);
        return {
            fingerprint: normalizedInput.fingerprint,
            strongMatches: roleDuplicateState.strongMatches
        };
    }

    if (roleDuplicateState.resolvedFingerprints[normalizedInput.fingerprint] && !forceApi) {
        return {
            fingerprint: normalizedInput.fingerprint,
            strongMatches: roleDuplicateState.strongMatches
        };
    }

    if (forceApi) {
        await runSubscriptionDuplicateApiCheck(role, normalizedInput.fingerprint, { force: true });
        return {
            fingerprint: roleDuplicateState.lastFingerprint,
            strongMatches: roleDuplicateState.strongMatches
        };
    }

    scheduleSubscriptionDuplicateApiCheck(role, normalizedInput.fingerprint);
    return {
        fingerprint: normalizedInput.fingerprint,
        strongMatches: roleDuplicateState.strongMatches
    };
}

function bindSubscriptionDuplicateListeners(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    for (const inputSuffix of SUBSCRIPTION_DUPLICATE_INPUT_FIELDS) {
        const inputNode = document.getElementById(`${cfg.prefix}${inputSuffix}`);
        if (!inputNode || inputNode.dataset.subscriptionDuplicateBound === 'true') {
            continue;
        }

        inputNode.dataset.subscriptionDuplicateBound = 'true';
        inputNode.addEventListener('input', () => {
            void evaluateSubscriptionDuplicateRole(role);
            if (role === 'recipient' && subscriptionRoleState.requesterSameAsRecipient) {
                renderRequesterSameSummary();
            }
        });
        inputNode.addEventListener('blur', () => {
            void evaluateSubscriptionDuplicateRole(role);
        });
    }
}

async function validateSubscriptionDuplicateSubmitGuard() {
    const rolesToCheck = [];
    if (subscriptionRoleState.recipient.mode === 'create') {
        rolesToCheck.push('recipient');
    }
    if (!subscriptionRoleState.requesterSameAsRecipient && subscriptionRoleState.requester.mode === 'create') {
        rolesToCheck.push('requester');
    }

    for (const role of rolesToCheck) {
        await evaluateSubscriptionDuplicateRole(role, { forceApi: true });
        const roleDuplicateState = getSubscriptionDuplicateRoleState(role);
        if (!roleDuplicateState) {
            continue;
        }

        const fingerprint = roleDuplicateState.lastFingerprint;
        const hasStrongMatches = Array.isArray(roleDuplicateState.strongMatches) && roleDuplicateState.strongMatches.length > 0;
        const isAcknowledged = fingerprint !== 'none' && roleDuplicateState.acknowledgedFingerprint === fingerprint;
        if (!hasStrongMatches || isAcknowledged) {
            continue;
        }

        roleDuplicateState.isExpanded = true;
        roleDuplicateState.expandedFingerprint = fingerprint;
        renderSubscriptionDuplicateCheck(role);

        const roleLabel = getSubscriptionRoleConfig(role)?.roleLabel || 'persoon';
        showToast(
            translate(
                'subscription.duplicateCheck.submitAdvisory',
                { roleLabel },
                `Controleer mogelijke bestaande ${roleLabel} voordat u doorgaat.`
            ),
            'warning'
        );
        return false;
    }

    return true;
}

function searchPersonsLocallyForRole(query) {
    const normalizedQuery = normalizeRoleSearchQuery(query).toLowerCase();
    if (!normalizedQuery) {
        return [];
    }

    return customers.filter((person) => {
        const name = buildPersonDisplayName(person).toLowerCase();
        const email = (person.email || '').toLowerCase();
        const phone = normalizePhone(person.phone || '');
        const postalCode = (person.postalCode || '').toLowerCase();
        const queryPhone = normalizePhone(normalizedQuery);
        return name.includes(normalizedQuery)
            || email.includes(normalizedQuery)
            || postalCode.includes(normalizedQuery)
            || (queryPhone && phone.includes(queryPhone));
    }).slice(0, 10);
}

function renderSubscriptionRoleSearchResults(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    const resultsNode = document.getElementById(cfg.searchResultsId);
    if (!resultsNode) return;

    const results = subscriptionRoleState[role].searchResults || [];
    if (results.length === 0) {
        resultsNode.innerHTML = '';
        return;
    }

    resultsNode.innerHTML = results.map((person) => {
        const safeName = escapeHtml(buildPersonDisplayName(person) || formatPersonReference(person.id));
        const safeAddress = escapeHtml(buildPersonDisplayAddress(person));
        const safeId = escapeHtml(formatPersonReference(person.id));
        const safeAddressLine = safeAddress ? ` · ${safeAddress}` : '';
        const selectLabel = escapeHtml(translate('subscription.search.selectButton', {}, 'Selecteer'));
        return `
            <div class="party-search-result">
                <div>
                    <strong>${safeName}</strong>
                    <div class="party-search-result-meta">${safeId}${safeAddressLine}</div>
                </div>
                <button type="button" class="btn btn-small" data-action="select-subscription-role-person" data-arg-role="${role}" data-arg-person-id="${Number(person.id)}">${selectLabel}</button>
            </div>
        `;
    }).join('');
}

async function searchSubscriptionRolePerson(role) {
    const cfg = getSubscriptionRoleConfig(role);
    if (!cfg) return;

    const query = normalizeRoleSearchQuery(document.getElementById(cfg.searchQueryId)?.value);
    if (!query) {
        showToast(translate('subscription.search.enterQuery', {}, 'Voer eerst een zoekterm in'), 'warning');
        return;
    }

    let results = [];
    if (window.kiwiApi) {
        const params = new URLSearchParams({
            page: '1',
            pageSize: '10',
            sortBy: 'name'
        });

        if (query.includes('@')) {
            params.set('email', query.toLowerCase());
        } else {
            const numericPhone = normalizePhone(query);
            if (numericPhone.length >= 6) {
                params.set('phone', numericPhone);
            } else {
                params.set('name', query.toLowerCase());
            }
        }

        try {
            const payload = await window.kiwiApi.get(`${personsApiUrl}?${params.toString()}`);
            results = Array.isArray(payload && payload.items) ? payload.items : [];
        } catch (error) {
            showToast(error.message || translate('subscription.search.failed', {}, 'Zoeken van personen mislukt'), 'error');
            return;
        }
    } else {
        results = searchPersonsLocallyForRole(query);
    }

    subscriptionRoleState[role].searchResults = results;
    renderSubscriptionRoleSearchResults(role);
}

function selectSubscriptionRolePerson(role, personId) {
    const selected = (subscriptionRoleState[role].searchResults || [])
        .find((entry) => Number(entry.id) === Number(personId));
    if (!selected) {
        showToast(translate('subscription.search.personNotFound', {}, 'Geselecteerde persoon niet gevonden in zoekresultaat'), 'error');
        return;
    }

    subscriptionRoleState[role].selectedPerson = selected;
    renderSubscriptionRoleSelectedPerson(role);

    const cfg = getSubscriptionRoleConfig(role);
    const resultsNode = document.getElementById(cfg.searchResultsId);
    if (resultsNode) {
        resultsNode.innerHTML = '';
    }

    if (role === 'recipient' && subscriptionRoleState.requesterSameAsRecipient) {
        renderRequesterSameSummary();
    }

    if (!subscriptionRoleState.requesterSameAsRecipient) {
        normalizeRequesterSameAsRecipientSelection();
    }
}

function resetSubscriptionRoleState() {
    subscriptionRoleState.recipient.mode = 'existing';
    subscriptionRoleState.recipient.selectedPerson = null;
    subscriptionRoleState.recipient.searchResults = [];
    subscriptionRoleState.requester.mode = 'existing';
    subscriptionRoleState.requester.selectedPerson = null;
    subscriptionRoleState.requester.searchResults = [];
    subscriptionRoleState.requesterSameAsRecipient = true;
    resetAllSubscriptionDuplicateStates();
}

function createPersonPayloadFromForm(prefix, optinData = null) {
    const data = getCustomerFormData(prefix);
    const birthday = ensureBirthdayValue(prefix, false);
    if (birthday === null) {
        return null;
    }

    const initials = data.initials.trim();
    const middleName = data.middleName.trim();
    const lastName = data.lastName.trim();
    const street = data.address.trim();
    const houseNumber = data.houseNumber.trim();
    const houseExt = data.houseExt.trim();
    const combinedHouseNumber = `${houseNumber}${houseExt}`.trim();

    if (!initials || !lastName || !street || !houseNumber || !data.postalCode.trim() || !data.city.trim() || !data.email.trim()) {
        showToast(translate('forms.required', {}, 'Vul alle verplichte velden in'), 'error');
        return null;
    }

    const fullLastName = middleName ? `${middleName} ${lastName}` : lastName;
    const personPayload = {
        salutation: data.salutation,
        firstName: initials,
        middleName: middleName,
        lastName: fullLastName,
        birthday: birthday,
        postalCode: data.postalCode.trim().toUpperCase(),
        houseNumber: combinedHouseNumber,
        address: `${street} ${combinedHouseNumber}`.trim(),
        city: data.city.trim(),
        email: data.email.trim(),
        phone: data.phone.trim()
    };

    if (optinData) {
        personPayload.optinEmail = optinData.optinEmail;
        personPayload.optinPhone = optinData.optinPhone;
        personPayload.optinPost = optinData.optinPost;
    }

    return personPayload;
}

function buildSubscriptionRolePayload(role, options = {}) {
    if (role === 'requester' && subscriptionRoleState.requesterSameAsRecipient) {
        return { sameAsRecipient: true };
    }

    const roleState = subscriptionRoleState[role];
    const cfg = getSubscriptionRoleConfig(role);
    if (!roleState || !cfg) {
        showToast(translate('subscription.roleUnknown', {}, 'Onbekende persoonsrol in abonnement flow'), 'error');
        return null;
    }

    if (roleState.mode === 'existing') {
        if (!roleState.selectedPerson || roleState.selectedPerson.id === undefined || roleState.selectedPerson.id === null) {
            const message = role === 'recipient'
                ? translate('subscription.selectRecipientOrCreate', {}, 'Selecteer een ontvanger of kies "Nieuwe persoon".')
                : translate('subscription.selectRequesterOrCreate', {}, 'Selecteer een aanvrager/betaler of kies "Nieuwe persoon".');
            showToast(message, 'error');
            return null;
        }
        return { personId: Number(roleState.selectedPerson.id) };
    }

    if (roleState.mode === 'create') {
        const personPayload = createPersonPayloadFromForm(cfg.prefix, options.optinData || null);
        if (!personPayload) {
            return null;
        }
        return { person: personPayload };
    }

    showToast(translate('subscription.roleInvalid', {}, 'Persoonsrol onjuist ingesteld'), 'error');
    return null;
}

function initializeSubscriptionRolesForForm() {
    resetSubscriptionRoleState();

    const recipientSearchQuery = document.getElementById('recipientSearchQuery');
    if (recipientSearchQuery) recipientSearchQuery.value = '';
    const requesterSearchQuery = document.getElementById('requesterSearchQuery');
    if (requesterSearchQuery) requesterSearchQuery.value = '';

    setSubscriptionRoleMode('recipient', 'existing');
    setSubscriptionRoleMode('requester', 'existing');

    if (currentCustomer) {
        subscriptionRoleState.recipient.selectedPerson = currentCustomer;
        renderSubscriptionRoleSelectedPerson('recipient');
    } else {
        setSubscriptionRoleMode('recipient', 'create');
    }

    const sameCheckbox = document.getElementById('requesterSameAsRecipient');
    if (sameCheckbox) {
        sameCheckbox.checked = true;
    }
    toggleRequesterSameAsRecipient();
}

// ============================================================================
// End of DRY Component
// ============================================================================


if (typeof window !== 'undefined') {
    window.kiwiSubscriptionRoleRuntime = Object.assign(window.kiwiSubscriptionRoleRuntime || {}, {
        acknowledgeSubscriptionDuplicateWarning,
        bindSubscriptionDuplicateListeners,
        buildBirthdayValue,
        buildPersonDisplayAddress,
        buildPersonDisplayName,
        buildSubscriptionDuplicateApiRequest,
        buildSubscriptionDuplicateFingerprint,
        buildSubscriptionRolePayload,
        clearSubscriptionDuplicateDebounceTimer,
        clearSubscriptionDuplicateUi,
        clearSubscriptionRoleCreateForm,
        collectSubscriptionRoleDuplicateInput,
        createPersonPayloadFromForm,
        ensureBirthdayValue,
        ensureSubscriptionRoleCreateForm,
        escapeHtml,
        evaluateSubscriptionDuplicateRole,
        findStrongDuplicateMatches,
        formatPersonReference,
        getCustomerFormData,
        getFreshSubscriptionDuplicateCacheEntry,
        getSelectedSubscriptionRolePersonId,
        getSubscriptionDuplicateRoleState,
        getSubscriptionRoleConfig,
        hasSameSelectedExistingRecipientAndRequester,
        initializeSubscriptionRolesForForm,
        isStrongDuplicateCandidate,
        mergeDuplicateMatchLists,
        normalizeCandidateHouseToken,
        normalizeDuplicateEmail,
        normalizeDuplicateHouseToken,
        normalizeDuplicateLastName,
        normalizeDuplicatePostalCode,
        normalizeRequesterSameAsRecipientSelection,
        normalizeRoleSearchQuery,
        normalizeSubscriptionDuplicateInput,
        populateBirthdayFields,
        refreshSubscriptionDuplicateMatches,
        renderCustomerForm,
        renderRequesterSameSummary,
        renderSubscriptionDuplicateCheck,
        renderSubscriptionRoleSearchResults,
        renderSubscriptionRoleSelectedPerson,
        resetAllSubscriptionDuplicateStates,
        resetSubscriptionDuplicateRoleState,
        resetSubscriptionRoleState,
        runSubscriptionDuplicateApiCheck,
        scheduleSubscriptionDuplicateApiCheck,
        searchPersonsLocallyForRole,
        searchSubscriptionRolePerson,
        selectSubscriptionDuplicatePerson,
        selectSubscriptionRolePerson,
        setBirthdayFields,
        setCustomerFormData,
        setSubscriptionRoleMode,
        toggleCustomerFormAddress,
        toggleRequesterSameAsRecipient,
        toggleSubscriptionDuplicateMatches,
        validateSubscriptionDuplicateSubmitGuard,
        waitForTimeout
    });
}
