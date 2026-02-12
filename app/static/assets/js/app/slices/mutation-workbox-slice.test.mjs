import assert from 'node:assert/strict';
import { createActionRouter } from '../actions.js';
import { registerMutationWorkboxSlice } from './mutation-workbox-slice.js';

function createRouter() {
    const root = {
        addEventListener() {},
        removeEventListener() {}
    };

    return createActionRouter({
        root,
        eventTypes: ['click']
    });
}

function createElement(overrides = {}) {
    return {
        style: {},
        hidden: false,
        textContent: '',
        innerHTML: '',
        classList: {
            toggle() {}
        },
        addEventListener() {},
        setAttribute() {},
        ...overrides
    };
}

function installDomHarness() {
    const elements = new Map();
    elements.set('mutationWorkboxPanel', createElement());
    elements.set('mutationWorkboxToggle', createElement());
    elements.set('mutationWorkboxToggleCount', createElement({ style: { display: 'none' } }));
    elements.set('mutationWorkboxSummary', createElement());
    elements.set('customerMutationStatus', createElement({ style: { display: 'none' } }));
    elements.set('mutationWorkboxList', createElement());
    elements.set('mutationDetailsModal', createElement({ style: { display: 'none' } }));
    elements.set('mutationDetailsSummary', createElement());
    elements.set('mutationDetailsId', createElement());
    elements.set('mutationDetailsCommandType', createElement());
    elements.set('mutationDetailsStatus', createElement());
    elements.set('mutationDetailsAttempts', createElement());
    elements.set('mutationDetailsNextAttempt', createElement());
    elements.set('mutationDetailsLastError', createElement());
    elements.set('mutationDetailsRequest', createElement());
    elements.set('mutationDetailsEvents', createElement());
    elements.set('agentProfileTrigger', createElement({
        querySelector(selector) {
            if (selector === '.agent-avatar img') {
                return {
                    getAttribute(attribute) {
                        if (attribute === 'src') {
                            return 'https://example.test/avatar.jpg';
                        }
                        return null;
                    }
                };
            }
            return null;
        }
    }));

    const previousDocument = globalThis.document;
    const previousLocalStorage = globalThis.localStorage;
    const previousKiwiApi = globalThis.kiwiApi;
    const previousCustomers = globalThis.customers;
    const previousKiwiAgentEmail = globalThis.kiwiAgentEmail;
    const previousSetInterval = globalThis.setInterval;
    const previousClearInterval = globalThis.clearInterval;

    globalThis.document = {
        documentElement: {
            dataset: {
                kiwiAgentEmail: 'kiwi-agent@example.com'
            }
        },
        getElementById(id) {
            return elements.get(id) || null;
        }
    };

    globalThis.localStorage = {
        getItem() {
            return null;
        },
        setItem() {}
    };

    globalThis.kiwiApi = {
        async get(url) {
            if (String(url).includes('/summary')) {
                return {
                    summary: {
                        pending: 2,
                        failed: 1,
                        delivered: 5
                    }
                };
            }

            return {
                items: [
                    {
                        id: '9f53f0e6-8ef2-4a0e-96a4-f57167dbf9fd',
                        commandType: 'subscription.signup',
                        customerId: 42,
                        status: 'queued',
                        createdAt: '2026-02-12T15:00:00Z',
                        createdByUser: 'kiwi-agent@example.com',
                        requestPayload: {
                            subscription: {
                                werfsleutel: 'WK-123'
                            }
                        }
                    }
                ]
            };
        }
    };
    globalThis.customers = [{ id: 42, lastName: 'Jansen' }];
    globalThis.kiwiAgentEmail = 'kiwi-agent@example.com';

    globalThis.setInterval = () => 1;
    globalThis.clearInterval = () => {};

    return {
        elements,
        restore() {
            globalThis.document = previousDocument;
            globalThis.localStorage = previousLocalStorage;
            globalThis.kiwiApi = previousKiwiApi;
            globalThis.customers = previousCustomers;
            globalThis.kiwiAgentEmail = previousKiwiAgentEmail;
            globalThis.setInterval = previousSetInterval;
            globalThis.clearInterval = previousClearInterval;
        }
    };
}

function testRegistersNewActions() {
    const harness = installDomHarness();
    try {
        const router = createRouter();
        registerMutationWorkboxSlice(router);
        const actionNames = router.getRegisteredActions();

        assert.equal(actionNames.includes('mutations.toggle-panel'), true);
        assert.equal(actionNames.includes('mutations.details'), true);
        assert.equal(actionNames.includes('mutations.close-details'), true);
    } finally {
        harness.restore();
    }
}

function testGlobalTogglePanelHidesAndShowsPanel() {
    const harness = installDomHarness();
    try {
        const router = createRouter();
        registerMutationWorkboxSlice(router);

        assert.equal(typeof globalThis.kiwiMutationWorkbox?.togglePanel, 'function');

        const panel = harness.elements.get('mutationWorkboxPanel');
        assert.equal(panel.hidden, false);

        globalThis.kiwiMutationWorkbox.togglePanel();
        assert.equal(panel.hidden, true);
        assert.equal(panel.style.display, 'none');

        globalThis.kiwiMutationWorkbox.togglePanel();
        assert.equal(panel.hidden, false);
        assert.equal(panel.style.display, '');
    } finally {
        delete globalThis.kiwiMutationWorkbox;
        harness.restore();
    }
}

async function testRendersDetailsButtonInsteadOfRefreshButton() {
    const harness = installDomHarness();
    try {
        const router = createRouter();
        registerMutationWorkboxSlice(router);
        await new Promise((resolve) => setTimeout(resolve, 0));

        const listMarkup = harness.elements.get('mutationWorkboxList').innerHTML;
        assert.equal(listMarkup.includes('Details'), true);
        assert.equal(listMarkup.includes('Vernieuwen'), false);
        assert.equal(listMarkup.includes('subscription.signup'), false);
        assert.equal(listMarkup.includes('Jansen aangemeld werfsleutel'), true);
        assert.equal(listMarkup.includes('mutation-workbox-avatar-image'), true);

        const summaryText = harness.elements.get('mutationWorkboxSummary').textContent;
        assert.equal(summaryText.includes('Pending: 2'), true);
    } finally {
        harness.restore();
    }
}

async function run() {
    testRegistersNewActions();
    testGlobalTogglePanelHidesAndShowsPanel();
    await testRendersDetailsButtonInsteadOfRefreshButton();
    console.log('mutation workbox slice tests passed');
}

void run();
