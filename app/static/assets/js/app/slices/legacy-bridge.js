import { getGlobalScope } from '../services.js';

function resolveLegacyHandler(handlerName) {
    if (typeof handlerName !== 'string' || handlerName.length === 0) {
        return null;
    }

    const globalScope = getGlobalScope();
    if (!globalScope) {
        return null;
    }

    const handler = globalScope[handlerName];
    return typeof handler === 'function' ? handler : null;
}

export function createLegacyBridge(options = {}) {
    const logger = options.logger || (typeof console !== 'undefined' ? console : null);
    const logPrefix = options.logPrefix || '[kiwi-actions]';

    function invoke(handlerName, args = []) {
        const handler = resolveLegacyHandler(handlerName);
        if (!handler) {
            if (logger && typeof logger.warn === 'function') {
                logger.warn(`${logPrefix} Missing legacy handler "${handlerName}"`);
            }
            return;
        }

        handler(...args);
    }

    return {
        invoke
    };
}
