import "server-only";

/**
 * One JSON line per event (SPEC §0 logging).
 * Never pass tokens, file contents, page text or health data values; only ids, counts, durations and outcomes.
 */
export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function log(fields: LogFields): void {
  if (process.env.NODE_ENV === "test") return;
  const line: LogFields = { ts: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) line[k] = v;
  console.log(JSON.stringify(line));
}

export function newRequestId(): string {
  return crypto.randomUUID();
}
