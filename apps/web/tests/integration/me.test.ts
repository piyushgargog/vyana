import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorBody, MeExportRes, OkRes } from "@vyana/shared";
import { memoryDb, type Row } from "../fixtures/memory-db";

const ME = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const DOCTOR = "33333333-3333-4333-8333-333333333333";
const CAREGIVER = "44444444-4444-4444-8444-444444444444";

/** An access token with the claims that matter here (the signature is not checked in tests: the mocked auth accepts the string). */
const nowSeconds = () => Math.floor(Date.now() / 1000);
const jwt = (claims: object) => `${Buffer.from("{}").toString("base64url")}.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
const signedIn = (minutesAgo: number, extra: object = {}) =>
  jwt({ amr: [{ method: "password", timestamp: nowSeconds() - minutesAgo * 60 }], iat: nowSeconds() - 60, ...extra });

const T = {
  me: signedIn(1),
  doctor: signedIn(2),
  caregiver: signedIn(3),
  stale: signedIn(16, { sub: "stale" }),
  /** Signed in a day ago, token refreshed a minute ago: `iat` is new, `amr` tells the truth. */
  refreshedOldLogin: signedIn(24 * 60, { sub: "refreshed" }),
  /** An older token without `amr`: `iat` counts. */
  noAmrFresh: jwt({ iat: nowSeconds() - 120 }),
  noAmrOld: jwt({ iat: nowSeconds() - 3600 }),
  noClaims: jwt({}),
};
const TOKENS: Record<string, { id: string; email: string }> = {
  [T.me]: { id: ME, email: "me@vyana.test" },
  [T.doctor]: { id: DOCTOR, email: "doctor@vyana.test" },
  [T.caregiver]: { id: CAREGIVER, email: "caregiver@vyana.test" },
  [T.stale]: { id: ME, email: "me@vyana.test" },
  [T.refreshedOldLogin]: { id: ME, email: "me@vyana.test" },
  [T.noAmrFresh]: { id: ME, email: "me@vyana.test" },
  [T.noAmrOld]: { id: ME, email: "me@vyana.test" },
  [T.noClaims]: { id: ME, email: "me@vyana.test" },
};

let db: ReturnType<typeof memoryDb>;
/** Files by "bucket/path". */
let files: Map<string, { size: number; created_at: string }>;
let calls: string[];
let failRemove = false;
let failList = false;
let deleteUserError: { status?: number; code?: string; message: string } | null = null;

function storage() {
  return {
    from: (bucket: string) => ({
      async list(folder: string, opts: { limit: number; offset: number }) {
        if (failList) return { data: null, error: new Error("storage list failed") };
        const prefix = `${bucket}/${folder}/`;
        const seen = new Set<string>();
        const entries: { name: string; id: string | null; created_at?: string; metadata?: { size: number } }[] = [];
        for (const [key, meta] of [...files].sort(([a], [b]) => (a < b ? -1 : 1))) {
          if (!key.startsWith(prefix)) continue;
          const rest = key.slice(prefix.length);
          const [first, ...more] = rest.split("/");
          if (more.length > 0) {
            if (!seen.has(first)) entries.push({ name: first, id: null });
            seen.add(first);
          } else entries.push({ name: first, id: `id-${key}`, created_at: meta.created_at, metadata: { size: meta.size } });
        }
        return { data: entries.slice(opts.offset, opts.offset + opts.limit), error: null };
      },
      async remove(paths: string[]) {
        calls.push(`remove:${bucket}:${paths.length}`);
        if (failRemove) return { data: null, error: new Error("storage remove failed") };
        const gone = paths.filter((p) => files.delete(`${bucket}/${p}`));
        return { data: gone.map((name) => ({ name })), error: null };
      },
      async createSignedUrls(paths: string[], seconds: number) {
        return { data: paths.map((path) => ({ path, signedUrl: `https://files.test/${bucket}/${path}?ttl=${seconds}`, error: null })), error: null };
      },
    }),
  };
}

vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => {
    const sb = db.sb as unknown as Record<string, unknown>;
    return Object.assign(Object.create(sb), {
      auth: {
        getUser: async (token: string) =>
          TOKENS[token] ? { data: { user: TOKENS[token] }, error: null } : { data: { user: null }, error: new Error("invalid JWT") },
        admin: {
          deleteUser: async (id: string) => {
            calls.push(`deleteUser:${id}`);
            if (deleteUserError) return { data: null, error: deleteUserError };
            for (const t of Object.keys(db.tables)) db.tables[t] = db.tables[t].filter((r) => r.id !== id && r.patient_id !== id && r.user_id !== id);
            return { data: { user: null }, error: null };
          },
        },
      },
      storage: storage(),
    });
  },
  supabaseForUser: () => db.sb,
  requireEnv: (name: string) => process.env[name] ?? "",
}));

