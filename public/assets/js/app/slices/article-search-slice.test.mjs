import assert from 'node:assert/strict';
import { createActionRouter } from '../actions.js';
import {
    fetchArticleById,
    highlightMatch,
    registerArticleSearchSlice,
    requestOrderQuote,
    __articleSearchTestUtils
} from './article-search-slice.js';

function createRouter() {
    const root = {
        addEventListener() {},
        removeEventListener() {}
    };

    return createActionRouter({
        root,
        eventTypes: ['click', 'keydown', 'input']
    });
}

function withGlobalSnapshot(callback) {
    const trackedKeys = [
        'document',
        'i18n',
        'kiwiApi',
        'showToast',
        'orderItems',
        'initArticleSearch',
        'filterArticles',
        'renderArticleDropdown',
        'selectArticle',
        'showAllArticles',
        'filterModalArticles',
        'showArticleTab',
        'selectArticleFromModal',
        'closeAllArticlesModal',
        'updateArticlePrice',
        'addArticleToOrder',
        'removeArticleFromOrder',
        'applyCoupon',
        'removeCoupon',
        'renderOrderItems',
        'getOrderData'
    ];

    const previousValues = {};
    const previousDescriptors = {};

    for (const key of trackedKeys) {
        previousValues[key] = globalThis[key];
        previousDescriptors[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    }

    try {
        callback();
    } finally {
        for (const key of trackedKeys) {
            const previousDescriptor = previousDescriptors[key];
            if (previousDescriptor) {
                Object.defineProperty(globalThis, key, previousDescriptor);
                continue;
            }

            if (previousValues[key] === undefined) {
                delete globalThis[key];
            } else {
                globalThis[key] = previousValues[key];
            }
        }
    }
}

function testRegistersItemTenActions() {
    __articleSearchTestUtils.resetStateForTests();

    const router = createRouter();
    registerArticleSearchSlice(router);

    const actionNames = router.getRegisteredActions();
    const expectedActionNames = [
        'filter-articles',
        'update-article-price',
        'add-article-to-order',
        'apply-coupon',
        'apply-coupon-on-enter',
        'show-all-articles',
        'select-article',
        'filter-modal-articles',
        'show-article-tab',
        'select-article-from-modal',
        'close-all-articles-modal',
        'remove-article-from-order',
        'remove-coupon'
    ];

    for (const actionName of expectedActionNames) {
        assert.equal(actionNames.includes(actionName), true, `missing action ${actionName}`);
    }
}

function testInstallsLegacyCompatibilityExports() {
    withGlobalSnapshot(() => {
        __articleSearchTestUtils.resetStateForTests();

        const router = createRouter();
        registerArticleSearchSlice(router);

        assert.equal(typeof globalThis.initArticleSearch, 'function');
        assert.equal(typeof globalThis.filterArticles, 'function');
        assert.equal(typeof globalThis.renderArticleDropdown, 'function');
        assert.equal(typeof globalThis.selectArticle, 'function');
        assert.equal(typeof globalThis.showAllArticles, 'function');
        assert.equal(typeof globalThis.filterModalArticles, 'function');
        assert.equal(typeof globalThis.showArticleTab, 'function');
        assert.equal(typeof globalThis.selectArticleFromModal, 'function');
        assert.equal(typeof globalThis.closeAllArticlesModal, 'function');
        assert.equal(typeof globalThis.updateArticlePrice, 'function');
        assert.equal(typeof globalThis.addArticleToOrder, 'function');
        assert.equal(typeof globalThis.removeArticleFromOrder, 'function');
        assert.equal(typeof globalThis.applyCoupon, 'function');
        assert.equal(typeof globalThis.removeCoupon, 'function');
        assert.equal(typeof globalThis.renderOrderItems, 'function');
        assert.equal(typeof globalThis.getOrderData, 'function');

        const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'orderItems');
        assert.equal(Boolean(descriptor && descriptor.get && descriptor.set), true);

        const nextItems = [{ articleId: 77, quantity: 2 }];
        globalThis.orderItems = nextItems;
        assert.deepEqual(globalThis.orderItems, nextItems);

        const stateSnapshot = __articleSearchTestUtils.getStateSnapshot();
        assert.deepEqual(stateSnapshot.orderItems, nextItems);
    });
}

async function testLookupFallbackWithoutApi() {
    const previousKiwiApi = globalThis.kiwiApi;
    try {
        __articleSearchTestUtils.resetStateForTests();
        delete globalThis.kiwiApi;

        const unknownArticle = await fetchArticleById(1234);
        assert.equal(unknownArticle, null);

        const quote = await requestOrderQuote();
        assert.deepEqual(quote, {
            items: [],
            subtotal: 0,
            discounts: [],
            totalDiscount: 0,
            total: 0,
            couponCode: null,
            coupon: null
        });
    } finally {
        if (previousKiwiApi === undefined) {
            delete globalThis.kiwiApi;
        } else {
            globalThis.kiwiApi = previousKiwiApi;
        }
    }
}

function testHighlightMatchEscapesRegexInput() {
    const highlighted = highlightMatch('Nieuws Avrobode 2026', 'A.v');
    assert.equal(highlighted.includes('<mark>'), false);

    const matched = highlightMatch('Nieuws Avrobode 2026', 'vro');
    assert.equal(matched.includes('<mark>vro</mark>'), true);
}

async function run() {
    testRegistersItemTenActions();
    testInstallsLegacyCompatibilityExports();
    await testLookupFallbackWithoutApi();
    testHighlightMatchEscapesRegexInput();
    console.log('article search slice tests passed');
}

run();
