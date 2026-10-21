"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  Download,
  FileText,
  HeartPulse,
  Pill as PillIcon,
  ShieldAlert,
  Ticket,
  Trash2,
  TrendingUp,
} from "lucide-react";
import {
  DEFAULT_TIMES,
  computeItemRefill,
  parseCarePlanJson,
  useActiveItems,
  useCarePlans,
  useDeleteAccount,
  useDoseLogs,
  useExportMyData,
  useLabReports,
  useLabValueHistory,
  useLogDose,
  useMyAppointments,
  useMyProfile,
  type FrequencyType,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { AiSafetyBanner, TrendChartSvg } from "@/components/ui-primitives";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  LargeTitle,
  Pill,
  Reveal,
  SkeletonLine,
  Sheet,
} from "@/components/ui";

export default function PatientDashboardPage() {
  const router = useRouter();
  const { supabase, showToast } = useVyanaWeb();
  const { data: profile, isLoading: profileLoading } = useMyProfile();

  // Active prescribed medications
  const {
    data: activeItems,
    isLoading: medsLoading,
    isError: medsError,
    refetch: refetchMeds,
  } = useActiveItems();

  // Today's dose logs & mutation
  const now = useMemo(() => new Date(), []);
  const startOfDay = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString(),
    [now]
  );
  const endOfDay = useMemo(
    () => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0).toISOString(),
    [now]
  );
  const { data: todayDoseLogs = [] } = useDoseLogs(startOfDay, endOfDay);
  const logDoseMutation = useLogDose();

  // Appointments (OPD Tokens)
  const {
    data: appointments,
    isLoading: apptsLoading,
    isError: apptsError,
    refetch: refetchAppts,
  } = useMyAppointments();

  // Lab history for HbA1c Trend
  const {
    data: hba1cHistory = [],
    isLoading: hba1cLoading,
    isError: hba1cError,
    refetch: refetchHba1c,
  } = useLabValueHistory("HbA1c");

  // Approved Care Plans
  const {
    data: carePlans,
    isLoading: carePlansLoading,
    isError: carePlansError,
    refetch: refetchCarePlans,
  } = useCarePlans();

  // Diagnostic Lab Reports
  const {
    data: labReports,
    isLoading: reportsLoading,
    isError: reportsError,
    refetch: refetchReports,
  } = useLabReports();

  // Privacy: DPDP Data Export
  const exportMutation = useExportMyData();

  // Privacy: Account Deletion Modal & State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const deleteMutation = useDeleteAccount();

  // Greeting and header calculations
  const hour = now.getHours();
  const greetingTime = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const patientFirstName = profile?.full_name ? profile.full_name.trim().split(/\s+/)[0] : null;
  const greeting = patientFirstName ? `${greetingTime}, ${patientFirstName}` : greetingTime;
  const formattedDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Scheduled doses slots for today
  const scheduledSlots = useMemo(() => {
    return (activeItems ?? []).flatMap((item) => {
      const times =
        item.times && item.times.length > 0
          ? item.times
          : DEFAULT_TIMES[(item.frequency as FrequencyType) ?? "OD"] ?? ["09:00"];
      return times.map((timeStr) => {
        const [hh = "09", mm = "00"] = timeStr.split(":");
        const scheduledDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          Number(hh),
          Number(mm),
          0
        );
        const scheduledIso = scheduledDate.toISOString();
        const matchedLog = todayDoseLogs.find(
          (d) =>
            d.item_id === item.id &&
            Math.abs(new Date(d.scheduled_for).getTime() - scheduledDate.getTime()) <= 30 * 60 * 1000
        );
        const status = matchedLog?.status ?? "pending";
        const refill = computeItemRefill(item, now);
        return {
          key: `${item.id}-${timeStr}`,
          itemId: item.id,
          scheduledIso,
          medicineName: item.medicine_name,
          strength: item.strength,
          dose: item.dose,
          frequency: item.frequency,
          instructions: item.instructions,
          withFood: item.with_food,
          timeStr,
          status,
          refill,
        };
      });
    });
  }, [activeItems, todayDoseLogs, now]);

  const takenCount = scheduledSlots.filter((s) => s.status === "taken").length;

  const handleTakeDose = async (itemId: string, scheduledIso: string, name: string) => {
    try {
      await logDoseMutation.mutateAsync({
        item_id: itemId,
        scheduled_for: scheduledIso,
        status: "taken",
      });
      showToast(`${name} marked as taken`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update dose", "error");
    }
  };

  const handleSkipDose = async (itemId: string, scheduledIso: string, name: string) => {
    try {
      await logDoseMutation.mutateAsync({
        item_id: itemId,
        scheduled_for: scheduledIso,
        status: "skipped",
      });
      showToast(`${name} marked as skipped`, "warning");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update dose", "error");
    }
  };

  // Upcoming appointments
  const upcomingAppointments = useMemo(
    () => (appointments ?? []).filter((a) => a.status === "requested" || a.status === "confirmed"),
    [appointments]
  );
  const nextAppt = upcomingAppointments[0];

  // HbA1c trend chart points
  const trendPoints = useMemo(() => {
    return hba1cHistory
      .filter((v) => v.value !== null)
      .map((v) => ({
        date: v.measured_on
          ? new Date(v.measured_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "Recent",
        value: Number(v.value),
        unit: v.unit || "%",
        refLow: typeof v.ref_low === "number" ? v.ref_low : null,
        refHigh: typeof v.ref_high === "number" ? v.ref_high : null,
        flag: v.flag as "low" | "normal" | "high" | null,
      }));
  }, [hba1cHistory]);

  const latestHba1c = trendPoints[trendPoints.length - 1];

  // DPDP Export & Account Deletion Handlers
  const handleDownloadMyData = async () => {
    try {
      showToast("Preparing your clinical records export…", "info");
      const data = await exportMutation.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vyana-health-records-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Health data downloaded successfully.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to export data", "error");
    }
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      showToast("Password is required to confirm account deletion", "warning");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      if (userEmail) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: deletePassword,
        });
        if (reauthError) {
          showToast(`Authentication failed: ${reauthError.message}`, "error");
          return;
        }
      }

      await deleteMutation.mutateAsync();
      await supabase.auth.signOut();
      setShowDeleteModal(false);
      setDeletePassword("");
      showToast("Your account & health records have been permanently deleted.", "warning");
      router.replace("/login");
    } catch (err: unknown) {
      const errorObj = err as { status?: number; code?: string; message?: string };
      if (errorObj?.status === 403 || errorObj?.code === "REAUTH_REQUIRED") {
        showToast("Recent login required (403). Please re-enter your password to proceed.", "error");
      } else {
        showToast(err instanceof Error ? err.message : "Could not delete account", "error");
      }
    }
  };

  if (profileLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <SkeletonLine className="h-5 w-40" />
          <SkeletonLine className="h-10 w-72" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="space-y-4">
            <SkeletonLine className="h-6 w-32" />
            <SkeletonLine className="h-16 w-full" />
            <SkeletonLine className="h-16 w-full" />
          </Card>
          <Card className="space-y-4">
            <SkeletonLine className="h-6 w-36" />
            <SkeletonLine className="h-24 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  // Allergy list formatting
  const allergiesList = profile?.allergies
    ? Array.isArray(profile.allergies)
      ? profile.allergies
      : [String(profile.allergies)]
    : [];

  return (
    <div className="space-y-8">
      {/* 1. Large Greeting Header */}
      <Reveal>
        <LargeTitle
          eyebrow={formattedDate}
          title={greeting}
          subtitle={
            <span className="flex flex-wrap items-center gap-2 pt-1 text-[15px]">
              {profile?.blood_group ? (
                <Pill tone="neutral">Blood group {profile.blood_group}</Pill>
              ) : null}
              {allergiesList.length > 0 ? (
                <Pill tone="danger" icon={<ShieldAlert aria-hidden="true" />}>
                  Allergies: {allergiesList.join(", ")}
                </Pill>
              ) : (
                <Pill tone="neutral">No known drug allergies reported</Pill>
              )}
            </span>
          }
          actions={
            <ButtonLink href="/consent" variant="secondary" size="sm">
              Privacy & data
            </ButtonLink>
          }
        />
      </Reveal>

      {/* Main Grid: Doses & Visit Token */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 2. Doses List Card */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader
              title="Doses today"
              trailing={
                scheduledSlots.length > 0 ? (
                  <span className="text-[15px] font-semibold text-label-2">
                    {takenCount} of {scheduledSlots.length} taken
                  </span>
                ) : undefined
              }
            />

            {medsLoading ? (
              <div className="space-y-3 pt-2">
                <SkeletonLine className="h-12 w-full" />
                <SkeletonLine className="h-12 w-full" />
              </div>
            ) : medsError ? (
              <ErrorState onRetry={() => refetchMeds()} />
            ) : scheduledSlots.length === 0 ? (
              <EmptyState
                icon={<PillIcon className="h-6 w-6" aria-hidden="true" />}
                title="No doses scheduled today"
                body="Prescriptions you scan or receive from your physician will display your daily schedule here."
              />
            ) : (
              <div className="space-y-2.5">
                {scheduledSlots.map((slot) => {
                  const isTaken = slot.status === "taken";
                  const isSkipped = slot.status === "skipped";

                  return (
                    <div
                      key={slot.key}
                      className="flex items-center justify-between gap-3 rounded-row border border-separator bg-canvas/60 p-3.5 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-[15px] font-semibold text-label">
                            {slot.medicineName}
                          </span>
                          {slot.strength ? (
                            <span className="text-[15px] text-label-3">{slot.strength}</span>
                          ) : null}
                          {slot.refill.needsRefillSoon ? (
                            <Pill tone="warn" className="text-[15px]">
                              Refill: {slot.refill.daysLeft}d left
                            </Pill>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-[15px] text-label-2">
                          {slot.timeStr} · {slot.dose || "As prescribed"} ·{" "}
                          {slot.withFood ? "With food" : "Anytime"}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {isTaken ? (
                          <Pill tone="ok" icon={<Check aria-hidden="true" />}>
                            Taken
                          </Pill>
                        ) : isSkipped ? (
                          <Pill tone="neutral">Skipped</Pill>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleTakeDose(slot.itemId, slot.scheduledIso, slot.medicineName)}
                              disabled={logDoseMutation.isPending}
                              aria-label={`Mark ${slot.medicineName} as taken`}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-accent px-4 text-[15px] font-semibold text-white transition-transform active:scale-[0.97] hover:bg-accent-strong disabled:opacity-50"
                            >
                              Take
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSkipDose(slot.itemId, slot.scheduledIso, slot.medicineName)}
                              disabled={logDoseMutation.isPending}
                              aria-label={`Mark ${slot.medicineName} as skipped`}
                              className="inline-flex min-h-[44px] items-center justify-center rounded-full px-3 text-[15px] font-medium text-label-3 transition-colors hover:bg-fill"
                            >
                              Skip
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>

        {/* 3. Visit Token Card */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader
              title="Hospital visit"
              trailing={
                nextAppt ? (
                  <Pill tone="accent" icon={<Ticket aria-hidden="true" />}>
                    Token #{nextAppt.token_no.toString().padStart(2, "0")}
                  </Pill>
                ) : undefined
              }
            />

            {apptsLoading ? (
              <div className="space-y-3 pt-2">
                <SkeletonLine className="h-16 w-full" />
              </div>
            ) : apptsError ? (
              <ErrorState onRetry={() => refetchAppts()} />
            ) : !nextAppt ? (
              <EmptyState
                icon={<CalendarDays className="h-6 w-6" aria-hidden="true" />}
                title="No upcoming hospital visits"
                body="When you book an OPD token or visit an affiliated hospital, your queue token will appear here."
              />
            ) : (
              <div className="space-y-4">
                <div className="rounded-card border border-separator bg-canvas/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[17px] font-semibold text-label">
                        {nextAppt.hospitals?.name || "Hospital OPD"}
                      </h3>
                      <p className="text-[15px] text-label-2">
                        {nextAppt.departments?.name || "General OPD"}
                      </p>
                    </div>
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-[17px] font-bold text-accent-strong">
                      #{nextAppt.token_no.toString().padStart(2, "0")}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-separator pt-3 text-[15px] text-label-2">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <CalendarDays className="h-4 w-4 text-label-3" aria-hidden="true" />
                      {nextAppt.appointment_date}
                    </span>
                    <span className="inline-flex items-center gap-1.5 capitalize font-medium">
                      Status: <Pill tone={nextAppt.status === "confirmed" ? "ok" : "neutral"}>{nextAppt.status}</Pill>
                    </span>
                    {nextAppt.reason ? (
                      <span className="text-label-3">Reason: {nextAppt.reason}</span>
                    ) : null}
                  </div>
                </div>

                {upcomingAppointments.length > 1 ? (
                  <div className="space-y-2">
                    <p className="text-[15px] font-semibold text-label-3 uppercase tracking-wider">
                      Other upcoming visits ({upcomingAppointments.length - 1})
                    </p>
                    {upcomingAppointments.slice(1).map((appt) => (
                      <div
                        key={appt.id}
                        className="flex items-center justify-between rounded-row border border-separator bg-canvas/40 px-3.5 py-2.5 text-[15px]"
                      >
                        <span className="font-medium text-label">
                          {appt.hospitals?.name} · {appt.departments?.name}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-label-3">{appt.appointment_date}</span>
                          <Pill tone="neutral">#{appt.token_no}</Pill>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Second Row: Trend Chart & Ask Card */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 4. Trend Chart Card */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader
              title="HbA1c trend"
              trailing={
                latestHba1c ? (
                  <Pill
                    tone={
                      latestHba1c.flag === "high" || latestHba1c.flag === "low"
                        ? "warn"
                        : "ok"
                    }
                  >
                    Latest: {latestHba1c.value} {latestHba1c.unit}
                  </Pill>
                ) : undefined
              }
            />

            {hba1cLoading ? (
              <div className="space-y-3 pt-2">
                <SkeletonLine className="h-32 w-full" />
              </div>
            ) : hba1cError ? (
              <ErrorState onRetry={() => refetchHba1c()} />
            ) : trendPoints.length === 0 ? (
              <EmptyState
                icon={<TrendingUp className="h-6 w-6" aria-hidden="true" />}
                title="No HbA1c test readings yet"
                body="When lab reports with blood sugar or HbA1c biomarkers are analyzed, your health trend graph will appear here."
              />
            ) : (
              <div className="space-y-4">
                {trendPoints.length >= 2 ? (
                  <TrendChartSvg
                    title="HbA1c"
                    unit={latestHba1c?.unit ?? "%"}
                    points={trendPoints.map((p) => ({ date: p.date, value: p.value, flag: p.flag }))}
                    refLow={latestHba1c?.refLow}
                    refHigh={latestHba1c?.refHigh}
                  />
                ) : (
                  <p className="text-[15px] text-label-2">
                    One reading so far. A trend appears after your next HbA1c report.
                  </p>
                )}
              </div>
            )}
          </div>
        </Card>

        {/* 5. Quick actions */}
        <Card className="flex flex-col justify-between">
          <div>
            <CardHeader title="Do more with Vyana" />
            <div className="mt-3 grid gap-3">
              <ButtonLink href="/prescriptions/scan" variant="primary" size="lg" className="w-full">
                Scan a prescription
              </ButtonLink>
              <ButtonLink href="/reports/upload" variant="secondary" size="lg" className="w-full">
                Upload a lab report
              </ButtonLink>
              <ButtonLink href="/basket" variant="secondary" size="lg" className="w-full">
                Compare medicine prices
              </ButtonLink>
              <ButtonLink href="/blood" variant="secondary" size="lg" className="w-full">
                Find blood
              </ButtonLink>
              <ButtonLink href="/sos" variant="secondary" size="lg" className="w-full">
                Emergency help
              </ButtonLink>
            </div>
          </div>
        </Card>
      </div>

      {/* Chronic Care Plans & Lab Reports Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chronic Care Plans */}
        <Card>
          <CardHeader
            title="Chronic care plans"
            trailing={
              carePlans && carePlans.length > 0 ? (
                <Pill tone="ok">{carePlans.length} active</Pill>
              ) : undefined
            }
          />

          {carePlansLoading ? (
            <div className="space-y-3 pt-2">
              <SkeletonLine className="h-16 w-full" />
            </div>
          ) : carePlansError ? (
            <ErrorState onRetry={() => refetchCarePlans()} />
          ) : !carePlans || carePlans.length === 0 ? (
            <EmptyState
              icon={<HeartPulse className="h-6 w-6" aria-hidden="true" />}
              title="No active care plans"
              body="Doctor-reviewed clinical plans, lifestyle protocols, and safety red flags will appear here."
            />
          ) : (
            <div className="space-y-3">
              {carePlans.map((cp) => {
                const plan = parseCarePlanJson(cp.plan_json);
                if (!plan) return null;

                return (
                  <div
                    key={cp.id}
                    className="rounded-row border border-separator bg-canvas/50 p-4 text-[15px] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-label">
                        <Link href={`/care/${cp.condition_id}`} className="underline-offset-4 hover:underline focus-visible:underline">
                          {plan.condition}
                        </Link>
                      </h3>
                      {/* Human label, never the raw status enum (#225: "PATIENT_GENERATED"). */}
                      <Pill tone={cp.status === "approved" ? "ok" : "neutral"}>
                        {cp.status === "approved"
                          ? "Approved"
                          : cp.status === "patient_generated"
                            ? "Patient added"
                            : "Draft"}
                      </Pill>
                    </div>
                    {/* Two plans can share a condition; the start date tells them apart. */}
                    <p className="text-[13px] text-label-3">
                      Started{" "}
                      {new Date(cp.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "Asia/Kolkata",
                      })}
                      {cp.reviewed_by ? " · Reviewed by a doctor" : ""}
                    </p>
                    <p className="line-clamp-3 text-[15px] text-label-2">{plan.summary}</p>
                    {plan.do && plan.do.length > 0 ? (
                      <div className="rounded-lg bg-surface p-3 text-[15px] text-label-2 space-y-1">
                        <span className="font-semibold text-label block">Key recommendations:</span>
                        <ul className="list-disc pl-4 space-y-0.5 text-[15px] text-label-2">
                          {plan.do.slice(0, 2).map((item, i) => (
                            <li key={i} className="line-clamp-2">{item}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Diagnostic Reports Summary */}
        <Card>
          <CardHeader
            title="Recent diagnostic reports"
            trailing={
              labReports && labReports.length > 0 ? (
                <Pill tone="neutral">{labReports.length} reports</Pill>
              ) : undefined
            }
          />

          {reportsLoading ? (
            <div className="space-y-3 pt-2">
              <SkeletonLine className="h-16 w-full" />
            </div>
          ) : reportsError ? (
            <ErrorState onRetry={() => refetchReports()} />
          ) : !labReports || labReports.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" aria-hidden="true" />}
              title="No lab reports uploaded"
              body="Upload diagnostic test reports to view extracted biomarkers, abnormal flags, and health records."
            />
          ) : (
            <div className="space-y-3">
              {labReports.slice(0, 3).map((rep) => (
                <div
                  key={rep.id}
                  className="rounded-row border border-separator bg-canvas/50 p-3.5 text-[15px] space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-label">
                      {rep.lab_name || "Diagnostic Laboratory"}
                    </span>
                    <span className="text-[15px] text-label-3">
                      {rep.report_date || rep.created_at.slice(0, 10)}
                    </span>
                  </div>
                  {rep.summary ? <p className="text-label-2">{rep.summary}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Personal Data Rights & Privacy (DPDP Act 2023) */}
      <Card>
        <CardHeader title="Personal health records & privacy" />
        <p className="text-[15px] text-label-2 leading-relaxed">
          Under the Digital Personal Data Protection Act 2023, you have full ownership of your personal health data. You can download a portable copy of your complete records or permanently delete your account at any time.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="max-w-full whitespace-normal! text-center"
            icon={<Download className="h-4 w-4" aria-hidden="true" />}
            disabled={exportMutation.isPending}
            onClick={handleDownloadMyData}
          >
            {exportMutation.isPending ? "Generating export…" : "Download health records (JSON)"}
          </Button>

          <Button
            type="button"
            variant="destructive"
            size="md"
            className="max-w-full whitespace-normal! text-center"
            icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setShowDeleteModal(true)}
          >
            Delete account & records
          </Button>
        </div>
      </Card>

      <Sheet
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Permanently delete account & records"
      >
        <p className="text-[15px] leading-relaxed text-label-2">
          This action is permanent and cannot be reversed. Your profile, prescriptions, lab values, and uploaded documents will be erased immediately.
        </p>
        <form onSubmit={handleConfirmDelete} className="mt-5 space-y-4">
          <Field
            id="delete-pass-input"
            label="Confirm password"
            type="password"
            required
            value={deletePassword}
            onChange={(e) => setDeletePassword(e.target.value)}
            placeholder="Enter current password"
          />
          <div className="flex justify-end gap-2.5 pt-2">
            <Button type="button" variant="secondary" size="md" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" size="md" disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting…" : "Confirm deletion"}
            </Button>
          </div>
        </form>
      </Sheet>

      {/* AI Safety Banner */}
      <AiSafetyBanner feature="patient-dashboard" />
    </div>
  );
}
