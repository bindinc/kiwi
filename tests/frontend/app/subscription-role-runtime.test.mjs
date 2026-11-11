import { renderAddressFields } from '../../../assets/js/app/address-fields.js';
import { sameSubscriptionPerson } from '../../../assets/js/app/subscription-shared-helpers.js';
import { createBootstrapSlice } from '../../../assets/js/app/slices/bootstrap-slice.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import en from '../../../assets/js/i18n/en.js';
import nl from '../../../assets/js/i18n/nl.js';

function createDuplicateRoleState() {
    return {
        debounceTimer: null,
        requestVersion: 0,
        lastApiStartedAt: 0,
        lastApiFingerprint: '',
        lastFingerprint: 'none',
        acknowledgedFingerprint: '',
        expandedFingerprint: '',
        isExpanded: false,
        isChecking: false,
        apiWarning: '',
        cache: {},
        resolvedFingerprints: {},
        strongMatches: []
    };
}

function createElementStub() {
    return {
        style: {},
        hidden: false,
        attributes: {},
        textContent: '',
        innerHTML: '',
        value: '',
        checked: false,
        disabled: false,
        childElementCount: 0,
        options: [],
        dataset: {},
        classList: {
            add() {},
            remove() {},
            toggle() {}
        },
        setAttribute(attribute, value) {
            this.attributes[attribute] = value;
            this[attribute] = true;
        },
        getAttribute(attribute) {
            return this.attributes[attribute] ?? null;
        },
        removeAttribute(attribute) {
            this[attribute] = false;
        },
        appendChild(child) {
            this.options.push(child);
        },
        addEventListener() {},
        querySelector() {
            return null;
        },
        querySelectorAll() {
            return [];
        }
    };
}

function createRuntimeContext(options = {}) {
    const sharedNormalizeNameFragment = options.sharedNormalizeNameFragment
        || ((value = '') => String(value || '').replace(/[\s.]/g, '').toLowerCase());
    const checkbox = { checked: Boolean(options.checkboxChecked), disabled: false };
    const eventListeners = new Map();
    const requesterRoleDetails = createElementStub();
    const requesterSameSummary = createElementStub();
    const modeRadios = {
        requesterExisting: { checked: false },
        requesterCreate: { checked: false },
        recipientExisting: { checked: false },
        recipientCreate: { checked: false }
    };
    const elementById = {
        requesterSameAsRecipient: checkbox,
        requesterRolePanel: createElementStub(),
        recipientRolePanel: createElementStub(),
        recipientPersonSearch: createElementStub(),
        recipientReuseCustomer: createElementStub(),
        requesterPersonSearch: createElementStub(),
        requesterReuseCustomer: createElementStub(),
        recipientSearchPostalCode: createElementStub(),
        recipientSearchHouseNumber: createElementStub(),
        recipientSearchQuery: createElementStub(),
        recipientSearchCustomerNumber: createElementStub(),
        recipientSearchEmail: createElementStub(),
        recipientSearchIban: createElementStub(),
        recipientSearchBirthDate: createElementStub(),
        recipientSearchPhone: createElementStub(),
        recipientSearchButton: createElementStub(),
        recipientSearchStatus: createElementStub(),
        requesterSearchPostalCode: createElementStub(),
        requesterSearchHouseNumber: createElementStub(),
        requesterSearchQuery: createElementStub(),
        requesterSearchCustomerNumber: createElementStub(),
        requesterSearchEmail: createElementStub(),
        requesterSearchIban: createElementStub(),
        requesterSearchBirthDate: createElementStub(),
        requesterSearchPhone: createElementStub(),
        requesterSearchButton: createElementStub(),
        requesterSearchStatus: createElementStub(),
        requesterRoleDetails,
        requesterSameSummary,
        subIBAN: createElementStub(),
        requesterSelectedPerson: createElementStub(),
        requesterSearchResults: createElementStub(),
        requesterDuplicateCheck: createElementStub(),
        requesterCreateForm: createElementStub(),
        requesterExistingSection: createElementStub(),
        requesterCreateSection: createElementStub(),
        subRequesterMiddleName: createElementStub(),
        subRequesterLastName: createElementStub(),
        subRequesterPostalCode: createElementStub(),
        subRequesterHouseNumber: createElementStub(),
        subRequesterHouseExt: createElementStub(),
        subRequesterAddressExtension: createElementStub(),
        subRequesterPhone: createElementStub(),
        subRequesterEmail: createElementStub(),
        recipientSelectedPerson: createElementStub(),
        recipientSearchResults: createElementStub(),
        recipientDuplicateCheck: createElementStub(),
        recipientCreateForm: createElementStub(),
        recipientExistingSection: createElementStub(),
        recipientCreateSection: createElementStub(),
        subRecipientMiddleName: createElementStub(),
        subRecipientInitials: createElementStub(),
        subRecipientLastName: createElementStub(),
        subRecipientBirthdayDay: createElementStub(),
        subRecipientBirthdayMonth: createElementStub(),
        subRecipientBirthdayYear: createElementStub(),
        subRecipientPostalCode: createElementStub(),
        subRecipientHouseNumber: createElementStub(),
        subRecipientHouseExt: createElementStub(),
        subRecipientAddressExtension: createElementStub(),
        subRecipientAddress: createElementStub(),
        subRecipientCity: createElementStub(),
        subRecipientPhone: createElementStub(),
        subRecipientLandlinePhone: createElementStub(),
        subRecipientMobilePhone: createElementStub(),
        subRecipientEmail: createElementStub()
    };
    for (const suffix of ['Initials', 'Address', 'City', 'BirthdayDay', 'BirthdayMonth', 'BirthdayYear', 'LandlinePhone', 'MobilePhone']) {
        elementById[`subRequester${suffix}`] = createElementStub();
    }
    const recipientSelectedPerson = options.recipientSelectedPerson || null;
    const requesterSelectedPerson = options.requesterSelectedPerson || null;
    const marketingInputs = Object.fromEntries(['Email', 'Phone', 'Post'].map(channel => [
        `subOptin${channel}`, ['yes', 'no'].map(value => ({ value, checked: false, disabled: false }))
    ]));

    const contextObject = {
        renderAddressFields,
        console,
        Date,
        URLSearchParams,
        window: null,
        __toasts: [],
        __upserts: [],
        document: {
            createElement() {
                return createElementStub();
            },
            getElementById(id) {
                return elementById[id] || null;
            },
            querySelectorAll(selector) {
                const name = selector.match(/^input\[name="(subOptin\w+)"\]$/)?.[1];
                return marketingInputs[name] || [];
            },
            querySelector(selector) {
                if (selector === 'input[name="requesterMode"][value="existing"]') {
                    return modeRadios.requesterExisting;
                }
                if (selector === 'input[name="requesterMode"][value="create"]') {
                    return modeRadios.requesterCreate;
                }
                if (selector === 'input[name="recipientMode"][value="existing"]') {
                    return modeRadios.recipientExisting;
                }
                if (selector === 'input[name="recipientMode"][value="create"]') {
                    return modeRadios.recipientCreate;
                }
                if (selector === 'input[name="subRecipientSalutation"]:checked') {
                    return { value: 'Dhr.' };
                }
                return null;
            }
        },
        CustomEvent: class CustomEvent {
            constructor(type, init = {}) {
                this.type = type;
                this.detail = init.detail;
            }
        },
        addEventListener(type, listener) {
            const existingListeners = eventListeners.get(type) || [];
            eventListeners.set(type, [...existingListeners, listener]);
        },
        removeEventListener(type, listener) {
            const existingListeners = eventListeners.get(type) || [];
            eventListeners.set(type, existingListeners.filter((candidate) => candidate !== listener));
        },
        dispatchEvent(event) {
            const listeners = eventListeners.get(event.type) || [];
            listeners.forEach((listener) => listener(event));
            return true;
        },
        showToast(message, type) {
            contextObject.__toasts.push({ message, type });
        },
        translate(_key, _params, fallback) {
            return fallback;
        },
        normalizePhone(value = '') {
            return String(value).replace(/\D+/g, '');
        },
        kiwiBasePath: '/kiwi',
        kiwiAssetPaths: {
            avrotrosLogo: '/assets/img/avrotros-logo.svg',
            kroncrvLogo: '/assets/img/kroncrv-logo.svg'
        },
        kiwiSubscriptionIdentityPricingHelpers: {
            sameSubscriptionPerson,
            normalizeNameFragment: sharedNormalizeNameFragment
        },
        DUPLICATE_CHECK_DEBOUNCE_MS: 750,
        DUPLICATE_CHECK_MIN_API_INTERVAL_MS: 1500,
        DUPLICATE_CHECK_CACHE_TTL_MS: 90 * 1000,
        DUPLICATE_CHECK_FETCH_LIMIT: 5,
        DUPLICATE_CHECK_VISIBLE_LIMIT: 3,
        SUBSCRIPTION_DUPLICATE_INPUT_FIELDS: [
            'MiddleName',
            'LastName',
            'PostalCode',
            'HouseNumber',
            'HouseExt',
            'Phone',
            'Email'
        ],
        customers: [],
        currentCustomer: null,
        personsApiUrl: '/api/v1/persons',
        subscriptionRoleState: {
            recipient: {
                mode: 'existing',
                selectedPerson: recipientSelectedPerson,
                searchResults: []
            },
            requester: {
                mode: 'existing',
                selectedPerson: requesterSelectedPerson,
                searchResults: []
            },
            requesterSameAsRecipient: false
        },
        subscriptionDuplicateState: {
            recipient: createDuplicateRoleState(),
            requester: createDuplicateRoleState()
        },
        upsertCustomerInCache(person) {
            contextObject.__upserts.push(person);
        },
        kiwiApi: options.kiwiApi || null,
        kiwiWerfsleutelSlice: {
            getSelections() {
                return options.werfsleutelSelections || [];
            }
        }
    };

    contextObject.window = contextObject;

    const context = vm.createContext(contextObject);
    const source = readFileSync(new URL('../../../assets/js/app/subscription-role-runtime.js', import.meta.url), 'utf8');
    vm.runInContext(source, context);

    return {
        context,
        elements: elementById,
        checkbox,
        runtime: context.window.kiwiSubscriptionRoleRuntime,
        marketingInputs
    };
}

