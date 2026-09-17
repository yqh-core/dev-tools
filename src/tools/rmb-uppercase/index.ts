import { CurrencyRenminbi } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.rmb-uppercase.title'),
  path: '/rmb-uppercase',
  description: translate('tools.rmb-uppercase.description'),
  keywords: ['rmb', 'cny', '人民币', '大写', '金额', '中文大写', '发票', '财务', 'currency'],
  component: () => import('./rmb-uppercase.vue'),
  icon: CurrencyRenminbi,
});
