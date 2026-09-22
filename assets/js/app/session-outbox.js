import { outboxIcon, outboxIconButton, outboxSessionRow } from './outbox-presentation.js';
import { clearFormDraft } from './lightbox-drafts.js';
// The server owns deadlines, membership and revisions. This module holds only the current editor context.
const sessions = new Map();
const pendingRequests = new Map();
const newCustomerSessions = new Map();
let editing = null;
let saveNotice = false;
let loading = false;
let dirty = false;
let polling = null;
let editorController = null;
let pageOffset = 0;
const endpoint = '/api/v1/outbox-sessions';
const labels = { pending: 'Wacht op verzending', paused: 'Gepauzeerd', ready: 'Klaar voor verwerking', processing: 'Wordt verwerkt', completed: 'Verwerkt', failed: 'Verwerking gestopt', uncertain: 'Uitkomst controleren', cancelled: 'Verwijderd' };

export function isBusinessWrite(method, url) {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return false;
    if (/^\/api\/v1\/persons\/(subscription-summaries|state)$/.test(url)) return false;
    return url === '/api/v1/call-session/disposition' || /^\/api\/v1\/(persons|subscriptions|workflows)(\/|$)/.test(url);
}

function key(reference) {
    return JSON.stringify(['personId', 'credentialKey', 'sourceSystem', 'divisionId', 'mandant'].map(field => String(reference?.[field] || '')));
}

function uuid() { return globalThis.crypto.randomUUID(); }
function api() { return globalThis.window?.kiwiApi; }
function node(id) { return globalThis.document?.getElementById(id); }
function message(text, error = false) {
    const target = node('sessionOutboxStatus');
    if (target) { target.textContent = text; target.classList.toggle('is-error', error); }
}

export function prepareWrite(method, url, payload, context) {
    if (!isBusinessWrite(method, url)) return {};
    const fingerprint = JSON.stringify([method, url, payload]);
    let id = pendingRequests.get(fingerprint);
    if (!id) { id = payload?.submissionId || uuid(); pendingRequests.set(fingerprint, id); }
    const headers = { 'Idempotency-Key': id };
    const newCustomerKey = newCustomerIdentity(url, payload, context);
    if (newCustomerKey) headers['X-Kiwi-New-Customer-Id'] = newCustomerKey;
    const targetId = payload?.recipient?.personId ?? payload?.customerId ?? context?.customerReference?.personId;
    const reference = context?.customerReference;
    const session = newCustomerKey ? newCustomerSessions.get(newCustomerKey)
        : String(targetId) === String(reference?.personId) ? sessions.get(key(reference)) : null;
    // A closed session starts a successor; a paused session stays paused until explicit Resume.
    const open = session && ['pending', 'paused'].includes(session.status)
        && (session.status === 'paused' || Date.parse(session.availableAt) > Date.now() + (session.clockOffset || 0));
    if (open) {
        headers['X-Kiwi-Outbox-Id'] = String(session.id);
        headers['X-Kiwi-Outbox-Revision'] = String(session.revision);
    }
    if (editing && editing.url === url && editing.method === method) {
        headers['X-Kiwi-Change-Id'] = editing.change.id;
        headers['X-Kiwi-Outbox-Id'] = String(editing.item.id);
        headers['X-Kiwi-Outbox-Revision'] = String(editing.item.revision);
    }
    if (newCustomerKey && open && url === '/api/v1/persons') {
        const creation = session.changes?.find(change => change.operation === 'createCustomer');
        if (creation) headers['X-Kiwi-Change-Id'] = creation.id;
    }
    return headers;
}

function newCustomerIdentity(url, payload, context) {
    const person = url === '/api/v1/persons' ? payload
        : url === '/api/v1/workflows/subscription' && !payload?.recipient?.personId ? payload?.recipient?.person
        : url === '/api/v1/workflows/article-order' && !payload?.customerId ? payload?.customer : null;
    if (!person) return null;
    return person.formSessionId || context?.workflowSessionId || null;
}

