import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { runCareAgentLoop } from "@/lib/server/agent/loop";
import { istInstant } from "@/lib/server/data/missed-doses";

type Row = Record<string, unknown>;

/**
 * A small in-memory stand-in for the parts of supabase-js the loop uses (the missed-doses fake,
 * extended with order/range/limit/not/insert and the expire_proposals rpc). The insert enforces
 * the table's real rule: one pending proposal per patient and dedupe key (migration 0017).
 */
/**
 * The fake's clock is the run's clock, not the wall clock: the loop passes its `now` to
 * every rule, so the database it talks to must expire against the same moment. Pinning
 * expiry to Date.now() made the refill tests pass only while the wall clock stayed before
 * the proposals' expiry (they broke on 30 Oct, once it passed the 29 Oct expiry).
 */
function memoryDb(seed: Record<string, Row[]>, clockMs: number = Date.now()) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  const table = (name: string) => (tables[name] ??= []);
  const time = (v: unknown) => new Date(String(v)).getTime();

  const client = {
    from(name: string) {
      const filters: ((r: Row) => boolean)[] = [];
      let op: "select" | "insert" = "select";
      let inserts: Row[] = [];
      let orderCol: string | null = null;
      let slice: [number, number] | null = null;
      let limitN: number | null = null;
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), chain),
        in: (c: string, list: unknown[]) => (filters.push((r) => list.includes(r[c])), chain),
        not: (c: string, _op: string, v: unknown) => (filters.push((r) => r[c] !== v && r[c] !== undefined), chain),
        gt: (c: string, v: unknown) => (filters.push((r) => String(r[c]) > String(v)), chain),
        gte: (c: string, v: unknown) => (filters.push((r) => time(r[c]) >= time(v)), chain),
        order: (c: string) => ((orderCol = c), chain),
        range: (from: number, to: number) => ((slice = [from, to]), chain),
        limit: (n: number) => ((limitN = n), chain),
        insert: (rows: Row | Row[]) => ((op = "insert"), (inserts = Array.isArray(rows) ? rows : [rows]), chain),
        then: (resolve: (v: { data: Row[] | null; error: { code: string } | null }) => unknown) => {
          if (op === "insert") {
            for (const row of inserts) {
              const clash = table(name).some(
                (r) => r.patient_id === row.patient_id && r.dedupe_key === row.dedupe_key && r.status === "pending",
              );
              if (clash) return resolve({ data: null, error: { code: "23505" } });
            }
            table(name).push(...inserts.map((r) => ({ ...r })));
            return resolve({ data: inserts, error: null });
          }
          let rows = table(name).filter((r) => filters.every((f) => f(r)));
          if (orderCol) rows = [...rows].sort((a, b) => String(a[orderCol as string]).localeCompare(String(b[orderCol as string])));
          if (slice) rows = rows.slice(slice[0], slice[1] + 1);
          if (limitN !== null) rows = rows.slice(0, limitN);
          return resolve({ data: rows.map((r) => ({ ...r })), error: null });
        },
      };
      return chain;
    },
    rpc(fn: string) {
      // expire_proposals (0017): pending rows whose expiry has passed close, and it answers how many.
      if (fn !== "expire_proposals") throw new Error(`unknown rpc ${fn}`);
      let count = 0;
      for (const r of table("agent_proposals")) {
        if (r.status === "pending" && r.expires_at && time(r.expires_at) <= clockMs) {
          r.status = "expired";
          count += 1;
        }
      }
      return Promise.resolve({ data: count, error: null });
    },
  };
  return { sb: client as unknown as SupabaseClient, tables, table };
}

const now = istInstant("2026-10-22", "10:30"); // India, so "today" in the loop is 2026-10-22

const takenLogs = (itemId: string, n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    item_id: itemId,
    scheduled_for: `2026-10-${String(10 + i).padStart(2, "0")}T02:30:00.000Z`,
    status: "taken",
  }));

const refillItem = (over: Row = {}): Row => ({
  id: "i-1",
  patient_id: "p-1",
  medicine_name: "Zentrabol",
  strength: "10 mg",
  dose: "1 tablet",
  times: ["08:00"],
  quantity_total: 10,
  refill_alert_days: 3,
  active: true,
  end_date: null,
  ...over,
});

function world(extra: Record<string, Row[]> = {}) {
  return memoryDb({
    profiles: [
      { id: "p-1", role: "patient" },
      { id: "p-2", role: "patient" },
      { id: "d-1", role: "doctor" },
    ],
    prescription_items: [refillItem(), refillItem({ id: "i-9", patient_id: "p-2", quantity_total: 30 })],
    dose_logs: [...takenLogs("i-1", 8), ...takenLogs("i-9", 2)],
    care_links: [],
    care_plans: [],
    lab_values: [],
    agent_proposals: [],
    ...extra,
  }, now.getTime());
}

