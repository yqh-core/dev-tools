import { Contrast } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.color-contrast-checker.title'),
  path: '/color-contrast-checker',
  description: translate('tools.color-contrast-checker.description'),
  keywords: ['contrast', 'wcag', 'accessibility', 'a11y', 'color contrast', 'contrast ratio', 'aa', 'aaa', 'text colour', 'design review'],
  component: () => import('./color-contrast-checker.vue'),
  icon: Contrast,
  createdAt: new Date('2026-10-17'),
});
