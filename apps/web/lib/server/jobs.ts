import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { TTL, cached } from "./cache";
import { notFound } from "./errors";
import { requireEnv } from "./supabase-admin";

/**
 * Job tokens (ADR-035): the state of a background job travels inside its id, encrypted and signed with
 * AES-256-GCM, so we need no job table and the contents (e.g. medicine names) are never readable in a URL or log.
 * A token that was altered, or made with another secret, fails to open.
 */

const VERSION = "v1";

function key(): Buffer {
  const secret = requireEnv("JOB_TOKEN_SECRET");
  if (secret.length < 32) throw new Error("JOB_TOKEN_SECRET must be at least 32 characters");
  return createHash("sha256").update(secret).digest();
}

export function sealJob(payload: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${Buffer.concat([iv, tag, data]).toString("base64url")}`;
}

/** Returns the payload, or null when the token is malformed, altered or from another secret. */
export function openJob(token: string): unknown | null {
  const [version, body] = token.split(".");
  if (version !== VERSION || !body) return null;
  try {
    const raw = Buffer.from(body, "base64url");
    if (raw.length < 12 + 16 + 1) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- polling a job

/** Every job poll starts the same way: open the token, check the job belongs to the caller, else not found. */
export function openJobForUser<S extends z.ZodTypeAny>(schema: S, token: string, uid: string, notFoundMessage: string): z.infer<S> {
  const parsed = schema.safeParse(openJob(token));
  if (!parsed.success || (parsed.data as { uid?: unknown }).uid !== uid) throw notFound(notFoundMessage);
  return parsed.data;
}

/** The finished result a job with no runs points at, or the job has expired. */
export async function cachedJobResult<T>(key: string, kind: string, expiredMessage: string): Promise<T> {
  const hit = await cached<T>(key, kind, TTL.day, async () => null);
  if (!hit) throw notFound(expiredMessage);
  return hit.value;
}

/** Stores a job's finished result under its key, where the next identical request finds it. */
export async function cacheJobResult<T>(key: string, kind: string, result: T): Promise<void> {
  await cached<T>(key, kind, TTL.day, async () => result);
}
