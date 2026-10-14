"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVyanaWeb } from "@/components/providers";
import { PublicHeader } from "@/components/public-header";
import {
  BrandMark,
  Button,
  Field,
  SiteFooter,
} from "@/components/ui";

type SignupRole = "patient" | "doctor";

export function SignupForm() {
  const router = useRouter();
  const { supabase, showToast } = useVyanaWeb();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<SignupRole>("patient");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || undefined,
            role,
          },
        },
      });
      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      showToast("Account created! Please review DPDP consent.", "success");
      router.push("/consent");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-label">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center p-4 py-12 sm:py-16">
        <div className="w-full max-w-md rounded-card border border-separator bg-surface p-6 sm:p-8 shadow-float space-y-6">
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
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
