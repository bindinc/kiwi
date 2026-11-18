import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// theme_audit: transport acknowledgements wrap actual isolated PHP projections.
export async function loadServiceAckFixtures(sourceRoot, filename) {
    if (!filename) return null;
    const text = await readFile(filename, 'utf8'), fixtures = JSON.parse(text);
    if (fixtures.marker !== 'theme_audit' || Object.keys(fixtures.cases || {}).length !== 9) throw new Error('Expected the nine source-derived service projection fixtures.');
    for (const [file, expected] of Object.entries(fixtures.backendSourceSha256)) {
        const actual = createHash('sha256').update(await readFile(path.join(sourceRoot, file))).digest('hex');
        if (actual !== expected) throw new Error('Source-derived service projection fixture is stale: ' + file);
    }
    const sourceReportText = await readFile(fixtures.fixtureSourceReport.path, 'utf8');
    if (createHash('sha256').update(sourceReportText).digest('hex') !== fixtures.fixtureSourceReport.sha256) throw new Error('Recorded source payload report changed.');
    const declaredBaseCustomer = JSON.parse(sourceReportText).serviceEvidence.customer;
    if (declaredBaseCustomer.id !== 990701) throw new Error('Expected the recorded synthetic source customer.');
    return { ...fixtures, declaredBaseCustomer, artifact: { path: filename, sha256: createHash('sha256').update(text).digest('hex') } };
}

function canonicalJson(value) {
    if (Array.isArray(value)) return value.map(canonicalJson);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalJson(value[key])]));
    return value;
}

function requestPayload(projection) {
    const args = projection.arguments;
    switch (projection.operation) {
        case 'updateSubscription': return args[2];
        case 'createSubscriptionComplaint': return { reason: args[2] };
        case 'createEditorialComplaint': return args[1];
        case 'completeWinback': return { result: args[2], offer: args[3] };
        case 'processDeceasedActions': return { actions: args[1] };
        case 'completeRestitutionTransfer': return { transferData: args[2] };
        default: throw new Error('Unknown source-derived fixture operation.');
    }
}

function replaceOpaqueNonce(value, original, current, counter) {
    if (value === original) { counter.count++; return current; }
    if (Array.isArray(value)) return value.map(item => replaceOpaqueNonce(item, original, current, counter));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceOpaqueNonce(item, original, current, counter)]));
    return value;
}

export function buildServiceQueuedAck(fixtures, name, payload, requestHeaders) {
    const source = fixtures?.cases?.[name];
    if (!source) throw new Error('Missing source-derived successful callback fixture: ' + name);
    let projection = structuredClone(source), nonceReconciliation = null;
    if (name === 'restitution-transfer') {
        const original = source.arguments[2].formSessionId, current = payload.transferData.formSessionId;
        const valid = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
        if (!valid(original) || !valid(current)) throw new Error('Expected explicit source/current synthetic restitution form-session identifiers.');
        const counter = { count: 0 };
        projection = replaceOpaqueNonce(projection, original, current, counter);
        nonceReconciliation = { field: 'transferData.formSessionId', replacements: counter.count,
            source: 'Only the recorded opaque session identifier is replaced with the current request identifier; all projected business values come from the real PHP method.' };
        if (counter.count < 3) throw new Error('Opaque restitution session identifier was not reconciled across arguments, response and projected customer.');
    }
    if (JSON.stringify(canonicalJson(payload)) !== JSON.stringify(canonicalJson(requestPayload(projection)))) throw new Error('Current request business values differ from the recorded source-derived projection.');
    const requestKey = String(requestHeaders['idempotency-key'] || '').trim();
    if (Object.hasOwn(requestHeaders, 'x-kiwi-outbox-id') || Object.hasOwn(requestHeaders, 'x-kiwi-outbox-revision')) throw new Error('Independent single-change fixtures cannot append to an existing outbox session.');
    const hasChangeId = Object.hasOwn(requestHeaders, 'x-kiwi-change-id');
    const changeId = String(hasChangeId ? requestHeaders['x-kiwi-change-id'] : requestKey).trim();
    if (!requestKey || requestKey.length > 128 || !changeId || changeId.length > 128) throw new Error('Expected actual request idempotency/change identifiers.');
    let outboxNormalization = null;
    if (projection.operation === 'updateSubscription' && !hasChangeId) {
        const previous = fixtures.declaredBaseCustomer.subscriptions.find(item => item.id === projection.arguments[1]);
        if (!previous) throw new Error('Missing declared source subscription for outbox field normalization.');
        const fields = projection.arguments[2];
        const changed = Object.fromEntries(Object.entries(fields).filter(([field, value]) => previous[field] !== value));
        if (!Object.keys(changed).length) throw new Error('The source outbox would reject an unchanged update.');
        outboxNormalization = { source: 'Declared SessionOutbox.save no-X-Kiwi-Change-Id field-filter contract; not database execution.',
            omittedUnchangedFields: Object.keys(fields).filter(field => !Object.hasOwn(changed, field)) };
        projection.arguments[2] = changed;
    }
    const customerReference = {
        personId: requestHeaders['x-kiwi-customer-person-id'] || '', credentialKey: requestHeaders['x-kiwi-customer-credential-key'] || '',
        sourceSystem: requestHeaders['x-kiwi-customer-source-system'] || '', divisionId: requestHeaders['x-kiwi-customer-division-id'] || '', mandant: requestHeaders['x-kiwi-customer-mandant'] || ''
    };
    if (customerReference.personId !== '990701' || customerReference.sourceSystem !== 'kiwi' || customerReference.credentialKey !== '') throw new Error('Queued fixture must belong to the actual declared synthetic customer context.');
    const now = new Date(), actor = 'synthetic-theme07';
    const outbox = { id: 990799, revision: 1, status: 'pending', customerReference, creator: actor, contributors: [actor], contributorLabels: { [actor]: 'Synthetic theme audit actor' },
        availableAt: new Date(now.getTime() + 60000).toISOString(), updatedAt: now.toISOString(), serverTime: now.toISOString(),
        summary: { customer: [projection.customers[0].firstName, projection.customers[0].middleName, projection.customers[0].lastName].filter(Boolean).join(' '), changeCount: 1 },
        capabilities: { edit: true, pause: true, resume: true, delete: true },
        customers: projection.customers, changes: [{ id: changeId, operation: projection.operation, arguments: projection.arguments, actor, recordedAt: '2026-11-11T12:00:00+00:00' }], changeId };
    const { customers, changes, changeId: unused, ...summary } = outbox;
    return { response: { ...projection.response, outbox, provisional: true }, customer: { ...projection.customers[0], provisional: true, outboxSession: summary },
        listItem: summary, nonceReconciliation, outboxNormalization, projectionCase: name,
        boundary: 'Declared isolated local queued acknowledgement; shape follows SessionOutbox.save/present/overlayCustomers. No HTTP/database/outbox-consumer/upstream persistence is exercised.' };
}
