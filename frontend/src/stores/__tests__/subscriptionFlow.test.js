import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../api/client', () => ({
  createSubscription: vi.fn(),
  generateIdempotencyKey: vi.fn(() => 'idem-123'),
  pollSubscriptionRequest: vi.fn(),
  searchCustomers: vi.fn(),
  getCustomer: vi.fn(),
  patchCustomer: vi.fn(),
  getAuditEvents: vi.fn(),
}));

import { createSubscription, pollSubscriptionRequest } from '../../api/client';
import { useOperationStatusStore } from '../operationStatusStore';
import { useSubscriptionStore } from '../subscriptionStore';

describe('subscription + operation status stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('polls pending subscription requests to terminal state', async () => {
    createSubscription.mockResolvedValue({ status: 'pending', requestId: 'idem-123' });
    pollSubscriptionRequest.mockResolvedValue({ status: 'succeeded', requestId: 'idem-123' });

    const subscriptionStore = useSubscriptionStore();
    const operationStore = useOperationStatusStore();

    const response = await subscriptionStore.submitSubscription({ userId: 99, variantCode: 'A' });

    expect(response.status).toBe('succeeded');
    expect(operationStore.getOperation('idem-123').status).toBe('succeeded');
  });
});
