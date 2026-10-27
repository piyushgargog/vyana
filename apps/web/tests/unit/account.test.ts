import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listUserFiles } from "@/lib/server/data/account";

type Entry = {
  id: string | null;
  name: string;
  metadata: { size: number } | null;
  created_at: string | null;
};

const file = (name: string): Entry => ({ id: `f-${name}`, name, metadata: { size: 10 }, created_at: null });
const folder = (name: string): Entry => ({ id: null, name, metadata: null, created_at: null });

/** A stand-in for the storage half of supabase-js, backed by a fixed folder tree. */
function fakeClient(tree: Record<string, Entry[]>): SupabaseClient {
  const client = {
    storage: {
      from: (_bucket: string) => ({
        list: async (folder: string) => ({ data: tree[folder] ?? [], error: null }),
      }),
    },
  };
  return client as unknown as SupabaseClient;
}

describe("listUserFiles", () => {
  it("lists a file in a folder nested deeper than three levels", async () => {
    const sb = fakeClient({
      u1: [folder("a"), file("top.pdf")],
      "u1/a": [folder("b")],
      "u1/a/b": [folder("c")],
      "u1/a/b/c": [file("deep.pdf")],
    });
    const files = await listUserFiles(sb, "prescriptions", "u1");
    expect(files.map((f) => f.path)).toEqual(["u1/a/b/c/deep.pdf", "u1/top.pdf"]);
  });

  it("still stops at the caller's limit", async () => {
    const sb = fakeClient({
      u1: [file("one.pdf"), file("two.pdf")],
    });
    const files = await listUserFiles(sb, "prescriptions", "u1", 1);
    expect(files.map((f) => f.path)).toEqual(["u1/one.pdf"]);
  });
});
