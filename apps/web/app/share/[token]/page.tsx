"use client";

import React, { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useSharedRecord } from "@vyana/shared";
import { MedicalDisclaimerFooter, SkeletonCard } from "@/components/ui-primitives";

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
      <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <header className="border-b border-slate-200 bg-white py-3 px-4">
          <div className="mx-auto max-w-4xl flex items-center justify-between">
            <span className="text-base font-bold text-slate-900">
              Vyana · व्यान — Temporary Health Record
            </span>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-md px-4 py-16 text-center">
          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 font-bold text-xl">
              !
            </div>
            <h1 className="text-lg font-bold text-slate-900">
              Access Link Expired or Revoked
            </h1>
            <p className="text-xs text-slate-600">
              This temporary clinical access link is no longer valid. The patient may have revoked access or the temporary 24-hour validity window has passed.
            </p>
            <div className="pt-3">
              <Link
                href="/login"
                className="inline-block rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Sign In to Vyana
              </Link>
            </div>
          </div>
        </main>

        <MedicalDisclaimerFooter />
      </div>
    );
  }

  const { profile, timeline, expires_at, kind } = record;
  const expiresDate = new Date(expires_at);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Public Header */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20 shadow-xs">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white font-bold">
              व्य
            </span>
            <div>
              <span className="text-sm font-bold text-slate-900">
                Vyana · Emergency Medical Record
              </span>
              <span className="ml-2 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase">
                Temporary Doctor Share
              </span>
            </div>
          </div>

          <div className="text-right">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                isExpired
                  ? "bg-red-100 text-red-800"
                  : "bg-emerald-100 text-emerald-800"
              }`}
            >
              {isExpired
                ? "Expired"
                : `Valid until: ${expiresDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6 sm:py-8 space-y-6">
        {/* Patient Hero Details */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {profile.full_name || "Patient Record"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-600">
                {profile.age != null && (
                  <span>
                    Age: <strong>{profile.age} years</strong>
                  </span>
                )}
                {profile.blood_group && (
                  <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-0.5">
                    Blood Group: {profile.blood_group}
                  </span>
                )}
                <span className="text-slate-400">·</span>
                <span className="capitalize text-slate-500">
                  Record Scope: {kind.replace("_", " ")}
                </span>
              </div>

              {/* Emergency Contacts with Click-to-Call */}
              {profile.emergency_contacts && profile.emergency_contacts.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-700">
                    Emergency Contacts:
                  </span>
                  {profile.emergency_contacts.map((c, i) => (
                    <a
                      key={i}
                      href={`tel:${c.phone}`}
                      className="rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 text-teal-900 font-semibold hover:bg-teal-100"
                    >
                      {c.name}: {c.phone} 📞
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Critical Allergies Box */}
            <div className="w-full sm:w-72 shrink-0">
              {profile.allergies && profile.allergies.length > 0 ? (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-950">
                  <div className="flex items-center gap-1.5 font-bold text-red-800">
                    <span
                      aria-hidden="true"
                      className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white text-[10px]"
                    >
                      !
                    </span>
                    <span>KNOWN ALLERGIES</span>
                  </div>
                  <ul className="mt-1 list-disc pl-4 font-semibold text-red-900 space-y-0.5">
                    {profile.allergies.map((alg, i) => (
                      <li key={i}>{alg}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  No drug allergies recorded.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Medical Conditions & Medications */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Active Conditions */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              Active Medical Conditions ({profile.conditions?.length || 0})
            </h2>

            {!profile.conditions || profile.conditions.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">
                No active diagnosed conditions listed.
              </p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {profile.conditions.map((cond, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-slate-50 border border-slate-200 p-2 font-semibold text-slate-900"
                  >
                    {cond}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Active Medications */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              Active Medications ({profile.active_medicines?.length || 0})
            </h2>

            {!profile.active_medicines || profile.active_medicines.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">
                No active prescribed medications listed.
              </p>
            ) : (
              <div className="space-y-2 text-xs">
                {profile.active_medicines.map((med, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 flex items-center justify-between"
                  >
                    <div>
                      <strong className="text-slate-900 block font-bold">
                        {med.name} {med.strength || ""}
                      </strong>
                      <span className="text-[11px] text-slate-500">
                        {med.dose || "1 dose"} · {med.frequency}
                      </span>
                    </div>
                    <span className="rounded bg-teal-50 border border-teal-200 text-teal-800 px-1.5 py-0.5 text-[10px] font-bold uppercase">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Clinical Timeline (if kind === 'timeline' and present) */}
        {timeline && timeline.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 border-b border-slate-100 pb-2">
              Clinical History & Timeline ({timeline.length} events)
            </h2>

            <div className="space-y-2.5 border-l-2 border-teal-600/30 pl-4 ml-2">
              {timeline.map((event, idx) => (
                <div
                  key={idx}
                  className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs"
                >
                  <span className="absolute -left-[23px] top-3.5 h-3 w-3 rounded-full bg-teal-700 ring-4 ring-white" />
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-400">
                      {event.date}
                    </span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                      {event.kind}
                    </span>
                  </div>
                  <h3 className="mt-1 font-bold text-slate-900 text-sm">
                    {event.title}
                  </h3>
                  {event.summary && (
                    <p className="mt-0.5 text-slate-600">{event.summary}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <MedicalDisclaimerFooter />
    </div>
  );
}

export default function PublicShareRecordPage(props: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
          <div className="mx-auto max-w-4xl space-y-4">
            <SkeletonCard lines={2} />
            <SkeletonCard lines={4} />
          </div>
        </div>
      }
    >
      <PublicShareRecordContent {...props} />
    </Suspense>
  );
}