function setDuplicateInput(elements, prefix, values) {
    elements[`${prefix}MiddleName`].value = values.middleName || '';
    elements[`${prefix}LastName`].value = values.lastName || '';
    elements[`${prefix}PostalCode`].value = values.postalCode || '';
    elements[`${prefix}HouseNumber`].value = values.houseNumber || '';
    elements[`${prefix}HouseExt`].value = values.houseExt || '';
    elements[`${prefix}Phone`].value = values.phone || '';
    elements[`${prefix}Email`].value = values.email || '';
}

function testSelectSubscriptionDuplicatePersonNormalizesSameRecipientRequester() {
    const samePerson = {
        id: 51,
        firstName: 'A',
        middleName: '',
        lastName: 'B',
        postalCode: '1234AB',
        city: 'Hilversum'
    };

    const { context, checkbox, runtime } = createRuntimeContext({
        checkboxChecked: false,
        recipientSelectedPerson: samePerson,
        requesterSelectedPerson: {
            id: 82,
            firstName: 'Other',
            middleName: '',
            lastName: 'Person'
        }
    });

    context.subscriptionDuplicateState.requester.strongMatches = [samePerson];
    runtime.selectSubscriptionDuplicatePerson('requester', 51);

    assert.equal(checkbox.checked, true);
    assert.equal(context.subscriptionRoleState.requesterSameAsRecipient, true);
    assert.equal(context.subscriptionRoleState.requester.selectedPerson.id, 51);
    assert.equal(context.__toasts.length, 1);
    assert.equal(context.__toasts[0].type, 'info');
}

function testEqualPersonNumbersAcrossMandantsDoNotMergeRecipientAndPayer() {
    const { context, checkbox, runtime } = createRuntimeContext({ checkboxChecked: false,
        recipientSelectedPerson: { id: 51, mandant: 'AVROTROS', credentialKey: 'avro' },
        requesterSelectedPerson: { id: 51, mandant: 'HMC', credentialKey: 'tvk' } });
    assert.equal(runtime.hasSameSelectedExistingRecipientAndRequester(), false);
    runtime.normalizeRequesterSameAsRecipientSelection();
    assert.equal(checkbox.checked, false);
    assert.equal(context.subscriptionRoleState.requesterSameAsRecipient, false);
}

function testNormalizeDuplicateLastNameUsesSharedHelpers() {
    const { runtime } = createRuntimeContext({
        sharedNormalizeNameFragment(value = '') {
            return `normalized:${String(value || '').toUpperCase()}`;
        }
    });

    assert.equal(runtime.normalizeDuplicateLastName('de Groot'), 'normalized:DE GROOT');
}

function testBuildSubscriptionRolePayloadKeepsExistingPersonCredentialContext() {
    const selectedPerson = {
        id: 73,
        firstName: 'Demo',
        middleName: '',
        lastName: 'Gebruiker',
        postalCode: '1217AA',
        houseNumber: '7',
            houseNumberAddition: '',
        address: 'Voorbeeldstraat 7',
        city: 'Hilversum',
        email: 'demo@example.org',
        phone: '0612345678',
        credentialKey: 'tvk',
        credentialTitle: 'TV Krant',
        mandant: 'HMC',
        supportsPersonLookup: true,
        sourceSystem: 'subscription-api',
        iban: 'NL12RABO0123456789'
    };

    const { runtime } = createRuntimeContext({
        recipientSelectedPerson: selectedPerson,
        werfsleutelSelections: [
            {
                selectedKey: {
                    salesCode: 'TVK1',
                    mandant: 'HMC',
                    divisionId: '14'
                },
                selectedChannel: 'OL',
                selectedChannelMeta: { key: 'OL' }
            }
        ]
    });

    runtime.populateSubscriptionRoleEditor('recipient');
    const payload = JSON.parse(JSON.stringify(runtime.buildSubscriptionRolePayload('recipient')));
    assert.equal(payload.personEdits.address, 'Voorbeeldstraat 7');
    assert.equal(payload.personEdits.street, 'Voorbeeldstraat');
    delete payload.personEdits;

    assert.deepEqual(payload, {
        personId: 73,
        credentialKey: 'tvk',
        credentialTitle: 'TV Krant',
        mandant: 'HMC',
        supportsPersonLookup: true,
        sourceSystem: 'subscription-api',
        person: {
            salutation: '',
            firstName: 'Demo',
            middleName: '',
            lastName: 'Gebruiker',
            birthday: '',
            personNumber: '',
            postalCode: '1217AA',
            houseNumber: '7',
            houseNumberAddition: '',
            address: 'Voorbeeldstraat 7',
            city: 'Hilversum',
            email: 'demo@example.org',
            phone: '0612345678',
            landlinePhone: '',
            mobilePhone: '',
            optinEmail: '',
            optinPhone: '',
            optinPost: '',
            iban: 'NL12RABO0123456789',
            credentialKey: 'tvk',
            credentialTitle: 'TV Krant',
            mandant: 'HMC',
            sourceSystem: 'subscription-api',
            supportsPersonLookup: true
        }
    });
}

function testNewSubscriptionPersonKeepsPpaPhoneTypesSeparate() {
    const { context, elements, runtime } = createRuntimeContext();
    context.subscriptionRoleState.recipient.mode = 'create';

    runtime.ensureSubscriptionRoleCreateForm('recipient');

    assert.match(elements.recipientCreateForm.innerHTML, /id="subRecipientLandlinePhone"/);
    assert.match(elements.recipientCreateForm.innerHTML, /id="subRecipientMobilePhone"/);
    assert.doesNotMatch(elements.recipientCreateForm.innerHTML, /id="subRecipientPhone"/);

    elements.subRecipientInitials.value = 'P.';
    elements.subRecipientLastName.value = 'Tester';
    elements.subRecipientBirthdayDay.value = '02';
    elements.subRecipientBirthdayMonth.value = '03';
    elements.subRecipientBirthdayYear.value = '1980';
    elements.subRecipientPostalCode.value = '1234 ab';
    elements.subRecipientHouseNumber.value = '10';
    elements.subRecipientAddress.value = 'Teststraat';
    elements.subRecipientCity.value = 'Hilversum';
    elements.subRecipientEmail.value = 'p.tester@example.org';
    elements.subRecipientLandlinePhone.value = '035-1234567';
    elements.subRecipientMobilePhone.value = '06-12345678';

    const payload = JSON.parse(JSON.stringify(runtime.buildSubscriptionRolePayload('recipient')));

    assert.equal(payload.person.landlinePhone, '035-1234567');
    assert.equal(payload.person.mobilePhone, '06-12345678');
    assert.equal(Object.hasOwn(payload.person, 'phone'), false);
}

