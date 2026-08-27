import assert from 'node:assert/strict';
import en from '../../../assets/js/i18n/en.js';
import nl from '../../../assets/js/i18n/nl.js';
import {
    buildSubscriptionPaymentDetails,
    DIRECT_DEBIT_PAYMENT_METHOD,
    PAYMENT_INSTRUCTION_PAYMENT_METHOD,
    syncSubscriptionIbanRequirement
} from '../../../assets/js/app/subscription-payment.js';

function testBuildsDirectDebitDetailsWithIban() {
    assert.deepEqual(
        buildSubscriptionPaymentDetails('b', ' NL80INGB0001340187 '),
        {
            paymentMethod: DIRECT_DEBIT_PAYMENT_METHOD,
            iban: 'NL80INGB0001340187'
        }
    );
}

function testOmitsIbanForPaymentInstruction() {
    assert.deepEqual(
        buildSubscriptionPaymentDetails('ac', 'NL80INGB0001340187'),
        {
            paymentMethod: PAYMENT_INSTRUCTION_PAYMENT_METHOD,
            iban: null
        }
    );
}

function testSynchronizesIbanRequirement() {
    const ibanInput = {
        required: false,
        setAttribute(name, value) {
            if (name === 'required' && value === 'required') {
                this.required = true;
            }
        },
        removeAttribute(name) {
            if (name === 'required') {
                this.required = false;
            }
        }
    };

    syncSubscriptionIbanRequirement(ibanInput, DIRECT_DEBIT_PAYMENT_METHOD);
    assert.equal(ibanInput.required, true);

    syncSubscriptionIbanRequirement(ibanInput, PAYMENT_INSTRUCTION_PAYMENT_METHOD);
    assert.equal(ibanInput.required, false);
}

function testPaymentInstructionIsTranslated() {
    assert.equal(nl.indexHtml.text.betaalinstructie_7fb08411, 'Betaalinstructie');
    assert.equal(en.indexHtml.text.betaalinstructie_7fb08411, 'Payment instruction');
}

testBuildsDirectDebitDetailsWithIban();
testOmitsIbanForPaymentInstruction();
testSynchronizesIbanRequirement();
testPaymentInstructionIsTranslated();
console.log('subscription payment tests passed');
