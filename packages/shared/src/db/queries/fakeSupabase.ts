// packages/shared/src/db/queries/fakeSupabase.ts
// A recording stand-in for the Supabase client, for unit tests of the query functions.
// Every chained call (`from(...).select(...).eq(...)`) is recorded; awaiting the chain returns the
// next queued response for that table (or `rpc:<name>`).
// Owner: Vaibhav Parmar

import type { Sb } from "./helpers";

export type Call = { name: string; args: unknown[] };
export type FakeResult = { data: unknown; error: { message: string; code?: string; details?: string } | null };

export type FakeSupabase = {
  sb: Sb;
  /** Every call in order: `from`, `rpc`, then each chained method of that query. */
  calls: Call[];
  /** The calls of the nth query (0-based), without the leading from/rpc. */
  chainOf: (n: number) => Call[];
  /** The argument list of the first call named `name`. */
  argsOf: (name: string, n?: number) => unknown[];
};

export function fakeSupabase(options: { userId?: string | null; responses?: Record<string, FakeResult[]> } = {}): FakeSupabase {
  const userId = options.userId === undefined ? "user-1" : options.userId;
  const queues: Record<string, FakeResult[]> = Object.fromEntries(Object.entries(options.responses ?? {}).map(([k, v]) => [k, [...v]]));
  const calls: Call[] = [];
  const chains: Call[][] = [];

  const start = (key: string, first: Call) => {
    calls.push(first);
    const own: Call[] = [];
    chains.push(own);
    const next = (): FakeResult => queues[key]?.shift() ?? { data: null, error: null };
    const handler: ProxyHandler<object> = {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (v: FakeResult) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(next()).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          const call = { name: String(prop), args };
          calls.push(call);
          own.push(call);
          return proxy;
        };
      },
    };
    const proxy: unknown = new Proxy({}, handler);
    return proxy;
  };

  const client = {
    auth: {
      getSession: async () => ({
        data: { session: userId ? { user: { id: userId } } : null },
        error: null,
      }),
    },
    from: (table: string) => start(table, { name: "from", args: [table] }),
    rpc: (fn: string, args?: unknown) => start(`rpc:${fn}`, { name: "rpc", args: [fn, args] }),
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, body: unknown, opts: unknown) => {
          calls.push({ name: "storage.upload", args: [bucket, path, body, opts] });
          return queues["storage.upload"]?.shift() ?? { data: { path }, error: null };
        },
        createSignedUrl: async (path: string, seconds: number) => {
          calls.push({ name: "storage.createSignedUrl", args: [bucket, path, seconds] });
          return queues["storage.sign"]?.shift() ?? { data: { signedUrl: `https://signed.test/${path}` }, error: null };
        },
      }),
    },
  };

  return {
    sb: client as unknown as Sb,
    calls,
    chainOf: (n) => chains[n] ?? [],
    argsOf: (name, n = 0) => calls.filter((c) => c.name === name)[n]?.args ?? [],
  };
}
