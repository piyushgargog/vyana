"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useVyanaWeb, type DemoRole } from "@/components/providers";
import { MedicalDisclaimerFooter } from "@/components/ui-primitives";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    demoRole,
    setDemoRole,
    profile,
    useMocks,
    setUseMocks,
    showToast,
  } = useVyanaWeb();

  const handleRoleSwitch = (nextRole: DemoRole) => {
    setDemoRole(nextRole);
    showToast(`Switched portal view to ${nextRole.toUpperCase()}`, "info");
    if (nextRole === "doctor") {
      router.push("/doctor");
    } else if (nextRole === "admin") {
      router.push("/admin/doctors");
    } else {
      router.push("/dashboard");
    }
  };

  const navItems =
    demoRole === "doctor"
      ? [
          { href: "/doctor", label: "OPD Queue" },
          { href: "/doctor/patients/demo-patient-asha", label: "Patient Chart" },
          {
            href: "/doctor/appointments/appt-demo-1/prescribe",
            label: "e-Prescribe",
          },
          { href: "/doctor/care-plans/cp-demo-t2d", label: "Care Plan Review" },
          { href: "/doctor/verify", label: "NMC Verification" },
          { href: "/admin/doctors", label: "Registry" },
        ]
      : demoRole === "admin"
        ? [
            { href: "/admin/doctors", label: "Doctors & Hospitals Registry" },
            { href: "/doctor/verify", label: "NMC Verification Agent" },
            { href: "/doctor", label: "Doctor Queue View" },
          ]
        : [
            { href: "/dashboard", label: "Patient Dashboard" },
            { href: "/share/demo-token-asha-2026", label: "Shared Medical ID" },
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
                  {demoRole}
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
            <label htmlFor="header-role-switch" className="sr-only">
              Switch active role
            </label>
            <select
              id="header-role-switch"
              value={demoRole}
              onChange={(e) => handleRoleSwitch(e.target.value as DemoRole)}
              className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800"
            >
              <option value="patient">Role: Patient ({profile.full_name})</option>
              <option value="doctor">Role: Doctor (Dr. Priya Sharma)</option>
              <option value="caregiver">Role: Caregiver (Rohit Verma)</option>
              <option value="admin">Role: Admin Registry</option>
            </select>

            <button
              type="button"
              onClick={() => setUseMocks(!useMocks)}
              aria-pressed={useMocks}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold cursor-pointer ${
                useMocks
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-emerald-300 bg-emerald-50 text-emerald-900"
              }`}
            >
              {useMocks ? "Mode: Demo Mocks" : "Mode: Live API"}
            </button>

            <a
              href="tel:108"
              aria-label="Emergency Call 108 Ambulance"
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 shadow-sm"
            >
              SOS 108
            </a>
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
