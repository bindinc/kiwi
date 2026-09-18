import { renderAddressFields, sourceAddressValues, sourceAddressChanges, sourceAddressInputName } from './address-fields.js';
import { endAddressSessions } from './address-completion.js';

const sections = {
    person: { title: 'Persoonsgegevens', path: 'profile', fields: { firstName: 'Voornaam', initials: 'Initialen', surName: 'Tussenvoegsel', lastName: 'Achternaam', salutation: 'Aanhef', birthDay: 'Geboortedatum' } },
    address: { title: 'Adres', path: 'addresses' },
    email: { title: 'E-mail', path: 'emails', fields: { emailAddress: 'E-mailadres' } },
    phone: { title: 'Vaste telefoon', path: 'phones', fields: { areaCode: 'Netnummer', number: 'Telefoonnummer' } },
    mobile: { title: 'Mobiel', path: 'mobiles', fields: { areaCode: 'Netnummer', number: 'Mobiel nummer' } },
    bank: { title: 'Bankrekeningen', path: 'bank-accounts', fields: { iban: 'Nieuw IBAN', bic: 'BIC (optioneel)' } }
};

export function mutationPath(personId, section, resourceId = null) {
    const config = sections[section];
    if (!config) throw new Error('Onbekend onderdeel');
    const resource = section === 'person' || resourceId === null ? '' : `/${encodeURIComponent(resourceId)}`;
    return `/api/v1/persons/${encodeURIComponent(personId)}/${config.path}${resource}`;
}

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
}

