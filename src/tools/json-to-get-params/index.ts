import { Api } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.json-to-get-params.title'),
  path: '/json-to-get-params',
  description: translate('tools.json-to-get-params.description'),
  keywords: ['json', 'query', 'querystring', 'GET', '参数', 'url', 'flatten', '扁平化'],
  component: () => import('./json-to-get-params.vue'),
  icon: Api,
});
