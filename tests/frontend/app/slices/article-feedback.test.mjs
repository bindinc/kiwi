import assert from 'node:assert/strict';
import { filterArticles, fetchArticleById, renderOrderItems, resetArticleSearchFeedback,
    __articleSearchTestUtils } from '../../../../assets/js/app/slices/article-search-slice.js';
import { configureOrderSliceDependencies, createArticleSale, showArticleSale,
    registerOrderActions } from '../../../../assets/js/app/slices/order.js';
import { resetLightboxDrafts } from '../../../../assets/js/app/lightbox-drafts.js';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function element(value = '') {
    const attributes = new Map();
    return {
        value, textContent: '', innerHTML: '', style: {}, dataset: {}, disabled: false,
        getAttribute(name) { return attributes.has(name) ? attributes.get(name) : null; },
        setAttribute(name, next) { attributes.set(name, String(next)); },
        removeAttribute(name) { attributes.delete(name); }
    };
}

async function until(predicate) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        if (predicate()) return;
        await Promise.resolve();
    }
    assert.ok(predicate(), 'the actual async path did not reach the expected phase');
}

async function withGlobals(callback) {
    const keys = ['document', 'kiwiApi', 'showToast', 'i18n', 'kiwiOrderSlice'];
    const originals = new Map(keys.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
    try { await callback(); }
    finally {
        resetArticleSearchFeedback();
        configureOrderSliceDependencies(null);
        for (const [key, descriptor] of originals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor);
            else delete globalThis[key];
        }
    }
}

async function testLookupFeedbackOwnership() {
    __articleSearchTestUtils.resetStateForTests();
    const nodes = Object.fromEntries(['articleSearch', 'articleDropdown', 'articleSearchStatus'].map(id => [id, element()]));
    globalThis.document = { getElementById: id => nodes[id] || null };
    const requests = [];
    globalThis.kiwiApi = { get(url) {
        const pending = deferred();
        requests.push({ url, ...pending });
        return pending.promise;
    } };
    const errors = [];
    globalThis.showToast = message => errors.push(message);

    const first = filterArticles('old');
    const second = filterArticles('new');
    assert.equal(requests.length, 2);
    assert.match(requests[1].url, /query=new/);
    assert.equal(nodes.articleSearch.disabled, false);
    const pendingCopy = nodes.articleSearchStatus.textContent;
    assert.notEqual(pendingCopy, '');
    requests[0].resolve([]);
    await first;
    assert.equal(nodes.articleSearchStatus.textContent, pendingCopy, 'old completion must not clear the newer cue');
    assert.equal(nodes.articleSearch.getAttribute('aria-busy'), 'true');
    requests[1].resolve([]);
    await second;
    assert.equal(nodes.articleSearchStatus.textContent, '');
    assert.equal(nodes.articleSearch.getAttribute('aria-busy'), null);
    assert.equal(nodes.articleDropdown.getAttribute('aria-busy'), null);

    const failing = filterArticles('');
    assert.match(requests[2].url, /popular=true/, 'empty query retains the existing popular request');
    requests[2].reject(new Error('lookup unavailable'));
    await failing;
    assert.deepEqual(errors, ['lookup unavailable']);
    assert.equal(nodes.articleSearchStatus.textContent, '');

    const oldFlow = filterArticles('old-flow');
    resetArticleSearchFeedback();
    assert.equal(nodes.articleSearchStatus.textContent, '');
    const newFlow = filterArticles('new-flow');
    requests[3].resolve([]);
    await oldFlow;
    assert.equal(nodes.articleSearch.getAttribute('aria-busy'), 'true');
    assert.notEqual(nodes.articleSearchStatus.textContent, '');
    requests[4].resolve([]);
    await newFlow;
    assert.equal(nodes.articleSearchStatus.textContent, '');
}

