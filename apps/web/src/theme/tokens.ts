import type { GlobalThemeOverrides } from 'naive-ui';

/**
 * Design tokens for ModelHarbor.
 *
 * Tokens are organised in three layers:
 *  1. Semantic constants at the top (`light` / `dark`) — single source of truth
 *     for brand, surface, border, text and shadow values.
 *  2. `common.*` mappings — feed Naive UI's global theme overrides.
 *  3. Component-level overrides (`Card`, `Menu`, `DataTable`, ...) — derived
 *     from the same semantic constants so light/dark stay in sync.
 *
 * Hardcoded greys scattered across pages (`#667085`, `#d0d5dd`, `#f8fafc`,
 * `#344054`, `#2f7cf6`) are replaced by Naive UI CSS variables that these
 * tokens drive, so dark mode follows automatically.
 */

const FONT_FAMILY =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const light = {
  brand: '#2563eb',
  brandHover: '#3b82f6',
  brandPressed: '#1d4ed8',
  brandSuppl: '#3b82f6',

  surface: '#ffffff',
  surfaceAlt: '#f8fafc',
  surfaceSidebar: '#fbfcfd',
  surfaceHeader: '#ffffff',

  border: '#e4e7ec',
  divider: '#eef0f3',

  textPrimary: '#1d2433',
  textSecondary: '#475467',
  textTertiary: '#98a2b3',

  success: '#12b886',
  warning: '#f59e0b',
  error: '#fa5252',
  info: '#228be6',

  shadow1: '0 1px 2px rgba(16,24,40,0.06)',
  shadow2: '0 4px 8px rgba(16,24,40,0.08), 0 1px 2px rgba(16,24,40,0.04)',
  shadow3: '0 12px 24px rgba(16,24,40,0.10), 0 4px 8px rgba(16,24,40,0.06)',
};

const dark = {
  brand: '#3b82f6',
  brandHover: '#60a5fa',
  brandPressed: '#2563eb',
  brandSuppl: '#60a5fa',

  surface: '#0f1115',
  surfaceAlt: '#161922',
  surfaceSidebar: '#0c0e12',
  surfaceHeader: '#0f1115',

  border: '#232733',
  divider: '#1c2029',

  textPrimary: '#f2f4f8',
  textSecondary: '#a8b0bd',
  textTertiary: '#6b7280',

  success: '#20c997',
  warning: '#fab005',
  error: '#ff6b6b',
  info: '#4dabf7',

  shadow1: '0 1px 2px rgba(0,0,0,0.4)',
  shadow2: '0 4px 10px rgba(0,0,0,0.45)',
  shadow3: '0 12px 28px rgba(0,0,0,0.55)',
};

export const lightTokens: GlobalThemeOverrides = {
  common: {
    primaryColor: light.brand,
    primaryColorHover: light.brandHover,
    primaryColorPressed: light.brandPressed,
    primaryColorSuppl: light.brandSuppl,
    borderRadius: '8px',

    bodyColor: light.surface,
    cardColor: light.surface,
    modalColor: light.surface,
    popoverColor: light.surface,
    tableColor: light.surface,
    tableHeaderColor: light.surfaceAlt,

    textColorBase: light.textPrimary,
    textColor1: light.textPrimary,
    textColor2: light.textSecondary,
    textColor3: light.textTertiary,
    textColorDisabled: light.textTertiary,

    placeholderColor: light.textTertiary,
    iconColor: light.textSecondary,
    iconColorHover: light.textPrimary,

    borderColor: light.border,
    dividerColor: light.divider,

    successColor: light.success,
    successColorHover: '#0ca678',
    successColorPressed: '#0b8a65',
    warningColor: light.warning,
    warningColorHover: '#f08c00',
    warningColorPressed: '#d97900',
    errorColor: light.error,
    errorColorHover: '#f03e3e',
    errorColorPressed: '#e03131',
    infoColor: light.info,
    infoColorHover: '#1c7ed6',
    infoColorPressed: '#1971c2',

    boxShadow1: light.shadow1,
    boxShadow2: light.shadow2,
    boxShadow3: light.shadow3,

    fontWeight: '400',
    fontWeightStrong: '600',
    fontFamily: FONT_FAMILY,
    fontSize: '14px',
  },
  Card: {
    color: light.surface,
    colorModal: light.surface,
    borderColor: light.border,
    boxShadow: light.shadow1,
    borderRadius: '10px',
    paddingMedium: '20px 24px',
  },
  Menu: {
    itemHeight: '40px',
    itemColorActive: 'rgba(37,99,235,0.08)',
    itemColorActiveHover: 'rgba(37,99,235,0.12)',
    itemColorHover: light.surfaceAlt,
    itemTextColorActive: light.brand,
    itemTextColorActiveHover: light.brand,
    itemIconColorActive: light.brand,
    borderRadius: '8px',
  },
  DataTable: {
    thColor: light.surfaceAlt,
    thTextColor: light.textSecondary,
    tdColor: light.surface,
    tdColorHover: light.surfaceAlt,
    tdColorStriped: light.surfaceAlt,
    borderColor: light.border,
    borderRadius: '8px',
    thFontWeight: '600',
  },
  Button: {
    fontWeight: '500',
    borderRadiusMedium: '8px',
  },
  Tag: {
    borderRadius: '6px',
  },
  Input: {
    borderRadius: '8px',
  },
  Layout: {
    color: light.surface,
    headerColor: light.surfaceHeader,
    siderColor: light.surfaceSidebar,
    textColor: light.textPrimary,
  },
  Statistic: {
    valueFontWeight: '700',
    valueTextColor: light.textPrimary,
    labelTextColor: light.textTertiary,
  },
};

