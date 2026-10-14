import { Adjustments } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.image-compress.title'),
  path: '/image-compress',
  description: translate('tools.image-compress.description'),
  keywords: ['image', 'photo', 'compress', 'optimize', 'reduce', 'size', 'jpeg', 'jpg', 'webp', 'quality'],
  component: () => import('./image-compress.vue'),
  icon: Adjustments,
  createdAt: new Date('2026-10-14'),
});
