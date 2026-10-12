"use client";

// packages/shared/src/providers/AppProviders.tsx
// Owner: Vaibhav Parmar

import React, { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { SupabaseClient, Session, User } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { Database } from "../db/database.types";
import { ApiProvider, useApi } from "../api/context";
import { createApiClient, type ApiClient } from "../api/client";

// Contexts
const SupabaseContext = createContext<SupabaseClient<Database> | null>(null);

export type SessionContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const ApiBaseUrlContext = createContext<string | null>(null);

const SessionContext = createContext<SessionContextValue>({
  session: null,
  user: null,
  loading: true,
});

// Hook exports
export function useSupabase(): SupabaseClient<Database> {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within an AppProviders component");
  }
  return context;
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}

/** The base URL of the web app / API (used to build share links). */
export function useApiBaseUrl(): string {
  const context = useContext(ApiBaseUrlContext);
  if (context === null) {
    throw new Error("useApiBaseUrl must be used within an AppProviders component");
  }
  return context;
}

// Re-export useApi so callers can import all hooks from shared
export { useApi };

export interface AppProvidersProps {
  supabase: SupabaseClient<Database>;
  apiBaseUrl: string;
  useMocks?: boolean;
  queryClient?: QueryClient;
  children: ReactNode;
}

export function AppProviders({
  supabase,
  apiBaseUrl,
  useMocks = false,
  queryClient: customQueryClient,
  children,
}: AppProvidersProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize QueryClient once if not provided
  const [defaultQueryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const activeQueryClient = customQueryClient ?? defaultQueryClient;

  // Never show one user's cached data to the next. The cache is dropped before the new session is
  // applied, so queries that start for the new user are not thrown away (token refreshes keep the cache).
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    const applySession = (next: Session | null) => {
      if (!mounted) return;
      const userId = next?.user.id ?? null;
      if (lastUserId.current !== undefined && lastUserId.current !== userId) activeQueryClient.clear();
      lastUserId.current = userId;
      setSession(next);
      setLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => applySession(session))
      .catch(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => applySession(session));

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, activeQueryClient]);

  // ApiClient initialization
  const apiClient: ApiClient = useMemo(() => {
    return createApiClient({
      baseUrl: apiBaseUrl,
      getAccessToken: async () => {
        try {
          const { data } = await supabase.auth.getSession();
          return data.session?.access_token ?? null;
        } catch {
          return null;
        }
      },
      useMocks,
    });
  }, [supabase, apiBaseUrl, useMocks]);

  const sessionValue = useMemo<SessionContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
    }),
    [session, loading]
  );

  return (
    <SupabaseContext.Provider value={supabase}>
      <ApiBaseUrlContext.Provider value={apiBaseUrl}>
        <SessionContext.Provider value={sessionValue}>
          <QueryClientProvider client={activeQueryClient}>
            <ApiProvider client={apiClient}>
              {children}
            </ApiProvider>
          </QueryClientProvider>
        </SessionContext.Provider>
      </ApiBaseUrlContext.Provider>
    </SupabaseContext.Provider>
  );
}
