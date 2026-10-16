/**
 * 单位换算的数据层（从组件里抽出来，为了能被单测钉住）。
 *
 * 抽出来的直接动机：组件里中文是**数据键名**（CATEGORIES / FACTORS 的 key），
 * 这些键会原样渲染成下拉选项与结果行标签，所以"界面有中文"在这里等价于"数据表是中文"。
 * 放在组件里没法测；放这儿就能对每个族断言基准单位与若干条已知换算值。
 *
 * 约定：每个族的基准单位因子为 1（长度=米、质量=千克、时间=秒、数据=字节、
 * 角度=度、能量=焦耳、力=牛顿、密度=千克/立方米）。换算一律"先折到基准，再乘出去"。
 */

export const CATEGORIES = [
  'Length', 'Area', 'Volume', 'Mass', 'Speed', 'Time', 'Data storage',
  'Power', 'Pressure', 'Angle', 'Energy', 'Force', 'Density', 'Temperature',
] as const;

export type Category = typeof CATEGORIES[number];

/** 温度是仿射变换不是线性比例，不能塞进 FACTORS（乘除会得到错值），单独走分支。 */
export const TEMP_UNITS = ['Celsius', 'Fahrenheit', 'Kelvin'] as const;

export const FACTORS: Record<string, Record<string, number>> = {
  'Length': {
    'km': 1000,
    'm': 1,
    'dm': 0.1,
    'cm': 0.01,
    'mm': 0.001,
    'µm': 1e-6,
    'mi': 1609.344,
    'yd': 0.9144,
    'ft': 0.3048,
    'in': 0.0254,
    'nmi': 1852,
    // 中国市制：市里=500m、市尺=1/3m、市寸=1/30m
    'li (Chinese)': 500,
    'chi (Chinese)': 1 / 3,
    'cun (Chinese)': 1 / 30,
  },
  'Area': {
    'km²': 1e6,
    'ha': 1e4,
    'm²': 1,
    'dm²': 0.01,
    'cm²': 1e-4,
    'mu (Chinese)': 666.6666666667,
    'ac': 4046.8564224,
    'ft²': 0.09290304,
    'mi²': 2589988.110336,
  },
  'Volume': {
    'm³': 1000,
    'L': 1,
    'dL': 0.1,
    'mL': 0.001,
    'cm³': 0.001,
    'gal (US)': 3.785411784,
    'gal (UK)': 4.54609,
    'ft³': 28.316846592,
    'in³': 0.016387064,
  },
  'Mass': {
    't': 1000,
    'kg': 1,
    'g': 0.001,
    'mg': 1e-6,
    'jin (Chinese)': 0.5,
    'liang (Chinese)': 0.05,
    'lb': 0.45359237,
    'oz': 0.028349523125,
    'st': 6.35029318,
  },
  'Speed': {
    'm/s': 1, 'km/h': 1 / 3.6, 'mph': 0.44704, 'ft/s': 0.3048, 'kn': 0.5144444444, 'Mach': 340.29,
  },
  'Time': {
    'ms': 0.001,
    's': 1,
    'min': 60,
    'h': 3600,
    'day': 86400,
    'week': 604800,
    'month (30d)': 2592000,
    'year (365d)': 31536000,
  },
  'Data storage': {
    bit: 0.125, byte: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3, TB: 1024 ** 4, PB: 1024 ** 5,
  },
  'Power': {
    'W': 1,
    'kW': 1000,
    'MW': 1e6,
    'PS (metric hp)': 735.49875,
    'hp (imperial)': 745.6998715823,
    'cal/s': 4.184,
  },
  'Pressure': {
    Pa: 1, kPa: 1000, MPa: 1e6, bar: 1e5, atm: 101325, mmHg: 133.322387415, psi: 6896.551724137931,
  },
  'Angle': {
    '°': 1, 'rad': 57.29577951308232, '′': 1 / 60, '″': 1 / 3600, 'grad': 0.9, 'turn': 360,
  },
  // 以下三族是本轮补上的：legacy 的 calcforce / calcheat / calcthickness 三页
  // 就是因此前不支持而被从归并批里撤出来的（并过去等于空头承诺）。
  'Force': {
    MN: 1e6,
    kN: 1000,
    N: 1,
    dyn: 1e-5,
    kgf: 9.80665,
    lbf: 4.4482216152605,
    ozf: 0.2780138509,
  },
  'Energy': {
    MJ: 1e6,
    kJ: 1000,
    J: 1,
    cal: 4.184,
    kcal: 4184,
    Wh: 3600,
    kWh: 3.6e6,
    BTU: 1055.05585262,
    eV: 1.602176634e-19,
  },
  'Density': {
    'kg/m³': 1,
    'g/cm³': 1000,
    'kg/L': 1000,
    'g/mL': 1000,
    'g/m³': 0.001,
    'lb/ft³': 16.01846337,
    'lb/gal (US)': 119.8264273,
  },
};

export function unitsOf(category: Category): string[] {
  return category === 'Temperature' ? [...TEMP_UNITS] : Object.keys(FACTORS[category]);
}

export function toCelsius(v: number, u: string): number {
  if (u === 'Fahrenheit') {
    return ((v - 32) * 5) / 9;
  }
  return u === 'Kelvin' ? v - 273.15 : v;
}

export function fromCelsius(c: number, u: string): number {
  if (u === 'Fahrenheit') {
    return (c * 9) / 5 + 32;
  }
  return u === 'Kelvin' ? c + 273.15 : c;
}

/** 温度走仿射分支，其余族走"折基准再乘出"。 */
export function convertRow(category: Category, value: number, fromUnit: string): Record<string, number> {
  const out: Record<string, number> = {};
  if (category === 'Temperature') {
    const c = toCelsius(value, fromUnit);
    for (const u of TEMP_UNITS) {
      out[u] = fromCelsius(c, u);
    }
    return out;
  }
  const factors = FACTORS[category];
  const base = value * factors[fromUnit];
  for (const u of Object.keys(factors)) {
    out[u] = base / factors[u];
  }
  return out;
}
