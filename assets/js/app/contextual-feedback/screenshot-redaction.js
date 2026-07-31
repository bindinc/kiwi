const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

const IGNORED_SELECTOR = '[data-feedback-ignore]';
const REDACTED_ELEMENT_SELECTOR = '[data-feedback-mask]';
const SENSITIVE_SELECTOR = '[data-feedback-sensitive]';
const SENSITIVE_SCOPE_SELECTOR = '[data-feedback-sensitive-scope]';
const PUBLIC_SELECTOR = '[data-feedback-public]';
const FORM_FIELD_TAGS = new Set(['INPUT', 'OPTION', 'SELECT', 'TEXTAREA']);
const CHECKABLE_INPUT_TYPES = new Set(['checkbox', 'radio']);
const NON_TEXT_INPUT_TYPES = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit']);

const REDACTION_STYLES = `
    [data-feedback-mask] {
        background: #d9dde3 !important;
        color: transparent !important;
        overflow: hidden !important;
        text-shadow: none !important;
    }

    [data-feedback-mask] * {
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

        if (pseudonymizeText && isFormField(element)) {
            redactFormField(element, context, restores);
        }

        if (pseudonymizeText && isRedactedElement(element)) {
            maskElement(element, restores, context);
        }
    }

    if (pseudonymizeText) {
        redactTextNodes(root, context, restores);
    }

    return () => restoreAll(restores);
}

export function pseudonymizeScreenshotClone(clonedRoot, context = createPseudonymContext()) {
    const documentRef = clonedRoot?.ownerDocument || globalThis.document;
    redactScreenshotDom(documentRef, {
        root: clonedRoot,
        context,
        pseudonymizeText: true
    });
    auditPseudonymizedClone(clonedRoot, context);

    return context.privacySummary;
}

export function auditPseudonymizedClone(root, context) {
    const unresolvedValues = context.unresolvedSourceValues.size;

    context.privacySummary.unresolvedValues = unresolvedValues;
    context.privacySummary.verified = unresolvedValues === 0;

    return context.privacySummary;
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
        unresolvedSourceValues: new Set(),
        privacySummary: {
            pseudoValues: 0,
            maskedElements: 0,
            maskedElementTypes: new Set(),
            resourceFailures: 0,
            unresolvedValues: 0,
            verified: true
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
        label: selectedElement.sensitivityType
            ? pseudonymizeFeedbackText(selectedElement.label || '', selectedElement.sensitivityType, context)
            : selectedElement.label,
        textSample: null,
        sensitivityType: undefined
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

        const replacement = pseudonymizeValue(trimmedValue, sensitivityType, context);
        recordUnresolvedReplacement(trimmedValue, replacement, context);
        const nextValue = originalValue.replace(trimmedValue, replacement);
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
            const replacement = pseudonymizeValue(element.value, sensitivityType, context);
            recordUnresolvedReplacement(element.value, replacement, context);
            setElementProperty(element, 'value', replacement, restores);
        }
    }
}

function redactOption(element, context, restores) {
    const value = typeof element.textContent === 'string' ? element.textContent.trim() : '';
    const sensitivityType = getElementSensitivityType(element)
        || inferTypeFromName(describeElement(element.parentElement))
        || inferSensitivityType(value);
    if (!value || !sensitivityType) {
        return;
    }

    const replacement = pseudonymizeValue(value, sensitivityType, context);
    recordUnresolvedReplacement(value, replacement, context);
    setElementProperty(element, 'textContent', replacement, restores);
}

function getTextSensitivityType(element, value) {
    const markedType = getElementSensitivityType(element);
    if (markedType) {
        return markedType;
    }

    if (isInSensitiveScope(element)) {
        return inferSensitivityType(value) || 'free-text';
    }

    return inferTypeFromName(describeElement(element)) || inferSensitivityType(value);
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
    const normalizedValue = String(value || '')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .toLowerCase()
        .trim();
    if (!normalizedValue) {
        return '';
    }

    if (/\b(email|mail)\b/.test(normalizedValue)) {
        return 'email';
    }
    if (/\b(phone|telephone|telefoon|telefoonnummer|tel)\b/.test(normalizedValue)) {
        return 'phone';
    }
    if (/\b(iban|rekening|rekeningnummer)\b/.test(normalizedValue)) {
        return 'iban';
    }
    if (/\b(postcode|postal)\b/.test(normalizedValue)) {
        return 'postal-code';
    }
    if (/\b(address|adres|straat|city|plaats|huis|huisnummer)\b/.test(normalizedValue)) {
        return 'address';
    }
    if (/\b(birthday|birth|geboorte|geboortedatum|datum|date)\b/.test(normalizedValue)) {
        return 'date';
    }
    if (/\b(name|naam|initial|initials|voorletter|voorletters|tussenvoegsel|achternaam|voornaam)\b/.test(normalizedValue)) {
        return 'name';
    }
    if (/\b(search|zoek|zoeken)\b/.test(normalizedValue)) {
        return 'name';
    }
    if (/\b(customer|klant|person|persoon|subscriber|abon|abonnement|id|nummer|nr)\b/.test(normalizedValue)) {
        return 'id';
    }
    if (/\b(note|notes|remark|remarks|description|opmerking|opmerkingen|notitie|omschrijving)\b/.test(normalizedValue)) {
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
    const trimmedOriginalValue = originalValue.trim();
    const normalizedType = normalizeSensitivityType(sensitivityType) || 'free-text';
    const key = `${normalizedType}:${trimmedOriginalValue}`;
    const existingValue = context.replacements.get(key);
    if (existingValue) {
        return existingValue;
    }

    if (usesCustomerProfile(normalizedType)) {
        const nextValue = ensureReplacementDiffers(
            originalValue,
            pseudonymizeProfileValue(originalValue, normalizedType, context),
            normalizedType
        );
        context.replacements.set(key, nextValue);
        context.privacySummary.pseudoValues += 1;
        return nextValue;
    }

    if (normalizedType === 'free-text') {
        const nextValue = ensureReplacementDiffers(
            originalValue,
            pseudonymizeFreeText(originalValue, context),
            normalizedType
        );
        context.replacements.set(key, nextValue);
        context.privacySummary.pseudoValues += 1;
        return nextValue;
    }

    const values = PSEUDO_VALUES[normalizedType] || PSEUDO_VALUES['free-text'];
    const nextValue = ensureReplacementDiffers(
        originalValue,
        values[context.nextIndexByType[normalizedType] % values.length],
        normalizedType
    );
    context.nextIndexByType[normalizedType] += 1;
    context.replacements.set(key, nextValue);
    context.privacySummary.pseudoValues += 1;
    return nextValue;
}

function usesCustomerProfile(sensitivityType) {
    return ['name', 'email', 'phone', 'address', 'postal-code', 'id', 'date'].includes(sensitivityType);
}

function ensureReplacementDiffers(originalValue, replacement, sensitivityType) {
    if (String(originalValue).trim() !== String(replacement).trim()) {
        return replacement;
    }

    const alternateProfile = PSEUDO_PROFILES[1];
    const alternateValues = {
        name: alternateProfile.name,
        email: alternateProfile.email,
        phone: alternateProfile.phone,
        address: alternateProfile.address,
        'postal-code': alternateProfile.postalCode,
        id: alternateProfile.personReference,
        date: alternateProfile.date,
        iban: PSEUDO_VALUES.iban[1],
        'free-text': PSEUDO_VALUES['free-text'][1]
    };

    return alternateValues[sensitivityType] || PSEUDO_VALUES['free-text'][1];
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
    if (!element) {
        return '';
    }

    return [
        element.id,
        element.className,
        element.name,
        element.getAttribute?.('data-feedback-sensitive'),
        element.getAttribute?.('aria-label')
    ].join(' ');
}

function maskElement(element, restores, context = null) {
    if (context?.privacySummary) {
        context.privacySummary.maskedElements += 1;
        context.privacySummary.maskedElementTypes.add(describeMaskedElementType(element));
    }

    setStyleProperty(element, 'background', '#d9dde3', restores);
    setStyleProperty(element, 'color', 'transparent', restores);
    setStyleProperty(element, 'overflow', 'hidden', restores);
    setStyleProperty(element, 'textShadow', 'none', restores);
}

function describeMaskedElementType(element) {
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

    return 'marked private regions';
}

function isFormField(element) {
    return FORM_FIELD_TAGS.has(normalizedTagName(element));
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

function recordUnresolvedReplacement(originalValue, replacement, context) {
    const normalizedOriginal = String(originalValue || '').trim();
    const normalizedReplacement = String(replacement || '').trim();
    const isMeaningfulSource = normalizedOriginal.length >= 3
        && /[\p{L}\p{N}]/u.test(normalizedOriginal);

    if (isMeaningfulSource && normalizedReplacement === normalizedOriginal) {
        context.unresolvedSourceValues.add(normalizedOriginal);
    }
}
