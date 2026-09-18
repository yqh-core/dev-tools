import { World } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.whois-lookup.title'),
  path: '/whois-lookup',
  description: translate('tools.whois-lookup.description'),
  keywords: ['whois', 'rdap', '域名', '注册信息', '备案', '注册商', 'domain', 'registration', '到期'],
  component: () => import('./whois-lookup.vue'),
  icon: World,
  createdAt: new Date('2026-09-18'),
});
