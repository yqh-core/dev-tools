import { Api } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.api-debugger.title'),
  path: '/api-debugger',
  description: translate('tools.api-debugger.description'),
  keywords: ['api debug', 'curl import', 'http request', 'rest client', 'api response', 'jsonpath extract'],
  component: () => import('./api-debugger.vue'),
  icon: Api,
});
