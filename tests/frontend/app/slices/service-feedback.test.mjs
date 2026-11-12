import assert from 'node:assert/strict';
import { beginServiceFormRequest, finishServiceFormRequest,
    resetServiceFormFeedback } from '../../../../assets/js/app/service-form-feedback.js';
import { resetLightboxDrafts } from '../../../../assets/js/app/lightbox-drafts.js';
import { editSubscription, saveSubscriptionEdit, showResendMagazine, resendMagazine,
    showEditorialComplaintForm, submitEditorialComplaint } from '../../../../assets/js/app/slices/subscription-workflow-slice.js';
import { cancelSubscription, completeWinback, selectOffer, revertRestitution, completeRestitutionTransfer } from '../../../../assets/js/app/slices/winback-slice.js';
import { configureCustomerDetailSliceDependencies, registerCustomerDetailSlice } from '../../../../assets/js/app/slices/customer-detail-slice.js';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function node(value = '') {
    const attributes = new Map();
    let currentValue = String(value);
    return { get value() { return currentValue; }, set value(next) { currentValue = String(next); }, textContent: '', innerHTML: '', checked: false, disabled: false, style: {},
        setAttribute(name, next) { attributes.set(name, String(next)); },
        getAttribute(name) { return attributes.get(name) ?? null; },
        removeAttribute(name) { attributes.delete(name); } };
}

function form(documentRef) {
    const commit = node();
    const previouslyDisabled = node();
    previouslyDisabled.disabled = true;
    previouslyDisabled.setAttribute('aria-busy', 'false');
    const status = node();
    const back = node();
    return { ...node(), ownerDocument: documentRef, commit, previouslyDisabled, status, back,
        querySelector() { return null; },
        querySelectorAll(selector) {
            if (selector === '[data-service-commit]') return [commit, previouslyDisabled];
            if (selector === '[data-service-status]') return [status];
            return [];
        } };
}

async function until(predicate) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        if (predicate()) return;
        await Promise.resolve();
    }
    assert.ok(predicate(), 'the original async processing path did not reach the expected phase');
}

function testOwnerLifetimeAndTwoWorkspaceResets() {
    const documentRef = {};
    const container = form(documentRef);
    for (let cycle = 0; cycle < 2; cycle += 1) {
        const request = beginServiceFormRequest(container, 'Processing…');
        assert.ok(request.isCurrent());
        assert.equal(container.commit.disabled, true);
        assert.equal(container.commit.getAttribute('aria-busy'), 'true');
        assert.equal(container.back.disabled, false);
        assert.equal(container.status.textContent, 'Processing…');
        assert.equal(beginServiceFormRequest(container, 'Duplicate'), null);
        resetLightboxDrafts(documentRef);
        assert.equal(request.isCurrent(), false);
        assert.equal(container.commit.disabled, false);
        assert.equal(container.previouslyDisabled.disabled, true);
        assert.equal(container.previouslyDisabled.getAttribute('aria-busy'), 'false');
        assert.equal(container.status.textContent, '');
    }
    const old = beginServiceFormRequest(container, 'Old');
    resetServiceFormFeedback(container);
    const current = beginServiceFormRequest(container, 'Current');
    finishServiceFormRequest(old);
    assert.ok(current.isCurrent());
    assert.equal(container.commit.disabled, true);
    assert.equal(container.status.textContent, 'Current');
    finishServiceFormRequest(current);
}

