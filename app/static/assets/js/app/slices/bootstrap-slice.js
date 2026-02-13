import { getGlobalScope } from '../services.js';

const DEFAULT_SEARCH_STATE = Object.freeze({
    results: [],
    currentPage: 1,
    itemsPerPage: 20,
    sortBy: 'name',
    sortOrder: 'asc'
});

const DEFAULT_CONTACT_HISTORY_STATE = Object.freeze({
    currentPage: 1,
    itemsPerPage: 6,
    highlightId: null,
    lastEntry: null
});

const API_ENDPOINTS = Object.freeze({
    bootstrapApiUrl: '/api/v1/bootstrap',
    offersApiUrl: '/api/v1/catalog/offers',
    personsStateApiUrl: '/api/v1/persons/state',
    personsApiUrl: '/api/v1/persons',
    subscriptionsApiUrl: '/api/v1/subscriptions',
    workflowsApiUrl: '/api/v1/workflows',
    mutationsApiUrl: '/api/v1/mutations',
    callQueueApiUrl: '/api/v1/call-queue',
    callSessionApiUrl: '/api/v1/call-session',
    debugResetApiUrl: '/api/v1/debug/reset-poc-state',
    agentStatusApiUrl: '/api/v1/agent-status'
});

function cloneSearchState() {
    return {
        ...DEFAULT_SEARCH_STATE,
        results: []
    };
}

function cloneContactHistoryState() {
    return {
        ...DEFAULT_CONTACT_HISTORY_STATE
    };
}

function resolveLogger(options = {}) {
    if (options.logger && typeof options.logger === 'object') {
        return options.logger;
    }

    if (typeof console !== 'undefined') {
        return console;
    }

    return null;
}

function resolveDocumentRef(documentRef) {
    if (documentRef) {
        return documentRef;
    }

    if (typeof document !== 'undefined') {
        return document;
    }

    return null;
}

function isObject(value) {
    return value !== null && typeof value === 'object';
}

function resolveBootstrapSliceNamespace(options = {}) {
    const namespace = options.namespace;
    if (typeof namespace === 'string' && namespace.length > 0) {
        return namespace;
    }

    return 'kiwiBootstrapSlice';
}

