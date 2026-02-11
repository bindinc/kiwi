import assert from 'node:assert/strict';
import { getDispositionCategories } from './disposition-categories.js';

function testReturnsAllSixCategoriesWithTranslatedLabels() {
    const categories = getDispositionCategories();
    const categoryKeys = Object.keys(categories);

    assert.equal(categoryKeys.length, 6);
    const expectedKeys = ['subscription', 'delivery', 'payment', 'article_sale', 'complaint', 'general'];
    for (const key of expectedKeys) {
        assert.equal(categoryKeys.includes(key), true, `Missing category "${key}"`);
    }

    for (const [code, category] of Object.entries(categories)) {
        assert.equal(typeof category.label, 'string', `Category "${code}" label should be a string`);
        assert.equal(category.label.length > 0, true, `Category "${code}" label should not be empty`);
        assert.equal(Array.isArray(category.outcomes), true, `Category "${code}" outcomes should be an array`);
        assert.equal(category.outcomes.length > 0, true, `Category "${code}" should have at least one outcome`);

        for (const outcome of category.outcomes) {
            assert.equal(typeof outcome.code, 'string');
            assert.equal(typeof outcome.label, 'string');
            assert.equal(outcome.label.length > 0, true);
        }
    }
}

function testSubscriptionCategoryHasFiveOutcomes() {
    const categories = getDispositionCategories();
    const subscription = categories.subscription;

    assert.equal(subscription.outcomes.length, 5);
    const outcomeLabels = subscription.outcomes.map((o) => o.code);
    assert.equal(outcomeLabels.includes('new_subscription'), true);
    assert.equal(outcomeLabels.includes('subscription_cancelled'), true);
}

function testGeneralCategoryHasFiveOutcomes() {
    const categories = getDispositionCategories();
    const general = categories.general;

    assert.equal(general.outcomes.length, 5);
    const outcomeCodes = general.outcomes.map((o) => o.code);
    assert.equal(outcomeCodes.includes('transferred'), true);
    assert.equal(outcomeCodes.includes('wrong_number'), true);
}

function run() {
    testReturnsAllSixCategoriesWithTranslatedLabels();
    testSubscriptionCategoryHasFiveOutcomes();
    testGeneralCategoryHasFiveOutcomes();
    console.log('disposition-categories tests passed');
}

run();
