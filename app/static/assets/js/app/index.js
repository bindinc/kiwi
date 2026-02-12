import { createActionRouter } from './actions.js';
import { getDispositionCategories } from './disposition-categories.js';
import { installLegacyAppState, applyBootstrapData, legacyState } from './legacy-app-state.js';
import { getGlobalScope, loadScriptOnce, resolveScriptUrl } from './services.js';
import { configureAppShellSliceDependencies, registerAppShellSlice, showToast } from './slices/app-shell-slice.js';
import { configureOrderSliceDependencies, registerOrderActions } from './slices/order.js';
import { registerArticleSearchSlice, initArticleSearch } from './slices/article-search-slice.js';
import { installBootstrapSlice } from './slices/bootstrap-slice.js';
import { registerCallQueueAgentStatusSlices } from './slices/index.js';
import { registerCustomerSearchSlice, setAdditionalFiltersOpen } from './slices/customer-search-slice.js';
import { registerSubscriptionRoleSlice } from './slices/subscription-role-slice.js';
import { registerSubscriptionWorkflowSlice } from './slices/subscription-workflow-slice.js';
import { registerWinbackSlice } from './slices/winback-slice.js';
import { registerLocalizationSlice, applyLocaleToUi, getDateLocaleForApp } from './slices/localization-slice.js';
import { addContactMoment, configureContactHistorySliceDependencies, registerContactHistorySlice } from './slices/contact-history-slice.js';
import { configureCustomerDetailSliceDependencies, registerCustomerDetailSlice, selectCustomer } from './slices/customer-detail-slice.js';
import { configureDeliveryRemarksSliceDependencies, registerDeliveryRemarksSlice } from './slices/delivery-remarks-slice.js';
import { registerDeliveryDatePickerSlice, initDeliveryDatePicker } from './slices/delivery-date-picker-slice.js';
import { registerMutationWorkboxSlice } from './slices/mutation-workbox-slice.js';
import { registerWerfsleutelActions } from './slices/werfsleutel.js';
import { getSharedState, markLegacyScriptLoaded, setLegacyLoadPromise } from './state.js';
import { installLegacySubscriptionHelpers } from './subscription-shared-helpers.js';

const sharedState = getSharedState();
const LEGACY_RUNTIME_SCRIPT_ID = 'kiwi-legacy-call-agent-runtime-script';
const LEGACY_RUNTIME_SCRIPT_RELATIVE_URL = './call-agent-runtime.js';
const LEGACY_SUBSCRIPTION_ROLE_RUNTIME_SCRIPT_ID = 'kiwi-legacy-subscription-role-runtime-script';
const LEGACY_SUBSCRIPTION_ROLE_RUNTIME_SCRIPT_RELATIVE_URL = './subscription-role-runtime.js';

installLegacySubscriptionHelpers(globalThis);
const bootstrapSlice = installBootstrapSlice();

// Install state and globals from legacy-app-state.js onto window BEFORE
// runtime scripts load, so their function bodies can resolve bare identifiers.
installLegacyAppState();

function ensureRuntimeScriptsLoaded() {
    if (sharedState.legacy.scriptLoaded) {
        return Promise.resolve();
    }

    if (sharedState.legacy.loadPromise) {
        return sharedState.legacy.loadPromise;
    }

    const runtimeUrl = resolveScriptUrl(LEGACY_RUNTIME_SCRIPT_RELATIVE_URL);
    const roleRuntimeUrl = resolveScriptUrl(LEGACY_SUBSCRIPTION_ROLE_RUNTIME_SCRIPT_RELATIVE_URL);

    const loadPromise = loadScriptOnce({
        id: LEGACY_RUNTIME_SCRIPT_ID,
        url: runtimeUrl
    })
        .then(() => loadScriptOnce({
            id: LEGACY_SUBSCRIPTION_ROLE_RUNTIME_SCRIPT_ID,
            url: roleRuntimeUrl
        }))
        .then(() => {
            markLegacyScriptLoaded();
        });

    setLegacyLoadPromise(loadPromise);
    return loadPromise;
}

const actionRouter = createActionRouter({
    eventTypes: ['click', 'change', 'submit', 'keydown', 'input'],
    context: {
        sharedState
    },
    onUnhandled(actionName, context) {
        if (typeof console === 'undefined' || typeof console.debug !== 'function') {
            return;
        }
        console.debug(`[kiwi-actions] Unhandled action "${actionName}"`, context.element);
    }
});

function createLegacySliceDependenciesResolver(providerKey) {
    return () => {
        const globalScope = getGlobalScope();
        const legacySliceDependencies = globalScope && typeof globalScope.kiwiLegacySliceDependencies === 'object'
            ? globalScope.kiwiLegacySliceDependencies
            : null;
        if (!legacySliceDependencies) {
            return null;
        }

        const provider = legacySliceDependencies[providerKey];
        if (typeof provider !== 'function') {
            return null;
        }

        const dependencies = provider();
        if (!dependencies || typeof dependencies !== 'object') {
            return null;
        }

        return dependencies;
    };
}

