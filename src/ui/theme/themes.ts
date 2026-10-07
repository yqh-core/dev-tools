import { defineThemes } from './theme.models';
import { ddTokens } from '@/generated/dd-tokens';

/**
 * c-* 组件族的主题 —— 颜色来自 dd-tokens（B3）。
 *
 * 用构建期生成的 ddTokens 而不是 'var(--dd-*)'：这些值会参与 JS 侧的颜色运算
 * （见 src/themes.ts 顶部注释里实测到的 seemly/rgba 报错），且统一成一种写法更好维护。
 *
 * 只迁「与 token 完全相等」的值（零视觉变化）+ 修脱离设计体系的残留旧值。
 * text.baseColor / default.* / 语义色（warning/success/error）与 dd token 值不同，
 * 纳入会改变全站观感 → 保持原样，集中记录在方案文档「待确认统一」清单。
 */
export const { themes: appThemes, useTheme: useAppTheme } = defineThemes({
  light: {
    background: ddTokens.light.surface,
    text: {
      baseColor: '#333639',
      mutedColor: '#767c82',
    },
    default: {
      color: 'rgba(46, 51, 56, 0.05)',
      colorHover: 'rgba(46, 51, 56, 0.09)',
      colorPressed: 'rgba(46, 51, 56, 0.22)',
    },
    primary: {
      color: ddTokens.light.primary,
      colorHover: ddTokens.light.primary_hover,
      colorPressed: ddTokens.light.primary_active,
      colorFaded: '#0f766e2f',
    },
    warning: {
      color: '#f59e0b',
      colorHover: '#f59e0b',
      colorPressed: '#f59e0b',
      colorFaded: '#f59e0b2f',
    },
    success: {
      color: '#18a058',
      colorHover: '#36ad6a',
      colorPressed: '#0c7a43',
      colorFaded: '#18a0582f',
    },
    error: {
      color: '#d03050',
      colorHover: '#de576d',
      colorPressed: '#ab1f3f',
      colorFaded: '#d030502a',
    },
  },
  dark: {
    // 原 #1e1e1e：脱离 navy 体系。命令面板 / c-modal 的底色就取这里，实测真的是 #1e1e1e
    background: ddTokens.dark.surface,
    text: {
      baseColor: '#ffffffd1',
      mutedColor: '#ffffff80',
    },
    default: {
      color: 'rgba(255, 255, 255, 0.08)',
      colorHover: 'rgba(255, 255, 255, 0.12)',
      colorPressed: 'rgba(255, 255, 255, 0.24)',
    },
    primary: {
      color: ddTokens.dark.primary,
      colorHover: ddTokens.dark.primary_hover,
      colorPressed: ddTokens.dark.primary_active,
      colorFaded: '#14b8a62f',
    },
    warning: {
      color: '#f59e0b',
      colorHover: '#f59e0b',
      colorPressed: '#f59e0b',
      colorFaded: '#f59e0b2f',
    },
    success: {
      color: '#18a058',
      colorHover: '#36ad6a',
      colorPressed: '#0c7a43',
      colorFaded: '#18a0582f',
    },
    error: {
      color: '#e88080',
      colorHover: '#e98b8b',
      colorPressed: '#e57272',
      colorFaded: '#e8808029',
    },
  },
});
