import { Fingerprint } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.nanoid-generator.title'),
  path: '/nanoid-generator',
  description: translate('tools.nanoid-generator.description'),
  keywords: ['nanoid', 'nano id', 'id', 'random id', 'short id', 'unique', 'url-safe', 'token', 'identifier', 'generator'],
  component: () => import('./nanoid-generator.vue'),
  icon: Fingerprint,
  createdAt: new Date('2026-10-17'),
});
