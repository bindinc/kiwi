const activeForms = new Set();
const prefixes = ['subRecipient', 'subRequester', 'article', 'edit', 'restitutionTransfer'];
const messages = {
    nl: { invalid: 'Dit adres komt niet voor in de adresdatabase. Kies een geldig adres.', unconfirmed: 'Het volledige adres is niet bevestigd. Opslaan is geblokkeerd; probeer opnieuw.', validating: 'Volledig adres controleren…', loading: 'Adres opzoeken…', matched: 'Adres aangevuld vanuit je keuze.', results: 'Kies het juiste adres.', alternatives: 'Geen match met deze postcode. Controleer de alternatieven; kiezen vervangt de postcode.', limited: 'Er zijn veel resultaten. Vul een extra adresveld in om gerichter te zoeken.', choose: 'Kies een adres', unknownAddition: 'toevoeging niet beschikbaar', not_found: 'Geen adres gevonden. Controleer de invoer; alleen bevestigde adressen kunnen worden opgeslagen.', ambiguous: 'Meerdere adressen gevonden. Vul straat en plaats zelf in.', unavailable: 'Adres opzoeken is tijdelijk niet beschikbaar. Opslaan vereist een bevestigd adres.', retry: 'Opnieuw proberen' },
    en: { invalid: 'This address is not in the address database. Choose a valid address.', unconfirmed: 'The complete address is unconfirmed. Saving is blocked; try again.', validating: 'Checking the complete address…', loading: 'Looking up address…', matched: 'Address completed from your selection.', results: 'Choose the correct address.', alternatives: 'No match for this postcode. Check the alternatives; selecting one replaces the postcode.', limited: 'Many results found. Enter another address field to narrow the search.', choose: 'Choose an address', unknownAddition: 'addition unavailable', not_found: 'No address found. Check your input; only confirmed addresses can be saved.', ambiguous: 'Multiple addresses found. Enter street and city manually.', unavailable: 'Address lookup is temporarily unavailable. Saving requires a confirmed address.', retry: 'Try again' }
};

export function normalizeAddressInput(postalCode, houseNumber, street = '', city = '') {
    const postal = postalCode.replace(/\s+/g, '').toUpperCase();
    const number = houseNumber.trim().toUpperCase();
    if (number && !/^[1-9][0-9]{0,5}[A-Z]?$/.test(number)) return null;
    const values = { postalCode: /^[1-9][0-9]{3}[A-Z]{2}$/.test(postal) ? postal : '',
        houseNumber: number.replace(/[A-Z]$/, ''), street: street.trim(), city: city.trim() };
    const query = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== ''));
    return Object.keys(query).length >= 2 ? query : null;
}

function addressValues(fields, includeNumber = false) {
    const houseNumber = fields.houseNumber.value.trim().toUpperCase();
    const houseNumberAddition = fields.addition?.value.trim().toUpperCase() || '';
    let street = fields.street.value.trim();
    const suffix = `${houseNumber}${houseNumberAddition ? ` ${houseNumberAddition}` : ''}`;
    if (includeNumber && street.toUpperCase().endsWith(` ${suffix}`)) street = street.slice(0, -suffix.length - 1);
    return { postalCode: fields.postalCode.value.replace(/\s+/g, '').toUpperCase(), houseNumber,
        houseNumberAddition, street, city: fields.city.value.trim().toUpperCase(), countryCode: 'NL' };
}

export function getAddressSubmission(prefix, documentRef = globalThis.document) {
    if (!documentRef) return {};
    const fields = { postalCode: documentRef.getElementById(`${prefix}PostalCode`), houseNumber: documentRef.getElementById(`${prefix}HouseNumber`),
        addition: documentRef.getElementById(`${prefix}HouseExt`), street: documentRef.getElementById(`${prefix}Address`), city: documentRef.getElementById(`${prefix}City`) };
    if (!fields.postalCode || !fields.houseNumber || !fields.street || !fields.city) return {};
    return { ...addressValues(fields, prefix === 'restitutionTransfer'), formSessionId: fields.postalCode.dataset.addressFormSessionId };
}

