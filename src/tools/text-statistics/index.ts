import { FileText } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.text-statistics.title'),
  path: '/text-statistics',
  description: translate('tools.text-statistics.description'),
  keywords: ['text statistics', 'word counter', 'character counter', 'unicode character count', 'grapheme counter', 'utf-8 bytes', 'sentence count', 'paragraph count', 'reading time'],
  component: () => import('./text-statistics.vue'),
  icon: FileText,
  redirectFrom: ['/text-stats'],
});
