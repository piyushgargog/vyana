import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { findLateDoses, runLateDoseCheck } from "@/lib/server/data/late-doses";
import { istInstant, type CareItem } from "@/lib/server/data/missed-doses";
import type { PushMessage, PushResult } from "@/lib/server/push";

/** A moment given as India time, `YYYY-MM-DD HH:MM`. */
const ist = (s: string) => istInstant(s.slice(0, 10), s.slice(11, 16));

const item = (over: Partial<CareItem> = {}): CareItem => ({
  id: "i-1",
  patient_id: "p-1",
  times: ["09:00", "21:00"],
  start_date: "2026-10-01",
  end_date: null,
  ...over,
});

const due = ist("2026-10-12 09:00");

describe("findLateDoses", () => {
  it("a dose is the patient's to nudge after 30 minutes, not before", () => {
    expect(findLateDoses([item()], [], [], ist("2026-10-12 09:29")).patientDue).toHaveLength(0);
    const r = findLateDoses([item()], [], [], ist("2026-10-12 09:31"));
    expect(r.checked).toBe(1);
    expect(r.patientDue.map((d) => d.item_id)).toEqual(["i-1"]);
    expect(r.caregiverDue).toHaveLength(0);
  });

  it("a logged dose (taken or skipped) is never nudged; a missed log leaves it open", () => {
    const at = (status: string) => [{ item_id: "i-1", scheduled_for: due.toISOString(), status }];
    expect(findLateDoses([item()], at("taken"), [], ist("2026-10-12 09:45")).patientDue).toHaveLength(0);
    expect(findLateDoses([item()], at("skipped"), [], ist("2026-10-12 09:45")).patientDue).toHaveLength(0);
    expect(findLateDoses([item()], at("missed"), [], ist("2026-10-12 09:45")).patientDue).toHaveLength(1);
  });

  it("at 90 minutes a nudged slot becomes the caregivers', until it is stamped", () => {
    const row = { item_id: "i-1", scheduled_for: due.toISOString(), sent_at: ist("2026-10-12 09:31").toISOString(), caregiver_sent_at: null };
    const r = findLateDoses([item()], [], [row], ist("2026-10-12 10:30"));
    expect(r.patientDue).toHaveLength(0);
    expect(r.caregiverDue).toHaveLength(1);
    const stamped = { ...row, caregiver_sent_at: ist("2026-10-12 10:30").toISOString() };
    expect(findLateDoses([item()], [], [stamped], ist("2026-10-12 10:45")).caregiverDue).toHaveLength(0);
  });

  it("an old slot leaves the window: no nudge hours later", () => {
    expect(findLateDoses([item()], [], [], ist("2026-10-12 13:00")).checked).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// The whole check, against an in-memory database
// ---------------------------------------------------------------------------------------------------------------------

type Row = Record<string, unknown>;

/** A small in-memory stand-in for the parts of supabase-js that the check uses. */
function memoryDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  const table = (name: string) => (tables[name] ??= []);
  const time = (v: unknown) => new Date(String(v)).getTime();

  const client = {
    from(name: string) {
      const filters: ((r: Row) => boolean)[] = [];
      let op: "select" | "delete" | "upsert" | "update" = "select";
      let upserts: Row[] = [];
      let patch: Row = {};
      let limitN = Number.POSITIVE_INFINITY;
      const same = (a: Row, b: Row) => a.item_id === b.item_id && time(a.scheduled_for) === time(b.scheduled_for);
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), chain),
        is: (c: string, v: unknown) => (filters.push((r) => (r[c] ?? null) === v), chain),
        in: (c: string, list: unknown[]) => (filters.push((r) => list.includes(r[c])), chain),
        gte: (c: string, v: unknown) => (filters.push((r) => time(r[c]) >= time(v)), chain),
        gt: (c: string, v: unknown) => (filters.push((r) => String(r[c]) > String(v)), chain),
        order: () => chain,
        limit: (n: number) => ((limitN = n), chain),
        delete: () => ((op = "delete"), chain),
        update: (p: Row) => ((op = "update"), (patch = p), chain),
        upsert: (rows: Row[], opts: { ignoreDuplicates?: boolean }) => {
          op = "upsert";
          upserts = rows;
          if (!opts.ignoreDuplicates) throw new Error("this fake only supports ignoreDuplicates");
          return chain;
        },
        then: (resolve: (v: { data: Row[] | null; error: null }) => unknown) => {
          if (op === "delete") {
            const gone = new Set(table(name).filter((r) => filters.every((f) => f(r))));
            tables[name] = table(name).filter((r) => !gone.has(r));
            return resolve({ data: null, error: null });
          }
          if (op === "update") {
            const updated = table(name).filter((r) => filters.every((f) => f(r)));
            for (const r of updated) Object.assign(r, patch);
            return resolve({ data: updated.map((r) => ({ ...r })), error: null });
          }
          if (op === "upsert") {
            const inserted: Row[] = [];
            for (const row of upserts) {
              if (table(name).some((r) => same(r, row))) continue;
              table(name).push({ ...row });
              inserted.push({ ...row });
            }
            return resolve({ data: inserted, error: null });
          }
          return resolve({ data: table(name).filter((r) => filters.every((f) => f(r))).slice(0, limitN).map((r) => ({ ...r })), error: null });
        },
      };
      return chain;
    },
  };
  return { sb: client as unknown as SupabaseClient, tables, table };
}

