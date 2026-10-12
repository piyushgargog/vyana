import "server-only";
import type { DoctorVerifyReq, DoctorVerifyRes } from "@vyana/shared";
import { requireRole, type AuthedUser } from "./auth";
import { cached, normalizeKeyPart } from "./cache";
import { notFound } from "./errors";
import { log } from "./log";
import { supabaseAdmin } from "./supabase-admin";
import type { CallCounter } from "./tinyfish/client";
import { closestRecord, councilKey, lookupRegister, normalizeRegNo, recordMatches, type NmcRecord, type NmcResult } from "./tinyfish/nmc";

/** Doctor verification route logic (SPEC §7, ADR-047). Never auto-verifies on a partial match. */

const REGISTER_DAYS = 30;

const toMatch = (r: NmcRecord | null): DoctorVerifyRes["match"] =>
  r ? { name: r.name, reg_no: r.reg_no, state_council: r.state_council, year_of_registration: r.year_of_registration ?? null } : null;

export async function verifyDoctor({ sb, user, profile }: AuthedUser, body: DoctorVerifyReq, counter: CallCounter): Promise<DoctorVerifyRes> {
  requireRole(profile, "doctor");
  const { data: doctor, error } = await sb.from("doctors").select("id").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (!doctor) throw notFound("Complete your doctor profile first.");

  const admin = supabaseAdmin();
  const checkedAt = new Date().toISOString();
  const claim = { name: profile.full_name ?? "", reg_no: body.reg_no, state_council: body.state_council, year_of_registration: body.year_of_registration };

  const save = async (status: DoctorVerifyRes["status"], json: Record<string, unknown>, verified = false) => {
    const patch: Record<string, unknown> = { verification_status: status, verification_json: { ...json, checked_at: checkedAt } };
    if (verified) {
      Object.assign(patch, {
        verified_at: checkedAt,
        reg_no: body.reg_no.trim(),
        state_council: body.state_council.trim(),
        year_of_registration: body.year_of_registration ?? null,
      });
    }
    const { error: saveError } = await admin.from("doctors").update(patch).eq("id", user.id);
    if (saveError) throw saveError;
  };

  // One registration, one account (ADR-047).
  const { data: verifiedRows } = await admin.from("doctors").select("id, reg_no, state_council").eq("verification_status", "verified");
  const taken = ((verifiedRows ?? []) as { id: string; reg_no: string; state_council: string }[]).some(
    (d) => d.id !== user.id && normalizeRegNo(d.reg_no) === normalizeRegNo(body.reg_no) && councilKey(d.state_council) === councilKey(body.state_council),
  );
  if (taken) {
    await save("failed", { reason: "already linked to another account" });
    return { status: "failed", match: null, checked_at: checkedAt };
  }

  // The register is public data: a good answer is cached for 30 days per number and council.
  let pendingReason = "";
  const key = `nmc:${normalizeKeyPart(councilKey(body.state_council))}:${normalizeRegNo(body.reg_no)}`;
  const hit = await cached<NmcResult>(key, "nmc", REGISTER_DAYS * 24 * 60 * 60, async () => {
    const out = await lookupRegister(body.reg_no.trim(), body.state_council.trim(), counter);
    if (out.status === "pending") {
      pendingReason = out.reason;
      return null;
    }
    return out.result;
  });

  if (!hit) {
    await save("pending", { reason: pendingReason || "The register couldn't be read right now." });
    log({ event: "doctor_verify", status: "pending" });
    return { status: "pending", match: null, checked_at: checkedAt };
  }

  const records = hit.value.found ? hit.value.records : [];
  const match = records.find((r) => recordMatches(r, claim)) ?? null;
  if (match) {
    await save("verified", { records, reason: "matched" }, true);
    log({ event: "doctor_verify", status: "verified", cached: hit.cached });
    return { status: "verified", match: toMatch(match), checked_at: checkedAt };
  }

  const reason = records.length ? "no row matched the number, council and name" : "not on the register";
  await save("failed", { records, reason });
  log({ event: "doctor_verify", status: "failed", cached: hit.cached });
  return { status: "failed", match: toMatch(closestRecord(records, claim)), checked_at: checkedAt };
}
