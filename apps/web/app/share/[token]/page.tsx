"use client";

import React, { Suspense, use, useEffect, useState } from "react";
import { AlertCircle, Phone, ShieldAlert } from "lucide-react";
import { useSharedRecord } from "@vyana/shared";
import { PublicHeader } from "@/components/public-header";
import {
  ButtonLink,
  Card,
  CardHeader,
  Pill,
  SiteFooter,
  SkeletonLine,
} from "@/components/ui";

function useIsExpired(expiresAt: string | undefined): boolean {
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(() => {
      setIsExpired(Date.now() > new Date(expiresAt).getTime());
    }, 0);
    const interval = setInterval(() => {
      setIsExpired(Date.now() > new Date(expiresAt).getTime());
    }, 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [expiresAt]);

  return isExpired;
}

function PublicShareRecordContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const { data: record, isLoading, error } = useSharedRecord(token);
  const isExpired = useIsExpired(record?.expires_at);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-canvas text-label">
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
      <div className="min-h-screen flex flex-col bg-canvas text-label">
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

  const { profile, timeline, expires_at, kind } = record;
  const expiresDate = new Date(expires_at);

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-label">
      <PublicHeader />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6 sm:py-8 space-y-6">
        {/* Patient Hero Details */}
        <Card className="p-6 sm:p-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-[22px] sm:text-[26px] font-bold tracking-tight text-label">
                  {profile.full_name || "Patient Record"}
                </h1>
                <Pill tone={isExpired ? "danger" : "ok"}>
                  {isExpired
                    ? "Expired"
                    : `Valid until ${expiresDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                </Pill>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[14px] text-label-2">
                {profile.age != null && (
                  <span>
                    Age: <strong className="text-label">{profile.age} years</strong>
                  </span>
                )}
                {profile.blood_group && (
                  <Pill tone="danger">
                    Blood group: {profile.blood_group}
                  </Pill>
                )}
                <span className="text-label-3">·</span>
                <span className="capitalize text-label-3">
                  Scope: {kind.replace("_", " ")}
                </span>
              </div>

              {/* Emergency Contacts with Click-to-Call */}
              {profile.emergency_contacts && profile.emergency_contacts.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] pt-1">
                  <span className="font-semibold text-label">
                    Emergency contacts:
                  </span>
                  {profile.emergency_contacts.map((c, i) => (
                    <a
                      key={i}
                      href={`tel:${c.phone}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-separator bg-fill px-3 py-1 font-semibold text-label transition-colors hover:bg-accent-soft hover:text-accent-strong"
                    >
                      <Phone className="h-3 w-3" aria-hidden="true" />
                      <span>{c.name}: {c.phone}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Critical Allergies Box */}
            <div className="w-full sm:w-72 shrink-0">
              {profile.allergies && profile.allergies.length > 0 ? (
                <div className="rounded-card border border-danger-soft bg-danger-soft p-4 text-[13px] text-danger-text space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px]">
                    <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                    <span>Known Allergies</span>
                  </div>
                  <ul className="list-disc pl-4 font-semibold space-y-0.5">
                    {profile.allergies.map((alg, i) => (
                      <li key={i}>{alg}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-card border border-separator bg-fill/50 p-3.5 text-[13px] text-label-3">
                  No drug allergies recorded.
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Active Medical Conditions & Medications */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Conditions */}
          <Card className="space-y-3">
            <CardHeader
              title={`Active conditions (${profile.conditions?.length || 0})`}
            />

            {!profile.conditions || profile.conditions.length === 0 ? (
              <p className="text-[14px] text-label-3 py-2">
                No active diagnosed conditions listed.
              </p>
            ) : (
              <ul className="space-y-2 text-[14px]">
                {profile.conditions.map((cond, i) => (
                  <li
                    key={i}
                    className="rounded-row border border-separator bg-fill/50 px-3.5 py-2 font-medium text-label"
                  >
                    {cond}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Active Medications */}
          <Card className="space-y-3">
            <CardHeader
              title={`Active medications (${profile.active_medicines?.length || 0})`}
            />

            {!profile.active_medicines || profile.active_medicines.length === 0 ? (
              <p className="text-[14px] text-label-3 py-2">
                No active prescribed medications listed.
              </p>
            ) : (
              <div className="space-y-2 text-[14px]">
                {profile.active_medicines.map((med, i) => (
                  <div
                    key={i}
                    className="rounded-row border border-separator bg-fill/50 px-3.5 py-2.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <strong className="text-label block font-semibold">
                        {med.name} {med.strength || ""}
                      </strong>
                      <span className="text-[12px] text-label-3">
                        {med.dose || "1 dose"} · {med.frequency}
                      </span>
                    </div>
                    <Pill tone="accent">Active</Pill>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Clinical Timeline (if kind === 'timeline' and present) */}
        {timeline && timeline.length > 0 && (
          <Card className="space-y-4">
            <CardHeader
              title={`Clinical history & timeline (${timeline.length} events)`}
            />

            <div className="space-y-3 border-l-2 border-accent/40 pl-4 ml-2">
              {timeline.map((event, idx) => (
                <div
                  key={idx}
                  className="relative rounded-row border border-separator bg-fill/40 p-3.5 text-[13px] space-y-1"
                >
                  <span className="absolute -left-[23px] top-4 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-canvas" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-label-3 text-[12px]">
                      {event.date}
                    </span>
                    <Pill tone="neutral">{event.kind}</Pill>
                  </div>
                  <h3 className="font-semibold text-label text-[14px]">
                    {event.title}
                  </h3>
                  {event.summary && (
                    <p className="text-label-2 leading-relaxed">{event.summary}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

export default function PublicShareRecordPage(props: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col bg-canvas text-label">
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
