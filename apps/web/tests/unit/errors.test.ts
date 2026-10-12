import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiErrorBody } from "@vyana/shared";
import { AppError, notFound, parseBody, withRoute } from "@/lib/server/errors";

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
    expect(err).toEqual({ code: "INTERNAL", message: "Something went wrong" });
  });

  it("adds a request id header to errors", async () => {
    const res = await call(async () => {
      throw new AppError("FORBIDDEN", "No", 403);
    });
    expect(res.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
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
});
