import { createEditorDocument } from '../../support/editor-dom.mjs';
import assert from 'node:assert/strict';
import nl from '../../../../assets/js/i18n/nl.js';
import en from '../../../../assets/js/i18n/en.js';
import { initializeSessionOutbox } from '../../../../assets/js/app/session-outbox.js';
import { clearFormDraft } from '../../../../assets/js/app/lightbox-drafts.js';
import { createActionRouter } from '../../../../assets/js/app/actions.js';
import {
    createSubscription,
    registerSubscriptionWorkflowSlice,
    __subscriptionWorkflowTestUtils
} from '../../../../assets/js/app/slices/subscription-workflow-slice.js';

function createRouter() {
    const root = {
        addEventListener() {},
        removeEventListener() {}
    };

    return createActionRouter({
        root,
        eventTypes: ['click', 'submit']
    });
}

function createToggleClassList(initialValues = []) {
    const classes = new Set(initialValues);
    return {
        toggle(className, forcedState) {
            if (forcedState === true) {
                classes.add(className);
                return true;
            }
            if (forcedState === false) {
                classes.delete(className);
                return false;
            }
            if (classes.has(className)) {
                classes.delete(className);
                return false;
            }
            classes.add(className);
            return true;
        },
        contains(className) {
            return classes.has(className);
        }
    };
}

function createDomElement() {
    const element = {
        className: '',
        textContent: '',
        value: '',
        style: {
            display: ''
        },
        hidden: false,
        disabled: false,
        children: [],
        attributes: {},
        classList: createToggleClassList(),
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        getAttribute(name) {
            return this.attributes[name] ?? null;
        },
        removeAttribute(name) {
            delete this.attributes[name];
        }
    };

    let innerHtml = '';
    Object.defineProperty(element, 'innerHTML', {
        get() {
            return innerHtml;
        },
        set(value) {
            innerHtml = value;
            if (value === '') {
                this.children = [];
            }
        }
    });

    return element;
}

function testRegistersItemSevenActions() {
    const router = createRouter();
    registerSubscriptionWorkflowSlice(router);

    const actionNames = router.getRegisteredActions();
    const expectedActionNames = [
        'show-new-subscription',
        'create-subscription',
        'toggle-subscription-queue-info',
        'edit-customer',
        'save-customer-edit',
        'show-resend-magazine',
        'resend-magazine',
        'show-editorial-complaint-form',
        'submit-editorial-complaint',
        'edit-subscription',
        'save-subscription-edit'
    ];

    for (const actionName of expectedActionNames) {
        assert.equal(actionNames.includes(actionName), true, `missing action ${actionName}`);
    }
}

function testInstallsLegacyCompatibilityExports() {
    const previousValues = {
        showNewSubscription: globalThis.showNewSubscription,
        createSubscription: globalThis.createSubscription,
        getSubscriptionRequesterMetaLine: globalThis.getSubscriptionRequesterMetaLine,
        editCustomer: globalThis.editCustomer,
        saveCustomerEdit: globalThis.saveCustomerEdit,
        showResendMagazine: globalThis.showResendMagazine,
        resendMagazine: globalThis.resendMagazine,
        showEditorialComplaintForm: globalThis.showEditorialComplaintForm,
        submitEditorialComplaint: globalThis.submitEditorialComplaint,
        editSubscription: globalThis.editSubscription,
        saveSubscriptionEdit: globalThis.saveSubscriptionEdit
    };

    try {
        const router = createRouter();
        registerSubscriptionWorkflowSlice(router);

        assert.equal(typeof globalThis.showNewSubscription, 'function');
        assert.equal(typeof globalThis.createSubscription, 'function');
        assert.equal(typeof globalThis.getSubscriptionRequesterMetaLine, 'function');
        assert.equal(typeof globalThis.editCustomer, 'function');
        assert.equal(typeof globalThis.saveCustomerEdit, 'function');
        assert.equal(typeof globalThis.showResendMagazine, 'function');
        assert.equal(typeof globalThis.resendMagazine, 'function');
        assert.equal(typeof globalThis.showEditorialComplaintForm, 'function');
        assert.equal(typeof globalThis.submitEditorialComplaint, 'function');
        assert.equal(typeof globalThis.editSubscription, 'function');
        assert.equal(typeof globalThis.saveSubscriptionEdit, 'function');
    } finally {
        for (const [key, value] of Object.entries(previousValues)) {
            if (value === undefined) {
                delete globalThis[key];
            } else {
                globalThis[key] = value;
            }
        }
    }
}

