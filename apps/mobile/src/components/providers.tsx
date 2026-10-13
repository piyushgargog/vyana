import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppProviders, type Database } from '@vyana/shared';
import { supabase } from '@/lib/supabase';

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
  const baseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
  const useMocks = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
  const [selectedBasketMedicines, setSelectedBasketMedicines] = useState<
    { name: string; strength?: string; quantity: number }[]
  >([]);
  const [toasts, setToasts] = useState<MobileToast[]>([]);

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
    <AppProviders supabase={supabase} apiBaseUrl={baseUrl} useMocks={useMocks}>
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
                  t.tone === 'success'
                    ? styles.toastSuccess
                    : t.tone === 'error'
                      ? styles.toastError
                      : t.tone === 'warning'
                        ? styles.toastWarning
                        : styles.toastInfo,
                ]}
              >
                <Text style={styles.toastText}>{t.message}</Text>
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
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  toastSuccess: {
    backgroundColor: '#115E59',
  },
  toastError: {
    backgroundColor: '#991B1B',
  },
  toastWarning: {
    backgroundColor: '#92400E',
  },
  toastInfo: {
    backgroundColor: '#0F172A',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
