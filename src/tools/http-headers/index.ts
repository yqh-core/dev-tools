import { FileCode } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

import { httpHeaderEntries } from './http-headers.constants';

export const tool = defineTool({
  name: translate('tools.http-headers.title'),
  path: '/http-headers',
  description: translate('tools.http-headers.description'),
  keywords: [
    'http',
    'header',
    'headers',
    '请求头',
    '响应头',
    'cors',
    'cache-control',
    'etag',
    'content-type',
    'authorization',
    ...httpHeaderEntries.map(({ name }) => name),
  ].slice(0, 40),
  component: () => import('./http-headers.vue'),
  icon: FileCode,
  createdAt: new Date('2026-09-18'),
});