function sameAddress(left, right) {
    return ['postalCode', 'houseNumber', 'houseNumberAddition', 'street', 'city'].every((key) =>
        String(left[key] ?? '').trim().toUpperCase() === String(right[key] ?? '').trim().toUpperCase());
}

export function endAddressSessions(root = null) {
    for (const form of [...activeForms]) {
        if (!root || root.contains?.(form.fields.postalCode)) form.destroy();
    }
}

export function createAddressCompletion({ fields, request, report, uuid = () => crypto.randomUUID(), schedule = setTimeout, cancel = clearTimeout, now = Date.now, isActive = () => true, includeNumber = false, prefilledAddress = false, invalidMessage = messages.nl.invalid }) {
    let sessionId = null;
    let startedAt = 0;
    let timer = null;
    let revision = 0;
    let lastFingerprint = '';
    let automatic = prefilledAddress ? { street: fields.street.value, city: fields.city.value } : null;
    let destroyed = false;
    let validationBuffer = null;
    let choices = [];
    let selected = null;
    let choicesFingerprint = '';
    const read = () => {
        let street = fields.street.value === automatic?.street ? '' : fields.street.value;
        if (includeNumber) {
            // Restitution stores a combined street/number field; search only its street part.
            street = street.replace(/\s+\d+[A-Za-z]?(?:\s+.*)?$/, '');
        }
        const city = fields.city.value === automatic?.city ? '' : fields.city.value;
        return normalizeAddressInput(fields.postalCode.value, fields.houseNumber.value, street, city);
    };
    const fingerprint = () => JSON.stringify([read(), fields.postalCode.value, fields.houseNumber.value, fields.street.value, fields.city.value]);

    function closeSession() {
        if (sessionId) void request(`/sessions/${sessionId}`, { method: 'DELETE', keepalive: true }).catch(() => {});
        sessionId = null;
        if (fields.postalCode.dataset) delete fields.postalCode.dataset.addressFormSessionId;
    }

    function ensureSession() {
        const time = now();
        const expired = time - startedAt >= 43200000 || new Date(time).toISOString().slice(0, 10) !== new Date(startedAt).toISOString().slice(0, 10);
        if (sessionId && expired) { closeSession(); validationBuffer = null; }
        if (!sessionId) { sessionId = uuid(); startedAt = time; }
        if (fields.postalCode.dataset) fields.postalCode.dataset.addressFormSessionId = sessionId;
    }

    function validateBuffer() {
        const time = now();
        if (validationBuffer && (time - validationBuffer.checkedAt >= 43200000 || new Date(time).toISOString().slice(0, 10) !== new Date(validationBuffer.checkedAt).toISOString().slice(0, 10))) validationBuffer = null;
        const current = addressValues(fields, includeNumber);
        const matched = validationBuffer?.candidates?.some((candidate) => candidate.verified && sameAddress(candidate, current));
        const sameScope = validationBuffer?.postalCode === current.postalCode
            && validationBuffer?.houseNumber === current.houseNumber.replace(/[A-Z]$/, '');
        const rejected = !matched && sameScope && validationBuffer?.complete;
        const message = rejected ? invalidMessage : '';
        (fields.addition || fields.houseNumber).setCustomValidity?.(message);
        return { matched, rejected };
    }

    function reset() {
        ++revision;
        cancel(timer);
        closeSession();
        lastFingerprint = '';
        automatic = null;
        validationBuffer = null;
        (fields.addition || fields.houseNumber).setCustomValidity?.('');
        choices = [];
        selected = null;
        report('');
    }

    function input() {
        if (destroyed) return;
        fields.postalCode.value = fields.postalCode.value.replace(/\s+/g, '').toUpperCase();
        fields.houseNumber.value = fields.houseNumber.value.toUpperCase();
        if (automatic?.city === fields.city.value) automatic.city = automatic.city.toUpperCase();
        fields.city.value = fields.city.value.toUpperCase();
        const changed = fingerprint() !== lastFingerprint;
        if (!changed) return;
        ++revision;
        cancel(timer);
        validationBuffer = null;
        (fields.addition || fields.houseNumber).setCustomValidity?.('');
        choices = [];
        selected = null;
        report('');
        if (automatic) {
            for (const key of ['street', 'city', 'addition']) {
                if (fields[key] && fields[key].value === automatic[key]) fields[key].value = '';
            }
            automatic = null;
        }
        const query = read();
        if (!query) {
            lastFingerprint = '';
            report('');
            return;
        }
        if (query.postalCode) fields.postalCode.value = query.postalCode;
        const expectedFingerprint = fingerprint();
        const version = revision;
        timer = schedule(() => void search(query, version, expectedFingerprint), 350);
    }

    async function search(query, version, expectedFingerprint) {
        if (destroyed || version !== revision || fingerprint() !== expectedFingerprint || !isActive()) return;
        ensureSession();
        lastFingerprint = expectedFingerprint;
        const before = { street: fields.street.value, city: fields.city.value };
        report('loading');
        try {
            const response = await request('/search', { method: 'POST', body: JSON.stringify({ formSessionId: sessionId, ...query }) });
            if (destroyed || version !== revision || fingerprint() !== expectedFingerprint || !isActive()) return;
            if (fields.street.value !== before.street || fields.city.value !== before.city) {
                report('');
                return;
            }
            validationBuffer = { ...response, checkedAt: now(), postalCode: query.postalCode, houseNumber: query.houseNumber,
                complete: Boolean(response.complete && !response.postcodeRelaxed) };
            if (Array.isArray(response.candidates) && response.candidates.length) {
                choices = response.candidates.filter((candidate) => typeof candidate.postalCode === 'string'
                    && typeof candidate.houseNumber === 'string' && typeof candidate.street === 'string'
                    && typeof candidate.city === 'string' && (candidate.houseNumberAddition === null || typeof candidate.houseNumberAddition === 'string'));
                if (choices.length) {
                    choicesFingerprint = expectedFingerprint;
                    report(response.postcodeRelaxed ? 'alternatives' : response.limited ? 'limited' : 'results', choices);
                    return;
                }
            }
            const status = ['not_found', 'ambiguous', 'unavailable'].includes(response.status) ? response.status : 'unavailable';
            if (status === 'unavailable') lastFingerprint = '';
            report(status);
        } catch {
            if (destroyed || version !== revision || !isActive()) return;
            lastFingerprint = '';
            report('unavailable');
        }
    }

    const form = {
        fields, input, reset,
        select(index) {
            const choice = choices[index];
            if (!choice || destroyed || !isActive() || fingerprint() !== choicesFingerprint) return;
            selected = choice;
            const addition = choice.houseNumberAddition;
            const effectiveAddition = addition === null ? fields.addition?.value || '' : addition;
            const street = includeNumber ? `${choice.street} ${choice.houseNumber}${effectiveAddition ? ` ${effectiveAddition}` : ''}` : choice.street;
            const city = choice.city.toUpperCase();
            automatic = { street, city };
            fields.street.value = street;
            fields.city.value = city;
            if (addition !== null && fields.addition) {
                fields.addition.value = addition;
                automatic.addition = addition;
            }
            fields.houseNumber.value = choice.houseNumber;
            fields.postalCode.value = choice.postalCode;
            choicesFingerprint = fingerprint();
            lastFingerprint = choicesFingerprint;
            choices = [];
            validateBuffer();
            report(choice.verified === false ? 'unconfirmed' : 'matched');
        },
        manualInput(field) {
            if (automatic) delete automatic[field];
            if (field === 'addition') {
                fields.addition.value = fields.addition.value.toUpperCase();
                if (includeNumber && selected && fields.street.value === automatic?.street) {
                    const suffix = fields.addition?.value.trim() || '';
                    automatic.street = `${selected.street} ${selected.houseNumber}${suffix ? ` ${suffix}` : ''}`;
                    fields.street.value = automatic.street;
                    choicesFingerprint = fingerprint();
                    lastFingerprint = choicesFingerprint;
                }
                const validity = validateBuffer();
                report(validity.rejected ? 'invalid' : '');
                return;
            }
            choices = [];
            ++revision;
            cancel(timer);
            if (automatic) delete automatic[field];
            lastFingerprint = '';
            input();
        },
        async validate() {
            if (destroyed) return false;
            ensureSession();
            const current = addressValues(fields, includeNumber);
            const expected = JSON.stringify(current);
            const version = revision;
            const validity = validateBuffer();
            if (validity.rejected) { report('invalid'); return false; }
            report('validating');
            try {
                const response = await request('/validate', { method: 'POST', body: JSON.stringify({ formSessionId: sessionId, ...current }) });
                if (destroyed || expected !== JSON.stringify(addressValues(fields, includeNumber)) || version !== revision || response.status !== 'confirmed') return false;
                const address = response.address;
                fields.postalCode.value = address.postalCode;
                fields.houseNumber.value = address.houseNumber;
                fields.city.value = address.city;
                if (fields.addition) fields.addition.value = address.houseNumberAddition;
                fields.street.value = includeNumber ? `${address.street} ${address.houseNumber}${address.houseNumberAddition ? ` ${address.houseNumberAddition}` : ''}` : address.street;
                (fields.addition || fields.houseNumber).setCustomValidity?.('');
                choices = [];
                report('matched');
                return true;
            } catch {
                if (!destroyed && expected === JSON.stringify(addressValues(fields, includeNumber))) report('unconfirmed');
                return false;
            }
        },
        retry() { lastFingerprint = ''; input(); },
        destroy() { if (destroyed) return; reset(); destroyed = true; activeForms.delete(form); }
    };
    activeForms.add(form);
    return form;
}

