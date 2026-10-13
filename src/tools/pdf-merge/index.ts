import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';
import MergeIcon from '~icons/mdi/merge';

export const tool = defineTool({
  name: translate('tools.pdf-merge.title'),
  path: '/pdf-merge',
  description: translate('tools.pdf-merge.description'),
  keywords: ['pdf', 'merge', 'combine', 'join', 'concatenate'],
  component: () => import('./pdf-merge.tool.vue'),
  icon: MergeIcon,
  createdAt: new Date('2026-10-13'),
});
