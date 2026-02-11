import { createActionRouter } from './actions.js';
import { ensureLegacyAppLoaded } from './legacy-loader.js';
import { getSharedState } from './state.js';

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

async function bootstrapLegacyApp() {
    try {
        await ensureLegacyAppLoaded();
    } catch (error) {
        console.error('Kon legacy app.js niet laden.', error);
    }
}

void bootstrapLegacyApp();
