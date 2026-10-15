"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMyProfile } from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { PublicHeader } from "@/components/public-header";
import {
  BrandMark,
  Button,
  Field,
  SiteFooter,
} from "@/components/ui";

const SEEDED_TEST_ACCOUNTS = [
  { label: "Patient", email: "patient@vyana.test" },
  { label: "Doctor", email: "doctor@vyana.test" },
  { label: "Caregiver", email: "caregiver@vyana.test" },
  { label: "Admin", email: "admin@vyana.test" },
] as const;

export function LoginForm() {
  const router = useRouter();
  const { supabase, showToast } = useVyanaWeb();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setErrorMsg(error.message);
        setLoading(false);
        return;
      }

      const profile = await getMyProfile(supabase);
      showToast(`Signed in as ${profile.full_name || email.trim()}`, "success");

      if (!profile.onboarded) {
        router.push("/onboarding");
      } else if (profile.role === "doctor") {
        router.push("/doctor");
      } else if (profile.role === "admin") {
        router.push("/admin/doctors");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unable to sign in");
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
              Sign in to Vyana
            </h1>
            <p className="mt-1.5 text-[15px] text-label-2 leading-relaxed">
              Access your health records, prescriptions, or doctor OPD queue.
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

          <form onSubmit={handleSignIn} className="space-y-4">
            <Field
              id="login-email"
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="patient@vyana.test"
            />

            <Field
              id="login-password"
              label="Password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading}
              className="w-full mt-2"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {process.env.NODE_ENV !== "production" && (
            <div className="border-t border-separator pt-4 space-y-2">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-label-3">
                Seeded test accounts
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SEEDED_TEST_ACCOUNTS.map((acct) => (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => setEmail(acct.email)}
                    className="rounded-row border border-separator bg-fill/50 px-3 py-2 text-left text-[12px] font-medium text-label transition-colors hover:bg-accent-soft hover:border-accent cursor-pointer"
                  >
                    <span className="block font-semibold text-label">
                      {acct.label}
                    </span>
                    <span className="text-[11px] text-label-3">
                      {acct.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-[14px] text-label-2">
            New to Vyana?{" "}
            <Link
              href="/signup"
              className="font-semibold text-accent-strong hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
