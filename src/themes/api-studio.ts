import type { GlobalThemeOverrides } from 'naive-ui';

/**
 * API Studio 全屏壳的 naive-ui 主题覆盖 —— 与 src/styles/api-studio-tokens.css 同源。
 *
 * ⚠ 同 themes.ts 的纪律：naive-ui 对颜色值做 rgba 运算，绝不写 'var(--api-x)'
 *   （会 console.error `[seemly/rgba]: Invalid color value` 且暗色下整页不渲染）。
 *   这里必须是真实色值，与 CSS token 文件逐值对齐。改色时两处一起改。
 *
 * 壳内用**嵌套 n-config-provider** 注入这两套，使 API-Studio 的明暗独立于站点
 * 全局主题（styleStore.isDarkTheme）：进入全屏壳即自带专业深色，不污染站点其它页面。
 */

// 深色（默认）：navy 低照度 + teal 提亮
export const apiStudioDarkOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#2dd4bf',
    primaryColorHover: '#5eead4',
    primaryColorPressed: '#14b8a6',
    primaryColorSuppl: '#5eead4',
    infoColor: '#60a5fa',
    successColor: '#34d399',
    warningColor: '#fbbf24',
    errorColor: '#f87171',

    bodyColor: '#070b14',
    cardColor: '#0e1626',
    modalColor: '#131c2e',
    popoverColor: '#18233a',
    inputColor: '#131c2e',
    tableColor: '#0e1626',
    borderColor: '#223050',
    dividerColor: '#223050',

    textColorBase: '#e6eaf2',
    textColor1: '#e6eaf2',
    textColor2: '#aab3c5',
    textColor3: '#6f7c96',
    placeholderColor: '#6f7c96',
    iconColor: '#aab3c5',
    iconColorHover: '#e6eaf2',

    borderRadius: '8px',
    borderRadiusSmall: '5px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  Layout: {
    color: '#070b14',
    headerColor: '#0e1626',
    siderColor: '#0e1626',
    footerColor: '#070b14',
    borderColor: '#223050',
  },
  Card: { color: '#0e1626', borderColor: '#223050' },
  Input: { color: '#131c2e', colorFocus: '#18233a', border: '1px solid #223050', borderFocus: '1px solid #2dd4bf' },
  Select: { peers: { InternalSelection: { color: '#131c2e', border: '1px solid #223050' } } },
  Tree: { color: 'transparent', nodeColorHover: '#18233a', nodeColorActive: 'rgba(45, 212, 191, 0.14)' },
  Menu: { itemHeight: '32px' },
  Tag: { borderRadius: '5px' },
};

// 明色（自适应备选）：teal-on-light
export const apiStudioLightOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#0f766e',
    primaryColorHover: '#115e59',
    primaryColorPressed: '#134e4a',
    primaryColorSuppl: '#115e59',
    infoColor: '#2563eb',
    successColor: '#059669',
    warningColor: '#d97706',
    errorColor: '#dc2626',

    bodyColor: '#eef1f6',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    inputColor: '#f5f7fb',
    tableColor: '#ffffff',
    borderColor: '#d8deea',
    dividerColor: '#d8deea',

    textColorBase: '#0f172a',
    textColor1: '#0f172a',
    textColor2: '#475569',
    textColor3: '#8a94a6',
    placeholderColor: '#8a94a6',

    borderRadius: '8px',
    borderRadiusSmall: '5px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  Layout: {
    color: '#eef1f6',
    headerColor: '#ffffff',
    siderColor: '#ffffff',
    footerColor: '#eef1f6',
    borderColor: '#d8deea',
  },
  Tree: { color: 'transparent', nodeColorHover: '#eaeef5', nodeColorActive: '#ccfbf1' },
  Menu: { itemHeight: '32px' },
  Tag: { borderRadius: '5px' },
};
