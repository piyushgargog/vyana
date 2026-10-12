import "server-only";
import { ZodError } from "zod";
import type { ApiErrorBody, ErrorCode } from "@vyana/shared";
import { log, newRequestId } from "./log";

/** An error whose code, status and message are safe to send to the client. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message = "Invalid request") => new AppError("BAD_REQUEST", message, 400);
export const unauthorized = (message = "Sign in to continue") => new AppError("UNAUTHORIZED", message, 401);
export const forbidden = (message = "You don't have access to this") => new AppError("FORBIDDEN", message, 403);
export const notFound = (message = "Not found") => new AppError("NOT_FOUND", message, 404);
export const upstream = (message = "A source we depend on failed. Try again.") => new AppError("UPSTREAM_ERROR", message, 502);
export const upstreamTimeout = (message = "A source we depend on took too long. Try again.") =>
  new AppError("UPSTREAM_TIMEOUT", message, 504);

/** Facts a handler can add to its single log line. Never put tokens or health data here. */
export interface RouteContext {
  requestId: string;
  userId?: string;
  cache?: "hit" | "miss";
  tinyfishCalls: number;
}

type Handler<P> = (req: Request, ctx: RouteContext, params: P) => Promise<Response>;

function errorResponse(code: ErrorCode, message: string, status: number, requestId: string): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status, headers: { "x-request-id": requestId } });
}

function isTimeout(err: unknown): boolean {
  return err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
}

/** Maps any thrown error to the documented error shape (SPEC §0). */
export function toErrorResponse(err: unknown, requestId: string): Response {
  if (err instanceof AppError) return errorResponse(err.code, err.message, err.status, requestId);
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
    return errorResponse("BAD_REQUEST", message || "Invalid request", 400, requestId);
  }
  if (isTimeout(err)) return errorResponse("UPSTREAM_TIMEOUT", "A source we depend on took too long. Try again.", 504, requestId);
  return errorResponse("INTERNAL", "Something went wrong", 500, requestId);
}

/**
 * Wraps a route handler: catches errors, maps them to `ApiErrorBody` and writes one log line per request.
 *
 * ```ts
 * export const POST = withRoute("medicines/compare", async (req, ctx) => { ... });
 * ```
 */
export function withRoute<P = unknown>(route: string, handler: Handler<P>) {
  return async (req: Request, params: P): Promise<Response> => {
    const ctx: RouteContext = { requestId: newRequestId(), tinyfishCalls: 0 };
    const started = Date.now();
    let res: Response;
    let error: unknown;
    try {
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
