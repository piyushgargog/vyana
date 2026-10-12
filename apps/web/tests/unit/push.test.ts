import { describe, expect, it, vi } from "vitest";
import { EXPO_PUSH_URL, isExpoPushToken, sendPush, type PushMessage } from "@/lib/server/push";
import { AppError } from "@/lib/server/errors";

const token = (n: number) => `ExponentPushToken[abc${n}]`;
const message = (n: number): PushMessage => ({ to: token(n), title: "A dose was missed", body: "x", data: { kind: "missed_dose" }, channelId: "caregiver-alerts" });
const ok = { status: "ok", id: "t" };

/** A fetch that answers like Expo: one ticket per message, built by `ticket(index, message)`. */
function expo(ticket: (i: number, m: { to: string }) => unknown = () => ok) {
  return vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const sent = JSON.parse(String(init?.body)) as { to: string }[];
    return Response.json({ data: sent.map((m, i) => ticket(i, m)) });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe("isExpoPushToken", () => {
  it("accepts Expo tokens and nothing else", () => {
    expect(isExpoPushToken("ExponentPushToken[xyz]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[xyz]")).toBe(true);
    expect(isExpoPushToken("fcm-token-123")).toBe(false);
    expect(isExpoPushToken("ExponentPushToken[xyz")).toBe(false);
    expect(isExpoPushToken("")).toBe(false);
  });
});

describe("sendPush", () => {
  it("posts the messages to Expo with a sound, high priority and the channel", async () => {
    const fetchMock = expo();
    const result = await sendPush([message(1), message(2)], { fetch: fetchMock });
    expect(result).toEqual({ sent: 2, failed: 0, invalidTokens: [] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(EXPO_PUSH_URL);
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body));
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ to: token(1), title: "A dose was missed", channelId: "caregiver-alerts", sound: "default", priority: "high", data: { kind: "missed_dose" } });
  });

  it("sends 100 messages per request", async () => {
    const fetchMock = expo();
    const result = await sendPush(Array.from({ length: 250 }, (_, i) => message(i)), { fetch: fetchMock });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.sent).toBe(250);
  });

  it("returns dead tokens so they can be deleted, and counts other refusals", async () => {
    const fetchMock = expo((i) =>
      i === 0
        ? { status: "error", message: "gone", details: { error: "DeviceNotRegistered" } }
        : i === 1
          ? { status: "error", message: "too big", details: { error: "MessageTooBig" } }
          : ok,
    );
    const result = await sendPush([message(1), message(2), message(3)], { fetch: fetchMock });
    expect(result).toEqual({ sent: 1, failed: 1, invalidTokens: [token(1)] });
  });

  it("does not send to a string that is not an Expo token, and reports it as invalid", async () => {
    const fetchMock = expo();
    const result = await sendPush([{ ...message(1), to: "not-a-token" }, message(2)], { fetch: fetchMock });
    expect(result).toEqual({ sent: 1, failed: 0, invalidTokens: ["not-a-token"] });
    expect(JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body))).toHaveLength(1);
  });

  it("makes no request when there is nothing to send", async () => {
    const fetchMock = expo();
    expect(await sendPush([], { fetch: fetchMock })).toEqual({ sent: 0, failed: 0, invalidTokens: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a 502 when Expo cannot be reached, refuses, or answers with something unexpected", async () => {
    const unreachable = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    await expect(sendPush([message(1)], { fetch: unreachable })).rejects.toMatchObject({ status: 502 });

    const refused = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    await expect(sendPush([message(1)], { fetch: refused })).rejects.toBeInstanceOf(AppError);

    const wrongCount = vi.fn(async () => Response.json({ data: [] })) as unknown as typeof fetch;
    await expect(sendPush([message(1)], { fetch: wrongCount })).rejects.toMatchObject({ status: 502 });

    const notJson = vi.fn(async () => new Response("<html>", { status: 200 })) as unknown as typeof fetch;
    await expect(sendPush([message(1)], { fetch: notJson })).rejects.toMatchObject({ status: 502 });
  });
});
