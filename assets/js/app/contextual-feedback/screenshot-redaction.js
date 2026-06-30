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

const PSEUDO_PROFILES = [
    {
        name: 'Sophie de Vries',
        initials: 'S.',
        lastName: 'de Vries',
        email: 'sophie.devries@example.test',
        phone: '0612345678',
        address: 'Dorpsstraat 12',
        postalCode: '1234 AB',
        city: 'Utrecht',
        personReference: '10012345',
        date: '14-03-1986'
    },
    {
        name: 'Nora Bakker',
        initials: 'N.',
        lastName: 'Bakker',
        email: 'nora.bakker@example.test',
        phone: '0201234567',
        address: 'Stationsweg 8',
        postalCode: '2345 CD',
        city: 'Amersfoort',
        personReference: '10067890',
        date: '22-09-1978'
    },
    {
        name: 'Daan Visser',
        initials: 'D.',
        lastName: 'Visser',
        email: 'daan.visser@example.test',
        phone: '0307654321',
        address: 'Voorbeeldstraat 24',
        postalCode: '3456 EF',
        city: 'Rotterdam',
        personReference: '10024680',
        date: '05-11-1991'
    }
];

const PSEUDO_VALUES = {
    name: [],
    email: [],
    phone: [],
    address: [],
    'postal-code': [],
    iban: ['NL91 ABNA 0417 1643 00', 'BE68 5390 0754 7034'],
    id: [],
    date: [],
    'free-text': ['Klantnotitie met testgegevens', 'Contactmoment met voorbeeldtekst']
};

export function redactScreenshotDom(documentRef = document, {
    root = documentRef.body,
    context = createPseudonymContext(),
    pseudonymizeText = true
} = {}) {
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

        removeBackgroundImage(element, restores);

        if (pseudonymizeText && isFormField(element)) {
            redactFormField(element, context, restores);
        }

        if (isMediaElement(element) || isRedactedElement(element)) {
            hideElement(element, restores, context);
        }
    }

    if (pseudonymizeText) {
        redactTextNodes(root, context, restores);
    }

    return () => restoreAll(restores);
}

export function createPseudonymContext() {
    const nextIndexByType = {};
    for (const type of Object.keys(PSEUDO_VALUES)) {
        nextIndexByType[type] = 0;
    }

    return {
        replacements: new Map(),
        profileBySourceKey: new Map(),
        nextProfileIndex: 0,
        currentProfile: PSEUDO_PROFILES[0],
        nextIndexByType,
        privacySummary: {
            pseudoValues: 0,
            hiddenElements: 0,
            hiddenElementTypes: new Set()
        }
    };
}

export function pseudonymizeFeedbackText(value, sensitivityType = '', context = createPseudonymContext()) {
    const originalValue = String(value || '');
    if (!originalValue.trim()) {
        return originalValue;
    }

    const normalizedType = normalizeSensitivityType(sensitivityType) || inferSensitivityType(originalValue) || 'free-text';
    return pseudonymizeValue(originalValue, normalizedType, context);
}

export function pseudonymizeSelectedElement(selectedElement, context = createPseudonymContext()) {
    if (!selectedElement) {
        return selectedElement;
    }

    return {
        ...selectedElement,
        label: pseudonymizeFeedbackText(selectedElement.label || '', inferTypeFromName(selectedElement.selector || '') || 'free-text', context),
        textSample: selectedElement.textSample
            ? pseudonymizeFeedbackText(selectedElement.textSample, inferTypeFromName(selectedElement.selector || '') || 'free-text', context)
            : selectedElement.textSample
    };
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
    if (/(name|naam|initial|voorletter|tussenvoegsel|achternaam|voornaam)/.test(normalizedValue)) {
        return 'name';
    }
    if (/(search|zoek)/.test(normalizedValue)) {
        return 'name';
    }
    if (/(customer|klant|person|persoon|subscriber|abon|id|nummer|nr)/.test(normalizedValue)) {
        return 'id';
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

    if (usesCustomerProfile(normalizedType)) {
        const nextValue = pseudonymizeProfileValue(originalValue, normalizedType, context);
        context.replacements.set(key, nextValue);
        context.privacySummary.pseudoValues += 1;
        return nextValue;
    }

    if (normalizedType === 'free-text') {
        const nextValue = pseudonymizeFreeText(originalValue, context);
        context.replacements.set(key, nextValue);
        context.privacySummary.pseudoValues += 1;
        return nextValue;
    }

    const values = PSEUDO_VALUES[normalizedType] || PSEUDO_VALUES['free-text'];
    const nextValue = values[context.nextIndexByType[normalizedType] % values.length];
    context.nextIndexByType[normalizedType] += 1;
    context.replacements.set(key, nextValue);
    context.privacySummary.pseudoValues += 1;
    return nextValue;
}

function usesCustomerProfile(sensitivityType) {
    return ['name', 'email', 'phone', 'address', 'postal-code', 'id', 'date'].includes(sensitivityType);
}

function pseudonymizeProfileValue(value, sensitivityType, context) {
    const profile = resolveProfile(value, sensitivityType, context);

    if (sensitivityType === 'name') {
        return pseudoNameForValue(value, profile);
    }
    if (sensitivityType === 'email') {
        return profile.email;
    }
    if (sensitivityType === 'phone') {
        return profile.phone;
    }
    if (sensitivityType === 'address') {
        return pseudoAddressForValue(value, profile);
    }
    if (sensitivityType === 'postal-code') {
        return profile.postalCode;
    }
    if (sensitivityType === 'id') {
        return profile.personReference;
    }
    if (sensitivityType === 'date') {
        return profile.date;
    }

    return profile.name;
}

function resolveProfile(value, sensitivityType, context) {
    const sourceKey = sourceKeyForValue(value, sensitivityType, context);
    if (sourceKey) {
        const existingProfile = context.profileBySourceKey.get(sourceKey);
        if (existingProfile) {
            context.currentProfile = existingProfile;
            return existingProfile;
        }

        const nextProfile = PSEUDO_PROFILES[context.nextProfileIndex % PSEUDO_PROFILES.length];
        context.nextProfileIndex += 1;
        context.profileBySourceKey.set(sourceKey, nextProfile);
        context.currentProfile = nextProfile;
        return nextProfile;
    }

    return context.currentProfile || PSEUDO_PROFILES[0];
}

function sourceKeyForValue(value, sensitivityType, context) {
    const normalizedValue = String(value || '').toLowerCase();
    if (!normalizedValue) {
        return '';
    }

    for (const sourceKey of context.profileBySourceKey.keys()) {
        if (sourceKey && normalizedValue.includes(sourceKey)) {
            return sourceKey;
        }
    }

    if (sensitivityType === 'name') {
        const nameKey = extractNameKey(normalizedValue);
        return nameKey || '';
    }

    return '';
}

function extractNameKey(value) {
    const ignoredWords = new Set(['dhr', 'mevr', 'mw', 'mr', 'mrs', 'ms', 'de', 'den', 'der', 'het', 'van']);
    const words = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 1 && !ignoredWords.has(word));

    return words.at(-1) || '';
}

