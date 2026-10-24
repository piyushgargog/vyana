import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ApiErrorBody } from "@vyana/shared";
import { AppError, jsonRes, notFound, parseBody, toErrorResponse, withRoute } from "@/lib/server/errors";

const call = (handler: Parameters<typeof withRoute>[1], body?: string) =>
  withRoute("test", handler)(new Request("http://localhost/api/test", { method: "POST", body }), undefined);

async function errorOf(res: Response) {
  return ApiErrorBody.parse(await res.json()).error;
}

describe("withRoute", () => {
  it("passes a successful response through", async () => {
    const res = await call(async () => Response.json({ ok: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("maps an AppError to its own code and status", async () => {
    const res = await call(async () => {
      throw notFound("No such prescription");
    });
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toEqual({ code: "NOT_FOUND", message: "No such prescription" });
  });

  it("maps a ZodError to 400 with the issues in the message", async () => {
    const res = await call(async () => {
      z.object({ medicine: z.string() }).parse({});
      return Response.json({});
    });
    expect(res.status).toBe(400);
    const err = await errorOf(res);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.message).toContain("medicine");
  });

  it("maps a timeout to 504", async () => {
    const res = await call(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    expect(res.status).toBe(504);
    expect((await errorOf(res)).code).toBe("UPSTREAM_TIMEOUT");
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const res = await call(async () => {
      throw new Error("relation profiles does not exist; key=secret");
    });
    expect(res.status).toBe(500);
    const err = await errorOf(res);
    expect(err).toEqual({ code: "INTERNAL", message: "The request could not be finished. Please try again." });
  });

  it("adds a request id header to errors", async () => {
    const res = await call(async () => {
      throw new AppError("FORBIDDEN", "No", 403);
    });
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("toErrorResponse with caller headers", () => {
  it("keeps the caller's headers on the error and still adds the request id (the share page's 404)", async () => {
    const res = toErrorResponse(notFound("This link has expired or was turned off."), "req-1", { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow" });
    expect(res.status).toBe(404);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("x-request-id")).toBe("req-1");
    expect(await errorOf(res)).toEqual({ code: "NOT_FOUND", message: "This link has expired or was turned off." });
  });

  it("lets the error's own headers win on a clash", async () => {
    const res = toErrorResponse(new AppError("RATE_LIMITED", "Slow down", 429, { "retry-after": "30" }), "req-2", { "retry-after": "1" });
    expect(res.headers.get("retry-after")).toBe("30");
  });
});

describe("parseBody", () => {
  const schema = z.object({ medicine: z.string().min(1) });

  it("returns the parsed body", async () => {
    const req = new Request("http://localhost", { method: "POST", body: JSON.stringify({ medicine: "Dolo 650" }) });
    expect(await parseBody(req, schema)).toEqual({ medicine: "Dolo 650" });
  });

  it("rejects invalid JSON with 400", async () => {
    const res = await call(async (req) => {
      await parseBody(req, schema);
      return Response.json({});
    }, "{not json");
    expect(res.status).toBe(400);
    expect((await errorOf(res)).message).toBe("Request body must be valid JSON");
  });

  it("rejects an oversized body with 413 before parsing it", async () => {
    const res = await call(async (req) => {
      await parseBody(req, schema);
      return Response.json({});
    }, "x".repeat(1_000_001));
    expect(res.status).toBe(413);
    expect(await errorOf(res)).toEqual({ code: "PAYLOAD_TOO_LARGE", message: "Request body is too large" });
  });

  it("rejects a body whose declared content-length exceeds the cap", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ medicine: "Dolo 650" }),
      headers: { "content-length": "2000000" },
    });
    await expect(parseBody(req, schema)).rejects.toMatchObject({ status: 413, code: "PAYLOAD_TOO_LARGE" });
  });
});

describe("jsonRes", () => {
  const contract = z.object({ ok: z.boolean() });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the contract-parsed payload outside production", async () => {
    const res = jsonRes(contract, { ok: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("throws a ZodError on contract drift outside production", () => {
    expect(() => jsonRes(contract, { ok: "yes" })).toThrow(z.ZodError);
  });

  it("skips validation and keeps the init in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = jsonRes(contract, { ok: "yes" }, { headers: { "cache-control": "no-store" } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: "yes" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