const ok = (n: number): PushResult => ({ sent: n, failed: 0, invalidTokens: [] });

function world(extra: Record<string, Row[]> = {}) {
  return memoryDb({
    care_links: [{ patient_id: "p-1", caregiver_id: "c-1", status: "active" }],
    prescription_items: [{ id: "i-1", patient_id: "p-1", times: ["09:00", "21:00"], start_date: "2026-10-01", end_date: null, active: true }],
    dose_logs: [],
    late_dose_pushes: [],
    push_tokens: [
      { user_id: "p-1", token: "ExponentPushToken[patient]" },
      { user_id: "c-1", token: "ExponentPushToken[care1]" },
    ],
    profiles: [{ id: "p-1", full_name: "Aryan Sharma", late_dose_nudge: true }],
    ...extra,
  });
}

describe("runLateDoseCheck", () => {
  it("nudges the patient once, with the issue's payload, and records the row", async () => {
    const db = world();
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    const result = await runLateDoseCheck(db.sb, send, ist("2026-10-12 09:45"));

    expect(result).toEqual({ checked: 1, patient_sent: 1, caregiver_sent: 0 });
    const [messages] = send.mock.calls[0];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      to: "ExponentPushToken[patient]",
      title: "Dose reminder",
      body: "Your 09:00 dose is not logged yet.",
      channelId: "doses",
      data: { type: "dose_late", itemId: "i-1", scheduledFor: due.toISOString() },
    });
    expect(db.table("late_dose_pushes")).toEqual([
      { patient_id: "p-1", item_id: "i-1", scheduled_for: due.toISOString(), sent_at: ist("2026-10-12 09:45").toISOString() },
    ]);

    expect(await runLateDoseCheck(db.sb, send, ist("2026-10-12 10:00"))).toEqual({ checked: 1, patient_sent: 0, caregiver_sent: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("escalates to the caregiver at 90 minutes and stamps the row", async () => {
    const db = world({
      late_dose_pushes: [{ patient_id: "p-1", item_id: "i-1", scheduled_for: due.toISOString(), caregiver_sent_at: null }],
    });
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    const result = await runLateDoseCheck(db.sb, send, ist("2026-10-12 10:30"));

    expect(result).toEqual({ checked: 1, patient_sent: 0, caregiver_sent: 1 });
    const [messages] = send.mock.calls[0];
    expect(messages[0]).toMatchObject({ to: "ExponentPushToken[care1]", title: "A dose is still not logged", channelId: "caregiver-alerts" });
    expect(db.table("late_dose_pushes")[0].caregiver_sent_at).toBe(ist("2026-10-12 10:30").toISOString());

    expect((await runLateDoseCheck(db.sb, send, ist("2026-10-12 10:45"))).caregiver_sent).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("keeps the caregiver out when the patient's switch is off", async () => {
    const db = world({
      profiles: [{ id: "p-1", full_name: "Aryan Sharma", late_dose_nudge: false }],
      late_dose_pushes: [{ patient_id: "p-1", item_id: "i-1", scheduled_for: due.toISOString(), caregiver_sent_at: null }],
    });
    const send = vi.fn(async () => ok(0));
    expect(await runLateDoseCheck(db.sb, send, ist("2026-10-12 10:30"))).toEqual({ checked: 1, patient_sent: 0, caregiver_sent: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("gives the claim back when the push service delivers nothing, so the next run retries", async () => {
    const db = world();
    const send = vi.fn(async () => ok(0));
    expect(await runLateDoseCheck(db.sb, send, ist("2026-10-12 09:45"))).toEqual({ checked: 1, patient_sent: 0, caregiver_sent: 0 });
    expect(db.table("late_dose_pushes")).toEqual([]);
  });

  it("escalates at 90 minutes even when the patient has no push token at all", async () => {
    const db = world({ push_tokens: [{ user_id: "c-1", token: "ExponentPushToken[care1]" }] });
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    const result = await runLateDoseCheck(db.sb, send, ist("2026-10-12 10:30"));
    expect(result).toEqual({ checked: 1, patient_sent: 0, caregiver_sent: 1 });
    expect(send.mock.calls[0][0][0]).toMatchObject({ to: "ExponentPushToken[care1]", channelId: "caregiver-alerts" });
    // The row is the escalation's own claim: caregiver stamped, patient never told.
    expect(db.table("late_dose_pushes")).toEqual([
      { patient_id: "p-1", item_id: "i-1", scheduled_for: due.toISOString(), caregiver_sent_at: ist("2026-10-12 10:30").toISOString() },
    ]);
  });

  it("a partial failure keeps only the delivered dose's claim", async () => {
    const db = world({
      care_links: [
        { patient_id: "p-1", caregiver_id: "c-1", status: "active" },
        { patient_id: "p-2", caregiver_id: "c-1", status: "active" },
      ],
      prescription_items: [
        { id: "i-1", patient_id: "p-1", times: ["09:00"], start_date: "2026-10-01", end_date: null, active: true },
        { id: "i-2", patient_id: "p-2", times: ["09:00"], start_date: "2026-10-01", end_date: null, active: true },
      ],
      profiles: [
        { id: "p-1", full_name: "Aryan Sharma", late_dose_nudge: true },
        { id: "p-2", full_name: "Bina Rao", late_dose_nudge: true },
      ],
      push_tokens: [
        { user_id: "p-1", token: "ExponentPushToken[patient1]" },
        { user_id: "p-2", token: "ExponentPushToken[patient2]" },
        { user_id: "c-1", token: "ExponentPushToken[care1]" },
      ],
    });
    const send = vi.fn(async (messages: PushMessage[]) => (messages[0].to.includes("patient2") ? ok(0) : ok(messages.length)));
    const result = await runLateDoseCheck(db.sb, send, ist("2026-10-12 09:45"));
    expect(result).toEqual({ checked: 2, patient_sent: 1, caregiver_sent: 0 });
    expect(db.table("late_dose_pushes").map((r) => r.item_id)).toEqual(["i-1"]);
  });

  it("releases the caregiver claim when the escalation delivers nothing", async () => {
    const db = world({
      late_dose_pushes: [{ patient_id: "p-1", item_id: "i-1", scheduled_for: due.toISOString(), sent_at: ist("2026-10-12 09:31").toISOString(), caregiver_sent_at: null }],
    });
    const send = vi.fn(async () => ok(0));
    expect(await runLateDoseCheck(db.sb, send, ist("2026-10-12 10:30"))).toEqual({ checked: 1, patient_sent: 0, caregiver_sent: 0 });
    expect(db.table("late_dose_pushes")[0].caregiver_sent_at).toBeNull();
  });

  it("overlapping runs: the patient claim's release keeps a caregiver claim delivered mid-send", async () => {
    const db = world();
    const nestedSend = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    let interleaved = false;
    const send = vi.fn(async (messages: PushMessage[]) => {
      if (!interleaved && messages[0].to === "ExponentPushToken[patient]") {
        interleaved = true;
        // The fake stores only the keys an insert names; the real row's other
        // stamp is NULL, so say so before the nested run reads the row back.
        for (const row of db.table("late_dose_pushes")) {
          if (row.caregiver_sent_at === undefined) row.caregiver_sent_at = null;
        }
        // A second run of the same check overlaps this one: by 10:30 the slot is
        // the caregivers', and it claims and delivers that send on the very row
        // this run inserted, while this run's patient send is still in flight.
        await runLateDoseCheck(db.sb, nestedSend, ist("2026-10-12 10:30"));
      }
      return ok(0);
    });

    const result = await runLateDoseCheck(db.sb, send, ist("2026-10-12 09:45"));

    expect(result).toEqual({ checked: 1, patient_sent: 0, caregiver_sent: 0 });
    expect(nestedSend).toHaveBeenCalledTimes(1);
    expect(nestedSend.mock.calls[0][0][0]).toMatchObject({ to: "ExponentPushToken[care1]", channelId: "caregiver-alerts" });
    // This run's send delivered nothing, so its claim is released — but the row
    // carrying the overlapping run's delivered caregiver claim must survive,
    // or the next run would tell the caregivers a second time.
    expect(db.table("late_dose_pushes")).toEqual([
      {
        patient_id: "p-1",
        item_id: "i-1",
        scheduled_for: due.toISOString(),
        sent_at: ist("2026-10-12 09:45").toISOString(),
        caregiver_sent_at: ist("2026-10-12 10:30").toISOString(),
      },
    ]);

    const sendAgain = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    expect(await runLateDoseCheck(db.sb, sendAgain, ist("2026-10-12 10:45"))).toEqual({ checked: 1, patient_sent: 0, caregiver_sent: 0 });
    expect(sendAgain).not.toHaveBeenCalled();
  });
});