describe("runCareAgentLoop", () => {
  it("writes one proposal for a refill that is due, and none for a patient with nothing due", async () => {
    const db = world();
    const result = await runCareAgentLoop(db.sb, now);
    expect(result).toEqual({ patients: 2, created: 1, expired: 0, capped: false });

    const rows = db.table("agent_proposals");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      patient_id: "p-1",
      kind: "refill_due",
      title: "Zentrabol may need a refill",
      status: "pending",
      rule_id: "refill-v1",
      dedupe_key: "refill:i-1:2026-10",
    });
    expect(rows[0].expires_at).toBe(new Date(now.getTime() + 7 * 86_400_000).toISOString());
  });

  it("a second run writes nothing again (the open proposal is seen)", async () => {
    const db = world();
    expect((await runCareAgentLoop(db.sb, now)).created).toBe(1);
    expect(await runCareAgentLoop(db.sb, now)).toEqual({ patients: 2, created: 0, expired: 0, capped: false });
    expect(db.table("agent_proposals")).toHaveLength(1);
  });

  it("an expired proposal is closed at the end of the run, and the next run may propose it again", async () => {
    const db = world({
      agent_proposals: [
        {
          patient_id: "p-1",
          kind: "refill_due",
          title: "Zentrabol may need a refill",
          reason: "About 2 days of this medicine are left.",
          payload: {},
          evidence: [],
          status: "pending",
          rule_id: "refill-v1",
          dedupe_key: "refill:i-1:2026-10",
          expires_at: "2026-10-20T00:00:00.000Z", // before the run's clock: the rpc closes it
        },
      ],
    });
    // The stale row is still pending while the rules run, so it blocks this run's insert...
    expect(await runCareAgentLoop(db.sb, now)).toEqual({ patients: 2, created: 0, expired: 1, capped: false });
    expect(db.table("agent_proposals")[0].status).toBe("expired");
    // ...and the run after that proposes it fresh.
    expect((await runCareAgentLoop(db.sb, now)).created).toBe(1);
    expect(db.table("agent_proposals")).toHaveLength(2);
  });

  it("proposes telling the caregiver when three doses were missed in a week and a caregiver is linked", async () => {
    const missed = ["2026-10-20", "2026-10-21", "2026-10-22"].map((d) => ({
      item_id: "i-2",
      scheduled_for: `${d}T02:30:00.000Z`,
      status: "missed",
    }));
    const db = world({
      prescription_items: [refillItem({ id: "i-2", quantity_total: null })],
      dose_logs: missed,
      care_links: [{ patient_id: "p-1", caregiver_id: "c-1", status: "active" }],
    });
    const result = await runCareAgentLoop(db.sb, now);
    expect(result.created).toBe(1);
    expect(db.table("agent_proposals")[0]).toMatchObject({
      kind: "missed_dose_pattern",
      rule_id: "missed-v1",
      payload: { item_id: "i-2", missed: 3, suggest: "tell_caregiver" },
    });
  });

  it("proposes a lab re-check that is overdue, with the report as its evidence", async () => {
    const plan = {
      condition: "Diabetes",
      summary: "Keep the sugar steady.",
      do: [],
      dont: [],
      diet: { eat_more: [], limit: [], sample_day: [] },
      red_flags: [],
      follow_up_tests: [{ test: "HbA1c", every_days: 90 }],
      sources: [],
      language: "en",
    };
    const db = world({
      prescription_items: [],
      dose_logs: [],
      care_plans: [{ patient_id: "p-1", status: "approved", plan_json: plan }],
      lab_values: [{ patient_id: "p-1", test_name: "HbA1c", measured_on: "2026-06-01", report_id: "rep-1" }],
    });
    const result = await runCareAgentLoop(db.sb, now);
    expect(result.created).toBe(1);
    expect(db.table("agent_proposals")[0]).toMatchObject({
      kind: "lab_recheck",
      rule_id: "lab-v1",
      dedupe_key: "lab:hba1c:2026-08-30",
      evidence: [{ table: "lab_reports", id: "rep-1", label: "Last HbA1c result" }],
    });
  });

  it("pages through every patient: 450 patients, three due refills, one proposal each, none on a second run", async () => {
    const profiles = Array.from({ length: 450 }, (_, i) => ({
      id: `p-${String(i).padStart(3, "0")}`,
      role: "patient",
    }));
    const due = [10, 250, 440];
    const db = world({
      profiles,
      prescription_items: due.map((n) =>
        refillItem({ id: `i-${n}`, patient_id: `p-${String(n).padStart(3, "0")}` }),
      ),
      dose_logs: due.flatMap((n) => takenLogs(`i-${n}`, 8)),
    });
    expect(await runCareAgentLoop(db.sb, now)).toEqual({ patients: 450, created: 3, expired: 0, capped: false });
    expect(db.table("agent_proposals").map((r) => r.patient_id).sort()).toEqual(["p-010", "p-250", "p-440"]);
    expect(await runCareAgentLoop(db.sb, now)).toEqual({ patients: 450, created: 0, expired: 0, capped: false });
  });

  it("counts old TAKEN doses for the refill (the pack is subtracted from all of them), so the alert is not late", async () => {
    const old = takenLogs("i-1", 8).map((l) => ({ ...l, scheduled_for: String(l.scheduled_for).replace("2026-10", "2026-09") }));
    const db = world({ dose_logs: old });
    expect((await runCareAgentLoop(db.sb, now)).created).toBe(1);
    expect(db.table("agent_proposals")[0]).toMatchObject({ kind: "refill_due" });
  });

  it("ignores missed doses older than 14 days for the missed-dose pattern", async () => {
    const missed = ["2026-09-01", "2026-09-02", "2026-09-03"].map((d) => ({
      item_id: "i-2",
      scheduled_for: `${d}T02:30:00.000Z`,
      status: "missed",
    }));
    const db = world({
      prescription_items: [refillItem({ id: "i-2", quantity_total: null })],
      dose_logs: missed,
      care_links: [{ patient_id: "p-1", caregiver_id: "c-1", status: "active" }],
    });
    expect((await runCareAgentLoop(db.sb, now)).created).toBe(0);
  });
});
