import i18n from './index.js';

const ATTRIBUTE_BINDINGS = [
    { keyAttribute: 'data-i18n-placeholder', targetAttribute: 'placeholder' },
    { keyAttribute: 'data-i18n-title', targetAttribute: 'title' },
    { keyAttribute: 'data-i18n-aria-label', targetAttribute: 'aria-label' }
];

function normalizeFallback(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function applyStaticPageTranslations(root = document) {
    const textElements = root.querySelectorAll('[data-i18n]');
    for (const element of textElements) {
        const key = element.getAttribute('data-i18n');
        if (!key) {
            continue;
        }

        const fallback = normalizeFallback(element.textContent);
        element.textContent = i18n.t(key, {}, { fallback: fallback || key });
    }

    for (const binding of ATTRIBUTE_BINDINGS) {
        const attributeElements = root.querySelectorAll(`[${binding.keyAttribute}]`);
        for (const element of attributeElements) {
            const key = element.getAttribute(binding.keyAttribute);
            if (!key) {
                continue;
            }

            const fallback = normalizeFallback(element.getAttribute(binding.targetAttribute));
            const translatedValue = i18n.t(key, {}, { fallback: fallback || key });
            element.setAttribute(binding.targetAttribute, translatedValue);
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyStaticPageTranslations());
} else {
    applyStaticPageTranslations();
}
