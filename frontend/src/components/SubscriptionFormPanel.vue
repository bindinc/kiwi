<script setup>
import { reactive } from 'vue';

import { useAuditTimelineStore } from '../stores/auditTimelineStore';
import { useSubscriptionStore } from '../stores/subscriptionStore';

const subscriptionStore = useSubscriptionStore();
const auditStore = useAuditTimelineStore();

const today = new Date().toISOString().slice(0, 10);

const form = reactive({
  userId: '',
  validFrom: today,
  validUntil: '2999-01-01',
  variantCode: '',
  productCode: '',
  salesCode: '',
  salesChannel1: '',
  salesChannel2: '',
  salesChannel3: '',
  swiftIBAN: 'NL00BANK0123456789',
  accountHolder: '',
  paymentMethod: 'B',
  paymentFrequency: 'JD',
});

async function submitSubscription() {
  const payload = {
    userId: Number(form.userId),
    validFrom: form.validFrom,
    validUntil: form.validUntil,
    variantCode: form.variantCode,
    offerDetails: {
      productCode: form.productCode,
      salesCode: form.salesCode,
      salesChannel1: form.salesChannel1,
      salesChannel2: form.salesChannel2,
      salesChannel3: form.salesChannel3,
    },
    payment: {
      swiftIBAN: form.swiftIBAN,
      accountHolder: form.accountHolder,
      paymentType: {
        paymentMethod: form.paymentMethod,
        paymentFrequency: form.paymentFrequency,
      },
    },
  };

  const response = await subscriptionStore.submitSubscription(payload);

  if (subscriptionStore.lastRequestId) {
    await auditStore.loadInitial({ requestId: subscriptionStore.lastRequestId });
  }

  return response;
}
</script>

<template>
  <section class="workspace-card">
    <h3>Subscription Request</h3>
    <div class="workspace-form-grid">
      <input v-model="form.userId" placeholder="User ID" type="number" />
      <input v-model="form.validFrom" type="date" />
      <input v-model="form.validUntil" type="date" />
      <input v-model="form.variantCode" placeholder="Variant code" />
      <input v-model="form.productCode" placeholder="Product code" />
      <input v-model="form.salesCode" placeholder="Sales code" />
      <input v-model="form.salesChannel1" placeholder="Sales channel 1" />
      <input v-model="form.salesChannel2" placeholder="Sales channel 2" />
      <input v-model="form.salesChannel3" placeholder="Sales channel 3" />
      <input v-model="form.swiftIBAN" placeholder="IBAN" />
      <input v-model="form.accountHolder" placeholder="Account holder" />
      <input v-model="form.paymentMethod" placeholder="Payment method" />
      <input v-model="form.paymentFrequency" placeholder="Payment frequency" />
    </div>

    <button
      class="workspace-button"
      :disabled="subscriptionStore.submitting"
      @click="submitSubscription">
      {{ subscriptionStore.submitting ? 'Submitting…' : 'Create Subscription' }}
    </button>

    <p v-if="subscriptionStore.error" class="workspace-error">{{ subscriptionStore.error }}</p>
    <p v-if="subscriptionStore.lastRequestId" class="workspace-muted">
      Last request: {{ subscriptionStore.lastRequestId }}
    </p>
    <pre v-if="subscriptionStore.lastResponse" class="workspace-pre">{{ subscriptionStore.lastResponse }}</pre>
  </section>
</template>
