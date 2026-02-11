import { createActionRouter } from './actions.js';
import { ensureLegacyAppLoaded } from './legacy-loader.js';
import { registerOrderActions } from './slices/order.js';
import { registerCallQueueAgentStatusSlices } from './slices/index.js';
import { registerWerfsleutelActions } from './slices/werfsleutel.js';
import { registerCustomerSubscriptionActions } from './legacy-actions-customer-subscription.js';
import { getSharedState } from './state.js';

const sharedState = getSharedState();
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

registerOrderActions(actionRouter);
registerWerfsleutelActions(actionRouter);
registerCallQueueAgentStatusSlices(actionRouter);
registerCustomerSubscriptionActions(actionRouter);
actionRouter.install();

async function bootstrapLegacyApp() {
    try {
        await ensureLegacyAppLoaded();
    } catch (error) {
        console.error('Kon legacy app.js niet laden.', error);
    }
}

void bootstrapLegacyApp();