function testNewSubscriptionPersonKeepsAddressExtensionsSeparate() {
    const { context, elements, runtime } = createRuntimeContext();
    context.subscriptionRoleState.recipient.mode = 'create';

    runtime.ensureSubscriptionRoleCreateForm('recipient');

    assert.match(elements.recipientCreateForm.innerHTML, /id="subRecipientHouseExt"/);
    assert.match(elements.recipientCreateForm.innerHTML, /id="subRecipientAddressExtension"/);
    assert.match(elements.recipientCreateForm.innerHTML, /\(interne\) Toevoeging 1/);

    elements.subRecipientInitials.value = 'P.';
    elements.subRecipientLastName.value = 'Tester';
    elements.subRecipientBirthdayDay.value = '02';
    elements.subRecipientBirthdayMonth.value = '03';
    elements.subRecipientBirthdayYear.value = '1980';
    elements.subRecipientPostalCode.value = '1234 ab';
    elements.subRecipientHouseNumber.value = '10A';
    elements.subRecipientHouseExt.value = '2';
    elements.subRecipientAddressExtension.value = '310';
    elements.subRecipientAddress.value = 'Teststraat';
    elements.subRecipientCity.value = 'Hilversum';
    elements.subRecipientEmail.value = 'p.tester@example.org';

    const payload = JSON.parse(JSON.stringify(runtime.buildSubscriptionRolePayload('recipient')));

    assert.equal(payload.person.houseNumber, '10A');
    assert.equal(payload.person.houseNumberAddition, '2');
    assert.equal(payload.person.postalCode, '1234AB');
    assert.equal(payload.person.city, 'HILVERSUM');
    assert.equal(payload.person.address, 'Teststraat 10A 2');
    assert.equal(payload.person.street, 'Teststraat');
    assert.equal(payload.person.addressExtension, '310');
}

function testPhoneTypeLabelsAreTranslated() {
    assert.equal(nl.forms.landlinePhonePlaceholder, 'Vast telefoonnummer');
    assert.equal(nl.forms.mobilePhonePlaceholder, 'Mobiel telefoonnummer');
    assert.equal(en.forms.landlinePhonePlaceholder, 'Landline phone number');
    assert.equal(en.forms.mobilePhonePlaceholder, 'Mobile phone number');
}

function testAddressExtensionLabelsAreTranslated() {
    assert.equal(nl.forms.houseExtensionPlaceholder, 'Huisnummer toevoeging');
    assert.equal(nl.forms.addressExtensionPlaceholder, '(interne) Toevoeging 1');
    assert.equal(en.forms.houseExtensionPlaceholder, 'House number addition');
    assert.equal(en.forms.addressExtensionPlaceholder, '(internal) Addition 1');
}

function testRefreshSubscriptionDuplicateMatchesIgnoresLocalCustomersWithoutBackendCache() {
    const localOnlyMatch = {
        id: 98,
        firstName: 'Lokaal',
        middleName: '',
        lastName: 'Gebruiker',
        postalCode: '1234AB',
        houseNumber: '12',
        city: 'Hilversum',
        email: 'local@example.org',
        phone: '0612345678'
    };

    const { context, runtime } = createRuntimeContext();
    context.customers = [localOnlyMatch];

    const normalizedInput = runtime.normalizeSubscriptionDuplicateInput({
        lastName: 'Gebruiker',
        middleName: '',
        postalCode: '1234 AB',
        houseNumber: '12',
        houseExt: '',
        email: 'local@example.org',
        phone: '0612345678'
    });

    const strongMatches = JSON.parse(JSON.stringify(
        runtime.refreshSubscriptionDuplicateMatches('recipient', normalizedInput)
    ));

    assert.deepEqual(strongMatches, []);
    assert.deepEqual(
        JSON.parse(JSON.stringify(context.subscriptionDuplicateState.recipient.strongMatches)),
        []
    );
}

function testRefreshSubscriptionDuplicateMatchesUsesBackendCachedMatchesOnly() {
    const localOnlyMatch = {
        id: 98,
        firstName: 'Lokaal',
        middleName: '',
        lastName: 'Gebruiker',
        postalCode: '1234AB',
        houseNumber: '12',
        city: 'Hilversum',
        email: 'local@example.org',
        phone: '0612345678'
    };
    const backendMatch = {
        id: 73,
        firstName: 'Backend',
        middleName: '',
        lastName: 'Gebruiker',
        postalCode: '1234AB',
        houseNumber: '12',
        city: 'Hilversum',
        email: 'backend@example.org',
        phone: '0612345678'
    };

    const { context, runtime } = createRuntimeContext();
    context.customers = [localOnlyMatch];

    const normalizedInput = runtime.normalizeSubscriptionDuplicateInput({
        lastName: 'Gebruiker',
        middleName: '',
        postalCode: '1234 AB',
        houseNumber: '12',
        houseExt: '',
        email: 'backend@example.org',
        phone: '0612345678'
    });

    context.subscriptionDuplicateState.recipient.cache[normalizedInput.fingerprint] = {
        cachedAt: Date.now(),
        matches: [backendMatch]
    };

    const strongMatches = JSON.parse(JSON.stringify(
        runtime.refreshSubscriptionDuplicateMatches('recipient', normalizedInput)
    ));

    assert.deepEqual(strongMatches, [backendMatch]);
    assert.deepEqual(
        JSON.parse(JSON.stringify(context.subscriptionDuplicateState.recipient.strongMatches)),
        [backendMatch]
    );
}

async function testSelectSubscriptionRolePersonHydratesDetailAndPrefillsIban() {
    let requestedUrl = '';
    const { context, elements, runtime } = createRuntimeContext({
        werfsleutelSelections: [{ selectedKey: { mandant: 'HMC' } }],
        kiwiApi: {
            get(url) {
                requestedUrl = url;
                return Promise.resolve({
                    id: 73,
                    personNumber: '41929371',
                    iban: 'NL80INGB0001340187',
                    email: 'detail@example.org'
                });
            }
        }
    });

    context.subscriptionRoleState.recipient.searchResults = [
        {
            id: 73,
            firstName: 'Demo',
            middleName: '',
            lastName: 'Gebruiker',
            credentialKey: 'tvk',
            credentialTitle: 'TV Krant',
            mandant: 'HMC',
            supportsPersonLookup: true,
            sourceSystem: 'subscription-api'
        }
    ];

    runtime.selectSubscriptionRolePerson('recipient', 73);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(requestedUrl, '/api/v1/persons/73?credentialKey=tvk&sourceSystem=subscription-api&mandant=HMC');
    assert.equal(context.subscriptionRoleState.recipient.selectedPerson.iban, 'NL80INGB0001340187');
    assert.equal(elements.subIBAN.value, 'NL80INGB0001340187');
    assert.equal(context.__upserts.length, 0);
}

function testRenderSelectedPersonShowsAvrotrosBadgeForHmcMandant() {
    const selectedPerson = {
        id: 41,
        personId: '12345',
        firstName: 'Demo',
        middleName: '',
        lastName: 'Gebruiker',
        postalCode: '1217AA',
        city: 'Hilversum',
        mandant: 'HMC'
    };

    const { elements, runtime } = createRuntimeContext({
        recipientSelectedPerson: selectedPerson
    });

    runtime.renderSubscriptionRoleSelectedPerson('recipient');

    assert.equal(elements.recipientSelectedPerson.innerHTML.includes('avrotros-logo.svg'), true);
    assert.equal(elements.recipientSelectedPerson.innerHTML.includes('alt="AVROTROS"'), true);
    assert.equal(elements.recipientSelectedPerson.innerHTML.includes('Abon.nr 12345'), true);
}

function testRenderSelectedPersonPrefersDivisionIdForBadge() {
    const selectedPerson = {
        id: 42,
        firstName: 'Demo',
        middleName: '',
        lastName: 'Gebruiker',
        postalCode: '1217AA',
        city: 'Hilversum',
        divisionId: 'HMC',
        mandant: 'KRONCRV'
    };

    const { elements, runtime } = createRuntimeContext({
        recipientSelectedPerson: selectedPerson
    });

    runtime.renderSubscriptionRoleSelectedPerson('recipient');

    assert.equal(elements.recipientSelectedPerson.innerHTML.includes('avrotros-logo.svg'), true);
    assert.equal(elements.recipientSelectedPerson.innerHTML.includes('kroncrv-logo.svg'), false);
}

function testRenderSelectedPersonFallsBackToMandantForUnknownDivisionId() {
    const selectedPerson = {
        id: 43,
        firstName: 'Demo',
        middleName: '',
        lastName: 'Gebruiker',
        postalCode: '1217AA',
        city: 'Hilversum',
        divisionId: '14',
        mandant: 'HMC'
    };

    const { elements, runtime } = createRuntimeContext({
        recipientSelectedPerson: selectedPerson
    });

    runtime.renderSubscriptionRoleSelectedPerson('recipient');

    assert.equal(elements.recipientSelectedPerson.innerHTML.includes('avrotros-logo.svg'), true);
    assert.equal(elements.recipientSelectedPerson.innerHTML.includes('alt="AVROTROS"'), true);
}

