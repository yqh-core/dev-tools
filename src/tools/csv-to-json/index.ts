import { Table } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.csv-to-json.title'),
  path: '/csv-to-json',
  description: translate('tools.csv-to-json.description'),
  keywords: ['csv', 'to', 'json', 'convert', 'parse', 'delimiter', 'spreadsheet'],
  component: () => import('./csv-to-json.vue'),
  icon: Table,
  createdAt: new Date('2026-10-16'),
});