function controllerHarness() {
    const fields = Object.fromEntries(Object.entries({
        editSubId: '7', editSubMagazine: 'Evening magazine', editSubDuration: '1-jaar',
        editSubStartDate: '2030-01-01', editSubStatus: 'active', resendSubscription: '7',
        resendReason: 'not_received', editorialComplaintMagazine: 'Evening magazine',
        editorialComplaintType: 'klacht', editorialComplaintCategory: 'inhoud',
        editorialComplaintDescription: 'Private retained note', editorialComplaintEdition: '23/2030',
        editorialComplaintFollowup: '', restitutionTransferSalutation: 'Dhr.',
        restitutionTransferFirstName: 'A.', restitutionTransferMiddleName: '', restitutionTransferLastName: 'Test',
        restitutionTransferEmail: 'synthetic@example.test', restitutionTransferPhone: '0612345678',
        restitutionTransferSameAddress: '', restitutionTransferTitle: '', restitutionTransferAddressFields: ''
    }).map(([id, value]) => [id, node(value)]));
    fields.editorialComplaintFollowup.checked = true;
    let customer = { id: 1001, firstName: 'Alex', lastName: 'Test', subscriptions: [
        { id: 7, magazine: 'Evening magazine', status: 'active', startDate: '2030-01-01' },
        { id: 8, magazine: 'Morning magazine', status: 'active', startDate: '2030-01-01' }
    ] };
    const containers = {};
    const outcome = node('accepted');
    const documentRef = {
        getElementById: id => containers[id] || fields[id] || null,
        querySelector: selector => selector === 'input[name="winbackResult"]:checked' ? outcome : null,
        querySelectorAll: () => []
    };
    for (const id of ['editSubscriptionForm', 'resendMagazineForm', 'editorialComplaintForm', 'winbackFlow', 'restitutionTransferForm']) {
        containers[id] = form(documentRef);
    }
    const calls = [];
    const toasts = [];
    globalThis.document = documentRef;
    globalThis.kiwiLegacyCustomerSearchBridge = { getCurrentCustomer: () => customer };
    globalThis.kiwiApi = {
        patch(url, body) { const pending = deferred(); calls.push({ method: 'PATCH', url, body, ...pending }); return pending.promise; },
        post(url, body) { const pending = deferred(); calls.push({ method: 'POST', url, body, ...pending }); return pending.promise; }
    };
    globalThis.showToast = (message, type) => toasts.push({ message, type });
    globalThis.selectCustomer = () => {};
    return { fields, containers, calls, toasts, documentRef,
        replaceCustomer: value => customer = value, getCustomer: () => customer };
}

