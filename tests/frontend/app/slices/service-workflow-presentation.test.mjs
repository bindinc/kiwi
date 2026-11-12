import assert from 'node:assert/strict';
import { createActionRouter } from '../../../../assets/js/app/actions.js';
import { renderServiceFormContext } from '../../../../assets/js/app/service-form-context.js';
import { createCustomerDisplaySummary } from '../../../../assets/js/app/customer-work-session.js';
import { editSubscription, showResendMagazine, showEditorialComplaintForm } from '../../../../assets/js/app/slices/subscription-workflow-slice.js';
import { cancelSubscription, completeWinback, generateWinbackOffers, generateWinbackScript, registerWinbackSlice,
    selectOffer, showRestitutionTransferForm } from '../../../../assets/js/app/slices/winback-slice.js';
import { resetLightboxDrafts } from '../../../../assets/js/app/lightbox-drafts.js';

function node(value = '') {
    return { value, textContent: '', innerHTML: '', hidden: false, checked: false, style: {},
        dataset: {}, setAttribute() {}, removeAttribute() {} };
}

function form() {
    const customer = node();
    const subscription = node();
    const subscriptionContext = node();
    return { ...node(), customer, subscription, subscriptionContext,
        querySelector(selector) {
            return { '[data-service-customer]': customer, '[data-service-subscription]': subscription,
                '.service-context-subscription': subscriptionContext }[selector] || null;
        } };
}

function offer(id, title, description) {
    const selected = new Set();
    const card = { classList: { toggle(name, enabled) { if (enabled) selected.add(name); else selected.delete(name); } },
        querySelector: () => radio, closest: () => card, selected };
    const radio = { ...node(id), tagName: 'INPUT', dataset: { action: 'select-offer', actionEvent: 'change',
        argOfferId: id, argTitle: title, argDescription: description },
        closest: selector => selector === '[data-action]' ? radio : card };
    return { card, radio };
}

