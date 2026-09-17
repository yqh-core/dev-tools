import { Replace } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.text-replacer.title'),
  path: '/text-replacer',
  description: translate('tools.text-replacer.description'),
  keywords: ['replace', '替换', '批量替换', '正则替换', 'regex replace', '文本处理', 'sed'],
  component: () => import('./text-replacer.vue'),
  icon: Replace,
});