function pseudoNameForValue(value, profile) {
    const normalizedValue = String(value || '').trim();
    if (/^[A-Z]\.?$/i.test(normalizedValue)) {
        return profile.initials;
    }
    if (!/\s/.test(normalizedValue) && normalizedValue.length > 1) {
        return profile.lastName;
    }

    return profile.name;
}

function pseudoAddressForValue(value, profile) {
    const originalValue = String(value || '').trim();
    const hasPostalCode = /\b[1-9][0-9]{3}\s?[A-Z]{2}\b/i.test(originalValue);
    const hasCity = hasPostalCode && /\b[1-9][0-9]{3}\s?[A-Z]{2}\s+[A-Za-zÀ-ſ][A-Za-zÀ-ſ '-]+$/i.test(originalValue);

    if (hasPostalCode && hasCity) {
        return `${profile.address}, ${profile.postalCode} ${profile.city}`;
    }
    if (hasPostalCode) {
        return `${profile.address}, ${profile.postalCode}`;
    }

    return profile.address;
}

function pseudonymizeFreeText(value, context) {
    let nextValue = String(value || '');
    nextValue = nextValue.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, () => pseudonymizeValue('email-in-text', 'email', context));
    nextValue = nextValue.replace(/\b(?:\+31|0031|0)[1-9][0-9\s-]{7,12}\b/g, () => pseudonymizeValue('phone-in-text', 'phone', context));
    nextValue = nextValue.replace(/\b[1-9][0-9]{3}\s?[A-Z]{2}\b/gi, () => pseudonymizeValue('postal-in-text', 'postal-code', context));
    nextValue = nextValue.replace(/\b(?:NL|BE)\d{2}[A-Z0-9 ]{8,24}\b/gi, () => pseudonymizeValue('iban-in-text', 'iban', context));
    nextValue = nextValue.replace(/\b[A-ZÀ-ſ][A-Za-zÀ-ſ'-]+(?:straat|weg|laan|plein|pad|dijk|hof|kade|singel)\s+\d+[A-Z]?\b/gi, () => {
        const profile = context.currentProfile || PSEUDO_PROFILES[0];
        return profile.address;
    });
    nextValue = nextValue.replace(/\b(?:persoon|klant|abon\.?nr|id)\s*#?\d{5,}\b/gi, () => `persoon ${pseudonymizeValue('person-reference-in-text', 'id', context)}`);

    if (nextValue !== value) {
        return nextValue;
    }

    if (/factur|invoice|incasso|betaling|betaal|payment/i.test(value)) {
        return 'Vraag over facturatie. Uitleg gegeven over betaalwijze.';
    }
    if (/adres|verhuis/i.test(value)) {
        const profile = context.currentProfile || PSEUDO_PROFILES[0];
        return `Adres gewijzigd naar ${profile.address}, ${profile.postalCode} ${profile.city}.`;
    }

    const values = PSEUDO_VALUES['free-text'];
    const nextIndex = context.nextIndexByType['free-text'] % values.length;
    context.nextIndexByType['free-text'] += 1;
    return values[nextIndex];
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

function hideElement(element, restores, context = null) {
    if (context?.privacySummary) {
        context.privacySummary.hiddenElements += 1;
        context.privacySummary.hiddenElementTypes.add(describeHiddenElementType(element));
    }

    setStyleProperty(element, 'visibility', 'hidden', restores);
}

function describeHiddenElementType(element) {
    if (isRedactedElement(element)) {
        return 'marked private regions';
    }

    const tagName = normalizedTagName(element);
    if (tagName === 'IMG' || tagName === 'PICTURE' || tagName === 'SVG') {
        return 'images';
    }
    if (tagName === 'IFRAME' || tagName === 'EMBED' || tagName === 'OBJECT') {
        return 'embedded frames';
    }
    if (tagName === 'VIDEO') {
        return 'videos';
    }
    if (tagName === 'CANVAS') {
        return 'canvas content';
    }

    return 'media';
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
