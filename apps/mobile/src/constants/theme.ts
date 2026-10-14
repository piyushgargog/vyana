import '@/global.css';

import { Platform } from 'react-native';

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

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Vyana design tokens, Liquid Glass (DESIGN §15, ADR-066). Screens use these and the components in
 * `src/components/ui`; never raw hex. Light mode only for v1.
 */
export const T = {
  color: {
    canvas: '#F2F2F7',
    surface: '#FFFFFF',
    label: '#1C1C1E',
    label2: 'rgba(60,60,67,0.72)',
    label3: 'rgba(60,60,67,0.6)',
    separator: 'rgba(60,60,67,0.12)',
    fill: 'rgba(120,120,128,0.12)',
    fillStrong: 'rgba(120,120,128,0.2)',
    accent: '#0D9488',
    accentStrong: '#0B7A70',
    accentSoft: 'rgba(13,148,136,0.12)',
    danger: '#FF3B30',
    dangerText: '#D70015',
    dangerSoft: 'rgba(255,59,48,0.1)',
    ok: '#248A3D',
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
  radius: { row: 12, tile: 16, card: 22, feature: 28, pill: 999 },
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
    sectionHeader: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  },
  shadow: {
    float: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
    accent: { shadowColor: '#0D9488', shadowOpacity: 0.28, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  },
} as const;
