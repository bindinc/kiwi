import assert from 'node:assert/strict';
import { createActionRouter } from '../actions.js';
import {
    registerSubscriptionWorkflowSlice,
    __subscriptionWorkflowTestUtils
} from './subscription-workflow-slice.js';

function createRouter() {
    const root = {
        addEventListener() {},
        removeEventListener() {}
    };

    return createActionRouter({
        root,
        eventTypes: ['click', 'submit']
    });
}

function testRegistersItemSevenActions() {
    const router = createRouter();
    registerSubscriptionWorkflowSlice(router);

    const actionNames = router.getRegisteredActions();
    const expectedActionNames = [
        'show-new-subscription',
        'create-subscription',
        'edit-customer',
        'save-customer-edit',
        'show-resend-magazine',
        'resend-magazine',
        'show-editorial-complaint-form',
        'submit-editorial-complaint',
        'edit-subscription',
        'save-subscription-edit'
    ];

    for (const actionName of expectedActionNames) {
        assert.equal(actionNames.includes(actionName), true, `missing action ${actionName}`);
    }
}

function testInstallsLegacyCompatibilityExports() {
    const previousValues = {
        showNewSubscription: globalThis.showNewSubscription,
        createSubscription: globalThis.createSubscription,
        getSubscriptionRequesterMetaLine: globalThis.getSubscriptionRequesterMetaLine,
        editCustomer: globalThis.editCustomer,
        saveCustomerEdit: globalThis.saveCustomerEdit,
        showResendMagazine: globalThis.showResendMagazine,
        resendMagazine: globalThis.resendMagazine,
        showEditorialComplaintForm: globalThis.showEditorialComplaintForm,
        submitEditorialComplaint: globalThis.submitEditorialComplaint,
        editSubscription: globalThis.editSubscription,
        saveSubscriptionEdit: globalThis.saveSubscriptionEdit
    };

    try {
        const router = createRouter();
        registerSubscriptionWorkflowSlice(router);

        assert.equal(typeof globalThis.showNewSubscription, 'function');
        assert.equal(typeof globalThis.createSubscription, 'function');
        assert.equal(typeof globalThis.getSubscriptionRequesterMetaLine, 'function');
        assert.equal(typeof globalThis.editCustomer, 'function');
        assert.equal(typeof globalThis.saveCustomerEdit, 'function');
        assert.equal(typeof globalThis.showResendMagazine, 'function');
        assert.equal(typeof globalThis.resendMagazine, 'function');
        assert.equal(typeof globalThis.showEditorialComplaintForm, 'function');
        assert.equal(typeof globalThis.submitEditorialComplaint, 'function');
        assert.equal(typeof globalThis.editSubscription, 'function');
        assert.equal(typeof globalThis.saveSubscriptionEdit, 'function');
    } finally {
        for (const [key, value] of Object.entries(previousValues)) {
            if (value === undefined) {
                delete globalThis[key];
            } else {
                globalThis[key] = value;
            }
        }
    }
}

function testSubscriptionHelperFunctions() {
    assert.equal(
        __subscriptionWorkflowTestUtils.getSubscriptionDurationDescription('2-jaar', 'fallback'),
        '2 jaar - Jaarlijks betaald (5% korting)'
    );
    assert.equal(
        __subscriptionWorkflowTestUtils.getSubscriptionDurationDescription('', 'fallback'),
        'fallback'
    );

    const changes = __subscriptionWorkflowTestUtils.getSubscriptionChanges(
        {
            magazine: 'Avrobode',
            duration: '1-jaar',
            status: 'active'
        },
        {
            magazine: 'Mikrogids',
            duration: '2-jaar',
            status: 'paused'
        }
    );

    assert.deepEqual(changes, [
        'Magazine gewijzigd van Avrobode naar Mikrogids',
        'Duur gewijzigd van 1 jaar - Jaarlijks betaald naar 2 jaar - Jaarlijks betaald (5% korting)',
        'Status gewijzigd van Actief naar Gepauzeerd'
    ]);
}

function run() {
    testRegistersItemSevenActions();
    testInstallsLegacyCompatibilityExports();
    testSubscriptionHelperFunctions();
    console.log('subscription workflow slice tests passed');
}

run();
