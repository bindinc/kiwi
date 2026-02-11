import { markLegacyScriptLoaded, setLegacyLoadPromise, getSharedState } from './state.js';
import { loadScriptOnce, resolveScriptUrl } from './services.js';

const LEGACY_RUNTIME_SCRIPT_ID = 'kiwi-legacy-call-agent-runtime-script';
const LEGACY_RUNTIME_SCRIPT_RELATIVE_URL = './call-agent-runtime.js';
const LEGACY_SUBSCRIPTION_ROLE_RUNTIME_SCRIPT_ID = 'kiwi-legacy-subscription-role-runtime-script';
const LEGACY_SUBSCRIPTION_ROLE_RUNTIME_SCRIPT_RELATIVE_URL = './subscription-role-runtime.js';

// app.js is no longer loaded here — its state and functions have been moved
// to legacy-app-state.js (ES module) and are installed onto the global scope
// by index.js before runtime scripts execute any functions.

export function ensureRuntimeScriptsLoaded() {
    const sharedState = getSharedState();
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