function testSubscriptionHelperFunctions() {
    assert.equal(
        __subscriptionWorkflowTestUtils.getSubscriptionDurationDescription('2-jaar', 'fallback'),
        '2 jaar - Jaarlijks betaald (5% korting)'
    );
    assert.equal(
        __subscriptionWorkflowTestUtils.getSubscriptionDurationDescription('', 'fallback'),
        'fallback'
    );

    const changes = __subscriptionWorkflowTestUtils.getSubscriptionChanges(
        {
            magazine: 'Avrobode',
            duration: '1-jaar',
            status: 'active'
        },
        {
            magazine: 'Mikrogids',
            duration: '2-jaar',
            status: 'paused'
        }
    );

    assert.deepEqual(changes, [
        'Magazine gewijzigd van Avrobode naar Mikrogids',
        'Duur gewijzigd van 1 jaar - Jaarlijks betaald naar 2 jaar - Jaarlijks betaald (5% korting)',
        'Status gewijzigd van Actief naar Gepauzeerd'
    ]);

    assert.equal(__subscriptionWorkflowTestUtils.mutationOutcomeIsAmbiguous(new Error('network')), true);
    assert.equal(__subscriptionWorkflowTestUtils.mutationOutcomeIsAmbiguous({ status: 503 }), true);
    assert.equal(__subscriptionWorkflowTestUtils.mutationOutcomeIsAmbiguous({ status: 400 }), false);
}

async function testReconcilesAmbiguousMutationBySubmissionId() {
    const requestedUrls = [];
    const apiClient = {
        async get(url) {
            requestedUrls.push(url);
            return { status: 'queued' };
        }
    };

    assert.equal(
        await __subscriptionWorkflowTestUtils.reconcileSubscriptionMutation(
            apiClient,
            '/api/v1/workflows',
            'request::AVR 123'
        ),
        'queued'
    );
    assert.equal(
        requestedUrls[0],
        '/api/v1/workflows/subscription/submission/request%3A%3AAVR%20123'
    );

    apiClient.get = async () => {
        throw { status: 404 };
    };
    assert.equal(
        await __subscriptionWorkflowTestUtils.reconcileSubscriptionMutation(apiClient, '/api/v1/workflows', 'missing'),
        'not_found'
    );

    apiClient.get = async () => {
        throw { status: 503 };
    };
    assert.equal(
        await __subscriptionWorkflowTestUtils.reconcileSubscriptionMutation(apiClient, '/api/v1/workflows', 'unknown'),
        'unknown'
    );
}

function testWerfsleutelSelectionHelperPrefersMultiSelectionBridge() {
    const previousSlice = globalThis.kiwiWerfsleutelSlice;
    globalThis.kiwiWerfsleutelSlice = {
        getSelections() {
            return [
                {
                    selectedKey: { salesCode: 'TVZ123' },
                    selectedChannel: 'PR/ET/LV',
                    selectedChannelMeta: { key: 'PR/ET/LV' }
                },
                {
                    selectedKey: { salesCode: 'AVR123' },
                    selectedChannel: 'EM/OU',
                    selectedChannelMeta: { key: 'EM/OU' }
                }
            ];
        }
    };

    try {
        assert.deepEqual(
            __subscriptionWorkflowTestUtils.getSelectedWerfsleutelSelections().map((selection) => selection.selectedKey.salesCode),
            ['TVZ123', 'AVR123']
        );
    } finally {
        if (previousSlice === undefined) {
            delete globalThis.kiwiWerfsleutelSlice;
        } else {
            globalThis.kiwiWerfsleutelSlice = previousSlice;
        }
    }
}

