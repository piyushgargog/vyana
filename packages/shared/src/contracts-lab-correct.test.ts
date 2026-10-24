import { describe, expect, it } from "vitest";

import { LabValueCorrectReq } from "./contracts";

// The contract advertises a text-only correction ("Send a value or a value_text"),
// but `value` was a required key, so omitting it failed parsing before the refine
// was ever reached. These cases pin the text-only path and the refine message.
const id = "11111111-1111-4111-8111-111111111111";

describe("LabValueCorrectReq text-only correction", () => {
  it("accepts a correction with only a value_text and no value key", () => {
    expect(LabValueCorrectReq.safeParse({ value_id: id, value_text: "Negative" }).success).toBe(true);
  });

  it("accepts an explicit null value with a value_text", () => {
    expect(LabValueCorrectReq.safeParse({ value_id: id, value: null, value_text: "Negative" }).success).toBe(true);
  });

  it("still accepts a numeric correction", () => {
    expect(LabValueCorrectReq.safeParse({ value_id: id, value: 5.2 }).success).toBe(true);
  });

  it("rejects a body with neither a value nor a value_text, with the refine message", () => {
    const parsed = LabValueCorrectReq.safeParse({ value_id: id });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.map((i) => i.message)).toContain("Send a value or a value_text");
    }
  });

  it("rejects a null value with no value_text", () => {
    expect(LabValueCorrectReq.safeParse({ value_id: id, value: null }).success).toBe(false);
  });
});
