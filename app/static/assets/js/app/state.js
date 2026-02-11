const sharedState = {
    router: {
        initialized: false,
        registeredActions: []
    },
    legacy: {
        scriptLoaded: false,
        loadPromise: null
    }
};

export function getSharedState() {
    return sharedState;
}

export function setLegacyLoadPromise(loadPromise) {
    sharedState.legacy.loadPromise = loadPromise;
}

export function markLegacyScriptLoaded() {
    sharedState.legacy.scriptLoaded = true;
}

export function setRegisteredActions(actions) {
    sharedState.router.registeredActions = Array.isArray(actions) ? actions.slice() : [];
}

export function markRouterInitialized() {
    sharedState.router.initialized = true;
}

export function resetSharedStateForTests() {
    sharedState.router.initialized = false;
    sharedState.router.registeredActions = [];
    sharedState.legacy.scriptLoaded = false;
    sharedState.legacy.loadPromise = null;
}
