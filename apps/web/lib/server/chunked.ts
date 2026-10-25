import "server-only";

/** One chunk of ids per request: a long `in (...)` list overflows a URL. */
const CHUNK = 100;

const chunks = <T>(list: T[]): T[][] =>
  Array.from({ length: Math.ceil(list.length / CHUNK) }, (_, i) => list.slice(i * CHUNK, (i + 1) * CHUNK));

/** Runs a query for many ids, `CHUNK` ids per request (a long `in (...)` list overflows a URL), and joins the rows. */
export async function readChunked<T>(
  ids: string[],
  query: (part: string[]) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (const part of chunks(ids)) {
    const { data, error } = await query(part);
    if (error) throw error;
    out.push(...(data ?? []));
  }
  return out;
}
