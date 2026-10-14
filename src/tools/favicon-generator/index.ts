import { AppWindow } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.favicon-generator.title'),
  path: '/favicon-generator',
  description: translate('tools.favicon-generator.description'),
  keywords: ['favicon', 'ico', 'icon', 'apple-touch-icon', 'pwa', 'tab', 'browser', 'png', 'generator'],
  component: () => import('./favicon-generator.vue'),
  icon: AppWindow,
  createdAt: new Date('2026-10-14'),
});