export const darkTokens: GlobalThemeOverrides = {
  common: {
    primaryColor: dark.brand,
    primaryColorHover: dark.brandHover,
    primaryColorPressed: dark.brandPressed,
    primaryColorSuppl: dark.brandSuppl,
    borderRadius: '8px',

    bodyColor: dark.surface,
    cardColor: dark.surface,
    modalColor: dark.surface,
    popoverColor: dark.surface,
    tableColor: dark.surface,
    tableHeaderColor: dark.surfaceAlt,

    textColorBase: dark.textPrimary,
    textColor1: dark.textPrimary,
    textColor2: dark.textSecondary,
    textColor3: dark.textTertiary,
    textColorDisabled: dark.textTertiary,

    placeholderColor: dark.textTertiary,
    iconColor: dark.textSecondary,
    iconColorHover: dark.textPrimary,

    borderColor: dark.border,
    dividerColor: dark.divider,

    successColor: dark.success,
    successColorHover: '#15cab7',
    successColorPressed: '#0ca678',
    warningColor: dark.warning,
    warningColorHover: '#f59f00',
    warningColorPressed: '#f08c00',
    errorColor: dark.error,
    errorColorHover: '#fa5252',
    errorColorPressed: '#e03131',
    infoColor: dark.info,
    infoColorHover: '#74c0fc',
    infoColorPressed: '#4dabf7',

    boxShadow1: dark.shadow1,
    boxShadow2: dark.shadow2,
    boxShadow3: dark.shadow3,

    fontWeight: '400',
    fontWeightStrong: '600',
    fontFamily: FONT_FAMILY,
    fontSize: '14px',
  },
  Card: {
    color: dark.surface,
    colorModal: dark.surface,
    borderColor: dark.border,
    boxShadow: dark.shadow1,
    borderRadius: '10px',
    paddingMedium: '20px 24px',
  },
  Menu: {
    itemHeight: '40px',
    itemColorActive: 'rgba(59,130,246,0.18)',
    itemColorActiveHover: 'rgba(59,130,246,0.24)',
    itemColorHover: dark.surfaceAlt,
    itemTextColorActive: '#93c5fd',
    itemTextColorActiveHover: '#93c5fd',
    itemIconColorActive: '#93c5fd',
    borderRadius: '8px',
  },
  DataTable: {
    thColor: dark.surfaceAlt,
    thTextColor: dark.textSecondary,
    tdColor: dark.surface,
    tdColorHover: dark.surfaceAlt,
    tdColorStriped: dark.surfaceAlt,
    borderColor: dark.border,
    borderRadius: '8px',
    thFontWeight: '600',
  },
  Button: {
    fontWeight: '500',
    borderRadiusMedium: '8px',
  },
  Tag: {
    borderRadius: '6px',
  },
  Input: {
    borderRadius: '8px',
  },
  Layout: {
    color: dark.surface,
    headerColor: dark.surfaceHeader,
    siderColor: dark.surfaceSidebar,
    textColor: dark.textPrimary,
  },
  Statistic: {
    valueFontWeight: '700',
    valueTextColor: dark.textPrimary,
    labelTextColor: dark.textTertiary,
  },
};

export type ThemeMode = 'light' | 'dark';