const account = await import("@/lib/server/data/account");
const { GET: exportGet } = await import("@/app/api/me/export/route");
const { DELETE: deleteMe } = await import("@/app/api/me/route");
const { supabaseAdmin } = await import("@/lib/server/supabase-admin");

const call = (handler: typeof exportGet | typeof deleteMe, url: string, token?: string) =>
  (handler as (req: Request, ctx: object) => Promise<Response>)(
    new Request(`http://localhost${url}`, { method: handler === exportGet ? "GET" : "DELETE", headers: token ? { authorization: `Bearer ${token}` } : {} }),
    {},
  );

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function world(): Record<string, Row[]> {
  return {
    profiles: [
      { id: ME, role: "patient", full_name: "Aryan Sharma", phone: "+91 00000 00001" },
      { id: OTHER, role: "patient", full_name: "Someone Else" },
      { id: DOCTOR, role: "doctor", full_name: "Dr. Mehta" },
      { id: CAREGIVER, role: "patient", full_name: "Sunita" },
    ],
    doctors: [{ id: DOCTOR, reg_no: "DMC-1", specialization: "Physician" }],
    consents: [
      { id: uuid(1), user_id: ME, version: "2026-10-11", accepted_at: "2026-10-11T00:00:00Z" },
      { id: uuid(2), user_id: OTHER, version: "2026-10-11", accepted_at: "2026-10-11T00:00:00Z" },
    ],
    prescriptions: [
      { id: uuid(10), patient_id: ME, doctor_id: DOCTOR, source: "doctor", diagnosis: "Type 2 Diabetes" },
      { id: uuid(11), patient_id: OTHER, doctor_id: DOCTOR, source: "doctor", diagnosis: "Asthma" },
    ],
    vitals: [
      { id: uuid(20), patient_id: ME, type: "weight", value: 70 },
      { id: uuid(21), patient_id: OTHER, type: "weight", value: 80 },
    ],
    appointments: [{ id: uuid(30), patient_id: OTHER, doctor_id: DOCTOR, status: "completed" }],
    care_links: [{ id: uuid(40), patient_id: ME, caregiver_id: CAREGIVER, relation: "Daughter", status: "active" }],
    care_invites: [{ code: "123456", patient_id: ME, expires_at: "2026-10-14T00:00:00Z", used_by: null }],
    share_links: [{ token: "a".repeat(48), patient_id: ME, kind: "medical_id", expires_at: "2026-10-14T00:00:00Z", revoked: false }],
    push_tokens: [
      { user_id: ME, token: "ExponentPushToken[secret-device]", platform: "android", updated_at: "2026-10-12T00:00:00Z" },
      { user_id: OTHER, token: "ExponentPushToken[other-device]", platform: "ios", updated_at: "2026-10-12T00:00:00Z" },
    ],
    chat_messages: [{ id: uuid(50), user_id: ME, session_id: uuid(51), role: "user", parts: [{ type: "text", text: "hello" }] }],
    care_invite_attempts: [{ user_id: ME, attempted_at: "2026-10-12T00:00:00Z" }],
  };
}

beforeEach(() => {
  db = memoryDb(world());
  files = new Map([
    [`prescriptions/${ME}/aaa.jpg`, { size: 1200, created_at: "2026-10-01T00:00:00Z" }],
    [`prescriptions/${ME}/nested/bbb.pdf`, { size: 4000, created_at: "2026-10-02T00:00:00Z" }],
    [`lab-reports/${ME}/ccc.png`, { size: 900, created_at: "2026-10-03T00:00:00Z" }],
    [`prescriptions/${OTHER}/zzz.jpg`, { size: 1, created_at: "2026-10-01T00:00:00Z" }],
    [`lab-reports/${OTHER}/yyy.jpg`, { size: 1, created_at: "2026-10-01T00:00:00Z" }],
  ]);
  calls = [];
  failRemove = false;
  failList = false;
  deleteUserError = null;
});