function testRenderSearchResultsShowsKroncrvBadgeAndUnknownFallback() {
    const { context, elements, runtime } = createRuntimeContext();

    context.subscriptionRoleState.requester.searchResults = [
        {
            id: 52,
            personId: '98765',
            firstName: 'Kro',
            middleName: '',
            lastName: 'Gebruiker',
            postalCode: '1234AB',
            city: 'Utrecht',
            mandant: 'KRONCRV'
        }
    ];
    runtime.renderSubscriptionRoleSearchResults('requester');
    assert.equal(elements.requesterSearchResults.innerHTML.includes('kroncrv-logo.svg'), true);
    assert.equal(elements.requesterSearchResults.innerHTML.includes('alt="KRO-NCRV"'), true);
    assert.equal(elements.requesterSearchResults.innerHTML.includes('Abon.nr 98765'), true);

    context.subscriptionRoleState.requester.searchResults = [
        {
            id: 53,
            firstName: 'Onbekend',
            middleName: '',
            lastName: 'Mandant',
            postalCode: '1234AB',
            city: 'Utrecht',
            mandant: 'LOSSEWAARDE'
        }
    ];
    runtime.renderSubscriptionRoleSearchResults('requester');
    assert.equal(elements.requesterSearchResults.innerHTML.includes('avrotros-logo.svg'), false);
    assert.equal(elements.requesterSearchResults.innerHTML.includes('kroncrv-logo.svg'), false);
}

function testRenderSearchResultsFallsBackToMandantWhenDivisionIdIsMissing() {
    const { context, elements, runtime } = createRuntimeContext();

    context.subscriptionRoleState.requester.searchResults = [
        {
            id: 54,
            firstName: 'Fallback',
            middleName: '',
            lastName: 'Gebruiker',
            postalCode: '1234AB',
            city: 'Utrecht',
            divisionId: '',
            mandant: 'KRONCRV'
        }
    ];
    runtime.renderSubscriptionRoleSearchResults('requester');

    assert.equal(elements.requesterSearchResults.innerHTML.includes('kroncrv-logo.svg'), true);
    assert.equal(elements.requesterSearchResults.innerHTML.includes('alt="KRO-NCRV"'), true);
}

function testUpdateSubscriptionRoleSearchAvailabilityTracksWerfsleutelSelection() {
    const { context, elements, runtime } = createRuntimeContext();

    runtime.updateSubscriptionRoleSearchAvailability();

    assert.equal(elements.recipientSearchQuery.disabled, true);
    assert.equal(elements.recipientSearchButton.disabled, true);
    assert.equal(elements.requesterSearchQuery.disabled, true);
    assert.equal(elements.requesterSearchButton.disabled, true);
    assert.equal(elements.requesterSameAsRecipient.disabled, true);

    context.kiwiWerfsleutelSlice.getSelections = () => ([
        {
            selectedKey: {
                salesCode: 'TVK1',
                mandant: 'HMC',
                divisionId: '14'
            },
            selectedChannel: 'OL',
            selectedChannelMeta: { key: 'OL' }
        }
    ]);

    runtime.updateSubscriptionRoleSearchAvailability();

    assert.equal(elements.recipientSearchQuery.disabled, false);
    assert.equal(elements.recipientSearchButton.disabled, false);
    assert.equal(elements.requesterSearchQuery.disabled, false);
    assert.equal(elements.requesterSearchButton.disabled, false);
    assert.equal(elements.requesterSameAsRecipient.disabled, false);
}

async function testSearchSubscriptionRolePersonRequiresWerfsleutelSelection() {
    let apiCalled = false;
    const { context, elements, runtime } = createRuntimeContext({
        kiwiApi: {
            get() {
                apiCalled = true;
                return Promise.resolve({ items: [] });
            }
        }
    });

    elements.recipientSearchQuery.value = 'Jane Doe';
    await runtime.searchSubscriptionRolePerson('recipient');

    assert.equal(apiCalled, false);
    assert.equal(context.__toasts.length, 1);
    assert.equal(context.__toasts[0].type, 'warning');
    assert.equal(context.__toasts[0].message.includes('werfsleutel'), true);
}

async function testSearchSubscriptionRolePersonIncludesWerfsleutelScopeInApiRequest() {
    let requestedUrl = '';
    const { elements, runtime } = createRuntimeContext({
        kiwiApi: {
            get(url) {
                requestedUrl = url;
                return Promise.resolve({ items: [] });
            }
        },
        werfsleutelSelections: [
            {
                selectedKey: {
                    salesCode: 'TVK1',
                    mandant: 'HMC',
                    divisionId: '14'
                },
                selectedChannel: 'OL',
                selectedChannelMeta: { key: 'OL' }
            }
        ]
    });

    elements.recipientSearchQuery.value = 'Jane Doe';
    await runtime.searchSubscriptionRolePerson('recipient');

    assert.equal(
        requestedUrl,
        '/api/v1/persons?page=1&pageSize=10&sortBy=name&name=jane+doe&divisionIds=14&mandants=HMC'
    );
}

async function testSearchSubscriptionRolePersonUsesExpandedCustomerSearchFields() {
    let requestedUrl = '';
    const { elements, runtime } = createRuntimeContext({
        kiwiApi: {
            get(url) {
                requestedUrl = url;
                return Promise.resolve({ items: [] });
            }
        },
        werfsleutelSelections: [
            {
                selectedKey: {
                    salesCode: 'KRO1',
                    mandant: 'KRONCRV',
                    divisionId: '6'
                },
                selectedChannel: 'OL',
                selectedChannelMeta: { key: 'OL' }
            }
        ]
    });

    elements.requesterSearchPostalCode.value = '1217 AA';
    elements.requesterSearchHouseNumber.value = '12A';
    elements.requesterSearchQuery.value = 'Jane Doe';
    elements.requesterSearchCustomerNumber.value = '11860448';
    elements.requesterSearchEmail.value = 'Jane@example.org';
    elements.requesterSearchIban.value = 'NL00 BANK 0123 4567 89';
    elements.requesterSearchBirthDate.value = '1980-07-22';
    elements.requesterSearchPhone.value = '06-12345678';

    await runtime.searchSubscriptionRolePerson('requester');

    assert.equal(
        requestedUrl,
        '/api/v1/persons?page=1&pageSize=10&sortBy=name&postalCode=1217AA&houseNumber=12A&name=jane+doe&customerNumber=11860448&email=jane%40example.org&iban=NL00BANK0123456789&birthDate=1980-07-22&phone=0612345678&divisionIds=6&mandants=KRONCRV'
    );
}

function testBuildSubscriptionDuplicateApiRequestIncludesWerfsleutelScope() {
    const { runtime } = createRuntimeContext({
        werfsleutelSelections: [
            {
                selectedKey: {
                    salesCode: 'KRO1',
                    mandant: 'KRONCRV',
                    divisionId: '6'
                },
                selectedChannel: 'OL',
                selectedChannelMeta: { key: 'OL' }
            }
        ]
    });

    const normalizedInput = runtime.normalizeSubscriptionDuplicateInput({
        lastName: 'Gebruiker',
        middleName: '',
        postalCode: '1234 AB',
        houseNumber: '12',
        houseExt: 'A',
        email: '',
        phone: ''
    });

    const apiRequest = runtime.buildSubscriptionDuplicateApiRequest(normalizedInput);

    assert.equal(
        apiRequest.params.toString(),
        'page=1&pageSize=5&sortBy=name&postalCode=1234AB&houseNumber=12A&name=gebruiker&divisionIds=6&mandants=KRONCRV'
    );
}

function testFreshDuplicateCacheEntryExpiresWithControlledClock() {
    const { context, runtime } = createRuntimeContext();
    const fingerprint = 'email:test@example.org';
    context.subscriptionDuplicateState.recipient.cache[fingerprint] = {
        cachedAt: 1_000,
        matches: [{ id: 7 }]
    };
    runtime.configureTiming({
        nowMs: () => 1_000 + (90 * 1000) + 1
    });

    const cacheEntry = runtime.getFreshSubscriptionDuplicateCacheEntry(
        context.subscriptionDuplicateState.recipient,
        fingerprint
    );

    assert.equal(cacheEntry, null);
    assert.equal(context.subscriptionDuplicateState.recipient.cache[fingerprint], undefined);
    runtime.resetTiming();
}

