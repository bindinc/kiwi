import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('../../api/client', () => ({
  searchCustomers: vi.fn(),
}));

import { searchCustomers } from '../../api/client';
import { useCustomerSearchStore } from '../customerSearchStore';

describe('customerSearchStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('loads search results into store state', async () => {
    searchCustomers.mockResolvedValue({
      items: [{ personId: '123' }],
      page: { number: 0, size: 20, totalElements: 1, totalPages: 1 },
    });

    const store = useCustomerSearchStore();
    await store.runSearch();

    expect(store.items).toHaveLength(1);
    expect(store.page.totalElements).toBe(1);
  });
});
