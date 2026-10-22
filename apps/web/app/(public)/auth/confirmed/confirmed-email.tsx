"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "@vyana/shared";
import { PublicHeader } from "@/components/public-header";
import { BrandMark, ButtonLink, SiteFooter } from "@/components/ui";
import {
  confirmationDestination,
  confirmationLinkError,
} from "./confirmed-flow";

export function ConfirmedEmail() {
  const { user, loading } = useSession();
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function readLinkError() {
      const error = confirmationLinkError(window.location.href);
      if (!ignore) setLinkError(error);
    }
    void readLinkError();
    return () => {
      ignore = true;
    };
  }, []);

  const destination = confirmationDestination(Boolean(user));

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-label">
      <PublicHeader />

      <main className="flex-1 flex items-center justify-center p-4 py-12 sm:py-16">
        <div className="w-full max-w-md rounded-card border border-separator bg-surface p-6 sm:p-8 shadow-float space-y-6">
          <div className="flex flex-col items-center text-center">
            <BrandMark size={48} />
            <h1 className="mt-4 text-[24px] sm:text-[28px] font-bold tracking-tight text-label">
              {linkError ? "This link did not work" : "Email confirmed"}
            </h1>
            {linkError ? (
              <p className="mt-1.5 text-[15px] text-label-2 leading-relaxed">
                The confirmation link may have expired or already been used.
                If your email address was confirmed, sign in. Otherwise,
                create the account again to get a new link.
              </p>
            ) : (
              <p className="mt-1.5 text-[15px] text-label-2 leading-relaxed">
                Your email address is confirmed. If you are signed in on this
                browser, continue to DPDP consent. Otherwise, sign in first.
              </p>
            )}
          </div>

          {linkError ? (
            <div className="space-y-2">
              <ButtonLink
                href="/login"
                variant="primary"
                size="lg"
                className="w-full"
              >
                Sign in
              </ButtonLink>
              <ButtonLink
                href="/signup"
                variant="plain"
                size="md"
                className="w-full"
              >
                Create account again
              </ButtonLink>
            </div>
          ) : loading ? (
            <p
              role="status"
              className="text-center text-[14px] text-label-3"
            >
              Checking your sign-in…
            </p>
          ) : (
            <ButtonLink
              href={destination.href}
              variant="primary"
              size="lg"
              className="w-full"
            >
              {destination.label}
            </ButtonLink>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