export function acceptWrite(method, url, payload, response, context) {
    if (!response?.outbox) return;
    pendingRequests.delete(JSON.stringify([method, url, payload]));
    const session = response.outbox;
    session.clockOffset = Date.parse(session.serverTime) - Date.now();
    sessions.set(key(session.customerReference), session);
    const newCustomerKey = newCustomerIdentity(url, payload, context);
    if (newCustomerKey) newCustomerSessions.set(newCustomerKey, session);
    if (context && !window.kiwiCustomerWorkSession?.isCurrent?.(context)) return;
    dirty = false;
    editing = null;
    saveNotice = true;
    message('Opgeslagen in outbox · nog niet verwerkt.');
    renderChanges(session);
    void refreshOutbox();
}

export function rejectWrite(method, url, payload, status) {
    if (status >= 400 && status < 500) pendingRequests.delete(JSON.stringify([method, url, payload]));
}

function reportError(error) {
    message(error.message, true);
    window.showToast?.(error.message, 'error');
}

function iconButton(label, name, callback) {
    return outboxIconButton(label, name, callback, reportError);
}

function button(label, callback) {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'btn btn-secondary';
    element.textContent = label;
    element.addEventListener('click', () => { void Promise.resolve(callback()).catch(error => message(error.message)); });
    return element;
}

async function action(item, name) {
    const result = await api().post(`${endpoint}/${item.id}/${name}`, {}, { skipCustomerContext: true, headers: {
        'Idempotency-Key': uuid(), 'X-Kiwi-Outbox-Revision': String(item.revision)
    } });
    result.clockOffset = Date.parse(result.serverTime) - Date.now();
    sessions.set(key(result.customerReference), result);
    return result;
}

export async function reopen(item) {
    if (dirty && !window.confirm('Er staat onopgeslagen invoer klaar. Deze invoer verwerpen en de opgeslagen sessie openen?')) return;
    const active = window.kiwiCustomerWorkSession;
    if (active && !await active.endCustomerWorkSession()) return;
    const restored = await action(item, 'reopen');
    const source = restored.customers.find(customer => String(customer.id) === restored.customerReference.personId)
        || { ...restored.customerReference, id: restored.customerReference.personId };
    await window.kiwiCustomerDetailSlice?.selectCustomer(source.id, { sourceCustomer: source, requireFresh: true });
    dirty = false;
    message('Sessie heropend · gepauzeerd tot je hervat.');
    renderChanges(restored);
    await refreshOutbox();
}

function renderChanges(item) {
    const target = node('sessionOutboxChanges');
    if (!target) return;
    target.replaceChildren();
    const heading = document.createElement('h3');
    heading.textContent = 'Opgeslagen wijzigingen';
    const context = document.createElement('p');
    context.className = 'session-outbox-caption';
    context.textContent = `${item.summary.customer} · ${item.contributors.map(actor => item.contributorLabels?.[actor] || actor).join(', ')}`;
    target.append(heading, context);
    for (const [index, change] of item.changes.entries()) {
        const row = document.createElement('div');
        row.className = 'session-outbox-change';
        const number = document.createElement('span');
        number.className = 'session-outbox-sequence';
        number.textContent = String(index + 1).padStart(2, '0');
        const label = document.createElement('span');
        label.textContent = operationLabel(change.operation);
        row.append(number, label);
        if (item.capabilities.edit) {
            const edit = iconButton(`${operationLabel(change.operation)} bewerken`, 'edit', () => openChangeEditor(item, change));
            edit.classList.add('session-outbox-reveal');
            row.append(edit);
        }
        target.append(row);
    }
    target.hidden = false;
    if (node('customerSessionChanges')) node('customerSessionChanges').hidden = false;
}

function operationLabel(operation) {
    return ({createCustomer: 'Nieuwe klant', updateCustomer: 'Klantgegevens', createContactHistoryEntry: 'Contactregistratie', updateDeliveryRemarks: 'Bezorgvoorkeuren', createEditorialComplaint: 'Redactie-item', updateSubscription: 'Abonnementswijziging', createSubscriptionComplaint: 'Bezorgklacht', completeWinback: 'Winback', processDeceasedActions: 'Overlijdensafhandeling', completeRestitutionTransfer: 'Restitutie / overdracht', createArticleOrder: 'Artikelbestelling', 'subscription.create': 'Nieuw abonnement'})[operation] || operation;
}