const originalGlobals = new Map(['document', 'kiwiApi', 'kiwiLegacyCustomerSearchBridge', 'kiwiWinbackSlice',
    'showToast', 'selectCustomer'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const forms = Object.fromEntries(['editSubscriptionForm', 'resendMagazineForm', 'editorialComplaintForm',
    'winbackFlow', 'restitutionTransferForm'].map(id => [id, form()]));
const fields = Object.fromEntries(['editSubId', 'editSubMagazine', 'editSubDuration', 'editSubStartDate',
    'editSubStatus', 'resendSubscription', 'editorialComplaintMagazine', 'editorialComplaintType',
    'editorialComplaintCategory', 'editorialComplaintDescription', 'editorialComplaintEdition',
    'editorialComplaintFollowup', 'restitutionTransferTitle', 'restitutionTransferSameAddress',
    'restitutionTransferAddressFields', 'winbackScript', 'winbackStep1', 'winbackOffers'].map(id => [id, node()]));
let customer = { id: 1001, personId: 'P1001', firstName: 'Alex', lastName: 'Test', mandant: 'HMC',
    subscriptions: [{ id: 7, magazine: 'Evening magazine', status: 'active', startDate: '2030-01-01' }] };
const first = offer('offer-one', 'First offer', 'First description');
const second = offer('offer-two', 'Magazine "Evening" & radio', 'Second description');
const cards = [first.card, second.card];
const writes = [];
const result = node('accepted');
const documentRef = {
    getElementById: id => forms[id] || fields[id] || null,
    querySelector: selector => selector === 'input[name="winbackResult"]:checked' ? result : null,
    querySelectorAll: selector => selector === '.offer-card' ? cards : selector === '.winback-step' ? [fields.winbackStep1] : []
};

try {
    globalThis.document = documentRef;
    globalThis.kiwiLegacyCustomerSearchBridge = { getCurrentCustomer: () => customer };
    globalThis.kiwiApi = {
        get: async () => ({ items: [
            { offerId: 'offer-one', title: 'First offer', description: 'First description' },
            { offerId: 'offer-two', title: 'Magazine "Evening" & radio', description: 'Second description' }
        ] }),
        post: async (url, body) => writes.push({ url, body })
    };
    globalThis.showToast = () => {};
    globalThis.selectCustomer = () => {};

    const context = forms.editSubscriptionForm;
    renderServiceFormContext(context, customer, customer.subscriptions[0]);
    const summary = createCustomerDisplaySummary(customer);
    assert.equal(context.customer.textContent, `${summary.name} (${summary.personId}) · ${summary.sourceLabel}`);
    assert.equal(context.subscription.textContent, 'Evening magazine');
    assert.equal(context.subscriptionContext.hidden, false);
    renderServiceFormContext(context, customer);
    assert.equal(context.subscriptionContext.hidden, true);
    assert.equal(context.subscription.textContent, '');

    const openings = [
        ['editSubscriptionForm', () => editSubscription(7)],
        ['resendMagazineForm', showResendMagazine],
        ['editorialComplaintForm', showEditorialComplaintForm],
        ['winbackFlow', () => cancelSubscription(7)],
        ['restitutionTransferForm', () => showRestitutionTransferForm(customer.subscriptions[0])]
    ];
    for (const [id, open] of openings) {
        open();
        const retained = id === 'editSubscriptionForm' ? fields.editSubMagazine
            : id === 'editorialComplaintForm' ? fields.editorialComplaintDescription : forms[id];
        retained.value = 'Retained user draft';
        customer = { ...customer, firstName: '<Private updated identity>' };
        open();
        assert.ok(forms[id].customer.textContent.includes('<Private updated identity>'), `${id} refreshes context on draft resume`);
        assert.equal(retained.value, 'Retained user draft', `${id} retains entered draft values`);
        customer = { ...customer, firstName: 'Alex' };
    }

    const router = createActionRouter({ root: documentRef });
    registerWinbackSlice(router);
    assert.equal(router.dispatch({ type: 'click', target: second.radio }), false);
    assert.equal(router.dispatch({ type: 'keydown', key: 'ArrowDown', target: second.radio }), false);
    assert.equal(router.dispatch({ type: 'change', target: second.radio }), true);
    assert.equal(second.radio.checked, true);
    assert.equal(first.radio.checked, false);
    assert.equal(second.card.selected.has('selected'), true);
    generateWinbackScript();
    assert.ok(fields.winbackScript.innerHTML.includes('Magazine "Evening" & radio'));
    assert.equal(writes.length, 0, 'choosing an offer does not submit or advance the workflow');

    selectOffer('offer-one', 'First offer', 'First description', first.card);
    assert.equal(first.radio.checked, true, 'legacy card argument stays supported');
    assert.equal(second.radio.checked, false);
    selectOffer('offer-two', 'Magazine "Evening" & radio', 'Second description');
    assert.equal(second.radio.checked, true, 'programmatic selection without an element updates native choice');
    assert.equal(second.card.selected.has('selected'), true);
    assert.equal(first.card.selected.has('selected'), false);
    await generateWinbackOffers('price');
    const regeneratedInputs = fields.winbackOffers.innerHTML.match(/<input\b[^>]*>/g) || [];
    const checkedIds = regeneratedInputs.filter(markup => /\schecked(?:\s|>)/.test(markup))
        .map(markup => markup.match(/value="([^"]*)"/)[1]);
    assert.deepEqual(checkedIds, ['offer-two'], 'Back/reload regenerates the existing selected offer as checked');
    generateWinbackScript();
    assert.ok(fields.winbackScript.innerHTML.includes('Second description'));
    assert.equal(writes.length, 0, 'reloading available offers does not submit the selected offer');
    await completeWinback();
    assert.deepEqual(writes, [{ url: '/api/v1/subscriptions/1001/7', body: {
        result: 'accepted', offer: { id: 'offer-two', title: 'Magazine "Evening" & radio', description: 'Second description' }
    } }], 'the original explicit completion sends the unchanged selected-offer contract');
    console.log('service workflow context and native-choice action/state tests passed');
} finally {
    resetLightboxDrafts(documentRef);
    for (const [key, descriptor] of originalGlobals) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete globalThis[key];
    }
}