async function testCatalogPrivacyProvenance() {
    __articleSearchTestUtils.resetStateForTests();
    const known = { id: 77, name: 'Public catalog title', price: 12.5 };
    let gets = 0;
    let posts = 0;
    globalThis.kiwiApi = { async get() { gets += 1; return known; }, async post() {
        posts += 1;
        return quote;
    } };
    globalThis.showToast = () => {};
    await fetchArticleById(77);
    const item = { articleId: 77, name: known.name, quantity: 5, unitPrice: 12.5, code: 'PUB', magazine: 'Guide' };
    const unknown = { ...item, articleId: 88, name: 'Private restored name' };
    const overridden = { ...item, name: 'Private override' };
    const volume = { type: 'Stapelkorting', itemName: item.name,
        description: '10% korting op Public catalog title (5x)', amount: 6.25 };
    const { isPublicCatalogItem, isPublicVolumeDescription } = __articleSearchTestUtils;
    assert.equal(isPublicCatalogItem(item), true);
    assert.equal(isPublicCatalogItem(unknown), false);
    assert.equal(isPublicCatalogItem(overridden), false);
    assert.equal(isPublicVolumeDescription(volume, [item]), true);
    assert.equal(isPublicVolumeDescription({ ...volume, isCoupon: true }, [item]), false);
    assert.equal(isPublicVolumeDescription({ ...volume, description: 'Private restored note' }, [item]), false);
    assert.equal(isPublicVolumeDescription(volume, [overridden]), false);
    assert.equal(isPublicVolumeDescription(volume, [{ ...item, quantity: '5 Private' }]), false);
    assert.equal(isPublicVolumeDescription(volume, [{ ...item, quantity: 5.5 }]), false);
    known.name = '<input value="Private">';
    assert.equal(isPublicCatalogItem({ ...item, name: known.name }), false, 'a public marker must never contain injected controls');
    known.name = item.name;
    assert.equal(gets, 1, 'classification must not fetch to make unknown data public');
    assert.equal(posts, 0, 'classification must not change pricing');

    const quote = { items: [item, unknown, overridden], subtotal: 187.5, total: 181.25, totalDiscount: 6.25,
        discounts: [volume, { ...volume, description: 'Private coupon code', isCoupon: true }] };
    const nodes = Object.fromEntries(['orderItemsSection', 'orderItemsList', 'discountsBreakdown',
        'orderSubtotal', 'orderTotal'].map(id => [id, element()]));
    globalThis.document = { getElementById: id => nodes[id] || null };
    __articleSearchTestUtils.setOrderItems(quote.items);
    await renderOrderItems();
    const names = [...nodes.orderItemsList.innerHTML.matchAll(/<div class="order-item-name"([^>]*)>([^<]*)<\/div>/g)];
    assert.deepEqual(names.map(match => match[1].includes('data-feedback-public')), [true, false, false]);
    const descriptions = [...nodes.discountsBreakdown.innerHTML.matchAll(/<div class="discount-description"([^>]*)>([^<]*)<\/div>/g)];
    assert.deepEqual(descriptions.map(match => match[1].includes('data-feedback-public')), [true, false]);
    assert.equal(posts, 1, 'render still uses the authoritative quote exactly once');

}

