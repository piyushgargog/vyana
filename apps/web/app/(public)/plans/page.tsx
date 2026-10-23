import React from "react";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";
import { LargeTitle, SiteFooter } from "@/components/ui";
import { PlansClient } from "./plans-client";

export const metadata: Metadata = {
  title: "Plans · Vyana",
  description:
    "Vyana costs nothing today. See what Free includes and what the Family plan could add, and join the Family waitlist.",
};

export default function PlansPage() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-label">
      <PublicHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <LargeTitle
            eyebrow="Plans"
            title="Free today. A Family plan is on the waitlist."
            subtitle="Using Vyana costs nothing today. Family is being considered for households who look after each other. Leave your email to join the Family list."
          />
        </div>

        <PlansClient />
      </main>

      <SiteFooter />
    </div>
  );
}
