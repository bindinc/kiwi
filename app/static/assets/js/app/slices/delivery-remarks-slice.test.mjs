import assert from 'node:assert/strict';
import { createActionRouter } from '../actions.js';
import { registerDeliveryRemarksSlice } from './delivery-remarks-slice.js';

function createRouter() {
    const root = {
        addEventListener() {},
        removeEventListener() {}
    };

    return createActionRouter({
        root,
        eventTypes: ['click', 'submit', 'keydown']
    });
}

function testRegistersDeliveryRemarkActions() {
    const router = createRouter();
    registerDeliveryRemarksSlice(router);

    const actionNames = router.getRegisteredActions();
    const expectedActionNames = [
        'edit-delivery-remarks',
        'add-delivery-remark-modal',
        'close-edit-delivery-remarks-modal',
        'save-delivery-remarks'
    ];

    for (const actionName of expectedActionNames) {
        assert.equal(actionNames.includes(actionName), true, `missing action ${actionName}`);
    }
}

function testInstallsDeliveryRemarkNamespace() {
    const previousNamespaceValue = globalThis.kiwiDeliveryRemarksSlice;

    try {
        const router = createRouter();
        registerDeliveryRemarksSlice(router);

        assert.equal(typeof globalThis.kiwiDeliveryRemarksSlice, 'object');
        assert.equal(typeof globalThis.kiwiDeliveryRemarksSlice.editDeliveryRemarks, 'function');
        assert.equal(typeof globalThis.kiwiDeliveryRemarksSlice.addDeliveryRemarkToModal, 'function');
        assert.equal(typeof globalThis.kiwiDeliveryRemarksSlice.addDeliveryRemarkToModalByKey, 'function');
        assert.equal(typeof globalThis.kiwiDeliveryRemarksSlice.saveDeliveryRemarks, 'function');
        assert.equal(typeof globalThis.kiwiDeliveryRemarksSlice.closeEditRemarksModal, 'function');
    } finally {
        if (previousNamespaceValue === undefined) {
            delete globalThis.kiwiDeliveryRemarksSlice;
        } else {
            globalThis.kiwiDeliveryRemarksSlice = previousNamespaceValue;
        }
    }
}

function testAddDeliveryRemarkToModalByKeyAppendsText() {
    const previousNamespaceValue = globalThis.kiwiDeliveryRemarksSlice;
    const previousProviderValue = globalThis.kiwiGetDeliveryRemarksSliceDependencies;
    const previousDocumentValue = globalThis.document;

    const remarksTextarea = {
        value: 'Eerste regel',
        scrollTop: 0,
        scrollHeight: 120,
        focusCalled: false,
        focus() {
            this.focusCalled = true;
        }
    };

    try {
        globalThis.document = {
            getElementById(elementId) {
                if (elementId === 'editCustomerDeliveryRemarks') {
                    return remarksTextarea;
                }
                return null;
            }
        };

        globalThis.kiwiGetDeliveryRemarksSliceDependencies = () => ({
            translate(key, _params, fallback) {
                if (key === 'delivery.remarkPresets.callBeforeDelivery') {
                    return 'Bel eerst';
                }
                return fallback;
            }
        });

        registerDeliveryRemarksSlice(createRouter());
        globalThis.kiwiDeliveryRemarksSlice.addDeliveryRemarkToModalByKey('delivery.remarkPresets.callBeforeDelivery');

        assert.equal(remarksTextarea.value, 'Eerste regel\nBel eerst');
        assert.equal(remarksTextarea.focusCalled, true);
        assert.equal(remarksTextarea.scrollTop, remarksTextarea.scrollHeight);
    } finally {
        if (previousNamespaceValue === undefined) {
            delete globalThis.kiwiDeliveryRemarksSlice;
        } else {
            globalThis.kiwiDeliveryRemarksSlice = previousNamespaceValue;
        }

        if (previousProviderValue === undefined) {
            delete globalThis.kiwiGetDeliveryRemarksSliceDependencies;
        } else {
            globalThis.kiwiGetDeliveryRemarksSliceDependencies = previousProviderValue;
        }

        if (previousDocumentValue === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocumentValue;
        }
    }
}

function run() {
    testRegistersDeliveryRemarkActions();
    testInstallsDeliveryRemarkNamespace();
    testAddDeliveryRemarkToModalByKeyAppendsText();
    console.log('delivery remarks slice tests passed');
}

run();
