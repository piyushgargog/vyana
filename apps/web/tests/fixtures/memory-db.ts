// A small in-memory stand-in for the parts of supabase-js that the data routes use. Rows are plain objects,
// filters are applied in memory, and nothing touches the network. Embedded selects (`hospitals(name)`) are not
// resolved: put the embedded object in the row if a test needs it. `range(from, to)` is inclusive, as in supabase-js.
import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;

export function memoryDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  const table = (name: string) => (tables[name] ??= []);
  const requests: { table: string; op: string }[] = [];
  const time = (v: unknown) => new Date(String(v)).getTime();

  const client = {
    from(name: string) {
      const filters: ((r: Row) => boolean)[] = [];
      let op: "select" | "delete" | "upsert" | "update" = "select";
      let upserts: Row[] = [];
      let updates: Row = {};
      let ignoreDuplicates = false;
      let sortBy: { column: string; ascending: boolean } | null = null;
      let max = Infinity;
      let window: [number, number] | null = null;
      const same = (a: Row, b: Row) => a.item_id === b.item_id && time(a.scheduled_for) === time(b.scheduled_for);

      const run = () => {
        requests.push({ table: name, op });
        if (op === "delete") {
          const gone = new Set(table(name).filter((r) => filters.every((f) => f(r))));
          tables[name] = table(name).filter((r) => !gone.has(r));
          return { data: null, error: null };
        }
        if (op === "update") {
          const matched = table(name).filter((r) => filters.every((f) => f(r)));
          for (const row of matched) Object.assign(row, updates);
          return { data: matched.map((r) => ({ ...r })), error: null };
        }
        if (op === "upsert") {
          const inserted: Row[] = [];
          for (const row of upserts) {
            if (table(name).some((r) => same(r, row))) {
              if (!ignoreDuplicates) throw new Error("this fake only supports ignoreDuplicates");
              continue;
            }
            table(name).push({ ...row });
            inserted.push({ ...row });
          }
          return { data: inserted, error: null };
        }
        let rows = table(name).filter((r) => filters.every((f) => f(r)));
        if (sortBy) {
          const { column, ascending } = sortBy;
          rows = [...rows].sort((a, b) => (String(a[column]) < String(b[column]) ? -1 : String(a[column]) > String(b[column]) ? 1 : 0) * (ascending ? 1 : -1));
        }
        if (window) rows = rows.slice(window[0], window[1] + 1);
        return { data: rows.slice(0, max).map((r) => ({ ...r })), error: null };
      };

      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), chain),
        neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), chain),
        in: (c: string, list: unknown[]) => (filters.push((r) => list.includes(r[c])), chain),
        gte: (c: string, v: unknown) => (filters.push((r) => time(r[c]) >= time(v)), chain),
        order: (column: string, opts?: { ascending?: boolean }) => ((sortBy = { column, ascending: opts?.ascending ?? true }), chain),
        limit: (n: number) => ((max = n), chain),
        range: (from: number, to: number) => ((window = [from, to]), chain),
        delete: () => ((op = "delete"), chain),
        update: (values: Row) => ((op = "update"), (updates = values), chain),
        upsert: (rows: Row[], opts: { ignoreDuplicates?: boolean }) => ((op = "upsert"), (upserts = rows), (ignoreDuplicates = !!opts.ignoreDuplicates), chain),
        maybeSingle: async () => {
          const res = run();
          return { data: (res.data as Row[] | null)?.[0] ?? null, error: null };
        },
        then: (resolve: (v: { data: Row[] | null; error: null }) => unknown) => resolve(run() as { data: Row[] | null; error: null }),
      };
      return chain;
    },
  };
  return { sb: client as unknown as SupabaseClient, tables, requests, table };
}
