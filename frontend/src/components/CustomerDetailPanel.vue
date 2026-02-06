<script setup>
import { reactive, watch } from 'vue';

import { useCustomerDetailStore } from '../stores/customerDetailStore';

const detailStore = useCustomerDetailStore();

const form = reactive({
  firstName: '',
  surName: '',
  lastName: '',
  email: '',
  phone: '',
  street: '',
  houseNo: '',
  postCode: '',
  city: '',
  countryCode: '',
});

watch(
  () => detailStore.customer,
  (customer) => {
    if (!customer) {
      return;
    }

    form.firstName = customer.firstName || '';
    form.surName = customer.surName || '';
    form.lastName = customer.lastName || '';
    form.email = customer.email || '';
    form.phone = customer.phone || '';
    form.street = customer.address?.street || '';
    form.houseNo = customer.address?.houseNo || '';
    form.postCode = customer.address?.postCode || '';
    form.city = customer.address?.city || '';
    form.countryCode = customer.address?.countryCode || '';
  },
  { immediate: true }
);

async function saveCustomer() {
  await detailStore.saveCustomerPatch({
    firstName: form.firstName,
    surName: form.surName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
    street: form.street,
    houseNo: form.houseNo,
    postCode: form.postCode,
    city: form.city,
    countryCode: form.countryCode,
  });
}
</script>

<template>
  <section class="workspace-card">
    <h3>Customer Detail</h3>
    <p v-if="!detailStore.customer" class="workspace-muted">Select a customer from search results.</p>

    <div v-else class="workspace-form-grid">
      <input v-model="form.firstName" placeholder="First name" />
      <input v-model="form.surName" placeholder="Middle name" />
      <input v-model="form.lastName" placeholder="Last name" />
      <input v-model="form.email" placeholder="Email" />
      <input v-model="form.phone" placeholder="Phone" />
      <input v-model="form.street" placeholder="Street" />
      <input v-model="form.houseNo" placeholder="House no" />
      <input v-model="form.postCode" placeholder="Post code" />
      <input v-model="form.city" placeholder="City" />
      <input v-model="form.countryCode" placeholder="Country code" />
    </div>

    <button
      v-if="detailStore.customer"
      class="workspace-button"
      :disabled="detailStore.saving"
      @click="saveCustomer">
      {{ detailStore.saving ? 'Saving…' : 'Save Customer' }}
    </button>

    <p v-if="detailStore.error" class="workspace-error">{{ detailStore.error }}</p>
    <p v-if="detailStore.updatedFields.length" class="workspace-muted">
      Updated fields: {{ detailStore.updatedFields.join(', ') }}
    </p>
  </section>
</template>