// Correct one saved command through its original validated HTTP endpoint.
export function changeRequest(change) {
    const args = change.arguments;
    const id = args[0];
    const person = `/api/v1/persons/${id}`;
    const subscription = `/api/v1/subscriptions/${id}/${args[1]}`;
    switch (change.operation) {
    case 'createCustomer': return ['POST', '/api/v1/persons', args[0]];
    case 'updateCustomer': return ['PATCH', person, args[1]];
    case 'createContactHistoryEntry': return ['POST', `${person}/contact-history`, args[1]];
    case 'updateDeliveryRemarks': return ['PUT', `${person}/delivery-remarks`, { default: args[1] }];
    case 'createEditorialComplaint': return ['POST', `${person}/editorial-complaints`, args[1]];
    case 'updateSubscription': return ['PATCH', subscription, args[2]];
    case 'createSubscriptionComplaint': return ['POST', `${subscription}/complaint`, { reason: args[2] }];
    case 'completeWinback': return ['POST', subscription, { result: args[2], offer: args[3] }];
    case 'processDeceasedActions': return ['POST', `/api/v1/subscriptions/${id}/deceased-actions`, { actions: args[1] }];
    case 'completeRestitutionTransfer': return ['POST', `${subscription}/restitution-transfer`, { transferData: args[2] }];
    case 'createArticleOrder': return ['POST', '/api/v1/workflows/article-order', { customerId: id, customer: args[1], order: args[2], contactEntry: args[3] }];
    case 'subscription.create': {
        const payload = structuredClone(args[0]);
        if (payload.requester.sameAsRecipient) payload.requester = { sameAsRecipient: true };
        payload.subscription.status = payload.subscription.requestedStatus;
        return ['POST', '/api/v1/workflows/subscription', payload];
    }
    default: throw new Error('Deze wijziging kan niet worden hersteld.');
    }
}

async function openChangeEditor(item, change) {
    const [method, url, payload] = changeRequest(change);
    editing = { item, change, method, url };
    // Reuse the established customer, subscription and delivery editors for their domain fields.
    if (change.operation === 'updateCustomer' && window.editCustomer) {
        clearFormDraft(node('editCustomerForm'));
        window.editCustomer();
        return;
    }
    if (change.operation === 'updateSubscription' && window.editSubscription) {
        clearFormDraft(node('editSubscriptionForm'));
        window.editSubscription(change.arguments[1]);
        return;
    }
    if (change.operation === 'updateDeliveryRemarks' && window.kiwiDeliveryRemarksSlice) {
        window.kiwiDeliveryRemarksSlice.editDeliveryRemarks();
        return;
    }
    if (change.operation === 'createArticleOrder' && window.kiwiOrderSlice) {
        clearFormDraft(node('articleSaleForm'));
        await window.kiwiOrderSlice.restoreOutboxOrder(payload);
        return;
    }
    if (change.operation === 'createEditorialComplaint' && window.showEditorialComplaintForm) {
        clearFormDraft(node('editorialComplaintForm'));
        window.showEditorialComplaintForm();
        for (const name of ['magazine', 'type', 'category', 'description', 'edition']) {
            node(`editorialComplaint${name[0].toUpperCase()}${name.slice(1)}`).value = payload[name] || '';
        }
        node('editorialComplaintFollowup').checked = !!payload.followup;
        return;
    }
    if (change.operation === 'createSubscriptionComplaint' && window.showResendMagazine) {
        clearFormDraft(node('resendMagazineForm'));
        window.showResendMagazine();
        node('resendSubscription').value = change.arguments[1];
        node('resendReason').value = payload.reason;
        return;
    }
    if (change.operation === 'subscription.create' && window.showNewSubscription) {
        clearFormDraft(node('newSubscriptionForm'));
        window.showNewSubscription();
        const subscription = payload.subscription;
        node('subStartDate').value = subscription.startDate;
        node('subIBAN').value = subscription.iban || '';
        for (const [name, value] of Object.entries({ subPayment: subscription.paymentMethod,
            subOptinEmail: payload.recipient.person.optinEmail, subOptinPhone: payload.recipient.person.optinPhone,
            subOptinPost: payload.recipient.person.optinPost })) {
            for (const input of document.getElementsByName(name)) input.checked = input.value === String(value);
        }
        try {
            await window.kiwiWerfsleutelSlice.restoreOutboxOffer(payload.offer);
        } finally {
            window.kiwiSubscriptionRoleRuntime.restoreOutboxSubscriptionRoles(payload);
        }
        return;
    }
    const dialog = node('sessionOutboxEditor');
    const fields = node('sessionOutboxEditorFields');
    fields.replaceChildren();
    node('sessionOutboxEditorTitle').textContent = operationLabel(change.operation);
    const copy = structuredClone(payload);
    renderFields(fields, copy);
    editing = { item, change, method, url };
    const form = dialog.querySelector('form');
    editorController?.abort();
    editorController = new AbortController();
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"]');
        submit.disabled = true;
        try {
            await api().request(method, url, copy, { headers: {
                'X-Kiwi-Outbox-Id': String(item.id),
                'X-Kiwi-Outbox-Revision': String(item.revision),
                'X-Kiwi-Change-Id': change.id
            } });
            dialog.close();
            message('Correctie opgeslagen in outbox. De sessie blijft gepauzeerd.');
        } catch (error) {
            node('sessionOutboxEditorError').textContent = error.message;
        } finally { submit.disabled = false; }
    }, { signal: editorController.signal });
    node('sessionOutboxEditorError').textContent = '';
    dialog.showModal();
}