export function createBootstrapSlice(options = {}) {
    const logger = resolveLogger(options);
    let hasInitializedKiwiApplication = false;

    function createInitialAppDataState() {
        return {
            customers: [],
            currentCustomer: null,
            selectedOffer: null,
            searchState: cloneSearchState(),
            contactHistoryState: cloneContactHistoryState(),
            contactHistoryHighlightTimer: null,
            bootstrapState: null
        };
    }

    function getApiEndpoints() {
        return {
            ...API_ENDPOINTS
        };
    }

    function upsertCustomerInCache(customer, state = {}) {
        const hasCustomerId = customer && typeof customer === 'object'
            && customer.id !== undefined
            && customer.id !== null;
        if (!hasCustomerId) {
            return;
        }

        const customers = Array.isArray(state.customers) ? state.customers : [];
        const customerId = Number(customer.id);
        const existingIndex = customers.findIndex((entry) => Number(entry.id) === customerId);
        if (existingIndex >= 0) {
            customers[existingIndex] = customer;
        } else {
            customers.push(customer);
        }

        if (typeof state.setCustomers === 'function') {
            state.setCustomers(customers);
        }

        const hasCurrentCustomer = state.currentCustomer && Number(state.currentCustomer.id) === customerId;
        if (hasCurrentCustomer && typeof state.setCurrentCustomer === 'function') {
            state.setCurrentCustomer(customer);
        }
    }

    async function loadBootstrapState(optionsByCall = {}) {
        const kiwiApi = optionsByCall.kiwiApi;
        const bootstrapApiUrl = optionsByCall.bootstrapApiUrl || API_ENDPOINTS.bootstrapApiUrl;
        const canLoadBootstrapState = kiwiApi && typeof kiwiApi.get === 'function';

        if (!canLoadBootstrapState) {
            return null;
        }

        try {
            return await kiwiApi.get(bootstrapApiUrl);
        } catch (error) {
            if (logger && typeof logger.warn === 'function') {
                logger.warn('Kon bootstrap state niet laden.', error);
            }
            return null;
        }
    }

    function initializeData(optionsByCall = {}) {
        const bootstrapState = optionsByCall.bootstrapState;
        const callQueue = optionsByCall.callQueue;
        const callSession = optionsByCall.callSession;
        const existingWerfsleutelCatalog = Array.isArray(optionsByCall.werfsleutelCatalog)
            ? optionsByCall.werfsleutelCatalog
            : [];
        const hasBootstrapCustomers = bootstrapState && Array.isArray(bootstrapState.customers);

        if (!hasBootstrapCustomers) {
            if (logger && typeof logger.warn === 'function') {
                logger.warn('Bootstrap state ontbreekt; frontend start met lege API-afhankelijke dataset.');
            }
            return {
                customers: [],
                lastCallSession: null,
                serviceNumbers: {},
                werfsleutelChannels: {},
                werfsleutelCatalog: [],
                callQueue,
                callSession
            };
        }

        const nextCallQueue = isObject(bootstrapState.call_queue) && isObject(callQueue)
            ? {
                ...callQueue,
                ...bootstrapState.call_queue
            }
            : callQueue;
        const nextCallSession = isObject(bootstrapState.call_session) && isObject(callSession)
            ? {
                ...callSession,
                ...bootstrapState.call_session
            }
            : callSession;
        const catalogPayload = isObject(bootstrapState.catalog) ? bootstrapState.catalog : {};
        const serviceNumbers = isObject(catalogPayload.serviceNumbers) ? catalogPayload.serviceNumbers : {};
        const werfsleutelChannels = isObject(catalogPayload.werfsleutelChannels)
            ? catalogPayload.werfsleutelChannels
            : {};

        return {
            customers: bootstrapState.customers,
            lastCallSession: bootstrapState.last_call_session || null,
            serviceNumbers,
            werfsleutelChannels,
            werfsleutelCatalog: existingWerfsleutelCatalog,
            callQueue: nextCallQueue,
            callSession: nextCallSession
        };
    }

    function saveCustomers(optionsByCall = {}) {
        const kiwiApi = optionsByCall.kiwiApi;
        const personsStateApiUrl = optionsByCall.personsStateApiUrl || API_ENDPOINTS.personsStateApiUrl;
        const customers = Array.isArray(optionsByCall.customers) ? optionsByCall.customers : [];
        const canSaveCustomers = kiwiApi && typeof kiwiApi.put === 'function';

        if (!canSaveCustomers) {
            return;
        }

        kiwiApi.put(personsStateApiUrl, { customers }).catch((error) => {
            if (logger && typeof logger.error === 'function') {
                logger.error('Kon klantstaat niet opslaan via API', error);
            }
        });
    }

    function updateCustomerActionButtons(optionsByCall = {}) {
        const documentRef = resolveDocumentRef(optionsByCall.documentRef);
        if (!documentRef || typeof documentRef.getElementById !== 'function') {
            return;
        }

        const hasCustomer = optionsByCall.currentCustomer !== null;
        const resendButton = documentRef.getElementById('resendMagazineBtn');
        const winbackButton = documentRef.getElementById('winbackFlowBtn');

        if (resendButton) {
            resendButton.style.display = hasCustomer ? 'inline-flex' : 'none';
        }
        if (winbackButton) {
            winbackButton.style.display = hasCustomer ? 'inline-flex' : 'none';
        }
    }

    function updateTime(optionsByCall = {}) {
        const documentRef = resolveDocumentRef(optionsByCall.documentRef);
        if (!documentRef || typeof documentRef.getElementById !== 'function') {
            return;
        }

        const currentTimeElement = documentRef.getElementById('currentTime');
        if (!currentTimeElement) {
            return;
        }

        const resolveDateLocale = typeof optionsByCall.getDateLocaleForApp === 'function'
            ? optionsByCall.getDateLocaleForApp
            : () => 'nl-NL';
        const now = new Date();
        const locale = resolveDateLocale();
        const timeString = now.toLocaleTimeString(locale, {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        const dateString = now.toLocaleDateString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        currentTimeElement.textContent = `${dateString} - ${timeString}`;
    }

    async function initializeKiwiApplication(dependencies = {}) {
        if (hasInitializedKiwiApplication) {
            return;
        }
        hasInitializedKiwiApplication = true;

        if (typeof dependencies.applyLocaleToUi === 'function') {
            dependencies.applyLocaleToUi();
        }
        if (typeof dependencies.loadBootstrapState === 'function') {
            await dependencies.loadBootstrapState();
        }
        if (typeof dependencies.initializeData === 'function') {
            dependencies.initializeData();
        }
        if (typeof dependencies.initializeQueue === 'function') {
            dependencies.initializeQueue();
        }
        if (typeof dependencies.updateTime === 'function') {
            dependencies.updateTime();
        }
        if (typeof dependencies.setInterval === 'function' && typeof dependencies.updateTime === 'function') {
            dependencies.setInterval(dependencies.updateTime, 1000);
        }
        if (typeof dependencies.updateCustomerActionButtons === 'function') {
            dependencies.updateCustomerActionButtons();
        }
        if (typeof dependencies.populateBirthdayFields === 'function') {
            dependencies.populateBirthdayFields('article');
            dependencies.populateBirthdayFields('edit');
        }
        if (typeof dependencies.initDeliveryDatePicker === 'function') {
            dependencies.initDeliveryDatePicker();
        }
        if (typeof dependencies.initArticleSearch === 'function') {
            dependencies.initArticleSearch();
        }
        if (typeof dependencies.initWerfsleutelPicker === 'function') {
            Promise.resolve(dependencies.initWerfsleutelPicker()).catch((error) => {
                if (logger && typeof logger.error === 'function') {
                    logger.error('Kon werfsleutels niet initialiseren', error);
                }
            });
        }
        if (typeof dependencies.startAgentWorkSessionTimer === 'function') {
            dependencies.startAgentWorkSessionTimer();
        }
        if (typeof dependencies.updateAgentStatusDisplay === 'function') {
            dependencies.updateAgentStatusDisplay();
        }
        if (typeof dependencies.initializeAgentStatusFromBackend === 'function') {
            dependencies.initializeAgentStatusFromBackend();
        }

        const documentRef = resolveDocumentRef(dependencies.documentRef);
        const canSetAdditionalFilters = documentRef
            && typeof documentRef.getElementById === 'function'
            && typeof dependencies.setAdditionalFiltersOpen === 'function';
        if (!canSetAdditionalFilters) {
            return;
        }

        const advancedFilterIds = ['searchName', 'searchPhone', 'searchEmail'];
        const hasAdvancedValues = advancedFilterIds.some((id) => {
            const input = documentRef.getElementById(id);
            return input && typeof input.value === 'string' && input.value.trim().length > 0;
        });
        dependencies.setAdditionalFiltersOpen(hasAdvancedValues);
    }

    function installInitializationHook(optionsByCall = {}) {
        const initialize = typeof optionsByCall.initializeKiwiApplication === 'function'
            ? optionsByCall.initializeKiwiApplication
            : () => initializeKiwiApplication(optionsByCall.dependencies || {});
        const documentRef = resolveDocumentRef(optionsByCall.documentRef);

        if (!documentRef || typeof documentRef.addEventListener !== 'function') {
            return;
        }

        if (documentRef.readyState === 'loading') {
            documentRef.addEventListener('DOMContentLoaded', () => {
                void initialize();
            }, { once: true });
            return;
        }

        void initialize();
    }

    function resetForTests() {
        hasInitializedKiwiApplication = false;
    }

    return {
        createInitialAppDataState,
        getApiEndpoints,
        upsertCustomerInCache,
        loadBootstrapState,
        initializeData,
        saveCustomers,
        updateCustomerActionButtons,
        updateTime,
        initializeKiwiApplication,
        installInitializationHook,
        resetForTests
    };
}

export function installBootstrapSlice(options = {}) {
    const namespace = resolveBootstrapSliceNamespace(options);
    const globalScope = options.globalScope || getGlobalScope();
    const existingSlice = globalScope ? globalScope[namespace] : null;
    const hasExistingSlice = existingSlice && typeof existingSlice.initializeKiwiApplication === 'function';
    if (hasExistingSlice) {
        return existingSlice;
    }

    const slice = createBootstrapSlice(options);
    if (globalScope) {
        globalScope[namespace] = slice;
    }
    return slice;
}
