"use client";

import React, { Suspense, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CONSENT_VERSION,
  useConsent,
  useMyProfile,
  useSession,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { MedicalDisclaimerFooter, SkeletonCard } from "@/components/ui-primitives";

function AppShellContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { supabase, showToast } = useVyanaWeb();
  const { user, loading: sessionLoading } = useSession();
  const { data: consentRecord, isLoading: consentLoading } =
    useConsent(CONSENT_VERSION);
  const { data: profile, isLoading: profileLoading } = useMyProfile();

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (consentLoading) return;
    if (!consentRecord && pathname !== "/consent") {
      router.replace("/consent");
      return;
    }
    if (profileLoading || !profile) return;
    if (
      consentRecord &&
      !profile.onboarded &&
      pathname !== "/onboarding" &&
      pathname !== "/consent"
    ) {
      router.replace("/onboarding");
      return;
    }
    if (pathname?.startsWith("/admin") && profile.role !== "admin") {
      router.replace(profile.role === "doctor" ? "/doctor" : "/dashboard");
      return;
    }
    if (
      pathname?.startsWith("/doctor") &&
      profile.role !== "doctor" &&
      profile.role !== "admin"
    ) {
      router.replace("/dashboard");
    }
  }, [
    sessionLoading,
    user,
    consentLoading,
    consentRecord,
    profileLoading,
    profile,
    pathname,
    router,
  ]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    showToast("Signed out of Vyana", "info");
    router.replace("/login");
  };

  const isUnauthorizedRoute =
    Boolean(profile) &&
    ((pathname?.startsWith("/admin") && profile?.role !== "admin") ||
      (pathname?.startsWith("/doctor") &&
        profile?.role !== "doctor" &&
        profile?.role !== "admin"));

  const isGatedRoute =
    (!consentRecord && pathname !== "/consent") ||
    (Boolean(consentRecord) &&
      !profile?.onboarded &&
      pathname !== "/onboarding" &&
      pathname !== "/consent") ||
    isUnauthorizedRoute;

  if (
    sessionLoading ||
    !user ||
    consentLoading ||
    profileLoading ||
    isGatedRoute
  ) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12">
          <SkeletonCard lines={4} />
        </main>
        <MedicalDisclaimerFooter />
      </div>
    );
  }

  const role = profile?.role ?? "patient";

  const navItems =
    role === "doctor"
      ? [
          { href: "/doctor", label: "OPD Queue" },
          { href: "/doctor/verify", label: "NMC Verification" },
          { href: "/onboarding", label: "Doctor Profile" },
          { href: "/consent", label: "DPDP Consent" },
        ]
      : role === "admin"
        ? [
            { href: "/admin/doctors", label: "Doctors & Hospitals Registry" },
            { href: "/consent", label: "DPDP Consent" },
          ]
        : [
            { href: "/dashboard", label: "Patient Dashboard" },
            { href: "/onboarding", label: "Health Profile" },
            { href: "/consent", label: "DPDP Consent" },
          ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white font-bold">
                व्य
              </span>
              <div>
                <span className="text-base font-bold text-slate-900">
                  Vyana · व्यान
                </span>
                <span className="ml-2 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-[11px] font-semibold text-teal-800 uppercase">
                  {role}
                </span>
              </div>
            </Link>

            <nav
              aria-label="Workspace navigation"
              className="hidden md:flex items-center gap-1"
            >
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    item.href !== "/doctor" &&
                    pathname?.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      active
                        ? "bg-teal-700 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {profile?.full_name && (
              <span className="text-xs font-semibold text-slate-700 px-2">
                {profile.full_name}
              </span>
            )}

            <a
              href="tel:108"
              aria-label="Emergency Call 108 Ambulance"
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 shadow-sm"
            >
              SOS 108
            </a>

            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Mobile Secondary Nav */}
        <nav
          aria-label="Mobile workspace navigation"
          className="flex md:hidden overflow-x-auto border-t border-slate-100 px-4 py-2 gap-1.5 bg-slate-50/70"
        >
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                  active
                    ? "bg-teal-700 text-white"
                    : "bg-white border border-slate-200 text-slate-700"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
        {children}
      </main>

      <MedicalDisclaimerFooter />
    </div>
  );
}

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-slate-50">
          <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12">
            <SkeletonCard lines={4} />
          </main>
        </div>
      }
    >
      <AppShellContent>{children}</AppShellContent>
    </Suspense>
  );
}
