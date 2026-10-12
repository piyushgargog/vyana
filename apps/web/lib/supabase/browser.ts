// apps/web/lib/supabase/browser.ts
// Browser Supabase client for Next.js client components
// Owner: Vaibhav Parmar

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@vyana/shared";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";
  return createBrowserClient<Database>(url, anonKey);
}