async function withGlobals(callback) {
    const keys = ['document', 'kiwiApi', 'kiwiLegacyCustomerSearchBridge', 'showToast', 'selectCustomer',
        'kiwiCustomerDetailSlice'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const harness = controllerHarness();
    try { await callback(harness); }
    finally {
        configureCustomerDetailSliceDependencies(null);
        resetLightboxDrafts(harness.documentRef);
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
}

const reloadCases = [
    { id: 'editSubscriptionForm', open: () => editSubscription(7), commit: saveSubscriptionEdit,
        expectedMethod: 'PATCH' },
    { id: 'winbackFlow', open() {
        cancelSubscription(7);
        selectOffer('retained', 'Retained offer', 'Known description');
    }, commit: completeWinback, expectedMethod: 'POST' }
];

async function testCanonicalNamespaceReloadAfterAcknowledgement() {
    for (const testCase of reloadCases) await withGlobals(async harness => {
        const { calls, containers } = harness;
        const reads = [];
        const cached = [];
        const projected = { ...harness.getCustomer(), provisional: true,
            subscriptions: [{ ...harness.getCustomer().subscriptions[0], magazine: 'Projected magazine', status: 'paused' }] };
        globalThis.kiwiApi.get = url => {
            const response = deferred();
            reads.push({ url, ...response });
            return response.promise;
        };
        configureCustomerDetailSliceDependencies(() => ({
            personsApiUrl: '/api/v1/persons',
            findCustomerById: () => harness.getCustomer(),
            getCurrentCustomer: harness.getCustomer,
            setCurrentCustomer: harness.replaceCustomer,
            upsertCustomerInCache: customer => cached.push(customer)
        }));
        registerCustomerDetailSlice(null);
        delete globalThis.selectCustomer;
        testCase.open();
        let settled = false;
        const pending = testCase.commit().then(() => { settled = true; });
        await until(() => calls.length === 1);
        assert.equal(calls[0].method, testCase.expectedMethod);
        calls[0].resolve({ provisional: true });
        await until(() => reads.length === 1);
        assert.equal(reads[0].url, '/api/v1/persons/1001');
        assert.equal(containers[testCase.id].style.display, 'none');
        assert.equal(containers[testCase.id].commit.disabled, true, 'the callback still awaits the canonical reload');
        assert.equal(settled, false);
        assert.notEqual(harness.getCustomer().subscriptions[0].magazine, 'Projected magazine');
        reads[0].resolve(projected);
        await pending;
        assert.equal(harness.getCustomer().provisional, true);
        assert.equal(harness.getCustomer().subscriptions[0].magazine, 'Projected magazine');
        assert.equal(harness.getCustomer().subscriptions[0].status, 'paused');
        assert.equal(cached.length, 1);
        assert.equal(containers[testCase.id].commit.disabled, false);
        assert.equal(containers[testCase.id].status.textContent, '');
        assert.equal(calls.length, 1, 'source reload does not add or replay a business mutation');
    });
}

async function testLegacyReloadOverrideRetainsPriority() {
    for (const testCase of reloadCases) await withGlobals(async harness => {
        const refresh = deferred();
        const selected = [];
        let canonicalCalls = 0;
        globalThis.kiwiCustomerDetailSlice = { selectCustomer() { canonicalCalls += 1; } };
        globalThis.selectCustomer = customerId => { selected.push(customerId); return refresh.promise; };
        testCase.open();
        let settled = false;
        const pending = testCase.commit().then(() => { settled = true; });
        await until(() => harness.calls.length === 1);
        harness.calls[0].resolve({ provisional: true });
        await until(() => selected.length === 1);
        assert.deepEqual(selected, [1001]);
        assert.equal(canonicalCalls, 0, 'a legacy override remains the first-choice callback');
        assert.equal(settled, false, 'the original asynchronous override is still awaited');
        refresh.resolve();
        await pending;
        assert.equal(harness.containers[testCase.id].commit.disabled, false);
    });
}

async function testControllersClaimOnlyAfterValidationAndRetainPendingDraft() {
    for (const testCase of [
        { id: 'editSubscriptionForm', open: () => editSubscription(7), commit: saveSubscriptionEdit,
            field: 'editSubId', invalid: '', valid: '7', resolution: { provisional: true } },
        { id: 'resendMagazineForm', open: showResendMagazine, commit: resendMagazine,
            field: 'resendSubscription', invalid: '', valid: '7', resolution: {} },
        { id: 'editorialComplaintForm', open: showEditorialComplaintForm, commit: submitEditorialComplaint,
            field: 'editorialComplaintDescription', invalid: '', valid: 'Private retained note', resolution: {} }
    ]) await withGlobals(async harness => {
        const { containers, fields, calls } = harness;
        const container = containers[testCase.id];
        testCase.open();
        fields.editorialComplaintMagazine.value = 'Evening magazine';
        fields[testCase.field].value = testCase.invalid;
        await testCase.commit();
        assert.equal(calls.length, 0, `${testCase.id} invalid input never claims a request`);
        assert.equal(container.commit.disabled, false);
        assert.equal(container.status.textContent, '');

        fields[testCase.field].value = testCase.valid;
        const first = testCase.commit();
        await until(() => calls.length === 1);
        assert.equal(container.commit.disabled, true);
        assert.ok(container.status.textContent.length > 0);
        const pendingCopy = container.status.textContent;
        await testCase.commit();
        assert.equal(calls.length, 1, `${testCase.id} suppresses a second commit`);
        testCase.open();
        assert.equal(container.status.textContent, pendingCopy, 'hidden/reopen keeps the pending owner');
        assert.equal(fields[testCase.field].value, testCase.valid, 'reopening retains draft input');
        calls[0].reject(new Error('Controlled local rejection'));
        await first;
        assert.equal(container.commit.disabled, false);
        assert.equal(container.status.textContent, '');
        assert.equal(fields[testCase.field].value, testCase.valid);
        const retry = testCase.commit();
        await until(() => calls.length === 2);
        calls[1].resolve(testCase.resolution);
        await retry;
        assert.equal(container.commit.disabled, false);
        assert.equal(container.status.textContent, '');
    });
}

async function testOldFailureCannotChangeNewOwner() {
    await withGlobals(async harness => {
        const { containers, fields, calls, toasts, documentRef } = harness;
        showEditorialComplaintForm();
        fields.editorialComplaintMagazine.value = 'Evening magazine';
        fields.editorialComplaintDescription.value = 'Old private note';
        const old = submitEditorialComplaint();
        await until(() => calls.length === 1);
        resetLightboxDrafts(documentRef);
        showEditorialComplaintForm();
        fields.editorialComplaintMagazine.value = 'Morning magazine';
        fields.editorialComplaintDescription.value = 'New private note';
        const current = submitEditorialComplaint();
        await until(() => calls.length === 2);
        const pendingCopy = containers.editorialComplaintForm.status.textContent;
        calls[0].reject(new Error('Old failure must stay with the old flow'));
        await old;
        assert.equal(containers.editorialComplaintForm.commit.disabled, true);
        assert.equal(containers.editorialComplaintForm.status.textContent, pendingCopy);
        assert.equal(fields.editorialComplaintDescription.value, 'New private note');
        assert.equal(toasts.some(toast => toast.message.includes('Old failure')), false);
        calls[1].resolve({});
        await current;
    });
}

async function testOldEditStillCompletesItsRequiredHistorySequence() {
    await withGlobals(async harness => {
        const { containers, calls, documentRef } = harness;
        editSubscription(7);
        const old = saveSubscriptionEdit();
        await until(() => calls.length === 1);
        resetLightboxDrafts(documentRef);
        harness.replaceCustomer({ ...harness.getCustomer(), id: 2002 });
        editSubscription(7);
        const current = saveSubscriptionEdit();
        await until(() => calls.length === 2);
        calls[0].resolve({ provisional: false });
        await until(() => calls.length === 3);
        assert.equal(calls[2].url, '/api/v1/persons/1001/contact-history', 'UI invalidation never cancels the original required business follow-up');
        calls[2].resolve({});
        await old;
        assert.equal(containers.editSubscriptionForm.commit.disabled, true);
        assert.equal(containers.editSubscriptionForm.style.display, 'flex');
        calls[1].resolve({ provisional: true });
        await current;
        assert.equal(calls.length, 3, 'provisional save retains its original no-history rule');
    });
}

async function testOldRefreshDoesNotClearNewWinbackSelection() {
    await withGlobals(async harness => {
        const { calls } = harness;
        const refresh = deferred();
        globalThis.selectCustomer = () => refresh.promise;
        cancelSubscription(7);
        selectOffer('old-offer', 'Old offer', 'Old description');
        const old = completeWinback();
        await until(() => calls.length === 1);
        calls[0].resolve({});
        await until(() => harness.containers.winbackFlow.style.display === 'none');
        cancelSubscription(8);
        selectOffer('new-offer', 'New offer', 'New description');
        refresh.resolve();
        await old;
        globalThis.selectCustomer = () => {};
        const current = completeWinback();
        await until(() => calls.length === 2);
        assert.equal(calls[1].url, '/api/v1/subscriptions/1001/8');
        assert.deepEqual(calls[1].body, { result: 'accepted', offer: {
            id: 'new-offer', title: 'New offer', description: 'New description'
        } }, 'an older refresh completion cannot clear the new flow identity/selection');
        calls[1].resolve({});
        await current;
    });
}

async function testRestitutionCleanupKeepsTheOriginalAddressSession() {
    await withGlobals(async harness => {
        const { calls, containers, documentRef } = harness;
        const customer = harness.getCustomer();
        customer.subscriptions[0].status = 'restituted';
        const deletions = [];
        globalThis.kiwiApi.delete = async url => deletions.push(url);
        revertRestitution(7);
        const old = completeRestitutionTransfer();
        await until(() => calls.length === 1);
        const oldSession = calls[0].body.transferData.formSessionId;
        resetLightboxDrafts(documentRef);
        revertRestitution(7);
        const current = completeRestitutionTransfer();
        await until(() => calls.length === 2);
        const currentSession = calls[1].body.transferData.formSessionId;
        assert.notEqual(oldSession, currentSession);
        calls[0].resolve({});
        await old;
        assert.deepEqual(deletions, [`/api/v1/addresses/sessions/${oldSession}`]);
        assert.equal(containers.restitutionTransferForm.commit.disabled, true);
        assert.equal(containers.restitutionTransferForm.style.display, 'flex');
        calls[1].reject(new Error('Controlled rejection keeps the current session'));
        await current;
        assert.deepEqual(deletions, [`/api/v1/addresses/sessions/${oldSession}`], 'old success cannot delete the new form session');
    });
}

testOwnerLifetimeAndTwoWorkspaceResets();
await testControllersClaimOnlyAfterValidationAndRetainPendingDraft();
await testOldFailureCannotChangeNewOwner();
await testOldEditStillCompletesItsRequiredHistorySequence();
await testOldRefreshDoesNotClearNewWinbackSelection();
await testRestitutionCleanupKeepsTheOriginalAddressSession();
await testCanonicalNamespaceReloadAfterAcknowledgement();
await testLegacyReloadOverrideRetainsPriority();
console.log('service pending ownership, validation, duplicate, retry, reset and stale completion tests passed');
