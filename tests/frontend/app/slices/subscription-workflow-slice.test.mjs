import assert from 'node:assert/strict';
import { createActionRouter } from '../../../../assets/js/app/actions.js';
import {
    registerSubscriptionWorkflowSlice,
    __subscriptionWorkflowTestUtils
} from '../../../../assets/js/app/slices/subscription-workflow-slice.js';

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

function createToggleClassList(initialValues = []) {
    const classes = new Set(initialValues);
    return {
        toggle(className, forcedState) {
            if (forcedState === true) {
                classes.add(className);
                return true;
            }
            if (forcedState === false) {
                classes.delete(className);
                return false;
            }
            if (classes.has(className)) {
                classes.delete(className);
                return false;
            }
            classes.add(className);
            return true;
        },
        contains(className) {
            return classes.has(className);
        }
    };
}

function createDomElement() {
    const element = {
        className: '',
        textContent: '',
        style: {
            display: ''
        },
        hidden: false,
        children: [],
        attributes: {},
        classList: createToggleClassList(),
        appendChild(child) {
            this.children.push(child);
            return child;
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        getAttribute(name) {
            return this.attributes[name];
        }
    };

    let innerHtml = '';
    Object.defineProperty(element, 'innerHTML', {
        get() {
            return innerHtml;
        },
        set(value) {
            innerHtml = value;
            if (value === '') {
                this.children = [];
            }
        }
    });

    return element;
}

function testRegistersItemSevenActions() {
    const router = createRouter();
    registerSubscriptionWorkflowSlice(router);

    const actionNames = router.getRegisteredActions();
    const expectedActionNames = [
        'show-new-subscription',
        'create-subscription',
        'toggle-subscription-queue-info',
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

function testWerfsleutelSelectionHelperPrefersMultiSelectionBridge() {
    const previousSlice = globalThis.kiwiWerfsleutelSlice;
    globalThis.kiwiWerfsleutelSlice = {
        getSelections() {
            return [
                {
                    selectedKey: { salesCode: 'TVZ123' },
                    selectedChannel: 'PR/ET/LV',
                    selectedChannelMeta: { key: 'PR/ET/LV' }
                },
                {
                    selectedKey: { salesCode: 'AVR123' },
                    selectedChannel: 'EM/OU',
                    selectedChannelMeta: { key: 'EM/OU' }
                }
            ];
        }
    };

    try {
        assert.deepEqual(
            __subscriptionWorkflowTestUtils.getSelectedWerfsleutelSelections().map((selection) => selection.selectedKey.salesCode),
            ['TVZ123', 'AVR123']
        );
    } finally {
        if (previousSlice === undefined) {
            delete globalThis.kiwiWerfsleutelSlice;
        } else {
            globalThis.kiwiWerfsleutelSlice = previousSlice;
        }
    }
}

function testQueueToggleUpdatesPanelVisibilityAndButtonState() {
    const previousDocument = globalThis.document;
    const elements = {
        subscriptionQueuePanel: createDomElement(),
        subscriptionQueueToggle: createDomElement(),
        subscriptionQueueToggleCount: createDomElement(),
        subscriptionQueueMeta: createDomElement(),
        subscriptionQueueEmpty: createDomElement(),
        subscriptionQueueList: createDomElement()
    };

    elements.subscriptionQueuePanel.hidden = true;
    elements.subscriptionQueuePanel.style.display = 'none';
    elements.subscriptionQueueToggleCount.style.display = 'none';

    globalThis.document = {
        getElementById(id) {
            return elements[id] || null;
        },
        createElement() {
            return createDomElement();
        }
    };

    try {
        __subscriptionWorkflowTestUtils.setSubscriptionQueueExpanded(false);

        __subscriptionWorkflowTestUtils.toggleSubscriptionQueueInfo();
        assert.equal(elements.subscriptionQueuePanel.hidden, false);
        assert.equal(elements.subscriptionQueuePanel.style.display, '');
        assert.equal(elements.subscriptionQueueToggle.getAttribute('aria-expanded'), 'true');
        assert.equal(elements.subscriptionQueueToggle.classList.contains('is-active'), true);

        __subscriptionWorkflowTestUtils.toggleSubscriptionQueueInfo();
        assert.equal(elements.subscriptionQueuePanel.hidden, true);
        assert.equal(elements.subscriptionQueuePanel.style.display, 'none');
        assert.equal(elements.subscriptionQueueToggle.getAttribute('aria-expanded'), 'false');
        assert.equal(elements.subscriptionQueueToggle.classList.contains('is-active'), false);
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
}

function testQueueRenderingUsesBackendDisplayFields() {
    const previousDocument = globalThis.document;
    const elements = {
        subscriptionQueuePanel: createDomElement(),
        subscriptionQueueToggle: createDomElement(),
        subscriptionQueueToggleCount: createDomElement(),
        subscriptionQueueMeta: createDomElement(),
        subscriptionQueueEmpty: createDomElement(),
        subscriptionQueueList: createDomElement()
    };

    globalThis.document = {
        getElementById(id) {
            return elements[id] || null;
        },
        createElement() {
            return createDomElement();
        }
    };

    try {
        __subscriptionWorkflowTestUtils.renderSubscriptionQueueItems([
            {
                display: {
                    agentBadge: 'BD',
                    line: "16.16 Verwerkt: Wijziging '2 jaar Mikrogids voor EUR 80' (MKGV435) voor dhr. de Vries (1984301)"
                },
                summary: {
                    agent: {
                        shortName: 'Foute naam'
                    },
                    typeLabel: 'Fout type',
                    subscription: {
                        magazine: 'Fout tijdschrift'
                    },
                    offer: {
                        salesCode: 'FOUT123',
                        title: 'Fout aanbod'
                    },
                    recipient: {
                        displayName: 'Verkeerde ontvanger',
                        personId: 1
                    }
                }
            }
        ]);

        assert.equal(elements.subscriptionQueueMeta.textContent, 'Laatste 1 aanvragen');
        assert.equal(elements.subscriptionQueueToggleCount.textContent, '1');
        assert.equal(elements.subscriptionQueueToggleCount.style.display, 'inline-flex');
        assert.equal(elements.subscriptionQueueEmpty.style.display, 'none');
        assert.equal(elements.subscriptionQueueList.children.length, 1);
        assert.equal(elements.subscriptionQueueList.children[0].children.length, 1);
        assert.equal(elements.subscriptionQueueList.children[0].children[0].children[0].textContent, 'BD');
        assert.equal(
            elements.subscriptionQueueList.children[0].children[0].children[1].children[0].textContent,
            "16.16 Verwerkt: Wijziging '2 jaar Mikrogids voor EUR 80' (MKGV435) voor dhr. de Vries (1984301)"
        );
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
}

function run() {
    testRegistersItemSevenActions();
    testInstallsLegacyCompatibilityExports();
    testSubscriptionHelperFunctions();
    testWerfsleutelSelectionHelperPrefersMultiSelectionBridge();
    testQueueToggleUpdatesPanelVisibilityAndButtonState();
    testQueueRenderingUsesBackendDisplayFields();
    console.log('subscription workflow slice tests passed');
}

run();
