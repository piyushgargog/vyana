import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BUCKETS } from "@vyana/shared";
import { forbidden } from "../errors";

/** The private buckets; every file is kept under `{user_id}/` (supabase/migrations/0003_storage.sql). */
const FILE_BUCKETS = [BUCKETS.prescriptions, BUCKETS.labReports] as const;

const PAGE = 1000;
/** A table that has more rows than this is cut and named in `_export.truncated`, so one request cannot exhaust the server. */
export const MAX_ROWS_PER_TABLE = 20_000;
/** The most files listed with a download link. */
export const MAX_EXPORT_FILES = 500;
const SIGNED_URL_SECONDS = 60 * 60;
const SIGN_BATCH = 100;
const REMOVE_BATCH = 100;
const FOLDER_DEPTH = 3;

/** Deleting an account asks for a sign-in this recent (the contract says "requires a recent login"). */
export const RECENT_LOGIN_MINUTES = 15;

export interface ExportTable {
  table: string;
  /** The column(s) that hold the user's id; a row counts as theirs when any of them matches. */
  owner: string[];
  /** A unique column, so paging by `range` never skips or repeats a row. */
  order: string;
  /** Columns left out because a copy of the file could open something (a link token, a pairing code, a device token). */
  omit?: string[];
}

/**
 * What "download my data" holds: every row that belongs to the user, from each table, keyed by table name.
 *
 * Rows are selected by the owner column, never by what the user's login is allowed to read: a caregiver can read
 * the records of the person they look after and a doctor those of their patients, and none of that is theirs to
 * download. A doctor's export is therefore their own profile, registration and use of the app, not their patients.
 */
export const EXPORT_TABLES: ExportTable[] = [
  { table: "profiles", owner: ["id"], order: "id" },
  { table: "doctors", owner: ["id"], order: "id" },
  { table: "consents", owner: ["user_id"], order: "id" },
  { table: "emergency_contacts", owner: ["patient_id"], order: "id" },
  { table: "conditions", owner: ["patient_id"], order: "id" },
  { table: "appointments", owner: ["patient_id"], order: "id" },
  { table: "blood_requests", owner: ["patient_id"], order: "id" },
  { table: "prescriptions", owner: ["patient_id"], order: "id" },
  { table: "prescription_items", owner: ["patient_id"], order: "id" },
  { table: "dose_logs", owner: ["patient_id"], order: "id" },
  { table: "lab_reports", owner: ["patient_id"], order: "id" },
  { table: "lab_values", owner: ["patient_id"], order: "id" },
  { table: "vitals", owner: ["patient_id"], order: "id" },
  { table: "meal_logs", owner: ["patient_id"], order: "id" },
  { table: "care_plans", owner: ["patient_id"], order: "id" },
  { table: "care_links", owner: ["patient_id", "caregiver_id"], order: "id" },
  { table: "care_invites", owner: ["patient_id"], order: "code", omit: ["code"] },
  { table: "share_links", owner: ["patient_id"], order: "token", omit: ["token"] },
  { table: "interaction_checks", owner: ["patient_id"], order: "id" },
  { table: "drug_alerts", owner: ["patient_id"], order: "id" },
  { table: "emergency_requests", owner: ["patient_id"], order: "id" },
  { table: "chat_sessions", owner: ["user_id"], order: "id" },
  { table: "chat_messages", owner: ["user_id"], order: "id" },
  { table: "ai_runs", owner: ["user_id"], order: "id" },
  { table: "user_plans", owner: ["user_id"], order: "user_id" },
  { table: "push_tokens", owner: ["user_id"], order: "token", omit: ["token"] },
];

