import "server-only";
import type { AdminDoctorCheckReq, DoctorVerifyReq, DoctorVerifyRes } from "@vyana/shared";
import { requireRole, type AuthedUser } from "./auth";
import { councilKey, normalizeRegNo } from "./doctor-register";
import { badRequest, notFound } from "./errors";
import { log } from "./log";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Doctor registration, checked by hand (issue #344). A doctor only sends their registration details and
 * stays `pending`; an admin looks the number up in the public register and approves or rejects. Nothing
 * is looked up or verified automatically.
 */

interface DoctorRow {
  id: string;
  reg_no: string | null;
  state_council: string | null;
  verification_status: DoctorVerifyRes["status"];
}

/** A doctor sends their registration details. Stays `pending` until an admin checks them. */
export async function submitDoctorRegistration({ sb, user, profile }: AuthedUser, body: DoctorVerifyReq): Promise<DoctorVerifyRes> {
  requireRole(profile, "doctor");
  const { data: doctor, error } = await sb
    .from("doctors")
    .select("id, reg_no, state_council, verification_status")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!doctor) throw notFound("Complete your doctor profile first.");

  const admin = supabaseAdmin();
  const checkedAt = new Date().toISOString();
  const row = doctor as DoctorRow;
  // A verified doctor who sends the same number and council again keeps `verified`; only a change re-opens the check.
  const unchanged =
    row.verification_status === "verified" &&
    normalizeRegNo(row.reg_no ?? "") === normalizeRegNo(body.reg_no) &&
    councilKey(row.state_council ?? "") === councilKey(body.state_council);

  const patch: Record<string, unknown> = {
    reg_no: body.reg_no.trim(),
    state_council: body.state_council.trim(),
    year_of_registration: body.year_of_registration ?? null,
  };
  if (!unchanged) {
    Object.assign(patch, {
      verification_status: "pending",
      verification_json: { submitted_at: checkedAt, method: "manual" },
      verified_at: null,
    });
  }
  const { error: saveError } = await admin.from("doctors").update(patch).eq("id", user.id);
  if (saveError) throw saveError;

  const status: DoctorVerifyRes["status"] = unchanged ? "verified" : "pending";
  log({ event: "doctor_registration", status });
  return { status, match: null, checked_at: checkedAt };
}

/** An admin records the outcome of checking a doctor's registration in the public register by hand. */
export async function adminCheckDoctor({ user, profile }: AuthedUser, body: AdminDoctorCheckReq): Promise<DoctorVerifyRes> {
  requireRole(profile, "admin");
  const admin = supabaseAdmin();
  const checkedAt = new Date().toISOString();

  const { data: doctor, error } = await admin.from("doctors").select("id").eq("id", body.doctor_id).maybeSingle();
  if (error) throw error;
  if (!doctor) throw notFound("This doctor was not found.");

  const verificationJson = { method: "manual", checked_by: user.id, checked_at: checkedAt, note: body.note };

  if (body.decision === "reject") {
    const { error: saveError } = await admin
      .from("doctors")
      .update({ verification_status: "failed", verified_at: null, verification_json: verificationJson })
      .eq("id", body.doctor_id);
    if (saveError) throw saveError;
    log({ event: "doctor_check", status: "failed" });
    return { status: "failed", match: null, checked_at: checkedAt };
  }

  // One registration, one account: a number already verified for another doctor cannot be approved again.
  const { data: verifiedRows, error: listError } = await admin
    .from("doctors")
    .select("id, reg_no, state_council")
    .eq("verification_status", "verified");
  if (listError) throw listError;
  const taken = ((verifiedRows ?? []) as DoctorRow[]).some(
    (d) =>
      d.id !== body.doctor_id &&
      normalizeRegNo(d.reg_no ?? "") === normalizeRegNo(body.reg_no) &&
      councilKey(d.state_council ?? "") === councilKey(body.state_council),
  );
  if (taken) throw badRequest("This registration is already linked to another account.");

  const { error: saveError } = await admin
    .from("doctors")
    .update({
      verification_status: "verified",
      verified_at: checkedAt,
      // The admin-typed values, stored exactly as typed (issue #359); matching stays normalisation-based.
      reg_no: body.reg_no,
      state_council: body.state_council,
      year_of_registration: body.year,
      verification_json: verificationJson,
    })
    .eq("id", body.doctor_id);
  if (saveError) throw saveError;
  log({ event: "doctor_check", status: "verified" });
  return { status: "verified", match: null, checked_at: checkedAt };
}
