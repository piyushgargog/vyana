import { describe, expect, it } from "vitest";

import {
  confirmationDestination,
  confirmationLinkError,
} from "@/app/(public)/auth/confirmed/confirmed-flow";

describe("email confirmation landing", () => {
  it("reads a failed confirmation from the URL fragment", () => {
    expect(
      confirmationLinkError(
        "https://vyanahealth.app/auth/confirmed#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
      ),
    ).toBe("Email link is invalid or has expired");
  });

  it("reads a failed confirmation from the query string", () => {
    expect(
      confirmationLinkError(
        "https://vyanahealth.app/auth/confirmed?error_code=otp_expired",
      ),
    ).toBe("otp_expired");
  });

  it("has no error for a normal confirmation landing", () => {
    expect(
      confirmationLinkError("https://vyanahealth.app/auth/confirmed"),
    ).toBeNull();
  });

  it("sends a signed-in user to consent and everyone else to login", () => {
    expect(confirmationDestination(true)).toEqual({
      href: "/consent",
      label: "Continue to DPDP consent",
    });
    expect(confirmationDestination(false)).toEqual({
      href: "/login",
      label: "Sign in to continue",
    });
  });
});
