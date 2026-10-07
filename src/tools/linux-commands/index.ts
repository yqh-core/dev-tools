import { Terminal2 } from '@vicons/tabler';
import { defineTool } from '../tool';
import { linuxCommands } from './linux-commands.constants';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.linux-commands.title'),
  path: '/linux-commands',
  description: translate('tools.linux-commands.description'),
  keywords: [
    'linux',
    'shell',
    'command',
    '命令',
    '速查',
    'grep',
    'awk',
    'sed',
    'chmod',
    'ssh',
    'systemctl',
    ...linuxCommands.map(({ cmd }) => cmd),
  ].slice(0, 40),
  component: () => import('./linux-commands.vue'),
  icon: Terminal2,
  createdAt: new Date('2026-09-18'),
});