const fieldLabels = { address: 'Adres', addressExtension: 'Interne toevoeging', landlinePhone: 'Vaste telefoon', mobilePhone: 'Mobiele telefoon', action: 'Actie', title: 'Aanbod', couponCode: 'Kortingscode', firstName: 'Voornaam', middleName: 'Tussenvoegsel', lastName: 'Achternaam', salutation: 'Aanhef', birthday: 'Geboortedatum', postalCode: 'Postcode', houseNumber: 'Huisnummer', houseNumberAddition: 'Toevoeging', street: 'Straat', city: 'Plaats', countryCode: 'Landcode', email: 'E-mailadres', phone: 'Telefoon', default: 'Bezorgvoorkeur', description: 'Omschrijving', reason: 'Reden', result: 'Resultaat', startDate: 'Startdatum', status: 'Status', magazine: 'Magazine', duration: 'Looptijd', paymentMethod: 'Betaalmethode', iban: 'IBAN', notes: 'Opmerkingen', quantity: 'Aantal', desiredDeliveryDate: 'Gewenste bezorgdatum', type: 'Type', category: 'Categorie', edition: 'Editie', followup: 'Terugkoppeling', optinEmail: 'E-mailtoestemming', optinPhone: 'Telefoontoestemming', optinPost: 'Posttoestemming' };
function renderFields(parent, object) {
    for (const [name, value] of Object.entries(object)) {
        if (value && typeof value === 'object') {
            const group = document.createElement('fieldset');
            const legend = document.createElement('legend');
            legend.textContent = ({ recipient: 'Ontvanger', requester: 'Aanvrager', person: 'Persoonsgegevens', subscription: 'Abonnement', offer: 'Aanbieding', order: 'Bestelling', contactEntry: 'Contactregistratie', transferData: 'Overdrachtsgegevens', actions: 'Acties', items: 'Artikelen' })[name] || 'Gegevens';
            group.append(legend);
            renderFields(group, value);
            if (group.querySelector('input, select')) parent.append(group);
            continue;
        }
        if (!fieldLabels[name]) continue;
        const label = document.createElement('label');
        label.textContent = fieldLabels[name];
        const input = document.createElement('input');
        input.type = typeof value === 'boolean' ? 'checkbox' : typeof value === 'number' ? 'number' : 'text';
        if (input.type === 'checkbox') input.checked = value;
        else input.value = value ?? '';
        input.addEventListener('input', () => {
            object[name] = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
            dirty = true;
        });
        label.append(input);
        parent.append(label);
    }
}