describe("GET /api/me/export", () => {
  it("answers 401 without a token and with a bad one", async () => {
    for (const token of [undefined, "nope"]) {
      const res = await call(exportGet, "/api/me/export", token);
      expect(res.status).toBe(401);
      expect(ApiErrorBody.parse(await res.json()).error.code).toBe("UNAUTHORIZED");
    }
  });

  it("downloads the rows of the user, keyed by table, as a file nobody may cache", async () => {
    const res = await call(exportGet, "/api/me/export", T.me);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-disposition")).toMatch(/^attachment; filename="vyana-my-data-\d{4}-\d{2}-\d{2}\.json"$/);
    const body = MeExportRes.parse(await res.json()) as Record<string, Row[]>;
    expect(body.profiles).toEqual([{ id: ME, role: "patient", full_name: "Aryan Sharma", phone: "+91 00000 00001" }]);
    expect(body.consents.map((r) => r.id)).toEqual([uuid(1)]);
    expect(body.prescriptions.map((r) => r.diagnosis)).toEqual(["Type 2 Diabetes"]);
    expect(body.vitals.map((r) => r.id)).toEqual([uuid(20)]);
    expect(body.chat_messages).toHaveLength(1);
    expect(body.doctors).toEqual([]);
    expect(body.meal_logs).toEqual([]); // a table the user has no rows in is still there, empty
  });

  it("holds nothing of another patient", async () => {
    const text = JSON.stringify(await (await call(exportGet, "/api/me/export", T.me)).json());
    for (const hidden of [OTHER, "Someone Else", "Asthma", "other-device"]) expect(text).not.toContain(hidden);
  });

  it("leaves out the link token, the pairing code and the device token, which would open data to somebody else", async () => {
    const body = (await (await call(exportGet, "/api/me/export", T.me)).json()) as Record<string, Row[]>;
    expect(body.share_links).toEqual([{ patient_id: ME, kind: "medical_id", expires_at: "2026-10-14T00:00:00Z", revoked: false }]);
    expect(body.care_invites).toEqual([{ patient_id: ME, expires_at: "2026-10-14T00:00:00Z", used_by: null }]);
    expect(body.push_tokens).toEqual([{ user_id: ME, platform: "android", updated_at: "2026-10-12T00:00:00Z" }]);
    const text = JSON.stringify(body);
    for (const secret of ["a".repeat(48), "123456", "secret-device"]) expect(text).not.toContain(secret);
  });

  it("gives a caregiver the care link, not the records of the person they look after", async () => {
    const body = (await (await call(exportGet, "/api/me/export", T.caregiver)).json()) as Record<string, Row[]>;
    expect(body.care_links.map((r) => r.id)).toEqual([uuid(40)]);
    expect(body.prescriptions).toEqual([]);
    expect(body.vitals).toEqual([]);
    expect(body.share_links).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("Aryan Sharma");
  });

  it("gives a doctor their own registration, not the records of their patients", async () => {
    const body = (await (await call(exportGet, "/api/me/export", T.doctor)).json()) as Record<string, Row[]>;
    expect(body.doctors).toEqual([{ id: DOCTOR, reg_no: "DMC-1", specialization: "Physician" }]);
    expect(body.prescriptions).toEqual([]);
    expect(body.appointments).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("Asthma");
  });

  it("lists the uploaded files of the user, in every folder, with a link that works for an hour", async () => {
    const body = (await (await call(exportGet, "/api/me/export", T.me)).json()) as { files: Row[]; _export: Row };
    expect(body.files.map((f) => `${f.bucket}/${f.path}`).sort()).toEqual([
      `lab-reports/${ME}/ccc.png`,
      `prescriptions/${ME}/aaa.jpg`,
      `prescriptions/${ME}/nested/bbb.pdf`,
    ]);
    expect(body.files[0]).toMatchObject({ size: expect.any(Number), download_url: expect.stringContaining("ttl=3600") });
    expect(JSON.stringify(body)).not.toContain(OTHER);
    expect(body._export).toMatchObject({ user_id: ME, email: "me@vyana.test", file_links_valid_minutes: 60, truncated: [] });
  });

  it("fails as a whole if a table cannot be read, instead of handing out a partial file", async () => {
    const failing = { from: () => ({ select: () => ({ eq: () => ({ order: () => ({ range: async () => ({ data: null, error: new Error("boom") }) }) }) }) }) };
    await expect(account.exportMyData(failing as never, { id: ME, email: null })).rejects.toThrow("boom");
  });
});

