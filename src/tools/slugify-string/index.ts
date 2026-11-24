import { AbcRound } from '@vicons/material';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.slugify-string.title'),
  path: '/slugify-string',
  description: translate('tools.slugify-string.description'),
  keywords: ['URL slug generator', 'slug generator online', 'bulk slug generator', 'SEO slug generator', 'text to URL slug', 'filename slug generator', 'kebab case', 'underscore separator', 'stop words', 'transliteration', 'unicode'],
  component: () => import('./slugify-string.vue'),
  icon: AbcRound,
});
