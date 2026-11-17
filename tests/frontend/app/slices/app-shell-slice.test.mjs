import assert from 'node:assert/strict';
import { createActionRouter } from '../../../../assets/js/app/actions.js';
import {
    __appShellTestUtils,
    closeForm,
    configureAppShellSliceDependencies,
    registerAppShellSlice,
    resetCustomerWorkspace,
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

function testCloseFormPreservesDuplicateStateForNewSubscriptionForm() {
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
        assert.equal(resetCount, 0);
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

function testLiveToastRevealsOnlyAnOverlappingShortCallActionAndKeepsItsLifecycle() {
    withGlobalState(() => {
        const previousSetTimeout = globalThis.setTimeout;
        const timers = [];
        globalThis.setTimeout = (callback, delay) => { timers.push({ callback, delay }); return timers.length; };
        try {
            let toastVisible = false;
            const toast = {
                textContent: '', className: '', offsetHeight: 45,
                classList: { contains(name) { return name === 'show' && toastVisible; },
                    add(name) { if (name === 'show') toastVisible = true; },
                    remove(name) { if (name === 'show') toastVisible = false; } },
                // The entrance transform is still outside the viewport; layout height and bottom are final.
                getBoundingClientRect() { return { left: 149, right: 374, top: 700, bottom: 745 }; }
            };
            const positions = { holdCallBtn: 231, endCallBtn: 231 };
            const horizontal = { left: 207, right: 374 };
            const hold = { id: 'holdCallBtn', getBoundingClientRect() {
                return { ...horizontal, top: positions.holdCallBtn, bottom: positions.holdCallBtn + 40 };
            } };
            const end = { id: 'endCallBtn', getBoundingClientRect() {
                return { ...horizontal, top: positions.endCallBtn, bottom: positions.endCallBtn + 40 };
            } };
            const scrolls = [];
            let outlineStyle = 'solid';
            const view = {
                innerHeight: 320,
                getComputedStyle(node) { return node === toast ? { bottom: '16px' }
                    : { outlineStyle, outlineWidth: '3px', outlineOffset: '3px' }; },
                scrollBy(options) {
                    scrolls.push(options);
                    for (const id of Object.keys(positions)) positions[id] -= options.top;
                }
            };
            const documentStub = createDocumentStub({ elementsById: { toast } });
            documentStub.defaultView = view;
            documentStub.activeElement = hold;
            let focusListenerInstalls = 0;
            const addListener = documentStub.addEventListener.bind(documentStub);
            documentStub.addEventListener = (type, listener) => {
                if (type === 'focusin') focusListenerInstalls++;
                addListener(type, listener);
            };
            globalThis.document = documentStub;
            registerAppShellSlice(createRouter(documentStub));
            registerAppShellSlice(createRouter(documentStub));
            assert.equal(focusListenerInstalls, 1, 'the existing listener lifecycle prevents duplicate focus handlers');

            showToast('Gesprek hervat (wacht: 0:00)', 'success');
            assert.equal(toast.textContent, 'Gesprek hervat (wacht: 0:00)');
            assert.equal(toast.className, 'toast success');
            assert.deepEqual(scrolls, [{ top: 19, behavior: 'instant' }], 'clear the entire 3px+3px focus perimeter, using final toast layout');
            assert.equal(documentStub.activeElement, hold, 'revealing feedback never moves focus');
            documentStub.listeners.focusin();
            assert.equal(scrolls.length, 1, 'an already clear call action stays still');
            assert.equal(timers.length, 1);
            assert.equal(timers[0].delay, 3000);

            positions.holdCallBtn = 231; positions.endCallBtn = 231;
            documentStub.activeElement = end;
            toast.offsetHeight = 80;
            const wrappedMessage = 'Volledige langere gespreksmelding die over meerdere regels wordt weergegeven.';
            showToast(wrappedMessage, 'info');
            assert.equal(toast.textContent, wrappedMessage, 'measuring wrapped feedback preserves every character');
            assert.deepEqual(scrolls[1], { top: 54, behavior: 'instant' }, 'a taller live message supplies its own clearance');
            assert.equal(documentStub.activeElement, end);
            assert.equal(timers.length, 2, 'only the existing notification expiry is scheduled');
            assert.ok(timers.every(timer => timer.delay === 3000));

            positions.holdCallBtn = 180;
            documentStub.activeElement = hold;
            documentStub.listeners.focusin();
            assert.deepEqual(scrolls[2], { top: 3, behavior: 'instant' }, 'native focus accounts for an outline overlapping beyond an uncovered control');
            assert.equal(documentStub.activeElement, hold);
            const clearedCount = scrolls.length;
            documentStub.listeners.focusin();
            assert.equal(scrolls.length, clearedCount);

            positions.holdCallBtn = 180; outlineStyle = 'none';
            documentStub.listeners.focusin();
            assert.equal(scrolls.length, clearedCount, 'an absent outline is not treated as an obstruction');
            outlineStyle = 'solid'; horizontal.left = 10; horizontal.right = 100;
            documentStub.listeners.focusin();
            assert.equal(scrolls.length, clearedCount, 'a horizontally clear target does not move');
            horizontal.left = 207; horizontal.right = 374;
            view.innerHeight = 1000; positions.holdCallBtn = 900;
            documentStub.listeners.focusin();
            assert.equal(scrolls.length, clearedCount, 'desktop call positioning is untouched');
            view.innerHeight = 320;
            documentStub.activeElement = { id: 'unrelated-input', getBoundingClientRect() { throw new Error('unrelated target must not be measured'); } };
            documentStub.listeners.focusin();
            assert.equal(scrolls.length, clearedCount);

            timers[0].callback();
            assert.equal(toastVisible, false, 'the original notification expiry policy is unchanged');
            assert.equal(toast.textContent, wrappedMessage);
            documentStub.activeElement = end; positions.endCallBtn = 231;
            documentStub.listeners.focusin();
            assert.equal(scrolls.length, clearedCount, 'a hidden notification never scrolls a call action');
            assert.equal(timers.length, 2, 'focus changes never schedule notification timers');
            __appShellTestUtils.uninstallGlobalListeners();
            assert.equal(documentStub.listeners.focusin, undefined);
            registerAppShellSlice(createRouter(documentStub));
            assert.equal(focusListenerInstalls, 2, 'reinstallation owns exactly one fresh focus listener');
        } finally { globalThis.setTimeout = previousSetTimeout; }
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

        documentStub.getElementById = (elementId) => elementId === 'subIBAN' ? ibanInput : null;

        documentStub.listeners.change({
            target: {
                name: 'subPayment',
                value: 'B'
            }
        });
        assert.equal(ibanInput.required, true);

        documentStub.listeners.change({
            target: {
                name: 'subPayment',
                value: 'AC'
            }
        });
        assert.equal(ibanInput.required, false);
    });
}

function testCustomerWorkspaceResetDoesNotEndTheCallSession() {
    withGlobalState(() => {
        const visibleContainer = { style: { display: 'flex' } };
        const form = {
            resetCount: 0,
            reset() {
                this.resetCount += 1;
            }
        };
        const standaloneInput = {
            form: null,
            tagName: 'INPUT',
            type: 'text',
            value: 'customer-bound value'
        };
        const checkedMandant = { checked: true };
        const elementsById = {};
        const documentStub = createDocumentStub({ elementsById });
        documentStub.querySelectorAll = (selector) => {
            if (selector === 'input[name="searchMandants"]:checked') {
                return [checkedMandant];
            }
            if (selector === '.form-container') {
                return [visibleContainer];
            }
            if (selector === '.form-container form') {
                return [form];
            }
            if (selector === '.form-container input, .form-container select, .form-container textarea') {
                return [standaloneInput];
            }
            return [];
        };
        globalThis.document = documentStub;

        let endCallCount = 0;
        let duplicateResetCount = 0;
        const currentCustomers = [];
        configureAppShellSliceDependencies(() => ({
            endCallSession() {
                endCallCount += 1;
            },
            isCallSessionActive() {
                return true;
            },
            resetAllSubscriptionDuplicateStates() {
                duplicateResetCount += 1;
            },
            setCurrentCustomer(customer) {
                currentCustomers.push(customer);
            }
        }));

        resetCustomerWorkspace();

        assert.equal(endCallCount, 0);
        assert.deepEqual(currentCustomers, [null]);
        assert.equal(duplicateResetCount, 1);
        assert.equal(visibleContainer.style.display, 'none');
        assert.equal(form.resetCount, 1);
        assert.equal(standaloneInput.value, '');
        assert.equal(checkedMandant.checked, false);
    });
}

function testEscapeDismissesDebugThenProfileWithoutClosingRetainedForm() {
    withGlobalState(() => {
        let debugOpen = true;
        let profileClosed = 0;
        const draftForm = { style: { display: 'flex' } };
        const statusMenu = { hidden: false };
        const debugModal = { classList: { contains: name => name === 'show' && debugOpen } };
        const profileTrigger = {
            focusCount: 0,
            focus() { this.focusCount += 1; documentStub.activeElement = this; }
        };
        const documentStub = createDocumentStub({ elementsById: {
            debugModal, agentStatusMenu: statusMenu, agentProfileTrigger: profileTrigger
        } });
        documentStub.activeElement = {};
        documentStub.querySelectorAll = () => [draftForm];
        globalThis.document = documentStub;
        globalThis.featureFlags = { isEnabled: flag => flag === 'debugModal' };
        configureAppShellSliceDependencies(() => ({
            closeDebugModal() { debugOpen = false; },
            closeStatusMenu() { statusMenu.hidden = true; profileClosed += 1; }
        }));
        registerAppShellSlice(createRouter(documentStub));

        documentStub.listeners.keydown({ key: 'Escape' });
        assert.equal(debugOpen, false);
        assert.equal(statusMenu.hidden, false);
        assert.equal(profileTrigger.focusCount, 0);
        assert.equal(draftForm.style.display, 'flex');

        let prevented = false;
        documentStub.listeners.keydown({ key: 'Escape', preventDefault() { prevented = true; } });
        assert.equal(profileClosed, 1);
        assert.equal(statusMenu.hidden, true);
        assert.equal(documentStub.activeElement, profileTrigger);
        assert.equal(profileTrigger.focusCount, 1);
        assert.equal(prevented, true);
        assert.equal(draftForm.style.display, 'flex');

        // Existing form dismissal remains the next layer after both disclosures close.
        documentStub.listeners.keydown({ key: 'Escape' });
        assert.equal(draftForm.style.display, 'none');
    });
}

function run() {
    testEscapeDismissesDebugThenProfileWithoutClosingRetainedForm();
    testRegistersItemTwelveActionAndNamespace();
    testCloseFormPreservesDuplicateStateForNewSubscriptionForm();
    testShowToastUsesContactHistoryAndDeduplicatesRecentSuccessToast();
    testShowToastFallsBackToVisualToastForSubscriptionApiCustomer();
    testLiveToastRevealsOnlyAnOverlappingShortCallActionAndKeepsItsLifecycle();
    testGlobalListenersHandleKeyboardClickAndChangeEvents();
    testCustomerWorkspaceResetDoesNotEndTheCallSession();
    console.log('app shell slice tests passed');
}

run();
