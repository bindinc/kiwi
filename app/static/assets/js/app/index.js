import { createActionRouter } from './actions.js';
import { ensureLegacyAppLoaded } from './legacy-loader.js';
import { getGlobalScope } from './services.js';
import { configureAppShellSliceDependencies, registerAppShellSlice } from './slices/app-shell-slice.js';
import { configureOrderSliceDependencies, registerOrderActions } from './slices/order.js';
import { registerArticleSearchSlice } from './slices/article-search-slice.js';
import { installBootstrapSlice } from './slices/bootstrap-slice.js';
import { registerCallQueueAgentStatusSlices } from './slices/index.js';
import { registerCustomerSearchSlice } from './slices/customer-search-slice.js';
import { registerSubscriptionRoleSlice } from './slices/subscription-role-slice.js';
import { registerSubscriptionWorkflowSlice } from './slices/subscription-workflow-slice.js';
import { registerWinbackSlice } from './slices/winback-slice.js';
import { registerLocalizationSlice } from './slices/localization-slice.js';
import { configureContactHistorySliceDependencies, registerContactHistorySlice } from './slices/contact-history-slice.js';
import { configureCustomerDetailSliceDependencies, registerCustomerDetailSlice } from './slices/customer-detail-slice.js';
import { configureDeliveryRemarksSliceDependencies, registerDeliveryRemarksSlice } from './slices/delivery-remarks-slice.js';
import { registerDeliveryDatePickerSlice } from './slices/delivery-date-picker-slice.js';
import { registerWerfsleutelActions } from './slices/werfsleutel.js';
import { registerCustomerSubscriptionActions } from './legacy-actions-customer-subscription.js';
import { getSharedState } from './state.js';

const sharedState = getSharedState();
installBootstrapSlice();
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
