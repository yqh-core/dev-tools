/**
 * 首页类目卡的视觉身份（参考站研究范式 6：卡片字段按识别目的设计）。
 *
 * 病灶：26 个任务簇卡此前只有「名 + 计数 + 3 个工具 chip」，视觉同质、无图标锚点，
 * 用户扫一眼无法快速区分「这是哪类事」。商业站（OnlineToolHubs/NeatForge）每个类目
 * 都有图标与色彩身份。这里给每个簇一个 tabler 图标 + 一个色相锚点，让分类可扫读。
 *
 * 色相用 HSL 角度（--cluster-hue），由卡片 CSS 派生图标色/淡底/描边，
 * 中等亮度（52%）在明暗两套主题下都可读；不引入会破坏暗色的硬编码实色。
 * 图标全部来自项目已有的 @vicons/tabler，零新增依赖。
 */
import {
  Binary, Braces, Calculator, Calendar, CheckupList, Code, DeviceAnalytics,
  Exchange, FileCode, FileText, Fingerprint, Key, LetterCase, Link,
  Lock, Math, Palette, Photo, Qrcode, ShieldLock, SortAscending,
  SwitchHorizontal, TextResize, Tools, World,
} from '@vicons/tabler';
import type { Component } from 'vue';

export interface ClusterVisual { icon: Component; hue: number }

const VISUALS: Record<string, ClusterVisual> = {
  'json': { icon: Braces, hue: 205 },
  'json-convert': { icon: Exchange, hue: 215 },
  'yaml': { icon: FileCode, hue: 280 },
  'xml': { icon: Code, hue: 262 },
  'web-content': { icon: World, hue: 190 },
  'jwt': { icon: Key, hue: 45 },
  'base64': { icon: Binary, hue: 225 },
  'ids': { icon: Fingerprint, hue: 160 },
  'convert': { icon: SwitchHorizontal, hue: 178 },
  'numeric': { icon: SortAscending, hue: 232 },
  'math': { icon: Calculator, hue: 250 },
  'parse': { icon: CheckupList, hue: 142 },
  'image': { icon: Photo, hue: 322 },
  'image-color': { icon: Palette, hue: 300 },
  'image-data': { icon: Qrcode, hue: 272 },
  'pdf': { icon: FileText, hue: 2 },
  'regex': { icon: Code, hue: 168 },
  'devops': { icon: Tools, hue: 28 },
  'url': { icon: Link, hue: 200 },
  'http': { icon: World, hue: 195 },
  'ip': { icon: DeviceAnalytics, hue: 210 },
  'hash': { icon: ShieldLock, hue: 240 },
  'text-encoding': { icon: Lock, hue: 222 },
  'text-transform': { icon: LetterCase, hue: 286 },
  'text': { icon: TextResize, hue: 266 },
  'date': { icon: Calendar, hue: 36 },
};

const FALLBACK: ClusterVisual = { icon: Math, hue: 210 };

export function clusterVisual(clusterId: string | null | undefined): ClusterVisual {
  return (clusterId && VISUALS[clusterId]) || FALLBACK;
}
