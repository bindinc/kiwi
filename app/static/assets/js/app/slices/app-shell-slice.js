import { getGlobalScope } from '../services.js';

const APP_SHELL_SLICE_NAMESPACE = 'kiwiAppShellSlice';
let appShellDependenciesResolver = null;
const DEBUG_KEY = ']';
const DEBUG_KEY_COUNT = 4;
const DEBUG_KEY_WINDOW_MS = 10000;
const TOAST_DEDUPLICATION_WINDOW_MS = 1500;

let debugKeySequence = [];
let listenersInstalled = false;
let installedDocumentRef = null;
const listenersByEventType = {
    keydown: null,
    click: null,
    change: null
};

export function configureAppShellSliceDependencies(dependenciesResolver) {
    appShellDependenciesResolver = typeof dependenciesResolver === 'function'
        ? dependenciesResolver
        : null;
}

function resolveDependencies() {
    if (typeof appShellDependenciesResolver !== 'function') {
        return null;
    }

    const dependencies = appShellDependenciesResolver();
    if (!dependencies || typeof dependencies !== 'object') {
        return null;
    }

    return dependencies;
}

function getDocumentRef() {
    if (typeof document !== 'undefined') {
        return document;
    }

    const globalScope = getGlobalScope();
    return globalScope && globalScope.document ? globalScope.document : null;
}

function getElementById(elementId) {
    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.getElementById !== 'function') {
        return null;
    }

    return documentRef.getElementById(elementId);
}

function setElementDisplay(elementId, displayValue) {
    const element = getElementById(elementId);
    if (!element || !element.style) {
        return;
    }

    element.style.display = displayValue;
}

function clearInputValue(elementId) {
    const element = getElementById(elementId);
    if (!element || !('value' in element)) {
        return;
    }

    element.value = '';
}

function clearElementContent(elementId) {
    const element = getElementById(elementId);
    if (!element) {
        return;
    }

    element.innerHTML = '';
}

function hideVisibleFormContainers(documentRef) {
    if (!documentRef || typeof documentRef.querySelectorAll !== 'function') {
        return;
    }

    const openForms = documentRef.querySelectorAll('.form-container');
    openForms.forEach((form) => {
        if (!form || !form.style) {
            return;
        }

        if (form.style.display === 'flex') {
            form.style.display = 'none';
        }
    });
}

function focusSearchInput() {
    const searchInput = getElementById('searchName');
    if (searchInput && typeof searchInput.focus === 'function') {
        searchInput.focus();
    }
}

function callDependency(dependencies, methodName, args = []) {
    if (!dependencies || typeof dependencies[methodName] !== 'function') {
        return;
    }

    dependencies[methodName](...args);
}

function pushDebugKeyPress(key) {
    const isDebugKey = key === DEBUG_KEY;
    if (!isDebugKey) {
        debugKeySequence = [];
        return false;
    }

    const now = Date.now();
    debugKeySequence.push(now);
    debugKeySequence = debugKeySequence.filter((timestamp) => now - timestamp < DEBUG_KEY_WINDOW_MS);
    return debugKeySequence.length >= DEBUG_KEY_COUNT;
}

export function closeForm(formId) {
    if (!formId) {
        return;
    }

    const dependencies = resolveDependencies();
    const shouldResetDuplicateState = formId === 'newSubscriptionForm';
    if (shouldResetDuplicateState) {
        callDependency(dependencies, 'resetAllSubscriptionDuplicateStates');
    }

    setElementDisplay(formId, 'none');
}

export function mapToastTypeToContactType(toastType) {
    switch (toastType) {
        case 'error':
            return 'notification_error';
        case 'warning':
            return 'notification_warning';
        case 'info':
            return 'notification_info';
        default:
            return 'notification_success';
    }
}

function shouldSkipContactHistoryToast(type, contactHistoryState) {
    if (type !== 'success') {
        return false;
    }

    if (!contactHistoryState || typeof contactHistoryState !== 'object') {
        return false;
    }

    const recentEntry = contactHistoryState.lastEntry;
    const highlightId = contactHistoryState.highlightId;
    const hasRecentEntry = recentEntry && typeof recentEntry.createdAt === 'number';
    if (!hasRecentEntry || !highlightId || recentEntry.id !== highlightId) {
        return false;
    }

    const ageMs = Date.now() - recentEntry.createdAt;
    return ageMs < TOAST_DEDUPLICATION_WINDOW_MS;
}

