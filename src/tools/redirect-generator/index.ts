import { ArrowsShuffle } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.redirect-generator.title'),
  path: '/redirect-generator',
  description: translate('tools.redirect-generator.description'),
  keywords: [
    '301 redirect generator',
    'bulk redirect generator',
    'bulk 301 redirect generator',
    'Apache redirect generator',
    '.htaccess redirect generator',
    'Nginx redirect generator',
    'Cloudflare bulk redirect CSV',
    '301 redirect checker',
    'redirect chain checker',
    'URL migration redirects',
  ],
  component: () => import('./redirect-generator.vue'),
  icon: ArrowsShuffle,
  createdAt: new Date('2026-11-24'),
});
