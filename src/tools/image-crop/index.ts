import { Crop } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.image-crop.title'),
  path: '/image-crop',
  description: translate('tools.image-crop.description'),
  keywords: ['image', 'crop', 'cut', 'aspect', 'selection', 'square', 'avatar', 'png', 'jpg', 'webp'],
  component: () => import('./image-crop.vue'),
  icon: Crop,
  createdAt: new Date('2026-10-14'),
});
