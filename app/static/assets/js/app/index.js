import { createActionRouter } from './actions.js';
import { ensureLegacyAppLoaded } from './legacy-loader.js';
import { getSharedState, markRouterInitialized, setRegisteredActions } from './state.js';

const sharedState = getSharedState();
const actionRouter = createActionRouter({
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

actionRouter.install();
markRouterInitialized();
setRegisteredActions(actionRouter.getRegisteredActions());

if (typeof window !== 'undefined') {
    window.kiwiApp = {
        actionRouter,
        state: sharedState
    };
}

async function bootstrapLegacyApp() {
    try {
        await ensureLegacyAppLoaded();
    } catch (error) {
        console.error('Kon legacy app.js niet laden.', error);
    }
}

void bootstrapLegacyApp();
