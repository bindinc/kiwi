import { markLegacyScriptLoaded, setLegacyLoadPromise, getSharedState } from './state.js';
import { getGlobalScope, loadScriptOnce, resolveScriptUrl } from './services.js';

const LEGACY_SCRIPT_ID = 'kiwi-legacy-app-script';
const LEGACY_SCRIPT_RELATIVE_URL = '../app.js';

function notifyLegacyReady() {
    const globalScope = getGlobalScope();
    if (!globalScope || typeof globalScope.dispatchEvent !== 'function') {
        return;
    }

    try {
        globalScope.dispatchEvent(new CustomEvent('kiwi:legacy-ready'));
    } catch (_error) {
        // Keep bootstrap resilient even where CustomEvent is unavailable.
    }
}

export function ensureLegacyAppLoaded() {
    const sharedState = getSharedState();
    if (sharedState.legacy.scriptLoaded) {
        return Promise.resolve();
    }

    if (sharedState.legacy.loadPromise) {
        return sharedState.legacy.loadPromise;
    }

    const legacyScriptUrl = resolveScriptUrl(LEGACY_SCRIPT_RELATIVE_URL);
    const loadPromise = loadScriptOnce({
        id: LEGACY_SCRIPT_ID,
        url: legacyScriptUrl
    }).then(() => {
        markLegacyScriptLoaded();
        notifyLegacyReady();
    });

    setLegacyLoadPromise(loadPromise);
    return loadPromise;
}
