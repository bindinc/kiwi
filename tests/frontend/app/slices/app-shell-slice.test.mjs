import assert from 'node:assert/strict';
import { createActionRouter } from '../../../../assets/js/app/actions.js';
import {
    __appShellTestUtils,
    closeForm,
    configureAppShellSliceDependencies,
    registerAppShellSlice,
    showToast
} from '../../../../assets/js/app/slices/app-shell-slice.js';

function createRouter(root) {
    return createActionRouter({
        root,
        eventTypes: ['click', 'change', 'keydown']
    });
}

function createDocumentStub(overrides = {}) {
    const listeners = {};
    const elementsById = overrides.elementsById || {};

    return {
        listeners,
        addEventListener(eventType, listener) {
            listeners[eventType] = listener;
        },
        removeEventListener(eventType) {
            delete listeners[eventType];
        },
        getElementById(elementId) {
            return Object.prototype.hasOwnProperty.call(elementsById, elementId)
                ? elementsById[elementId]
                : null;
        },
        querySelectorAll() {
            return [];
        }
    };
}

function withGlobalState(testFn) {
    const previousValues = {
        kiwiAppShellSlice: globalThis.kiwiAppShellSlice,
        document: globalThis.document,
        featureFlags: globalThis.featureFlags
    };

    try {
        __appShellTestUtils.resetDebugKeySequence();
        configureAppShellSliceDependencies(null);
        testFn();
    } finally {
        __appShellTestUtils.uninstallGlobalListeners();
        configureAppShellSliceDependencies(null);

        if (previousValues.kiwiAppShellSlice === undefined) {
            delete globalThis.kiwiAppShellSlice;
        } else {
            globalThis.kiwiAppShellSlice = previousValues.kiwiAppShellSlice;
        }

        if (previousValues.document === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousValues.document;
        }

        if (previousValues.featureFlags === undefined) {
            delete globalThis.featureFlags;
        } else {
            globalThis.featureFlags = previousValues.featureFlags;
        }
    }
}

function testRegistersItemTwelveActionAndNamespace() {
    withGlobalState(() => {
        const documentStub = createDocumentStub();
        globalThis.document = documentStub;
        configureAppShellSliceDependencies(() => ({}));

        const router = createRouter(documentStub);
        registerAppShellSlice(router);

        const actionNames = router.getRegisteredActions();
        assert.equal(actionNames.includes('close-form'), true);
        assert.equal(typeof globalThis.kiwiAppShellSlice, 'object');
        assert.equal(typeof globalThis.kiwiAppShellSlice.closeForm, 'function');
        assert.equal(typeof globalThis.kiwiAppShellSlice.showToast, 'function');
        assert.equal(typeof globalThis.kiwiAppShellSlice.endSession, 'function');
    });
}

function testCloseFormResetsDuplicateStateForNewSubscriptionForm() {
    withGlobalState(() => {
        const formElement = {
            style: { display: 'flex' }
        };
        const documentStub = createDocumentStub({
            elementsById: {
                newSubscriptionForm: formElement
            }
        });
        globalThis.document = documentStub;

        let resetCount = 0;
        configureAppShellSliceDependencies(() => ({
            resetAllSubscriptionDuplicateStates() {
                resetCount += 1;
            }
        }));

        closeForm('newSubscriptionForm');

        assert.equal(formElement.style.display, 'none');
        assert.equal(resetCount, 1);
    });
}

function testShowToastUsesContactHistoryAndDeduplicatesRecentSuccessToast() {
    withGlobalState(() => {
        const contactHistoryEntries = [];
        const currentCustomer = { id: 42 };
        const contactHistoryState = {
            highlightId: null,
            lastEntry: null
        };
        configureAppShellSliceDependencies(() => ({
            getCurrentCustomer() {
                return currentCustomer;
            },
            getContactHistoryState() {
                return contactHistoryState;
            },
            pushContactHistory(customer, entry, options) {
                contactHistoryEntries.push({ customer, entry, options });
            }
        }));

        showToast('saved', 'success');
        assert.equal(contactHistoryEntries.length, 1);
        assert.equal(contactHistoryEntries[0].entry.type, 'notification_success');
        assert.equal(contactHistoryEntries[0].entry.description, 'saved');

        contactHistoryState.highlightId = 'entry_1';
        contactHistoryState.lastEntry = {
            id: 'entry_1',
            createdAt: Date.now()
        };

        showToast('duplicate', 'success');
        assert.equal(contactHistoryEntries.length, 1);

        showToast('warning', 'warning');
        assert.equal(contactHistoryEntries.length, 2);
        assert.equal(contactHistoryEntries[1].entry.type, 'notification_warning');
    });
}

