import { renderAddressFields, sourceAddressValues, sourceAddressChanges, sourceAddressInputName } from './address-fields.js';
import { endAddressSessions } from './address-completion.js';
import { registerDraftCleanup } from './lightbox-drafts.js';
import { t } from '../i18n/index.js';

const sectionSensitivity = { person: 'name', address: 'address', email: 'email', phone: 'phone', mobile: 'phone', bank: 'iban' };
const editorsByDocument = new WeakMap();
let nextEditorId = 0;

const sections = {
    person: { title: 'Persoonsgegevens', path: 'profile', fields: { firstName: 'Voornaam', initials: 'Initialen', surName: 'Tussenvoegsel', lastName: 'Achternaam', salutation: 'Aanhef', birthDay: 'Geboortedatum' } },
    address: { title: 'Adres', path: 'addresses' },
    email: { title: 'E-mail', path: 'emails', fields: { emailAddress: 'E-mailadres' } },
    phone: { title: 'Vaste telefoon', path: 'phones', fields: { areaCode: 'Netnummer', number: 'Telefoonnummer' } },
    mobile: { title: 'Mobiel', path: 'mobiles', fields: { areaCode: 'Netnummer', number: 'Mobiel nummer' } },
    bank: { title: 'Bankrekeningen', path: 'bank-accounts', fields: { iban: 'Nieuw IBAN', bic: 'BIC (optioneel)' } }
};

function readonlyGenderLabel(value) {
    switch (String(value || '').trim().toLowerCase()) {
    case 'geachte heer': return 'Man';
    case 'geachte mevrouw': return 'Vrouw';
    case 'geachte heer/mevrouw': return 'Anders';
    default: return value;
    }
}

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

function recordText(tag, key, className) {
    const node = element(tag, t(`customerEditorRecords.${key}`), className);
    node.setAttribute('data-i18n', `customerEditorRecords.${key}`);
    node.setAttribute('data-feedback-public', '');
    return node;
}

