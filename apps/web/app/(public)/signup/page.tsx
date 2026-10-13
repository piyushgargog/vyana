"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVyanaWeb } from "@/components/providers";
import { MedicalDisclaimerFooter } from "@/components/ui-primitives";

type SignupRole = "patient" | "doctor";

export default function SignupPage() {
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
            href="/login"
            className="text-sm font-semibold text-teal-700 hover:text-teal-800"
          >
            Already have an account? Sign in →
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Create your Vyana account
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Register as a patient (or family caregiver) or as a doctor.
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

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label
                htmlFor="signup-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Full Name
              </label>
              <input
                id="signup-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="signup-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Email Address
              </label>
              <input
                id="signup-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="signup-phone"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Mobile Number (India +91)
              </label>
              <input
                id="signup-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98111 22334"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="signup-password"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Password (minimum 8 characters)
              </label>
              <input
                id="signup-password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <fieldset>
              <legend className="block text-xs font-semibold text-slate-700 mb-2">
                Account Type
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
                    className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                      role === item.id
                        ? "border-teal-700 bg-teal-50 text-teal-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <p className="text-center text-xs text-slate-500">
              By registering, you acknowledge our{" "}
              <Link
                href="/terms"
                className="font-medium text-teal-700 hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-medium text-teal-700 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              {loading ? "Creating account…" : "Continue to DPDP Consent →"}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600">
            Already registered?{" "}
            <Link
              href="/login"
              className="font-semibold text-teal-700 hover:underline"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </main>

      <MedicalDisclaimerFooter />
    </div>
  );
}
