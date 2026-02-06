<script setup>
import AuditTimelinePanel from './components/AuditTimelinePanel.vue';
import CustomerDetailPanel from './components/CustomerDetailPanel.vue';
import CustomerSearchPanel from './components/CustomerSearchPanel.vue';
import SubscriptionFormPanel from './components/SubscriptionFormPanel.vue';
</script>

<template>
  <div class="workspace-grid">
    <div class="workspace-column">
      <CustomerSearchPanel />
      <CustomerDetailPanel />
    </div>
    <div class="workspace-column">
      <SubscriptionFormPanel />
      <AuditTimelinePanel />
    </div>
  </div>
</template>
