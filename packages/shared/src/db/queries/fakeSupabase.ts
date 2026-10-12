// packages/shared/src/db/queries/fakeSupabase.ts
// A recording stand-in for the Supabase client, for unit tests of the query functions and the hooks.
// Every chained call (`from(...).select(...).eq(...)`) is recorded; awaiting the chain returns the
// next queued response for that table (or `rpc:<name>`).
// Owner: Vaibhav Parmar

import type { Sb } from "./helpers";

export type Call = { name: string; args: unknown[] };
export type FakeResult = { data: unknown; error: { message: string; code?: string; details?: string } | null };

export type FakeChannel = {
  name: string;
  subscribed: boolean;
  removed: boolean;
  handlers: { filter: Record<string, unknown>; cb: (payload: { new: unknown }) => void }[];
};

export type FakeSupabase = {
  sb: Sb;
  /** Every call in order: `from`, `rpc`, then each chained method of that query. */
  calls: Call[];
  /** The calls of the nth query (0-based), without the leading from/rpc. */
  chainOf: (n: number) => Call[];
  /** The argument list of the first call named `name`. */
  argsOf: (name: string, n?: number) => unknown[];
  /** Realtime channels that were created. */
  channels: FakeChannel[];
  /** Pretends the user signed in (an id), switched, or signed out (null). Notifies auth listeners. */
  setUser: (id: string | null) => void;
  /** Fires every handler of the channel `name` as Realtime would on a row change. */
  emitChange: (name: string, row?: unknown) => void;
};

export function fakeSupabase(options: { userId?: string | null; responses?: Record<string, FakeResult[]> } = {}): FakeSupabase {
  let userId: string | null = options.userId === undefined ? "user-1" : options.userId;
  const queues: Record<string, FakeResult[]> = Object.fromEntries(Object.entries(options.responses ?? {}).map(([k, v]) => [k, [...v]]));
  const calls: Call[] = [];
  const chains: Call[][] = [];
  const channels: FakeChannel[] = [];
  const authListeners = new Set<(event: string, session: unknown) => void>();

  const session = () => (userId ? { user: { id: userId } } : null);

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
      getSession: async () => ({ data: { session: session() }, error: null }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        authListeners.add(cb);
        return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
      },
    },
    from: (table: string) => start(table, { name: "from", args: [table] }),
    rpc: (fn: string, args?: unknown) => start(`rpc:${fn}`, { name: "rpc", args: [fn, args] }),
    channel: (name: string) => {
      const channel: FakeChannel = { name, subscribed: false, removed: false, handlers: [] };
      channels.push(channel);
      const api = {
        on: (_type: string, filter: Record<string, unknown>, cb: (payload: { new: unknown }) => void) => {
          if (channel.subscribed) throw new Error(`cannot add postgres_changes callbacks for ${name} after subscribe()`);
          channel.handlers.push({ filter, cb });
          return api;
        },
        subscribe: () => {
          channel.subscribed = true;
          return api;
        },
        __channel: channel,
      };
      return api;
    },
    removeChannel: async (api: { __channel: FakeChannel }) => {
      api.__channel.removed = true;
      return "ok";
    },
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
    channels,
    setUser: (id) => {
      userId = id;
      for (const cb of authListeners) cb(id ? "SIGNED_IN" : "SIGNED_OUT", session());
    },
    emitChange: (name, row = {}) => {
      for (const channel of channels.filter((c) => c.name === name && c.subscribed && !c.removed))
        for (const h of channel.handlers) h.cb({ new: row });
    },
  };
}
