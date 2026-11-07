import { DbError, JoinWaitlistReq, JoinWaitlistRes, joinWaitlist } from "@vyana/shared";
import { jsonRes, parseBody, rateLimited, withRoute } from "@/lib/server/errors";
import { supabaseAdmin } from "@/lib/server/supabase-admin";

/**
 * Join the Family plan waitlist (issue #675): the public plans page form posts here, and
 * until now there was no route to answer it, so the form always got Next's 404 page.
 *
 * No sign-in: the form is for visitors. The `join_waitlist()` database function is the gate —
 * it lower-cases the address, refuses a second entry for the same email and plan, and rate
 * limits anonymous joins (30 an hour across all callers). The withRoute rate limit cannot
 * apply here because it counts per signed-in user, so a P0001 from the function answers 429
 * with an hour to wait instead of the generic 500.
 */
export const POST = withRoute("waitlist", async (req) => {
  const body = await parseBody(req, JoinWaitlistReq);
  try {
    const joined = await joinWaitlist(supabaseAdmin(), body.email, "family", body.note);
    return jsonRes(JoinWaitlistRes, { status: joined ? "joined" : "already_on_list" });
  } catch (err) {
    if (err instanceof DbError && err.code === "P0001") throw rateLimited(3600);
    throw err;
  }
});
