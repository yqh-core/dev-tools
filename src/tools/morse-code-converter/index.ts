import { Radio } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.morse-code-converter.title'),
  path: '/morse-code-converter',
  description: translate('tools.morse-code-converter.description'),
  keywords: ['morse', '摩斯', '摩尔斯', '电码', 'code', 'encode', 'decode', 'telegraph'],
  component: () => import('./morse-code-converter.vue'),
  icon: Radio,
});
