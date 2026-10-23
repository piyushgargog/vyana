import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppProviders, type Database } from '@vyana/shared';
import { supabase } from '@/lib/supabase';
import { T, useThemeColors } from '@/constants/theme';

export interface MobileToast {
  id: string;
  message: string;
  tone: 'success' | 'info' | 'warning' | 'error';
}

interface VyanaMobileContextValue {
  supabase: SupabaseClient<Database>;
  baseUrl: string;
  useMocks: boolean;
  selectedBasketMedicines: {
    name: string;
    strength?: string;
    quantity: number;
  }[];
  setSelectedBasketMedicines: (
    items: { name: string; strength?: string; quantity: number }[]
  ) => void;
  showToast: (message: string, tone?: MobileToast['tone']) => void;
}

const VyanaMobileContext = createContext<VyanaMobileContextValue | null>(null);

export function MobileAppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  // One name everywhere (eas.json, .env.example, BUILD.md). Without it the app uses the live site: a phone can
  // never reach 'localhost', so that default broke every release build.
  const baseUrl = (process.env.EXPO_PUBLIC_API_URL || 'https://vyanahealth.app').replace(/\/+$/, '');
  const useMocks = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
  const [selectedBasketMedicines, setSelectedBasketMedicines] = useState<
    { name: string; strength?: string; quantity: number }[]
  >([]);
  const [toasts, setToasts] = useState<MobileToast[]>([]);
  const colors = useThemeColors();

  const showToast = useCallback(
    (message: string, tone: MobileToast['tone'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3800);
    },
    []
  );

  const value = useMemo<VyanaMobileContextValue>(
    () => ({
      supabase,
      baseUrl,
      useMocks,
      selectedBasketMedicines,
      setSelectedBasketMedicines,
      showToast,
    }),
    [baseUrl, selectedBasketMedicines, showToast, useMocks]
  );

  return (
    <AppProviders
      supabase={supabase}
      apiBaseUrl={baseUrl}
      useMocks={useMocks}
      onRateLimit={(event) => showToast(event.message, 'info')}
    >
      <VyanaMobileContext.Provider value={value}>
        {children}
        {toasts.length > 0 && (
          <View
            accessibilityLiveRegion="polite"
            style={styles.toastContainer}
            pointerEvents="none"
          >
            {toasts.map((t) => (
              <View
                key={t.id}
                style={[
                  styles.toastCard,
                  {
                    backgroundColor: colors.surface,
                    borderLeftColor:
                      t.tone === 'success'
                        ? colors.ok
                        : t.tone === 'error'
                          ? colors.danger
                          : t.tone === 'warning'
                            ? colors.warn
                            : colors.accent,
                  },
                ]}
              >
                <Text style={[styles.toastText, { color: colors.label }]}>{t.message}</Text>
              </View>
            ))}
          </View>
        )}
      </VyanaMobileContext.Provider>
    </AppProviders>
  );
}

export function useVyanaMobile(): VyanaMobileContextValue {
  const ctx = useContext(VyanaMobileContext);
  if (!ctx) {
    throw new Error(
      'useVyanaMobile must be used within <MobileAppProviders>'
    );
  }
  return ctx;
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 92,
    left: 16,
    right: 16,
    zIndex: 999,
    gap: 8,
  },
  toastCard: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderLeftWidth: 4,
    ...T.shadow.float,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