export function initAddressCompletion({ documentRef = document, windowRef = window } = {}) {
    const forms = new Map();
    const base = String(windowRef.kiwiBasePath || '').replace(/\/$/, '');
    const text = (key) => messages[documentRef.documentElement.lang?.startsWith('en') ? 'en' : 'nl'][key] || '';
    const isVisible = (element) => element.isConnected && !element.disabled && !element.closest('[hidden]') && element.getClientRects().length > 0;

    async function request(path, options) {
        const response = await windowRef.fetch(`${base}/api/v1/addresses${path}`, {
            ...options, credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }
        });
        if (!response.ok) throw new Error('Address lookup unavailable');
        return response.status === 204 ? null : response.json();
    }

    function attach(prefix) {
        const fields = {
            postalCode: documentRef.getElementById(`${prefix}PostalCode`), houseNumber: documentRef.getElementById(`${prefix}HouseNumber`),
            addition: documentRef.getElementById(`${prefix}HouseExt`), street: documentRef.getElementById(`${prefix}Address`), city: documentRef.getElementById(`${prefix}City`)
        };
        if (!fields.postalCode || !fields.houseNumber || !fields.street || !fields.city) return null;
        let status = documentRef.getElementById(`${prefix}AddressStatus`);
        if (!status) {
            status = documentRef.createElement('div');
            status.id = `${prefix}AddressStatus`;
            status.className = 'address-completion-status';
            status.hidden = true;
            const addressRow = fields.city.closest('.form-row') || fields.city.parentElement;
            addressRow.classList.add('address-completion-anchor');
            addressRow.append(status);
        }
        status.replaceChildren();
        const label = documentRef.createElement('span');
        label.setAttribute('role', 'status');
        label.setAttribute('aria-live', 'polite');
        const retry = documentRef.createElement('button');
        retry.type = 'button';
        retry.className = 'btn btn-secondary btn-sm';
        retry.textContent = text('retry');
        retry.hidden = true;
        const choicesLabel = documentRef.createElement('label');
        choicesLabel.htmlFor = `${prefix}AddressChoices`;
        choicesLabel.textContent = text('choose');
        const choicesSelect = documentRef.createElement('select');
        choicesSelect.id = `${prefix}AddressChoices`;
        choicesSelect.className = 'address-completion-choices';
        choicesSelect.hidden = choicesLabel.hidden = true;
        status.append(label, retry, choicesLabel, choicesSelect);
        const form = createAddressCompletion({ fields, request, prefilledAddress: prefix === 'edit', invalidMessage: text('invalid'), uuid: () => windowRef.crypto.randomUUID(), includeNumber: prefix === 'restitutionTransfer', isActive: () => isVisible(fields.postalCode),
            report(value, candidates = []) {
                label.textContent = text(value);
                status.hidden = !value || value === 'matched';
                retry.hidden = !['unavailable', 'unconfirmed'].includes(value);
                choicesSelect.hidden = choicesLabel.hidden = !candidates.length;
                choicesSelect.replaceChildren();
                if (!candidates.length) return;
                const prompt = documentRef.createElement('option');
                prompt.textContent = text('choose');
                prompt.value = '';
                prompt.disabled = true;
                prompt.selected = true;
                choicesSelect.append(prompt);
                candidates.forEach((candidate, index) => {
                    const option = documentRef.createElement('option');
                    option.value = String(index);
                    const suffix = candidate.houseNumberAddition === null ? ` (${text('unknownAddition')})` : candidate.houseNumberAddition ? ` ${candidate.houseNumberAddition}` : '';
                    option.textContent = `${candidate.street} ${candidate.houseNumber}${suffix} — ${candidate.postalCode} ${candidate.city}`;
                    choicesSelect.append(option);
                });
                choicesSelect.size = Math.min(5, candidates.length + 1);
            }
        });
        status.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                status.hidden = true;
                fields.city.focus();
                event.preventDefault();
            }
        });
        choicesSelect.addEventListener('change', () => { if (choicesSelect.value !== '') form.select(Number(choicesSelect.value)); });
        retry.addEventListener('click', () => form.retry());
        forms.set(prefix, form);
        return form;
    }

    documentRef.addEventListener('input', (event) => {
        const prefix = prefixes.find((value) => ['PostalCode', 'HouseNumber', 'HouseExt', 'Address', 'City'].some((suffix) => event.target.id === value + suffix));
        if (!prefix) return;
        let form = forms.get(prefix);
        if (!form || !activeForms.has(form)) form = attach(prefix);
        if (!form) return;
        const manual = event.target === form.fields.street || event.target === form.fields.city || event.target === form.fields.addition;
        if (manual) form.manualInput(event.target === form.fields.street ? 'street' : event.target === form.fields.city ? 'city' : 'addition');
        else form.input();
    });
    const approvedSubmits = new WeakSet();
    const pendingSubmits = new WeakSet();
    documentRef.addEventListener('submit', async (event) => {
        const root = event.target;
        if (approvedSubmits.delete(root)) return;
        const addressForms = prefixes.map((prefix) => {
            const field = documentRef.getElementById(`${prefix}PostalCode`);
            if (!field || !root.contains(field) || !isVisible(field)) return null;
            return forms.get(prefix) || attach(prefix);
        }).filter(Boolean);
        if (!addressForms.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (pendingSubmits.has(root)) return;
        pendingSubmits.add(root);
        try {
            for (const form of addressForms) {
                if (!await form.validate()) {
                    (form.fields.addition || form.fields.houseNumber).reportValidity?.();
                    return;
                }
            }
            approvedSubmits.add(root);
            root.requestSubmit(event.submitter || undefined);
            approvedSubmits.delete(root);
        } finally { pendingSubmits.delete(root); }
    }, true);
    windowRef.kiwiAddressCompletion = { getSubmission: (prefix) => getAddressSubmission(prefix, documentRef) };
    documentRef.addEventListener('reset', (event) => endAddressSessions(event.target));
    // Role changes, copied addresses and modal closure can hide or replace a form without submitting it.
    const observer = new windowRef.MutationObserver(() => {
        for (const [prefix, form] of forms) {
            if (!isVisible(form.fields.postalCode) || !activeForms.has(form)) {
                form.destroy();
                forms.delete(prefix);
            }
        }
    });
    observer.observe(documentRef.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['style', 'hidden', 'class', 'disabled'] });
    windowRef.addEventListener('pagehide', () => endAddressSessions());
    return () => { observer.disconnect(); endAddressSessions(); };
}
