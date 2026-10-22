import type { AuthResponse } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  RESEND_CONFIRMATION_COOLDOWN_SECONDS,
  resendConfirmationLabel,
  RESEND_ERROR_MESSAGE,
  resendSignupConfirmation,
  signupConfirmationUrl,
  submitSignup,
  type SignupAuthClient,
} from "@/app/(public)/signup/signup-flow";

const CONFIRMATION_URL = "https://vyanahealth.app/auth/confirmed";
const DETAILS = {
  email: "  person@example.com  ",
  password: "password123",
  fullName: "  Test Person  ",
  phone: "  +91 98111 22334  ",
  role: "patient" as const,
};

const response = (session: boolean): AuthResponse =>
  ({
    data: {
      user: { id: "user-1", email: DETAILS.email.trim() },
      session: session ? { access_token: "token" } : null,
    },
    error: null,
  }) as unknown as AuthResponse;

const errorResponse = (message: string): AuthResponse =>
  ({
    data: { user: null, session: null },
    error: { message },
  }) as unknown as AuthResponse;

describe("web signup confirmation flow", () => {
  it("builds the shared confirmation landing URL", () => {
    expect(signupConfirmationUrl("https://vyanahealth.app")).toBe(
      CONFIRMATION_URL,
    );
    expect(signupConfirmationUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/auth/confirmed",
    );
  });

  it("keeps the session case on the straight-to-consent path", async () => {
    const auth: SignupAuthClient = {
      signUp: vi.fn(async () => response(true)),
      resend: vi.fn(async () => response(false)),
    };

    await expect(submitSignup(auth, DETAILS, CONFIRMATION_URL)).resolves.toEqual({
      status: "session",
    });
    expect(auth.signUp).toHaveBeenCalledExactlyOnceWith({
      email: "person@example.com",
      password: DETAILS.password,
      options: {
        emailRedirectTo: CONFIRMATION_URL,
        data: {
          full_name: "Test Person",
          phone: "+91 98111 22334",
          role: "patient",
        },
      },
    });
  });

  it("returns the inbox state when signup has no session", async () => {
    const auth: SignupAuthClient = {
      signUp: vi.fn(async () => response(false)),
      resend: vi.fn(async () => response(false)),
    };

    await expect(submitSignup(auth, DETAILS, CONFIRMATION_URL)).resolves.toEqual({
      status: "confirmation",
      email: "person@example.com",
    });
  });

  it("surfaces a signup error instead of treating it as a pending confirmation", async () => {
    const auth: SignupAuthClient = {
      signUp: vi.fn(async () => errorResponse("Error sending confirmation email")),
      resend: vi.fn(async () => response(false)),
    };

    await expect(submitSignup(auth, DETAILS, CONFIRMATION_URL)).resolves.toEqual({
      status: "error",
      message: "Error sending confirmation email",
    });
  });

  it("resends a signup confirmation to the same landing page", async () => {
    const auth: SignupAuthClient = {
      signUp: vi.fn(async () => response(false)),
      resend: vi.fn(async () => response(false)),
    };

    await expect(
      resendSignupConfirmation(auth, " person@example.com ", CONFIRMATION_URL),
    ).resolves.toEqual({ status: "sent", email: "person@example.com" });
    expect(auth.resend).toHaveBeenCalledExactlyOnceWith({
      type: "signup",
      email: "person@example.com",
      options: { emailRedirectTo: CONFIRMATION_URL },
    });
  });

  it("uses a one-minute resend cooldown label", () => {
    expect(RESEND_CONFIRMATION_COOLDOWN_SECONDS).toBe(60);
    expect(resendConfirmationLabel(42)).toBe("Resend in 42 seconds");
    expect(resendConfirmationLabel(1)).toBe("Resend in 1 second");
    expect(resendConfirmationLabel(0)).toBe("Resend confirmation email");
  });

  it("shows one generic message for every resend failure", async () => {
    const rejected = {
      signUp: vi.fn(),
      resend: vi.fn(async () => {
        throw new Error("User not found");
      }),
    };
    const failed = {
      signUp: vi.fn(),
      resend: vi.fn(async () => errorResponse("Email rate limit exceeded")),
    };
    const a = await resendSignupConfirmation(rejected, "a@example.com", CONFIRMATION_URL);
    const b = await resendSignupConfirmation(failed, "b@example.com", CONFIRMATION_URL);
    expect(a).toEqual({ status: "error", message: RESEND_ERROR_MESSAGE });
    expect(b).toEqual(a);
  });
});
