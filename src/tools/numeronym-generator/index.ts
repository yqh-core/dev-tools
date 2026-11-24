import { defineTool } from '../tool';
import n7mIcon from './n7m-icon.svg?component';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.numeronym-generator.title'),
  path: '/numeronym-generator',
  description: translate('tools.numeronym-generator.description'),
  keywords: ['numeronym', 'numeronym generator', 'bulk numeronym', 'unicode numeronym', 'abbreviation', 'numeronym lookup', 'i18n', 'a11y', 'l10n', 'k8s', 'm17n', 'p13n', 'o11y'],
  component: () => import('./numeronym-generator.vue'),
  icon: n7mIcon,
  createdAt: new Date('2023-11-05'),
});
