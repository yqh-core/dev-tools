import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';
import CompressIcon from '~icons/mdi/file-arrow-up-down';

export const tool = defineTool({
  name: translate('tools.pdf-compress.title'),
  path: '/pdf-compress',
  description: translate('tools.pdf-compress.description'),
  keywords: ['pdf', 'compress', 'optimizer', 'reduce', 'size', 'smaller', 'image', 'shrink'],
  component: () => import('./pdf-compress.tool.vue'),
  icon: CompressIcon,
  createdAt: new Date('2026-10-13'),
});
