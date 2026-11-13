import assert from 'node:assert/strict';
import { isBusinessWrite, prepareWrite, acceptWrite, rejectWrite, changeRequest, refreshOutbox, initializeSessionOutbox } from '../../../assets/js/app/session-outbox.js';

const reference = { personId: '42', credentialKey: '', sourceSystem: 'kiwi', divisionId: '', mandant: '' };
const context = { customerReference: reference };
globalThis.window = { kiwiCustomerWorkSession: { isCurrent: () => true } };
assert.equal(isBusinessWrite('GET', '/api/v1/persons/42'), false);
assert.equal(isBusinessWrite('POST', '/api/v1/persons/subscription-summaries'), false);
assert.equal(isBusinessWrite('POST', '/api/v1/call-session/hold'), false);
assert.equal(isBusinessWrite('POST', '/api/v1/call-session/disposition'), true);
assert.equal(isBusinessWrite('PATCH', '/api/v1/persons/42'), true);

const payload = { firstName: 'Changed' };
const first = prepareWrite('PATCH', '/api/v1/persons/42', payload, context);
assert.ok(first['Idempotency-Key']);
assert.equal(prepareWrite('PATCH', '/api/v1/persons/42', payload, context)['Idempotency-Key'], first['Idempotency-Key']);
rejectWrite('PATCH', '/api/v1/persons/42', payload, 503);
assert.equal(prepareWrite('PATCH', '/api/v1/persons/42', payload, context)['Idempotency-Key'], first['Idempotency-Key']);
rejectWrite('PATCH', '/api/v1/persons/42', payload, 409);
assert.notEqual(prepareWrite('PATCH', '/api/v1/persons/42', payload, context)['Idempotency-Key'], first['Idempotency-Key']);

const outbox = { id: 7, revision: 3, status: 'paused', customerReference: reference, serverTime: new Date().toISOString(), availableAt: new Date(0).toISOString(), changes: [] };
acceptWrite('PATCH', '/api/v1/persons/42', payload, { outbox }, context);
const next = prepareWrite('PATCH', '/api/v1/persons/42', { lastName: 'New' }, context);
assert.equal(next['X-Kiwi-Outbox-Id'], '7');
assert.equal(next['X-Kiwi-Outbox-Revision'], '3');
assert.equal(prepareWrite('PATCH', '/api/v1/persons/99', payload, { customerReference: { ...reference, personId: '99' } })['X-Kiwi-Outbox-Id'], undefined);
acceptWrite('PATCH', '/api/v1/persons/42', payload, { outbox: { ...outbox, status: 'ready' } }, context);
assert.equal(prepareWrite('PATCH', '/api/v1/persons/42', payload, context)['X-Kiwi-Outbox-Id'], undefined);

assert.deepEqual(changeRequest({ operation: 'updateCustomer', arguments: [42, payload] }), ['PATCH', '/api/v1/persons/42', payload]);
assert.deepEqual(changeRequest({ operation: 'createSubscriptionComplaint', arguments: [42, 9, 'damaged'] }), ['POST', '/api/v1/subscriptions/42/9/complaint', { reason: 'damaged' }]);
const command = { operation: 'subscription.create', arguments: [{ recipient: {personId: 42}, requester: {sameAsRecipient: true, personId: 42}, subscription: {requestedStatus: 'active'} }] };
const [, , signup] = changeRequest(command);
assert.deepEqual(signup.requester, {sameAsRecipient: true});
assert.equal(signup.subscription.status, 'active');
assert.equal(command.arguments[0].requester.personId, 42);
// A previous ready session must not replace the current subscription revision.
const element = () => ({ dataset: {}, children: [], setAttribute() {}, append() {}, replaceChildren() {}, querySelector: () => null });
const list = element();
globalThis.document = { getElementById: id => id === 'subscriptionQueueList' ? list : null,
    createElement: element, createTextNode: text => text };
const latest = { ...outbox, id: 9, revision: 4, status: 'pending', availableAt: new Date(Date.now() + 60000).toISOString(),
    capabilities: {}, summary: {customer: 'Test customer', changeCount: 1}, contributors: [] };
