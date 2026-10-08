import { Calendar } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.unix-timestamp-converter.title'),
  path: '/unix-timestamp-converter',
  description: translate('tools.unix-timestamp-converter.description'),
  keywords: ['unix', 'timestamp', 'epoch', 'posix', 'seconds', 'milliseconds'],
  component: () => import('./unix-timestamp-converter.vue'),
  icon: Calendar,
});
