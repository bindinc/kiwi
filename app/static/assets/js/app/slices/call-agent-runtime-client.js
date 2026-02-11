import { getGlobalScope } from '../services.js';

const RUNTIME_NAMESPACE = 'kiwiCallAgentRuntime';

function resolveRuntimeMethod(methodName) {
    if (typeof methodName !== 'string' || methodName.length === 0) {
        return null;
    }

    const globalScope = getGlobalScope();
    if (!globalScope) {
        return null;
    }

    const runtimeNamespace = globalScope[RUNTIME_NAMESPACE];
    if (runtimeNamespace && typeof runtimeNamespace[methodName] === 'function') {
        return runtimeNamespace[methodName].bind(runtimeNamespace);
    }

    const fallbackMethod = globalScope[methodName];
    if (typeof fallbackMethod === 'function') {
        return fallbackMethod;
    }

    return null;
}

export function createCallAgentRuntimeClient(options = {}) {
    const logger = options.logger || (typeof console !== 'undefined' ? console : null);
    const logPrefix = options.logPrefix || '[kiwi-actions]';

    function invoke(methodName, args = []) {
        const runtimeMethod = resolveRuntimeMethod(methodName);
        if (!runtimeMethod) {
            if (logger && typeof logger.warn === 'function') {
                logger.warn(`${logPrefix} Missing call-agent runtime handler "${methodName}"`);
            }
            return;
        }

        runtimeMethod(...args);
    }

    return {
        acceptNextCall() {
            invoke('acceptNextCall');
        },
        cancelDisposition() {
            invoke('cancelDisposition');
        },
        closeDebugModal() {
            invoke('closeDebugModal');
        },
        debugClearQueue() {
            invoke('debugClearQueue');
        },
        debugEndCall() {
            invoke('debugEndCall');
        },
        debugGenerateQueue() {
            invoke('debugGenerateQueue');
        },
        debugStartCall() {
            invoke('debugStartCall');
        },
        endCallSession() {
            invoke('endCallSession');
        },
        fullReset() {
            invoke('fullReset');
        },
        identifyCallerAsCustomer(customerId) {
            invoke('identifyCallerAsCustomer', [customerId]);
        },
        identifyCurrentCustomerAsCaller() {
            invoke('identifyCurrentCustomerAsCaller');
        },
        manualFinishACW() {
            invoke('manualFinishACW');
        },
        saveDisposition() {
            invoke('saveDisposition');
        },
        setAgentStatus(status) {
            invoke('setAgentStatus', [status]);
        },
        toggleCallHold() {
            invoke('toggleCallHold');
        },
        toggleFollowUpSection() {
            invoke('toggleFollowUpSection');
        },
        toggleKnownCallerSelect() {
            invoke('toggleKnownCallerSelect');
        },
        toggleStatusMenu(event) {
            invoke('toggleStatusMenu', [event]);
        },
        updateDispositionOutcomes() {
            invoke('updateDispositionOutcomes');
        }
    };
}
