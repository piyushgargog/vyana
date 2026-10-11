"use client";

// React context that hands the API client to the hooks in hooks/api.
// AppProviders (providers/) renders <ApiProvider client={...}> and re-exports useApi.
import { createContext, useContext, type ReactNode } from "react";

import type { ApiClient } from "./client";

const ApiContext = createContext<ApiClient | null>(null);

export function ApiProvider({ client, children }: { client: ApiClient; children: ReactNode }) {
  return <ApiContext.Provider value={client}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiClient {
  const client = useContext(ApiContext);
  if (!client) throw new Error("useApi must be used inside <ApiProvider> (rendered by AppProviders).");
  return client;
}
