import assert from 'node:assert/strict';
import { cancelSubscription, completeWinback, generateWinbackOffers, selectOffer,
    winbackNextStep, winbackPrevStep } from '../../../../assets/js/app/slices/winback-slice.js';
import { resetLightboxDrafts } from '../../../../assets/js/app/lightbox-drafts.js';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function node(value = '') {
    const attributes = new Map();
    return { value, disabled: false, checked: false, textContent: '', innerHTML: '',
        hidden: false, style: {}, classList: { add() {}, remove() {} },
        setAttribute(name, next) { attributes.set(name, String(next)); },
        getAttribute(name) { return attributes.get(name) ?? null; },
        removeAttribute(name) { attributes.delete(name); } };
}

async function until(predicate) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        if (predicate()) return;
        await Promise.resolve();
    }
    assert.ok(predicate(), 'the actual controller did not reach its expected phase');
}

function harness() {
    const keys = ['document', 'kiwiApi', 'kiwiLegacyCustomerSearchBridge', 'showToast', 'selectCustomer'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    const originalWarn = console.warn;
    const next = node();
    const commit = node();
    const close = node();
    const back = node();
    const commitStatus = node();
    const providerStatus = node();
    const person = node();
    const magazine = node();
    const subscriptionContext = node();
    const offers = node();
    const script = node();
    const reason = node('price');
    const result = node('accepted');
    const steps = Object.fromEntries(['1', '1b', '1c', '1d', '1e', '2', '3'].map(id => [id, node()]));
    const indicators = Object.fromEntries(['1', '2', '3'].map(id => [id, node()]));
    const stepIndicator = node();
    const toasts = [];
    const warnings = [];
    const reads = [];
    const writes = [];
    let customer = { id: 1001, firstName: 'Alex', lastName: 'Test', subscriptions: [
        { id: 7, magazine: 'Evening magazine', status: 'active' }
    ] };
    let read = async () => ({ items: [] });
    let write = async () => ({});
    const form = { ...node(), querySelector(selector) {
        return { '[data-service-customer]': person, '[data-service-subscription]': magazine,
            '.service-context-subscription': subscriptionContext }[selector] || null;
    }, querySelectorAll(selector) {
        if (selector === '[data-service-commit]') return [commit];
        if (selector === '[data-service-status]') return [commitStatus];
        if (selector === '[data-action="winback-next-step"][data-arg-step="2"]') return [next];
        if (selector === '#winbackOffersStatus') return [providerStatus];
        return [];
    } };
    const fields = { winbackFlow: form, winbackOffers: offers, winbackScript: script,
        winbackOffersStatus: providerStatus, deceasedSubscriptionsList: node(),
        ...Object.fromEntries(Object.entries(steps).map(([id, step]) => [`winbackStep${id}`, step])) };
    const documentRef = {
        getElementById: id => fields[id] || null,
        querySelector(selector) {
            if (selector === 'input[name="cancelReason"]:checked') return reason.checked ? reason : null;
            if (selector === 'input[name="winbackResult"]:checked') return result;
            if (selector === '#winbackFlow .steps-indicator') return stepIndicator;
            const match = selector.match(/^\[data-step="(\d)"\]$/);
            return match ? indicators[match[1]] : null;
        },
        querySelectorAll(selector) {
            if (selector === '.winback-step') return Object.values(steps);
            if (selector === '.step') return Object.values(indicators);
            return [];
        }
    };
    form.ownerDocument = documentRef;
    reason.checked = true;
    globalThis.document = documentRef;
    globalThis.kiwiApi = {
        get(url) { reads.push(url); return read(url); },
        post(url, body) { writes.push({ url, body }); return write(url, body); }
    };
    globalThis.kiwiLegacyCustomerSearchBridge = { getCurrentCustomer: () => customer };
    globalThis.showToast = (message, type) => toasts.push({ message, type });
    globalThis.selectCustomer = () => {};
    console.warn = (...args) => warnings.push(args);
    cancelSubscription(7);
    return { form, next, commit, close, back, commitStatus, providerStatus, offers, script, reason,
        steps, toasts, warnings, reads, writes, person,
        setRead(handler) { read = handler; }, setWrite(handler) { write = handler; },
        freshSubscription() {
            customer.subscriptions.push({ id: 9, magazine: 'Different subscription', status: 'active' });
            cancelSubscription(9);
        },
        newWorkspace() {
            resetLightboxDrafts(documentRef);
            customer = { id: 2002, firstName: 'New', lastName: 'Customer', subscriptions: [
                { id: 8, magazine: 'New magazine', status: 'active' }
            ] };
            cancelSubscription(8);
        },
        cleanup() {
            resetLightboxDrafts(documentRef);
            console.warn = originalWarn;
            for (const [key, descriptor] of originals) {
                if (descriptor) Object.defineProperty(globalThis, key, descriptor);
                else delete globalThis[key];
            }
        } };
}

const retainedOffer = { offerId: 'retained', title: 'Retained "offer"', description: 'Known description' };

async function testHeldLoadAndDuplicateNext() {
    const state = harness();
    try {
        const response = deferred();
        state.setRead(() => response.promise);
        const pending = winbackNextStep(2);
        assert.deepEqual(state.reads, ['/api/v1/webabo/offers?limit=20']);
        assert.equal(state.next.disabled, true);
        assert.equal(state.next.getAttribute('aria-busy'), 'true');
        assert.equal(state.providerStatus.textContent, 'Aanbiedingen laden…');
        assert.equal(state.commitStatus.textContent, '');
        assert.equal(state.close.disabled, false);
        assert.equal(state.back.disabled, false);
        state.form.style.display = 'none';
        state.reason.value = 'delivery';
        cancelSubscription(7);
        assert.equal(state.form.style.display, 'flex');
        assert.equal(state.reason.value, 'delivery', 'reopening retains the selected reason');
        assert.equal(state.providerStatus.textContent, 'Aanbiedingen laden…', 'reopening retains the pending owner');
        assert.equal(state.next.disabled, true);
        await winbackNextStep(2);
        assert.equal(state.reads.length, 1, 'duplicate Next must not issue a second GET');
        assert.equal(state.steps['1'].style.display, 'block');
        assert.equal(state.steps['2'].style.display, 'none', 'duplicate Next must not advance the held first load');
        response.resolve({ items: [retainedOffer] });
        await pending;
        assert.equal(state.steps['2'].style.display, 'block');
        assert.equal(state.next.disabled, false);
        assert.equal(state.next.getAttribute('aria-busy'), null);
        assert.equal(state.providerStatus.textContent, '');
        assert.ok(state.offers.innerHTML.includes('Retained &quot;offer&quot;'));
        assert.equal(state.writes.length, 0);
    } finally { state.cleanup(); }
}

async function testDirectRefreshAndNumericBack() {
    const state = harness();
    try {
        selectOffer('retained', retainedOffer.title, retainedOffer.description);
        state.setRead(async () => ({ items: [retainedOffer] }));
        assert.equal(await generateWinbackOffers('delivery'), undefined, 'direct refresh keeps its void completion contract');
        assert.equal(state.steps['1'].style.display, 'block', 'direct refresh does not navigate');
        assert.match(state.offers.innerHTML, /value="retained" checked/);
        await winbackNextStep(3);
        assert.ok(state.script.innerHTML.includes('Known description'));
        const response = deferred();
        state.setRead(() => response.promise);
        assert.equal(winbackPrevStep(2), undefined, 'numeric Back keeps its existing synchronous interface');
        assert.equal(state.steps['3'].style.display, 'block');
        response.resolve({ items: [retainedOffer] });
        await until(() => state.steps['2'].style.display === 'block');
        assert.match(state.offers.innerHTML, /value="retained" checked/);
        assert.equal(state.writes.length, 0);
    } finally { state.cleanup(); }
}

async function testValidationEmptyFailureAndRetry() {
    const state = harness();
    try {
        state.reason.checked = false;
        await winbackNextStep(2);
        assert.equal(state.reads.length, 0);
        assert.equal(state.next.disabled, false);
        assert.equal(state.toasts.at(-1).type, 'error');
        state.reason.checked = true;
        state.reason.value = 'deceased';
        await winbackNextStep(2);
        assert.equal(state.reads.length, 0, 'deceased routing does not load ordinary offers');
        assert.equal(state.steps['1b'].style.display, 'block');
        state.reason.value = 'price';
        await winbackNextStep(1);
        state.setRead(async () => ({ items: [] }));
        await winbackNextStep(2);
        assert.equal(state.steps['2'].style.display, 'block', 'empty offers keep the existing step advance');
        assert.equal(state.offers.innerHTML, '');
        assert.equal(state.toasts.at(-1).type, 'warning');
        await winbackNextStep(1);
        state.setRead(async () => { throw new Error('Controlled provider failure'); });
        await winbackNextStep(2);
        assert.equal(state.steps['2'].style.display, 'block', 'provider failure keeps the existing step advance');
        assert.deepEqual(state.toasts.at(-1), { message: 'Controlled provider failure', type: 'error' });
        assert.equal(state.warnings.length, 1);
        assert.equal(state.providerStatus.textContent, '');
        await winbackNextStep(1);
        state.setRead(async () => ({ items: [retainedOffer] }));
        await winbackNextStep(2);
        assert.ok(state.offers.innerHTML.includes('Known description'));
        await winbackNextStep(1);
        globalThis.kiwiApi = null;
        await winbackNextStep(2);
        assert.equal(state.steps['2'].style.display, 'block', 'unavailable client keeps the existing step advance');
        assert.equal(state.toasts.at(-1).type, 'error');
        assert.equal(state.next.disabled, false);
    } finally { state.cleanup(); }
}

async function testStaleLoadAndRepeatedWorkspaceReset() {
    const state = harness();
    try {
        for (const fails of [false, true]) {
            const oldResponse = deferred();
            state.setRead(() => oldResponse.promise);
            const old = winbackNextStep(2);
            state.newWorkspace();
            const currentResponse = deferred();
            state.setRead(() => currentResponse.promise);
            const current = winbackNextStep(2);
            if (fails) oldResponse.reject(new Error('Old provider failure'));
            else oldResponse.resolve({ items: [{ offerId: 'old', title: 'Old context offer' }] });
            await old;
            assert.equal(state.steps['1'].style.display, 'block');
            assert.equal(state.steps['2'].style.display, 'none');
            assert.equal(state.next.disabled, true, 'old finally must not unlock the newer load');
            assert.equal(state.providerStatus.textContent, 'Aanbiedingen laden…');
            assert.ok(state.person.textContent.includes('New Customer'));
            assert.ok(!state.offers.innerHTML.includes('Old context offer'));
            assert.ok(!state.toasts.some(toast => toast.message === 'Old provider failure'));
            currentResponse.resolve({ items: [retainedOffer] });
            await current;
            assert.equal(state.steps['2'].style.display, 'block');
            state.newWorkspace();
            assert.equal(state.next.disabled, false);
        }
    } finally { state.cleanup(); }
}

async function testFreshSubscriptionInvalidatesTheOldLoad() {
    const state = harness();
    try {
        const oldResponse = deferred();
        state.setRead(() => oldResponse.promise);
        const old = winbackNextStep(2);
        state.freshSubscription();
        const currentResponse = deferred();
        state.setRead(() => currentResponse.promise);
        const current = winbackNextStep(2);
        oldResponse.resolve({ items: [{ offerId: 'old', title: 'Old subscription offer' }] });
        await old;
        assert.equal(state.steps['1'].style.display, 'block');
        assert.equal(state.steps['2'].style.display, 'none');
        assert.equal(state.next.disabled, true);
        assert.ok(!state.offers.innerHTML.includes('Old subscription offer'));
        currentResponse.resolve({ items: [retainedOffer] });
        await current;
        assert.equal(state.steps['2'].style.display, 'block');
    } finally { state.cleanup(); }
}

async function testHeldCommitDoesNotBlockBackOrLoseItsCue() {
    const state = harness();
    try {
        selectOffer('retained', retainedOffer.title, retainedOffer.description);
        await winbackNextStep(3);
        const commitResponse = deferred();
        state.setWrite(() => commitResponse.promise);
        const commit = completeWinback();
        assert.equal(state.commit.disabled, true);
        assert.equal(state.commitStatus.textContent, 'Resultaat verwerken…');
        const offerResponse = deferred();
        state.setRead(() => offerResponse.promise);
        winbackPrevStep(2);
        assert.equal(state.reads.length, 1, 'Back still loads offers while the commit owns its own feedback');
        assert.equal(state.providerStatus.textContent, 'Aanbiedingen laden…');
        assert.equal(state.commitStatus.textContent, 'Resultaat verwerken…');
        offerResponse.resolve({ items: [retainedOffer] });
        await until(() => state.steps['2'].style.display === 'block');
        assert.equal(state.providerStatus.textContent, '');
        assert.equal(state.commitStatus.textContent, 'Resultaat verwerken…', 'provider finally must not clear the held commit cue');
        assert.equal(state.commit.disabled, true, 'provider finally must not unlock the held commit');
        assert.match(state.offers.innerHTML, /value="retained" checked/);
        commitResponse.reject(new Error('Controlled commit failure'));
        await commit;
        assert.equal(state.commit.disabled, false);
        assert.equal(state.commitStatus.textContent, '');
        assert.equal(state.writes.length, 1);
    } finally { state.cleanup(); }
}

await testHeldLoadAndDuplicateNext();
await testDirectRefreshAndNumericBack();
await testValidationEmptyFailureAndRetry();
await testStaleLoadAndRepeatedWorkspaceReset();
await testFreshSubscriptionInvalidatesTheOldLoad();
await testHeldCommitDoesNotBlockBackOrLoseItsCue();
console.log('winback provider progress, duplicate, navigation and reset tests passed');
