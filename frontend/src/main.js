import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import './styles.css';

const mountNode = document.getElementById('kiwiWorkspaceRoot');

if (mountNode) {
  const app = createApp(App);
  const pinia = createPinia();

  app.use(pinia);
  app.mount(mountNode);
}
