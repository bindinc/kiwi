(() => {
    const STORAGE_KEY = 'kiwi.featureFlags';
    const QUERY_PREFIX = 'ff-';

    const defaults = {
        debugModal: true
    };

    const parseBoolean = (value) => {
        if (value === null || value === undefined) {
            return null;
        }

        const normalized = String(value).trim().toLowerCase();
        if (normalized === '') {
            return true;
        }

        const truthyValues = ['1', 'true', 'yes', 'on'];
        if (truthyValues.includes(normalized)) {
            return true;
        }

        const falsyValues = ['0', 'false', 'no', 'off'];
        if (falsyValues.includes(normalized)) {
            return false;
        }

        return null;
    };

    const readStoredFlags = () => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return {};
            }

            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') {
                return {};
            }

            return parsed;
        } catch (error) {
            return {};
        }
    };

    const readQueryFlags = () => {
        if (!window.location || !window.location.search) {
            return {};
        }

        const params = new URLSearchParams(window.location.search);
        const flags = {};

        for (const [key, value] of params.entries()) {
            if (!key.startsWith(QUERY_PREFIX)) {
                continue;
            }

            const name = key.slice(QUERY_PREFIX.length);
            if (!name) {
                continue;
            }

            const parsedValue = parseBoolean(value);
            if (parsedValue === null) {
                continue;
            }

            flags[name] = parsedValue;
        }

        return flags;
    };

    let storedFlags = readStoredFlags();
    const queryFlags = readQueryFlags();

    const resolveFlags = () => ({
        ...defaults,
        ...storedFlags,
        ...queryFlags
    });

    const persistStoredFlags = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(storedFlags));
        } catch (error) {
            // Ignore storage errors (e.g. private mode).
        }
    };

    const isEnabled = (name) => {
        const flags = resolveFlags();
        return Boolean(flags[name]);
    };

    const setFlag = (name, value) => {
        const parsedValue = parseBoolean(value);
        if (parsedValue === null) {
            if (Object.prototype.hasOwnProperty.call(storedFlags, name)) {
                const { [name]: _unused, ...rest } = storedFlags;
                storedFlags = rest;
                persistStoredFlags();
            }
            return;
        }

        storedFlags = {
            ...storedFlags,
            [name]: parsedValue
        };
        persistStoredFlags();
    };

    const list = () => resolveFlags();

    window.featureFlags = {
        defaults,
        isEnabled,
        list,
        setFlag
    };
})();
