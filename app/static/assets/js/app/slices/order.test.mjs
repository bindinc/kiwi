import assert from 'node:assert/strict';
import { createActionRouter } from '../actions.js';
import { registerOrderActions } from './order.js';

function createRouter() {
    const root = {
        addEventListener() {},
        removeEventListener() {}
    };

    return createActionRouter({
        root,
        eventTypes: ['click', 'keydown', 'submit', 'input', 'change']
    });
}

function testRegistersOrderActions() {
    const router = createRouter();
    registerOrderActions(router);

    const actionNames = router.getRegisteredActions();
    const expectedActionNames = [
        'open-article-sale-form',
        'close-article-sale-form',
        'submit-article-sale-form',
        'add-delivery-remark',
        'select-recommended-delivery-date',
        'navigate-delivery-calendar',
        'select-delivery-date'
    ];

    for (const actionName of expectedActionNames) {
        assert.equal(actionNames.includes(actionName), true, `missing action ${actionName}`);
    }
}

function testInstallsOrderSliceNamespace() {
    const previousNamespaceValue = globalThis.kiwiOrderSlice;

    try {
        const router = createRouter();
        registerOrderActions(router);

        assert.equal(typeof globalThis.kiwiOrderSlice, 'object');
        assert.equal(typeof globalThis.kiwiOrderSlice.displayArticles, 'function');
        assert.equal(typeof globalThis.kiwiOrderSlice.showArticleSale, 'function');
        assert.equal(typeof globalThis.kiwiOrderSlice.addDeliveryRemark, 'function');
        assert.equal(typeof globalThis.kiwiOrderSlice.addDeliveryRemarkByKey, 'function');
        assert.equal(typeof globalThis.kiwiOrderSlice.createArticleSale, 'function');
    } finally {
        if (previousNamespaceValue === undefined) {
            delete globalThis.kiwiOrderSlice;
        } else {
            globalThis.kiwiOrderSlice = previousNamespaceValue;
        }
    }
}

function testAddDeliveryRemarkByKeyAppendsToTextarea() {
    const previousNamespaceValue = globalThis.kiwiOrderSlice;
    const previousProviderValue = globalThis.kiwiGetOrderSliceDependencies;
    const previousDocumentValue = globalThis.document;

    const notesField = {
        value: 'Bestaande regel',
        scrollTop: 0,
        scrollHeight: 50,
        focusCalled: false,
        focus() {
            this.focusCalled = true;
        }
    };

    try {
        globalThis.document = {
            getElementById(elementId) {
                if (elementId === 'articleNotes') {
                    return notesField;
                }
                return null;
            }
        };
        globalThis.kiwiGetOrderSliceDependencies = () => ({
            translate(key, _params, fallback) {
                if (key === 'delivery.remarkPresets.deliverToNeighbors') {
                    return 'Bij buren';
                }
                return fallback;
            }
        });

        registerOrderActions(createRouter());
        globalThis.kiwiOrderSlice.addDeliveryRemarkByKey('delivery.remarkPresets.deliverToNeighbors');

        assert.equal(notesField.value, 'Bestaande regel\nBij buren');
        assert.equal(notesField.focusCalled, true);
        assert.equal(notesField.scrollTop, notesField.scrollHeight);
    } finally {
        if (previousNamespaceValue === undefined) {
            delete globalThis.kiwiOrderSlice;
        } else {
            globalThis.kiwiOrderSlice = previousNamespaceValue;
        }

        if (previousProviderValue === undefined) {
            delete globalThis.kiwiGetOrderSliceDependencies;
        } else {
            globalThis.kiwiGetOrderSliceDependencies = previousProviderValue;
        }

        if (previousDocumentValue === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocumentValue;
        }
    }
}

function run() {
    testRegistersOrderActions();
    testInstallsOrderSliceNamespace();
    testAddDeliveryRemarkByKeyAppendsToTextarea();
    console.log('order slice tests passed');
}

run();
