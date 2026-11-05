import assert from 'node:assert/strict';
import {
    LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE,
    generateSubscriptionNumber,
    getPricingDisplay,
    getSubscriptionDurationDisplay,
    getLegacySubscriptionHelpers,
    installLegacySubscriptionHelpers,
    normalizeNameFragment,
    sameSubscriptionPerson
} from '../../../assets/js/app/subscription-shared-helpers.js';

function testNormalizeNameFragment() {
    assert.equal(normalizeNameFragment(' Van. Der Berg '), 'vanderberg');
}

function testSubscriptionPersonIdentityRequiresSourceContext() {
    const person = { id: 51, credentialKey: 'source-a', sourceSystem: 'subscription-api', divisionId: '14', mandant: 'HMC' };
    assert.equal(sameSubscriptionPerson(person, { ...person, id: undefined, personId: ' 51 ' }), true);
    assert.equal(sameSubscriptionPerson(person, { ...person, lastName: 'Edited name' }), true);
    assert.equal(sameSubscriptionPerson({ id: 51 }, { personId: '51' }), true);
    assert.equal(sameSubscriptionPerson({}, {}), false);
    assert.equal(sameSubscriptionPerson(person, null), false);
    assert.equal(sameSubscriptionPerson(person, { personId: 51 }), false);
    for (const field of ['credentialKey', 'sourceSystem', 'divisionId', 'mandant']) {
        assert.equal(sameSubscriptionPerson(person, { ...person, [field]: 'other' }), false, field);
    }
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
        assert.equal(globalThis[LEGACY_SUBSCRIPTION_HELPERS_NAMESPACE].sameSubscriptionPerson, sameSubscriptionPerson);
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
    testSubscriptionPersonIdentityRequiresSourceContext();
    testGenerateSubscriptionNumber();
    testPricingDisplayHelpers();
    testLegacyNamespaceInstallation();
    console.log('subscription shared helper tests passed');
}

run();
