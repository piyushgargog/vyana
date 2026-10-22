"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVyanaWeb } from "@/components/providers";
import { useRedirectIfSignedIn } from "@/components/auth-actions";
import { PublicHeader } from "@/components/public-header";
import {
  BrandMark,
  Button,
  Field,
  SiteFooter,
} from "@/components/ui";
import {
  RESEND_CONFIRMATION_COOLDOWN_SECONDS,
  resendConfirmationLabel,
  resendSignupConfirmation,
  signupConfirmationUrl,
  submitSignup,
  type SignupRole,
} from "./signup-flow";

export function SignupForm() {
  useRedirectIfSignedIn();
  const router = useRouter();
  const { supabase, showToast } = useVyanaWeb();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupRole>("patient");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendSending, setResendSending] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);
  const [resendAvailableAt, setResendAvailableAt] = useState<number | null>(
    null,
  );
  // Starts at 0: reading the clock during render would break the static
  // prerender (Next 16). It is set in the resend handlers and the interval.
  const [now, setNow] = useState(0);

  const confirmationUrl = () =>
    signupConfirmationUrl(window.location.origin);
  const resendSeconds =
    resendAvailableAt === null
      ? 0
      : Math.max(0, Math.ceil((resendAvailableAt - now) / 1000));

  useEffect(() => {
    if (!pendingEmail || resendAvailableAt === null) return;
    if (resendAvailableAt <= Date.now()) return;

    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pendingEmail, resendAvailableAt]);

  const startResendCooldown = () => {
    const nextAvailableAt =
      Date.now() + RESEND_CONFIRMATION_COOLDOWN_SECONDS * 1000;
    setNow(Date.now());
    setResendAvailableAt(nextAvailableAt);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const result = await submitSignup(
        supabase.auth,
        { email, password, fullName, phone, role },
        confirmationUrl(),
      );

      if (result.status === "error") {
        setErrorMsg(result.message);
        return;
      }

      if (result.status === "confirmation") {
        setPendingEmail(result.email);
        setResendMessage(null);
        setResendError(null);
        startResendCooldown();
        return;
      }

      showToast("Account created! Please review DPDP consent.", "success");
      router.push("/consent");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail || resendSeconds > 0) return;
    setResendSending(true);
    setResendMessage(null);
    setResendError(null);

    try {
      const result = await resendSignupConfirmation(
        supabase.auth,
        pendingEmail,
        confirmationUrl(),
      );
      if (result.status === "error") {
        setResendError(result.message);
        return;
      }

      setResendMessage(
        `Another confirmation email was sent to ${result.email}. Use the newest email.`,
      );
      startResendCooldown();
    } finally {
      setResendSending(false);
    }
  };

  const resetPendingConfirmation = () => {
    setPendingEmail(null);
    setResendMessage(null);
    setResendError(null);
    setResendAvailableAt(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-label">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center p-4 py-12 sm:py-16">
        <div className="w-full max-w-md rounded-card border border-separator bg-surface p-6 sm:p-8 shadow-float space-y-6">
          {pendingEmail ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center">
                <BrandMark size={48} />
                <h1 className="mt-4 text-[24px] sm:text-[28px] font-bold tracking-tight text-label">
                  Check your inbox
                </h1>
                <p className="mt-1.5 text-[15px] text-label-2 leading-relaxed">
                  We sent a confirmation email to{" "}
                  <strong className="font-semibold text-label">
                    {pendingEmail}
                  </strong>
                  . Open it and choose “Confirm Email Address” to finish
                  creating your account.
                </p>
                <p className="mt-3 text-[14px] text-label-3 leading-relaxed">
                  The link expires. If you send another email, use the newest
                  one. Check your spam or promotions folder if you do not see
                  the email.
                </p>
              </div>

              {resendMessage && (
                <div
                  role="status"
                  className="rounded-row border border-separator bg-accent-soft p-3.5 text-[14px] font-medium text-accent-strong"
                >
                  {resendMessage}
                </div>
              )}

              {resendError && (
                <div
                  role="alert"
                  className="rounded-row border border-separator bg-danger-soft p-3.5 text-[14px] font-medium text-danger-text"
                >
                  {resendError}
                </div>
              )}

              <div className="space-y-2">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={resendSending || resendSeconds > 0}
                  onClick={handleResend}
                  className="w-full"
                >
                  {resendSending
                    ? "Sending…"
                    : resendConfirmationLabel(resendSeconds)}
                </Button>
                <Button
                  type="button"
                  variant="plain"
                  size="md"
                  onClick={resetPendingConfirmation}
                  className="w-full"
                >
                  Use a different email
                </Button>
              </div>

              <p className="text-center text-[14px] text-label-2">
                Already confirmed?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-accent-strong hover:underline"
                >
                  Sign in here
                </Link>
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center text-center">
                <BrandMark size={48} />
                <h1 className="mt-4 text-[24px] sm:text-[28px] font-bold tracking-tight text-label">
                  Create your account
                </h1>
                <p className="mt-1.5 text-[15px] text-label-2 leading-relaxed">
                  Register as a patient (or family caregiver) or as a doctor.
                </p>
              </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-row border border-separator bg-danger-soft p-3.5 text-[14px] font-medium text-danger-text"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <Field
              id="signup-name"
              label="Full name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
            />

            <Field
              id="signup-email"
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            <Field
              id="signup-phone"
              label="Mobile phone number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98111 22334"
            />

            <Field
              id="signup-password"
              label="Password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              hint="Must be at least 8 characters long."
            />

            <fieldset>
              <legend className="px-1 text-[15px] font-medium text-label mb-2">
                Account type
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "patient", label: "Patient / Caregiver" },
                    { id: "doctor", label: "Doctor (OPD Portal)" },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={role === item.id}
                    onClick={() => setRole(item.id)}
                    className={`min-h-[44px] rounded-row border px-3 py-2 text-[14px] font-semibold transition-colors cursor-pointer ${
                      role === item.id
                        ? "border-accent bg-accent-soft text-accent-strong"
                        : "border-separator bg-fill/50 text-label-2 hover:bg-fill hover:text-label"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="text-center text-[13px] text-label-3 leading-relaxed">
              By creating an account, you agree to our{" "}
              <Link
                href="/terms"
                className="font-semibold text-accent-strong hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-semibold text-accent-strong hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              className="w-full mt-2"
            >
              {loading ? "Creating account…" : "Continue to DPDP consent →"}
            </Button>
          </form>

              <p className="text-center text-[14px] text-label-2">
                Already registered?{" "}
                <Link
                  href="/login"
                  className="font-semibold text-accent-strong hover:underline"
                >
                  Sign in here
                </Link>
              </p>
            </>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
