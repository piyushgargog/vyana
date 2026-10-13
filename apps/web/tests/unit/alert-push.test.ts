import { describe, expect, it, vi } from "vitest";
import { pushQualityAlerts, QUALITY_ALERT_CHANNEL } from "@/lib/server/data/alert-push";
import type { PushMessage, PushResult } from "@/lib/server/push";
import { memoryDb } from "../fixtures/memory-db";

const ok = (n: number): PushResult => ({ sent: n, failed: 0, invalidTokens: [] });

const world = () =>
  memoryDb({
    push_tokens: [
      { user_id: "p-1", token: "ExponentPushToken[a]" },
      { user_id: "p-1", token: "ExponentPushToken[b]" },
      { user_id: "p-2", token: "ExponentPushToken[c]" },
      { user_id: "p-3", token: "ExponentPushToken[not-alerted]" },
    ],
  });

describe("pushQualityAlerts", () => {
  it("sends one push to each phone of each patient who got a new alert, and to nobody else", async () => {
    const db = world();
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    const sent = await pushQualityAlerts(db.sb, send, [
      { patient_id: "p-1", count: 1 },
      { patient_id: "p-2", count: 3 },
    ]);
    expect(sent).toBe(3);
    expect(send).toHaveBeenCalledTimes(1);
    const messages = send.mock.calls[0][0];
    expect(messages.map((m) => m.to).sort()).toEqual(["ExponentPushToken[a]", "ExponentPushToken[b]", "ExponentPushToken[c]"]);
    expect(messages.every((m) => m.channelId === QUALITY_ALERT_CHANNEL && m.data?.kind === "quality_alert")).toBe(true);
  });

  it("is one push per phone however many alerts, and the text says so in the plural only when there are several", async () => {
    const db = world();
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    await pushQualityAlerts(db.sb, send, [
      { patient_id: "p-1", count: 1 },
      { patient_id: "p-2", count: 3 },
    ]);
    const body = (to: string) => send.mock.calls[0][0].find((m) => m.to === to)?.body;
    expect(body("ExponentPushToken[a]")).toBe("A medicine you use is named in a government quality alert. Tap to see it.");
    expect(body("ExponentPushToken[c]")).toBe("Medicines you use are named in government quality alerts. Tap to see them.");
  });

  it("keeps the medicine, the batch and the maker off the lock screen", async () => {
    const db = world();
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    await pushQualityAlerts(db.sb, send, [{ patient_id: "p-1", count: 1 }]);
    const m = send.mock.calls[0][0][0];
    expect(`${m.title} ${m.body} ${JSON.stringify(m.data)}`).toBe(
      'Medicine quality alert A medicine you use is named in a government quality alert. Tap to see it. {"kind":"quality_alert"}',
    );
  });

  it("does nothing, and asks nothing, when no patient got an alert", async () => {
    const db = world();
    const send = vi.fn(async () => ok(0));
    expect(await pushQualityAlerts(db.sb, send, [])).toBe(0);
    expect(send).not.toHaveBeenCalled();
    expect(db.requests).toHaveLength(0);
  });

  it("sends nothing to a patient without a push token", async () => {
    const db = world();
    const send = vi.fn(async () => ok(0));
    expect(await pushQualityAlerts(db.sb, send, [{ patient_id: "nobody", count: 1 }])).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("deletes the tokens that the push service says are dead", async () => {
    const db = world();
    const send = vi.fn(async (): Promise<PushResult> => ({ sent: 1, failed: 0, invalidTokens: ["ExponentPushToken[a]"] }));
    expect(await pushQualityAlerts(db.sb, send, [{ patient_id: "p-1", count: 1 }])).toBe(1);
    expect(db.table("push_tokens").map((t) => t.token)).not.toContain("ExponentPushToken[a]");
    expect(db.table("push_tokens")).toHaveLength(3);
  });

  it("never throws: the alerts are saved already, so a push problem must not fail the webhook", async () => {
    const down = vi.fn(async () => {
      throw new Error("push service down");
    });
    await expect(pushQualityAlerts(world().sb, down, [{ patient_id: "p-1", count: 1 }])).resolves.toBe(0);

    const brokenDb = { from: () => { throw new Error("database down"); } } as never;
    const send = vi.fn(async () => ok(0));
    await expect(pushQualityAlerts(brokenDb, send, [{ patient_id: "p-1", count: 1 }])).resolves.toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("reads the tokens 100 patients at a time", async () => {
    const ids = Array.from({ length: 230 }, (_, i) => `p-${i}`);
    const db = memoryDb({ push_tokens: ids.map((id) => ({ user_id: id, token: `ExponentPushToken[${id}]` })) });
    const send = vi.fn(async (messages: PushMessage[]) => ok(messages.length));
    expect(await pushQualityAlerts(db.sb, send, ids.map((patient_id) => ({ patient_id, count: 1 })))).toBe(230);
    expect(db.requests.filter((r) => r.table === "push_tokens")).toHaveLength(3);
  });
});