/** Tables that hold a user id (or are linked to a user's data) and are deliberately not in the download. */
export const NOT_EXPORTED: Record<string, string> = {
  care_invite_attempts: "rate-limit bookkeeping for joining with a code, no health or personal content",
  rate_limits: "counters of the per-user API limits (migration 0012), no health or personal content",
  missed_dose_alerts: "delivery bookkeeping of the alert push; the doses themselves are in dose_logs",
  hospitals: "public information",
  departments: "public information",
  price_quotes: "public prices, not tied to a user",
  web_cache: "server cache, not tied to a user",
  tinyfish_monitors: "server configuration, not tied to a user",
  plans: "the plan catalogue, public information, not tied to a user",
  waitlist: "an email address given on a public form, keyed by address rather than by account, and no health content",
};

export interface ExportedFile {
  bucket: string;
  path: string;
  size: number | null;
  created_at: string | null;
  /** Opens the file for one hour. */
  download_url: string | null;
}

export interface ExportUser {
  id: string;
  email: string | null;
}

type Row = Record<string, unknown>;

/** Reads every page of a query. Stops at `MAX_ROWS_PER_TABLE` and says so. */
async function readAll(
  page: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<{ rows: Row[]; truncated: boolean }> {
  const rows: Row[] = [];
  for (let from = 0; from < MAX_ROWS_PER_TABLE; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw error;
    const part = (data ?? []) as Row[];
    rows.push(...part);
    if (part.length < PAGE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

async function readTable(sb: SupabaseClient, spec: ExportTable, userId: string): Promise<{ rows: Row[]; truncated: boolean }> {
  const seen = new Set<string>();
  const out: Row[] = [];
  let truncated = false;
  // One query per owner column: no `or(...)` filter text is built from an id.
  for (const column of spec.owner) {
    const res = await readAll((from, to) => sb.from(spec.table).select("*").eq(column, userId).order(spec.order).range(from, to));
    truncated ||= res.truncated;
    for (const row of res.rows) {
      const key = String(row[spec.order]);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  for (const row of out) for (const column of spec.omit ?? []) delete row[column];
  return { rows: out, truncated };
}

interface StorageEntry {
  name: string;
  id: string | null;
  created_at?: string | null;
  metadata?: { size?: number } | null;
}

/** Every file under `{userId}/` of a bucket, folders included (a folder is an entry without an id). */
export async function listUserFiles(
  sb: SupabaseClient,
  bucket: string,
  userId: string,
  limit: number = Number.POSITIVE_INFINITY,
): Promise<{ path: string; size: number | null; created_at: string | null }[]> {
  const files: { path: string; size: number | null; created_at: string | null }[] = [];
  const walk = async (folder: string, depth: number): Promise<void> => {
    for (let offset = 0; files.length < limit; offset += PAGE) {
      const { data, error } = await sb.storage.from(bucket).list(folder, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      const entries = (data ?? []) as StorageEntry[];
      for (const entry of entries) {
        if (files.length >= limit) return;
        if (entry.id === null) {
          if (depth < FOLDER_DEPTH) await walk(`${folder}/${entry.name}`, depth + 1);
        } else {
          files.push({ path: `${folder}/${entry.name}`, size: entry.metadata?.size ?? null, created_at: entry.created_at ?? null });
        }
      }
      if (entries.length < PAGE) return;
    }
  };
  await walk(userId, 1);
  return files;
}

/**
 * `GET /api/me/export`: everything the app holds about the user, as one JSON object keyed by table, plus their
 * uploaded files with download links that work for one hour.
 *
 * `sb` must be the service-role client: the rows are chosen by owner above, not by row-level security.
 */
export async function exportMyData(sb: SupabaseClient, user: ExportUser, now: Date = new Date()): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  const truncated: string[] = [];

  for (const spec of EXPORT_TABLES) {
    const res = await readTable(sb, spec, user.id);
    out[spec.table] = res.rows;
    if (res.truncated) truncated.push(spec.table);
  }

  const files: ExportedFile[] = [];
  for (const bucket of FILE_BUCKETS) {
    const found = await listUserFiles(sb, bucket, user.id, MAX_EXPORT_FILES - files.length + 1);
    if (files.length + found.length > MAX_EXPORT_FILES) {
      truncated.push(`files:${bucket}`);
      found.length = MAX_EXPORT_FILES - files.length;
    }
    for (let i = 0; i < found.length; i += SIGN_BATCH) {
      const part = found.slice(i, i + SIGN_BATCH);
      const { data, error } = await sb.storage.from(bucket).createSignedUrls(
        part.map((f) => f.path),
        SIGNED_URL_SECONDS,
      );
      if (error) throw error;
      const urls = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
      for (const f of part) files.push({ bucket, path: f.path, size: f.size, created_at: f.created_at, download_url: urls.get(f.path) ?? null });
    }
  }
  out.files = files;

  out._export = {
    exported_at: now.toISOString(),
    user_id: user.id,
    email: user.email,
    file_links_valid_minutes: SIGNED_URL_SECONDS / 60,
    truncated,
    left_out: "Link tokens, pairing codes and device tokens are not included: with them somebody else could open your data or message your phone.",
  };
  return out;
}

/** Removes the files of the user from one bucket. Throws if any removal fails, so the account is kept and the user can try again. */
async function removeUserFiles(sb: SupabaseClient, bucket: string, userId: string): Promise<number> {
  let removed = 0;
  // Each round lists what is left, so a failure halfway is picked up by the next try.
  for (let round = 0; round < 1000; round++) {
    const files = await listUserFiles(sb, bucket, userId, REMOVE_BATCH);
    if (files.length === 0) return removed;
    const paths = files.map((f) => f.path).filter((p) => p.startsWith(`${userId}/`));
    if (paths.length === 0) return removed;
    const { data, error } = await sb.storage.from(bucket).remove(paths);
    if (error) throw error;
    if (!data || data.length === 0) throw new Error(`Could not remove the files in ${bucket}`);
    removed += data.length;
  }
  throw new Error(`Too many files in ${bucket}`);
}

/**
 * `DELETE /api/me`: removes the user's files, then the sign-in account. The profile and every row that belongs
 * to it go with the account (the foreign keys cascade; migration 0010 makes sure a doctor or caregiver can leave
 * too). Files go first: if that fails nothing is deleted and the user can try again, and no file is left behind
 * with nobody able to remove it.
 *
 * `sb` must be the service-role client.
 */
export async function deleteMyAccount(sb: SupabaseClient, userId: string): Promise<{ files_removed: number }> {
  let filesRemoved = 0;
  for (const bucket of FILE_BUCKETS) filesRemoved += await removeUserFiles(sb, bucket, userId);

  const { error } = await sb.auth.admin.deleteUser(userId);
  // An account that is already gone is the state the user asked for.
  if (error && !(error.status === 404 || error.code === "user_not_found")) throw error;
  return { files_removed: filesRemoved };
}

/** When the user last signed in, in seconds since 1970, from the claims of their access token; null if there is none. */
export function lastSignInSeconds(accessToken: string): number | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  let claims: { iat?: unknown; amr?: unknown };
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  // `amr` lists how and when the session was signed in; it survives a refresh of the token, `iat` does not.
  const times = Array.isArray(claims.amr)
    ? claims.amr.map((a: { timestamp?: unknown }) => a?.timestamp).filter((t): t is number => typeof t === "number")
    : [];
  if (times.length > 0) return Math.max(...times);
  return typeof claims.iat === "number" ? claims.iat : null;
}

/**
 * A stolen or forgotten session must not be able to delete an account: the access token is already verified by
 * `requireUser`, and this asks that the user signed in within `RECENT_LOGIN_MINUTES`. Otherwise 403, and the app
 * asks for the password again and retries.
 */
export function requireRecentLogin(req: Request, now: Date = new Date()): void {
  const [scheme, token] = (req.headers.get("authorization") ?? "").split(" ");
  const at = scheme?.toLowerCase() === "bearer" && token ? lastSignInSeconds(token) : null;
  if (at === null || now.getTime() / 1000 - at > RECENT_LOGIN_MINUTES * 60) {
    throw forbidden("For your safety, sign in again to delete your account.");
  }
}
