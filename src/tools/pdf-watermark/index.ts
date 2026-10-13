import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';
import StampIcon from '~icons/mdi/stamper';

export const tool = defineTool({
  name: translate('tools.pdf-watermark.title'),
  path: '/pdf-watermark',
  description: translate('tools.pdf-watermark.description'),
  keywords: ['pdf', 'watermark', 'stamp', 'text', 'confidential', 'draft'],
  component: () => import('./pdf-watermark.tool.vue'),
  icon: StampIcon,
  createdAt: new Date('2026-10-13'),
});
