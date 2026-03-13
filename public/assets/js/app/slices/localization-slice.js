import { getGlobalScope } from '../services.js';

const FALLBACK_APP_LOCALE = 'nl';
const DATE_LOCALE_BY_APP_LOCALE = {
    nl: 'nl-NL',
    en: 'en-US'
};

const STATIC_PAGE_TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label'];
const STATIC_PAGE_I18N_ATTRIBUTE_BY_TARGET = {
    placeholder: 'data-i18n-placeholder',
    title: 'data-i18n-title',
    'aria-label': 'data-i18n-aria-label'
};
const STATIC_PAGE_NON_TRANSLATABLE_TAGS = new Set([
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'IFRAME',
    'CODE',
    'PRE',
    'TEXTAREA'
]);

function getI18nApi() {
    const globalScope = getGlobalScope();
    const i18n = globalScope && globalScope.i18n ? globalScope.i18n : null;
    if (!i18n || typeof i18n !== 'object') {
        return null;
    }
    return i18n;
}

function invokeLegacyUiUpdate(methodName) {
    if (!methodName) {
        return;
    }

    const globalScope = getGlobalScope();
    const method = globalScope ? globalScope[methodName] : null;
    if (typeof method !== 'function') {
        return;
    }

    method();
}

export function translate(key, params, fallback) {
    const i18n = getI18nApi();
    if (i18n && typeof i18n.t === 'function') {
        const value = i18n.t(key, params);
        if (value !== undefined && value !== null && value !== key) {
            return value;
        }
    }
    return fallback !== undefined ? fallback : key;
}