export function showToast(message, type = 'success') {
    const dependencies = resolveDependencies();
    const currentCustomer = dependencies && typeof dependencies.getCurrentCustomer === 'function'
        ? dependencies.getCurrentCustomer()
        : null;
    const contactHistoryState = dependencies && typeof dependencies.getContactHistoryState === 'function'
        ? dependencies.getContactHistoryState()
        : null;
    const canLogContactHistory = dependencies && typeof dependencies.pushContactHistory === 'function';

    if (currentCustomer && canLogContactHistory) {
        const shouldSkipToast = shouldSkipContactHistoryToast(type, contactHistoryState);
        if (shouldSkipToast) {
            return;
        }

        dependencies.pushContactHistory(
            currentCustomer,
            {
                type: mapToastTypeToContactType(type),
                description: message
            },
            { highlight: true, moveToFirstPage: true }
        );
        return;
    }

    const toast = getElementById('toast');
    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

export function isDebugModalEnabled() {
    const globalScope = getGlobalScope();
    const flags = globalScope ? globalScope.featureFlags : null;
    if (!flags || typeof flags.isEnabled !== 'function') {
        return true;
    }

    return flags.isEnabled('debugModal');
}

function openDebugModal() {
    const dependencies = resolveDependencies();
    if (dependencies && typeof dependencies.openDebugModal === 'function') {
        dependencies.openDebugModal();
        return;
    }

    const globalScope = getGlobalScope();
    if (globalScope && typeof globalScope.openDebugModal === 'function') {
        globalScope.openDebugModal();
    }
}

function closeDebugModal() {
    const dependencies = resolveDependencies();
    if (dependencies && typeof dependencies.closeDebugModal === 'function') {
        dependencies.closeDebugModal();
        return;
    }

    const globalScope = getGlobalScope();
    if (globalScope && typeof globalScope.closeDebugModal === 'function') {
        globalScope.closeDebugModal();
    }
}

function closeStatusMenu() {
    const dependencies = resolveDependencies();
    if (dependencies && typeof dependencies.closeStatusMenu === 'function') {
        dependencies.closeStatusMenu();
        return;
    }

    const globalScope = getGlobalScope();
    if (globalScope && typeof globalScope.closeStatusMenu === 'function') {
        globalScope.closeStatusMenu();
    }
}

function handleGlobalKeydown(event) {
    const key = event && typeof event.key === 'string' ? event.key : '';
    if (!key) {
        return;
    }

    const debugFeatureEnabled = isDebugModalEnabled();
    if (debugFeatureEnabled) {
        const shouldOpenDebugModal = pushDebugKeyPress(key);
        if (shouldOpenDebugModal) {
            openDebugModal();
            debugKeySequence = [];
        }
    } else {
        debugKeySequence = [];
    }

    if (key === 'Escape') {
        const debugModal = getElementById('debugModal');
        const debugModalIsOpen = debugModal
            && debugModal.classList
            && typeof debugModal.classList.contains === 'function'
            && debugModal.classList.contains('show');
        if (debugModalIsOpen) {
            closeDebugModal();
            return;
        }

        hideVisibleFormContainers(getDocumentRef());
        return;
    }

    const isSearchShortcut = (event.ctrlKey || event.metaKey) && key.toLowerCase() === 'k';
    if (!isSearchShortcut) {
        return;
    }

    if (typeof event.preventDefault === 'function') {
        event.preventDefault();
    }
    focusSearchInput();
}

function handleGlobalClick(event) {
    const documentRef = getDocumentRef();
    if (!documentRef) {
        return;
    }

    const modal = getElementById('debugModal');
    const statusMenu = getElementById('agentStatusMenu');
    const profileTrigger = getElementById('agentProfileTrigger');

    const eventTarget = event ? event.target : null;
    const clickInsideStatusMenu = statusMenu && typeof statusMenu.contains === 'function' && statusMenu.contains(eventTarget);
    const clickOnProfileTrigger = profileTrigger && typeof profileTrigger.contains === 'function' && profileTrigger.contains(eventTarget);
    const menuIsOpen = statusMenu && statusMenu.hidden === false;

    if (menuIsOpen && !clickInsideStatusMenu && !clickOnProfileTrigger) {
        closeStatusMenu();
    }

    if (eventTarget === modal) {
        closeDebugModal();
    }
}

function handleGlobalChange(event) {
    const target = event ? event.target : null;
    if (!target || typeof target.name !== 'string') {
        return;
    }

    const isPaymentMethodField = target.name === 'subPayment' || target.name === 'editPayment';
    if (!isPaymentMethodField || typeof target.closest !== 'function') {
        return;
    }

    const paymentOption = target.closest('.payment-option');
    if (!paymentOption || typeof paymentOption.querySelector !== 'function') {
        return;
    }

    const additionalInput = paymentOption.querySelector('.additional-input');
    if (!additionalInput || typeof additionalInput.querySelector !== 'function') {
        return;
    }

    const ibanInput = additionalInput.querySelector('input[type="text"]');
    if (!ibanInput || typeof ibanInput.setAttribute !== 'function' || typeof ibanInput.removeAttribute !== 'function') {
        return;
    }

    const shouldRequireIban = target.value === 'automatisch';
    if (shouldRequireIban) {
        ibanInput.setAttribute('required', 'required');
        return;
    }

    ibanInput.removeAttribute('required');
}

export function installGlobalListeners() {
    if (listenersInstalled) {
        return;
    }

    const documentRef = getDocumentRef();
    if (!documentRef || typeof documentRef.addEventListener !== 'function') {
        return;
    }

    listenersByEventType.keydown = (event) => {
        handleGlobalKeydown(event);
    };
    listenersByEventType.click = (event) => {
        handleGlobalClick(event);
    };
    listenersByEventType.change = (event) => {
        handleGlobalChange(event);
    };

    documentRef.addEventListener('keydown', listenersByEventType.keydown);
    documentRef.addEventListener('click', listenersByEventType.click);
    documentRef.addEventListener('change', listenersByEventType.change);

    installedDocumentRef = documentRef;
    listenersInstalled = true;
}

export function uninstallGlobalListeners() {
    if (!listenersInstalled) {
        return;
    }

    if (!installedDocumentRef || typeof installedDocumentRef.removeEventListener !== 'function') {
        listenersInstalled = false;
        installedDocumentRef = null;
        return;
    }

    if (listenersByEventType.keydown) {
        installedDocumentRef.removeEventListener('keydown', listenersByEventType.keydown);
    }
    if (listenersByEventType.click) {
        installedDocumentRef.removeEventListener('click', listenersByEventType.click);
    }
    if (listenersByEventType.change) {
        installedDocumentRef.removeEventListener('change', listenersByEventType.change);
    }

    listenersByEventType.keydown = null;
    listenersByEventType.click = null;
    listenersByEventType.change = null;
    installedDocumentRef = null;
    listenersInstalled = false;
}

export function endSession() {
    const dependencies = resolveDependencies();
    const isCallActive = dependencies
        && typeof dependencies.isCallSessionActive === 'function'
        && dependencies.isCallSessionActive();
    if (isCallActive && typeof dependencies.endCallSession === 'function') {
        dependencies.endCallSession();
    }

    callDependency(dependencies, 'setCurrentCustomer', [null]);
    callDependency(dependencies, 'setSelectedOffer', [null]);

    setElementDisplay('customerDetail', 'none');
    setElementDisplay('welcomeMessage', 'block');
    setElementDisplay('endCallBtn', 'none');

    clearInputValue('searchName');
    clearInputValue('searchPostalCode');
    clearInputValue('searchHouseNumber');
    clearInputValue('searchPhone');
    clearInputValue('searchEmail');
    callDependency(dependencies, 'setAdditionalFiltersOpen', [false]);

    setElementDisplay('searchResults', 'none');
    clearElementContent('resultsContainer');

    const formsToClose = [
        'newSubscriptionForm',
        'articleSaleForm',
        'editCustomerForm',
        'editSubscriptionForm',
        'resendMagazineForm',
        'winbackFlowForm'
    ];
    formsToClose.forEach((formId) => {
        closeForm(formId);
    });

    callDependency(dependencies, 'updateCustomerActionButtons');

    const globalScope = getGlobalScope();
    if (globalScope && typeof globalScope.scrollTo === 'function') {
        globalScope.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (typeof console !== 'undefined' && typeof console.log === 'function') {
        console.log('Session ended - Ready for next customer');
    }
}

function exposeAppShellSliceApi() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    globalScope[APP_SHELL_SLICE_NAMESPACE] = {
        closeForm,
        mapToastTypeToContactType,
        showToast,
        isDebugModalEnabled,
        installGlobalListeners,
        uninstallGlobalListeners,
        endSession
    };
}

export function registerAppShellSlice(actionRouter) {
    exposeAppShellSliceApi();
    installGlobalListeners();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'close-form': (payload = {}) => {
            if (!payload.formId) {
                return;
            }
            closeForm(payload.formId);
        }
    });
}

export const __appShellTestUtils = {
    resetDebugKeySequence() {
        debugKeySequence = [];
    },
    uninstallGlobalListeners
};
