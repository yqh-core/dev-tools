import { FileImport } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.image-to-pdf.title'),
  path: '/image-to-pdf',
  description: translate('tools.image-to-pdf.description'),
  keywords: ['image', 'photo', 'png', 'jpg', 'pdf', 'convert', 'combine', 'scan', 'embed', 'receipts'],
  component: () => import('./image-to-pdf.vue'),
  icon: FileImport,
  createdAt: new Date('2026-10-14'),
});
