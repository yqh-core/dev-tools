import { Code } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.json-to-code.title'),
  path: '/json-to-code',
  description: translate('tools.json-to-code.description'),
  keywords: ['json', '实体类', 'model', 'interface', 'typescript', 'java', 'csharp', 'go', '代码生成', 'pojo'],
  component: () => import('./json-to-code.vue'),
  icon: Code,
});