function orderHarness() {
    const fields = {
        articleInitials: 'A.', articleMiddleName: '', articleLastName: 'Example',
        articlePostalCode: '1234AB', articleHouseNumber: '12', articleHouseExt: '',
        articleAddressExtension: '', articleAddress: 'Example Street', articleCity: 'Example City',
        articleEmail: 'example@example.test', articlePhone: '0612345678',
        articleDesiredDelivery: '2035-03-25', articleNotes: 'Private retained note',
        articleSearch: '', articleName: '', articlePrice: ''
    };
    const nodes = Object.fromEntries(Object.entries(fields).map(([id, value]) => [id, element(value)]));
    const button = element();
    const form = element();
    const container = element();
    let formResets = 0;
    form.querySelector = () => button;
    form.reset = () => { formResets += 1; };
    nodes.articleForm = form;
    nodes.articleSaleForm = container;
    nodes.articleSubmitStatus = element();
    const documentRef = {
        getElementById: id => nodes[id] || null,
        querySelector: selector => ({ value: selector.includes('articlePayment') ? 'iDEAL' : 'Dhr.' })
    };
    globalThis.document = documentRef;
    const item = { articleId: 77, name: 'Public catalog title', quantity: 2, unitPrice: 12.5 };
    const quote = { items: [item], subtotal: 25, total: 25, totalDiscount: 0, discounts: [] };
    let items = [item];
    const quotes = [];
    const posts = [];
    const toasts = [];
    let birthday = '1980-03-02';
    let api = true;
    const dependencies = {
        getCurrentCustomer: () => ({ id: 81, sourceSystem: 'poc', firstName: 'A.', lastName: 'Example',
            houseNumber: '12', postalCode: '1234AB', address: 'Example Street 12', city: 'Example City',
            email: 'example@example.test', phone: '0612345678' }),
        getOrderItems: () => items,
        resetOrderItems: () => { items = []; },
        renderOrderItems: async () => {},
        ensureBirthdayValue: () => birthday,
        setBirthdayFields() {},
        initDeliveryDatePicker() {},
        translate: key => key,
        showToast: message => toasts.push(message),
        getOrderData() {
            const pending = deferred(); quotes.push(pending); return pending.promise;
        },
        getApiClient: () => api ? { post(path, payload) {
            const pending = deferred(); posts.push({ path, payload, ...pending }); return pending.promise;
        } } : null,
        closeForm: () => { container.style.display = 'none'; },
        upsertCustomerInCache() {},
        selectCustomer: async () => {},
        pushContactHistory() {},
        saveCustomers() {}
    };
    configureOrderSliceDependencies(() => dependencies);
    const handlers = {};
    registerOrderActions({ registerMany(actions) { Object.assign(handlers, actions); } });
    return { nodes, form, container, button, documentRef, quotes, posts, quote, toasts, handlers,
        get formResets() { return formResets; },
        setBirthday(value) { birthday = value; },
        setApi(value) { api = value; },
        restoreItems() { items = [item]; }
    };
}

async function testPostValidationSubmissionOwnership() {
    const h = orderHarness();
    showArticleSale();
    h.restoreItems();
    h.setBirthday(null);
    await createArticleSale();
    assert.equal(h.quotes.length, 0);
    assert.equal(h.button.disabled, false, 'invalid input must not reserve submission ownership');

    h.setBirthday('1980-03-02');
    const first = createArticleSale();
    assert.equal(h.button.disabled, true);
    assert.equal(h.button.getAttribute('aria-busy'), 'true');
    assert.equal(h.nodes.articleSubmitStatus.textContent, 'articleOrders.calculating');
    await createArticleSale();
    assert.equal(h.quotes.length, 1, 'a duplicate must not start another calculation');
    h.quotes[0].resolve(h.quote);
    await until(() => h.posts.length === 1);
    assert.equal(h.nodes.articleSubmitStatus.textContent, 'articleOrders.creating');
    assert.equal(h.posts[0].path, '/api/v1/workflows/article-order');
    assert.equal(h.posts[0].payload.customerId, 81);
    assert.deepEqual(h.posts[0].payload.order.items, h.quote.items);
    assert.equal(h.posts[0].payload.order.paymentMethod, 'iDEAL');

    h.handlers['close-article-sale-form']();
    showArticleSale();
    assert.equal(h.container.style.display, 'flex');
    assert.equal(h.button.disabled, true);
    assert.equal(h.posts.length, 1);
    assert.equal(h.nodes.articleSubmitStatus.textContent, 'articleOrders.creating');
    const retained = h.nodes.articleNotes.value;
    h.posts[0].reject(new Error('controlled failure'));
    await first;
    assert.equal(h.button.disabled, false);
    assert.equal(h.button.getAttribute('aria-busy'), null);
    assert.equal(h.nodes.articleSubmitStatus.textContent, '');
    assert.equal(h.nodes.articleNotes.value, retained);
    assert.equal(h.formResets, 0, 'failure must retain the existing draft');

    const retry = createArticleSale();
    h.quotes[1].resolve(h.quote);
    await until(() => h.posts.length === 2);
    h.posts[1].resolve({ customer: { id: 81 } });
    await retry;
    assert.equal(h.formResets, 1);
    assert.equal(h.button.disabled, false);
    assert.equal(h.nodes.articleSubmitStatus.textContent, '');
    assert.equal(h.container.style.display, 'none');
}

