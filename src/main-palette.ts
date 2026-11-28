/**
 * DigDevBox Main-only violet semantic palette.
 *
 * Inspiration: Abacus AI Bot's light-first, violet-led visual hierarchy.
 * Purple is the brand/action signal; the secondary information role now uses
 * a coordinated violet scale instead of a competing blue. Neutral surfaces,
 * typography and semantic success/warning/error colors stay unchanged.
 *
 * These values are local to DigDevBox Main. API Studio keeps its independent
 * navy/mint identity, and every other portfolio site retains its own palette.
 */
export const mainPalette = {
  light: {
    link: '#7E45EF',
    linkHover: '#6B39D9',
    linkPressed: '#5C2FC4',
    linkSoft: '#F2EDFF',
    linkFaded: '#7E45EF2F',
    onLinkSolid: '#FFFFFF',
    action: '#814EE8',
    actionHover: '#7138D4',
    actionPressed: '#5D2CB6',
    onAction: '#FFFFFF',
    info: '#6842C2',
    infoHover: '#5935A8',
    infoPressed: '#48298C',
    infoSoft: '#F3EEFF',
  },
  dark: {
    link: '#A78BFA',
    linkHover: '#B99BFF',
    linkPressed: '#9273E8',
    linkSoft: '#2D214C',
    linkFaded: '#A78BFA2F',
    onLinkSolid: '#201338',
    action: '#814EE8',
    actionHover: '#7138D4',
    actionPressed: '#5D2CB6',
    onAction: '#FFFFFF',
    info: '#B9A3FF',
    infoHover: '#CDBDFF',
    infoPressed: '#A78BFA',
    infoSoft: '#2D214C',
  },
} as const;
