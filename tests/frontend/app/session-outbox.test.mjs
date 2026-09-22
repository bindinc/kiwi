import assert from 'node:assert/strict';
import { isBusinessWrite, prepareWrite, acceptWrite, rejectWrite, changeRequest } from '../../../assets/js/app/session-outbox.js';

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
delete globalThis.window;
