import { defineThemes } from './theme.models';
import { ddTokens } from '@/generated/dd-tokens';
import { mainPalette } from '@/main-palette';

/**
 * DigDevBox Main c-* component themes.
 *
 * Brand links and their interaction states come from the Main-only palette.
 * Neutral surfaces remain on generated ddTokens; warning/success/error roles
 * intentionally retain their existing meanings and values.
 *
 * These are concrete TypeScript colors rather than CSS variables because the
 * c-* theme helpers perform color calculations at runtime.
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
      color: mainPalette.light.link,
      colorHover: mainPalette.light.linkHover,
      colorPressed: mainPalette.light.linkPressed,
      colorFaded: mainPalette.light.linkFaded,
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
      color: mainPalette.dark.link,
      colorHover: mainPalette.dark.linkHover,
      colorPressed: mainPalette.dark.linkPressed,
      colorFaded: mainPalette.dark.linkFaded,
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