window.kiwiApi = { get: async () => ({ total: 2, items: [latest, { ...latest, id: 7, status: 'ready' }] }) };
await refreshOutbox();
const subscriptionHeaders = prepareWrite('POST', '/api/v1/workflows/subscription', {recipient: {personId: 42}}, context);
assert.equal(subscriptionHeaders['X-Kiwi-Outbox-Id'], '9');
assert.equal(subscriptionHeaders['X-Kiwi-Outbox-Revision'], '4');
delete globalThis.document;
const signupContext = { workflowSessionId: 'mandant-signup' };
const signupPayload = { recipient: { person: { firstName: 'Reader' } }, offer: { mandant: 'AVROTROS' } };
const signupHeaders = prepareWrite('POST', '/api/v1/workflows/subscription', signupPayload, signupContext);
acceptWrite('POST', '/api/v1/workflows/subscription', signupPayload,
    { outbox: { ...outbox, id: 101, customerReference: { ...reference, personId: '101', mandant: 'AVROTROS' } } }, signupContext);
const sameMandant = prepareWrite('POST', '/api/v1/workflows/subscription', { ...signupPayload, offer: { mandant: 'AVROTROS', salesCode: 'SECOND' } }, signupContext);
assert.equal(sameMandant['X-Kiwi-Outbox-Id'], '101');
const otherMandant = prepareWrite('POST', '/api/v1/workflows/subscription', { ...signupPayload, offer: { mandant: 'HMC' } }, signupContext);
assert.notEqual(otherMandant['X-Kiwi-New-Customer-Id'], signupHeaders['X-Kiwi-New-Customer-Id']);
assert.equal(otherMandant['X-Kiwi-Outbox-Id'], undefined);
const copiedCustomer = prepareWrite('POST', '/api/v1/workflows/subscription',
    { recipient: { personId: 42, mandant: 'HMC' }, offer: { mandant: 'AVROTROS' } }, signupContext);
assert.equal(copiedCustomer['X-Kiwi-Outbox-Id'], undefined);
const retainedCustomer = prepareWrite('POST', '/api/v1/workflows/subscription',
    { recipient: { personId: 42, mandant: 'AVROTROS' }, offer: { mandant: 'AVROTROS' } }, signupContext);
assert.equal(retainedCustomer['X-Kiwi-New-Customer-Id'], undefined);
// One active work session may select different existing recipients from the same source mandant.
for (const status of ['pending', 'paused']) {
    const workContext = { workflowSessionId: `one-active-work-session-${status}` };
    const sourceA = { recipient: { personId: 101, mandant: 'HMC', credentialKey: 'tvk', sourceSystem: 'subscription-api' },
        offer: { mandant: 'AVROTROS' } };
    const sourceB = { ...sourceA, recipient: { ...sourceA.recipient, personId: 202 } };
    const firstHeaders = prepareWrite('POST', '/api/v1/workflows/subscription', sourceA, workContext);
    const savedCopy = { ...outbox, id: status === 'pending' ? 555 : 556, revision: 1, status,
        availableAt: new Date(Date.now() + 60000).toISOString(),
        customerReference: { ...reference, personId: `copy-a-${status}`, mandant: 'AVROTROS' } };
    acceptWrite('POST', '/api/v1/workflows/subscription', sourceA, { outbox: savedCopy }, workContext);
    const secondHeaders = prepareWrite('POST', '/api/v1/workflows/subscription', sourceB, workContext);
    assert.notEqual(secondHeaders['X-Kiwi-New-Customer-Id'], firstHeaders['X-Kiwi-New-Customer-Id']);
    assert.equal(secondHeaders['X-Kiwi-Outbox-Id'], undefined);
    const anotherOffer = { ...sourceA, offer: { ...sourceA.offer, salesCode: 'SECOND' } };
    const sameRecipient = prepareWrite('POST', '/api/v1/workflows/subscription', anotherOffer, workContext);
    assert.equal(sameRecipient['X-Kiwi-New-Customer-Id'], firstHeaders['X-Kiwi-New-Customer-Id']);
    assert.equal(sameRecipient['X-Kiwi-Outbox-Id'], String(savedCopy.id));
    assert.equal(prepareWrite('POST', '/api/v1/workflows/subscription', sourceB, workContext)['Idempotency-Key'], secondHeaders['Idempotency-Key']);
    const otherSourceSilo = { ...sourceA, recipient: { ...sourceA.recipient, credentialKey: 'tkp' } };
    assert.notEqual(prepareWrite('POST', '/api/v1/workflows/subscription', otherSourceSilo, workContext)['X-Kiwi-New-Customer-Id'], firstHeaders['X-Kiwi-New-Customer-Id']);

    // Corrections restored as a new-person form still refresh the source customer's cached revision.
    acceptWrite('POST', '/api/v1/workflows/subscription', signupPayload,
        { outbox: { ...savedCopy, revision: 2 } }, workContext);
    assert.equal(prepareWrite('POST', '/api/v1/workflows/subscription', anotherOffer, workContext)['X-Kiwi-Outbox-Revision'], '2');
}
delete globalThis.window;

