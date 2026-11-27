import { createApp, h } from 'vue';
import ApiStudioPage from '@/pages/ApiStudio.page.vue';
import WorkspaceShell from './WorkspaceShell.vue';
import { naive } from '@/plugins/naive.plugin';
import '@/styles/api-studio-tokens.css';

const app = createApp({
  render: () => h(WorkspaceShell, null, { default: () => h(ApiStudioPage) }),
});

app.use(naive);
app.mount('#app');
