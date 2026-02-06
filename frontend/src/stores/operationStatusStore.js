import { defineStore } from 'pinia';

import { pollSubscriptionRequest } from '../api/client';

export const useOperationStatusStore = defineStore('operationStatus', {
  state: () => ({
    operations: {},
  }),
  getters: {
    getOperation: (state) => (requestId) => state.operations[requestId] || null,
  },
  actions: {
    setOperation(requestId, payload) {
      this.operations[requestId] = payload;
    },
    async pollRequest(requestId) {
      const finalStatus = await pollSubscriptionRequest(requestId);
      this.setOperation(requestId, finalStatus);
      return finalStatus;
    },
  },
});
