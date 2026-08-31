const CUSTOMER_REFERENCE_FIELDS = [
    'personId',
    'credentialKey',
    'sourceSystem',
    'divisionId',
    'mandant'
];

function normalizeString(value) {
    if (value === undefined || value === null) {
        return '';
    }

    return String(value).trim();
}

function createDefaultSessionId() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }

    const randomPart = Math.random().toString(36).slice(2);
    return `kiwi-${Date.now().toString(36)}-${randomPart}`;
}

function createDefaultAbortController() {
    if (typeof AbortController !== 'function') {
        return null;
    }

    return new AbortController();
}

function cloneReference(reference) {
    return reference ? { ...reference } : null;
}

function referencesAreEqual(left, right) {
    if (!left || !right) {
        return left === right;
    }

    return CUSTOMER_REFERENCE_FIELDS.every((fieldName) => left[fieldName] === right[fieldName]);
}

export function createCustomerReference(customer) {
    if (!customer || typeof customer !== 'object') {
        return null;
    }

    const personId = normalizeString(customer.personId || customer.personNumber || customer.id);
    if (!personId) {
        return null;
    }

    const credentialKey = normalizeString(customer.credentialKey);
    const sourceSystem = normalizeString(customer.sourceSystem)
        || (credentialKey ? 'subscription-api' : 'kiwi');

    return {
        personId,
        credentialKey,
        sourceSystem,
        divisionId: normalizeString(customer.divisionId),
        mandant: normalizeString(customer.mandant)
    };
}

export function createCustomerDisplaySummary(customer) {
    const reference = createCustomerReference(customer);
    if (!reference) {
        return null;
    }

    const name = [customer.firstName, customer.middleName, customer.lastName]
        .map(normalizeString)
        .filter(Boolean)
        .join(' ')
        || normalizeString(customer.name)
        || `Klant ${reference.personId}`;
    const sourceLabel = reference.mandant
        || reference.divisionId
        || normalizeString(customer.credentialTitle)
        || reference.sourceSystem;

    return {
        name,
        personId: reference.personId,
        sourceLabel
    };
}

