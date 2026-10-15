"use client";

if (typeof globalThis !== "undefined") {
  const g = globalThis as typeof globalThis & {
    __zod_globalConfig?: { jitless?: boolean };
  };
  g.__zod_globalConfig = { ...g.__zod_globalConfig, jitless: true };
}

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
    <AppProviders
      supabase={supabase}
      apiBaseUrl=""
      useMocks={useMocks}
      onRateLimit={(event) => showToast(event.message, "info")}
    >
      <VyanaWebContext.Provider value={value}>
        {children}
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 top-4 z-50 mx-auto flex max-w-sm flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:top-auto sm:bottom-5"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="glass pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-[15px] font-medium text-label"
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 shrink-0 rounded-full ${
                  t.tone === "success" ? "bg-ok" : t.tone === "error" ? "bg-danger" : t.tone === "warning" ? "bg-warn" : "bg-label-3"
                }`}
              />
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
