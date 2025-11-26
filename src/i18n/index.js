import nl from './nl.js';

const FALLBACK_LOCALE = 'nl';
const LOCALE_STORAGE_KEY = 'kiwi.locale';

const locales = {
    nl
};

function normalizeLocale(locale) {
    if (!locale) return FALLBACK_LOCALE;
    return locale.split('-')[0].toLowerCase();
}

let currentLocale = (() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_STORAGE_KEY) : null;
    const browser = typeof navigator !== 'undefined' ? navigator.language : null;
    const preferred = normalizeLocale(stored || browser);
    return locales[preferred] ? preferred : FALLBACK_LOCALE;
})();

function getMessages(locale) {
    const normalized = normalizeLocale(locale);
    return locales[normalized] || locales[FALLBACK_LOCALE];
}

function resolveKey(path, messages) {
    return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), messages);
}

function interpolate(value, params = {}) {
    if (typeof value !== 'string') {
        return value;
    }

    return value.replace(/\{(\w+)\}/g, (match, key) => {
        if (params[key] === undefined) {
            return match;
        }
        return String(params[key]);
    });
}

function t(key, params, options = {}) {
    const localeToUse = normalizeLocale(options.locale || currentLocale);
    const messages = getMessages(localeToUse);
    const fallbackMessages = getMessages(FALLBACK_LOCALE);

    const value = resolveKey(key, messages);
    const fallbackValue = resolveKey(key, fallbackMessages);

    if (value !== undefined) {
        return interpolate(value, params);
    }
    if (fallbackValue !== undefined) {
        return interpolate(fallbackValue, params);
    }

    return options.fallback !== undefined ? options.fallback : key;
}

function setLocale(locale) {
    const normalized = normalizeLocale(locale);
    if (!locales[normalized]) {
        return currentLocale;
    }

    currentLocale = normalized;

    if (typeof localStorage !== 'undefined') {
        localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
    }

    return currentLocale;
}

function getLocale() {
    return currentLocale;
}

function availableLocales() {
    return Object.keys(locales);
}

const api = {
    t,
    setLocale,
    getLocale,
    availableLocales,
    messages: locales
};

if (typeof window !== 'undefined') {
    window.i18n = api;
}

export { t, setLocale, getLocale, availableLocales };
export default api;
