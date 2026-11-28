import type { GlobalThemeOverrides } from 'naive-ui';
import { ddTokens } from './generated/dd-tokens';
import { mainPalette } from './main-palette';

/**
 * DigDevBox Main's Naive UI theme overrides.
 *
 * Main-local violet action and blue information roles come from mainPalette.
 * Neutral surfaces, borders and success/warning/danger semantics remain on
 * the shared ddTokens foundation so this Main-only refinement cannot recolor
 * API Studio or the other portfolio sites.
 *
 * ⚠ Do not pass CSS variables such as 'var(--dd-primary)' into Naive UI:
 * its color helpers run rgba calculations and emit a runtime error for CSS
 * variable strings. Naive UI must receive concrete color values from TS.
 */
export const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: mainPalette.light.action,
    primaryColorHover: mainPalette.light.actionHover,
    primaryColorPressed: mainPalette.light.actionPressed,
    primaryColorSuppl: mainPalette.light.actionHover,
    infoColor: mainPalette.light.info,
    infoColorHover: mainPalette.light.infoHover,
    infoColorPressed: mainPalette.light.infoPressed,
    infoColorSuppl: mainPalette.light.infoHover,
  },

  Button: {
    textColorPrimary: mainPalette.light.onAction,
    textColorHoverPrimary: mainPalette.light.onAction,
    textColorPressedPrimary: mainPalette.light.onAction,
    textColorFocusPrimary: mainPalette.light.onAction,
  },

  Menu: {
    itemHeight: '32px',
  },

  Layout: { color: ddTokens.light.surface_2 },

  AutoComplete: {
    peers: {
      InternalSelectMenu: { height: '500px' },
    },
  },
};

export const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: mainPalette.dark.action,
    primaryColorHover: mainPalette.dark.actionHover,
    primaryColorPressed: mainPalette.dark.actionPressed,
    primaryColorSuppl: mainPalette.dark.actionHover,
    infoColor: mainPalette.dark.info,
    infoColorHover: mainPalette.dark.infoHover,
    infoColorPressed: mainPalette.dark.infoPressed,
    infoColorSuppl: mainPalette.dark.infoHover,

    // Naive 暗色默认 bodyColor = #101014（近黑灰），脱离 DigDevBox navy 体系。
    // NGlobalStyle 把 bodyColor 直接打到 body.style.backgroundColor，
    // 而 dd-shell.css 明确「不设全局 body/html 规则」—— 不在这里接，--dd-bg 永远不生效。
    bodyColor: ddTokens.dark.bg,

    // 默认 #18181c / #1e1e1e，会在弹层上露出非 navy 底（命令面板实测就是 #1e1e1e）
    cardColor: ddTokens.dark.surface,
    modalColor: ddTokens.dark.surface,
    popoverColor: ddTokens.dark.surface,
    inputColor: ddTokens.dark.surface,
    borderColor: ddTokens.dark.border,
  },

  Button: {
    textColorPrimary: mainPalette.dark.onAction,
    textColorHoverPrimary: mainPalette.dark.onAction,
    textColorPressedPrimary: mainPalette.dark.onAction,
    textColorFocusPrimary: mainPalette.dark.onAction,
  },

  Notification: {
    color: ddTokens.dark.surface,
  },

  AutoComplete: {
    peers: {
      InternalSelectMenu: { height: '500px', color: ddTokens.dark.surface },
    },
  },

  Menu: {
    itemHeight: '32px',
  },

  Layout: {
    // 暗色底收敛到 DigDevBox navy 体系（原 gray #1c1c1c → navy）
    color: ddTokens.dark.bg,
    siderColor: ddTokens.dark.surface,
    siderBorderColor: 'transparent',
  },

  Card: {
    color: ddTokens.dark.surface,
    borderColor: ddTokens.dark.border,
  },

  Table: {
    tdColor: ddTokens.dark.surface,
    // #1c2740 是表头专用的一档提亮，dd-tokens 无对应项（既不等于 surface 也不等于 border）
    // → 保持原值，列入「待确认统一」清单，不擅自改观感
    thColor: '#1c2740',
  },
};
