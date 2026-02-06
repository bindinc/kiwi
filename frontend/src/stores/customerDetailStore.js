import { defineStore } from 'pinia';

import { getCustomer, patchCustomer } from '../api/client';

export const useCustomerDetailStore = defineStore('customerDetail', {
  state: () => ({
    personId: null,
    customer: null,
    loading: false,
    saving: false,
    error: null,
    updatedFields: [],
  }),
  actions: {
    async loadCustomer(personId) {
      this.personId = personId;
      this.loading = true;
      this.error = null;

      try {
        const response = await getCustomer(personId);
        this.customer = response.customer;
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },
    async saveCustomerPatch(patchPayload) {
      if (!this.personId) {
        return;
      }

      this.saving = true;
      this.error = null;

      try {
        const response = await patchCustomer(this.personId, patchPayload);
        this.customer = response.customer;
        this.updatedFields = response.updatedFields || [];
      } catch (error) {
        this.error = error.message;
      } finally {
        this.saving = false;
      }
    },
  },
});
