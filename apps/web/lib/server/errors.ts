import "server-only";
import { ZodError } from "zod";
import type { ApiErrorBody, ErrorCode } from "@vyana/shared";
import { log, newRequestId } from "./log";
import type { RateLimit } from "./rate-limit";

/** An error whose code, status and message are safe to send to the client. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
    /** Extra response headers, for example `retry-after` on a 429. */
    public readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message = "Invalid request") => new AppError("BAD_REQUEST", message, 400);
export const unauthorized = (message = "Sign in to continue") => new AppError("UNAUTHORIZED", message, 401);
export const forbidden = (message = "You don't have access to this") => new AppError("FORBIDDEN", message, 403);
export const notFound = (message = "Not found") => new AppError("NOT_FOUND", message, 404);
/** Over a per-user limit (issue 138): 429 with a plain message and a `Retry-After` header in seconds. */
const rateLimited = (retryAfterSeconds: number) => {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return new AppError(
    "RATE_LIMITED",
    `You've reached the limit for now. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
    429,
    { "retry-after": String(Math.max(1, Math.ceil(retryAfterSeconds))) },
  );
};
export const upstream = (message = "A source we depend on failed. Try again.") => new AppError("UPSTREAM_ERROR", message, 502);

/** Facts a handler can add to its single log line. Never put tokens or health data here. */
export interface RouteContext {
  requestId: string;
  userId?: string;
  cache?: "hit" | "miss";
  tinyfishCalls: number;
}

type Handler<P> = (req: Request, ctx: RouteContext, params: P) => Promise<Response>;

function errorResponse(code: ErrorCode, message: string, status: number, requestId: string, headers: Record<string, string> = {}): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status, headers: { ...headers, "x-request-id": requestId } });
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

/**
 * Maps any thrown error to the documented error shape (SPEC §0). `headers` adds headers the caller must keep on
 * the error too (the share page's 404 carries its no-store headers); an `AppError`'s own headers win on a clash.
 */
export function toErrorResponse(err: unknown, requestId: string, headers: Record<string, string> = {}): Response {
  if (err instanceof AppError) return errorResponse(err.code, err.message, err.status, requestId, { ...headers, ...err.headers });
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
    return errorResponse("BAD_REQUEST", message || "Invalid request", 400, requestId, headers);
  }
  if (isTimeout(err)) return errorResponse("UPSTREAM_TIMEOUT", "A source we depend on took too long. Try again.", 504, requestId, headers);
  return errorResponse("INTERNAL", "The request could not be finished. Please try again.", 500, requestId, headers);
}

/**
 * Wraps a route handler: catches errors, maps them to `ApiErrorBody` and writes one log line per request.
 *
 * ```ts
 * export const POST = withRoute("prescriptions/basket", async (req, ctx) => { ... });
 * ```
 *
 * With `rateLimit` the route counts as a call of the signed-in user before the handler runs: the sign-in check comes
 * first (an unknown caller never uses up a counter), then the counter, then the handler, so an over-limit request
 * never reaches a model or a web agent. Over the limit: 429 `RATE_LIMITED` with `Retry-After`. If the counter cannot
 * be reached the request goes through (fail open, logged). See `lib/server/rate-limit.ts`.
 *
 * ```ts
 * export const POST = withRoute("triage", handler, { rateLimit: rateLimitOf("ai_other") });
 * ```
 */
export interface RouteOptions {
  rateLimit?: RateLimit;
}

export function withRoute<P = unknown>(route: string, handler: Handler<P>, options: RouteOptions = {}) {
  return async (req: Request, params: P): Promise<Response> => {
    const ctx: RouteContext = { requestId: newRequestId(), tinyfishCalls: 0 };
    const started = Date.now();
    let res: Response;
    let error: unknown;
    try {
      if (options.rateLimit) await enforceRateLimit(req, ctx, options.rateLimit);
      res = await handler(req, ctx, params);
    } catch (err) {
      error = err;
      res = toErrorResponse(err, ctx.requestId);
    }
    log({
      route,
      request_id: ctx.requestId,
      user_id: ctx.userId,
      status: res.status,
      duration_ms: Date.now() - started,
      cache: ctx.cache,
      tinyfish_calls: ctx.tinyfishCalls,
      // Unexpected errors keep their class name for debugging; the message may hold data, so it is not logged.
      error: error && !(error instanceof AppError) && !(error instanceof ZodError) ? (error as Error).name ?? "Error" : undefined,
    });
    return res;
  };
}

/** Signs the caller in, counts the call, and throws 429 when it is over the limit. */
async function enforceRateLimit(req: Request, ctx: RouteContext, limit: RateLimit): Promise<void> {
  // Imported here, not at the top: auth.ts imports this file for its errors.
  const { requireUser } = await import("./auth");
  const { checkRateLimit } = await import("./rate-limit");
  const { user } = await requireUser(req); // remembered per request: the handler's own call does not ask Supabase again
  ctx.userId = user.id;
  const verdict = await checkRateLimit(user.id, limit);
  if (verdict && !verdict.allowed) throw rateLimited(verdict.retryAfterSeconds);
}

/** Reads and validates a JSON body. Invalid JSON or schema → 400 `BAD_REQUEST`. */
export async function parseBody<T>(req: Request, schema: { parse(data: unknown): T }): Promise<T> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  return schema.parse(data);
}
