import { Scale } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.unit-converter.title'),
  path: '/unit-converter',
  description: translate('tools.unit-converter.description'),
  keywords: ['unit', '单位', '换算', '转换', '长度', '面积', '重量', '体积', '速度', '压力', '功率', '数据存储', '市斤', '亩'],
  component: () => import('./unit-converter.vue'),
  icon: Scale,
});
