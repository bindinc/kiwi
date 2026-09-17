const activeForms = new Set();
const prefixes = ['subRecipient', 'subRequester', 'article', 'edit', 'restitutionTransfer'];
const messages = {
    nl: { loading: 'Adres opzoeken…', matched: 'Adres aangevuld vanuit je keuze.', results: 'Kies het juiste adres.', choose: 'Kies een adres', unknownAddition: 'toevoeging niet beschikbaar', not_found: 'Geen adres gevonden. Vul straat en plaats zelf in.', ambiguous: 'Meerdere adressen gevonden. Vul straat en plaats zelf in.', unavailable: 'Adres opzoeken is tijdelijk niet beschikbaar. Vul straat en plaats zelf in.', retry: 'Opnieuw proberen' },
    en: { loading: 'Looking up address…', matched: 'Address completed from your selection.', results: 'Choose the correct address.', choose: 'Choose an address', unknownAddition: 'addition unavailable', not_found: 'No address found. Enter street and city manually.', ambiguous: 'Multiple addresses found. Enter street and city manually.', unavailable: 'Address lookup is temporarily unavailable. Enter street and city manually.', retry: 'Try again' }
};

export function normalizeAddressInput(postalCode, houseNumber) {
    const postal = postalCode.replace(/\s+/g, '').toUpperCase();
    const number = houseNumber.trim().toUpperCase();
    if (!/^[1-9][0-9]{3}[A-Z]{2}$/.test(postal) || !/^[1-9][0-9]{0,5}[A-Z]?$/.test(number)) return null;
    return { postalCode: postal, houseNumber: number.replace(/[A-Z]$/, '') };
}

export function endAddressSessions(root = null) {
    for (const form of [...activeForms]) {
        if (!root || root.contains?.(form.fields.postalCode)) form.destroy();
    }
}

export function createAddressCompletion({ fields, request, report, uuid = () => crypto.randomUUID(), schedule = setTimeout, cancel = clearTimeout, now = Date.now, isActive = () => true, includeNumber = false }) {
    let sessionId = null;
    let startedAt = 0;
    let timer = null;
    let revision = 0;
    let lastFingerprint = '';
    let automatic = null;
    let destroyed = false;
    let choices = [];
    let selected = null;
    let choicesFingerprint = '';
    const read = () => normalizeAddressInput(fields.postalCode.value, fields.houseNumber.value);
    const fingerprint = () => JSON.stringify(read());

    function closeSession() {
        if (sessionId) void request(`/sessions/${sessionId}`, { method: 'DELETE', keepalive: true }).catch(() => {});
        sessionId = null;
    }

    function reset() {
        ++revision;
        cancel(timer);
        closeSession();
        lastFingerprint = '';
        automatic = null;
        choices = [];
        selected = null;
        report('');
    }

    function input() {
        if (destroyed) return;
        const query = read();
        const changed = fingerprint() !== lastFingerprint;
        if (!changed) return;
        ++revision;
        cancel(timer);
        choices = [];
        selected = null;
        report('');
        if (changed && automatic) {
            for (const key of ['street', 'city', 'addition']) {
                if (fields[key] && fields[key].value === automatic[key]) fields[key].value = '';
            }
            automatic = null;
        }
        if (!query) {
            lastFingerprint = '';
            report('');
            return;
        }
        fields.postalCode.value = query.postalCode;
        if (!changed) return;
        timer = schedule(() => void search(query, revision), 350);
    }

    async function search(query, version) {
        if (destroyed || !isActive()) return;
        const time = now();
        const expired = time - startedAt >= 43200000 || new Date(time).toISOString().slice(0, 10) !== new Date(startedAt).toISOString().slice(0, 10);
        if (sessionId && expired) closeSession();
        if (!sessionId) {
            sessionId = uuid();
            startedAt = time;
        }
        const expectedFingerprint = JSON.stringify(query);
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
            if (Array.isArray(response.candidates) && response.candidates.length) {
                choices = response.candidates.filter((candidate) => candidate.postalCode === query.postalCode
                    && candidate.houseNumber === query.houseNumber && typeof candidate.street === 'string'
                    && typeof candidate.city === 'string' && (candidate.houseNumberAddition === null || typeof candidate.houseNumberAddition === 'string'));
                if (choices.length) {
                    choicesFingerprint = expectedFingerprint;
                    report('results', choices);
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
            automatic = { street, city: choice.city };
            fields.street.value = street;
            fields.city.value = choice.city;
            if (addition !== null && fields.addition) {
                fields.addition.value = addition;
                automatic.addition = addition;
            }
            fields.houseNumber.value = choice.houseNumber;
            report('matched', choices);
        },
        manualInput(field) {
            if (automatic) delete automatic[field];
            if (field === 'addition') {
                if (includeNumber && selected && fields.street.value === automatic?.street) {
                    const suffix = fields.addition?.value.trim() || '';
                    automatic.street = `${selected.street} ${selected.houseNumber}${suffix ? ` ${suffix}` : ''}`;
                    fields.street.value = automatic.street;
                }
                return;
            }
            choices = [];
            ++revision;
            cancel(timer);
            if (automatic) delete automatic[field];
            report('');
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
            const addressRow = fields.houseNumber.closest('.form-row') || fields.houseNumber.parentElement;
            addressRow.insertAdjacentElement('afterend', status);
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
        const form = createAddressCompletion({ fields, request, uuid: () => windowRef.crypto.randomUUID(), includeNumber: prefix === 'restitutionTransfer', isActive: () => isVisible(fields.postalCode),
            report(value, candidates = []) {
                label.textContent = text(value);
                retry.hidden = value !== 'unavailable';
                choicesSelect.hidden = choicesLabel.hidden = !candidates.length;
                if (value === 'matched') return;
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
