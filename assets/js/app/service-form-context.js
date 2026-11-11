import { createCustomerDisplaySummary } from './customer-work-session.js';

export function renderServiceFormContext(form, customer, subscription = null) {
    if (!form || typeof form.querySelector !== 'function') return;

    const summary = createCustomerDisplaySummary(customer);
    const person = form.querySelector('[data-service-customer]');
    if (person) {
        person.textContent = summary
            ? `${summary.name} (${summary.personId}) · ${summary.sourceLabel}`
            : '';
    }

    const subscriptionContext = form.querySelector('.service-context-subscription');
    if (subscriptionContext) subscriptionContext.hidden = !subscription;
    const magazine = form.querySelector('[data-service-subscription]');
    if (magazine) magazine.textContent = subscription ? String(subscription.magazine || '') : '';
}
