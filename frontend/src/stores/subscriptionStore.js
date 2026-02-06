import { defineStore } from 'pinia';

import { createSubscription, generateIdempotencyKey } from '../api/client';
import { useOperationStatusStore } from './operationStatusStore';

export const useSubscriptionStore = defineStore('subscription', {
  state: () => ({
    submitting: false,
    error: null,
    lastRequestId: null,
    lastResponse: null,
  }),
  actions: {
    async submitSubscription(payload) {
      const requestId = payload.requestId || generateIdempotencyKey();
      this.submitting = true;
      this.error = null;
      this.lastRequestId = requestId;

      try {
        const response = await createSubscription(payload, requestId);
        this.lastResponse = response;

        if (response.status === 'pending') {
          const operationStore = useOperationStatusStore();
          const terminalStatus = await operationStore.pollRequest(requestId);
          this.lastResponse = terminalStatus;
        }

        return this.lastResponse;
      } catch (error) {
        this.error = error.message;
        throw error;
      } finally {
        this.submitting = false;
      }
    },
  },
});
