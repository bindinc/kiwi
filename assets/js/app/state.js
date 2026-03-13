const sharedState = {
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

export function resetSharedStateForTests() {
    sharedState.legacy.scriptLoaded = false;
    sharedState.legacy.loadPromise = null;
}