function testShowToastFallsBackToVisualToastForSubscriptionApiCustomer() {
    withGlobalState(() => {
        const toastElement = {
            textContent: '',
            className: '',
            classList: {
                add(className) {
                    this.lastAdded = className;
                },
                remove() {}
            }
        };
        const documentStub = createDocumentStub({
            elementsById: {
                toast: toastElement
            }
        });
        globalThis.document = documentStub;

        let pushedEntries = 0;
        configureAppShellSliceDependencies(() => ({
            getCurrentCustomer() {
                return {
                    id: 77,
                    sourceSystem: 'subscription-api'
                };
            },
            getContactHistoryState() {
                return {
                    highlightId: null,
                    lastEntry: null
                };
            },
            pushContactHistory() {
                pushedEntries += 1;
            }
        }));

        showToast('readonly melding', 'warning');

        assert.equal(pushedEntries, 0);
        assert.equal(toastElement.textContent, 'readonly melding');
        assert.equal(toastElement.className, 'toast warning');
        assert.equal(toastElement.classList.lastAdded, 'show');
    });
}

function testGlobalListenersHandleKeyboardClickAndChangeEvents() {
    withGlobalState(() => {
        const searchInput = {
            focusCount: 0,
            focus() {
                this.focusCount += 1;
            }
        };
        let debugModalOpen = true;
        const debugModal = {
            classList: {
                contains(className) {
                    return className === 'show' ? debugModalOpen : false;
                }
            }
        };
        const statusMenu = {
            hidden: false,
            contains() {
                return false;
            }
        };
        const profileTrigger = {
            contains() {
                return false;
            }
        };
        const documentStub = createDocumentStub({
            elementsById: {
                searchName: searchInput,
                debugModal,
                agentStatusMenu: statusMenu,
                agentProfileTrigger: profileTrigger
            }
        });
        globalThis.document = documentStub;

        let openedDebugModal = 0;
        let closedDebugModal = 0;
        let closedStatusMenu = 0;
        globalThis.featureFlags = {
            isEnabled(flagName) {
                return flagName === 'debugModal';
            }
        };
        configureAppShellSliceDependencies(() => ({
            openDebugModal() {
                openedDebugModal += 1;
            },
            closeDebugModal() {
                closedDebugModal += 1;
                debugModalOpen = false;
            },
            closeStatusMenu() {
                closedStatusMenu += 1;
            }
        }));

        const router = createRouter(documentStub);
        registerAppShellSlice(router);

        let preventDefaultCount = 0;
        documentStub.listeners.keydown({
            ctrlKey: true,
            metaKey: false,
            key: 'k',
            preventDefault() {
                preventDefaultCount += 1;
            }
        });
        assert.equal(preventDefaultCount, 1);
        assert.equal(searchInput.focusCount, 1);

        documentStub.listeners.keydown({ key: ']' });
        documentStub.listeners.keydown({ key: ']' });
        documentStub.listeners.keydown({ key: ']' });
        documentStub.listeners.keydown({ key: ']' });
        assert.equal(openedDebugModal, 1);

        documentStub.listeners.keydown({ key: 'Escape' });
        assert.equal(closedDebugModal, 1);

        documentStub.listeners.click({
            target: {}
        });
        assert.equal(closedStatusMenu, 1);

        documentStub.listeners.click({
            target: debugModal
        });
        assert.equal(closedDebugModal, 2);

        const ibanInput = {
            required: false,
            setAttribute(name, value) {
                if (name === 'required' && value === 'required') {
                    this.required = true;
                }
            },
            removeAttribute(name) {
                if (name === 'required') {
                    this.required = false;
                }
            }
        };

        const paymentOption = {
            querySelector(selector) {
                if (selector !== '.additional-input') {
                    return null;
                }
                return {
                    querySelector(inputSelector) {
                        return inputSelector === 'input[type="text"]' ? ibanInput : null;
                    }
                };
            }
        };

        documentStub.listeners.change({
            target: {
                name: 'subPayment',
                value: 'automatisch',
                closest(selector) {
                    return selector === '.payment-option' ? paymentOption : null;
                }
            }
        });
        assert.equal(ibanInput.required, true);

        documentStub.listeners.change({
            target: {
                name: 'subPayment',
                value: 'acceptgiro',
                closest(selector) {
                    return selector === '.payment-option' ? paymentOption : null;
                }
            }
        });
        assert.equal(ibanInput.required, false);
    });
}

function run() {
    testRegistersItemTwelveActionAndNamespace();
    testCloseFormResetsDuplicateStateForNewSubscriptionForm();
    testShowToastUsesContactHistoryAndDeduplicatesRecentSuccessToast();
    testShowToastFallsBackToVisualToastForSubscriptionApiCustomer();
    testGlobalListenersHandleKeyboardClickAndChangeEvents();
    console.log('app shell slice tests passed');
}

run();
