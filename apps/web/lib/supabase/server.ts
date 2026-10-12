// apps/web/lib/supabase/server.ts
// Server Supabase client for Next.js Server Components and Server Actions
// Owner: Vaibhav Parmar

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@vyana/shared";

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy apps/web/.env.example to apps/web/.env.local."
    );
  }

  return createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored if called from a Server Component and refreshed by proxy.ts
          }
        },
      },
    }
  );
}