// This controller double models focus lost by DOM replacement; actual native layout,
// popover dismissal and dialog containment are independently exercised in both browsers.
function outboxDocument() {
    const doc = { activeElement: null, scrolls: [], addEventListener() {} };
    function create(tag) {
        const attributes = {};
        const node = {
            tag, dataset: {}, style: {}, children: [], listeners: {}, parentElement: null, open: false,
            get isConnected() { return this === doc.body || Boolean(this.parentElement?.isConnected); },
            setAttribute(name, value) { attributes[name] = String(value); },
            getAttribute(name) { return attributes[name] ?? null; },
            append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } },
            prepend(...children) { for (const child of children) child.parentElement = this; this.children.unshift(...children); },
            replaceChildren(...children) {
                if (this.children.some(child => child.contains(doc.activeElement))) doc.activeElement = doc.body;
                for (const child of this.children) child.parentElement = null;
                this.children = [];
                this.append(...children);
            },
            contains(target) { return this === target || this.children.some(child => child.contains(target)); },
            matches(selector) {
                if (selector === ':popover-open') return this.popoverOpen === true;
                if (selector.startsWith('.')) return this.className?.split(' ').includes(selector.slice(1));
                const attribute = selector.match(/^\[([\w-]+)="([^"]+)"\]$/);
                if (attribute) {
                    const [, name, value] = attribute;
                    const actual = name.startsWith('data-')
                        ? this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())]
                        : this[name] ?? this.getAttribute(name);
                    return actual === value;
                }
                const presence = selector.match(/^\[([\w-]+)\]$/);
                if (presence) return this.getAttribute(presence[1]) !== null;
                return this.tag === selector;
            },
            closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector); },
            querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); },
            querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
            addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); },
            async emit(name, detail = {}) { for (const callback of this.listeners[name] || []) await callback({ preventDefault() {}, detail: 0, ...detail }); },
            focus() { if (!this.disabled) doc.activeElement = this; },
            scrollIntoView(options) { doc.scrolls.push({ target: this, options }); },
            getBoundingClientRect() { return { right: 200, top: 50, bottom: 90, width: 180, height: 120 }; },
            showPopover() { this.popoverOpen = true; },
            hidePopover() { this.popoverOpen = false; },
            showModal() { this.open = true; },
            close() { this.open = false; void this.emit('close'); }
        };
        node.classList = {
            contains(name) { return node.className?.split(' ').includes(name) || false; },
            add(name) { node.className = `${node.className || ''} ${name}`; },
            toggle(name, enabled) { if (enabled) this.add(name); }
        };
        return node;
    }
    doc.createElement = create;
    doc.createElementNS = (_, tag) => create(tag);
    doc.createTextNode = text => Object.assign(create('text'), { textContent: text });
    doc.body = create('body');
    doc.activeElement = doc.body;
    doc.getElementById = id => {
        const search = node => node.id === id ? node : node.children.map(search).find(Boolean);
        return search(doc.body) || null;
    };
    doc.querySelectorAll = selector => doc.body.querySelectorAll(selector);
    return doc;
}

