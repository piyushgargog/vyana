import { beforeEach, describe, expect, it } from "vitest";

import { joinWaitlistMock, resetWaitlistMock } from "./plans";

beforeEach(() => resetWaitlistMock());

describe("waitlist mock (#305)", () => {
  it("joining twice with the same email answers already_on_list", () => {
    expect(joinWaitlistMock({ email: "Asha@Example.com" })).toEqual({ status: "joined" });
    expect(joinWaitlistMock({ email: "asha@example.com" })).toEqual({
      status: "already_on_list",
    });
    expect(joinWaitlistMock({ email: "other@example.com" })).toEqual({ status: "joined" });
  });
});
