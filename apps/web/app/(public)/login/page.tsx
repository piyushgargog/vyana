"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useVyanaWeb, type DemoRole } from "@/components/providers";
import { MedicalDisclaimerFooter } from "@/components/ui-primitives";

export default function LoginPage() {
  const router = useRouter();
  const { hasLiveSupabaseEnv, setDemoRole, showToast } = useVyanaWeb();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<DemoRole>("patient");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (hasLiveSupabaseEnv && email && password) {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          setErrorMsg(error.message);
          setLoading(false);
          return;
        }
      }
      setDemoRole(selectedRole);
      showToast(`Signed in as ${selectedRole}`, "success");
      if (selectedRole === "doctor") {
        router.push("/doctor");
      } else if (selectedRole === "admin") {
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

  const handleQuickDemo = (role: DemoRole) => {
    setDemoRole(role);
    showToast(`Signed in with ${role} demo account`, "success");
    if (role === "doctor") {
      router.push("/doctor");
    } else if (role === "admin") {
      router.push("/admin/doctors");
    } else {
      router.push("/dashboard");
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
                placeholder="asha.devi@example.com"
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

            <div>
              <label
                htmlFor="login-role"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Portal Role
              </label>
              <select
                id="login-role"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as DemoRole)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                <option value="patient">Patient / Family Member</option>
                <option value="doctor">Doctor (Hospital OPD Portal)</option>
                <option value="caregiver">Caregiver</option>
                <option value="admin">Admin (Doctor Registry)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60 cursor-pointer"
            >
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <div className="border-t border-slate-200 pt-4 space-y-2.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Instant Demo Accounts (Seeded Profiles)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo("patient")}
                className="rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100 cursor-pointer"
              >
                Patient: Asha Devi
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo("doctor")}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
              >
                Doctor: Dr. Priya Sharma
              </button>
            </div>
          </div>

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