function testDuplicateApiScheduleUsesCooldownFromControlledClock() {
    const scheduledTimers = [];
    const { context, elements, runtime } = createRuntimeContext({
        werfsleutelSelections: [
            {
                selectedKey: {
                    salesCode: 'TVK1',
                    mandant: 'HMC',
                    divisionId: '14'
                },
                selectedChannel: 'OL',
                selectedChannelMeta: { key: 'OL' }
            }
        ]
    });

    context.subscriptionRoleState.recipient.mode = 'create';
    context.subscriptionDuplicateState.recipient.lastApiStartedAt = 400;
    setDuplicateInput(elements, 'subRecipient', {
        lastName: 'Gebruiker',
        postalCode: '1234 AB',
        houseNumber: '12'
    });
    runtime.configureTiming({
        nowMs: () => 1_000,
        setTimeout(callback, timeout) {
            scheduledTimers.push({ callback, timeout });
            return scheduledTimers.length;
        }
    });

    runtime.scheduleSubscriptionDuplicateApiCheck('recipient', 'test-fingerprint');

    assert.equal(scheduledTimers.length, 1);
    assert.equal(scheduledTimers[0].timeout, 900);
    runtime.resetTiming();
}

function testDuplicateApiIdentifiesStaleResponsesByRequestVersion() {
    const { context, runtime } = createRuntimeContext();
    context.subscriptionDuplicateState.recipient.requestVersion = 4;

    assert.equal(
        runtime.isLatestSubscriptionDuplicateRequest(context.subscriptionDuplicateState.recipient, 3),
        false
    );
    assert.equal(
        runtime.isLatestSubscriptionDuplicateRequest(context.subscriptionDuplicateState.recipient, 4),
        true
    );
}

function testToggleCustomerFormAddressKeepsAddressExtensionOptional() {
    const { elements, runtime } = createRuntimeContext();
    const addressFields = [
        'PostalCode',
        'HouseNumber',
        'HouseExt',
        'AddressExtension',
        'Address',
        'City'
    ];

    elements.subRequesterSameAddress = { checked: true };
    addressFields.forEach((field) => {
        elements[`subRequester${field}`] = createElementStub();
    });

    runtime.toggleCustomerFormAddress('subRequester');
    elements.subRequesterSameAddress.checked = false;
    runtime.toggleCustomerFormAddress('subRequester');

    assert.equal(elements.subRequesterPostalCode.required, true);
    assert.equal(elements.subRequesterHouseNumber.required, true);
    assert.equal(elements.subRequesterAddress.required, true);
    assert.equal(elements.subRequesterCity.required, true);
    assert.equal(elements.subRequesterHouseExt.required, false);
    assert.equal(elements.subRequesterAddressExtension.required, false);
}

function testExistingRoleEditsStayIndependentAndRestore() {
    const person = { id: 73, salutation: 'Dhr.', firstName: 'P.', middleName: 'van', lastName: 'van Dijk',
        postalCode: '1234AB', houseNumber: '10A', houseNumberAddition: '2', address: 'Teststraat 10A 2',
        city: 'Hilversum', email: 'demo@example.org', sourceSystem: 'kiwi' };
    const { context, elements, runtime } = createRuntimeContext({ recipientSelectedPerson: person,
        requesterSelectedPerson: { ...person, id: 74 }, werfsleutelSelections: [{ selectedKey: { divisionId: 'HMC' } }] });
    runtime.populateSubscriptionRoleEditor('recipient');
    runtime.populateSubscriptionRoleEditor('requester');
    assert.equal(elements.recipientCreateSection.style.display, 'block');
    assert.equal(elements.subRecipientAddress.value, 'Teststraat');
    assert.equal(elements.subRecipientLastName.value, 'Dijk');
    elements.subRecipientAddress.value = 'Nieuwe straat';
    elements.subRecipientHouseNumber.value = '20';
    elements.subRecipientHouseExt.value = '';
    const recipient = runtime.buildSubscriptionRolePayload('recipient');
    const requester = runtime.buildSubscriptionRolePayload('requester');
    assert.equal(recipient.personId, 73);
    assert.equal(recipient.personEdits.address, 'Nieuwe straat 20');
    assert.equal(recipient.personEdits.lastName, 'van Dijk');
    assert.equal(requester.personEdits.address, 'Teststraat 10A 2');
    assert.equal(person.address, 'Teststraat 10A 2');
    elements.requesterSameAsRecipient.checked = true;
    runtime.toggleRequesterSameAsRecipient();
    assert.equal(runtime.buildSubscriptionRolePayload('requester').sameAsRecipient, true);
    elements.requesterSameAsRecipient.checked = false;
    runtime.toggleRequesterSameAsRecipient();
    assert.equal(runtime.buildSubscriptionRolePayload('requester').personEdits.address, 'Teststraat 10A 2');
    runtime.restoreOutboxSubscriptionRoles({ recipient: { personId: 73, person: recipient.personEdits },
        requester: { personId: 74, person: requester.personEdits } });
    assert.equal(runtime.buildSubscriptionRolePayload('recipient').personEdits.address, 'Nieuwe straat 20');
    elements.subRecipientLastName.value = '';
    assert.equal(runtime.buildSubscriptionRolePayload('recipient'), null);
}

async function testLateHydrationKeepsEnteredDetails() {
    const person = { id: 73, firstName: 'P.', lastName: 'Tester', postalCode: '1234AB', houseNumber: '10',
        address: 'Teststraat 10', city: 'Hilversum', email: 'demo@example.org', credentialKey: 'demo', sourceSystem: 'subscription-api' };
    const { context, elements, runtime } = createRuntimeContext({ recipientSelectedPerson: person });
    runtime.populateSubscriptionRoleEditor('recipient');
    let respond;
    context.kiwiApi = { get: () => new Promise(resolve => { respond = resolve; }) };
    const pending = runtime.hydrateSubscriptionRoleSelectedPerson('recipient');
    elements.subRecipientAddress.value = 'Entered while loading';
    elements.subRecipientInitials.value = 'E.D.';
    respond({ ...person, initials: 'P.T.', address: 'Late address 10' });
    await pending;
    assert.equal(elements.subRecipientAddress.value, 'Entered while loading');
    assert.equal(elements.subRecipientInitials.value, 'E.D.');
}

function testExistingInitialsPopulateIndependentRoleEditorsAndPayloads() {
    const recipient = { id: 73, salutation: 'Dhr.', firstName: 'Alex', initials: 'A.B.', lastName: 'Tester',
        postalCode: '1234AB', houseNumber: '10', address: 'Teststraat 10', city: 'Hilversum',
        email: 'recipient@example.invalid', credentialKey: 'demo', mandant: 'HMC', sourceSystem: 'subscription-api' };
    const requester = { ...recipient, id: 74, firstName: 'Robin', initials: 'R.S.', email: 'payer@example.invalid' };
    const { context, elements, runtime } = createRuntimeContext({
        requesterSelectedPerson: requester,
        werfsleutelSelections: [{ selectedKey: { mandant: 'HMC' } }]
    });
    context.currentCustomer = recipient;
    runtime.initializeSubscriptionRolesForForm();
    elements.requesterSameAsRecipient.checked = false;
    runtime.toggleRequesterSameAsRecipient();
    context.subscriptionRoleState.requester.searchResults = [requester];
    runtime.selectSubscriptionRolePerson('requester', requester.id);

    assert.equal(elements.subRecipientInitials.value, 'A.B.');
    assert.equal(elements.subRequesterInitials.value, 'R.S.');
    assert.equal(runtime.buildSubscriptionRolePayload('recipient').personEdits.firstName, 'A.B.');
    assert.equal(runtime.buildSubscriptionRolePayload('requester').personEdits.firstName, 'R.S.');
    assert.equal(recipient.firstName, 'Alex');
    assert.equal(requester.firstName, 'Robin');

    elements.subRecipientInitials.value = 'A.C.';
    const recipientPayload = runtime.buildSubscriptionRolePayload('recipient');
    const requesterPayload = runtime.buildSubscriptionRolePayload('requester');
    assert.equal(recipientPayload.personEdits.firstName, 'A.C.');
    assert.equal(requesterPayload.personEdits.firstName, 'R.S.');
    runtime.restoreOutboxSubscriptionRoles({
        recipient: { personId: 73, person: recipientPayload.personEdits },
        requester: { personId: 74, person: requesterPayload.personEdits }
    });
    assert.equal(elements.subRecipientInitials.value, 'A.C.');
    assert.equal(elements.subRequesterInitials.value, 'R.S.');
}

