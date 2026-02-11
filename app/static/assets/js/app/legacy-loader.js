import { markLegacyScriptLoaded, setLegacyLoadPromise, getSharedState } from './state.js';
import { loadScriptOnce, resolveScriptUrl } from './services.js';

const LEGACY_SCRIPT_ID = 'kiwi-legacy-app-script';
const LEGACY_SCRIPT_RELATIVE_URL = '../app.js';

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
    });

    setLegacyLoadPromise(loadPromise);
    return loadPromise;
}
