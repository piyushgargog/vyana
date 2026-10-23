import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  CATCH_UP_MINUTES,
  findMissedDoses,
  firstName,
  GRACE_MINUTES,
  istInstant,
  istTime,
  listOverdueDoses,
  runMissedDoseCheck,
  type CareItem,
} from "@/lib/server/data/missed-doses";
import { istDayOf } from "@vyana/shared";
import type { PushMessage, PushResult } from "@/lib/server/push";

const iso = (s: string) => new Date(s);
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

describe("India time", () => {
  it("turns an India wall-clock time into the right UTC moment and back", () => {
    expect(istInstant("2026-10-12", "09:00").toISOString()).toBe("2026-10-12T03:30:00.000Z");
    expect(istInstant("2026-10-12", "00:15").toISOString()).toBe("2026-10-11T18:45:00.000Z");
    expect(istTime(iso("2026-10-12T03:30:00Z"))).toBe("09:00");
    expect(istDayOf(iso("2026-10-12T20:00:00Z").toISOString())).toBe("2026-10-13"); // 01:30 the next morning in India
    expect(istDayOf(iso("2026-10-12T18:29:00Z").toISOString())).toBe("2026-10-12");
  });
});

describe("listOverdueDoses", () => {
  it("lists a dose once it is more than 60 minutes overdue, and not before", () => {
    expect(listOverdueDoses([item()], ist("2026-10-12 09:59"))).toHaveLength(0);
    expect(listOverdueDoses([item()], ist("2026-10-12 10:00")).map((d) => istTime(d.due))).toEqual(["09:00"]);
  });

  it("stops listing it after the catch-up window, so an old dose is not announced hours later", () => {
    const lastMoment = ist("2026-10-12 12:00"); // 09:00 + 60 + 120
    expect(GRACE_MINUTES).toBe(60);
    expect(CATCH_UP_MINUTES).toBe(180);
    expect(listOverdueDoses([item()], ist("2026-10-12 11:59")).map((d) => istTime(d.due))).toEqual(["09:00"]);
    expect(listOverdueDoses([item()], ist("2026-10-12 12:59")).map((d) => istTime(d.due))).toEqual(["09:00"]);
    expect(listOverdueDoses([item()], ist("2026-10-12 13:00"))).toHaveLength(0);
    expect(lastMoment.getTime()).toBeLessThan(ist("2026-10-12 13:00").getTime());
  });

  it("finds a dose of the evening before when the check runs just after midnight", () => {
    const due = listOverdueDoses([item()], ist("2026-10-13 00:30"));
    expect(due.map((d) => d.due.toISOString())).toEqual([ist("2026-10-12 21:00").toISOString()]);
  });

  it("respects the start and end date and skips as-needed medicines", () => {
    const now = ist("2026-10-12 10:30");
    expect(listOverdueDoses([item({ start_date: "2026-10-13" })], now)).toHaveLength(0);
    expect(listOverdueDoses([item({ end_date: "2026-10-11" })], now)).toHaveLength(0);
    expect(listOverdueDoses([item({ end_date: "2026-10-12" })], now)).toHaveLength(1);
    expect(listOverdueDoses([item({ times: [] })], now)).toHaveLength(0);
  });
});

