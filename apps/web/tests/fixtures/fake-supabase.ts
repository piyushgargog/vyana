// In-memory stand-in for the parts of supabase-js the server uses. Tests never touch the network.

export const VALID_TOKEN = "valid-access-token";
export const OTHER_TOKEN = "other-user-token";
export const USER_ID = "3f1b6c2e-8a4d-4e7b-9c1a-2d5e6f7a8b9c";
export const OTHER_USER_ID = "7c2d9e4f-1a3b-4c5d-8e6f-9a0b1c2d3e4f";

type Row = Record<string, unknown>;

/** Rows per table. `profiles` is seeded; everything else starts empty. */
const rows: Record<string, Row[]> = {};
const table = (name: string): Row[] => (rows[name] ??= []);

export const db = {
  rows,
  web_cache: new Map<string, { payload: unknown; expires_at: string }>(),
  /** Same array as rows.prescription_items, kept for older tests. */
  get prescription_items() {
    return table("prescription_items");
  },
  inserts: [] as { table: string; rows: Row[] }[],
  /** Uploaded files by "bucket/path". */
  storage: new Map<string, Blob>(),
  /** Tables whose next insert fails (to test rollbacks). */
  failInsert: new Set<string>(),
  /** Tables whose next update fails with a unique violation (23505), as the database guard of migration 0022 answers. */
  failUpdate: new Set<string>(),
  /** What is_doctor_of answers: "doctorId:patientId" pairs. */
  doctorOf: new Set<string>(),
};

const PROFILES: Row[] = [
  { id: USER_ID, role: "patient", full_name: "Demo Patient" },
  { id: OTHER_USER_ID, role: "patient", full_name: "Other Patient" },
];

export function resetDb() {
  for (const k of Object.keys(rows)) delete rows[k];
  table("profiles").push(...PROFILES.map((p) => ({ ...p })));
  db.web_cache.clear();
  db.inserts.length = 0;
  db.storage.clear();
  db.failInsert.clear();
  db.failUpdate.clear();
  db.doctorOf.clear();
}
resetDb();

let nextId = 1;
const newId = () => `00000000-0000-4000-8000-${String(nextId++).padStart(12, "0")}`;

function query(name: string) {
  const filters: [string, unknown][] = [];
  let gtExpires = "";
  let pendingUpdate: Row | null = null;
  let pendingDelete = false;
  let limitN = Infinity;
  const notNull: string[] = [];
  const matching = () => table(name).filter((r) => filters.every(([c, v]) => r[c] === v) && notNull.every((c) => r[c] != null));

  const chain = {
    select: () => chain,
    eq: (col: string, value: unknown) => (filters.push([col, value]), chain),
    // only `.not(col, "is", null)` is understood
    not: (col: string) => (notNull.push(col), chain),
    gt: (_col: string, value: string) => ((gtExpires = value), chain),
    order: () => chain,
    limit: (n: number) => ((limitN = n), chain),
    maybeSingle: async () => {
      if (name === "web_cache") {
        const key = filters.find(([c]) => c === "key")?.[1] as string;
        const row = db.web_cache.get(key);
        return { data: row && row.expires_at > gtExpires ? { payload: row.payload } : null, error: null };
      }
      return { data: matching()[0] ?? null, error: null };
    },
    upsert: async (row: { key: string; payload: unknown; expires_at: string }) => {
      db.web_cache.set(row.key, { payload: JSON.parse(JSON.stringify(row.payload)), expires_at: row.expires_at });
      return { error: null };
    },
    insert: (r: Row | Row[]) => {
      if (db.failInsert.has(name)) {
        db.failInsert.delete(name);
        const failed = { data: null, error: new Error(`insert into ${name} failed`) };
        return {
          select: () => ({ single: async () => failed, then: (resolve: (v: typeof failed) => unknown) => resolve(failed) }),
          then: (resolve: (v: typeof failed) => unknown) => resolve(failed),
        };
      }
      const added = (Array.isArray(r) ? r : [r]).map((x) => ({ id: newId(), ...x }));
      table(name).push(...added);
      db.inserts.push({ table: name, rows: added });
      const done = { data: null, error: null };
      const all = { data: added, error: null };
      return {
        select: () => ({
          single: async () => ({ data: added[0], error: null }),
          then: (resolve: (v: typeof all) => unknown) => resolve(all),
        }),
        then: (resolve: (v: typeof done) => unknown) => resolve(done),
      };
    },
    delete: () => ((pendingDelete = true), chain),
    update: (values: Row) => ((pendingUpdate = values), chain),
    then: (resolve: (v: { data: Row[] | null; error: null }) => unknown) => {
      if (pendingUpdate && db.failUpdate.has(name)) {
        db.failUpdate.delete(name);
        const error = Object.assign(new Error(`duplicate key value violates unique constraint "idx_doctors_verified_registration"`), { code: "23505" });
        return resolve({ data: null, error } as unknown as { data: Row[] | null; error: null });
      }
      if (pendingUpdate) {
        for (const r of matching()) Object.assign(r, pendingUpdate);
        return resolve({ data: null, error: null });
      }
      if (pendingDelete) {
        const gone = new Set(matching());
        rows[name] = table(name).filter((r) => !gone.has(r));
        return resolve({ data: null, error: null });
      }
      return resolve({ data: matching().slice(0, limitN), error: null });
    },
  };
  return chain;
}

const users: Record<string, string> = { [VALID_TOKEN]: USER_ID, [OTHER_TOKEN]: OTHER_USER_ID };

export const fakeSupabaseModule = {
  supabaseAdmin: () => ({
    auth: {
      getUser: async (token: string) =>
        users[token]
          ? { data: { user: { id: users[token], email: "patient@vyana.test" } }, error: null }
          : { data: { user: null }, error: new Error("invalid JWT") },
    },
    from: query,
    storage: {
      from: (bucket: string) => ({
        download: async (path: string) => {
          const blob = db.storage.get(`${bucket}/${path}`);
          return blob ? { data: blob, error: null } : { data: null, error: new Error("Object not found") };
        },
      }),
    },
  }),
  supabaseForUser: (token: string) => ({
    from: query,
    rpc: async (fn: string, args: { p: string }) =>
      fn === "is_doctor_of" ? { data: db.doctorOf.has(`${users[token]}:${args.p}`), error: null } : { data: null, error: new Error(`no rpc ${fn}`) },
  }),
  requireEnv: (name: string) => {
    const v = process.env[name];
    if (!v) throw new Error(`Missing environment variable ${name}`);
    return v;
  },
};
