import { describe, expect, it } from "vitest";

import { ChatBody } from "./contracts";

// Unknown keys used to ride along on ChatBody messages and parts (both objects were `.loose()`), so a caller
// could pad a body with megabytes of junk that survived parsing. The objects are now plain, so unknown keys
// are stripped and only the fields the server reads survive.
describe("ChatBody unknown keys", () => {
  it("strips unknown keys from messages and parts", () => {
    const parsed = ChatBody.parse({
      messages: [
        {
          role: "user",
          junk: "x".repeat(100),
          parts: [{ type: "text", text: "Hello", junk: "y".repeat(100) }],
        },
      ],
    });
    expect(parsed).toEqual({
      messages: [{ role: "user", parts: [{ type: "text", text: "Hello" }] }],
    });
  });

  it("still accepts a plain valid body", () => {
    expect(ChatBody.parse({ messages: [{ role: "user", parts: [{ type: "text", text: "Hi" }] }] }).messages).toHaveLength(1);
  });
});
