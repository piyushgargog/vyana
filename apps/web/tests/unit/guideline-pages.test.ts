import { describe, expect, it, vi } from "vitest";
import { fakeSupabaseModule } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const { medlineBody } = await import("@/lib/server/web/guideline-pages");

describe("medlineBody", () => {
  const page = [
    "# Diabetes Type 2", "Also called: Type 2 Diabetes", "On this page", "### Basics", "-\nSummary", "-\nStart Here",
    "## Summary", "### What is type 2 diabetes?", "A disease in which blood sugar is too high.", "### What are the treatments?", "Eat well and be active.",
    "## Start Here", "- Some outside link", "## Diagnosis and Tests", "- Another link",
  ].join("\n\n");

  it("keeps the summary and drops the menu in front and the link lists after it", () => {
    const body = medlineBody(page);
    expect(body.startsWith("## Summary")).toBe(true);
    expect(body).toContain("Eat well and be active.");
    expect(body).not.toMatch(/On this page|outside link|Another link/);
  });

  it("leaves a page without those headings as it is", () => {
    expect(medlineBody("Plain text with no headings.")).toBe("Plain text with no headings.");
  });
});