describe("exportMyData", () => {
  it("reads every page, not only the first thousand rows", async () => {
    const vitals = Array.from({ length: 2500 }, (_, i) => ({ id: uuid(100 + i), patient_id: ME, type: "weight", value: i }));
    db = memoryDb({ ...world(), vitals });
    const out = (await account.exportMyData(supabaseAdmin(), { id: ME, email: null })) as { vitals: Row[] };
    expect(out.vitals).toHaveLength(2500);
    expect(new Set(out.vitals.map((r) => r.id)).size).toBe(2500);
  });

  it("stops at the limit of one table and says so", async () => {
    const n = account.MAX_ROWS_PER_TABLE + 500;
    const vitals = Array.from({ length: n }, (_, i) => ({ id: uuid(100 + i), patient_id: ME, type: "weight", value: i }));
    db = memoryDb({ ...world(), vitals });
    const out = (await account.exportMyData(supabaseAdmin(), { id: ME, email: null })) as { vitals: Row[]; _export: { truncated: string[] } };
    expect(out.vitals).toHaveLength(account.MAX_ROWS_PER_TABLE);
    expect(out._export.truncated).toEqual(["vitals"]);
  });

  it("stops at the limit of files and says so", async () => {
    for (let i = 0; i < account.MAX_EXPORT_FILES + 20; i++) files.set(`prescriptions/${ME}/f${String(i).padStart(4, "0")}.jpg`, { size: 1, created_at: "2026-10-01T00:00:00Z" });
    const out = (await account.exportMyData(supabaseAdmin(), { id: ME, email: null })) as { files: unknown[]; _export: { truncated: string[] } };
    expect(out.files).toHaveLength(account.MAX_EXPORT_FILES);
    expect(out._export.truncated.some((t) => t.startsWith("files:"))).toBe(true);
  });
});

describe("lastSignInSeconds", () => {
  it("takes the latest sign-in time of the session", () => {
    expect(account.lastSignInSeconds(jwt({ iat: 500, amr: [{ method: "password", timestamp: 100 }, { method: "otp", timestamp: 300 }] }))).toBe(300);
  });
  it("uses iat without amr, and ignores an amr without times", () => {
    expect(account.lastSignInSeconds(jwt({ iat: 500 }))).toBe(500);
    expect(account.lastSignInSeconds(jwt({ iat: 500, amr: [{ method: "password" }] }))).toBe(500);
  });
  it("is null for something that is not a token", () => {
    for (const bad of ["", "abc", "a.b", "a.%%%.c", `a.${Buffer.from("not json").toString("base64url")}.c`]) expect(account.lastSignInSeconds(bad)).toBeNull();
  });
});