export async function refreshOutbox() {
    const list = node('subscriptionQueueList');
    if (!list || !api() || loading) return;
    loading = true;
    try {
        const response = await api().get(`${endpoint}?limit=20&offset=${pageOffset}`, { skipCustomerContext: true });
        if (!dirty && !editing && pageOffset === 0 && response.total <= 20) sessions.clear();
        // Do not replace a menu while someone is choosing an action.
        if (list.querySelector(':popover-open')) return;
        list.replaceChildren();
        for (const item of response.items) {
            item.clockOffset = Date.parse(item.serverTime) - Date.now();
            // Do not silently refresh the revision of an editor with unsaved input.
            if (!dirty && !editing) sessions.set(key(item.customerReference), item);
            const actions = [];
            if (item.capabilities.edit) actions.push({label: 'Bewerken', icon: 'edit', run: () => reopen(item)});
            if (item.capabilities.pause && item.status === 'pending') actions.push({label: 'Pauzeren', icon: 'pause', run: async () => { await action(item, 'pause'); await refreshOutbox(); }});
            if (item.capabilities.resume && item.status === 'paused') actions.push({label: 'Hervatten', icon: 'resume', run: async () => {
                if (dirty) throw new Error('Sla je invoer op voordat je de verzending hervat.');
                await action(item, 'resume'); await refreshOutbox();
            }});
            if (item.capabilities.delete) actions.push({label: 'Verwijderen', icon: 'delete', run: async () => {
                if (window.confirm(`Alle ${item.summary.changeCount} wijzigingen voor ${item.summary.customer} verwijderen, inclusief bijdragen van anderen?`)) {
                    await action(item, 'cancel'); await refreshOutbox();
                }
            }});
            list.append(outboxSessionRow(item, labels[item.status] || item.status, () => reopen(item), actions, reportError));
        }
        const empty = node('subscriptionQueueEmpty');
        if (empty) empty.hidden = response.items.length > 0;
        const meta = node('subscriptionQueueMeta');
        if (meta) meta.textContent = `${response.total} opgeslagen sessie${response.total === 1 ? '' : 's'}`;
        const pages = node('sessionOutboxPages');
        if (pages) {
            pages.replaceChildren();
            if (pageOffset > 0) pages.append(button('Vorige', async () => { pageOffset -= 20; await refreshOutbox(); }));
            if (pageOffset + 20 < response.total) pages.append(button('Volgende', async () => { pageOffset += 20; await refreshOutbox(); }));
        }
    } catch (error) {
        message(`Outbox niet vernieuwd; getoonde gegevens kunnen verouderd zijn. ${error.message}`, true);
    } finally { loading = false; }
}

async function loadHistoricalOrders() {
    const target = node('sessionOutboxHistorical');
    if (!target || !api()) return;
    try {
        const response = await api().get('/api/v1/workflows/subscription?limit=20', {skipCustomerContext:true});
        for (const order of response.items) {
            const line = document.createElement('p');
            line.textContent = order.display?.line || 'Historische abonnementsaanvraag';
            target.append(line);
        }
        target.hidden = response.items.length === 0;
    } catch { /* The live session list remains usable if historical storage is unavailable. */ }
}

export function initializeSessionOutbox() {
    if (typeof window === 'undefined' || typeof document === 'undefined' || polling) return;
    window.kiwiOutbox = { prepareWrite, acceptWrite, rejectWrite, refreshOutbox,
        isCorrectingNewCustomerOrder() { return editing?.change.operation === 'createArticleOrder' && editing.change.arguments[0] === null; },
        isCorrectingSubscription() { return editing?.change.operation === 'subscription.create'; },
        acceptRead(response) {
            if (!response?.outboxSession || dirty || editing) return;
            const session = response.outboxSession;
            session.clockOffset = Date.parse(session.serverTime) - Date.now();
            sessions.set(key(session.customerReference), session);
        },
        consumeSaveNotice() { const notice = saveNotice; saveNotice = false; return notice; } };
    document.addEventListener('input', event => {
        if (event.target.closest?.('.form-container, .customer-editor, #sessionOutboxEditor')) dirty = true;
    });
    node('sessionOutboxEditorClose')?.addEventListener('click', () => node('sessionOutboxEditor').close());
    node('sessionOutboxEditor')?.addEventListener('close', () => { editing = null; });
    node('sessionOutboxTitle')?.prepend(outboxIcon('inbox'));
    void refreshOutbox();
    void loadHistoricalOrders();
    polling = setInterval(() => {
        const panel = node('subscriptionQueuePanel');
        if (!document.hidden && panel && !panel.hidden && panel.style.display !== 'none') void refreshOutbox();
    }, 5000);
}
