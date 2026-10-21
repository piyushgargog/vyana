import { describe, expect, it } from "vitest";
import {
  isValidUuid,
  isInvalidUuidError,
} from "@/app/(app)/reports/[id]/page";

describe("Lab Report Detail Route Validation (#224)", () => {
  it("validates UUIDs correctly and rejects non-UUID slugs like 'timeline'", () => {
    // Valid standard v4 UUIDs
    expect(isValidUuid("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isValidUuid("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11")).toBe(true);
    expect(isValidUuid("A0EEBC99-9C0B-4EF8-BB6D-6BB9BD380A11")).toBe(true);

    // Non-UUID strings (such as /reports/timeline or malformed IDs)
    expect(isValidUuid("timeline")).toBe(false);
    expect(isValidUuid("summary")).toBe(false);
    expect(isValidUuid("12345")).toBe(false);
    expect(isValidUuid("")).toBe(false);
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid("123e4567-e89b-12d3-a456-42661417400z")).toBe(false);
  });

  it("identifies PostgreSQL invalid uuid syntax errors", () => {
    const pgError = new Error(
      'invalid input syntax for type uuid: "timeline"'
    );
    expect(isInvalidUuidError(pgError)).toBe(true);

    const codeError = new Error("Query failed: 22P02 invalid uuid");
    expect(isInvalidUuidError(codeError)).toBe(true);

    const normalError = new Error("Network connection lost");
    expect(isInvalidUuidError(normalError)).toBe(false);

    expect(isInvalidUuidError(null)).toBe(false);
  });
});
