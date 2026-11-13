import { Rocket } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.prepare-deployment.title'),
  path: '/prepare-deployment',
  description: translate('tools.prepare-deployment.description'),
  keywords: ['deployment', 'release', 'readiness', 'gate', 'dockerfile', 'ci', 'lockfile', 'vercel', 'netlify', 'preflight', 'checklist', 'deploy', 'release-gate'],
  component: () => import('./prepare-deployment.vue'),
  icon: Rocket,
});
