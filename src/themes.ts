import type { GlobalThemeOverrides } from 'naive-ui';
import { ddTokens } from './generated/dd-tokens';

/**
 * Naive UI 主题覆盖 —— 颜色全部来自 dd-tokens（B3）。
 *
 * ⚠ 不要在这里写 'var(--dd-x)'：
 *   Naive 会对 primaryColor 等值做颜色运算（seemly/rgba），
 *   实测会抛 `[seemly/rgba]: Invalid color value var(--dd-primary)`，
 *   而且是 **console.error 不是 throw** —— 暗色下整页不渲染却几乎没有明显报错。
 *   所以 Naive 侧必须拿真实色值，由 src/generated/dd-tokens.ts 在构建期从
 *   public/css/dd-tokens.css 生成（唯一事实来源仍是那个 CSS 文件）。
 *
 * 本轮只做两件事（见方案 §3.1）：
 *   ① 消除「同一语义多份取值」—— 值相同的直接引用 token，零视觉变化
 *   ② 修脱离设计体系的残留旧值（暗色 body #101014、下拉/弹层 #333333 #1e1e1e）
 * 值与 token 不同的（正文色、语义色）保持原样，集中在方案文档「待确认统一」清单，
 * 不擅自把全站文字明度/语义色一起换掉。
 */
export const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: ddTokens.light.primary,
    primaryColorHover: ddTokens.light.primary_hover,
    primaryColorPressed: ddTokens.light.primary_active,
    primaryColorSuppl: ddTokens.light.primary_hover,
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
    primaryColor: ddTokens.dark.primary,
    primaryColorHover: ddTokens.dark.primary_hover,
    primaryColorPressed: ddTokens.dark.primary_active,
    primaryColorSuppl: ddTokens.dark.primary_hover,

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
