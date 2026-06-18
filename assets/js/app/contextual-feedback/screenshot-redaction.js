const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

const IGNORED_SELECTOR = '[data-feedback-ignore]';
const REDACTED_ELEMENT_SELECTOR = '[data-feedback-mask]';
const SENSITIVE_SELECTOR = '[data-feedback-sensitive]';
const SENSITIVE_SCOPE_SELECTOR = '[data-feedback-sensitive-scope]';
const PUBLIC_SELECTOR = '[data-feedback-public]';
const MEDIA_TAGS = new Set(['CANVAS', 'EMBED', 'IFRAME', 'IMG', 'OBJECT', 'PICTURE', 'SVG', 'VIDEO']);
const FORM_FIELD_TAGS = new Set(['INPUT', 'OPTION', 'SELECT', 'TEXTAREA']);
const CHECKABLE_INPUT_TYPES = new Set(['checkbox', 'radio']);
const NON_TEXT_INPUT_TYPES = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);

const REDACTION_STYLES = `
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

const PSEUDO_VALUES = {
    name: ['Sophie de Vries', 'Mark Jansen', 'Nora Bakker', 'Daan Visser'],
    email: ['sophie.devries@example.test', 'mark.jansen@example.test', 'nora.bakker@example.test'],
    phone: ['0612345678', '0201234567', '0307654321'],
    address: ['Dorpsstraat 12, 1234 AB Utrecht', 'Stationsweg 8, 2345 CD Amersfoort'],
    'postal-code': ['1234 AB', '2345 CD', '3456 EF'],
    iban: ['NL91 ABNA 0417 1643 00', 'BE68 5390 0754 7034'],
    id: ['10012345', '10067890', '10024680'],
    date: ['14-03-1986', '22-09-1978', '05-11-1991'],
    'free-text': ['Klantnotitie met testgegevens', 'Contactmoment met voorbeeldtekst']
};

export function redactScreenshotDom(documentRef = document, { root = documentRef.body } = {}) {
    if (!root) {
        return () => {};
    }

    const restores = [];
    const elements = collectElements(root);
    const context = createPseudonymContext();

    installRedactionStyles(documentRef, restores);

    for (const element of elements) {
        if (isIgnored(element)) {
            continue;
        }

        removeBackgroundImage(element, restores);

        if (isFormField(element)) {
            redactFormField(element, context, restores);
        }

        if (isMediaElement(element) || isRedactedElement(element)) {
            hideElement(element, restores);
        }
    }

    redactTextNodes(root, context, restores);

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

function redactTextNodes(root, context, restores) {
    for (const textNode of collectTextNodes(root)) {
        const parentElement = textNode.parentElement;
        if (!parentElement || isIgnored(parentElement) || isPublic(parentElement)) {
            continue;
        }

        const originalValue = String(textNode.nodeValue || '');
        const trimmedValue = originalValue.trim();
        if (!trimmedValue) {
            continue;
        }

        const sensitivityType = getTextSensitivityType(parentElement, trimmedValue);
        if (!sensitivityType) {
            continue;
        }

        const nextValue = originalValue.replace(trimmedValue, pseudonymizeValue(trimmedValue, sensitivityType, context));
        setNodeValue(textNode, nextValue, restores);
    }
}

function collectTextNodes(root) {
    const nodes = [];
    collectTextNodesFrom(root, nodes);
    return nodes;
}

function collectTextNodesFrom(node, nodes) {
    if (!node || isIgnored(node)) {
        return;
    }

    if (node.nodeType === TEXT_NODE) {
        nodes.push(node);
        return;
    }

    for (const child of Array.from(node.childNodes || [])) {
        collectTextNodesFrom(child, nodes);
    }
}

function removeBackgroundImage(element, restores) {
    setStyleProperty(element, 'backgroundImage', 'none', restores);
}

function redactFormField(element, context, restores) {
    const tagName = normalizedTagName(element);

    if (tagName === 'INPUT') {
        redactInput(element, context, restores);
        return;
    }

    if (tagName === 'SELECT') {
        return;
    }

    if (tagName === 'TEXTAREA') {
        redactTextControl(element, context, restores, 'free-text');
        return;
    }

    if (tagName === 'OPTION') {
        redactOption(element, context, restores);
    }
}

function redactInput(element, context, restores) {
    const type = String(element.type || '').toLowerCase();

    if (CHECKABLE_INPUT_TYPES.has(type)) {
        setElementProperty(element, 'checked', false, restores);
        setElementProperty(element, 'indeterminate', false, restores);
        return;
    }

    if (NON_TEXT_INPUT_TYPES.has(type)) {
        return;
    }

    const sensitivityType = getFieldSensitivityType(element);
    redactTextControl(element, context, restores, sensitivityType);
}

function redactTextControl(element, context, restores, fallbackType) {
    if (typeof element.value === 'string' && element.value.trim()) {
        const sensitivityType = getFieldSensitivityType(element, element.value) || fallbackType || inferSensitivityType(element.value);
        if (sensitivityType) {
            setElementProperty(element, 'value', pseudonymizeValue(element.value, sensitivityType, context), restores);
        }
    }

    if (typeof element.placeholder === 'string' && element.placeholder.trim()) {
        const placeholderType = getFieldSensitivityType(element, element.placeholder) || fallbackType || inferSensitivityType(element.placeholder);
        if (placeholderType) {
            setElementProperty(element, 'placeholder', pseudonymizeValue(element.placeholder, placeholderType, context), restores);
        }
    }
}

function redactOption(element, context, restores) {
    const value = typeof element.textContent === 'string' ? element.textContent.trim() : '';
    const sensitivityType = getElementSensitivityType(element) || inferSensitivityType(value);
    if (!value || !sensitivityType) {
        return;
    }

    setElementProperty(element, 'textContent', pseudonymizeValue(value, sensitivityType, context), restores);
}

function getTextSensitivityType(element, value) {
    const markedType = getElementSensitivityType(element);
    if (markedType) {
        return markedType;
    }

    if (isInSensitiveScope(element)) {
        return inferSensitivityType(value) || 'free-text';
    }

    return inferSensitivityType(value);
}

function getFieldSensitivityType(element, value = '') {
    const markedType = getElementSensitivityType(element);
    if (markedType) {
        return markedType;
    }

    const type = String(element.type || '').toLowerCase();
    if (type === 'email') {
        return 'email';
    }
    if (type === 'tel') {
        return 'phone';
    }
    if (type === 'date') {
        return 'date';
    }

    const fieldName = [
        element.id,
        element.name,
        element.getAttribute?.('aria-label'),
        element.getAttribute?.('placeholder')
    ].join(' ');
    const fieldType = inferTypeFromName(fieldName);
    if (fieldType) {
        return fieldType;
    }

    if (isInSensitiveScope(element)) {
        return inferSensitivityType(value) || 'free-text';
    }

    return inferSensitivityType(value);
}

function getElementSensitivityType(element) {
    const sensitiveElement = closest(element, SENSITIVE_SELECTOR);
    if (!sensitiveElement || isPublic(element)) {
        return '';
    }

    const sensitivityType = sensitiveElement.getAttribute?.('data-feedback-sensitive') || '';
    return normalizeSensitivityType(sensitivityType) || inferTypeFromName(describeElement(sensitiveElement)) || 'free-text';
}

function isInSensitiveScope(element) {
    return Boolean(closest(element, SENSITIVE_SCOPE_SELECTOR)) && !isPublic(element);
}

function isPublic(element) {
    return Boolean(closest(element, PUBLIC_SELECTOR));
}

function inferSensitivityType(value) {
    const normalizedValue = String(value || '').trim();
    if (!normalizedValue) {
        return '';
    }

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedValue)) {
        return 'email';
    }
    if (/\b(?:NL|BE)\d{2}[A-Z0-9 ]{8,24}\b/i.test(normalizedValue)) {
        return 'iban';
    }
    if (/\b[1-9][0-9]{3}\s?[A-Z]{2}\b/i.test(normalizedValue)) {
        return 'postal-code';
    }
    if (/^(?:\+31|0031|0)[1-9][0-9\s-]{7,12}$/.test(normalizedValue)) {
        return 'phone';
    }
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(normalizedValue) || /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
        return 'date';
    }
    if (/^(?:abon\.?nr|klantnr|persoon|id)?\s*#?\d{5,}$/i.test(normalizedValue)) {
        return 'id';
    }

    return '';
}

function inferTypeFromName(value) {
    const normalizedValue = String(value || '').toLowerCase();
    if (!normalizedValue) {
        return '';
    }

    if (/(mail|e-mail)/.test(normalizedValue)) {
        return 'email';
    }
    if (/(phone|telefoon|tel\b)/.test(normalizedValue)) {
        return 'phone';
    }
    if (/(iban|rekening)/.test(normalizedValue)) {
        return 'iban';
    }
    if (/(postcode|postal)/.test(normalizedValue)) {
        return 'postal-code';
    }
    if (/(address|adres|straat|city|plaats|huis)/.test(normalizedValue)) {
        return 'address';
    }
    if (/(birthday|birth|geboorte|datum|date)/.test(normalizedValue)) {
        return 'date';
    }
    if (/(customer|klant|person|persoon|subscriber|abon|id|nummer|nr)/.test(normalizedValue)) {
        return 'id';
    }
    if (/(name|naam|initial|voorletter|tussenvoegsel|achternaam|voornaam)/.test(normalizedValue)) {
        return 'name';
    }
    if (/(note|remark|description|opmerking|notitie|omschrijving)/.test(normalizedValue)) {
        return 'free-text';
    }

    return '';
}

function normalizeSensitivityType(value) {
    const normalizedValue = String(value || '').trim().toLowerCase();
    if (!normalizedValue || normalizedValue === 'true') {
        return '';
    }

    return Object.hasOwn(PSEUDO_VALUES, normalizedValue) ? normalizedValue : '';
}

function pseudonymizeValue(value, sensitivityType, context) {
    const originalValue = String(value || '');
    const normalizedType = normalizeSensitivityType(sensitivityType) || 'free-text';
    const key = `${normalizedType}:${originalValue.trim()}`;
    const existingValue = context.replacements.get(key);
    if (existingValue) {
        return existingValue;
    }

    const values = PSEUDO_VALUES[normalizedType] || PSEUDO_VALUES['free-text'];
    const nextValue = values[context.nextIndexByType[normalizedType] % values.length];
    context.nextIndexByType[normalizedType] += 1;
    context.replacements.set(key, nextValue);
    return nextValue;
}

function createPseudonymContext() {
    const nextIndexByType = {};
    for (const type of Object.keys(PSEUDO_VALUES)) {
        nextIndexByType[type] = 0;
    }

    return {
        replacements: new Map(),
        nextIndexByType
    };
}

function describeElement(element) {
    return [
        element.id,
        element.className,
        element.name,
        element.getAttribute?.('data-feedback-sensitive'),
        element.getAttribute?.('aria-label')
    ].join(' ');
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
    return Boolean(closest(element, IGNORED_SELECTOR));
}

function closest(element, selector) {
    if (!isElement(element) || typeof element.closest !== 'function') {
        return null;
    }

    return element.closest(selector);
}

function isElement(node) {
    return node?.nodeType === ELEMENT_NODE;
}

function normalizedTagName(element) {
    return String(element.tagName || '').toUpperCase();
}

function setNodeValue(node, nextValue, restores) {
    if (node.nodeValue === nextValue) {
        return;
    }

    const previousValue = node.nodeValue;
    node.nodeValue = nextValue;
    restores.push(() => {
        node.nodeValue = previousValue;
    });
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
