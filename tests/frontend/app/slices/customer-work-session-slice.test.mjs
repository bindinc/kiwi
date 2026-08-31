import assert from 'node:assert/strict';
import {
    beginCustomerMutation,
    configureCustomerWorkSessionSliceDependencies,
    confirmCustomerSelection,
    endCustomerWorkSession,
    finishCustomerMutation,
    showQueuedCustomerChoice,
    startCustomerSelection
} from '../../../../assets/js/app/slices/customer-work-session-slice.js';

function createElement() {
    return {
        attributes: {},
        disabled: false,
        hidden: true,
        textContent: '',
        setAttribute(name, value) {
            this.attributes[name] = value;
        }
    };
}

async function testRendersAndResetsAnExplicitCustomerWorkSession() {
    const previousDocument = globalThis.document;
    const elements = {
        customerWorkSessionBar: createElement(),
        customerWorkSessionName: createElement(),
        customerWorkSessionPersonId: createElement(),
        customerWorkSessionSource: createElement(),
        endCustomerWorkSessionButton: createElement(),
        customerWorkSessionPendingMutation: createElement(),
        queuedCustomerChoice: createElement(),
        queuedCustomerChoiceStatus: createElement(),
        queuedCustomerChoiceRecipient: createElement(),
        queuedCustomerChoiceRequester: createElement()
    };
    const auditPayloads = [];
    const toasts = [];
    let resetCount = 0;

    globalThis.document = {
        getElementById(elementId) {
            return elements[elementId] || null;
        }
    };
    configureCustomerWorkSessionSliceDependencies(() => ({
        getApiClient() {
            return {
                async post(url, payload) {
                    auditPayloads.push({ url, payload });
                }
            };
        },
        resetCustomerBoundState() {
            resetCount += 1;
        },
        showToast(message, type) {
            toasts.push({ message, type });
        },
        translate(_key, params, fallback) {
            return fallback.replace('{count}', String(params.count || ''));
        }
    }));

    try {
        const customer = {
            personId: '11860448',
            firstName: 'Jane',
            middleName: 'van',
            lastName: 'Dijk',
            credentialKey: 'tvk',
            sourceSystem: 'subscription-api',
            divisionId: '14',
            mandant: 'HMC'
        };
        const selectionContext = startCustomerSelection(customer);
        assert.equal(elements.customerWorkSessionBar.hidden, true);

        assert.equal(confirmCustomerSelection(selectionContext, customer), true);
        assert.equal(elements.customerWorkSessionBar.hidden, false);
        assert.equal(elements.customerWorkSessionName.textContent, 'Jane van Dijk');
        assert.equal(elements.customerWorkSessionPersonId.textContent, '11860448');
        assert.equal(elements.customerWorkSessionSource.textContent, 'HMC');

        beginCustomerMutation('submission-1');
        assert.equal(elements.endCustomerWorkSessionButton.disabled, true);
        assert.equal(elements.customerWorkSessionPendingMutation.hidden, false);
        finishCustomerMutation('submission-1');
        assert.equal(elements.endCustomerWorkSessionButton.disabled, false);

        showQueuedCustomerChoice({
            queuedCount: 1,
            recipientLabel: 'Jane van Dijk (11860448)',
            requesterLabel: 'Jan Jansen (7721)'
        });
        assert.equal(elements.queuedCustomerChoice.hidden, false);
        assert.equal(elements.queuedCustomerChoiceRecipient.textContent, 'Jane van Dijk (11860448)');
        assert.equal(elements.queuedCustomerChoiceRequester.textContent, 'Jan Jansen (7721)');

        assert.equal(await endCustomerWorkSession(), true);
        assert.equal(resetCount, 1);
        assert.equal(elements.customerWorkSessionBar.hidden, true);
        assert.equal(elements.queuedCustomerChoice.hidden, true);
        assert.equal(auditPayloads.length, 1);
        assert.equal(auditPayloads[0].url, '/api/v1/customer-work-sessions/reset');
        assert.equal(auditPayloads[0].payload.customerReference.personId, '11860448');
        assert.equal(toasts.at(-1).type, 'success');
    } finally {
        configureCustomerWorkSessionSliceDependencies(null);
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
}

await testRendersAndResetsAnExplicitCustomerWorkSession();
console.log('customer work session slice tests passed');