export function createCustomerWorkSession(options = {}) {
    const createSessionId = typeof options.createSessionId === 'function'
        ? options.createSessionId
        : createDefaultSessionId;
    const createAbortController = typeof options.createAbortController === 'function'
        ? options.createAbortController
        : createDefaultAbortController;

    let workflowSessionId = createSessionId();
    let contextGeneration = 0;
    let customerReference = null;
    let activeCustomer = null;
    let pendingCustomerReference = null;
    let activeReadController = null;
    const activeMutationIds = new Set();
    const unresolvedMutationIds = new Set();

    function abortActiveRead() {
        if (activeReadController && typeof activeReadController.abort === 'function') {
            activeReadController.abort();
        }
        activeReadController = null;
    }

    function hasBlockingMutation() {
        return activeMutationIds.size > 0 || unresolvedMutationIds.size > 0;
    }

    function getSnapshot() {
        return {
            workflowSessionId,
            contextGeneration,
            customerReference: cloneReference(customerReference),
            activeCustomer,
            pendingCustomerReference: cloneReference(pendingCustomerReference),
            selectionPending: Boolean(pendingCustomerReference),
            activeMutationIds: Array.from(activeMutationIds),
            unresolvedMutationIds: Array.from(unresolvedMutationIds),
            resetBlocked: hasBlockingMutation()
        };
    }

    function getRequestContext() {
        const requestReference = pendingCustomerReference || customerReference;

        return {
            workflowSessionId,
            contextGeneration,
            customerReference: cloneReference(requestReference)
        };
    }

    function getRequestHeaders() {
        const headers = {
            'X-Kiwi-Workflow-Session-Id': workflowSessionId,
            'X-Kiwi-Context-Generation': String(contextGeneration)
        };

        const requestReference = pendingCustomerReference || customerReference;
        if (!requestReference) {
            return headers;
        }

        headers['X-Kiwi-Customer-Person-Id'] = requestReference.personId;
        headers['X-Kiwi-Customer-Credential-Key'] = requestReference.credentialKey;
        headers['X-Kiwi-Customer-Source-System'] = requestReference.sourceSystem;
        headers['X-Kiwi-Customer-Division-Id'] = requestReference.divisionId;
        headers['X-Kiwi-Customer-Mandant'] = requestReference.mandant;

        return headers;
    }

    function startCustomerSelection(customer) {
        if (hasBlockingMutation()) {
            return { blocked: true, reason: 'pending_mutation' };
        }

        const nextReference = createCustomerReference(customer);
        if (!nextReference) {
            throw new TypeError('A customer selection requires a person reference.');
        }
        const wouldReplaceActiveCustomer = customerReference
            && !referencesAreEqual(customerReference, nextReference);
        if (wouldReplaceActiveCustomer) {
            return { blocked: true, reason: 'active_customer' };
        }

        abortActiveRead();
        if (!customerReference) {
            workflowSessionId = createSessionId();
        }
        contextGeneration += 1;
        pendingCustomerReference = nextReference;
        activeReadController = createAbortController();

        return {
            blocked: false,
            workflowSessionId,
            contextGeneration,
            customerReference: cloneReference(pendingCustomerReference),
            signal: activeReadController ? activeReadController.signal : undefined
        };
    }

    function isCurrent(context) {
        if (!context || context.blocked) {
            return false;
        }

        const currentReference = pendingCustomerReference || customerReference;

        return context.workflowSessionId === workflowSessionId
            && context.contextGeneration === contextGeneration
            && referencesAreEqual(context.customerReference, currentReference);
    }

    function confirmCustomer(context, customer) {
        if (!isCurrent(context)) {
            return false;
        }

        const confirmedReference = createCustomerReference(customer);
        if (!confirmedReference) {
            return false;
        }

        customerReference = confirmedReference;
        activeCustomer = customer;
        pendingCustomerReference = null;
        activeReadController = null;
        return true;
    }

    function abandonCustomerSelection(context) {
        if (!isCurrent(context)) {
            return false;
        }

        abortActiveRead();
        contextGeneration += 1;
        pendingCustomerReference = null;
        if (!customerReference) {
            workflowSessionId = createSessionId();
        }
        return true;
    }

    function beginMutation(submissionId) {
        const normalizedSubmissionId = normalizeString(submissionId);
        if (!normalizedSubmissionId) {
            throw new TypeError('A mutation requires a submission id.');
        }

        activeMutationIds.add(normalizedSubmissionId);
        unresolvedMutationIds.delete(normalizedSubmissionId);
        return getRequestContext();
    }

    function finishMutation(submissionId, options = {}) {
        const normalizedSubmissionId = normalizeString(submissionId);
        activeMutationIds.delete(normalizedSubmissionId);

        if (options.ambiguous === true) {
            unresolvedMutationIds.add(normalizedSubmissionId);
            return;
        }

        unresolvedMutationIds.delete(normalizedSubmissionId);
    }

    function resolveMutation(submissionId) {
        const normalizedSubmissionId = normalizeString(submissionId);
        activeMutationIds.delete(normalizedSubmissionId);
        unresolvedMutationIds.delete(normalizedSubmissionId);
    }

    function reset() {
        if (hasBlockingMutation()) {
            return false;
        }

        abortActiveRead();
        workflowSessionId = createSessionId();
        contextGeneration += 1;
        customerReference = null;
        activeCustomer = null;
        pendingCustomerReference = null;
        return true;
    }

    return {
        abandonCustomerSelection,
        beginMutation,
        confirmCustomer,
        finishMutation,
        getRequestContext,
        getRequestHeaders,
        getSnapshot,
        hasBlockingMutation,
        isCurrent,
        reset,
        resolveMutation,
        startCustomerSelection
    };
}
