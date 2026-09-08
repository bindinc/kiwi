import assert from 'node:assert/strict';
import test from 'node:test';
import { configureCustomerDetailSliceDependencies, selectCustomer } from '../../../assets/js/app/slices/customer-detail-slice.js';
import {
    __customerWorkSessionTestUtils as utils,
    abandonCustomerSelection, beginCustomerMutation, configureCustomerWorkSessionSliceDependencies,
    confirmCustomerSelection, endCustomerWorkSession, finishCustomerMutation,
    isCustomerContextCurrent, startCustomerSelection
} from '../../../assets/js/app/slices/customer-work-session-slice.js';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function setup(t) {
    const previousDocument = globalThis.document;
    const previousApi = globalThis.kiwiApi;
    const previousScroll = globalThis.scrollTo;
    const customers = [1, 2, 3].map(id => ({ id, personId: String(id), sourceSystem: 'subscription-api', credentialKey: 'demo' }));
    const state = { customer: null, resets: 0, cache: [], audits: [], toasts: [] };
    globalThis.document = { getElementById: () => null, querySelector: () => null };
    globalThis.scrollTo = () => {};
    globalThis.kiwiApi = {
        async get(url) { return customers.find(c => url.includes(`/persons/${c.id}?`)); },
        async post(url, context) { state.audits.push({ url, context }); }
    };
    utils.customerWorkSession.reset();
    configureCustomerWorkSessionSliceDependencies(() => ({
        getApiClient: () => globalThis.kiwiApi,
        resetCustomerBoundState() { state.resets++; state.customer = null; state.cache = []; },
        showToast(message) { state.toasts.push(message); }
    }));
    configureCustomerDetailSliceDependencies(() => ({
        personsApiUrl: '/api/v1/persons',
        findCustomerById: id => customers.find(c => c.id === id),
        getCurrentCustomer: () => state.customer,
        setCurrentCustomer: customer => { state.customer = customer; },
        upsertCustomerInCache: customer => state.cache.push(customer.id),
        startCustomerSelection, confirmCustomerSelection, abandonCustomerSelection,
        isCustomerContextCurrent, showToast: message => state.toasts.push(message)
    }));
    t.after(() => {
        for (const id of utils.customerWorkSession.getSnapshot().activeMutationIds) utils.customerWorkSession.resolveMutation(id);
        for (const id of utils.customerWorkSession.getSnapshot().unresolvedMutationIds) utils.customerWorkSession.resolveMutation(id);
        utils.customerWorkSession.reset();
        configureCustomerDetailSliceDependencies(null);
        configureCustomerWorkSessionSliceDependencies(null);
        globalThis.document = previousDocument;
        globalThis.kiwiApi = previousApi;
        globalThis.scrollTo = previousScroll;
    });
    return state;
}

test('read-only A to B commits a new session after detail and audit, clearing the old cache', async t => {
    const state = setup(t);
    await selectCustomer(1);
    const a = utils.customerWorkSession.getRequestContext();
    const audit = deferred();
    globalThis.kiwiApi.post = async (url, context) => { state.audits.push({url, context}); await audit.promise; };
    const switching = selectCustomer(2);
    await Promise.resolve();
    assert.equal(state.customer.id, 1);
    assert.equal(state.resets, 0);
    audit.resolve();
    await switching;
    assert.equal(state.customer.id, 2);
    assert.equal(state.resets, 1);
    assert.deepEqual(state.cache, [2]);
    assert.deepEqual(state.audits[0].context, a);
    assert.notEqual(utils.customerWorkSession.getRequestContext().workflowSessionId, a.workflowSessionId);
    assert.equal(isCustomerContextCurrent(a), false);
    assert.deepEqual(state.toasts, []);
});

test('selecting the same customer retains session and never audits a reset', async t => {
    const state = setup(t);
    await selectCustomer(1);
    const id = utils.customerWorkSession.getRequestContext().workflowSessionId;
    await selectCustomer(1);
    assert.equal(utils.customerWorkSession.getRequestContext().workflowSessionId, id);
    assert.equal(state.resets, 0);
    assert.equal(state.audits.length, 0);
});

for (const failure of ['detail', 'audit']) {
    test(`${failure} failure preserves A and permits a later retry`, async t => {
        const state = setup(t);
        await selectCustomer(1);
        const id = utils.customerWorkSession.getRequestContext().workflowSessionId;
        const apiMethod = failure === 'detail' ? 'get' : 'post';
        const original = globalThis.kiwiApi[apiMethod];
        globalThis.kiwiApi[apiMethod] = async () => { throw new Error('simulated failure'); };
        await selectCustomer(2);
        assert.equal(state.customer.id, 1);
        assert.equal(state.resets, 0);
        assert.deepEqual(state.cache, [1]);
        assert.equal(utils.customerWorkSession.getRequestContext().workflowSessionId, id);
        assert.equal(utils.customerWorkSession.getSnapshot().selectionPending, false);
        globalThis.kiwiApi[apiMethod] = original;
        await selectCustomer(2);
        assert.equal(state.customer.id, 2);
    });
}

