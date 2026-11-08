import "server-only";

/**
 * The first row of a Supabase RPC answer: the answer is one row when it is an object, the first
 * element when it is an array, and nothing when it is empty or not a row at all.
 */
export function firstRow<T>(data: unknown): T | null {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? (row as T) : null;
}
