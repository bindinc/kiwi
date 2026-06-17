const VOLATILE_CLASS_PATTERN = /^(active|busy|checked|current|disabled|enabled|error|focus|focused|hidden|hover|invalid|loading|open|selected|show|success|valid)$/i;
const GENERATED_VALUE_PATTERN = /(^\d+$|[a-f0-9]{8,}|^ember\d+|^react-|^vue-|generated|random|uuid)/i;

export function describeElement(element, documentRef = document) {
    const tag = element.tagName.toLowerCase();
    const label = resolveElementLabel(element, documentRef) || tag;
    const textSample = normalizeText(element.textContent || '').slice(0, 120) || null;

    return {
        tag,
        label,
        selector: generateStableSelector(element, documentRef),
        textSample
    };
}

export function generateStableSelector(element, documentRef = document) {
    const dataSelector = selectorFromDataAttribute(element, documentRef);
    if (dataSelector) {
        return dataSelector;
    }

    const idSelector = selectorFromId(element, documentRef);
    if (idSelector) {
        return idSelector;
    }

    const semanticSelector = selectorFromSemanticAttribute(element, documentRef);
    if (semanticSelector) {
        return semanticSelector;
    }

    return selectorFromPath(element, documentRef);
}

export function resolveElementLabel(element, documentRef = document) {
    for (const attributeName of ['aria-label', 'title', 'alt', 'name', 'placeholder']) {
        const value = normalizeText(element.getAttribute(attributeName) || '');
        if (value) {
            return value.slice(0, 120);
        }
    }

    const labelledBy = element.getAttribute('aria-labelledby');
    if (labelledBy) {
        const label = labelledBy
            .split(/\s+/)
            .map((id) => documentRef.getElementById(id))
            .filter(Boolean)
            .map((node) => normalizeText(node.textContent || ''))
            .filter(Boolean)
            .join(' ');
        if (label) {
            return label.slice(0, 120);
        }
    }

    if (element.id) {
        const labelElement = documentRef.querySelector(`label[for="${cssEscape(element.id)}"]`);
        const label = normalizeText(labelElement?.textContent || '');
        if (label) {
            return label.slice(0, 120);
        }
    }

    const wrappingLabel = element.closest('label');
    const wrappedText = normalizeText(wrappingLabel?.textContent || '');
    if (wrappedText) {
        return wrappedText.slice(0, 120);
    }

    const text = normalizeText(element.textContent || '');
    return text ? text.slice(0, 120) : '';
}

function selectorFromDataAttribute(element, documentRef) {
    for (const attributeName of ['data-feedback-id', 'data-testid']) {
        const value = normalizeText(element.getAttribute(attributeName) || '');
        if (!value) {
            continue;
        }

        const selector = `[${attributeName}="${cssEscape(value)}"]`;
        if (isUniqueSelector(selector, documentRef)) {
            return selector;
        }
    }

    return null;
}

function selectorFromId(element, documentRef) {
    const id = normalizeText(element.id || '');
    if (!id || GENERATED_VALUE_PATTERN.test(id)) {
        return null;
    }

    const selector = `#${cssEscape(id)}`;
    return isUniqueSelector(selector, documentRef) ? selector : null;
}

function selectorFromSemanticAttribute(element, documentRef) {
    const tag = element.tagName.toLowerCase();
    const attributes = ['name', 'aria-label', 'role'];

    for (const attributeName of attributes) {
        const value = normalizeText(element.getAttribute(attributeName) || '');
        if (!value || GENERATED_VALUE_PATTERN.test(value)) {
            continue;
        }

        const selector = `${tag}[${attributeName}="${cssEscape(value)}"]`;
        if (isUniqueSelector(selector, documentRef)) {
            return selector;
        }
    }

    return null;
}

function selectorFromPath(element, documentRef) {
    const parts = [];
    let current = element;

    while (current && current.nodeType === 1 && current !== documentRef.body && current !== documentRef.documentElement) {
        const part = selectorPartForElement(current);
        parts.unshift(part);
        const selector = parts.join(' > ');
        if (isUniqueSelector(selector, documentRef)) {
            return selector;
        }

        current = current.parentElement;
    }

    return parts.join(' > ') || element.tagName.toLowerCase();
}

function selectorPartForElement(element) {
    const tag = element.tagName.toLowerCase();
    const stableClasses = Array.from(element.classList || [])
        .filter((className) => !VOLATILE_CLASS_PATTERN.test(className))
        .filter((className) => !GENERATED_VALUE_PATTERN.test(className))
        .slice(0, 2);

    if (stableClasses.length > 0) {
        return `${tag}.${stableClasses.map(cssEscape).join('.')}`;
    }

    const index = nthOfType(element);
    return index > 1 ? `${tag}:nth-of-type(${index})` : tag;
}

function nthOfType(element) {
    let index = 1;
    let sibling = element.previousElementSibling;
    const tag = element.tagName;

    while (sibling) {
        if (sibling.tagName === tag) {
            index += 1;
        }
        sibling = sibling.previousElementSibling;
    }

    return index;
}

function isUniqueSelector(selector, documentRef) {
    try {
        return documentRef.querySelectorAll(selector).length === 1;
    } catch {
        return false;
    }
}

function normalizeText(value) {
    return value.replace(/\s+/g, ' ').trim();
}

function cssEscape(value) {
    if (globalThis.CSS && typeof globalThis.CSS.escape === 'function') {
        return globalThis.CSS.escape(value);
    }

    return String(value).replace(/["\\#.:,[\]>+~*^$|=()]/g, '\\$&');
}
