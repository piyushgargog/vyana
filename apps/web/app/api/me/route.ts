import { OkRes } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { deleteMyAccount, requireRecentLogin } from "@/lib/server/data/account";
import { withRoute } from "@/lib/server/errors";
import { supabaseAdmin } from "@/lib/server/supabase-admin";

export const maxDuration = 60;

/**
 * "Delete my account" (DPDP): removes the signed-in user's files and their account; the profile and every row
 * that belongs to it go with it. It cannot be undone, so the apps ask the user to confirm and to sign in again
 * (within 15 minutes) before calling it; a session that signed in longer ago gets 403.
 */
export const DELETE = withRoute("me", async (req, ctx) => {
  const { user } = await requireUser(req);
  ctx.userId = user.id;
  requireRecentLogin(req);
  await deleteMyAccount(supabaseAdmin(), user.id);
  const res: OkRes = { ok: true };
  return Response.json(process.env.NODE_ENV === "production" ? res : OkRes.parse(res), { headers: { "cache-control": "no-store" } });
});
