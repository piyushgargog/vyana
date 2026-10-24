import "server-only";

/**
 * The first row of a Supabase answer, whether it came back as a list or a single object (issue #543):
 * the rpc helpers answer in either shape, and every caller used to unwrap that by hand. Anything that
 * is not an object (including an empty list) gives null, so the caller decides what a missing row means.
 */
export function firstRow<T>(data: unknown): T | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? (row as T) : null;
}
