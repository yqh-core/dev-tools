import { LetterCase } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.fullwidth-converter.title'),
  path: '/fullwidth-converter',
  description: translate('tools.fullwidth-converter.description'),
  keywords: ['fullwidth', 'halfwidth', '全角', '半角', '标点', 'punctuation', 'unicode', '转换'],
  component: () => import('./fullwidth-converter.vue'),
  icon: LetterCase,
});