export async function openCustomerEditor(customer, { api, refresh, isCurrent = () => true }) {
    const dialog = element('dialog', '', 'form-lightbox customer-editor');
    const card = element('div', '', 'card onepager-container');
    const header = element('div', '', 'form-header');
    const title = element('h2', 'Klantgegevens');
    title.id = 'customer-editor-title';
    dialog.setAttribute('aria-labelledby', title.id);
    const context = element('p', `${customer.firstName || customer.initials || ''} ${customer.middleName || ''} ${customer.lastName || ''} · ${customer.personNumber || customer.personId || customer.id} · ${customer.mandant || ''}`);
    const close = element('button', '✕', 'btn-close');
    close.setAttribute('aria-label', 'Sluiten');
    close.type = 'button';
    const status = element('p', 'Klantgegevens laden…');
    status.setAttribute('role', 'status');
    const content = element('div');
    const actions = element('div', '', 'form-actions');
    const dismiss = element('button', 'Sluiten', 'btn btn-secondary');
    dismiss.type = 'button';
    actions.append(dismiss);
    header.append(title, close);
    card.append(header, context, status, content, actions);
    dialog.append(card);
    document.body.append(dialog);
    const abort = new AbortController();
    let dirty = false;
    let saving = false;
    let requiresReload = false;
    let lockedControls = [];
    function unlockOtherSections() {
        for (const [control, disabled] of lockedControls) control.disabled = disabled;
        lockedControls = [];
    }
    function lockOtherSections(activeRegion) {
        if (lockedControls.length) return;
        for (const region of content.children) {
            if (region === activeRegion) continue;
            for (const tag of ['input', 'button', 'select']) {
                for (const control of region.querySelectorAll(tag)) {
                    lockedControls.push([control, control.disabled]);
                    control.disabled = true;
                }
            }
        }
    }
    function canClose() {
        return !saving && (!dirty || window.confirm('Niet-opgeslagen wijzigingen sluiten?'));
    }
    function requestClose() {
        if (canClose()) dialog.close();
    }
    close.addEventListener('click', requestClose);
    dismiss.addEventListener('click', requestClose);
    dialog.addEventListener('cancel', (event) => { if (!canClose()) event.preventDefault(); });
    dialog.addEventListener('close', () => { abort.abort(); endAddressSessions(dialog); dialog.remove(); });
    dialog.showModal();
    const personId = String(customer.personId || customer.id);
    const credentialKey = customer.credentialKey;
    const readUrl = `/api/v1/persons/${encodeURIComponent(personId)}/editing?credentialKey=${encodeURIComponent(credentialKey)}`;

    async function load() {
        const model = await api.get(readUrl, { signal: abort.signal });
        if (!dialog.open || !isCurrent()) return;
        unlockOtherSections();
        endAddressSessions(content);
        content.replaceChildren();
        requiresReload = false;
        status.textContent = Object.values(model.capabilities.operations).some((item) => item.enabled)
            ? 'Sla wijzigingen per onderdeel op.'
            : model.capabilities.roleCanWrite
            ? 'Bewerken is tijdelijk niet beschikbaar. De gegevens hieronder zijn alleen-lezen.'
            : 'Je rol geeft alleen leestoegang tot deze klantgegevens.';
        for (const [section, config] of Object.entries(sections)) renderSection(section, config, model);
    }

    function renderSection(section, config, model) {
        const region = element('section');
        region.append(element('h3', config.title));
        const items = model.sections[section] || [];
        const select = element('select', '', 'form-control');
        select.setAttribute('aria-label', `${config.title} kiezen`);
        const placeholder = element('option', items.length ? 'Kies het te bekijken onderdeel' : 'Geen gegevens beschikbaar');
        placeholder.value = '';
        select.append(placeholder);
        items.forEach((item, index) => {
            const summary = item.maskedIban || Object.values(item.fields).filter(Boolean).join(' · ');
            const option = element('option', `${summary || 'Geen waarde'}${item.id === null ? ' (alleen-lezen)' : ''}`);
            option.value = String(index);
            select.append(option);
        });
        if (section === 'bank') {
            const option = element('option', 'Nieuwe bankrekening');
            option.value = 'new';
            select.append(option);
        }
        const form = element('form');
        const feedback = element('p');
        feedback.setAttribute('role', 'status');
        region.append(select, form, feedback);
        content.append(region);

        let previousSelection = '';
        let submitListener = null;
        function choose() {
            endAddressSessions(form);
            form.replaceChildren();
            feedback.textContent = '';
            if (select.value === '') return;
            const create = select.value === 'new';
            const item = create ? { id: null, fields: {} } : items[Number(select.value)];
            const operation = `${section}.${create ? 'create' : 'update'}`;
            const permitted = model.capabilities.operations[operation]?.enabled === true;
            const hasIdentity = create || item.id !== null;
            const domesticAddress = section !== 'address' || item.fields.isoCountryCode === 'NL';
            const editable = permitted && hasIdentity && Boolean(model.version) && !requiresReload && domesticAddress;
            const controls = {};
            const initialAddress = section === 'address' ? sourceAddressValues(item.fields) : null;
            if (initialAddress) {
                const address = element('div');
                address.innerHTML = renderAddressFields('customerEditorAddress', { source: true });
                form.append(address);
                for (const [suffix, value] of Object.entries(initialAddress)) {
                    const input = address.querySelector(`#customerEditorAddress${suffix}`);
                    input.name = sourceAddressInputName(suffix);
                    input.value = value;
                    input.readOnly = !editable || ['HouseExt', 'CountryCode'].includes(suffix);
                    controls[suffix] = input;
                }
                const markDirty = () => { if (editable) { dirty = true; lockOtherSections(region); } };
                address.addEventListener('input', markDirty);
                address.addEventListener('change', markDirty);
            } else {
                for (const [field, label] of Object.entries(config.fields)) {
                    const row = element('label', label);
                    const input = element('input', '', 'form-control');
                    input.name = field;
                    input.type = field === 'birthDay' ? 'date' : field === 'emailAddress' ? 'email' : 'text';
                    input.value = item.fields[field] || '';
                    input.readOnly = !editable;
                    input.autocomplete = 'off';
                    input.setAttribute('data-feedback-sensitive', field);
                    input.addEventListener('input', () => { dirty = true; lockOtherSections(region); });
                    controls[field] = input;
                    row.append(input);
                    form.append(row);
                }
            }
            if (section === 'bank' && !create) form.prepend(element('p', `Huidige rekening: ${item.maskedIban}`));
            const save = element('button', create ? 'Bankrekening toevoegen' : `${config.title} opslaan`, 'btn btn-primary');
            save.type = 'submit';
            save.disabled = !editable;
            form.append(save);
            const reset = element('button', 'Wijzigingen herstellen', 'btn btn-secondary');
            reset.type = 'button';
            reset.disabled = !editable;
            reset.addEventListener('click', () => {
                if (saving) return;
                endAddressSessions(form);
                for (const [field, input] of Object.entries(controls)) input.value = (initialAddress || item.fields)[field] || '';
                dirty = false;
                unlockOtherSections();
            });
            form.append(reset);
            if (!editable) feedback.textContent = !hasIdentity ? 'Dit onderdeel kan op dit moment niet veilig worden gewijzigd.' : 'Opslaan is voor dit onderdeel niet beschikbaar.';
            if (section === 'bank' && !create) {
                const remove = element('button', 'Bankrekening verwijderen', 'btn btn-secondary');
                remove.type = 'button';
                remove.disabled = !model.capabilities.operations['bank.delete']?.enabled || !item.deletionAllowed || !hasIdentity || !model.version;
                remove.addEventListener('click', () => submit('bank.delete', 'DELETE', {}, item));
                form.append(remove);
                form.append(element('p', 'Verwijderen is alleen mogelijk nadat is vastgesteld dat de rekening niet meer gekoppeld is.'));
            }
            if (submitListener) form.removeEventListener('submit', submitListener);
            submitListener = (event) => {
                event.preventDefault();
                if (!editable || saving) return;
                const values = Object.fromEntries(Object.entries(controls).map(([field, input]) => [field, input.value]));
                const changes = initialAddress ? sourceAddressChanges(initialAddress, values) : {};
                if (!initialAddress) {
                    for (const [field, value] of Object.entries(values)) {
                        if (value !== (item.fields[field] || '')) changes[field] = value;
                    }
                }
                if (!Object.keys(changes).length) { feedback.textContent = 'Er zijn geen wijzigingen.'; return; }
                if (section === 'bank' && !changes.iban) { feedback.textContent = 'Vul het volledige nieuwe IBAN in.'; controls.iban.focus(); return; }
                submit(operation, create ? 'POST' : 'PATCH', changes, item);
            };
            form.addEventListener('submit', submitListener);
            async function submit(action, method, changes, selected) {
                if (saving || requiresReload || !isCurrent()) return;
                if (section === 'bank' && !window.confirm(method === 'DELETE'
                    ? `Bankrekening ${selected.maskedIban} verwijderen?`
                    : `Bankgegevens voor ${customer.lastName || 'deze klant'} opslaan? Controleer het ingevoerde IBAN.`)) return;
                saving = true;
                close.disabled = true;
                dismiss.disabled = true;
                select.disabled = true;
                for (const button of form.querySelectorAll('button')) button.disabled = true;
                feedback.textContent = 'Bezig met opslaan…';
                try {
                    await api.request(method, mutationPath(personId, section, create ? null : selected.id),
                        { credentialKey, expectedVersion: model.version, changes },
                        { headers: { 'Idempotency-Key': crypto.randomUUID() } });
                    // Readback is mandatory. Never patch a local customer to simulate success.
                    await load();
                    if (isCurrent()) await refresh();
                    dirty = false;
                    status.textContent = 'Opgeslagen en opnieuw uit de bron geladen.';
                } catch (error) {
                    requiresReload = true;
                    const code = error.payload?.error?.code;
                    feedback.textContent = ['duplicate_mutation', 'mutation_outcome_unknown'].includes(code)
                        ? 'De uitkomst is onzeker. Sluit dit venster en laad de klant opnieuw voordat je verdergaat.'
                        : error.status === 409 || error.status === 428
                            ? 'Opslaan is geblokkeerd. Laad de klant opnieuw; er wordt niets automatisch overschreven.'
                            : 'Opslaan is niet bevestigd. Controleer de invoer of laad de klant opnieuw.';
                    const invalidField = error.payload?.error?.details?.field;
                    Object.values(controls).find(input => input.name === invalidField)?.focus();
                    // No automatic retry after an error; reloading starts a fresh version.
                } finally {
                    saving = false;
                    close.disabled = false;
                    dismiss.disabled = false;
                    select.disabled = false;
                }
            }
        }
        select.addEventListener('change', () => {
            if (dirty && !window.confirm('Niet-opgeslagen wijzigingen in dit onderdeel verlaten?')) { select.value = previousSelection; return; }
            previousSelection = select.value;
            dirty = false;
            unlockOtherSections();
            choose();
        });
        // Person is a single object; contact and bank collections always require selection.
        if (section === 'person' && items.length === 1) { select.value = '0'; previousSelection = '0'; choose(); }
    }
    try { await load(); } catch (error) {
        if (!abort.signal.aborted) status.textContent = 'Klantgegevens konden niet worden geladen. Sluit dit venster en probeer opnieuw.';
    }
}
