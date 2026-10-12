import { Key } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.password-generator.title'),
  path: '/password-generator',
  description: translate('tools.password-generator.description'),
  keywords: ['password', 'generator', 'random', 'secure', 'strong', 'passphrase', 'cryptographic', 'symbols', 'uppercase', 'lowercase'],
  component: () => import('./password-generator.tool.vue'),
  icon: Key,
});
