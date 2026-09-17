import { Ruler } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.px-rem-converter.title'),
  path: '/px-rem-converter',
  description: translate('tools.px-rem-converter.description'),
  keywords: ['px', 'rem', 'css', '像素', '根字号', 'root font size', '响应式', 'unit'],
  component: () => import('./px-rem-converter.vue'),
  icon: Ruler,
});
