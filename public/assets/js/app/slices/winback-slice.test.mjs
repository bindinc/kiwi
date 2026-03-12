import assert from 'node:assert/strict';
import { createActionRouter } from '../actions.js';
import {
    registerWinbackSlice,
    __winbackTestUtils
} from './winback-slice.js';

function createRouter() {
    const root = {
        addEventListener() {},
        removeEventListener() {}
    };

    return createActionRouter({
        root,
        eventTypes: ['click', 'submit', 'change']
    });
}

function testRegistersItemEightActions() {
    const router = createRouter();
    registerWinbackSlice(router);

    const actionNames = router.getRegisteredActions();
    const expectedActionNames = [
        'cancel-subscription',
        'start-winback-for-subscription',
        'winback-next-step',
        'winback-prev-step',
        'process-deceased-subscriptions',
        'complete-all-deceased-actions',
        'revert-restitution',
        'toggle-restitution-transfer-address',
        'complete-restitution-transfer',
        'complete-winback',
        'select-offer'
    ];

    for (const actionName of expectedActionNames) {
        assert.equal(actionNames.includes(actionName), true, `missing action ${actionName}`);
    }
}

function testExposesWinbackSliceNamespace() {
    const previousWinbackSlice = globalThis.kiwiWinbackSlice;

    try {
        const router = createRouter();
        registerWinbackSlice(router);

        assert.equal(typeof globalThis.kiwiWinbackSlice, 'object');
        assert.equal(typeof globalThis.kiwiWinbackSlice.cancelSubscription, 'function');
        assert.equal(typeof globalThis.kiwiWinbackSlice.completeWinback, 'function');
    } finally {
        if (previousWinbackSlice === undefined) {
            delete globalThis.kiwiWinbackSlice;
        } else {
            globalThis.kiwiWinbackSlice = previousWinbackSlice;
        }
    }
}

function testWinbackHelpers() {
    assert.equal(
        __winbackTestUtils.readStepFromPayload({ step: 2 }, { element: { dataset: { argStep: '3' } } }),
        2
    );
    assert.equal(
        __winbackTestUtils.readStepFromPayload({}, { element: { dataset: { argStep: '1b' } } }),
        '1b'
    );

    assert.equal(__winbackTestUtils.resolveSubscriptionId('12'), 12);
    assert.equal(__winbackTestUtils.resolveSubscriptionId('abc'), null);

    assert.equal(
        __winbackTestUtils.buildTransferRecipientName({
            salutation: 'Dhr.',
            firstName: 'Jan',
            middleName: 'van',
            lastName: 'Dijk'
        }),
        'Dhr. Jan van Dijk'
    );
}

function run() {
    testRegistersItemEightActions();
    testExposesWinbackSliceNamespace();
    testWinbackHelpers();
    console.log('winback slice tests passed');
}

run();
