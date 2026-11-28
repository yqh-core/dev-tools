/**
 * DigDevBox Main-only violet/blue semantic palette.
 *
 * Inspiration: Abacus.AI's measured violet links and violet/blue actions.
 * These are local Main roles, not shared family tokens. API Studio keeps its
 * independent navy/mint theme and other portfolio sites keep their own palettes.
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
    info: '#3C66BF',
    infoHover: '#3157A8',
    infoPressed: '#28498F',
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
    info: '#91B4FF',
    infoHover: '#A5C1FF',
    infoPressed: '#7DA5F8',
  },
} as const;
