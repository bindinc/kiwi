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

export function registerOrderActions(actionRouter) {
    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'open-article-sale-form': () => {
            invokeLegacy('showArticleSale');
        },
        'close-article-sale-form': () => {
            invokeLegacy('closeForm', ['articleSaleForm']);
        },
        'submit-article-sale-form': (_payload, context) => {
            invokeLegacyAsync('createArticleSale', [context.event]);
        },
        'add-delivery-remark': (payload) => {
            if (!payload.remarkKey) {
                return;
            }
            invokeLegacy('addDeliveryRemarkByKey', [payload.remarkKey]);
        },
        'add-delivery-remark-modal': (payload) => {
            if (!payload.remarkKey) {
                return;
            }
            invokeLegacy('addDeliveryRemarkToModalByKey', [payload.remarkKey]);
        },
        'select-recommended-delivery-date': (_payload, context) => {
            invokeLegacyAsync('selectRecommendedDate', [context.event]);
        },
        'navigate-delivery-calendar': (payload, context) => {
            const direction = Number(payload.direction);
            if (!Number.isFinite(direction) || direction === 0) {
                return;
            }
            invokeLegacyAsync('navigateCalendar', [direction, context.event]);
        },
        'select-delivery-date': (payload, context) => {
            if (!payload.date) {
                return;
            }

            if (context.event.type === 'keydown') {
                if (!isActivationKey(context.event)) {
                    return;
                }
                context.event.preventDefault();
                invokeLegacy('selectDeliveryDateByString', [payload.date]);
                return;
            }

            invokeLegacy('selectDeliveryDateByString', [payload.date, context.event]);
        }
    });
}
