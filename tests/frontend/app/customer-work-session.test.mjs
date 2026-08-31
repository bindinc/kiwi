import assert from 'node:assert/strict';
import {
    createCustomerDisplaySummary,
    createCustomerReference,
    createCustomerWorkSession
} from '../../../assets/js/app/customer-work-session.js';

function createDeterministicSession() {
    let sequence = 0;
    const controllers = [];
    const session = createCustomerWorkSession({
        createSessionId() {
            sequence += 1;
            return `session-${sequence}`;
        },
        createAbortController() {
            const controller = {
                signal: { aborted: false },
                abort() {
                    this.signal.aborted = true;
                }
            };
            controllers.push(controller);
            return controller;
        }
    });

    return { controllers, session };
}

function testBuildsExplicitCustomerReference() {
    const reference = createCustomerReference({
        id: 11860448,
        credentialKey: 'tvk',
        sourceSystem: 'subscription-api',
        divisionId: 14,
        mandant: 'HMC'
    });

    assert.deepEqual(reference, {
        personId: '11860448',
        credentialKey: 'tvk',
        sourceSystem: 'subscription-api',
        divisionId: '14',
        mandant: 'HMC'
    });
}

function testLateCustomerResponseCannotBecomeCurrent() {
    const { controllers, session } = createDeterministicSession();
    const customerA = {
        id: 1,
        sourceSystem: 'subscription-api',
        credentialKey: 'tvk'
    };
    const customerB = {
        id: 2,
        sourceSystem: 'subscription-api',
        credentialKey: 'tvk'
    };

    const contextA = session.startCustomerSelection(customerA);
    const contextB = session.startCustomerSelection(customerB);

    assert.equal(controllers[0].signal.aborted, true);
    assert.equal(session.isCurrent(contextA), false);
    assert.equal(session.confirmCustomer(contextA, customerA), false);
    assert.equal(session.isCurrent(contextB), true);
    assert.equal(session.confirmCustomer(contextB, customerB), true);
    assert.equal(session.getSnapshot().customerReference.personId, '2');
}

function testActiveCustomerCannotBeSilentlyReplaced() {
    const { session } = createDeterministicSession();
    const customerA = { id: 1, sourceSystem: 'kiwi' };
    const contextA = session.startCustomerSelection(customerA);

    assert.equal(session.confirmCustomer(contextA, customerA), true);

    const blockedSelection = session.startCustomerSelection({ id: 2, sourceSystem: 'kiwi' });
    assert.deepEqual(blockedSelection, {
        blocked: true,
        reason: 'active_customer'
    });
    assert.equal(session.getSnapshot().customerReference.personId, '1');
}

function testResetWaitsForKnownMutationOutcome() {
    const { session } = createDeterministicSession();
    session.startCustomerSelection({ id: 42, sourceSystem: 'kiwi' });

    session.beginMutation('submission-1');
    assert.equal(session.reset(), false);

    session.finishMutation('submission-1', { ambiguous: true });
    assert.equal(session.reset(), false);

    session.resolveMutation('submission-1');
    assert.equal(session.reset(), true);
    assert.equal(session.getSnapshot().customerReference, null);
}

function testRequestHeadersAddressTheCurrentCustomer() {
    const { session } = createDeterministicSession();
    session.startCustomerSelection({
        personId: '11860448',
        credentialKey: 'tvk',
        sourceSystem: 'subscription-api',
        divisionId: '14',
        mandant: 'HMC'
    });

    assert.deepEqual(session.getRequestHeaders(), {
        'X-Kiwi-Workflow-Session-Id': 'session-2',
        'X-Kiwi-Context-Generation': '1',
        'X-Kiwi-Customer-Person-Id': '11860448',
        'X-Kiwi-Customer-Credential-Key': 'tvk',
        'X-Kiwi-Customer-Source-System': 'subscription-api',
        'X-Kiwi-Customer-Division-Id': '14',
        'X-Kiwi-Customer-Mandant': 'HMC'
    });
}

function testDisplaySummaryKeepsNameAndSourceDistinct() {
    assert.deepEqual(createCustomerDisplaySummary({
        personId: '11860448',
        firstName: 'Jane',
        middleName: 'van',
        lastName: 'Dijk',
        sourceSystem: 'subscription-api',
        mandant: 'HMC'
    }), {
        name: 'Jane van Dijk',
        personId: '11860448',
        sourceLabel: 'HMC'
    });
}

testBuildsExplicitCustomerReference();
testLateCustomerResponseCannotBecomeCurrent();
testActiveCustomerCannotBeSilentlyReplaced();
testResetWaitsForKnownMutationOutcome();
testRequestHeadersAddressTheCurrentCustomer();
testDisplaySummaryKeepsNameAndSourceDistinct();

console.log('customer work session tests passed');
