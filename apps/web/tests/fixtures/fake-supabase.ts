// In-memory stand-in for the parts of supabase-js the server uses. Tests never touch the network.

export const VALID_TOKEN = "valid-access-token";
export const OTHER_TOKEN = "other-user-token";
export const USER_ID = "3f1b6c2e-8a4d-4e7b-9c1a-2d5e6f7a8b9c";
export const OTHER_USER_ID = "7c2d9e4f-1a3b-4c5d-8e6f-9a0b1c2d3e4f";

type Row = Record<string, unknown>;

export const db = {
  web_cache: new Map<string, { payload: unknown; expires_at: string }>(),
  profiles: new Map<string, Row>([
    [USER_ID, { id: USER_ID, role: "patient", full_name: "Demo Patient" }],
    [OTHER_USER_ID, { id: OTHER_USER_ID, role: "patient", full_name: "Other Patient" }],
  ]),
  prescription_items: [] as Row[],
  inserts: [] as { table: string; rows: Row[] }[],
};

export function resetDb() {
  db.web_cache.clear();
  db.prescription_items.length = 0;
  db.inserts.length = 0;
}

function table(name: string) {
  const filters: [string, unknown][] = [];
  let gtExpires = "";
  const rows = (): Row[] => {
    if (name === "profiles") return [...db.profiles.values()];
    if (name === "prescription_items") return db.prescription_items;
    return [];
  };
  const matching = () => rows().filter((r) => filters.every(([c, v]) => r[c] === v));
  const chain = {
    select: () => chain,
    eq: (col: string, value: unknown) => (filters.push([col, value]), chain),
    gt: (_col: string, value: string) => ((gtExpires = value), chain),
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
    insert: async (r: Row | Row[]) => {
      db.inserts.push({ table: name, rows: Array.isArray(r) ? r : [r] });
      return { error: null };
    },
    then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: matching(), error: null }),
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
    from: table,
  }),
  supabaseForUser: () => ({ from: table }),
  requireEnv: (name: string) => {
    const v = process.env[name];
    if (!v) throw new Error(`Missing environment variable ${name}`);
    return v;
  },
};
