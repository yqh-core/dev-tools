import { describe, expect, it } from 'vitest';
import {
  CATEGORIES, FACTORS, TEMP_UNITS, convertRow, fromCelsius, toCelsius, unitsOf,
} from './unit-converter.service';

const rows = (cat: typeof CATEGORIES[number], v: number, from: string) => convertRow(cat, v, from);

describe('unit-converter 数据层', () => {
  it('每个族都必须有基准单位=1，且下拉里的温度族不在 FACTORS 内', () => {
    for (const cat of CATEGORIES) {
      if (cat === 'Temperature') {
        expect(FACTORS[cat]).toBeUndefined(); // 温度是仿射变换，混进乘除表就会算错
        continue;
      }
      const base = Object.values(FACTORS[cat]).filter(v => v === 1);
      expect(base.length, `${cat} 应该有且仅有一个因子为 1 的基准单位`).toBe(1);
    }
  });

  it('长度：以米为基准的几条硬值', () => {
    const r = rows('Length', 1, 'km');
    expect(r.m).toBe(1000);
    expect(r.in).toBeCloseTo(39370.07874, 4);
    expect(rows('Length', 1, 'in').m).toBeCloseTo(0.0254, 10);
    expect(rows('Length', 1, 'nmi').km).toBeCloseTo(1.852, 6);
    // 市制：1 市尺 = 1/3 米
    expect(rows('Length', 3, 'chi (Chinese)').m).toBeCloseTo(1, 9);
  });

  it('数据存储 1 字节 = 8 位（bit 的因子是 0.125，最容易写反）', () => {
    expect(rows('Data storage', 1, 'byte').bit).toBe(8);
    expect(rows('Data storage', 8, 'bit').byte).toBe(1);
    expect(rows('Data storage', 1, 'KB').byte).toBe(1024);
  });

  it('角度 1 圈 = 360°、1° = π/180 rad', () => {
    expect(rows('Angle', 1, 'turn')['°']).toBe(360);
    expect(rows('Angle', 180, '°').rad).toBeCloseTo(Math.PI, 12);
  });

  it('压力：1 atm = 101.325 kPa = 760 mmHg', () => {
    expect(rows('Pressure', 1, 'atm').kPa).toBeCloseTo(101.325, 6);
    expect(rows('Pressure', 1, 'atm').mmHg).toBeCloseTo(760, 3);
  });

  // 以下三族本轮新加：数值取自国际固定定义，用来挡住"键翻成英文时把因子改错"
  it('力：1 kgf = 9.80665 N（标准重力）、1 lbf = 4.4482216152605 N', () => {
    expect(rows('Force', 1, 'kgf').N).toBeCloseTo(9.80665, 6);
    expect(rows('Force', 1, 'lbf').N).toBeCloseTo(4.4482216152605, 10);
    expect(rows('Force', 1, 'kN').N).toBe(1000);
  });

  it('能量：1 kcal = 4184 J、1 kWh = 3.6 MJ、1 BTU ≈ 1055.06 J', () => {
    expect(rows('Energy', 1, 'kcal').J).toBeCloseTo(4184, 6);
    expect(rows('Energy', 1, 'kWh').MJ).toBeCloseTo(3.6, 9);
    expect(rows('Energy', 1, 'BTU').J).toBeCloseTo(1055.05585262, 5);
  });

  it('密度：1 g/cm³ = 1000 kg/m³、1 lb/ft³ ≈ 16.0185 kg/m³', () => {
    expect(rows('Density', 1, 'g/cm³')['kg/m³']).toBe(1000);
    expect(rows('Density', 1, 'lb/ft³')['kg/m³']).toBeCloseTo(16.01846337, 6);
    expect(rows('Density', 1000, 'g/m³')['kg/m³']).toBe(1);
  });

  it('温度：0 °C = 32 °F = 273.15 K，且往返闭合', () => {
    expect(rows('Temperature', 0, 'Celsius').Fahrenheit).toBe(32);
    expect(rows('Temperature', 0, 'Celsius').Kelvin).toBe(273.15);
    expect(rows('Temperature', 100, 'Celsius').Fahrenheit).toBe(212);
    for (const u of TEMP_UNITS) {
      expect(fromCelsius(toCelsius(36.6, u), u)).toBeCloseTo(36.6, 9);
    }
  });

  it('unitsOf 对每个族都返回非空且唯一的标签', () => {
    for (const cat of CATEGORIES) {
      const us = unitsOf(cat as typeof CATEGORIES[number]);
      // 温度族只有 C/F/K 三个，所以下界取 3（写成 >3 会被自己绊倒）；
      // 这条真正要防的是空表和重复标签 —— 重复键会让下拉出现两个同名单位。
      expect(us.length).toBeGreaterThanOrEqual(3);
      expect(new Set(us).size).toBe(us.length);
    }
  });
});
