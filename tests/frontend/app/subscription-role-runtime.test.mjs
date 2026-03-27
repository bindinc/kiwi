import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

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
        textContent: '',
        innerHTML: '',
        value: '',
        checked: false,
        disabled: false,
        childElementCount: 0,
        dataset: {},
        classList: {
            add() {},
            remove() {},
            toggle() {}
        },
        setAttribute() {},
        removeAttribute() {},
        appendChild() {},
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
        recipientSearchQuery: createElementStub(),
        recipientSearchButton: createElementStub(),
        requesterSearchQuery: createElementStub(),
        requesterSearchButton: createElementStub(),
        requesterRoleDetails,
        requesterSameSummary,
        subIBAN: createElementStub(),
        requesterSelectedPerson: createElementStub(),
        requesterSearchResults: createElementStub(),
        requesterDuplicateCheck: createElementStub(),
        requesterCreateForm: createElementStub(),
        requesterExistingSection: createElementStub(),
        requesterCreateSection: createElementStub(),
        recipientSelectedPerson: createElementStub(),
        recipientSearchResults: createElementStub(),
        recipientDuplicateCheck: createElementStub(),
        recipientCreateForm: createElementStub(),
        recipientExistingSection: createElementStub(),
        recipientCreateSection: createElementStub()
    };
    const recipientSelectedPerson = options.recipientSelectedPerson || null;
    const requesterSelectedPerson = options.requesterSelectedPerson || null;

    const contextObject = {
        console,
        Date,
        URLSearchParams,
        window: null,
        __toasts: [],
        __upserts: [],
        document: {
            getElementById(id) {
                return elementById[id] || null;
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
        runtime: context.window.kiwiSubscriptionRoleRuntime
    };
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

    const payload = JSON.parse(JSON.stringify(runtime.buildSubscriptionRolePayload('recipient')));

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
            address: 'Voorbeeldstraat 7',
            city: 'Hilversum',
            email: 'demo@example.org',
            phone: '0612345678',
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

    assert.equal(requestedUrl, '/api/v1/persons/73?credentialKey=tvk&sourceSystem=subscription-api');
    assert.equal(context.subscriptionRoleState.recipient.selectedPerson.iban, 'NL80INGB0001340187');
    assert.equal(elements.subIBAN.value, 'NL80INGB0001340187');
    assert.equal(context.__upserts.length, 1);
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

async function run() {
    testSelectSubscriptionDuplicatePersonNormalizesSameRecipientRequester();
    testNormalizeDuplicateLastNameUsesSharedHelpers();
    testBuildSubscriptionRolePayloadKeepsExistingPersonCredentialContext();
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
    testBuildSubscriptionDuplicateApiRequestIncludesWerfsleutelScope();
    console.log('subscription role runtime tests passed');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
