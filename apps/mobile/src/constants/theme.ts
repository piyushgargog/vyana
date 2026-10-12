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
