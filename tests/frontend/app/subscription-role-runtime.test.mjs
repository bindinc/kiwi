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
        querySelector() {
            return null;
        }
    };
}

function createRuntimeContext(options = {}) {
    const sharedNormalizeNameFragment = options.sharedNormalizeNameFragment
        || ((value = '') => String(value || '').replace(/[\s.]/g, '').toLowerCase());
    const checkbox = { checked: Boolean(options.checkboxChecked) };
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
        requesterRoleDetails,
        requesterSameSummary,
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
        credentialKey: 'tvk',
        credentialTitle: 'TV Krant',
        mandant: 'HMC',
        supportsPersonLookup: true,
        sourceSystem: 'subscription-api'
    };

    const { runtime } = createRuntimeContext({
        recipientSelectedPerson: selectedPerson
    });

    const payload = JSON.parse(JSON.stringify(runtime.buildSubscriptionRolePayload('recipient')));

    assert.deepEqual(payload, {
        personId: 73,
        credentialKey: 'tvk',
        credentialTitle: 'TV Krant',
        mandant: 'HMC',
        supportsPersonLookup: true,
        sourceSystem: 'subscription-api'
    });
}

function testRenderSelectedPersonShowsAvrotrosBadgeForHmcMandant() {
    const selectedPerson = {
        id: 41,
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
}

function testRenderSearchResultsShowsKroncrvBadgeAndUnknownFallback() {
    const { context, elements, runtime } = createRuntimeContext();

    context.subscriptionRoleState.requester.searchResults = [
        {
            id: 52,
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

function run() {
    testSelectSubscriptionDuplicatePersonNormalizesSameRecipientRequester();
    testNormalizeDuplicateLastNameUsesSharedHelpers();
    testBuildSubscriptionRolePayloadKeepsExistingPersonCredentialContext();
    testRenderSelectedPersonShowsAvrotrosBadgeForHmcMandant();
    testRenderSearchResultsShowsKroncrvBadgeAndUnknownFallback();
    console.log('subscription role runtime tests passed');
}

run();