export async function openCustomerEditor(customer, { api, refresh, isCurrent = () => true }) {
    let editors = editorsByDocument.get(document);
    if (!editors) {
        editors = new Map();
        editorsByDocument.set(document, editors);
    }
    const key = JSON.stringify([customer.credentialKey, String(customer.personId || customer.id)]);
    const retained = editors.get(key);
    if (retained) {
        await retained();
        return;
    }
    // Retained dialogs keep these opaque IDs, including their address-completion session key.
    const editorId = ++nextEditorId;
    const addressPrefix = `customerEditorAddress${editorId}`;
    const dialog = element('dialog', '', 'form-lightbox customer-editor');
    editors.set(key, async () => {
        dialog.showModal();
        if (loadFailed) await loadWithStatus();
    });
    const card = element('div', '', 'card onepager-container');
    const header = element('div', '', 'form-header');
    const title = element('h2', 'Klantgegevens');
    title.id = `customer-editor-title-${editorId}`;
    title.setAttribute('data-feedback-public', '');
    dialog.setAttribute('aria-labelledby', title.id);
    dialog.setAttribute('aria-describedby', `customer-editor-status-${editorId}`);
    const context = element('p', '', 'customer-editor-context');
    const name = element('span', [customer.firstName || customer.initials, customer.middleName, customer.lastName].filter(Boolean).join(' '));
    name.setAttribute('data-feedback-sensitive', 'name');
    const reference = element('span', String(customer.personNumber || customer.personId || customer.id));
    reference.setAttribute('data-feedback-sensitive', 'id');
    const source = element('span', customer.mandant || '');
    source.setAttribute('data-feedback-public', '');
    context.append(name, reference, source);
    const close = element('button', '✕', 'btn-close');
    close.setAttribute('aria-label', 'Sluiten');
    close.type = 'button';
    const status = element('p', 'Klantgegevens laden…', 'customer-editor-status');
    status.id = `customer-editor-status-${editorId}`;
    status.setAttribute('role', 'status');
    status.setAttribute('data-feedback-public', '');
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
    let loadFailed = false;
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
        return !saving;
    }
    function requestClose() {
        if (canClose()) dialog.close();
    }
    close.addEventListener('click', requestClose);
    dismiss.addEventListener('click', requestClose);
    dialog.addEventListener('cancel', (event) => { if (!canClose()) event.preventDefault(); });
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) requestClose();
    });
    registerDraftCleanup(document, () => {
        abort.abort();
        endAddressSessions(dialog);
        dialog.close();
        dialog.remove();
        editors.delete(key);
    });
    dialog.showModal();
    const personId = String(customer.personId || customer.id);
    const credentialKey = customer.credentialKey;
    const readUrl = `/api/v1/persons/${encodeURIComponent(personId)}/editing?credentialKey=${encodeURIComponent(credentialKey)}`;

    async function load() {
        const model = await api.get(readUrl, { signal: abort.signal });
        if (abort.signal.aborted || !isCurrent()) return;
        unlockOtherSections();
        endAddressSessions(content);
        content.replaceChildren();
        requiresReload = false;
        status.setAttribute('data-state', '');
        status.textContent = Object.values(model.capabilities.operations).some((item) => item.enabled)
            ? 'Sla wijzigingen per onderdeel op.'
            : model.capabilities.roleCanWrite
            ? 'Bewerken is tijdelijk niet beschikbaar. De gegevens hieronder zijn alleen-lezen.'
            : 'Je rol geeft alleen leestoegang tot deze klantgegevens.';
        for (const [section, config] of Object.entries(sections)) renderSection(section, config, model);
    }

    function renderSection(section, config, model) {
        const region = element('section');
        region.setAttribute('data-customer-section', section);
        const heading = recordText('h3', section);
        region.append(heading);
        const items = model.sections[section] || [];
        const list = element('ul', '', 'customer-editor-records');
        const detail = element('div', '', 'customer-editor-record-detail');
        detail.id = `customer-editor-${editorId}-${section}-detail`;
        detail.hidden = true;
        const selectedTitle = element('h4', '', 'customer-editor-selected-title');
        selectedTitle.id = `customer-editor-${editorId}-${section}-selected-title`;
        selectedTitle.setAttribute('data-feedback-public', '');
        const selectedSummary = element('p', '', 'customer-editor-record-summary');
        selectedSummary.setAttribute('data-feedback-sensitive', sectionSensitivity[section]);
        const form = element('form');
        form.setAttribute('aria-labelledby', selectedTitle.id);
        const feedback = element('p', '', 'customer-editor-feedback');
        feedback.id = `customer-editor-${editorId}-${section}-feedback`;
        feedback.setAttribute('role', 'status');
        feedback.setAttribute('data-feedback-public', '');
        detail.append(selectedTitle, selectedSummary, form, feedback);
        region.append(list, detail);
        content.append(region);
        const recordButtons = [];
        let selectedIndex = '';
        let submitListener = null;

        function isEditable(item, create = false) {
            const operation = `${section}.${create ? 'create' : 'update'}`;
            const permitted = model.capabilities.operations[operation]?.enabled === true;
            const hasIdentity = create || item.id !== null;
            const domesticAddress = section !== 'address' || item.fields.isoCountryCode === 'NL';
            return permitted && hasIdentity && Boolean(model.version) && !requiresReload && domesticAddress;
        }
        function summaryFor(item) {
            const readonlyPerson = section === 'person' && !isEditable(item);
            return item.maskedIban || Object.entries(item.fields).map(([field, value]) =>
                readonlyPerson && field === 'salutation' ? readonlyGenderLabel(value) : value
            ).filter(Boolean).join(' · ');
        }
        function appendRecordTitle(target, index) {
            target.append(recordText('span', section), element('span', ` ${index + 1}`));
        }
        function focusDetail() {
            form.querySelector('input')?.focus();
        }
        function selectRecord(index) {
            if (saving) return;
            if (selectedIndex === index) { focusDetail(); return; }
            if (dirty && !window.confirm(t('customerEditorRecords.discardChanges'))) {
                recordButtons.find(button => button.getAttribute('data-customer-record-index') === selectedIndex)?.focus();
                return;
            }
            selectedIndex = index;
            dirty = false;
            unlockOtherSections();
            choose();
            focusDetail();
        }
        items.forEach((item, index) => {
            const row = element('li', '', 'customer-editor-record');
            const identity = element('div', '', 'customer-editor-record-identity');
            const title = element('h4', '', 'customer-editor-record-title');
            title.id = `customer-editor-${editorId}-${section}-record-${index}-title`;
            title.setAttribute('data-feedback-public', '');
            appendRecordTitle(title, index);
            const summary = element('p', summaryFor(item), 'customer-editor-record-summary');
            if (summary.textContent) summary.setAttribute('data-feedback-sensitive', sectionSensitivity[section]);
            else summary.append(recordText('span', 'noValue'));
            const validity = recordText('p', 'validityUnavailable', 'customer-editor-record-validity');
            const action = recordText('button', isEditable(item) ? 'edit' : 'view', 'btn btn-secondary customer-editor-record-action');
            action.type = 'button';
            action.id = `customer-editor-${editorId}-${section}-record-${index}-action`;
            action.setAttribute('aria-labelledby', `${title.id} ${action.id}`);
            action.setAttribute('aria-controls', detail.id);
            action.setAttribute('aria-expanded', 'false');
            action.setAttribute('data-customer-record-index', String(index));
            action.addEventListener('click', () => selectRecord(String(index)));
            recordButtons.push(action);
            identity.append(title, summary, validity);
            row.append(identity, action);
            list.append(row);
        });
        if (!items.length) region.append(recordText('p', 'empty', 'customer-editor-empty'));
        if (section === 'bank') {
            const create = recordText('button', 'newBank', 'btn btn-secondary customer-editor-record-action');
            create.type = 'button';
            create.setAttribute('aria-controls', detail.id);
            create.setAttribute('aria-expanded', 'false');
            create.setAttribute('data-customer-record-index', 'new');
            create.addEventListener('click', () => selectRecord('new'));
            recordButtons.push(create);
            region.append(create);
        }
        function choose() {
            endAddressSessions(form);
            form.replaceChildren();
            selectedTitle.replaceChildren();
            feedback.textContent = '';
            feedback.setAttribute('data-state', '');
            detail.hidden = selectedIndex === '';
            for (const button of recordButtons) {
                button.setAttribute('aria-expanded', String(button.getAttribute('data-customer-record-index') === selectedIndex));
            }
            if (selectedIndex === '') return;
            const create = selectedIndex === 'new';
            const item = create ? { id: null, fields: {} } : items[Number(selectedIndex)];
            const operation = `${section}.${create ? 'create' : 'update'}`;
            const hasIdentity = create || item.id !== null;
            const editable = isEditable(item, create);
            if (create) selectedTitle.append(recordText('span', 'newBank'));
            else appendRecordTitle(selectedTitle, Number(selectedIndex));
            selectedSummary.textContent = create ? '' : summaryFor(item);
            const controls = {};
            const initialAddress = section === 'address' ? sourceAddressValues(item.fields) : null;
            if (initialAddress) {
                const address = element('div');
                address.innerHTML = renderAddressFields(addressPrefix, { source: true });
                form.append(address);
                for (const [suffix, value] of Object.entries(initialAddress)) {
                    const input = address.querySelector(`#${addressPrefix}${suffix}`);
                    input.setAttribute('aria-describedby', feedback.id);
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
                    const readonlyGender = !editable && section === 'person' && field === 'salutation';
                    const row = element('label', readonlyGender ? 'Geslacht' : label);
                    const input = element('input', '', 'form-control');
                    input.setAttribute('aria-describedby', feedback.id);
                    input.name = field;
                    input.id = `customer-editor-${editorId}-${section}-${field}`;
                    row.setAttribute('for', input.id);
                    input.type = field === 'birthDay' ? 'date' : field === 'emailAddress' ? 'email' : 'text';
                    const sourceValue = item.fields[field] || '';
                    input.value = readonlyGender ? readonlyGenderLabel(sourceValue) : sourceValue;
                    input.readOnly = !editable;
                    input.autocomplete = 'off';
                    input.setAttribute('data-feedback-sensitive', field);
                    input.addEventListener('input', () => { dirty = true; lockOtherSections(region); });
                    controls[field] = input;
                    row.append(input);
                    form.append(row);
                }
            }
            if (section === 'bank' && !create) {
                const currentBank = element('p', 'Huidige rekening: ');
                const bankValue = element('span', item.maskedIban);
                bankValue.setAttribute('data-feedback-sensitive', 'iban');
                currentBank.append(bankValue);
                form.prepend(currentBank);
            }
            const fieldActions = element('div', '', 'customer-editor-actions');
            form.append(fieldActions);
            const save = element('button', create ? 'Bankrekening toevoegen' : `${config.title} opslaan`, 'btn btn-primary');
            save.type = 'submit';
            save.disabled = !editable;
            fieldActions.append(save);
            const reset = element('button', 'Wijzigingen herstellen', 'btn btn-secondary');
            reset.type = 'button';
            reset.disabled = !editable;
            reset.addEventListener('click', () => {
                if (saving || !editable) return;
                endAddressSessions(form);
                for (const [field, input] of Object.entries(controls)) input.value = (initialAddress || item.fields)[field] || '';
                dirty = false;
                unlockOtherSections();
            });
            fieldActions.append(reset);
            if (!editable) feedback.textContent = !hasIdentity ? 'Dit onderdeel kan op dit moment niet veilig worden gewijzigd.' : 'Opslaan is voor dit onderdeel niet beschikbaar.';
            if (section === 'bank' && !create) {
                const remove = element('button', 'Bankrekening verwijderen', 'btn btn-secondary');
                remove.type = 'button';
                const canDelete = model.capabilities.operations['bank.delete']?.enabled === true
                    && item.deletionAllowed && hasIdentity && Boolean(model.version);
                remove.disabled = !canDelete;
                remove.addEventListener('click', () => {
                    if (canDelete) submit('bank.delete', 'DELETE', {}, item);
                });
                fieldActions.append(remove);
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
                lockOtherSections(region);
                for (const button of recordButtons) button.disabled = true;
                for (const button of form.querySelectorAll('button')) button.disabled = true;
                feedback.setAttribute('data-state', 'pending');
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
                    for (const button of content.querySelectorAll('button')) {
                        if (button.getAttribute('data-i18n') !== 'customerEditorRecords.edit') continue;
                        button.setAttribute('data-i18n', 'customerEditorRecords.view');
                        button.textContent = t('customerEditorRecords.view');
                    }
                    feedback.setAttribute('data-state', 'error');
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
                    for (const button of recordButtons) button.disabled = false;
                }
            }
        }
        // The person singleton opens immediately; collections require a direct record action.
        if (section === 'person' && items.length === 1) { selectedIndex = '0'; choose(); }

    }
    async function loadWithStatus() {
        try {
            await load();
            loadFailed = false;
        } catch (error) {
            loadFailed = true;
            if (!abort.signal.aborted) {
                status.setAttribute('data-state', 'error');
                status.textContent = 'Klantgegevens konden niet worden geladen. Sluit dit venster en probeer opnieuw.';
            }
        }
    }
    await loadWithStatus();
}
