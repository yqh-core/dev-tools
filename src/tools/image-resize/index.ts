import { ArrowsMinimize } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.image-resize.title'),
  path: '/image-resize',
  description: translate('tools.image-resize.description'),
  keywords: ['image', 'photo', 'resize', 'scale', 'downscale', 'upscale', 'dimension', 'png', 'jpg', 'webp'],
  component: () => import('./image-resize.vue'),
  icon: ArrowsMinimize,
  createdAt: new Date('2026-10-14'),
});
