import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../api/client', () => ({
  searchCustomers: vi.fn(),
  getCustomer: vi.fn(),
  patchCustomer: vi.fn(),
  createSubscription: vi.fn(),
  pollSubscriptionRequest: vi.fn(),
  getAuditEvents: vi.fn(),
  generateIdempotencyKey: vi.fn(() => 'idem-smoke'),
}));

import {
  createSubscription,
  getAuditEvents,
  getCustomer,
  patchCustomer,
  pollSubscriptionRequest,
  searchCustomers,
} from '../../api/client';
import { useAuditTimelineStore } from '../auditTimelineStore';
import { useCustomerDetailStore } from '../customerDetailStore';
import { useCustomerSearchStore } from '../customerSearchStore';
import { useSubscriptionStore } from '../subscriptionStore';

describe('workspace smoke path', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('searches customer, updates customer, submits subscription, polls, and loads timeline', async () => {
    searchCustomers.mockResolvedValue({
      items: [{ personId: 'person-1', firstName: 'Jane', lastName: 'Doe' }],
      page: { number: 0, size: 20, totalElements: 1, totalPages: 1 },
    });
    getCustomer.mockResolvedValue({
      customer: {
        personId: 'person-1',
        firstName: 'Jane',
        lastName: 'Doe',
        address: {},
      },
    });
    patchCustomer.mockResolvedValue({
      customer: {
        personId: 'person-1',
        firstName: 'Janet',
        lastName: 'Doe',
        address: {},
      },
      updatedFields: ['firstName'],
    });
    createSubscription.mockResolvedValue({ status: 'pending', requestId: 'idem-smoke' });
    pollSubscriptionRequest.mockResolvedValue({ status: 'succeeded', requestId: 'idem-smoke' });
    getAuditEvents.mockResolvedValue({
      events: [{ event_id: 1, event_type: 'subscription.succeeded' }],
      nextCursor: null,
    });

    const searchStore = useCustomerSearchStore();
    const detailStore = useCustomerDetailStore();
    const subscriptionStore = useSubscriptionStore();
    const auditStore = useAuditTimelineStore();

    await searchStore.runSearch();
    await detailStore.loadCustomer('person-1');
    await detailStore.saveCustomerPatch({ firstName: 'Janet' });
    const submitResult = await subscriptionStore.submitSubscription({ userId: 1, variantCode: 'A' });
    await auditStore.loadInitial({ requestId: 'idem-smoke' });

    expect(searchStore.items[0].personId).toBe('person-1');
    expect(detailStore.customer.firstName).toBe('Janet');
    expect(submitResult.status).toBe('succeeded');
    expect(auditStore.events[0].event_type).toBe('subscription.succeeded');
  });
});
