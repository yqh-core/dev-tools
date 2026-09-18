import { History } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.today-in-history.title'),
  path: '/today-in-history',
  description: translate('tools.today-in-history.description'),
  keywords: ['today', 'history', '历史上的今天', '今日', '事件', ' anniversary', 'on this day'],
  component: () => import('./today-in-history.vue'),
  icon: History,
  createdAt: new Date('2026-09-18'),
});
