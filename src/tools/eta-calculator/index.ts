import { Hourglass } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.eta-calculator.title'),
  path: '/eta-calculator',
  description: translate('tools.eta-calculator.description'),
  keywords: ['eta calculator', 'time remaining calculator', 'task completion time', 'remaining workload', 'batch processing ETA', 'download time remaining', 'processing rate', 'time buffer'],
  component: () => import('./eta-calculator.vue'),
  icon: Hourglass,
});
