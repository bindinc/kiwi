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

function getElementValue(context, payload, fallbackKey = 'query') {
    if (context && context.element && 'value' in context.element) {
        return context.element.value;
    }
    return payload && payload[fallbackKey] ? payload[fallbackKey] : '';
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
        'filter-articles': (payload, context) => {
            const query = getElementValue(context, payload);
            invokeLegacyAsync('filterArticles', [query]);
        },
        'update-article-price': () => {
            invokeLegacy('updateArticlePrice');
        },
        'add-article-to-order': () => {
            invokeLegacyAsync('addArticleToOrder');
        },
        'apply-coupon': () => {
            invokeLegacyAsync('applyCoupon');
        },
        'apply-coupon-on-enter': (_payload, context) => {
            if (context.event.key !== 'Enter') {
                return;
            }
            context.event.preventDefault();
            invokeLegacyAsync('applyCoupon');
        },
        'show-all-articles': () => {
            invokeLegacyAsync('showAllArticles');
        },
        'select-article': (payload, context) => {
            const articleId = payload.articleId;
            if (articleId === undefined || articleId === null) {
                return;
            }

            if (context.event.type === 'keydown') {
                if (!isActivationKey(context.event)) {
                    return;
                }
                context.event.preventDefault();
            }

            invokeLegacyAsync('selectArticle', [articleId]);
        },
        'filter-modal-articles': (payload, context) => {
            const query = getElementValue(context, payload);
            invokeLegacyAsync('filterModalArticles', [query]);
        },
        'show-article-tab': (payload, context) => {
            if (!payload.tab) {
                return;
            }
            invokeLegacyAsync('showArticleTab', [payload.tab, context.event]);
        },
        'select-article-from-modal': (payload, context) => {
            const articleId = payload.articleId;
            if (articleId === undefined || articleId === null) {
                return;
            }

            if (context.event.type === 'keydown') {
                if (!isActivationKey(context.event)) {
                    return;
                }
                context.event.preventDefault();
            }

            invokeLegacyAsync('selectArticleFromModal', [articleId]);
        },
        'close-all-articles-modal': () => {
            invokeLegacy('closeAllArticlesModal');
        },
        'remove-article-from-order': (payload) => {
            const articleId = payload.articleId;
            if (articleId === undefined || articleId === null) {
                return;
            }
            invokeLegacyAsync('removeArticleFromOrder', [articleId]);
        },
        'remove-coupon': () => {
            invokeLegacyAsync('removeCoupon');
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