async function testRoleSelectionHydratesInitialsAndIgnoresPreviousPerson() {
    for (const role of ['recipient', 'requester']) {
        const responses = [];
        const { context, elements, runtime } = createRuntimeContext({
            werfsleutelSelections: [{ selectedKey: { mandant: 'HMC' } }],
            kiwiApi: {
                get(url, options) {
                    return new Promise(resolve => responses.push({ url, options, resolve }));
                }
            }
        });
        const prefix = runtime.getSubscriptionRoleConfig(role).prefix;
        const person = { id: 73, firstName: 'Alex', credentialKey: 'demo', mandant: 'HMC', sourceSystem: 'subscription-api' };
        context.subscriptionRoleState[role].searchResults = [person];
        runtime.selectSubscriptionRolePerson(role, 73);
        assert.equal(responses.length, 1);
        assert.match(responses[0].url, /credentialKey=demo&sourceSystem=subscription-api&mandant=HMC/);
        assert.equal(responses[0].options.headers['X-Kiwi-Customer-Person-Id'], '73');
        responses[0].resolve({ ...person, firstName: '', initials: 'A.B.' });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(elements[`${prefix}Initials`].value, 'A.B.');

        // The same numeric ID in another source must not accept the previous selection's details.
        context.subscriptionRoleState[role].searchResults = [person];
        runtime.selectSubscriptionRolePerson(role, 73);
        const nextPerson = { ...person, firstName: '', initials: 'R.S.', credentialKey: 'other' };
        context.subscriptionRoleState[role].searchResults = [nextPerson];
        runtime.selectSubscriptionRolePerson(role, 73);
        responses[2].resolve({ ...nextPerson, initials: 'R.T.' });
        await new Promise(resolve => setImmediate(resolve));
        responses[1].resolve({ ...person, initials: 'A.L.' });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(elements[`${prefix}Initials`].value, 'R.T.');
        assert.equal(context.subscriptionRoleState[role].selectedPerson.credentialKey, 'other');

        context.kiwiApi = null;
        context.subscriptionRoleState[role].searchResults = [{ id: 75, firstName: 'L.' }];
        runtime.selectSubscriptionRolePerson(role, 75);
        assert.equal(elements[`${prefix}Initials`].value, 'L.');
        context.subscriptionRoleState[role].searchResults = [{ id: 76, firstName: '', initials: '' }];
        runtime.selectSubscriptionRolePerson(role, 76);
        assert.equal(elements[`${prefix}Initials`].value, '');
    }
}

async function testPayerHydrationCannotReplaceActiveCustomerFromAnotherSource() {
    const activeCustomer = { id: 51, personId: '51', credentialKey: 'source-a', mandant: 'A',
        sourceSystem: 'subscription-api', firstName: 'Reader', initials: 'R.' };
    const recipient = { id: 73, credentialKey: 'source-a', mandant: 'A',
        sourceSystem: 'subscription-api', firstName: 'Recipient', initials: 'E.' };
    const payer = { id: 51, personId: '51', credentialKey: 'source-b', mandant: 'B',
        sourceSystem: 'subscription-api', firstName: 'Other-source-payer' };
    let respond;
    const { context, elements, runtime } = createRuntimeContext({
        recipientSelectedPerson: recipient,
        werfsleutelSelections: [{ selectedKey: { mandant: 'A' } }, { selectedKey: { mandant: 'B' } }],
        kiwiApi: { get: () => new Promise(resolve => { respond = resolve; }) }
    });
    context.currentCustomer = activeCustomer;
    context.customers = [activeCustomer, recipient];
    const initialCustomers = [...context.customers];
    const cache = createBootstrapSlice();
    const activeCustomerChanges = [];
    // Use the application's cache writer: a stub that only records calls hides this regression.
    context.upsertCustomerInCache = person => cache.upsertCustomerInCache(person, {
        customers: context.customers,
        currentCustomer: context.currentCustomer,
        setCustomers(customers) { context.customers = customers; },
        setCurrentCustomer(customer) {
            activeCustomerChanges.push(customer);
            context.currentCustomer = customer;
        }
    });
    context.subscriptionRoleState.requester.searchResults = [payer];
    runtime.selectSubscriptionRolePerson('requester', payer.id);
    assert.equal(context.currentCustomer, activeCustomer);

    respond({ ...payer, initials: 'P.B.' });
    await new Promise(resolve => setImmediate(resolve));

    assert.equal(elements.subRequesterInitials.value, 'P.B.');
    assert.equal(context.subscriptionRoleState.requester.selectedPerson.credentialKey, 'source-b');
    assert.equal(context.subscriptionRoleState.requester.selectedPerson.initials, 'P.B.');
    assert.equal(context.subscriptionRoleState.recipient.selectedPerson, recipient);
    assert.equal(context.currentCustomer, activeCustomer);
    assert.deepEqual(context.customers, initialCustomers);
    assert.deepEqual(activeCustomerChanges, []);
}

function testGeneratedPersonFieldsHavePersistentLabels() {
    const { runtime, elements } = createRuntimeContext();
    runtime.renderCustomerForm('recipientCreateForm', 'subRecipient', { separatePhoneTypes: true });
    const markup = elements.recipientCreateForm.innerHTML;
    for (const suffix of ['Initials', 'MiddleName', 'LastName', 'BirthdayDay', 'BirthdayMonth', 'BirthdayYear', 'LandlinePhone', 'MobilePhone', 'Email']) {
        assert.ok(markup.includes(`for="subRecipient${suffix}"`), `${suffix} needs a persistent associated label`);
        assert.ok(markup.includes(`id="subRecipient${suffix}"`), `${suffix} keeps its existing control ID`);
    }
    assert.ok(markup.includes('role="radiogroup" aria-labelledby="subRecipientSalutationLabel"'));
    assert.ok(markup.includes('role="group" aria-labelledby="subRecipientBirthdayLabel"'));
}

async function run() {
    testGeneratedPersonFieldsHavePersistentLabels();
    testActiveCustomerIsRecipientWithoutLookup();
    await testActiveCustomerCanBeReusedWithIndependentPayer();
    testReuseRejectsIncompatibleMandant();
    testSameNumericIdDoesNotMergeSources();
    await testRoleSearchUsesLocalCustomersAndReportsNoResults();
    await testRoleSearchDiscardsStaleResponses();
    await testRoleSearchPendingFeedbackTracksItsOwnRequest();
    await testRoleSearchPendingFeedbackClearsOnInvalidation();
    await testRoleSearchFailureKeepsSelectionAndEdits();
    await testHydrationDiscardsObsoleteCustomerContext();
    testMarketingPreferencesFollowOnlyTheRecipient();
    await testPayerHydrationCannotReplaceActiveCustomerFromAnotherSource();
    testExistingInitialsPopulateIndependentRoleEditorsAndPayloads();
    await testRoleSelectionHydratesInitialsAndIgnoresPreviousPerson();
    testExistingRoleEditsStayIndependentAndRestore();
    await testLateHydrationKeepsEnteredDetails();
    testSelectSubscriptionDuplicatePersonNormalizesSameRecipientRequester();
    testEqualPersonNumbersAcrossMandantsDoNotMergeRecipientAndPayer();
    testNormalizeDuplicateLastNameUsesSharedHelpers();
    testBuildSubscriptionRolePayloadKeepsExistingPersonCredentialContext();
    testNewSubscriptionPersonKeepsPpaPhoneTypesSeparate();
    testNewSubscriptionPersonKeepsAddressExtensionsSeparate();
    testPhoneTypeLabelsAreTranslated();
    testAddressExtensionLabelsAreTranslated();
    testRefreshSubscriptionDuplicateMatchesIgnoresLocalCustomersWithoutBackendCache();
    testRefreshSubscriptionDuplicateMatchesUsesBackendCachedMatchesOnly();
    await testSelectSubscriptionRolePersonHydratesDetailAndPrefillsIban();
    testRenderSelectedPersonShowsAvrotrosBadgeForHmcMandant();
    testRenderSelectedPersonPrefersDivisionIdForBadge();
    testRenderSelectedPersonFallsBackToMandantForUnknownDivisionId();
    testRenderSearchResultsShowsKroncrvBadgeAndUnknownFallback();
    testRenderSearchResultsFallsBackToMandantWhenDivisionIdIsMissing();
    testUpdateSubscriptionRoleSearchAvailabilityTracksWerfsleutelSelection();
    await testSearchSubscriptionRolePersonRequiresWerfsleutelSelection();
    await testSearchSubscriptionRolePersonIncludesWerfsleutelScopeInApiRequest();
    await testSearchSubscriptionRolePersonUsesExpandedCustomerSearchFields();
    testBuildSubscriptionDuplicateApiRequestIncludesWerfsleutelScope();
    testFreshDuplicateCacheEntryExpiresWithControlledClock();
    testDuplicateApiScheduleUsesCooldownFromControlledClock();
    testDuplicateApiIdentifiesStaleResponsesByRequestVersion();
    testToggleCustomerFormAddressKeepsAddressExtensionOptional();
    console.log('subscription role runtime tests passed');
}

const signupCustomer = {
    id: 101, firstName: 'A.', lastName: 'Testklant', postalCode: '1234AB', houseNumber: '10',
    address: 'Teststraat 10', city: 'Teststad', email: 'test@example.org',
    sourceSystem: 'subscription-api', credentialKey: 'test-hmc', mandant: 'HMC', divisionId: '14'
};