for (const lateOutcome of ['resolve', 'reject']) {
    test(`a late ${lateOutcome} from B cannot affect newer C or add an error toast`, async t => {
        const state = setup(t);
        await selectCustomer(1);
        const response = deferred();
        const get = globalThis.kiwiApi.get;
        globalThis.kiwiApi.get = url => url.includes('/persons/2?') ? response.promise : get(url);
        const b = selectCustomer(2);
        await selectCustomer(3);
        if (lateOutcome === 'resolve') response.resolve({id: 2});
        else response.reject(new Error('late failure'));
        await b;
        assert.equal(state.customer.id, 3);
        assert.deepEqual(state.cache, [3]);
        assert.deepEqual(state.toasts, []);
        assert.equal(state.audits.length, 1);
    });
}

test('editing A during the reset audit cancels B without clearing the draft', async t => {
    const state = setup(t);
    await selectCustomer(1);
    const audit = deferred();
    globalThis.kiwiApi.post = () => audit.promise;
    const b = selectCustomer(2);
    await Promise.resolve();
    utils.trackCustomerDraft({ type: 'input', target: { closest: () => ({}) } });
    audit.resolve();
    await b;
    assert.equal(state.customer.id, 1);
    assert.equal(state.resets, 0);
    assert.equal(startCustomerSelection({id: 3}).blocked, true);
});

for (const outcome of ['draft', 'queued', 'pending', 'uncertain']) {
    test(`${outcome} blocks automatic switching`, async t => {
        const state = setup(t);
        await selectCustomer(1);
        if (outcome === 'draft') utils.trackCustomerDraft({type: 'input', target: { closest: () => ({}) }});
        else {
            beginCustomerMutation('test');
            if (outcome !== 'pending') finishCustomerMutation('test', { ambiguous: outcome === 'uncertain' });
        }
        await selectCustomer(2);
        assert.equal(state.customer.id, 1);
        assert.equal(state.audits.length, 0);
        assert.equal(state.resets, 0);
        if (outcome === 'pending' || outcome === 'uncertain') assert.equal(await endCustomerWorkSession(), false);
        else {
            assert.equal(await endCustomerWorkSession(), true);
            await selectCustomer(2);
            assert.equal(state.customer.id, 2);
        }
    });
}

test('search input does not create a draft', async t => {
    const state = setup(t);
    await selectCustomer(1);
    utils.trackCustomerDraft({type: 'input', target: { closest: () => null }});
    await selectCustomer(2);
    assert.equal(state.customer.id, 2);
});

test('manual reset during a pending switch invalidates its late response', async t => {
    const state = setup(t);
    await selectCustomer(1);
    const response = deferred();
    globalThis.kiwiApi.get = () => response.promise;
    const b = selectCustomer(2);
    assert.equal(await endCustomerWorkSession(), true);
    response.resolve({id: 2});
    await b;
    assert.equal(state.customer, null);
    assert.equal(state.audits[0].context.customerReference.personId, '1');
    assert.equal(state.resets, 1);
});

test('mismatched details cannot partially reset A', async t => {
    const state = setup(t);
    await selectCustomer(1);
    globalThis.kiwiApi.get = async () => ({id: 3, personId: '3', sourceSystem: 'subscription-api', credentialKey: 'demo'});
    await selectCustomer(2);
    assert.equal(state.customer.id, 1);
    assert.equal(state.resets, 0);
    assert.equal(state.audits.length, 0);
});

test('invalid confirmation cannot clear the previous workspace', async t => {
    const state = setup(t);
    await selectCustomer(1);
    const selection = startCustomerSelection({id: 2});
    assert.equal(await confirmCustomerSelection(selection, {}), false);
    assert.equal(state.customer.id, 1);
    assert.equal(state.resets, 0);
    assert.equal(state.audits.length, 0);
});

test('detail metadata can enrich a search reference without losing the accepted customer', async t => {
    const state = setup(t);
    const get = globalThis.kiwiApi.get;
    globalThis.kiwiApi.get = async url => ({ ...await get(url), divisionId: '14', mandant: 'demo' });
    await selectCustomer(1);
    assert.equal(state.customer.id, 1);
    assert.equal(state.customer.divisionId, '14');
    await selectCustomer(2);
    assert.equal(state.customer.id, 2);
});
