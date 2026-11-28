import type { GlobalThemeOverrides } from 'naive-ui';

/**
 * API Studio 全屏壳的 naive-ui 主题覆盖 —— 与 src/styles/api-studio-tokens.css 同源。
 *
 * ⚠ 同 themes.ts 的纪律：naive-ui 对颜色值做 rgba 运算，绝不写 'var(--api-x)'
 *   （会 console.error `[seemly/rgba]: Invalid color value` 且暗色下整页不渲染）。
 *   这里必须是真实色值，与 CSS token 文件逐值对齐。改色时两处一起改。
 *
 * 壳内用**嵌套 n-config-provider** 注入这两套，使 API-Studio 的明暗独立于站点
 * 全局主题（styleStore.isDarkTheme）：新用户默认浅色工作区，用户可切换到专业深色工作区，不污染站点其它页面。
 */

// 深色：保留低照度 navy 工作区，以柔和 violet 作品牌强调
export const apiStudioDarkOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#b39aff',
    primaryColorHover: '#c7b6ff',
    primaryColorPressed: '#9677f2',
    primaryColorSuppl: '#c7b6ff',
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
  Input: { color: '#131c2e', colorFocus: '#18233a', border: '1px solid #223050', borderFocus: '1px solid #b39aff' },
  Select: { peers: { InternalSelection: { color: '#131c2e', border: '1px solid #223050' } } },
  Tree: { color: 'transparent', nodeColorHover: '#18233a', nodeColorActive: 'rgba(179, 154, 255, 0.16)' },
  Menu: { itemHeight: '32px' },
  Tag: { borderRadius: '5px' },
};

// 明色（新用户默认）：violet-on-light
export const apiStudioLightOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#7655e8',
    primaryColorHover: '#6846d8',
    primaryColorPressed: '#5736c6',
    primaryColorSuppl: '#6846d8',
    infoColor: '#2563eb',
    successColor: '#059669',
    warningColor: '#d97706',
    errorColor: '#dc2626',

    bodyColor: '#f7f7fc',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    inputColor: '#e8e5f2',
    tableColor: '#ffffff',
    borderColor: '#c7cfdd',
    dividerColor: '#c7cfdd',

    textColorBase: '#0f172a',
    textColor1: '#0f172a',
    textColor2: '#475569',
    textColor3: '#475569',
    placeholderColor: '#5b6677',
    iconColor: '#5b6677',

    borderRadius: '8px',
    borderRadiusSmall: '5px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  Layout: {
    color: '#f7f7fc',
    headerColor: '#ffffff',
    siderColor: '#f0eef7',
    footerColor: '#e8e5f2',
    borderColor: '#c7cfdd',
  },
  Input: { color: '#e8e5f2', colorFocus: '#ffffff', border: '1px solid #75839a', borderFocus: '1px solid #7655e8' },
  Select: { peers: { InternalSelection: { color: '#e8e5f2', border: '1px solid #75839a', borderFocus: '1px solid #7655e8' } } },
  Tree: { color: 'transparent', nodeColorHover: '#e8e5f2', nodeColorActive: '#e7e0ff' },
  Menu: { itemHeight: '32px' },
  Tag: { borderRadius: '5px' },
};
