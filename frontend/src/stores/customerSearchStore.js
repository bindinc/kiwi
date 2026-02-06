import { defineStore } from 'pinia';

import { searchCustomers } from '../api/client';

export const useCustomerSearchStore = defineStore('customerSearch', {
  state: () => ({
    filters: {
      name: '',
      firstname: '',
      postcode: '',
      houseno: '',
      phone: '',
      email: '',
      city: '',
      exactmatch: false,
      page: 0,
      pagesize: 20,
    },
    items: [],
    page: {
      number: 0,
      size: 20,
      totalElements: 0,
      totalPages: 0,
    },
    loading: false,
    error: null,
  }),
  actions: {
    async runSearch() {
      this.loading = true;
      this.error = null;

      try {
        const response = await searchCustomers(this.filters);
        this.items = response.items || [];
        this.page = response.page || this.page;
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },
  },
});
