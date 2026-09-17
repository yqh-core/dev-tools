<script setup lang="ts">
const CATEGORIES = ['长度', '面积', '体积', '重量', '速度', '时间', '数据存储', '功率', '压力', '角度', '温度'] as const;
type Category = typeof CATEGORIES[number];

// 每个类别的基准单位换算系数（长度=米、重量=千克、时间=秒、数据=字节…）
const FACTORS: Record<string, Record<string, number>> = {
  长度: {
    千米: 1000, 米: 1, 分米: 0.1, 厘米: 0.01, 毫米: 0.001, 微米: 1e-6,
    英里: 1609.344, 码: 0.9144, 英尺: 0.3048, 英寸: 0.0254,
    海里: 1852, 市里: 500, 市尺: 1 / 3, 市寸: 1 / 30,
  },
  面积: {
    平方千米: 1e6, 公顷: 1e4, 平方米: 1, 平方分米: 0.01, 平方厘米: 1e-4,
    亩: 666.6666666667, 英亩: 4046.8564224, 平方英尺: 0.09290304, 平方英里: 2589988.110336,
  },
  体积: {
    立方米: 1000, 升: 1, 分升: 0.1, 毫升: 0.001, 立方厘米: 0.001,
    加仑美制: 3.785411784, 加仑英制: 4.54609, 立方英尺: 28.316846592, 立方英寸: 0.016387064,
  },
  重量: {
    吨: 1000, 千克: 1, 克: 0.001, 毫克: 1e-6,
    斤: 0.5, 两: 0.05, 磅: 0.45359237, 盎司: 0.028349523125, 英石: 6.35029318,
  },
  速度: {
    '米/秒': 1, '千米/小时': 1 / 3.6, '英里/小时': 0.44704,
    '英尺/秒': 0.3048, 节: 0.5144444444, 马赫: 340.29,
  },
  时间: {
    毫秒: 0.001, 秒: 1, 分钟: 60, 小时: 3600, 天: 86400, 周: 604800,
    '月(30天)': 2592000, '年(365天)': 31536000,
  },
  数据存储: {
    bit: 0.125, 字节: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3,
    TB: 1024 ** 4, PB: 1024 ** 5,
  },
  功率: {
    瓦: 1, 千瓦: 1000, 兆瓦: 1e6,
    公制马力: 735.49875, 英制马力: 745.6998715823, '卡/秒': 4.184,
  },
  压力: {
    帕: 1, 千帕: 1000, 兆帕: 1e6, 巴: 1e5, 标准大气压: 101325,
    毫米汞柱: 133.322387415, '磅/平方英寸': 6896.551724137931,
  },
  角度: {
    度: 1, 弧度: 57.29577951308232, 分: 1 / 60, 秒: 1 / 3600, 百分度: 0.9, 圈: 360,
  },
};

const TEMP_UNITS = ['摄氏度', '华氏度', '开尔文'];

const category = ref<Category>('长度');
const amount = ref(1);
const fromUnit = ref(Object.keys(FACTORS.长度)[1]);

const units = computed(() => category.value === '温度' ? TEMP_UNITS : Object.keys(FACTORS[category.value]));

watch(category, (c) => {
  fromUnit.value = c === '温度' ? TEMP_UNITS[0] : Object.keys(FACTORS[c])[0];
});

function format(n: number): string {
  if (!Number.isFinite(n)) {
    return '—';
  }
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-6 || abs >= 1e15)) {
    return n.toExponential(6);
  }
  return String(Number(n.toPrecision(12)));
}

function toCelsius(v: number, u: string): number {
  if (u === '华氏度') {
    return ((v - 32) * 5) / 9;
  }
  if (u === '开尔文') {
    return v - 273.15;
  }
  return v;
}

function fromCelsius(c: number, u: string): number {
  if (u === '华氏度') {
    return (c * 9) / 5 + 32;
  }
  if (u === '开尔文') {
    return c + 273.15;
  }
  return c;
}

const rows = computed<{ label: string, value: string }[]>(() => {
  const v = amount.value;
  if (v === null || !Number.isFinite(v)) {
    return [];
  }

  if (category.value === '温度') {
    const c = toCelsius(v, fromUnit.value);
    return TEMP_UNITS.map(u => ({
      label: u === fromUnit.value ? `${u}（输入）` : u,
      value: `${format(fromCelsius(c, u))} ${u === '开尔文' ? 'K' : `°${u === '摄氏度' ? 'C' : 'F'}`}`,
    }));
  }

  const factors = FACTORS[category.value];
  const base = v * factors[fromUnit.value];
  return Object.keys(factors).map(u => ({
    label: u === fromUnit.value ? `${u}（输入）` : u,
    value: format(base / factors[u]),
  }));
});

const output = computed(() =>
  `${amount.value} ${fromUnit.value}\n${rows.value.map(r => `${r.label}: ${r.value}`).join('\n')}`,
);
</script>

<template>
  <div flex flex-col gap-3>
    <c-buttons-select
      v-model:value="category"
      :options="[...CATEGORIES]"
      label="类别："
      label-position="left"
      label-width="90px"
      label-align="right"
    />

    <div flex items-center gap-4 pl-90px>
      <n-input-number v-model:value="amount" flex-1 :show-button="false" placeholder="数值" />
      <c-select v-model:value="fromUnit" :options="units" w-200px />
    </div>

    <div v-if="rows.length" mt-1>
      <div mb-1 op-70 text-13px>
        换算结果：
      </div>
      <TextareaCopyable :value="output" />
    </div>
  </div>
</template>
