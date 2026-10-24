import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => {
    throw new Error("not used by aiMeta");
  },
  requireEnv: (name: string) => process.env[name] ?? "",
}));

import { aiMeta } from "@/lib/server/ai";

describe("aiMeta", () => {
  it("stamps model, prompt version and generation time", () => {
    const meta = aiMeta("rules", "red-flags");
    expect(meta.model).toBe("rules");
    expect(meta.prompt_version).toBe("red-flags");
    expect(Number.isNaN(Date.parse(meta.generated_at))).toBe(false);
    expect("run_id" in meta).toBe(false);
  });

  it("includes the run id only when one is passed", () => {
    expect(aiMeta("mock", "triage@1", "run-1").run_id).toBe("run-1");
    expect(aiMeta("mock", "triage@1", null).run_id).toBeNull();
  });
});
