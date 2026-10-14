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
import { BrandMark, cn, SegmentedNav, SiteFooter } from "@/components/ui";
import { BadgeCheck, CalendarCheck, House, LogOut, ShieldCheck, Stethoscope, UserRound, Users } from "lucide-react";

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
      <div className="min-h-screen flex flex-col bg-canvas">
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12">
          <SkeletonCard lines={4} />
        </main>
        <MedicalDisclaimerFooter />
      </div>
    );
  }

  const role = profile?.role ?? "patient";

  // Plain words for every section (ADR-066); the same routes as before.
  const navItems =
    role === "doctor"
      ? [
          { href: "/doctor", label: "Queue", icon: Stethoscope },
          { href: "/doctor/verify", label: "Verification", icon: BadgeCheck },
          { href: "/onboarding", label: "Profile", icon: UserRound },
          { href: "/consent", label: "Privacy", icon: ShieldCheck },
        ]
      : role === "admin"
        ? [
            { href: "/admin/doctors", label: "Doctors", icon: Users },
            { href: "/consent", label: "Privacy", icon: ShieldCheck },
          ]
        : [
            { href: "/dashboard", label: "Today", icon: House },
            { href: "/onboarding", label: "Health profile", icon: CalendarCheck },
            { href: "/consent", label: "Privacy", icon: ShieldCheck },
          ];

  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && href !== "/doctor" && Boolean(pathname?.startsWith(`${href}/`)));
  const initials = (profile?.full_name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="min-h-screen flex flex-col bg-canvas">
      <header className="glass-bar sticky top-0 z-30 border-b border-separator">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-full">
            <BrandMark size={30} />
            <span className="text-[17px] font-semibold tracking-tight text-label">Vyana</span>
          </Link>

          <div className="hidden flex-1 justify-center md:flex">
            <SegmentedNav items={navItems.map(({ href, label }) => ({ href, label }))} current={pathname ?? ""} label="Workspace" />
          </div>
          <div className="flex-1 md:hidden" />

          <div className="flex shrink-0 items-center gap-2">
            <a href="tel:108" aria-label="Emergency: call 108 for an ambulance" className="rounded-full bg-danger-soft px-3.5 py-1.5 text-[14px] font-semibold text-danger-text transition-colors hover:bg-danger/15">
              SOS 108
            </a>
            <span aria-hidden="true" title={profile?.full_name ?? undefined} className="hidden h-8 w-8 items-center justify-center rounded-full bg-fill-strong text-[13px] font-semibold text-label-2 sm:flex">
              {initials || "·"}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-full text-label-3 transition-colors hover:bg-fill hover:text-label"
            >
              <LogOut aria-hidden="true" className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:pt-8 md:pb-10">{children}</main>

      <SiteFooter withTabBar />

      {/* Phone: a floating glass tab bar, like iOS 26. */}
      <nav aria-label="Workspace" className="glass fixed inset-x-4 bottom-4 z-30 flex items-center justify-around rounded-full px-2 py-1.5 md:hidden">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("flex min-w-16 flex-col items-center gap-0.5 rounded-full px-3 py-1.5 text-[10px] transition-colors", active ? "bg-accent-soft font-semibold text-accent-strong" : "text-label-3")}
            >
              <Icon aria-hidden="true" className="h-[22px] w-[22px]" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-canvas">
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
