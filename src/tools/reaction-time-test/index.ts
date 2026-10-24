import { SpeedFilled } from '@vicons/material';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.reaction-time-test.title'),
  path: '/reaction-time-test',
  description: translate('tools.reaction-time-test.description'),
  keywords: ['reaction', 'reaction time', 'reflex', 'speed', 'test', 'timing', 'human benchmark'],
  component: () => import('./reaction-time-test.vue'),
  icon: SpeedFilled,
});
