import { MeExportRes } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { exportMyData } from "@/lib/server/data/account";
import { jsonRes, withRoute } from "@/lib/server/errors";
import { supabaseAdmin } from "@/lib/server/supabase-admin";

export const maxDuration = 60;

/** "Download my data" (DPDP): every row the signed-in user owns, keyed by table, and their files with one-hour links. */
export const GET = withRoute("me/export", async (req, ctx) => {
  const { user } = await requireUser(req);
  ctx.userId = user.id;
  const res = await exportMyData(supabaseAdmin(), user);
  const today = new Date().toISOString().slice(0, 10);
  return jsonRes(MeExportRes, res, {
    headers: {
      // The file holds health data and links to files: never stored by a cache.
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="vyana-my-data-${today}.json"`,
    },
  });
});