describe("what the download covers", () => {
  const types = readFileSync(resolve(__dirname, "../../../../packages/shared/src/db/database.types.ts"), "utf8");
  const start = types.indexOf("Tables: {");
  const body = types.slice(start, types.indexOf("Views:", start));
  const schema = new Map<string, string[]>();
  for (const m of body.matchAll(/^ {6}(\w+): \{\n {8}Row: \{([\s\S]*?)\n {8}\}/gm)) {
    schema.set(m[1], [...m[2].matchAll(/^ {10}(\w+):/gm)].map((c) => c[1]));
  }

  it("knows the tables of the database", () => {
    expect(schema.size).toBeGreaterThan(25);
    expect(schema.get("profiles")).toContain("id");
  });

  it("puts every table either in the download or on the list of tables that are left out on purpose", () => {
    const exported = account.EXPORT_TABLES.map((t) => t.table);
    const leftOut = Object.keys(account.NOT_EXPORTED);
    const unknown = [...schema.keys()].filter((t) => !exported.includes(t) && !leftOut.includes(t));
    // A new table fails this test until somebody decides whether the user's rows in it belong in the download.
    expect(unknown).toEqual([]);
    expect(exported.filter((t) => leftOut.includes(t))).toEqual([]);
    expect(new Set(exported).size).toBe(exported.length);
    for (const t of [...exported, ...leftOut]) expect(schema.has(t), t).toBe(true);
  });

  it("uses columns that exist", () => {
    for (const spec of account.EXPORT_TABLES) {
      const columns = schema.get(spec.table) ?? [];
      for (const c of [...spec.owner, spec.order, ...(spec.omit ?? [])]) expect(columns, `${spec.table}.${c}`).toContain(c);
    }
  });

  it("leaves out every column that works as a key to somebody's data", () => {
    const omitted = (table: string) => account.EXPORT_TABLES.find((t) => t.table === table)?.omit ?? [];
    expect(omitted("share_links")).toContain("token");
    expect(omitted("care_invites")).toContain("code");
    expect(omitted("push_tokens")).toContain("token");
  });
});

describe("DELETE /api/me", () => {
  it("answers 401 without a token, and deletes nothing", async () => {
    const res = await call(deleteMe, "/api/me");
    expect(res.status).toBe(401);
    expect(calls).toEqual([]);
    expect(files.size).toBe(5);
  });

  it("removes the files of the user in every folder, then the account, and nobody else's", async () => {
    const res = await call(deleteMe, "/api/me", T.me);
    expect(res.status).toBe(200);
    expect(OkRes.parse(await res.json())).toEqual({ ok: true });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect([...files.keys()].sort()).toEqual([`lab-reports/${OTHER}/yyy.jpg`, `prescriptions/${OTHER}/zzz.jpg`]);
    expect(calls.at(-1)).toBe(`deleteUser:${ME}`);
    expect(calls.filter((c) => c.startsWith("remove:")).length).toBeGreaterThan(0);
    expect(calls.indexOf(`deleteUser:${ME}`)).toBe(calls.length - 1); // files first
  });

  it("removes a large number of files in batches", async () => {
    for (let i = 0; i < 250; i++) files.set(`lab-reports/${ME}/g${String(i).padStart(4, "0")}.jpg`, { size: 1, created_at: "2026-10-01T00:00:00Z" });
    const res = await call(deleteMe, "/api/me", T.me);
    expect(res.status).toBe(200);
    expect([...files.keys()].filter((k) => k.includes(ME))).toEqual([]);
    expect(calls.filter((c) => c.startsWith("remove:lab-reports")).length).toBeGreaterThanOrEqual(3);
  });

  it("asks for a recent sign-in: a session older than 15 minutes gets 403 and nothing is deleted", async () => {
    const res = await call(deleteMe, "/api/me", T.stale);
    expect(res.status).toBe(403);
    expect(ApiErrorBody.parse(await res.json()).error).toMatchObject({ code: "FORBIDDEN", message: expect.stringContaining("sign in again") });
    expect(calls).toEqual([]);
    expect(files.size).toBe(5);
  });

  it("goes by the time of the sign-in, not by how new the token is", async () => {
    expect((await call(deleteMe, "/api/me", T.refreshedOldLogin)).status).toBe(403);
    expect(calls).toEqual([]);
  });

  it("falls back to the age of the token when it has no sign-in time, and refuses a token with neither", async () => {
    expect((await call(deleteMe, "/api/me", T.noAmrOld)).status).toBe(403);
    expect((await call(deleteMe, "/api/me", T.noClaims)).status).toBe(403);
    expect(calls).toEqual([]);
    expect((await call(deleteMe, "/api/me", T.noAmrFresh)).status).toBe(200);
  });

  it("keeps the account when a file cannot be removed, so the user can try again", async () => {
    failRemove = true;
    const res = await call(deleteMe, "/api/me", T.me);
    expect(res.status).toBe(500);
    expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
    expect(files.size).toBe(5);
  });

  it("keeps the account when the files cannot be listed", async () => {
    failList = true;
    expect((await call(deleteMe, "/api/me", T.me)).status).toBe(500);
    expect(calls.some((c) => c.startsWith("deleteUser"))).toBe(false);
  });

  it("works for a user without any file", async () => {
    const res = await call(deleteMe, "/api/me", T.doctor);
    expect(res.status).toBe(200);
    expect(calls).toEqual([`deleteUser:${DOCTOR}`]);
    expect(files.size).toBe(5);
  });

  it("treats an account that is already gone as deleted", async () => {
    deleteUserError = { status: 404, code: "user_not_found", message: "User not found" };
    expect((await call(deleteMe, "/api/me", T.me)).status).toBe(200);
  });

  it("answers 500 when the account itself cannot be deleted", async () => {
    deleteUserError = { status: 500, code: "unexpected_failure", message: "Database error deleting user" };
    expect((await call(deleteMe, "/api/me", T.me)).status).toBe(500);
  });

  it("does not use a path outside the folder of the user", async () => {
    await account.deleteMyAccount(supabaseAdmin(), ME);
    expect(calls.filter((c) => c.startsWith("remove:"))).toHaveLength(2); // one batch for each bucket
    expect(files.has(`prescriptions/${OTHER}/zzz.jpg`)).toBe(true);
  });
});
