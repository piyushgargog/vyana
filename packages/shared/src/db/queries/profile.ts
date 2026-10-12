// packages/shared/src/db/queries/profile.ts
// Owner: Vaibhav Parmar

import type { TablesUpdate } from "../database.types";
import type { DbProfile } from "../types";
import { requireUserId, unwrap, type Sb } from "./helpers";

/** The fields a user may edit themselves. The role is not one of them: only an admin changes it. */
export type ProfilePatch = Partial<
  Pick<
    TablesUpdate<"profiles">,
    "full_name" | "phone" | "dob" | "gender" | "blood_group" | "allergies" | "city" | "preferred_language"
  >
>;

export async function getMyProfile(sb: Sb): Promise<DbProfile> {
  const id = await requireUserId(sb);
  return unwrap(await sb.from("profiles").select("*").eq("id", id).single());
}

export async function updateMyProfile(sb: Sb, patch: ProfilePatch): Promise<DbProfile> {
  const id = await requireUserId(sb);
  return unwrap(await sb.from("profiles").update(patch).eq("id", id).select().single());
}

/** Saves the onboarding answers and marks the profile as onboarded. */
export async function completeOnboarding(sb: Sb, patch: ProfilePatch): Promise<DbProfile> {
  const id = await requireUserId(sb);
  return unwrap(await sb.from("profiles").update({ ...patch, onboarded: true }).eq("id", id).select().single());
}
