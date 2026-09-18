import { Activity } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.http-status-checker.title'),
  path: '/http-status-checker',
  description: translate('tools.http-status-checker.description'),
  keywords: ['http', 'status', 'code', '状态码', '响应头', 'headers', '检测', '网站', 'monitor', '可达性'],
  component: () => import('./http-status-checker.vue'),
  icon: Activity,
  createdAt: new Date('2026-09-18'),
});
