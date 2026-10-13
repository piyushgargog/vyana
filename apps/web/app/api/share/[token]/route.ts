import { ShareRes } from "@vyana/shared";
import { loadSharedRecord } from "@/lib/server/data/share";
import { withRoute } from "@/lib/server/errors";
import { supabaseAdmin } from "@/lib/server/supabase-admin";

/**
 * The read-only record behind a share link. No sign-in: the unguessable token (192 random bits) is the key,
 * and a link that is unknown, turned off or expired is a plain 404. The page must never be stored by a cache
 * or a search engine, and the token must not travel in a Referer header.
 */
export const GET = withRoute<RouteContext<"/api/share/[token]">>("share/[token]", async (_req, _ctx, { params }) => {
  const { token } = await params;
  const res = await loadSharedRecord(supabaseAdmin(), token);
  return Response.json(process.env.NODE_ENV === "production" ? res : ShareRes.parse(res), {
    headers: {
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
    },
  });
});