function testActiveCustomerIsRecipientWithoutLookup() {
    let calls = 0;
    const selections = [];
    const { context, elements, runtime } = createRuntimeContext({
        werfsleutelSelections: selections,
        kiwiApi: { get() { calls += 1; throw Error('No lookup expected'); } }
    });
    context.currentCustomer = { ...signupCustomer };
    runtime.initializeSubscriptionRolesForForm();
    assert.equal(context.subscriptionRoleState.recipient.selectedPerson.id, 101);
    assert.equal(elements.recipientPersonSearch.open, false);
    assert.equal(elements.recipientSearchPostalCode.value, '');
    assert.equal(elements.subRecipientPostalCode.value, '1234AB');
    assert.equal(context.subscriptionRoleState.requesterSameAsRecipient, true);
    selections.push({ selectedKey: { mandant: 'HMC', divisionId: '14' } });
    runtime.updateSubscriptionRoleSearchAvailability();
    const payload = runtime.buildSubscriptionRolePayload('recipient');
    assert.equal(payload.personId, 101);
    assert.equal(payload.credentialKey, 'test-hmc');
    assert.equal(payload.person.sourceSystem, 'subscription-api');
    assert.equal(calls, 0);
    elements.subRecipientLastName.value = 'Edited';
    assert.equal(context.currentCustomer.lastName, 'Testklant');
}

async function testActiveCustomerCanBeReusedWithIndependentPayer() {
    const { context, elements, runtime } = createRuntimeContext({
        werfsleutelSelections: [{ selectedKey: { mandant: 'HMC' } }]
    });
    context.currentCustomer = { ...signupCustomer };
    runtime.initializeSubscriptionRolesForForm();
    elements.requesterSameAsRecipient.checked = false;
    runtime.toggleRequesterSameAsRecipient();
    const payer = { ...signupCustomer, id: 202, credentialKey: 'test-payer' };
    context.subscriptionRoleState.requester.searchResults = [payer];
    runtime.selectSubscriptionRolePerson('requester', 202, 0);
    const recipient = { ...signupCustomer, id: 303 };
    context.subscriptionRoleState.recipient.searchResults = [recipient];
    runtime.selectSubscriptionRolePerson('recipient', 303, 0);
    assert.equal(elements.recipientReuseCustomer.hidden, false);
    runtime.useActiveCustomerForSubscriptionRole('recipient');
    assert.equal(runtime.buildSubscriptionRolePayload('recipient').personId, 101);
    assert.equal(runtime.buildSubscriptionRolePayload('requester').personId, 202);
    assert.equal(context.currentCustomer.id, 101);
    assert.equal(elements.recipientPersonSearch.open, false);
    runtime.setSubscriptionRoleMode('recipient', 'create');
    runtime.setSubscriptionRoleMode('recipient', 'existing');
    runtime.useActiveCustomerForSubscriptionRole('recipient');
    assert.equal(runtime.buildSubscriptionRolePayload('recipient').credentialKey, 'test-hmc');
    assert.equal(runtime.buildSubscriptionRolePayload('requester').personId, 202);
}

function testReuseRejectsIncompatibleMandant() {
    const selections = [{ selectedKey: { mandant: 'KRONCRV', divisionId: '14' } }];
    const { context, elements, runtime } = createRuntimeContext({ werfsleutelSelections: selections });
    context.currentCustomer = { ...signupCustomer };
    runtime.updateSubscriptionRoleSearchAvailability();
    assert.equal(elements.recipientReuseCustomer.hidden, true);
    runtime.useActiveCustomerForSubscriptionRole('recipient');
    assert.equal(context.subscriptionRoleState.recipient.selectedPerson, null);
    runtime.initializeSubscriptionRolesForForm();
    assert.equal(runtime.buildSubscriptionRolePayload('recipient'), null);
}

function testSameNumericIdDoesNotMergeSources() {
    for (const difference of [{ credentialKey: 'other' }, { sourceSystem: 'other' }, { mandant: 'KRONCRV' }, { divisionId: '6' }]) {
        const { context, runtime } = createRuntimeContext({ recipientSelectedPerson: signupCustomer,
            requesterSelectedPerson: { ...signupCustomer, ...difference } });
        assert.equal(runtime.normalizeRequesterSameAsRecipientSelection(), false);
        assert.equal(context.subscriptionRoleState.requesterSameAsRecipient, false);
    }
    const { context, runtime } = createRuntimeContext({ werfsleutelSelections: [{ selectedKey: { mandant: 'HMC' } }] });
    const other = { ...signupCustomer, credentialKey: 'other' };
    context.subscriptionRoleState.recipient.searchResults = [signupCustomer, other];
    runtime.selectSubscriptionRolePerson('recipient', 101);
    assert.equal(context.subscriptionRoleState.recipient.selectedPerson, null);
    runtime.selectSubscriptionRolePerson('recipient', 101, 1);
    assert.equal(context.subscriptionRoleState.recipient.selectedPerson.credentialKey, 'other');
}

async function testRoleSearchUsesLocalCustomersAndReportsNoResults() {
    const { context, elements, runtime } = createRuntimeContext({ werfsleutelSelections: [{ selectedKey: { mandant: 'HMC' } }] });
    context.customers = [signupCustomer];
    elements.recipientSearchPostalCode.value = '1234 AB';
    elements.recipientSearchHouseNumber.value = '10';
    await runtime.searchSubscriptionRolePerson('recipient');
    assert.equal(context.subscriptionRoleState.recipient.searchResults.length, 1);
    runtime.selectSubscriptionRolePerson('recipient', 101, 0);
    assert.equal(runtime.buildSubscriptionRolePayload('recipient').personId, 101);
    elements.recipientSearchPostalCode.value = '9999ZZ';
    await runtime.searchSubscriptionRolePerson('recipient');
    assert.match(elements.recipientSearchResults.textContent, /Geen personen gevonden/);
    assert.equal(context.subscriptionRoleState.recipient.selectedPerson.id, 101);
}

async function testRoleSearchDiscardsStaleResponses() {
    for (const change of ['new-search', 'reset', 'mode', 'scope', 'session', 'reuse', 'filters', 'failure-after-reset']) {
        const pending = [];
        let currentSession = true;
        const selections = [{ selectedKey: { mandant: 'HMC' } }];
        const { context, elements, runtime } = createRuntimeContext({ werfsleutelSelections: selections,
            kiwiApi: { get: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) } });
        context.kiwiCustomerWorkSession = { getRequestContext: () => ({}), isCurrent: () => currentSession };
        context.currentCustomer = { ...signupCustomer };
        elements.recipientSearchPostalCode.value = '1234AB';
        const first = runtime.searchSubscriptionRolePerson('recipient');
        if (change === 'new-search') {
            const second = runtime.searchSubscriptionRolePerson('recipient');
            pending[1].resolve({ items: [{ ...signupCustomer, id: 202 }] });
            await second;
        }
        if (change === 'reset') runtime.resetSubscriptionRoleState();
        if (change === 'mode') runtime.setSubscriptionRoleMode('recipient', 'create');
        if (change === 'scope') {
            selections[0].selectedKey.mandant = 'KRONCRV';
            context.dispatchEvent(new context.CustomEvent('kiwi:werfsleutel-selections-updated'));
        }
        if (change === 'session') currentSession = false;
        if (change === 'reuse') runtime.useActiveCustomerForSubscriptionRole('recipient');
        if (change === 'filters') elements.recipientSearchPostalCode.value = '9999ZZ';
        if (change === 'failure-after-reset') {
            runtime.resetSubscriptionRoleState();
            pending[0].reject(Error('Obsolete failure'));
        } else {
            pending[0].resolve({ items: [signupCustomer] });
        }
        await first;
        const results = context.subscriptionRoleState.recipient.searchResults;
        assert.equal(results.length, change === 'new-search' ? 1 : 0, change);
        if (change === 'new-search') assert.equal(results[0].id, 202);
        assert.equal(context.__toasts.length, 0, change);
    }
}


