const SINGLE_FLIGHT_REQUESTS = new Map();

function buildDefaultCorrelationId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `corr-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getApiBaseUrl() {
  const mountNode = typeof document !== 'undefined'
    ? document.getElementById('kiwiWorkspaceRoot')
    : null;

  if (mountNode && mountNode.dataset && mountNode.dataset.apiBaseUrl) {
    return mountNode.dataset.apiBaseUrl;
  }

  if (typeof window !== 'undefined' && window.kiwiWorkspaceConfig?.apiBaseUrl) {
    return window.kiwiWorkspaceConfig.apiBaseUrl;
  }

  return '/api/v1';
}

async function request(path, options = {}) {
  const {
    method = 'GET',
    body,
    dedupeKey,
    headers = {},
  } = options;

  if (dedupeKey && SINGLE_FLIGHT_REQUESTS.has(dedupeKey)) {
    return SINGLE_FLIGHT_REQUESTS.get(dedupeKey);
  }

  const correlationId = headers['X-Correlation-Id'] || buildDefaultCorrelationId();
  const baseUrl = getApiBaseUrl().replace(/\/$/, '');

  const requestPromise = fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-Id': correlationId,
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error?.message || payload?.message || 'API request failed';
      const error = new Error(message);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }

    return payload;
  }).finally(() => {
    if (dedupeKey) {
      SINGLE_FLIGHT_REQUESTS.delete(dedupeKey);
    }
  });

  if (dedupeKey) {
    SINGLE_FLIGHT_REQUESTS.set(dedupeKey, requestPromise);
  }

  return requestPromise;
}

function cleanFilters(filters) {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    params.set(key, String(value));
  });

  return params.toString();
}

export async function searchCustomers(filters) {
  const query = cleanFilters(filters);
  const suffix = query ? `?${query}` : '';
  return request(`/customers/search${suffix}`);
}

export async function getCustomer(personId) {
  return request(`/customers/${personId}`);
}

export async function patchCustomer(personId, payload) {
  return request(`/customers/${personId}`, {
    method: 'PATCH',
    body: payload,
  });
}

export async function createSubscription(payload, requestId) {
  return request('/subscriptions', {
    method: 'POST',
    body: {
      ...payload,
      requestId,
    },
    headers: {
      'Idempotency-Key': requestId,
    },
    dedupeKey: `subscription-${requestId}`,
  });
}

export async function getSubscriptionRequestStatus(requestId) {
  return request(`/subscriptions/requests/${requestId}`);
}

export async function getAuditEvents({ personId, requestId, cursor, limit = 50 } = {}) {
  const query = cleanFilters({
    personId,
    requestId,
    cursor,
    limit,
  });

  const suffix = query ? `?${query}` : '';
  return request(`/audit-events${suffix}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function pollSubscriptionRequest(requestId, { intervalMs = 1500, maxAttempts = 20 } = {}) {
  let attempt = 0;

  while (attempt < maxAttempts) {
    const statusPayload = await getSubscriptionRequestStatus(requestId);
    if (statusPayload.status !== 'pending') {
      return statusPayload;
    }

    attempt += 1;
    await sleep(intervalMs);
  }

  return {
    status: 'pending',
    requestId,
    message: 'Polling timed out before reaching a terminal state',
  };
}
