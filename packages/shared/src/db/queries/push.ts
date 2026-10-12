// packages/shared/src/db/queries/push.ts
// Owner: Vaibhav Parmar

import { check, requireUserId, type Sb } from "./helpers";

export type PushPlatform = "ios" | "android" | "web";

/** Stores this device's push token for the signed-in user (the same token twice only refreshes the time). */
export async function savePushToken(sb: Sb, token: string, platform: PushPlatform): Promise<void> {
  const userId = await requireUserId(sb);
  check(await sb.from("push_tokens").upsert({ user_id: userId, token, platform, updated_at: new Date().toISOString() }, { onConflict: "user_id,token" }));
}
