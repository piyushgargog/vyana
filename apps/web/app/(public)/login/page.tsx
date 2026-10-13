"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getMyProfile } from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { MedicalDisclaimerFooter } from "@/components/ui-primitives";

const SEEDED_TEST_ACCOUNTS = [
  { label: "Patient", email: "patient@vyana.test" },
  { label: "Doctor", email: "doctor@vyana.test" },
  { label: "Caregiver", email: "caregiver@vyana.test" },
  { label: "Admin", email: "admin@vyana.test" },
] as const;

export default function LoginPage() {
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
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white font-bold">
              व्य
            </span>
            <span className="text-lg font-bold text-slate-900">Vyana · व्यान</span>
          </Link>
          <Link
            href="/signup"
            className="text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            Create an account →
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Sign in to Vyana
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Access your health records, prescriptions, or doctor OPD queue.
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800"
            >
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="patient@vyana.test"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          {process.env.NODE_ENV !== "production" && (
            <div className="border-t border-slate-200 pt-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Seeded Test Emails (enter your SEED_PASSWORD above)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SEEDED_TEST_ACCOUNTS.map((acct) => (
                  <button
                    key={acct.email}
                    type="button"
                    onClick={() => setEmail(acct.email)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-800 hover:bg-teal-50 hover:border-teal-200 cursor-pointer"
                  >
                    <span className="block font-bold text-slate-900">
                      {acct.label}
                    </span>
                    <span className="text-[11px] text-slate-600">
                      {acct.email}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs text-slate-600">
            New to Vyana?{" "}
            <Link
              href="/signup"
              className="font-semibold text-teal-700 hover:underline"
            >
              Create your account
            </Link>
          </p>
        </div>
      </main>

      <MedicalDisclaimerFooter />
    </div>
  );
}