const dom = outboxDocument();
globalThis.document = dom;
globalThis.window = {};
globalThis.innerWidth = 390;
globalThis.innerHeight = 320;
const focusList = dom.createElement('div'); focusList.id = 'subscriptionQueueList';
const focusTitle = dom.createElement('h2'); focusTitle.id = 'sessionOutboxTitle';
const outside = dom.createElement('button');
dom.body.append(focusTitle, focusList, outside);
let fixtureItems = [{ ...latest, id: 900, revision: 10, capabilities: { edit: true, pause: true }, changes: [] }];
let pendingRead = null;
const mutations = [];
window.kiwiApi = {
    async get(url) { return pendingRead ? pendingRead : { total: fixtureItems.length, items: fixtureItems }; },
    async post(url, payload, options) {
        mutations.push({ url, payload, options });
        return fixtureItems[0];
    }
};
function currentControl(kind) { return focusList.querySelector(`[data-outbox-control="${kind}"]`); }
async function settleOutbox() { for (let index = 0; index < 12; index++) await Promise.resolve(); }
try {
    await refreshOutbox();
    const oldTrigger = currentControl('actions');
    oldTrigger.focus();
    fixtureItems = [{ ...fixtureItems[0], revision: 11 }];
    await refreshOutbox();
    assert.notEqual(currentControl('actions'), oldTrigger);
    assert.equal(oldTrigger.isConnected, false);
    assert.equal(dom.activeElement, currentControl('actions'), 'polling preserves a focused closed-menu trigger');
    assert.equal(dom.scrolls.length, 0, 'a matching leaf control keeps its existing scroll position');
    await currentControl('actions').emit('click');
    const menu = focusList.querySelector('.session-outbox-menu');
    await refreshOutbox();
    assert.equal(focusList.querySelector('.session-outbox-menu'), menu, 'an open native menu is not replaced');
    assert.equal(dom.scrolls.length, 0, 'refresh does not scroll an open menu');
    assert.equal(prepareWrite('PATCH', '/api/v1/persons/42', { firstName: 'Menu remains open' }, context)['X-Kiwi-Outbox-Id'], '900', 'the open-menu guard also preserves the server membership/revision map');
    await menu.querySelectorAll('button')[1].emit('click');
    await settleOutbox();
    assert.equal(mutations[0].options.headers['X-Kiwi-Outbox-Revision'], '11', 'restored focus activates current capability/revision callbacks');
    currentControl('customer').focus();
    await refreshOutbox();
    assert.equal(dom.activeElement, currentControl('customer'), 'customer-title focus also survives refresh');
    let finishRead;
    pendingRead = new Promise(resolve => { finishRead = resolve; });
    const refresh = refreshOutbox();
    outside.focus();
    finishRead({ total: fixtureItems.length, items: fixtureItems });
    await refresh;
    pendingRead = null;
    assert.equal(dom.activeElement, outside, 'a user who leaves during GET keeps outside focus');
    assert.equal(dom.scrolls.length, 0, 'a user who leaves during GET also keeps outside scroll position');
    currentControl('actions').focus();
    fixtureItems = [{ ...fixtureItems[0], capabilities: {} }];
    await refreshOutbox();
    assert.equal(dom.activeElement, focusList.children[0], 'capability loss falls back to the same readable row');
    assert.equal(dom.scrolls[0].target, dom.activeElement, 'the fallback article is revealed after focus restoration');
    assert.deepEqual(dom.scrolls[0].options, { block: 'nearest', inline: 'nearest' });
    fixtureItems = [{ ...fixtureItems[0], id: 901, capabilities: { edit: true } }];
    await refreshOutbox();
    assert.equal(dom.activeElement, currentControl('customer'), 'removed item falls back to a surviving row control');
    assert.equal(dom.scrolls.length, 1, 'a surviving leaf control does not use the article reveal');
    fixtureItems = [{ ...fixtureItems[0], id: 903, capabilities: {} }];
    await refreshOutbox();
    assert.equal(dom.activeElement, focusList.children[0], 'a removed item can fall back to a no-control surviving article');
    assert.equal(dom.scrolls[1].target, dom.activeElement);
    assert.deepEqual(dom.scrolls[1].options, { block: 'nearest', inline: 'nearest' });
    fixtureItems = [];
    await refreshOutbox();
    assert.equal(dom.activeElement, focusTitle, 'an empty refreshed list returns focus to its heading');
    assert.equal(dom.scrolls.length, 2, 'the empty heading behavior remains unchanged');

    const changes = dom.createElement('div'); changes.id = 'sessionOutboxChanges';
    const disclosure = dom.createElement('details'); disclosure.id = 'customerSessionChanges';
    disclosure.append(dom.createElement('summary'), changes);
    const dialog = dom.createElement('dialog'); dialog.id = 'sessionOutboxEditor';
    const form = dom.createElement('form');
    const fields = dom.createElement('div'); fields.id = 'sessionOutboxEditorFields';
    const editorTitle = dom.createElement('h2'); editorTitle.id = 'sessionOutboxEditorTitle';
    const error = dom.createElement('p'); error.id = 'sessionOutboxEditorError';
    const submit = dom.createElement('button'); submit.type = 'submit';
    form.append(fields, error, submit); dialog.append(editorTitle, form);
    const close = dom.createElement('button'); close.setAttribute('data-session-outbox-editor-close', '');
    const headerClose = dom.createElement('button'); headerClose.setAttribute('data-session-outbox-editor-close', '');
    dialog.append(close, headerClose); dom.body.append(disclosure, dialog);
    // Match bare attribute selectors used to bind both native close controls.
    dom.querySelectorAll = selector => selector === '[data-session-outbox-editor-close]' ? [close, headerClose] : dom.body.querySelectorAll(selector);
    const oldSetInterval = globalThis.setInterval;
    globalThis.setInterval = () => 1;
    window.kiwiCustomerWorkSession = { endCustomerWorkSession: async () => true };
    window.kiwiCustomerDetailSlice = { selectCustomer: async () => {} };
    fixtureItems = [{ ...latest, id: 902, capabilities: { edit: true }, customers: [], contributors: [],
        changes: [{ id: 'synthetic-change', operation: 'createContactHistoryEntry', arguments: ['42', { description: 'Synthetic note' }] }] }];
    try { initializeSessionOutbox(); } finally { globalThis.setInterval = oldSetInterval; }
    await settleOutbox();
    await currentControl('customer').emit('click');
    await settleOutbox();
    const edit = changes.querySelector('button'); edit.focus();
    await edit.emit('click');
    await settleOutbox();
    assert.equal(dialog.open, true, 'the real generic editor path opens a native dialog');
    const draft = fields.querySelector('input'); draft.value = 'Retained synthetic input';
    draft.focus();
    const originalHeaders = prepareWrite('POST', '/api/v1/persons/42/contact-history', { description: 'Synthetic note' }, context);
    fixtureItems = [{ ...fixtureItems[0], revision: 99, capabilities: {} }];
    await refreshOutbox();
    assert.equal(dom.activeElement, draft, 'polling behind an open editor does not steal field focus');
    assert.equal(draft.value, 'Retained synthetic input');
    assert.equal(prepareWrite('POST', '/api/v1/persons/42/contact-history', { description: 'Synthetic note' }, context)['X-Kiwi-Outbox-Revision'], originalHeaders['X-Kiwi-Outbox-Revision'], 'polling does not replace the active editor revision');
    await headerClose.emit('click');
    assert.equal(dialog.open, false, 'header close exits native modality rather than hiding an open dialog');
    assert.equal(draft.value, 'Retained synthetic input');
    dialog.showModal();
    await close.emit('click');
    assert.equal(dialog.open, false, 'the original explicit close exits the same native dialog');
} finally {
    delete globalThis.document; delete globalThis.window;
    delete globalThis.innerWidth; delete globalThis.innerHeight;
}
