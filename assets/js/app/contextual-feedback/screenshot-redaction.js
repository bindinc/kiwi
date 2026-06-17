const ELEMENT_NODE = 1;

const IGNORED_SELECTOR = '[data-feedback-ignore]';
const REDACTED_ELEMENT_SELECTOR = '[data-feedback-mask]';
const MEDIA_TAGS = new Set(['CANVAS', 'EMBED', 'IFRAME', 'IMG', 'OBJECT', 'PICTURE', 'SVG', 'VIDEO']);
const FORM_FIELD_TAGS = new Set(['INPUT', 'OPTION', 'SELECT', 'TEXTAREA']);
const CHECKABLE_INPUT_TYPES = new Set(['checkbox', 'radio']);

const REDACTION_STYLES = `
    *, *::before, *::after {
        color: transparent !important;
        text-shadow: none !important;
        -webkit-text-fill-color: transparent !important;
        -webkit-text-stroke-color: transparent !important;
        background-image: none !important;
    }

    img,
    picture,
    video,
    canvas,
    svg,
    iframe,
    object,
    embed,
    [data-feedback-mask] {
        visibility: hidden !important;
    }
`;

const TEXT_HIDING_STYLES = {
    color: 'transparent',
    textShadow: 'none',
    webkitTextFillColor: 'transparent',
    webkitTextStrokeColor: 'transparent'
};

export function redactScreenshotDom(documentRef = document, { root = documentRef.body } = {}) {
    if (!root) {
        return () => {};
    }

    const restores = [];
    const elements = collectElements(root);

    installRedactionStyles(documentRef, restores);

    for (const element of elements) {
        if (isIgnored(element)) {
            continue;
        }

        hideText(element, restores);
        removeBackgroundImage(element, restores);

        if (isFormField(element)) {
            redactFormField(element, restores);
        }

        if (isMediaElement(element) || isRedactedElement(element)) {
            hideElement(element, restores);
        }
    }

    return () => restoreAll(restores);
}

function installRedactionStyles(documentRef, restores) {
    if (!documentRef.head || typeof documentRef.createElement !== 'function') {
        return;
    }

    const style = documentRef.createElement('style');
    style.dataset.feedbackIgnore = 'true';
    style.textContent = REDACTION_STYLES;
    documentRef.head.append(style);
    restores.push(() => style.remove());
}

function collectElements(root) {
    const children = typeof root.querySelectorAll === 'function'
        ? Array.from(root.querySelectorAll('*'))
        : [];

    return isElement(root) ? [root, ...children] : children;
}

function hideText(element, restores) {
    for (const [property, value] of Object.entries(TEXT_HIDING_STYLES)) {
        setStyleProperty(element, property, value, restores);
    }
}

function removeBackgroundImage(element, restores) {
    setStyleProperty(element, 'backgroundImage', 'none', restores);
}

function redactFormField(element, restores) {
    const tagName = normalizedTagName(element);

    if (tagName === 'INPUT') {
        redactInput(element, restores);
        return;
    }

    if (tagName === 'SELECT') {
        setElementProperty(element, 'selectedIndex', -1, restores);
        return;
    }

    if (tagName === 'TEXTAREA') {
        setElementProperty(element, 'value', '', restores);
        setElementProperty(element, 'placeholder', '', restores);
        return;
    }

    if (tagName === 'OPTION') {
        setElementProperty(element, 'selected', false, restores);
    }
}

function redactInput(element, restores) {
    const type = String(element.type || '').toLowerCase();

    if (CHECKABLE_INPUT_TYPES.has(type)) {
        setElementProperty(element, 'checked', false, restores);
        setElementProperty(element, 'indeterminate', false, restores);
    }

    setElementProperty(element, 'value', '', restores);
    setElementProperty(element, 'placeholder', '', restores);
}

function hideElement(element, restores) {
    setStyleProperty(element, 'visibility', 'hidden', restores);
}

function isFormField(element) {
    return FORM_FIELD_TAGS.has(normalizedTagName(element));
}

function isMediaElement(element) {
    return MEDIA_TAGS.has(normalizedTagName(element));
}

function isRedactedElement(element) {
    return typeof element.matches === 'function' && element.matches(REDACTED_ELEMENT_SELECTOR);
}

function isIgnored(element) {
    return typeof element.closest === 'function' && Boolean(element.closest(IGNORED_SELECTOR));
}

function isElement(node) {
    return node?.nodeType === ELEMENT_NODE;
}

function normalizedTagName(element) {
    return String(element.tagName || '').toUpperCase();
}

function setElementProperty(element, property, nextValue, restores) {
    if (!(property in element) || element[property] === nextValue) {
        return;
    }

    const previousValue = element[property];

    try {
        element[property] = nextValue;
    } catch {
        return;
    }

    restores.push(() => {
        try {
            element[property] = previousValue;
        } catch {
            // If the browser rejects restoring a transient control value, leave the page usable.
        }
    });
}

function setStyleProperty(element, property, nextValue, restores) {
    if (!element.style || element.style[property] === nextValue) {
        return;
    }

    const previousValue = element.style[property] || '';
    element.style[property] = nextValue;
    restores.push(() => {
        element.style[property] = previousValue;
    });
}

function restoreAll(restores) {
    for (const restore of restores.reverse()) {
        restore();
    }
}
