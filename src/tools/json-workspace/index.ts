import { Braces } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.json-workspace.title'),
  path: '/json-workspace',
  description: translate('tools.json-workspace.description'),
  keywords: ['json', 'workspace', 'format', 'validate', 'tree', 'jsonpath', 'query', 'schema', 'yaml', 'csv', 'diff'],
  component: () => import('./json-workspace.vue'),
  icon: Braces,
  createdAt: new Date('2026-11-12'),
});