const resolveCustomerDetailSliceDependencies = createLegacySliceDependenciesResolver('getCustomerDetailSliceDependencies');
configureContactHistorySliceDependencies(resolveCustomerDetailSliceDependencies);
configureCustomerDetailSliceDependencies(resolveCustomerDetailSliceDependencies);
configureOrderSliceDependencies(createLegacySliceDependenciesResolver('getOrderSliceDependencies'));
configureDeliveryRemarksSliceDependencies(createLegacySliceDependenciesResolver('getDeliveryRemarksSliceDependencies'));
configureAppShellSliceDependencies(createLegacySliceDependenciesResolver('getAppShellSliceDependencies'));

registerOrderActions(actionRouter);
registerArticleSearchSlice(actionRouter);
registerDeliveryRemarksSlice(actionRouter);
registerAppShellSlice(actionRouter);
registerDeliveryDatePickerSlice(actionRouter);
registerLocalizationSlice(actionRouter);
registerContactHistorySlice(actionRouter);
registerCustomerDetailSlice(actionRouter);
registerWerfsleutelActions(actionRouter);
registerCallQueueAgentStatusSlices(actionRouter);
registerCustomerSearchSlice(actionRouter);
registerSubscriptionRoleSlice(actionRouter);
registerSubscriptionWorkflowSlice(actionRouter);
registerWinbackSlice(actionRouter);
registerMutationWorkboxSlice(actionRouter);
actionRouter.install();

function wireCallAgentRuntimeDependencies() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    const runtimeApi = globalScope.kiwiCallAgentRuntime;
    const canConfigure = runtimeApi && typeof runtimeApi.configureDependencies === 'function';
    if (!canConfigure) {
        return;
    }

    runtimeApi.configureDependencies({
        addContactMoment(customerId, type, description) {
            return addContactMoment(customerId, type, description) || null;
        },
        getDispositionCategories,
        async selectCustomer(customerId) {
            await selectCustomer(customerId);
        },
        showToast
    });
}

// ---------------------------------------------------------------------------
// Bootstrap initialization — previously triggered by app.js, now owned here.
// ---------------------------------------------------------------------------

async function runBootstrapInitialization() {
    const globalScope = getGlobalScope();

    // Resolve dependencies from global scope (runtime script functions are
    // available as globals after ensureRuntimeScriptsLoaded completes).
    const resolve = (name) => (globalScope && typeof globalScope[name] === 'function') ? globalScope[name] : undefined;

    await bootstrapSlice.initializeKiwiApplication({
        applyLocaleToUi,
        async loadBootstrapState() {
            legacyState.bootstrapState = await bootstrapSlice.loadBootstrapState({
                kiwiApi: globalScope?.kiwiApi,
                bootstrapApiUrl: '/api/v1/bootstrap'
            });
        },
        initializeData() {
            const result = bootstrapSlice.initializeData({
                bootstrapState: legacyState.bootstrapState,
                callQueue: legacyState.callQueue,
                callSession: legacyState.callSession,
                werfsleutelCatalog: []
            });
            applyBootstrapData(result);
        },
        initializeQueue: resolve('initializeQueue'),
        updateTime() {
            bootstrapSlice.updateTime({
                documentRef: document,
                getDateLocaleForApp
            });
        },
        setInterval: (cb, ms) => globalScope.setInterval(cb, ms),
        updateCustomerActionButtons() {
            bootstrapSlice.updateCustomerActionButtons({
                documentRef: document,
                currentCustomer: legacyState.currentCustomer
            });
        },
        populateBirthdayFields: resolve('populateBirthdayFields'),
        initDeliveryDatePicker,
        initArticleSearch,
        async initWerfsleutelPicker() {
            const api = globalScope?.kiwiWerfsleutelSlice;
            if (api && typeof api.initializePicker === 'function') {
                await api.initializePicker();
            }
        },
        startAgentWorkSessionTimer: resolve('startAgentWorkSessionTimer'),
        updateAgentStatusDisplay: resolve('updateAgentStatusDisplay'),
        initializeAgentStatusFromBackend: resolve('initializeAgentStatusFromBackend'),
        setAdditionalFiltersOpen,
        documentRef: document
    });
}

async function bootstrapApplication() {
    try {
        await ensureRuntimeScriptsLoaded();
        wireCallAgentRuntimeDependencies();
        await runBootstrapInitialization();
    } catch (error) {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error('Kon applicatie niet volledig initialiseren.', error);
        }
    }
}

void bootstrapApplication();
