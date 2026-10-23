import { describe, expect, it } from "vitest";
import { ChatBody, DoctorVerifyReq } from "./contracts";

const userMessage = (parts: number) => ({
  role: "user" as const,
  parts: Array.from({ length: parts }, () => ({ type: "text", text: "a".repeat(4_000) })),
});

describe("chat request body bounds", () => {
  it("rejects a message with more than 20 parts", () => {
    expect(ChatBody.safeParse({ messages: [userMessage(21)] }).success).toBe(false);
  });
  it("accepts a message with 20 full parts", () => {
    expect(ChatBody.safeParse({ messages: [userMessage(20)] }).success).toBe(true);
  });
  it("rejects the unbounded-parts request (20 MB in one message)", () => {
    expect(ChatBody.safeParse({ messages: [userMessage(5_000)] }).success).toBe(false);
  });
});

describe("doctor state council length", () => {
  const long = "Karnataka Medical Council ".repeat(500); // 12,500 chars
  it("rejects a state council longer than 80 characters", () => {
    expect(DoctorVerifyReq.safeParse({ reg_no: "12345", state_council: long }).success).toBe(false);
  });
  it("still accepts a normal council name", () => {
    expect(DoctorVerifyReq.safeParse({ reg_no: "12345", state_council: "Delhi Medical Council" }).success).toBe(true);
  });
});
