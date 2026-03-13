import assert from 'node:assert/strict';
import {
    LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE,
    generateSubscriptionNumber,
    getPricingDisplay,
    getSubscriptionDurationDisplay,
    getLegacySubscriptionHelpers,
    installLegacySubscriptionHelpers,
    normalizeNameFragment
} from './subscription-shared-helpers.js';

function testNormalizeNameFragment() {
    assert.equal(normalizeNameFragment(' Van. Der Berg '), 'vanderberg');
}

function testGenerateSubscriptionNumber() {
    assert.equal(generateSubscriptionNumber(42, 7), generateSubscriptionNumber(42, 7));
    assert.equal(generateSubscriptionNumber('x', 7), '-');
}

function testPricingDisplayHelpers() {
    assert.equal(
        getPricingDisplay('1-jaar'),
        '€4.33/maand (1 jaar - Jaarlijks betaald)'
    );
    assert.equal(getPricingDisplay('unknown'), '');

    assert.equal(
        getSubscriptionDurationDisplay({ duration: '2-jaar' }),
        '€4.08/maand (2 jaar - Jaarlijks betaald (5% korting))'
    );
    assert.equal(
        getSubscriptionDurationDisplay({ durationLabel: 'Handmatige looptijd' }),
        'Handmatige looptijd'
    );
    assert.equal(
        getSubscriptionDurationDisplay(null),
        'Oude prijsstructuur'
    );
}

function testLegacyNamespaceInstallation() {
    const previousValue = globalThis[LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE];

    try {
        delete globalThis[LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE];
        installLegacySubscriptionHelpers(globalThis);

        assert.equal(
            typeof globalThis[LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE].generateSubscriptionNumber,
            'function'
        );
        assert.equal(
            getLegacySubscriptionHelpers(globalThis),
            globalThis[LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE]
        );
    } finally {
        if (previousValue === undefined) {
            delete globalThis[LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE];
        } else {
            globalThis[LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE] = previousValue;
        }
    }
}

function run() {
    testNormalizeNameFragment();
    testGenerateSubscriptionNumber();
    testPricingDisplayHelpers();
    testLegacyNamespaceInstallation();
    console.log('subscription shared helper tests passed');
}

run();
