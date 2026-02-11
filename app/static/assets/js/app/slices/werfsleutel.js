function getGlobalScope() {
    if (typeof window !== 'undefined') {
        return window;
    }

    if (typeof globalThis !== 'undefined') {
        return globalThis;
    }

    return null;
}

function getLegacyFunction(functionName) {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return null;
    }

    const candidate = globalScope[functionName];
    if (typeof candidate !== 'function') {
        return null;
    }

    return candidate;
}

function invokeLegacy(functionName, args = []) {
    const legacyFunction = getLegacyFunction(functionName);
    if (!legacyFunction) {
        return;
    }
    legacyFunction(...args);
}

function invokeLegacyAsync(functionName, args = []) {
    const legacyFunction = getLegacyFunction(functionName);
    if (!legacyFunction) {
        return;
    }

    Promise.resolve(legacyFunction(...args)).catch((error) => {
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
            console.error(`[kiwi-actions] Action "${functionName}" failed.`, error);
        }
    });
}

function isActivationKey(event) {
    return event && (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar');
}

export function registerWerfsleutelActions(actionRouter) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'handle-werfsleutel-input': (_payload, context) => {
            if (!context.event || !context.element) {
                return;
            }

            if (context.event.type === 'input') {
                invokeLegacy('handleWerfsleutelQuery', [context.element.value || '']);
                return;
            }

            if (context.event.type === 'keydown') {
                invokeLegacyAsync('handleWerfsleutelInputKeyDown', [context.event]);
            }
        },
        'reset-werfsleutel-picker': () => {
            invokeLegacy('resetWerfsleutelPicker');
        },
        'select-werfsleutel': (payload, context) => {
            if (!payload.salesCode) {
                return;
            }

            if (context.event.type === 'keydown') {
                if (!isActivationKey(context.event)) {
                    return;
                }
                context.event.preventDefault();
            }

            invokeLegacy('selectWerfsleutel', [payload.salesCode]);
        },
        'select-werfsleutel-channel': (payload) => {
            if (!payload.channelCode) {
                return;
            }
            invokeLegacy('selectWerfsleutelChannel', [payload.channelCode]);
        }
    });
}
