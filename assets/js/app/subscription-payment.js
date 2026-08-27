export const DIRECT_DEBIT_PAYMENT_METHOD = 'B';
export const PAYMENT_INSTRUCTION_PAYMENT_METHOD = 'AC';

export function buildSubscriptionPaymentDetails(paymentMethod, iban) {
    const normalizedPaymentMethod = String(paymentMethod || '').trim().toUpperCase();
    const normalizedIban = String(iban || '').trim();

    return {
        paymentMethod: normalizedPaymentMethod,
        iban: normalizedPaymentMethod === DIRECT_DEBIT_PAYMENT_METHOD ? normalizedIban : null
    };
}

export function syncSubscriptionIbanRequirement(ibanInput, paymentMethod) {
    if (!ibanInput || typeof ibanInput.setAttribute !== 'function' || typeof ibanInput.removeAttribute !== 'function') {
        return;
    }

    const requiresIban = paymentMethod === DIRECT_DEBIT_PAYMENT_METHOD;
    if (requiresIban) {
        ibanInput.setAttribute('required', 'required');
        return;
    }

    ibanInput.removeAttribute('required');
}
