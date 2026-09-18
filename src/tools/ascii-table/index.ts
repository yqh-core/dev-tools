import { Keyboard } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.ascii-table.title'),
  path: '/ascii-table',
  description: translate('tools.ascii-table.description'),
  keywords: ['ascii', 'ascii table', '码表', '字符', '十进制', '十六进制', '八进制', '二进制', 'char code'],
  component: () => import('./ascii-table.vue'),
  icon: Keyboard,
  createdAt: new Date('2026-09-18'),
});
