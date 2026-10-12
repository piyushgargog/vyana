"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppProviders, type Database } from "@vyana/shared";
import { createClient } from "@/lib/supabase/browser";

export interface ToastMessage {
  id: string;
  message: string;
  tone: "success" | "info" | "warning" | "error";
}

interface VyanaWebContextValue {
  supabase: SupabaseClient<Database>;
  useMocks: boolean;
  setUseMocks: (v: boolean) => void;
  showToast: (message: string, tone?: ToastMessage["tone"]) => void;
}

const VyanaWebContext = createContext<VyanaWebContextValue | null>(null);

function getBrowserSupabaseClient(): SupabaseClient<Database> {
  if (typeof window !== "undefined") {
    return createClient();
  }
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return createClient();
  }
  return new Proxy({} as SupabaseClient<Database>, {
    get(_target, prop) {
      return Reflect.get(createClient(), prop);
    },
  });
}

export function WebAppProviders({ children }: { children: React.ReactNode }) {
  const [supabase] = useState<SupabaseClient<Database>>(() =>
    getBrowserSupabaseClient()
  );
  const [useMocks, setUseMocks] = useState<boolean>(
    process.env.NEXT_PUBLIC_USE_MOCKS === "true"
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (message: string, tone: ToastMessage["tone"] = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const value = useMemo<VyanaWebContextValue>(
    () => ({
      supabase,
      useMocks,
      setUseMocks,
      showToast,
    }),
    [supabase, useMocks, showToast]
  );

  return (
    <AppProviders supabase={supabase} apiBaseUrl="" useMocks={useMocks}>
      <VyanaWebContext.Provider value={value}>
        {children}
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg border transition-all ${
                t.tone === "success"
                  ? "bg-teal-900 text-white border-teal-700"
                  : t.tone === "error"
                    ? "bg-red-900 text-white border-red-700"
                    : t.tone === "warning"
                      ? "bg-amber-900 text-white border-amber-700"
                      : "bg-slate-900 text-white border-slate-700"
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      </VyanaWebContext.Provider>
    </AppProviders>
  );
}

export function useVyanaWeb(): VyanaWebContextValue {
  const ctx = useContext(VyanaWebContext);
  if (!ctx) {
    throw new Error("useVyanaWeb must be used within <WebAppProviders>");
  }
  return ctx;
}
