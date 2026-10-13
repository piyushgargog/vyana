import { ShareRes } from "@vyana/shared";
import { loadSharedRecord } from "@/lib/server/data/share";
import { AppError, withRoute } from "@/lib/server/errors";
import { supabaseAdmin } from "@/lib/server/supabase-admin";

/** Kept on every answer, the 404 included: a cache must not remember that a link is gone, or that it ever was one. */
const PRIVATE_HEADERS = {
  "cache-control": "no-store",
  "x-robots-tag": "noindex, nofollow",
  "referrer-policy": "no-referrer",
};

/**
 * The read-only record behind a share link. No sign-in: the unguessable token (192 random bits) is the key,
 * and a link that is unknown, turned off or expired is a plain 404. The page must never be stored by a cache
 * or a search engine, and the token must not travel in a Referer header.
 */
export const GET = withRoute<RouteContext<"/api/share/[token]">>("share/[token]", async (_req, ctx, { params }) => {
  const { token } = await params;
  try {
    const res = await loadSharedRecord(supabaseAdmin(), token);
    return Response.json(process.env.NODE_ENV === "production" ? res : ShareRes.parse(res), { headers: PRIVATE_HEADERS });
  } catch (err) {
    if (err instanceof AppError && err.status === 404) {
      return Response.json(
        { error: { code: err.code, message: err.message } },
        { status: 404, headers: { ...PRIVATE_HEADERS, "x-request-id": ctx.requestId } },
      );
    }
    throw err;
  }
});
