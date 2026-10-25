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
import { SkeletonCard } from "@/components/ui-primitives";
import { BrandMark, cn, SegmentedNav, SiteFooter, SkeletonLine } from "@/components/ui";
import { BadgeCheck, CalendarDays, FlaskConical, House, LogOut, MessageCircleQuestion, Pill, ShieldCheck, ShoppingBasket, Stethoscope, UserRound, Users } from "lucide-react";

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
    // Only this browser: the default (global) scope would also sign the account out on every other device, and the
    // nightly E2E test signs the demo accounts in and out.
    await supabase.auth.signOut({ scope: "local" });
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

  // The layout renders at once (issue #157): the header, footer and tab bar are on screen
  // immediately, with skeletons only where session, consent or profile data is still
  // loading — the page itself waits for all three, and for the gate checks above, so
  // nothing behind a redirect is ever shown early.
  const stillLoading = sessionLoading || consentLoading || profileLoading;
  const showChildren = !stillLoading && Boolean(user) && !isGatedRoute;

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
            // The first five are also the phone's tab bar: keep the most used ones there. Privacy is on the dashboard and in the footer.
            { href: "/dashboard", label: "Dashboard", icon: House },
            { href: "/assistant", label: "Ask Vyana", icon: MessageCircleQuestion },
            { href: "/prescriptions/scan", label: "Prescriptions", icon: Pill },
            { href: "/basket", label: "Medicine prices", icon: ShoppingBasket },
            { href: "/appointments", label: "Appointments", icon: CalendarDays },
            { href: "/reports/upload", label: "Lab reports", icon: FlaskConical },
            { href: "/onboarding", label: "Health profile", icon: UserRound },
          ];

  const isActive = (href: string) => {
    if (pathname === href) return true;
    if (href === "/dashboard" || href === "/doctor") return false;
    // Section match: /prescriptions/scan highlights for /prescriptions/[id] too.
    const section = `/${href.split("/")[1]}/`;
    return Boolean(pathname?.startsWith(section));
  };
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

          <div className="hidden flex-1 justify-center md:flex lg:hidden">
            {stillLoading || !profile ? (
              <SkeletonLine className="h-9 w-96 max-w-full rounded-full" />
            ) : (
              <SegmentedNav items={navItems.map(({ href, label }) => ({ href, label }))} current={pathname ?? ""} label="Workspace" />
            )}
          </div>
          <div className="flex-1 md:hidden" />

          <div className="flex shrink-0 items-center gap-2">
            <a href="tel:108" aria-label="Emergency: call 108 for an ambulance" className="rounded-full bg-danger-soft px-3.5 py-1.5 text-[14px] font-semibold text-danger-text transition-colors hover:bg-danger/15">
              SOS 108
            </a>
            {profile ? (
              <span aria-hidden="true" title={profile.full_name ?? undefined} className="hidden h-8 w-8 items-center justify-center rounded-full bg-fill-strong text-[13px] font-semibold text-label-2 sm:flex">
                {initials || "·"}
              </span>
            ) : (
              <SkeletonLine className="hidden h-8 w-8 rounded-full sm:block" />
            )}
            {user ? (
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="flex h-11 w-11 items-center justify-center rounded-full text-label-3 transition-colors hover:bg-fill hover:text-label"
              >
                <LogOut aria-hidden="true" className="h-[18px] w-[18px]" />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex w-full flex-1">
        {/* From 1024 px the sections live in a sidebar (issue #492): never both — the tab
            bar is phone-only and the top segmented nav covers the widths in between. */}
        <aside className="sticky top-[65px] hidden h-[calc(100vh-65px)] w-60 shrink-0 overflow-y-auto px-3 py-4 lg:block">
          <nav aria-label="Workspace" className="flex flex-col gap-1">
            {stillLoading || !profile
              ? Array.from({ length: 5 }, (_, i) => <SkeletonLine key={i} className="h-11 w-full rounded-row" />)
              : navItems.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-row px-3 text-subheadline transition-colors",
                        active ? "bg-accent-soft font-semibold text-accent-strong" : "text-label-2 hover:bg-fill hover:text-label",
                      )}
                    >
                      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
          </nav>
        </aside>

        <main aria-busy={!showChildren} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:pt-8 md:pb-10">
          {showChildren ? (
            children
          ) : (
            <div className="space-y-4">
              <SkeletonCard lines={3} />
              <div className="grid gap-4 sm:grid-cols-2">
                <SkeletonCard lines={2} />
                <SkeletonCard lines={2} />
              </div>
            </div>
          )}
        </main>
      </div>

      <SiteFooter withTabBar />

      {/* Phone: a floating glass tab bar, like iOS 26. */}
      <nav aria-label="Workspace" data-tabbar className="glass fixed inset-x-4 bottom-4 z-30 flex items-center justify-around rounded-full px-2 py-1.5 md:hidden">
        {stillLoading || !profile
          ? Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="flex min-h-11 flex-1 items-center justify-center px-1 py-1.5">
                <SkeletonLine className="h-6 w-6 rounded-full" />
              </span>
            ))
          : navItems.slice(0, 5).map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn("flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[11px] transition-colors", active ? "bg-accent-soft font-semibold text-accent-strong" : "text-label-3")}
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
