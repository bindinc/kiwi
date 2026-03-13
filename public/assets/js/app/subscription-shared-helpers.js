export const LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE = 'kiwiSubscriptionIdentityPricingHelpers';

export const MIN_SUB_NUMBER = 8099098;
export const MAX_SUB_NUMBER = 12199098;
export const NAME_INSERTION_PREFIXES = [
    'van der',
    'van den',
    'van de',
    'von der',
    'ten',
    'ter',
    'op de',
    'op den',
    'op',
    'aan de',
    'aan den',
    'aan',
    'bij',
    'uit de',
    'uit den',
    'uit',
    'de',
    'den',
    'der',
    'van',
    'von',
    'te'
];

export const subscriptionPricing = Object.freeze({
    '1-jaar': Object.freeze({ price: 52.00, perMonth: 4.33, description: '1 jaar - Jaarlijks betaald' }),
    '2-jaar': Object.freeze({ price: 98.00, perMonth: 4.08, description: '2 jaar - Jaarlijks betaald (5% korting)' }),
    '3-jaar': Object.freeze({ price: 140.00, perMonth: 3.89, description: '3 jaar - Jaarlijks betaald (10% korting)' }),
    '1-jaar-maandelijks': Object.freeze({ price: 54.00, perMonth: 4.50, description: '1 jaar - Maandelijks betaald' }),
    '2-jaar-maandelijks': Object.freeze({ price: 104.40, perMonth: 4.35, description: '2 jaar - Maandelijks betaald' }),
    '3-jaar-maandelijks': Object.freeze({ price: 151.20, perMonth: 4.20, description: '3 jaar - Maandelijks betaald' })
});

const euroFormattersByLocale = {};

function resolveLocale(locale) {
    if (typeof locale === 'string' && locale.trim()) {
        return locale;
    }
    return 'nl-NL';
}

function getEuroFormatter(locale) {
    const resolvedLocale = resolveLocale(locale);
    if (!euroFormattersByLocale[resolvedLocale]) {
        euroFormattersByLocale[resolvedLocale] = new Intl.NumberFormat(resolvedLocale, {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2
        });
    }

    return euroFormattersByLocale[resolvedLocale];
}

export function normalizeNameFragment(value) {
    return String(value || '').replace(/[\s.]/g, '').toLowerCase();
}

export function generateSubscriptionNumber(customerId, subscriptionId) {
    const numericCustomerId = Number(customerId);
    const numericSubscriptionId = Number(subscriptionId);
    if (!Number.isFinite(numericCustomerId) || !Number.isFinite(numericSubscriptionId)) {
        return '-';
    }

    const range = MAX_SUB_NUMBER - MIN_SUB_NUMBER + 1;
    const seed = Math.abs((numericCustomerId * 73856093) ^ (numericSubscriptionId * 193939));
    const offset = seed % range;
    return String(MIN_SUB_NUMBER + offset);
}

export function formatEuro(amount, options = {}) {
    const numericValue = Number(amount);
    const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
    return getEuroFormatter(options.locale).format(safeValue);
}

export function getPricingDisplay(duration) {
    const pricing = subscriptionPricing[duration];
    if (!pricing) {
        return '';
    }
    return `€${pricing.perMonth.toFixed(2)}/maand (${pricing.description})`;
}

export function getSubscriptionDurationDisplay(subscription) {
    if (!subscription) {
        return 'Oude prijsstructuur';
    }

    if (subscription.duration && subscriptionPricing[subscription.duration]) {
        return getPricingDisplay(subscription.duration);
    }

    if (subscription.durationLabel) {
        return subscription.durationLabel;
    }

    if (subscription.duration) {
        return subscription.duration;
    }

    return 'Oude prijsstructuur';
}

const legacySubscriptionHelpers = Object.freeze({
    MIN_SUB_NUMBER,
    MAX_SUB_NUMBER,
    NAME_INSERTION_PREFIXES,
    subscriptionPricing,
    normalizeNameFragment,
    generateSubscriptionNumber,
    formatEuro,
    getPricingDisplay,
    getSubscriptionDurationDisplay
});

export function getLegacySubscriptionHelpers(globalScope = globalThis) {
    const installed = globalScope ? globalScope[LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE] : null;
    if (installed && typeof installed === 'object') {
        return installed;
    }
    return legacySubscriptionHelpers;
}

export function installLegacySubscriptionHelpers(globalScope = globalThis) {
    if (!globalScope || typeof globalScope !== 'object') {
        return;
    }

    globalScope[LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE] = legacySubscriptionHelpers;
}
