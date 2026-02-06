import { defineStore } from 'pinia';

import { getAuditEvents } from '../api/client';

export const useAuditTimelineStore = defineStore('auditTimeline', {
  state: () => ({
    events: [],
    nextCursor: null,
    loading: false,
    error: null,
    activeFilters: {
      personId: null,
      requestId: null,
    },
  }),
  actions: {
    async loadInitial(filters = {}) {
      this.activeFilters = {
        personId: filters.personId || null,
        requestId: filters.requestId || null,
      };
      this.loading = true;
      this.error = null;

      try {
        const response = await getAuditEvents({
          ...this.activeFilters,
          limit: 50,
        });
        this.events = response.events || [];
        this.nextCursor = response.nextCursor || null;
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },
    async loadMore() {
      if (!this.nextCursor) {
        return;
      }

      this.loading = true;
      this.error = null;

      try {
        const response = await getAuditEvents({
          ...this.activeFilters,
          cursor: this.nextCursor,
          limit: 50,
        });
        this.events = [...this.events, ...(response.events || [])];
        this.nextCursor = response.nextCursor || null;
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },
  },
});