describe("findMissedDoses", () => {
  const now = ist("2026-10-12 10:30");
  const dueAt = ist("2026-10-12 09:00");

  it("counts a dose nobody logged", () => {
    const r = findMissedDoses([item()], [], [], now);
    expect(r.checked).toBe(1);
    expect(r.missed.map((m) => m.item_id)).toEqual(["i-1"]);
  });

  it("does not count a dose with a taken or skipped log within 30 minutes", () => {
    const log = (minutes: number, status = "taken") => ({ item_id: "i-1", scheduled_for: new Date(dueAt.getTime() + minutes * 60_000).toISOString(), status });
    expect(findMissedDoses([item()], [log(0, "skipped")], [], now).missed).toHaveLength(0);
    expect(findMissedDoses([item()], [log(0)], [], now).missed).toHaveLength(0);
    expect(findMissedDoses([item()], [log(-30)], [], now).missed).toHaveLength(0);
    expect(findMissedDoses([item()], [log(30)], [], now).missed).toHaveLength(0);
    expect(findMissedDoses([item()], [log(31)], [], now).missed).toHaveLength(1);
  });

  it("still counts a dose the patient logged as missed, so the caregiver hears about it", () => {
    const missedLog = { item_id: "i-1", scheduled_for: dueAt.toISOString(), status: "missed" };
    expect(findMissedDoses([item()], [missedLog], [], now).missed).toHaveLength(1);
    // a taken log of the same dose wins over a missed one
    expect(findMissedDoses([item()], [missedLog, { ...missedLog, status: "taken" }], [], now).missed).toHaveLength(0);
  });

  it("ignores the log of another medicine", () => {
    expect(findMissedDoses([item()], [{ item_id: "i-2", scheduled_for: dueAt.toISOString() }], [], now).missed).toHaveLength(1);
  });

  it("does not count a dose that was already alerted, but still counts it as checked", () => {
    const r = findMissedDoses([item()], [], [{ item_id: "i-1", scheduled_for: dueAt.toISOString() }], now);
    expect(r).toMatchObject({ checked: 1, missed: [] });
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
  const requests: { table: string; op: string }[] = [];
  const time = (v: unknown) => new Date(String(v)).getTime();

  const client = {
    from(name: string) {
      const filters: ((r: Row) => boolean)[] = [];
      let op: "select" | "delete" | "upsert" = "select";
      let upserts: Row[] = [];
      let ignoreDuplicates = false;
      const same = (a: Row, b: Row) => a.item_id === b.item_id && time(a.scheduled_for) === time(b.scheduled_for);
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), chain),
        in: (c: string, list: unknown[]) => (filters.push((r) => list.includes(r[c])), chain),
        gte: (c: string, v: unknown) => (filters.push((r) => time(r[c]) >= time(v)), chain),
        delete: () => ((op = "delete"), chain),
        upsert: (rows: Row[], opts: { ignoreDuplicates?: boolean }) => ((op = "upsert"), (upserts = rows), (ignoreDuplicates = !!opts.ignoreDuplicates), chain),
        then: (resolve: (v: { data: Row[] | null; error: null }) => unknown) => {
          requests.push({ table: name, op });
          if (op === "delete") {
            const gone = new Set(table(name).filter((r) => filters.every((f) => f(r))));
            tables[name] = table(name).filter((r) => !gone.has(r));
            return resolve({ data: null, error: null });
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
            return resolve({ data: inserted, error: null });
          }
          return resolve({ data: table(name).filter((r) => filters.every((f) => f(r))).map((r) => ({ ...r })), error: null });
        },
      };
      return chain;
    },
  };
  return { sb: client as unknown as SupabaseClient, tables, requests, table };
}

const ok = (n: number): PushResult => ({ sent: n, failed: 0, invalidTokens: [] });

function world(extra: Record<string, Row[]> = {}) {
  return memoryDb({
    care_links: [{ patient_id: "p-1", caregiver_id: "c-1", status: "active" }],
    prescription_items: [{ id: "i-1", patient_id: "p-1", times: ["09:00", "21:00"], start_date: "2026-10-01", end_date: null, active: true }],
    dose_logs: [],
    missed_dose_alerts: [],
    push_tokens: [{ user_id: "c-1", token: "ExponentPushToken[care1]" }],
    profiles: [{ id: "p-1", full_name: "Aryan Sharma" }],
    ...extra,
  });
}

const now = ist("2026-10-12 10:30");

describe("firstName", () => {
  it("takes the first word and handles blanks", () => {
    expect(firstName("Aryan Sharma")).toBe("Aryan");
    expect(firstName("  Neha   Sharma ")).toBe("Neha");
    expect(firstName("Madonna")).toBe("Madonna");
    expect(firstName("")).toBeNull();
    expect(firstName("   ")).toBeNull();
    expect(firstName(null)).toBeNull();
  });
});

