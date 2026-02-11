const DEFAULT_ACTION_EVENTS = ['click', 'change', 'submit', 'keydown'];

function normalizeArgumentKey(rawKey) {
    if (!rawKey) {
        return rawKey;
    }

    return rawKey.charAt(0).toLowerCase() + rawKey.slice(1);
}

function parseActionEventList(rawList) {
    if (!rawList) {
        return null;
    }

    const values = String(rawList)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

    return values.length > 0 ? values : null;
}

function canHandleEventType(actionElement, eventType) {
    const allowedEventTypes = parseActionEventList(actionElement?.dataset?.actionEvent);
    if (!allowedEventTypes) {
        return true;
    }
    return allowedEventTypes.includes(eventType);
}

function findActionElement(target) {
    if (!target || typeof target.closest !== 'function') {
        return null;
    }
    return target.closest('[data-action]');
}

export function coerceActionValue(rawValue) {
    if (rawValue === 'true') return true;
    if (rawValue === 'false') return false;
    if (rawValue === 'null') return null;
    if (rawValue === 'undefined') return undefined;
    if (rawValue === '') return '';

    const numericValue = Number(rawValue);
    if (!Number.isNaN(numericValue) && String(numericValue) === String(rawValue).trim()) {
        return numericValue;
    }

    if (typeof rawValue === 'string' && (rawValue.startsWith('{') || rawValue.startsWith('['))) {
        try {
            return JSON.parse(rawValue);
        } catch (_error) {
            return rawValue;
        }
    }

    return rawValue;
}

export function extractActionPayload(dataset = {}) {
    const payload = {};

    for (const [datasetKey, datasetValue] of Object.entries(dataset)) {
        if (!datasetKey.startsWith('arg')) {
            continue;
        }

        const argumentKey = normalizeArgumentKey(datasetKey.slice(3));
        if (!argumentKey) {
            continue;
        }

        payload[argumentKey] = coerceActionValue(datasetValue);
    }

    return payload;
}

export function createActionRouter(options = {}) {
    const rootNode = options.root || (typeof document !== 'undefined' ? document : null);
    const eventTypes = Array.isArray(options.eventTypes) && options.eventTypes.length > 0
        ? options.eventTypes.slice()
        : DEFAULT_ACTION_EVENTS.slice();
    const sharedContext = options.context && typeof options.context === 'object'
        ? options.context
        : {};
    const onUnhandled = typeof options.onUnhandled === 'function' ? options.onUnhandled : null;
    const handlers = new Map();
    const listenersByEventType = new Map();

    function register(actionName, handler) {
        if (!actionName || typeof handler !== 'function') {
            return;
        }
        handlers.set(actionName, handler);
    }

    function registerMany(actionHandlers = {}) {
        for (const [actionName, handler] of Object.entries(actionHandlers)) {
            register(actionName, handler);
        }
    }

    function unregister(actionName) {
        handlers.delete(actionName);
    }

    function dispatch(event) {
        const actionElement = findActionElement(event?.target);
        if (!actionElement) {
            return false;
        }

        const actionName = actionElement.dataset.action;
        if (!actionName || !canHandleEventType(actionElement, event.type)) {
            return false;
        }

        const handler = handlers.get(actionName);
        if (!handler) {
            if (onUnhandled) {
                onUnhandled(actionName, {
                    event,
                    element: actionElement
                });
            }
            return false;
        }

        if (actionElement.dataset.actionPreventDefault === 'true' && typeof event.preventDefault === 'function') {
            event.preventDefault();
        }
        if (actionElement.dataset.actionStopPropagation === 'true' && typeof event.stopPropagation === 'function') {
            event.stopPropagation();
        }

        const payload = extractActionPayload(actionElement.dataset);
        handler(payload, {
            ...sharedContext,
            actionName,
            event,
            element: actionElement
        });

        return true;
    }

    function install() {
        if (!rootNode || typeof rootNode.addEventListener !== 'function') {
            return;
        }

        if (listenersByEventType.size > 0) {
            return;
        }

        for (const eventType of eventTypes) {
            const listener = (event) => {
                dispatch(event);
            };
            rootNode.addEventListener(eventType, listener);
            listenersByEventType.set(eventType, listener);
        }
    }

    function uninstall() {
        if (!rootNode || typeof rootNode.removeEventListener !== 'function') {
            return;
        }

        for (const [eventType, listener] of listenersByEventType.entries()) {
            rootNode.removeEventListener(eventType, listener);
        }

        listenersByEventType.clear();
    }

    function getRegisteredActions() {
        return Array.from(handlers.keys());
    }

    return {
        dispatch,
        getRegisteredActions,
        install,
        register,
        registerMany,
        unregister,
        uninstall
    };
}
