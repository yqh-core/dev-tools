import { CompareArrowsRound } from '@vicons/material';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.json-diff.title'),
  path: '/json-diff',
  description: translate('tools.json-diff.description'),
  keywords: ['json diff checker', 'compare json online', 'json compare', 'json array diff', 'compare json files', 'compare large JSON files', 'large JSON diff', 'json diff ignore order', 'json compare by id', 'nested json diff'],
  component: () => import('./json-diff.vue'),
  icon: CompareArrowsRound,
  createdAt: new Date('2023-04-20'),
});