async function testResetAndCalculationFailureOwnership() {
    const h = orderHarness();
    showArticleSale();
    h.restoreItems();
    const old = createArticleSale();
    h.quotes[0].resolve(h.quote);
    await until(() => h.posts.length === 1);
    resetLightboxDrafts(h.documentRef);
    assert.equal(h.button.disabled, false);
    assert.equal(h.nodes.articleSubmitStatus.textContent, '');
    showArticleSale();
    h.restoreItems();
    const fresh = createArticleSale();
    assert.equal(h.quotes.length, 2);
    h.posts[0].reject(new Error('old failure'));
    await old;
    assert.equal(h.button.disabled, true, 'old finally must not release the new owner');
    assert.equal(h.nodes.articleSubmitStatus.textContent, 'articleOrders.calculating');
    h.quotes[1].reject(new Error('quote unavailable'));
    await fresh;
    assert.equal(h.posts.length, 1, 'quote failure must not start a workflow');
    assert.equal(h.button.disabled, false);
    assert.equal(h.nodes.articleSubmitStatus.textContent, '');

    h.button.disabled = true;
    h.button.setAttribute('aria-busy', 'false');
    const priorState = createArticleSale();
    h.quotes[2].reject(new Error('quote unavailable'));
    await priorState;
    assert.equal(h.button.disabled, true, 'release restores the pre-existing disabled state');
    assert.equal(h.button.getAttribute('aria-busy'), 'false');
}

async function testLocalFallbackCompletion() {
    const h = orderHarness();
    showArticleSale();
    h.restoreItems();
    h.setApi(false);
    const submission = createArticleSale();
    h.quotes[0].resolve(h.quote);
    await submission;
    assert.equal(h.posts.length, 0);
    assert.equal(h.formResets, 1);
    assert.equal(h.container.style.display, 'none');
    assert.equal(h.button.disabled, false);
    assert.equal(h.nodes.articleSubmitStatus.textContent, '');
}

async function testStaleCalculationPhaseDoesNotOverwriteNewFlow() {
    const h = orderHarness();
    showArticleSale();
    h.restoreItems();
    const old = createArticleSale();
    resetLightboxDrafts(h.documentRef);
    showArticleSale();
    h.restoreItems();
    const fresh = createArticleSale();
    assert.equal(h.nodes.articleSubmitStatus.textContent, 'articleOrders.calculating');
    h.quotes[0].resolve(h.quote);
    await until(() => h.posts.length === 1);
    const observed = h.nodes.articleSubmitStatus.textContent;
    h.posts[0].reject(new Error('controlled old completion'));
    h.quotes[1].reject(new Error('controlled fresh calculation cleanup'));
    await Promise.allSettled([old, fresh]);
    assert.equal(observed, 'articleOrders.calculating', 'old calculation must not overwrite a newer owner phase');
    assert.equal(h.nodes.articleSubmitStatus.textContent, '');
    assert.equal(h.button.disabled, false);
}

async function run() {
    await withGlobals(testStaleCalculationPhaseDoesNotOverwriteNewFlow);
    await withGlobals(testLookupFeedbackOwnership);
    await withGlobals(testCatalogPrivacyProvenance);
    await withGlobals(testPostValidationSubmissionOwnership);
    await withGlobals(testResetAndCalculationFailureOwnership);
    await withGlobals(testLocalFallbackCompletion);
    console.log('article feedback ownership and privacy tests passed');
}

await run();

