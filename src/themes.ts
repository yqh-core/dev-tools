import type { GlobalThemeOverrides } from 'naive-ui';

export const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#0f766e',
    primaryColorHover: '#0d9488',
    primaryColorPressed: '#115e59',
    primaryColorSuppl: '#0d9488',
  },

  Menu: {
    itemHeight: '32px',
  },

  Layout: { color: '#f1f5f9' },

  AutoComplete: {
    peers: {
      InternalSelectMenu: { height: '500px' },
    },
  },
};

export const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#14b8a6FF',
    primaryColorHover: '#2dd4bfFF',
    primaryColorPressed: '#0d9488FF',
    primaryColorSuppl: '#2dd4bfFF',
  },

  Notification: {
    color: '#131c2b',
  },

  AutoComplete: {
    peers: {
      InternalSelectMenu: { height: '500px', color: '#131c2b' },
    },
  },

  Menu: {
    itemHeight: '32px',
  },

  Layout: {
    // 暗色底收敛到 DigDevBox navy 体系（原 gray #1c1c1c → navy）
    color: '#0b1220',
    siderColor: '#131c2b',
    siderBorderColor: 'transparent',
  },

  Card: {
    color: '#131c2b',
    borderColor: '#1e2d49',
  },

  Table: {
    tdColor: '#131c2b',
    thColor: '#1c2740',
  },
};
