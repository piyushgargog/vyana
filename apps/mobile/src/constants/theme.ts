import '@/global.css';

import { Platform, useColorScheme } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F8FAFC',
    backgroundElement: '#F1F5F9',
    backgroundSelected: '#CCFBF1',
    textSecondary: '#475569',
    primary: '#0D9488',
    primaryDark: '#0F766E',
    primaryLight: '#F0FDFA',
    emergency: '#DC2626',
    emergencyLight: '#FEF2F2',
    warning: '#D97706',
    warningLight: '#FFFBEB',
    success: '#059669',
    successLight: '#ECFDF5',
    border: '#E2E8F0',
    card: '#FFFFFF',
  },
  dark: {
    text: '#F8FAFC',
    background: '#0F172A',
    backgroundElement: '#1E293B',
    backgroundSelected: '#134E4A',
    textSecondary: '#94A3B8',
    primary: '#14B8A6',
    primaryDark: '#0D9488',
    primaryLight: '#134E4A',
    emergency: '#EF4444',
    emergencyLight: '#450A0A',
    warning: '#F59E0B',
    warningLight: '#451A03',
    success: '#10B981',
    successLight: '#064E3B',
    border: '#334155',
    card: '#1E293B',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;

/** Frame sizes for the v2 screen frame (#487): the slim top bar every screen draws (`ScreenTopBar`). */
export const TopBarHeight = 44;
/**
 * Height of the native tab bar's content (icon and label), before the bottom safe-area inset
 * is added. This is the one tab-bar height in the app: `Screen` reserves exactly this much for
 * tab roots. (A legacy template constant disagreed with it by a point on iOS and was removed —
 * nothing read it.)
 */
export const TabBarHeight = Platform.select({ ios: 49, android: 80 }) ?? 49;
/** Height of the floating Scan action on Today: the medium button plus the glass padding around it. */
export const ScanActionHeight = 54;

/**
 * Vyana design tokens, Liquid Glass (DESIGN §15, ADR-066). Screens use these and the components in
 * `src/components/ui`; never raw hex. `T` is the light appearance; `darkColors` below is its dark
 * half (issue #287), with the same keys, reached through `useThemeColors()`.
 */
export const T = {
  color: {
    canvas: '#F2F2F7',
    surface: '#FFFFFF',
    label: '#1C1C1E',
    // Aligned with the web tokens (U1): at 0.72/0.60 these measured 4.47:1 and 3.29:1 on the
    // canvas — under the 4.5:1 small text needs. 0.78/0.74 measure 5.26:1 and 4.74:1.
    label2: 'rgba(60,60,67,0.78)',
    label3: 'rgba(60,60,67,0.74)',
    separator: 'rgba(60,60,67,0.12)',
    fill: 'rgba(120,120,128,0.12)',
    fillStrong: 'rgba(120,120,128,0.2)',
    accent: '#0D9488',
    accentStrong: '#0B7A70',
    // The deep end of the welcome hero gradient (#488): white words on it measure over 7:1,
    // which the accent itself (about 3.9:1) cannot carry at body size.
    accentDeep: '#065F52',
    accentSoft: 'rgba(13,148,136,0.12)',
    danger: '#FF3B30',
    dangerText: '#D70015',
    dangerSoft: 'rgba(255,59,48,0.1)',
    ok: '#1B7330',
    okSoft: 'rgba(52,199,89,0.12)',
    warn: '#C93400',
    warnSoft: 'rgba(255,149,0,0.14)',
    white: '#FFFFFF',
    /** Icon tile colours (iOS system colours). */
    tile: { accent: '#0D9488', blue: '#007AFF', green: '#34C759', orange: '#FF9500', red: '#FF3B30', gray: '#8E8E93', indigo: '#5856D6' },
    /** Glass fallback where native Liquid Glass is not available (Android, older iOS). */
    glassFallback: 'rgba(255,255,255,0.86)',
    glassBorder: 'rgba(255,255,255,0.8)',
  },
  radius: { row: 12, tile: 16, card: 20, feature: 28, pill: 999 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  text: {
    largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
    title1: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
    title2: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
    title3: { fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38 },
    headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
    body: { fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
    callout: { fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
    subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
    footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
    caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400', letterSpacing: 0.06 },
    sectionHeader: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  },
  shadow: {
    float: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
    accent: { shadowColor: '#0D9488', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  },
} as const;

/** The same colour tokens as plain strings, so a second palette can stand in for `T.color`. */
export type ThemeColors = {
  [K in keyof typeof T.color]: K extends 'tile' ? Record<keyof typeof T.color.tile, string> : string;
};

/**
 * The dark half of the tokens (issue #287): the same keys as `T.color`, values taken from the
 * iOS dark system colours and brightened where a text token needs 4.5:1 on the dark surface —
 * `label3` sits at 0.55 rather than iOS's 0.30 for that reason, and the light `label3` and `ok`
 * were raised to the web values in the same pass (0.6 measured 3.3:1, #248A3D measured 3.9:1).
 */
export const darkColors: ThemeColors = {
  canvas: '#000000',
  surface: '#1C1C1E',
  label: '#FFFFFF',
  label2: 'rgba(235,235,245,0.68)',
  label3: 'rgba(235,235,245,0.55)',
  separator: 'rgba(84,84,88,0.65)',
  fill: 'rgba(120,120,128,0.24)',
  fillStrong: 'rgba(120,120,128,0.36)',
  accent: '#2DD4BF',
  accentStrong: '#3EC6B8',
  accentDeep: '#04332D',
  accentSoft: 'rgba(45,212,191,0.18)',
  danger: '#FF453A',
  dangerText: '#FF6961',
  dangerSoft: 'rgba(255,69,58,0.16)',
  ok: '#30D158',
  okSoft: 'rgba(48,209,88,0.16)',
  warn: '#FF9F0A',
  warnSoft: 'rgba(255,159,10,0.18)',
  white: '#FFFFFF',
  tile: { accent: '#2DD4BF', blue: '#0A84FF', green: '#30D158', orange: '#FF9F0A', red: '#FF453A', gray: '#98989F', indigo: '#5E5CE6' },
  glassFallback: 'rgba(28,28,30,0.78)',
  glassBorder: 'rgba(255,255,255,0.18)',
};

/**
 * The palette for the system appearance right now. Screens still read `T` directly (the app
 * ships light-only until they migrate), but new and shared surfaces — the glass chrome first —
 * take their colours from here, so the flip to `userInterfaceStyle: "automatic"` becomes a
 * per-screen migration rather than a rewrite.
 */
export function useThemeColors(): ThemeColors {
  return useColorScheme() === 'dark' ? darkColors : T.color;
}