describe("runMissedDoseCheck", () => {
  it("pushes the caregiver once for a dose that was never logged, and records the alert", async () => {
    const db = world();
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    const result = await runMissedDoseCheck(db.sb, send, now);

    expect(result).toEqual({ checked: 1, alerts_sent: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    const [messages] = send.mock.calls[0];
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      to: "ExponentPushToken[care1]",
      title: "A dose was missed",
      body: "Aryan has not logged the 09:00 dose.",
      channelId: "caregiver-alerts",
      data: { kind: "missed_dose", patient_id: "p-1", item_id: "i-1" },
    });
    expect(db.table("missed_dose_alerts")).toEqual([{ item_id: "i-1", scheduled_for: ist("2026-10-12 09:00").toISOString() }]);
  });

  it("sends exactly one push however often the cron runs", async () => {
    const db = world();
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    expect((await runMissedDoseCheck(db.sb, send, now)).alerts_sent).toBe(1);
    expect(await runMissedDoseCheck(db.sb, send, ist("2026-10-12 10:45"))).toEqual({ checked: 1, alerts_sent: 0 });
    expect(await runMissedDoseCheck(db.sb, send, ist("2026-10-12 11:00"))).toEqual({ checked: 1, alerts_sent: 0 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("alerts the caregiver when the patient logged the dose as missed", async () => {
    const db = world({ dose_logs: [{ item_id: "i-1", scheduled_for: ist("2026-10-12 09:05").toISOString(), status: "missed" }] });
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    expect(await runMissedDoseCheck(db.sb, send, now)).toEqual({ checked: 1, alerts_sent: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("stays quiet when the dose was logged as taken or skipped", async () => {
    for (const status of ["taken", "skipped"]) {
      const db = world({ dose_logs: [{ item_id: "i-1", scheduled_for: ist("2026-10-12 09:05").toISOString(), status }] });
      const send = vi.fn(async () => ok(0));
      expect(await runMissedDoseCheck(db.sb, send, now)).toEqual({ checked: 1, alerts_sent: 0 });
      expect(send).not.toHaveBeenCalled();
    }
  });

  it("stays quiet within the first 60 minutes after the dose time", async () => {
    const db = world();
    const send = vi.fn(async () => ok(0));
    expect(await runMissedDoseCheck(db.sb, send, ist("2026-10-12 09:59"))).toEqual({ checked: 0, alerts_sent: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("does nothing for a patient without an active caregiver", async () => {
    const send = vi.fn(async () => ok(0));
    expect(await runMissedDoseCheck(world({ care_links: [] }).sb, send, now)).toEqual({ checked: 0, alerts_sent: 0 });
    expect(await runMissedDoseCheck(world({ care_links: [{ patient_id: "p-1", caregiver_id: "c-1", status: "revoked" }] }).sb, send, now)).toEqual({
      checked: 0,
      alerts_sent: 0,
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends to every phone of every caregiver but counts one alert for the dose", async () => {
    const db = world({
      care_links: [
        { patient_id: "p-1", caregiver_id: "c-1", status: "active" },
        { patient_id: "p-1", caregiver_id: "c-2", status: "active" },
      ],
      push_tokens: [
        { user_id: "c-1", token: "ExponentPushToken[a]" },
        { user_id: "c-1", token: "ExponentPushToken[b]" },
        { user_id: "c-2", token: "ExponentPushToken[c]" },
      ],
    });
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    expect(await runMissedDoseCheck(db.sb, send, now)).toEqual({ checked: 1, alerts_sent: 1 });
    expect(send.mock.calls[0][0].map((m) => m.to).sort()).toEqual(["ExponentPushToken[a]", "ExponentPushToken[b]", "ExponentPushToken[c]"]);
    expect(db.table("missed_dose_alerts")).toHaveLength(1);
  });

  it("keeps the dose open while no caregiver has a push token, and alerts as soon as one registers", async () => {
    const db = world({ push_tokens: [] });
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    expect(await runMissedDoseCheck(db.sb, send, now)).toEqual({ checked: 1, alerts_sent: 0 });
    expect(db.table("missed_dose_alerts")).toHaveLength(0);
    db.table("push_tokens").push({ user_id: "c-1", token: "ExponentPushToken[late]" });
    expect(await runMissedDoseCheck(db.sb, send, ist("2026-10-12 10:45"))).toEqual({ checked: 1, alerts_sent: 1 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("gives the dose back when the push service cannot be reached, so the next run tries again", async () => {
    const db = world();
    const down = vi.fn(async () => {
      throw new Error("push service down");
    });
    await expect(runMissedDoseCheck(db.sb, down, now)).rejects.toThrow("push service down");
    expect(db.table("missed_dose_alerts")).toHaveLength(0);

    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    expect(await runMissedDoseCheck(db.sb, send, ist("2026-10-12 10:45"))).toEqual({ checked: 1, alerts_sent: 1 });
  });

  it("does not count an alert nobody received: when every ticket failed the dose is given back and tried again", async () => {
    const db = world();
    const refused = vi.fn(async (): Promise<PushResult> => ({ sent: 0, failed: 1, invalidTokens: [] }));
    expect(await runMissedDoseCheck(db.sb, refused, now)).toEqual({ checked: 1, alerts_sent: 0 });
    expect(db.table("missed_dose_alerts")).toHaveLength(0);

    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    expect(await runMissedDoseCheck(db.sb, send, ist("2026-10-12 10:45"))).toEqual({ checked: 1, alerts_sent: 1 });
    expect(db.table("missed_dose_alerts")).toHaveLength(1);
  });

  it("deletes the tokens that the push service says are dead, and keeps the alert", async () => {
    const db = world({
      push_tokens: [
        { user_id: "c-1", token: "ExponentPushToken[dead]" },
        { user_id: "c-1", token: "ExponentPushToken[alive]" },
      ],
    });
    const send = vi.fn(async (): Promise<PushResult> => ({ sent: 1, failed: 0, invalidTokens: ["ExponentPushToken[dead]"] }));
    expect(await runMissedDoseCheck(db.sb, send, now)).toEqual({ checked: 1, alerts_sent: 1 });
    expect(db.table("push_tokens").map((t) => t.token)).toEqual(["ExponentPushToken[alive]"]);
    expect(db.table("missed_dose_alerts")).toHaveLength(1);
  });

  it("keeps the medicine name and the condition out of the push text", async () => {
    const db = world();
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    await runMissedDoseCheck(db.sb, send, now);
    const m = send.mock.calls[0][0][0];
    expect(`${m.title} ${m.body} ${JSON.stringify(m.data)}`).not.toMatch(/metformin|diabetes|tablet|mg/i);
  });

  it("names someone neutrally when the patient has no name", async () => {
    for (const full_name of [null, "", "   "]) {
      const db = world({ profiles: [{ id: "p-1", full_name }] });
      const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
      await runMissedDoseCheck(db.sb, send, now);
      expect(send.mock.calls[0][0][0].body).toBe("Someone you look after has not logged the 09:00 dose.");
    }
  });

  it("shows only the first name on the lock screen", async () => {
    const db = world({ profiles: [{ id: "p-1", full_name: "  Aryan Kumar Sharma " }] });
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    await runMissedDoseCheck(db.sb, send, now);
    const m = send.mock.calls[0][0][0];
    expect(m.body).toBe("Aryan has not logged the 09:00 dose.");
    expect(`${m.title} ${m.body}`).not.toMatch(/Sharma|Kumar/);
  });

  it("handles each patient of a large family list, reading ids 100 at a time", async () => {
    const patients = Array.from({ length: 205 }, (_, i) => `p-${i}`);
    const db = memoryDb({
      care_links: patients.map((p) => ({ patient_id: p, caregiver_id: "c-1", status: "active" })),
      prescription_items: patients.map((p, i) => ({ id: `i-${i}`, patient_id: p, times: ["09:00"], start_date: "2026-10-01", end_date: null, active: true })),
      dose_logs: [],
      missed_dose_alerts: [],
      push_tokens: [{ user_id: "c-1", token: "ExponentPushToken[care1]" }],
      profiles: patients.map((p) => ({ id: p, full_name: p })),
    });
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    expect(await runMissedDoseCheck(db.sb, send, now)).toEqual({ checked: 205, alerts_sent: 205 });
    expect(db.requests.filter((r) => r.table === "prescription_items")).toHaveLength(3); // 100 + 100 + 5
    expect(send.mock.calls[0][0]).toHaveLength(205);
  });
});