export function normalizeStaticLiteral(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

export function shouldTranslateStaticLiteral(value) {
    if (!value) {
        return false;
    }

    if (/\{\{|\}\}|\{%|%\}/.test(value)) {
        return false;
    }

    return /[A-Za-zÀ-ÿ]/.test(value);
}

export function hashStaticLiteral(input) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildStaticLiteralSlug(value) {
    const normalized = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

    const safeNormalized = normalized || 'value';
    return `${safeNormalized.slice(0, 72)}_${hashStaticLiteral(value)}`;
}

export function buildIndexHtmlI18nKey(literal, section = 'text') {
    return `indexHtml.${section}.${buildStaticLiteralSlug(literal)}`;
}

export function applyIndexHtmlTranslations() {
    if (typeof document === 'undefined') {
        return;
    }

    // Prefer explicit data-i18n annotations from index.html so key-to-template
    // relations remain readable and maintainable.
    const textTranslationElements = document.querySelectorAll('[data-i18n]');
    for (const element of textTranslationElements) {
        const i18nKey = element.getAttribute('data-i18n');
        if (!i18nKey) {
            continue;
        }

        const fallback = normalizeStaticLiteral(element.textContent || '');
        element.textContent = translate(i18nKey, {}, fallback || i18nKey);
    }

    for (const attributeName of STATIC_PAGE_TRANSLATABLE_ATTRIBUTES) {
        const i18nAttributeName = STATIC_PAGE_I18N_ATTRIBUTE_BY_TARGET[attributeName];
        if (!i18nAttributeName) {
            continue;
        }

        const elements = document.querySelectorAll(`[${i18nAttributeName}]`);
        for (const element of elements) {
            const i18nKey = element.getAttribute(i18nAttributeName);
            if (!i18nKey) {
                continue;
            }

            const fallback = normalizeStaticLiteral(element.getAttribute(attributeName) || '');
            element.setAttribute(attributeName, translate(i18nKey, {}, fallback || i18nKey));
        }
    }

    if (!document.body || typeof NodeFilter === 'undefined') {
        return;
    }

    // Legacy fallback for static literals that are not yet annotated with data-i18n.
    const textNodes = [];
    const textWalker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (STATIC_PAGE_NON_TRANSLATABLE_TAGS.has(parent.tagName)) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (parent.closest('script, style, noscript, iframe, code, pre, textarea')) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (parent.closest('[data-i18n]')) {
                    return NodeFilter.FILTER_REJECT;
                }

                if (!/\S/.test(node.nodeValue || '')) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    while (textWalker.nextNode()) {
        textNodes.push(textWalker.currentNode);
    }

    for (const textNode of textNodes) {
        const originalValue = textNode.nodeValue || '';
        const normalizedLiteral = normalizeStaticLiteral(originalValue);
        if (!shouldTranslateStaticLiteral(normalizedLiteral)) {
            continue;
        }

        const translatedLiteral = translate(
            buildIndexHtmlI18nKey(normalizedLiteral, 'text'),
            {},
            normalizedLiteral
        );

        if (translatedLiteral === normalizedLiteral) {
            continue;
        }

        const leadingWhitespace = originalValue.match(/^\s*/)?.[0] || '';
        const trailingWhitespace = originalValue.match(/\s*$/)?.[0] || '';
        textNode.nodeValue = `${leadingWhitespace}${translatedLiteral}${trailingWhitespace}`;
    }

    const elements = document.body.querySelectorAll('*');
    for (const element of elements) {
        for (const attributeName of STATIC_PAGE_TRANSLATABLE_ATTRIBUTES) {
            const explicitI18nAttribute = STATIC_PAGE_I18N_ATTRIBUTE_BY_TARGET[attributeName];
            if (explicitI18nAttribute && element.hasAttribute(explicitI18nAttribute)) {
                continue;
            }

            const originalValue = element.getAttribute(attributeName);
            if (!originalValue) {
                continue;
            }

            const normalizedLiteral = normalizeStaticLiteral(originalValue);
            if (!shouldTranslateStaticLiteral(normalizedLiteral)) {
                continue;
            }

            const section = attributeName === 'aria-label' ? 'ariaLabel' : attributeName;
            const translatedLiteral = translate(
                buildIndexHtmlI18nKey(normalizedLiteral, section),
                {},
                normalizedLiteral
            );

            if (translatedLiteral !== normalizedLiteral) {
                element.setAttribute(attributeName, translatedLiteral);
            }
        }
    }
}

export function normalizeAppLocale(locale) {
    if (!locale) {
        return FALLBACK_APP_LOCALE;
    }

    return String(locale).split('-')[0].toLowerCase();
}

export function getAppLocale() {
    const i18n = getI18nApi();
    const i18nLocale = i18n && typeof i18n.getLocale === 'function'
        ? i18n.getLocale()
        : null;
    const availableLocales = i18n && typeof i18n.availableLocales === 'function'
        ? i18n.availableLocales().map((locale) => normalizeAppLocale(locale))
        : [];
    const documentLocale = (typeof document !== 'undefined' && document.documentElement)
        ? document.documentElement.lang
        : null;
    const candidate = normalizeAppLocale(i18nLocale || documentLocale || FALLBACK_APP_LOCALE);

    if (availableLocales.length > 0 && !availableLocales.includes(candidate)) {
        return FALLBACK_APP_LOCALE;
    }

    if (!DATE_LOCALE_BY_APP_LOCALE[candidate]) {
        return FALLBACK_APP_LOCALE;
    }

    return candidate;
}

export function getDateLocaleForApp() {
    const appLocale = getAppLocale();
    return DATE_LOCALE_BY_APP_LOCALE[appLocale] || DATE_LOCALE_BY_APP_LOCALE[FALLBACK_APP_LOCALE];
}

export function setDocumentLocale(locale) {
    if (typeof document === 'undefined' || !document.documentElement) {
        return;
    }

    document.documentElement.lang = normalizeAppLocale(locale);
}

export function updateLocaleMenuSelection() {
    if (typeof document === 'undefined') {
        return;
    }

    const selectedLocale = getAppLocale();
    const localeButtons = document.querySelectorAll('[data-locale-option]');
    localeButtons.forEach((button) => {
        const isCurrentLocale = normalizeAppLocale(button.dataset.localeOption) === selectedLocale;
        button.classList.toggle('is-active', isCurrentLocale);
    });
}

export function applyLocaleToUi(options = {}) {
    const shouldCloseMenu = options.closeMenu === true;
    setDocumentLocale(getAppLocale());
    applyIndexHtmlTranslations();
    invokeLegacyUiUpdate('refreshAgentStatusLabels');
    invokeLegacyUiUpdate('updateAgentStatusDisplay');
    updateLocaleMenuSelection();
    invokeLegacyUiUpdate('updateTime');

    if (shouldCloseMenu) {
        invokeLegacyUiUpdate('closeStatusMenu');
    }
}

export function setAppLocale(locale) {
    const i18n = getI18nApi();
    if (!(i18n && typeof i18n.setLocale === 'function')) {
        return getAppLocale();
    }

    const nextLocale = i18n.setLocale(locale);
    applyLocaleToUi({ closeMenu: true });
    return normalizeAppLocale(nextLocale);
}

export function exposeLocalizationGlobals() {
    const globalScope = getGlobalScope();
    if (!globalScope) {
        return;
    }

    const globalBindings = {
        translate,
        normalizeStaticLiteral,
        shouldTranslateStaticLiteral,
        hashStaticLiteral,
        buildStaticLiteralSlug,
        buildIndexHtmlI18nKey,
        applyIndexHtmlTranslations,
        normalizeAppLocale,
        getAppLocale,
        getDateLocaleForApp,
        setDocumentLocale,
        updateLocaleMenuSelection,
        applyLocaleToUi,
        setAppLocale
    };

    Object.assign(globalScope, globalBindings);
}

export function registerLocalizationSlice(actionRouter) {
    exposeLocalizationGlobals();

    if (!actionRouter || typeof actionRouter.registerMany !== 'function') {
        return;
    }

    actionRouter.registerMany({
        'localization.set-locale'(payload = {}, context = {}) {
            const payloadLocale = typeof payload.locale === 'string' ? payload.locale : '';
            const elementLocale = context.element?.dataset?.localeOption || '';
            const requestedLocale = payloadLocale || elementLocale;
            if (!requestedLocale) {
                return;
            }

            setAppLocale(requestedLocale);
        }
    });
}