function testQueueToggleUpdatesPanelVisibilityAndButtonState() {
    const previousDocument = globalThis.document;
    const elements = {
        subscriptionQueuePanel: createDomElement(),
        subscriptionQueueToggle: createDomElement(),
        subscriptionQueueToggleCount: createDomElement(),
        subscriptionQueueMeta: createDomElement(),
        subscriptionQueueEmpty: createDomElement(),
        subscriptionQueueList: createDomElement()
    };

    elements.subscriptionQueuePanel.hidden = true;
    elements.subscriptionQueuePanel.style.display = 'none';
    elements.subscriptionQueueToggleCount.style.display = 'none';

    globalThis.document = {
        getElementById(id) {
            return elements[id] || null;
        },
        createElement() {
            return createDomElement();
        }
    };

    try {
        __subscriptionWorkflowTestUtils.setSubscriptionQueueExpanded(false);

        __subscriptionWorkflowTestUtils.toggleSubscriptionQueueInfo();
        assert.equal(elements.subscriptionQueuePanel.hidden, false);
        assert.equal(elements.subscriptionQueuePanel.style.display, '');
        assert.equal(elements.subscriptionQueueToggle.getAttribute('aria-expanded'), 'true');
        assert.equal(elements.subscriptionQueueToggle.classList.contains('is-active'), true);

        __subscriptionWorkflowTestUtils.toggleSubscriptionQueueInfo();
        assert.equal(elements.subscriptionQueuePanel.hidden, true);
        assert.equal(elements.subscriptionQueuePanel.style.display, 'none');
        assert.equal(elements.subscriptionQueueToggle.getAttribute('aria-expanded'), 'false');
        assert.equal(elements.subscriptionQueueToggle.classList.contains('is-active'), false);
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
}

function testQueueRenderingUsesBackendDisplayFields() {
    const previousDocument = globalThis.document;
    const elements = {
        subscriptionQueuePanel: createDomElement(),
        subscriptionQueueToggle: createDomElement(),
        subscriptionQueueToggleCount: createDomElement(),
        subscriptionQueueMeta: createDomElement(),
        subscriptionQueueEmpty: createDomElement(),
        subscriptionQueueList: createDomElement()
    };

    globalThis.document = {
        getElementById(id) {
            return elements[id] || null;
        },
        createElement() {
            return createDomElement();
        }
    };

    try {
        __subscriptionWorkflowTestUtils.renderSubscriptionQueueItems([
            {
                display: {
                    agentBadge: 'BD',
                    line: "16.16 Verwerkt: Wijziging '2 jaar Mikrogids voor EUR 80' (MKGV435) voor dhr. de Vries (1984301)"
                },
                summary: {
                    agent: {
                        shortName: 'Foute naam'
                    },
                    typeLabel: 'Fout type',
                    subscription: {
                        magazine: 'Fout tijdschrift'
                    },
                    offer: {
                        salesCode: 'FOUT123',
                        title: 'Fout aanbod'
                    },
                    recipient: {
                        displayName: 'Verkeerde ontvanger',
                        personId: 1
                    }
                }
            }
        ]);

        assert.equal(elements.subscriptionQueueMeta.textContent, 'Laatste 1 aanvragen');
        assert.equal(elements.subscriptionQueueToggleCount.textContent, '1');
        assert.equal(elements.subscriptionQueueToggleCount.style.display, 'inline-flex');
        assert.equal(elements.subscriptionQueueEmpty.style.display, 'none');
        assert.equal(elements.subscriptionQueueList.children.length, 1);
        assert.equal(elements.subscriptionQueueList.children[0].children.length, 1);
        assert.equal(elements.subscriptionQueueList.children[0].children[0].children[0].textContent, 'BD');
        assert.equal(
            elements.subscriptionQueueList.children[0].children[0].children[1].children[0].textContent,
            "16.16 Verwerkt: Wijziging '2 jaar Mikrogids voor EUR 80' (MKGV435) voor dhr. de Vries (1984301)"
        );
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
}

function testShowNewSubscriptionPrefillsPrimaryIbanFromCurrentCustomer() {
    const previousDocument = globalThis.document;
    const previousBridge = globalThis.kiwiLegacyCustomerSearchBridge;
    const previousWerfsleutelSlice = globalThis.kiwiWerfsleutelSlice;
    const previousInitialize = globalThis.initializeSubscriptionRolesForForm;
    const previousRenderRequesterSameSummary = globalThis.renderRequesterSameSummary;

    const elements = {
        subscriptionForm: {
            resetCalled: false,
            reset() {
                this.resetCalled = true;
            }
        },
        subStartDate: createDomElement(),
        subscriptionSubmissionId: createDomElement(),
        subIBAN: createDomElement(),
        newSubscriptionForm: createDomElement(),
        subscriptionQueuePanel: createDomElement(),
        subscriptionQueueToggle: createDomElement(),
        subscriptionQueueToggleCount: createDomElement(),
        subscriptionQueueMeta: createDomElement(),
        subscriptionQueueEmpty: createDomElement(),
        subscriptionQueueList: createDomElement()
    };

    try {
        globalThis.document = {
            getElementById(id) {
                return elements[id] || null;
            },
            createElement() {
                return createDomElement();
            }
        };
        globalThis.kiwiLegacyCustomerSearchBridge = {
            getCurrentCustomer() {
                return {
                    id: 27,
                    sourceSystem: 'subscription-api',
                    iban: 'NL12RABO0123456789'
                };
            },
            getCustomers() {
                return [];
            }
        };
        globalThis.kiwiWerfsleutelSlice = {
            resetPicker() {},
            refreshCatalogIfStale() {}
        };
        globalThis.initializeSubscriptionRolesForForm = () => {};
        globalThis.renderRequesterSameSummary = () => {};

        registerSubscriptionWorkflowSlice(createRouter());
        globalThis.showNewSubscription();

        assert.equal(elements.subscriptionForm.resetCalled, true);
        assert.equal(elements.subIBAN.value, 'NL12RABO0123456789');
        assert.equal(elements.newSubscriptionForm.style.display, 'flex');
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }

        if (previousBridge === undefined) {
            delete globalThis.kiwiLegacyCustomerSearchBridge;
        } else {
            globalThis.kiwiLegacyCustomerSearchBridge = previousBridge;
        }

        if (previousWerfsleutelSlice === undefined) {
            delete globalThis.kiwiWerfsleutelSlice;
        } else {
            globalThis.kiwiWerfsleutelSlice = previousWerfsleutelSlice;
        }

        if (previousInitialize === undefined) {
            delete globalThis.initializeSubscriptionRolesForForm;
        } else {
            globalThis.initializeSubscriptionRolesForForm = previousInitialize;
        }

        if (previousRenderRequesterSameSummary === undefined) {
            delete globalThis.renderRequesterSameSummary;
        } else {
            globalThis.renderRequesterSameSummary = previousRenderRequesterSameSummary;
        }
    }
}

async function testEditCustomerOpensSubscriptionApiViewer() {
    const previousDocument = globalThis.document;
    globalThis.document = createEditorDocument();
    const previousBridge = globalThis.kiwiLegacyCustomerSearchBridge;
    const previousShowToast = globalThis.showToast;

    const toasts = [];

    try {
        globalThis.kiwiLegacyCustomerSearchBridge = {
            getCurrentCustomer() {
                return {
                    id: 27,
                    sourceSystem: 'subscription-api'
                };
            },
            getCustomers() {
                return [];
            }
        };
        globalThis.showToast = (message, type) => {
            toasts.push({ message, type });
        };

        registerSubscriptionWorkflowSlice(createRouter());
        globalThis.editCustomer();

        assert.equal(toasts.length, 0);
        assert.equal(globalThis.document.body.children[0].tag, 'dialog');
        assert.equal(globalThis.document.body.children[0].open, true);
    } finally {
        globalThis.document = previousDocument;
        if (previousBridge === undefined) {
            delete globalThis.kiwiLegacyCustomerSearchBridge;
        } else {
            globalThis.kiwiLegacyCustomerSearchBridge = previousBridge;
        }

        if (previousShowToast === undefined) {
            delete globalThis.showToast;
        } else {
            globalThis.showToast = previousShowToast;
        }
    }
}

async function testSubmissionPreservesIndependentPayerIdentity() {
    const identity = { personId: 51, credentialKey: 'source-a', sourceSystem: 'subscription-api',
        divisionId: '14', mandant: 'HMC' };
    const cases = [
        { name: 'different credential', requester: { ...identity, credentialKey: 'source-b' } },
        { name: 'different source', requester: { ...identity, sourceSystem: 'kiwi' } },
        { name: 'different division', requester: { ...identity, divisionId: '6' } },
        { name: 'different mandant', requester: { ...identity, mandant: 'KRONCRV' } },
        { name: 'different person', requester: { ...identity, personId: 52 } },
        { name: 'new person', requester: { person: { firstName: 'B.', lastName: 'Test payer' } } },
        { name: 'identical source identity', requester: { ...identity }, shouldFollow: true },
        { name: 'explicit same recipient', requester: { sameAsRecipient: true }, checked: true, shouldFollow: true }
    ];
    const globals = ['document', 'kiwiApi', 'kiwiWerfsleutelSlice', 'kiwiCustomerWorkSession',
        'buildSubscriptionRolePayload', 'normalizeRequesterSameAsRecipientSelection',
        'toggleRequesterSameAsRecipient', 'validateSubscriptionDuplicateSubmitGuard', 'showToast', 'closeForm'];
    const previous = new Map(globals.map(key => [key, globalThis[key]]));

    try {
        for (const scenario of cases) {
            const checkbox = { checked: Boolean(scenario.checked) };
            const requests = [];
            const recipient = { ...identity, personEdits: { lastName: 'Recipient edit' } };
            const requester = scenario.requester.personId
                ? { ...scenario.requester, personEdits: { lastName: 'Payer edit' } }
                : { ...scenario.requester };
            const originalRequester = structuredClone(requester);
            const inputs = { requesterSameAsRecipient: checkbox,
                subscriptionSubmissionId: { value: 'synthetic-submission' }, subStartDate: { value: '2026-11-10' } };
            globalThis.document = {
                getElementById: id => inputs[id] || null,
                querySelector: selector => selector === 'input[name="subPayment"]:checked' ? { value: 'AC' } : null
            };
            globalThis.kiwiWerfsleutelSlice = { getSelections: () => [{
                selectedKey: { salesCode: 'TEST1', mandant: 'HMC', subscriptionKind: 'membership', productCode: 'ATV' }, selectedChannel: 'OL'
            }] };
            globalThis.kiwiCustomerWorkSession = {};
            globalThis.buildSubscriptionRolePayload = role => role === 'recipient' ? recipient : requester;
            globalThis.normalizeRequesterSameAsRecipientSelection = () => {};
            globalThis.toggleRequesterSameAsRecipient = () => {};
            globalThis.validateSubscriptionDuplicateSubmitGuard = async () => true;
            globalThis.showToast = () => {};
            globalThis.closeForm = () => {};
            globalThis.kiwiApi = { post: async (url, payload) => { requests.push({ url, payload }); } };

            await createSubscription();

            assert.equal(requests.length, 1, scenario.name);
            assert.equal(requests[0].url, '/api/v1/workflows/subscription');
            assert.deepEqual(requests[0].payload.recipient, recipient, scenario.name);
            const expectedRequester = scenario.shouldFollow && !scenario.checked ? { sameAsRecipient: true } : requester;
            assert.deepEqual(requests[0].payload.requester, expectedRequester, scenario.name);
            assert.equal(checkbox.checked, Boolean(scenario.shouldFollow), scenario.name);
            assert.deepEqual(requester, originalRequester, scenario.name);
        }
    } finally {
        for (const [key, value] of previous) {
            if (value === undefined) delete globalThis[key];
            else globalThis[key] = value;
        }
    }
}

async function testMissingOfferMandantStopsTheEntireSubmission() {
    const previous = { document: globalThis.document, kiwiWerfsleutelSlice: globalThis.kiwiWerfsleutelSlice,
        kiwiApi: globalThis.kiwiApi, showToast: globalThis.showToast };
    let posts = 0;
    let focused = false;
    const toasts = [];
    globalThis.document = { getElementById: () => ({ focus() { focused = true; } }) };
    globalThis.kiwiWerfsleutelSlice = { getSelections: () => [
        { selectedKey: { salesCode: 'VALID', mandant: 'AVROTROS' }, selectedChannel: 'TM/IB' },
        { selectedKey: { salesCode: 'UNMAPPED' }, selectedChannel: 'TM/IB' }
    ] };
    globalThis.kiwiApi = { post() { posts += 1; } };
    globalThis.showToast = (message, type) => toasts.push({ message, type });
    try {
        await createSubscription({ preventDefault() {} });
        assert.equal(posts, 0);
        assert.equal(focused, true);
        assert.equal(toasts[0].type, 'error');
        assert.match(toasts[0].message, /mandant/);
    } finally {
        Object.assign(globalThis, previous);
    }
}


function deferredSubmission() {
    let resolve;
    let reject;
    const promise = new Promise((onResolve, onReject) => { resolve = onResolve; reject = onReject; });
    return { promise, resolve, reject };
}

async function withPendingSubmissionFixture(check) {
    const globals = ['document', 'kiwiApi', 'kiwiWerfsleutelSlice', 'kiwiCustomerWorkSession',
        'buildSubscriptionRolePayload', 'normalizeRequesterSameAsRecipientSelection',
        'validateSubscriptionDuplicateSubmitGuard', 'showToast', 'closeForm', 'i18n',
        'initializeSubscriptionRolesForForm', 'renderRequesterSameSummary', 'kiwiLegacyCustomerSearchBridge',
        'window', 'setInterval', 'kiwiOutbox'];
    const previous = new Map(globals.map(key => [key, globalThis[key]]));
    const form = createDomElement();
    const submit = createDomElement();
    const cancel = createDomElement();
    const status = createDomElement();
    status.hidden = true;
    const elements = { subscriptionForm: form, subscriptionSubmitStatus: status,
        subscriptionSubmissionId: { value: 'synthetic-pending-submission' }, subStartDate: { value: '2035-01-01' },
        requesterSameAsRecipient: { checked: true }, subRecipientLastName: { value: 'Keep this edit' },
        subIBAN: { value: 'synthetic-account', required: false }, newSubscriptionForm: createDomElement() };
    form.querySelector = selector => selector === 'button[type="submit"]' ? submit : null;
    form.reset = () => {};
    const requests = [];
    const toasts = [];
    const fixture = { elements, form, submit, cancel, status, requests, toasts, validationCalls: 0 };
    try {
        globalThis.document = {
            getElementById: id => elements[id] || null,
            querySelector: selector => selector === 'input[name="subPayment"]:checked' ? { value: 'AC' } : null,
            addEventListener() {}
        };
        globalThis.kiwiWerfsleutelSlice = { getSelections: () => [{
            selectedKey: { salesCode: 'PENDING-TEST', mandant: 'HMC', subscriptionKind: 'membership', productCode: 'ATV' },
            selectedChannel: 'OL'
        }], resetPicker() {}, refreshCatalogIfStale() {} };
        globalThis.kiwiCustomerWorkSession = {};
        globalThis.buildSubscriptionRolePayload = role => role === 'recipient'
            ? { personId: 51, credentialKey: 'synthetic-source', mandant: 'HMC' } : { sameAsRecipient: true };
        globalThis.normalizeRequesterSameAsRecipientSelection = () => {};
        globalThis.validateSubscriptionDuplicateSubmitGuard = async () => { fixture.validationCalls += 1; return true; };
        globalThis.initializeSubscriptionRolesForForm = () => {};
        globalThis.renderRequesterSameSummary = () => {};
        globalThis.kiwiLegacyCustomerSearchBridge = { getCurrentCustomer: () => null, getCustomers: () => [] };
        globalThis.showToast = (message, type) => toasts.push({ message, type });
        globalThis.closeForm = id => { elements[id].style.display = 'none'; };
        globalThis.i18n = { t: key => key === 'subscription.submitting' ? nl.subscription.submitting : key };
        globalThis.kiwiApi = {
            post: (url, payload) => {
                const response = deferredSubmission();
                requests.push({ url, payload, ...response });
                return response.promise;
            }
        };
        registerSubscriptionWorkflowSlice(createRouter());
        await check(fixture);
    } finally {
        clearFormDraft(elements.newSubscriptionForm);
        for (const [key, value] of previous) {
            if (value === undefined) delete globalThis[key];
            else globalThis[key] = value;
        }
    }
}

const settleSubmission = () => new Promise(resolve => setImmediate(resolve));

async function testPendingSubmissionGuardsPostsAfterConcurrentValidation() {
    await withPendingSubmissionFixture(async fixture => {
        const checks = [];
        globalThis.validateSubscriptionDuplicateSubmitGuard = () => {
            const response = deferredSubmission();
            checks.push(response);
            return response.promise;
        };
        const first = createSubscription();
        const second = createSubscription();
        assert.equal(checks.length, 2, 'no reservation blocks the original validation path');
        assert.equal(fixture.status.hidden, true, 'pending text describes actual POST only');
        assert.equal(fixture.submit.disabled, false);
        checks.forEach(check => check.resolve(true));
        await settleSubmission();
        assert.equal(fixture.requests.length, 1, 'atomic ownership allows one concurrent POST');
        assert.equal(fixture.status.textContent, nl.subscription.submitting);
        assert.equal(fixture.status.hidden, false);
        assert.equal(fixture.submit.disabled, true);
        assert.equal(fixture.submit.getAttribute('aria-busy'), 'true');
        await createSubscription({ preventDefault() {} });
        assert.equal(checks.length, 2, 'submit/Enter while POST is active does not restart validation');
        assert.equal(fixture.requests.length, 1);
        assert.equal(fixture.cancel.disabled, false);
        assert.equal(fixture.elements.subRecipientLastName.value, 'Keep this edit');
        assert.equal(fixture.requests[0].payload.submissionId, 'synthetic-pending-submission');
        assert.equal(fixture.requests[0].payload.subscription.startDate, '2035-01-01');
        assert.equal(fixture.requests[0].payload.requester.sameAsRecipient, true);
        fixture.requests[0].reject(Object.assign(Error('Controlled rejection'), { status: 422 }));
        await Promise.all([first, second]);
        assert.equal(fixture.submit.disabled, false);
        assert.equal(fixture.submit.getAttribute('aria-busy'), null);
        assert.equal(fixture.status.hidden, true);
        assert.equal(fixture.elements.subscriptionSubmissionId.value, 'synthetic-pending-submission');
        assert.equal(fixture.elements.subRecipientLastName.value, 'Keep this edit');
        assert.equal(fixture.toasts.at(-1).message, 'Controlled rejection');
        const retry = createSubscription();
        assert.equal(checks.length, 3, 'recovery can invoke normal validation again');
        checks[2].resolve(true);
        await settleSubmission();
        assert.equal(fixture.requests.length, 2, 'a sequential retry reaches existing server idempotency');
        assert.equal(fixture.requests[1].payload.submissionId, 'synthetic-pending-submission');
        fixture.requests[1].reject(Object.assign(Error('Controlled retry rejection'), { status: 422 }));
        await retry;
        assert.equal(fixture.status.hidden, true);
        assert.equal(fixture.submit.disabled, false);
    });
}

async function testPendingSubmissionRestoresAfterSuccessAndReconciliation() {
    for (const reconcile of [false, true]) {
        await withPendingSubmissionFixture(async fixture => {
            fixture.submit.setAttribute('aria-busy', 'false');
            fixture.submit.disabled = reconcile;
            const reconciliation = deferredSubmission();
            const queue = deferredSubmission();
            globalThis.i18n = { t: key => key === 'subscription.submitting' ? en.subscription.submitting : key };
            fixture.elements.subscriptionQueuePanel = createDomElement();
            fixture.elements.subscriptionQueueList = createDomElement();
            fixture.elements.subscriptionQueueList.querySelector = () => null;
            fixture.elements.subscriptionQueueList.replaceChildren = () => {};
            globalThis.window = globalThis;
            globalThis.setInterval = () => 1;
            globalThis.kiwiApi.get = async () => ({ items: [], total: 0 });
            initializeSessionOutbox();
            await settleSubmission();
            let queueReads = 0;
            globalThis.kiwiApi.get = url => {
                if (url.includes('/submission/')) return reconciliation.promise;
                queueReads += 1;
                return queue.promise;
            };
            let finished = false;
            const request = createSubscription().then(() => { finished = true; });
            await settleSubmission();
            assert.equal(fixture.status.textContent, en.subscription.submitting);
            if (reconcile) {
                fixture.requests[0].reject(Object.assign(Error('Uncertain outcome'), { status: 503 }));
                await settleSubmission();
                assert.equal(fixture.status.hidden, false, 'pending covers existing reconciliation');
                await createSubscription();
                assert.equal(fixture.requests.length, 1);
                reconciliation.resolve({ status: 'queued' });
            } else fixture.requests[0].resolve({});
            await settleSubmission();
            assert.equal(fixture.submit.disabled, reconcile, 'prior disabled state is restored before queue GET');
            assert.equal(fixture.submit.getAttribute('aria-busy'), 'false', 'prior aria state is restored');
            assert.equal(fixture.status.hidden, true);
            assert.equal(queueReads, 1, 'the existing queue refresh really is held');
            assert.equal(finished, false);
            queue.resolve({ items: [], total: 0 });
            await request;
        });
    }
}

async function testPendingSubmissionSurvivesDraftCloseAndIgnoresOlderCleanup() {
    await withPendingSubmissionFixture(async fixture => {
        globalThis.showNewSubscription();
        fixture.elements.subscriptionSubmissionId.value = 'retained-pending-submission';
        const first = createSubscription();
        await settleSubmission();
        globalThis.closeForm('newSubscriptionForm');
        globalThis.showNewSubscription();
        assert.equal(fixture.elements.newSubscriptionForm.style.display, 'flex');
        assert.equal(fixture.elements.subRecipientLastName.value, 'Keep this edit');
        assert.equal(fixture.status.hidden, false);
        assert.equal(fixture.submit.disabled, true);
        await createSubscription();
        assert.equal(fixture.requests.length, 1, 'reopening a retained draft keeps its active POST guard');

        clearFormDraft(fixture.elements.newSubscriptionForm);
        globalThis.showNewSubscription();
        assert.equal(fixture.status.hidden, true, 'a real reset invalidates the old UI owner only');
        assert.equal(fixture.submit.disabled, false);
        const second = createSubscription();
        await settleSubmission();
        assert.equal(fixture.requests.length, 2);
        assert.equal(fixture.status.hidden, false);
        fixture.requests[0].reject(Object.assign(Error('Older rejection'), { status: 422 }));
        await first;
        assert.equal(fixture.status.hidden, false, 'old finally cannot clear the newer pending cue');
        assert.equal(fixture.submit.disabled, true);
        fixture.requests[1].reject(Object.assign(Error('Current rejection'), { status: 422 }));
        await second;
        assert.equal(fixture.status.hidden, true);
        assert.equal(fixture.submit.disabled, false);
    });
}

async function run() {
    testEditCustomerKeepsMissingPreferencesUnselected();
    testRegistersItemSevenActions();
    testInstallsLegacyCompatibilityExports();
    testSubscriptionHelperFunctions();
    await testReconcilesAmbiguousMutationBySubmissionId();
    testWerfsleutelSelectionHelperPrefersMultiSelectionBridge();
    testQueueToggleUpdatesPanelVisibilityAndButtonState();
    testQueueRenderingUsesBackendDisplayFields();
    testShowNewSubscriptionPrefillsPrimaryIbanFromCurrentCustomer();
    await testEditCustomerOpensSubscriptionApiViewer();
    await testSubmissionPreservesIndependentPayerIdentity();
    await testMissingOfferMandantStopsTheEntireSubmission();
    await testPendingSubmissionGuardsPostsAfterConcurrentValidation();
    await testPendingSubmissionRestoresAfterSuccessAndReconciliation();
    await testPendingSubmissionSurvivesDraftCloseAndIgnoresOlderCleanup();
    console.log('subscription workflow slice tests passed');
}

function testEditCustomerKeepsMissingPreferencesUnselected() {
    const previousDocument = globalThis.document;
    const previousBridge = globalThis.kiwiLegacyCustomerSearchBridge;
    const form = createDomElement();
    const radios = Object.fromEntries(['editSalutation', 'editOptinEmail', 'editOptinPhone', 'editOptinPost']
        .map(name => [name, ['yes', 'no'].map(value => ({ value, checked: false }))]));
    let customer = { id: 73, optinEmail: 'yes', optinPhone: 'no', optinPost: null };
    const values = () => ['Email', 'Phone', 'Post'].map(channel =>
        radios[`editOptin${channel}`].find(input => input.checked)?.value ?? null);
    try {
        globalThis.document = {
            getElementById: id => id === 'editCustomerForm' ? form : null,
            querySelectorAll: selector => radios[selector.match(/name="([^"]+)"/)?.[1]] || []
        };
        globalThis.kiwiLegacyCustomerSearchBridge = { getCurrentCustomer: () => customer };
        registerSubscriptionWorkflowSlice(createRouter());
        globalThis.editCustomer();
        assert.deepEqual(values(), ['yes', 'no', null]);
        customer = { id: 74, optinEmail: null, optinPhone: '', optinPost: undefined };
        globalThis.editCustomer();
        assert.deepEqual(values(), [null, null, null]);
        radios.editOptinEmail[1].checked = true;
        globalThis.editCustomer();
        assert.deepEqual(values(), ['no', null, null], 'reopening the same draft preserves a deliberate choice');
        clearFormDraft(form);
        globalThis.editCustomer();
        assert.deepEqual(values(), [null, null, null], 'a fresh editor clears the previous draft');
    } finally {
        globalThis.document = previousDocument;
        globalThis.kiwiLegacyCustomerSearchBridge = previousBridge;
    }
}

await run();
