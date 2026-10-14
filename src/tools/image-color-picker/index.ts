import { Palette } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.image-color-picker.title'),
  path: '/image-color-picker',
  description: translate('tools.image-color-picker.description'),
  keywords: ['image', 'color', 'colour', 'picker', 'eyedropper', 'hex', 'rgb', 'hsl', 'palette', 'sample'],
  component: () => import('./image-color-picker.vue'),
  icon: Palette,
  createdAt: new Date('2026-10-14'),
});
