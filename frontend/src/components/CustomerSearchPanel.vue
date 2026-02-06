<script setup>
import { useCustomerSearchStore } from '../stores/customerSearchStore';
import { useCustomerDetailStore } from '../stores/customerDetailStore';

const searchStore = useCustomerSearchStore();
const detailStore = useCustomerDetailStore();

async function runSearch() {
  await searchStore.runSearch();
}

function openCustomer(personId) {
  detailStore.loadCustomer(personId);
}
</script>

<template>
  <section class="workspace-card">
    <h3>Customer Search</h3>
    <div class="workspace-form-grid">
      <input v-model="searchStore.filters.name" placeholder="Last name" />
      <input v-model="searchStore.filters.firstname" placeholder="First name" />
      <input v-model="searchStore.filters.postcode" placeholder="Post code" />
      <input v-model="searchStore.filters.houseno" placeholder="House no" />
      <input v-model="searchStore.filters.phone" placeholder="Phone" />
      <input v-model="searchStore.filters.email" placeholder="Email" />
      <input v-model="searchStore.filters.city" placeholder="City" />
      <label class="workspace-checkbox">
        <input v-model="searchStore.filters.exactmatch" type="checkbox" />
        Exact match
      </label>
    </div>
    <button class="workspace-button" :disabled="searchStore.loading" @click="runSearch">
      {{ searchStore.loading ? 'Searching…' : 'Search Customers' }}
    </button>

    <p v-if="searchStore.error" class="workspace-error">{{ searchStore.error }}</p>

    <ul class="workspace-list">
      <li v-for="item in searchStore.items" :key="item.personId" class="workspace-list-item">
        <div>
          <strong>{{ item.lastName }}</strong>, {{ item.firstName }}
          <small>{{ item.postCode }} {{ item.houseNo }} · {{ item.city }}</small>
        </div>
        <button class="workspace-button ghost" @click="openCustomer(item.personId)">Open</button>
      </li>
    </ul>
  </section>
</template>
