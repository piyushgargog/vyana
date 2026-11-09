import "server-only";

/**
 * Reads a Supabase query answer as typed rows, empty when nothing came back. Throws the query error.
 *
 * One spelling for the typed-rows-or-empty read (issue #732), used by every server module that reads rows.
 * The service client has no table types, so the caller names the row shape. Sites that answer a failure
 * instead of throwing catch the throw at the call site and keep their own answer.
 */
export async function readRows<T>(query: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as T[];
}
