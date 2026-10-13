import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';
import SplitIcon from '~icons/mdi/content-cut';

export const tool = defineTool({
  name: translate('tools.pdf-split.title'),
  path: '/pdf-split',
  description: translate('tools.pdf-split.description'),
  keywords: ['pdf', 'split', 'extract', 'pages', 'separate'],
  component: () => import('./pdf-split.tool.vue'),
  icon: SplitIcon,
  createdAt: new Date('2026-10-13'),
});
