<script setup>
import { useAuditTimelineStore } from '../stores/auditTimelineStore';

const auditStore = useAuditTimelineStore();
</script>

<template>
  <section class="workspace-card">
    <h3>Audit Timeline</h3>
    <p v-if="auditStore.loading" class="workspace-muted">Loading events…</p>
    <p v-if="auditStore.error" class="workspace-error">{{ auditStore.error }}</p>

    <ul class="workspace-list">
      <li v-for="event in auditStore.events" :key="event.event_id" class="workspace-list-item vertical">
        <strong>{{ event.event_type }}</strong>
        <small>{{ event.occurred_at }}</small>
        <small>entity: {{ event.entity_type }} / {{ event.entity_id }}</small>
      </li>
    </ul>

    <button
      v-if="auditStore.nextCursor"
      class="workspace-button ghost"
      :disabled="auditStore.loading"
      @click="auditStore.loadMore()">
      Load more
    </button>
  </section>
</template>
