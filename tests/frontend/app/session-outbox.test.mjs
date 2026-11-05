import assert from 'node:assert/strict';
import { isBusinessWrite, prepareWrite, acceptWrite, rejectWrite, changeRequest, refreshOutbox } from '../../../assets/js/app/session-outbox.js';

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
const element = () => ({ dataset: {}, append() {}, replaceChildren() {}, querySelector: () => null });
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
