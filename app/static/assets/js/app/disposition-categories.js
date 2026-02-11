import { translate } from './slices/localization-slice.js';

const dispositionCategoryConfig = {
    subscription: {
        labelKey: 'disposition.category.subscription',
        labelFallback: 'Abonnement',
        outcomes: [
            { code: 'new_subscription', key: 'disposition.outcome.newSubscription', fallback: 'Nieuw abonnement afgesloten' },
            { code: 'subscription_changed', key: 'disposition.outcome.subscriptionChanged', fallback: 'Abonnement gewijzigd' },
            { code: 'subscription_cancelled', key: 'disposition.outcome.subscriptionCancelled', fallback: 'Abonnement opgezegd' },
            { code: 'subscription_paused', key: 'disposition.outcome.subscriptionPaused', fallback: 'Abonnement gepauzeerd' },
            { code: 'info_provided', key: 'disposition.outcome.infoProvided', fallback: 'Informatie verstrekt' }
        ]
    },
    delivery: {
        labelKey: 'disposition.category.delivery',
        labelFallback: 'Bezorging',
        outcomes: [
            { code: 'delivery_issue_resolved', key: 'disposition.outcome.deliveryIssueResolved', fallback: 'Bezorgprobleem opgelost' },
            { code: 'magazine_resent', key: 'disposition.outcome.magazineResent', fallback: 'Editie opnieuw verzonden' },
            { code: 'delivery_prefs_updated', key: 'disposition.outcome.deliveryPreferencesUpdated', fallback: 'Bezorgvoorkeuren aangepast' },
            { code: 'escalated_delivery', key: 'disposition.outcome.deliveryEscalated', fallback: 'Geëscaleerd naar bezorging' }
        ]
    },
    payment: {
        labelKey: 'disposition.category.payment',
        labelFallback: 'Betaling',
        outcomes: [
            { code: 'payment_resolved', key: 'disposition.outcome.paymentResolved', fallback: 'Betaling afgehandeld' },
            { code: 'payment_plan_arranged', key: 'disposition.outcome.paymentPlanArranged', fallback: 'Betalingsregeling getroffen' },
            { code: 'iban_updated', key: 'disposition.outcome.ibanUpdated', fallback: 'IBAN gegevens bijgewerkt' },
            { code: 'escalated_finance', key: 'disposition.outcome.financeEscalated', fallback: 'Geëscaleerd naar financiën' }
        ]
    },
    article_sale: {
        labelKey: 'disposition.category.articleSale',
        labelFallback: 'Artikel Verkoop',
        outcomes: [
            { code: 'article_sold', key: 'disposition.outcome.articleSold', fallback: 'Artikel verkocht' },
            { code: 'quote_provided', key: 'disposition.outcome.quoteProvided', fallback: 'Offerte verstrekt' },
            { code: 'no_sale', key: 'disposition.outcome.noSale', fallback: 'Geen verkoop' }
        ]
    },
    complaint: {
        labelKey: 'disposition.category.complaint',
        labelFallback: 'Klacht',
        outcomes: [
            { code: 'complaint_resolved', key: 'disposition.outcome.complaintResolved', fallback: 'Klacht opgelost' },
            { code: 'complaint_escalated', key: 'disposition.outcome.complaintEscalated', fallback: 'Klacht geëscaleerd' },
            { code: 'callback_scheduled', key: 'disposition.outcome.callbackScheduled', fallback: 'Terugbelafspraak gemaakt' }
        ]
    },
    general: {
        labelKey: 'disposition.category.general',
        labelFallback: 'Algemeen',
        outcomes: [
            { code: 'info_provided', key: 'disposition.outcome.infoProvided', fallback: 'Informatie verstrekt' },
            { code: 'transferred', key: 'disposition.outcome.transferred', fallback: 'Doorverbonden' },
            { code: 'customer_hung_up', key: 'disposition.outcome.customerHungUp', fallback: 'Klant opgehangen' },
            { code: 'wrong_number', key: 'disposition.outcome.wrongNumber', fallback: 'Verkeerd verbonden' },
            { code: 'no_answer_needed', key: 'disposition.outcome.noAnswerNeeded', fallback: 'Geen actie vereist' }
        ]
    }
};

export function getDispositionCategories() {
    const resolvedCategories = {};
    for (const [categoryCode, categoryConfig] of Object.entries(dispositionCategoryConfig)) {
        resolvedCategories[categoryCode] = {
            label: translate(categoryConfig.labelKey, {}, categoryConfig.labelFallback),
            outcomes: categoryConfig.outcomes.map((outcomeConfig) => ({
                code: outcomeConfig.code,
                label: translate(outcomeConfig.key, {}, outcomeConfig.fallback)
            }))
        };
    }
    return resolvedCategories;
}
