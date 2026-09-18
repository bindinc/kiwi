import assert from 'node:assert/strict';
import test from 'node:test';
import { __customerWorkSessionTestUtils as utils, addressAllowsMutation, acceptCorrectedCustomer, rejectCustomerAddress } from '../../../assets/js/app/slices/customer-work-session-slice.js';

test('edits stay available while saves require a confirmed current customer address', () => {
    const session = utils.customerWorkSession;
    session.reset();
    const customer = { id: 17, addressValidation: { status: 'blocked' } };
    const context = session.startCustomerSelection(customer);
    session.confirmCustomer(context, customer);
    assert.equal(addressAllowsMutation('POST', '/api/v1/persons/17/contact-history', {}), false);
    assert.equal(addressAllowsMutation('PATCH', '/api/v1/persons/17', {email: 'new@example.invalid'}), false);
    const correction = {postalCode: '1231AA', houseNumber: '1A', city: 'LOOSDRECHT'};
    assert.equal(addressAllowsMutation('PATCH', '/api/v1/persons/17', correction), true);
    assert.equal(addressAllowsMutation('PATCH', '/api/v1/persons/17/address?credentialKey=demo', correction), true);
    assert.equal(addressAllowsMutation('PATCH', '/api/v1/persons/18', correction), false);
    acceptCorrectedCustomer({id: 18, addressValidation: {status: 'confirmed'}});
    assert.equal(addressAllowsMutation('POST', '/api/v1/persons/17/contact-history', {}), false);
    acceptCorrectedCustomer({...customer, addressValidation: {status: 'confirmed'}});
    assert.equal(addressAllowsMutation('POST', '/api/v1/persons/17/contact-history', {}), true);
    session.startCustomerSelection(customer);
    assert.equal(addressAllowsMutation('POST', '/api/v1/persons/17/contact-history', {}), false);
    session.reset();
});

test('late validation failures cannot block a new customer session', () => {
    const session = utils.customerWorkSession;
    session.reset();
    const first = {id: 1, addressValidation: {status: 'confirmed'}};
    session.confirmCustomer(session.startCustomerSelection(first), first);
    const stale = session.getRequestContext();
    session.reset();
    const next = {id: 2, addressValidation: {status: 'confirmed'}};
    session.confirmCustomer(session.startCustomerSelection(next), next);
    rejectCustomerAddress(stale);
    assert.equal(addressAllowsMutation('PATCH', '/api/v1/persons/2', {email: 'new@example.invalid'}), true);
    rejectCustomerAddress(session.getRequestContext());
    assert.equal(addressAllowsMutation('PATCH', '/api/v1/persons/2', {email: 'new@example.invalid'}), false);
    session.reset();
});
