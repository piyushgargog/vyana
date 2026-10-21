"use client";

import React, { Suspense, use } from "react";
import { AlertCircle } from "lucide-react";
import { useSharedRecord } from "@vyana/shared";
import { PublicHeader } from "@/components/public-header";
import { ButtonLink, Card, SiteFooter, SkeletonLine } from "@/components/ui";
import { ShareHeaderCard, ShareConditionsMeds } from "@/components/share/header-card";
import { ShareMiniNav, type ShareSectionLink } from "@/components/share/mini-nav";
import { ShareTimeline } from "@/components/share/memory-timeline";
import { ShareLabTrends } from "@/components/share/lab-trends";
import { ShareVitals } from "@/components/share/vitals-lines";
import { ShareMedicinesTimeline } from "@/components/share/medicines-timeline";
import { ShareAdherence } from "@/components/share/adherence-strip";

function PublicShareRecordContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { data: record, isLoading, error } = useSharedRecord(token);

  if (isLoading) {
    return (
      <div className="share-page min-h-screen flex flex-col bg-canvas text-label">
        <PublicHeader />
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 space-y-4">
          <Card className="space-y-4 p-6">
            <SkeletonLine className="h-8 w-64" />
            <SkeletonLine className="h-4 w-48" />
            <SkeletonLine className="h-20 w-full" />
          </Card>
        </main>
        <SiteFooter />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="share-page min-h-screen flex flex-col bg-canvas text-label">
        <PublicHeader />

        <main className="flex-1 mx-auto w-full max-w-md px-4 py-16 text-center">
          <Card className="p-8 shadow-float space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger-text">
              <AlertCircle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h1 className="text-[20px] font-bold text-label">
              Access link expired or revoked
            </h1>
            <p className="text-[14px] text-label-2 leading-relaxed">
              This temporary clinical access link is no longer valid. The patient may have revoked access or the temporary 24-hour validity window has passed.
            </p>
            <div className="pt-2">
              <ButtonLink
                href="/login"
                variant="primary"
                size="md"
              >
                Sign in to Vyana
              </ButtonLink>
            </div>
          </Card>
        </main>

        <SiteFooter />
      </div>
    );
  }

  const { profile, timeline, memory } = record;

  // The mini-nav lists only the sections this record actually has.
  const sections: ShareSectionLink[] = [{ id: "overview", label: "Overview" }];
  if (timeline && timeline.length > 0) sections.push({ id: "timeline", label: "Timeline" });
  if (memory?.labs && memory.labs.length > 0) sections.push({ id: "labs", label: "Labs" });
  if (memory?.vitals && memory.vitals.length > 0) sections.push({ id: "vitals", label: "Vitals" });
  if (memory?.medicines && memory.medicines.length > 0)
    sections.push({ id: "medicines", label: "Medicines" });
  if (memory?.adherence) sections.push({ id: "adherence", label: "Adherence" });

  return (
    <div className="share-page min-h-screen flex flex-col bg-canvas text-label">
      <div className="print:hidden">
        <PublicHeader />
      </div>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6 sm:py-8 space-y-6">
        <div id="overview" className="scroll-mt-24">
          <ShareHeaderCard record={record} />
        </div>

        <ShareMiniNav sections={sections} />

        <ShareConditionsMeds profile={profile} />

        <ShareTimeline events={timeline} />

        {memory?.labs && <ShareLabTrends labs={memory.labs} />}
        {memory?.vitals && <ShareVitals vitals={memory.vitals} />}
        {memory?.medicines && <ShareMedicinesTimeline medicines={memory.medicines} />}
        {memory?.adherence && <ShareAdherence adherence={memory.adherence} />}
      </main>

      <div className="print:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}

export default function PublicShareRecordPage(props: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="share-page min-h-screen flex flex-col bg-canvas text-label">
          <PublicHeader />
          <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-8 space-y-4">
            <Card className="space-y-4 p-6">
              <SkeletonLine className="h-8 w-64" />
              <SkeletonLine className="h-4 w-48" />
            </Card>
          </main>
          <SiteFooter />
        </div>
      }
    >
      <PublicShareRecordContent {...props} />
    </Suspense>
  );
}
