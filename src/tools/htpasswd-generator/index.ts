import { Lock } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.htpasswd-generator.title'),
  path: '/htpasswd-generator',
  description: translate('tools.htpasswd-generator.description'),
  keywords: [
    'htpasswd',
    'basic auth',
    'apache',
    'nginx',
    'apr1',
    'bcrypt',
    'password',
    'basic认证',
    '密码',
    '哈希',
  ],
  component: () => import('./htpasswd-generator.vue'),
  icon: Lock,
  createdAt: new Date('2026-09-18'),
});