async function testRoleSearchPendingFeedbackTracksItsOwnRequest() {
    for (const role of ['recipient', 'requester']) {
        const requests = [];
        const { context, elements, runtime } = createRuntimeContext({
            werfsleutelSelections: [{ selectedKey: { mandant: 'HMC' } }],
            kiwiApi: { get: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) }
        });
        const status = elements[`${role}SearchStatus`];
        const button = elements[`${role}SearchButton`];
        elements[`${role}SearchPostalCode`].value = '1234AB';
        const first = runtime.searchSubscriptionRolePerson(role);
        assert.equal(status.hidden, false);
        assert.match(status.textContent, /Zoeken naar bestaande personen/);
        assert.equal(button.getAttribute('aria-busy'), 'true');
        assert.equal(button.disabled, false, 'another query remains possible');

        elements[`${role}SearchPostalCode`].value = '2345BC';
        const second = runtime.searchSubscriptionRolePerson(role);
        assert.equal(requests.length, 2);
        requests[0].reject(Error('Obsolete lookup failure'));
        await first;
        assert.equal(status.hidden, false, 'old completion cannot clear a newer pending cue');
        assert.equal(button.getAttribute('aria-busy'), 'true');
        assert.equal(context.__toasts.length, 0);
        requests[1].resolve({ items: [{ ...signupCustomer, id: 202 }] });
        await second;
        assert.equal(status.hidden, true);
        assert.equal(status.textContent, '');
        assert.equal(button.getAttribute('aria-busy'), 'false');
        assert.equal(context.subscriptionRoleState[role].searchResults[0].id, 202);

        const edited = runtime.searchSubscriptionRolePerson(role);
        elements[`${role}SearchPostalCode`].value = '3456CD';
        requests[2].resolve({ items: [signupCustomer] });
        await edited;
        assert.equal(status.hidden, true, 'editing filters without another search still finishes the old cue');
        assert.equal(button.getAttribute('aria-busy'), 'false');
        assert.equal(context.subscriptionRoleState[role].searchResults.length, 0);

        const failed = runtime.searchSubscriptionRolePerson(role);
        requests[3].reject(Error('Current lookup failure'));
        await failed;
        assert.equal(status.hidden, true);
        assert.equal(button.getAttribute('aria-busy'), 'false');
        assert.equal(button.disabled, false);
        assert.equal(context.__toasts.at(-1).message, 'Current lookup failure');
    }
}

async function testRoleSearchPendingFeedbackClearsOnInvalidation() {
    for (const change of ['reset', 'mode', 'scope', 'reuse', 'same-payer']) {
        let complete;
        const role = change === 'same-payer' ? 'requester' : 'recipient';
        const selections = [{ selectedKey: { mandant: 'HMC' } }];
        const { context, elements, runtime } = createRuntimeContext({
            werfsleutelSelections: selections,
            kiwiApi: { get: () => new Promise(resolve => { complete = resolve; }) }
        });
        context.currentCustomer = { ...signupCustomer };
        elements[`${role}SearchPostalCode`].value = '1234AB';
        const request = runtime.searchSubscriptionRolePerson(role);
        assert.equal(elements[`${role}SearchStatus`].hidden, false);
        if (change === 'reset') runtime.resetSubscriptionRoleState();
        if (change === 'mode') runtime.setSubscriptionRoleMode(role, 'create');
        if (change === 'scope') {
            selections[0].selectedKey.mandant = 'KRONCRV';
            context.dispatchEvent(new context.CustomEvent('kiwi:werfsleutel-selections-updated'));
        }
        if (change === 'reuse') runtime.useActiveCustomerForSubscriptionRole(role);
        if (change === 'same-payer') {
            elements.requesterSameAsRecipient.checked = true;
            runtime.toggleRequesterSameAsRecipient();
        }
        assert.equal(elements[`${role}SearchStatus`].hidden, true, change);
        assert.equal(elements[`${role}SearchButton`].getAttribute('aria-busy'), 'false', change);
        complete({ items: [signupCustomer] });
        await request;
        assert.equal(elements[`${role}SearchStatus`].hidden, true, change);
    }
}

async function testRoleSearchFailureKeepsSelectionAndEdits() {
    const { context, elements, runtime } = createRuntimeContext({
        werfsleutelSelections: [{ selectedKey: { mandant: 'HMC' } }],
        kiwiApi: { get: async () => { throw Error('Search temporarily unavailable'); } }
    });
    context.currentCustomer = { ...signupCustomer };
    runtime.initializeSubscriptionRolesForForm();
    elements.subRecipientLastName.value = 'Entered surname';
    elements.recipientSearchPostalCode.value = '1234AB';
    await runtime.searchSubscriptionRolePerson('recipient');
    assert.equal(context.subscriptionRoleState.recipient.selectedPerson.id, 101);
    assert.equal(elements.subRecipientLastName.value, 'Entered surname');
    assert.equal(context.__toasts[0].message, 'Search temporarily unavailable');
}

async function testHydrationDiscardsObsoleteCustomerContext() {
    for (const change of ['session', 'selection', 'reset', 'scope', 'source-response']) {
        let respond;
        let currentSession = true;
        const selections = [{ selectedKey: { mandant: 'HMC' } }];
        const { context, elements, runtime } = createRuntimeContext({ recipientSelectedPerson: { ...signupCustomer },
            werfsleutelSelections: selections,
            kiwiApi: { get: () => new Promise(resolve => { respond = resolve; }) } });
        context.kiwiCustomerWorkSession = { getRequestContext: () => ({}), isCurrent: () => currentSession };
        runtime.populateSubscriptionRoleEditor('recipient');
        const request = runtime.hydrateSubscriptionRoleSelectedPerson('recipient');
        if (change === 'session') currentSession = false;
        if (change === 'selection') context.subscriptionRoleState.recipient.selectedPerson = { ...signupCustomer, credentialKey: 'other' };
        if (change === 'reset') runtime.resetSubscriptionRoleState();
        if (change === 'scope') selections[0].selectedKey.mandant = 'KRONCRV';
        respond({ ...signupCustomer, lastName: 'Obsolete',
            ...(change === 'source-response' ? { credentialKey: 'other' } : {}) });
        await request;
        assert.equal(elements.subRecipientLastName.value, 'Testklant', change);
        assert.equal(context.__upserts.length, 0, change);
    }
}

function testMarketingPreferencesFollowOnlyTheRecipient() {
    const person = { id: 73, firstName: 'P.', lastName: 'Tester', postalCode: '1234AB', houseNumber: '10',
        address: 'Teststraat 10', city: 'Hilversum', email: 'fixture@example.invalid',
        optinEmail: 'yes', optinPhone: 'no', optinPost: null };
    const { context, runtime, marketingInputs } = createRuntimeContext({ recipientSelectedPerson: person });
    const selection = name => marketingInputs[`subOptin${name}`].find(input => input.checked)?.value ?? null;
    runtime.populateSubscriptionRoleEditor('recipient');
    assert.deepEqual(['Email', 'Phone', 'Post'].map(selection), ['yes', 'no', null]);
    assert.equal(marketingInputs.subOptinEmail.every(input => input.disabled), true);

    runtime.setSubscriptionRoleMode('recipient', 'create');
    assert.deepEqual(['Email', 'Phone', 'Post'].map(selection), [null, null, null]);
    assert.equal(marketingInputs.subOptinEmail.every(input => !input.disabled), true);
    marketingInputs.subOptinEmail[1].checked = true;
    runtime.setSubscriptionRoleMode('requester', 'create');
    assert.equal(selection('Email'), 'no');

    runtime.setSubscriptionRoleMode('recipient', 'existing');
    assert.equal(selection('Email'), null);
    context.subscriptionRoleState.recipient.searchResults = [{ ...person, id: 74, optinEmail: null, optinPhone: '', optinPost: undefined }];
    runtime.selectSubscriptionRolePerson('recipient', 74);
    assert.deepEqual(['Email', 'Phone', 'Post'].map(selection), [null, null, null]);
    runtime.setSubscriptionRoleMode('recipient', 'create');
    assert.deepEqual(['Email', 'Phone', 'Post'].map(selection), [null, null, null]);
    assert.equal(person.optinEmail, 'yes');
    assert.equal(person.optinPhone, 'no');
    runtime.restoreOutboxSubscriptionRoles({ recipient: { person }, requester: { sameAsRecipient: true } });
    assert.deepEqual(['Email', 'Phone', 'Post'].map(selection), ['yes', 'no', null], 'saved new-person choices survive role restoration');
    const newRecipient = runtime.buildSubscriptionRolePayload('recipient', { optinData: {
        optinEmail: 'yes', optinPhone: 'no', optinPost: null
    } });
    assert.equal(newRecipient.person.optinEmail, 'yes');
    assert.equal(newRecipient.person.optinPhone, 'no');
    assert.equal(newRecipient.person.optinPost, null);
    context.subscriptionRoleState.recipient.mode = 'existing';
    context.subscriptionRoleState.recipient.selectedPerson = person;
    const existingRecipient = runtime.buildSubscriptionRolePayload('recipient', { optinData: { optinEmail: 'no' } });
    assert.equal(Object.hasOwn(existingRecipient.personEdits, 'optinEmail'), false, 'an order does not overwrite stored preferences');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
