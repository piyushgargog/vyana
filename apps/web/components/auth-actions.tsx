"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMyProfile, useSession } from "@vyana/shared";
import { ButtonLink } from "@/components/ui";

/**
 * Where a signed-in person belongs. `null` until the session (and, for the destination, the profile) is known.
 * Same rules as the login form: not onboarded → onboarding, then the role's home.
 */
export function useSignedInHome(): { status: "loading" | "out" | "in"; href: string } {
  const { user, loading } = useSession();
  const { data: profile } = useMyProfile();
  if (loading) return { status: "loading", href: "/dashboard" };
  if (!user) return { status: "out", href: "/login" };
  const href = !profile
    ? "/dashboard"
    : !profile.onboarded
      ? "/onboarding"
      : profile.role === "doctor"
        ? "/doctor"
        : profile.role === "admin"
          ? "/admin/doctors"
          : "/dashboard";
  return { status: "in", href };
}

/**
 * The public pages' sign-in buttons. The session lives in a cookie for as long as the person does not sign out,
 * so a signed-in visitor sees "Open Vyana", not "Sign in" (which made it look like they had been logged out).
 */
export function AuthActions({ plainSignIn = false }: { plainSignIn?: boolean }) {
  const { status, href } = useSignedInHome();
  if (status === "in") {
    return (
      <ButtonLink href={href} variant="primary" size="sm">
        Open Vyana
      </ButtonLink>
    );
  }
  return (
    <span className={status === "loading" ? "invisible flex items-center gap-2 sm:gap-3" : "flex items-center gap-2 sm:gap-3"} aria-hidden={status === "loading"}>
      <ButtonLink href="/login" variant={plainSignIn ? "plain" : "secondary"} size="sm" tabIndex={status === "loading" ? -1 : undefined}>
        Sign in
      </ButtonLink>
      <ButtonLink href="/signup" variant="primary" size="sm" tabIndex={status === "loading" ? -1 : undefined}>
        Get started
      </ButtonLink>
    </span>
  );
}

/** The home page's big call to action. */
export function HeroActions() {
  const { status, href } = useSignedInHome();
  if (status === "in") {
    return (
      <ButtonLink href={href} variant="primary" size="lg">
        Open Vyana
      </ButtonLink>
    );
  }
  return (
    <>
      <ButtonLink href="/signup" variant="primary" size="lg">
        Get started with Vyana
      </ButtonLink>
      <ButtonLink href="/login" variant="secondary" size="lg">
        Sign in
      </ButtonLink>
    </>
  );
}

/** Signed-in visitors on /login or /signup go straight to the app instead of seeing a sign-in form. */
export function useRedirectIfSignedIn(): void {
  const router = useRouter();
  const { status, href } = useSignedInHome();
  useEffect(() => {
    if (status === "in") router.replace(href);
  }, [status, href, router]);
}
