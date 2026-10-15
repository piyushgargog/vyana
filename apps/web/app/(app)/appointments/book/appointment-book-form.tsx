"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  useBookAppointment,
  useHospital,
  useHospitalInfo,
  useHospitals,
  useTokensLeft,
  type DbAppointment,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
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
  Sheet,
  SkeletonLine,
  cn,
} from "@/components/ui";

export function AppointmentBookForm() {
  const { showToast } = useVyanaWeb();
  const searchParams = useSearchParams();

  const initialHospitalId = searchParams.get("hospitalId") ?? "";
  const initialDepartment = searchParams.get("department") ?? "";

  // 1. Hospitals query
  const {
    data: hospitals = [],
    isLoading: hospitalsLoading,
    isError: hospitalsError,
    refetch: refetchHospitals,
  } = useHospitals();

  const [userHospitalId, setUserHospitalId] = useState<string>(initialHospitalId);
  const selectedHospitalId = userHospitalId || hospitals[0]?.id || "";
  const selectedHospital = useMemo(
    () => hospitals.find((h) => h.id === selectedHospitalId),
    [hospitals, selectedHospitalId]
  );

  // 2. Hospital details & departments query
  const {
    data: hospitalWithDepts,
    isLoading: deptLoading,
    isError: deptError,
    refetch: refetchHospital,
  } = useHospital(selectedHospitalId || undefined);

  const departments = useMemo(
    () => hospitalWithDepts?.departments ?? [],
    [hospitalWithDepts]
  );

  // Auto-match department if routed with `?department=...` query param (e.g. from triage)
  const matchedDeptId = useMemo(() => {
    if (!initialDepartment || departments.length === 0) return "";
    const match = departments.find(
      (d) => d.name.toLowerCase() === initialDepartment.toLowerCase()
    );
    return match?.id || "";
  }, [initialDepartment, departments]);

  const [userDeptId, setUserDeptId] = useState<string>("");
  const selectedDeptId = userDeptId || matchedDeptId || departments[0]?.id || "";
  const selectedDeptObj = useMemo(
    () => departments.find((d) => d.id === selectedDeptId),
    [departments, selectedDeptId]
  );

  // 3. Live OPD timings lookup via TinyFish (useHospitalInfo)
  const infoMutation = useHospitalInfo();
  const lastFetchedHospitalRef = useRef<string | null>(null);

  useEffect(() => {
    if (selectedHospitalId && lastFetchedHospitalRef.current !== selectedHospitalId) {
      lastFetchedHospitalRef.current = selectedHospitalId;
      infoMutation.mutate({ hospital_id: selectedHospitalId });
    }
  }, [selectedHospitalId, infoMutation]);

  const opdInfo = infoMutation.data;

  // 4. Appointment date state
  const [dateDefaults] = useState(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const tomorrow = new Date(now.getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
    return { today, tomorrow };
  });

  const [appointmentDate, setAppointmentDate] = useState<string>(dateDefaults.today);

  // 5. Live token availability query via RPC
  const {
    data: tokensData,
    isLoading: tokensLoading,
    isError: tokensError,
    refetch: refetchTokens,
  } = useTokensLeft(selectedDeptId || undefined, appointmentDate || undefined);

  // 6. Reason for visit
  const [reason, setReason] = useState<string>("General OPD consultation");

  // 7. Booking mutation and confirmation modal state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedAppt, setConfirmedAppt] = useState<DbAppointment | null>(null);
  const bookMutation = useBookAppointment();

  // Edge cases & availability validations
  const isDateInPast = Boolean(appointmentDate && appointmentDate < dateDefaults.today);
  const isOpdClosed = tokensData?.opd_open === false;
  const isLimitReached = tokensData ? tokensData.tokens_left <= 0 : false;
  const canBook = Boolean(
    selectedHospitalId &&
      selectedDeptId &&
      appointmentDate &&
      !isDateInPast &&
      !isOpdClosed &&
      !isLimitReached
  );

  const handleOpenReview = () => {
    if (!selectedHospitalId || !selectedDeptId || !appointmentDate) {
      showToast("Please select hospital, department and date", "warning");
      return;
    }
    if (isDateInPast) {
      showToast("Appointment date cannot be in the past", "warning");
      return;
    }
    if (isOpdClosed) {
      showToast("The OPD is closed for this department on the selected date", "warning");
      return;
    }
    if (isLimitReached) {
      showToast("All OPD tokens have been issued for this date", "warning");
      return;
    }
    setBookingError(null);
    setIsSheetOpen(true);
  };

  const handleConfirmBooking = async () => {
    if (!selectedHospitalId || !selectedDeptId || !appointmentDate) return;
    setBookingError(null);

    try {
      const res = await bookMutation.mutateAsync({
        hospital_id: selectedHospitalId,
        department_id: selectedDeptId,
        appointment_date: appointmentDate,
        reason: reason.trim() || undefined,
      });
      setConfirmedAppt(res);
      setIsSheetOpen(false);
      showToast(`Token #${res.token_no} booked successfully`, "success");
    } catch (err) {
      let message = "Could not book OPD token. Please try again.";
      if (err instanceof Error) {
        const raw = err.message;
        if (raw.toLowerCase().includes("you already have a token")) {
          message =
            "You already have an active OPD token for this department on this date. Please check your dashboard.";
        } else if (raw.toLowerCase().includes("opd is closed")) {
          message =
            "The OPD is closed for this department on the selected date. Please choose another date.";
        } else if (raw.toLowerCase().includes("no tokens left")) {
          message =
            "All available tokens have been issued for this department on that day. Please choose another date.";
        } else if (raw.toLowerCase().includes("date is in the past")) {
          message = "Appointment date cannot be in the past.";
        } else {
          message = raw;
        }
      }
      setBookingError(message);
      showToast(message, "error");
    }
  };

  const handleReset = () => {
    setConfirmedAppt(null);
    setBookingError(null);
    setAppointmentDate(dateDefaults.today);
    setReason("General OPD consultation");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {confirmedAppt ? (
        /* Success State: Appointment Confirmed Card */
        <Reveal>
          <Card className="flex flex-col items-center border border-separator p-6 text-center shadow-float sm:p-8">
            <Pill tone="ok" icon={<Check className="h-4 w-4" aria-hidden="true" />}>
              Appointment confirmed
            </Pill>

            <div className="mt-6 space-y-1">
              <p className="text-[15px] font-semibold uppercase tracking-wider text-label-3">
                Your OPD Token Number
              </p>
              <div className="text-[48px] font-bold tracking-tight text-accent-strong sm:text-[60px]">
                Token #{confirmedAppt.token_no}
              </div>
            </div>

            <div className="mt-6 w-full rounded-card border border-separator bg-canvas/70 p-4 text-left space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[17px] font-semibold text-label">
                    {selectedHospital?.name || "Hospital OPD"}
                  </h3>
                  <p className="text-[15px] text-label-2">
                    {selectedHospital?.city ? `${selectedHospital.city} · ` : ""}
                    {selectedHospital?.kind === "government"
                      ? "Government Hospital"
                      : "Private Hospital"}
                  </p>
                </div>
                <Pill tone="neutral" className="uppercase font-semibold text-[13px]">
                  {confirmedAppt.status}
                </Pill>
              </div>

              <div className="border-t border-separator pt-3 space-y-2 text-[15px]">
                <div className="flex items-center gap-2 text-label">
                  <span className="text-label-3 font-medium">Department:</span>
                  <span className="font-semibold">
                    {selectedDeptObj?.name || "General OPD"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-label">
                  <span className="flex items-center gap-1.5 text-label-3 font-medium">
                    <Calendar className="h-4 w-4 shrink-0 text-label-3" aria-hidden="true" />
                    Date:
                  </span>
                  <span className="font-semibold">{confirmedAppt.appointment_date}</span>
                </div>
                {confirmedAppt.reason ? (
                  <div className="flex items-start gap-2 text-label">
                    <span className="shrink-0 text-label-3 font-medium">Reason:</span>
                    <span>{confirmedAppt.reason}</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Reporting Instructions Notice */}
            <div className="mt-4 w-full rounded-card bg-fill p-4 text-left space-y-1">
              <div className="flex items-center gap-2 text-[15px] font-semibold text-label">
                <Clock className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
                OPD Reporting Notice
              </div>
              <p className="text-[15px] leading-relaxed text-label-2">
                Please arrive at the hospital registration counter by 8:30 AM on{" "}
                <strong className="text-label">{confirmedAppt.appointment_date}</strong> with your{" "}
                <strong className="text-label">Token #{confirmedAppt.token_no}</strong>.
              </p>
            </div>

            <div className="mt-6 flex w-full flex-col sm:flex-row items-center gap-3">
              <ButtonLink
                href="/dashboard"
                variant="primary"
                size="lg"
                className="w-full sm:flex-1 text-[16px]"
              >
                Back to dashboard
              </ButtonLink>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleReset}
                className="w-full sm:flex-1 text-[16px]"
              >
                Book another token
              </Button>
            </div>
          </Card>
        </Reveal>
      ) : (
        /* Booking Flow Form */
        <div className="space-y-6">
          <Reveal>
            <LargeTitle
              eyebrow="Appointments"
              title="Book OPD token"
              subtitle="Select an affiliated hospital, department, and appointment date to issue your outpatient queue token."
              actions={
                <ButtonLink href="/dashboard" variant="secondary" size="sm">
                  Back to dashboard
                </ButtonLink>
              }
            />
          </Reveal>

          {/* 1. Select Hospital */}
          <Card>
            <CardHeader
              title="1. Select Hospital"
              trailing={
                hospitals.length > 0 ? (
                  <span>{hospitals.length} affiliated hospitals</span>
                ) : undefined
              }
            />

            {hospitalsLoading ? (
              <div className="space-y-3 pt-1">
                <SkeletonLine className="h-14 w-full" />
                <SkeletonLine className="h-14 w-full" />
              </div>
            ) : hospitalsError ? (
              <ErrorState
                title="Couldn't load hospitals"
                body="Please check your connection or try again."
                onRetry={() => refetchHospitals()}
              />
            ) : hospitals.length === 0 ? (
              <EmptyState
                icon={<Building2 className="h-6 w-6" aria-hidden="true" />}
                title="No affiliated hospitals available"
                body="There are no hospitals registered for OPD token booking at this time."
              />
            ) : (
              <div
                className="space-y-2.5"
                role="radiogroup"
                aria-label="Affiliated hospitals"
              >
                {hospitals.map((h) => {
                  const isSelected = h.id === selectedHospitalId;
                  return (
                    <button
                      key={h.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Select hospital ${h.name}`}
                      onClick={() => {
                        setUserHospitalId(h.id);
                        setUserDeptId(""); // Reset user department selection on hospital change
                      }}
                      className={cn(
                        "flex w-full min-h-[56px] items-center justify-between rounded-row border p-4 text-left transition-all active:scale-[0.99]",
                        isSelected
                          ? "border-accent bg-accent-soft/30 shadow-sm"
                          : "border-separator bg-canvas/60 hover:bg-canvas"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              "text-[16px] font-semibold truncate",
                              isSelected ? "text-accent-strong" : "text-label"
                            )}
                          >
                            {h.name}
                          </span>
                          <Pill
                            tone={isSelected ? "accent" : "neutral"}
                            className="text-[12px] shrink-0"
                          >
                            {h.kind === "government" ? "Government" : "Private"}
                          </Pill>
                        </div>
                        <p className="mt-0.5 text-[15px] text-label-3 truncate">
                          {h.city}
                          {h.address ? ` · ${h.address}` : ""}
                        </p>
                      </div>

                      {isSelected && (
                        <span
                          className="ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white"
                          aria-hidden="true"
                        >
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {/* OPD Timings (Live lookup via TinyFish) */}
          {selectedHospitalId && (
            <Card className="border border-separator bg-surface">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Pill tone="accent">Live OPD info</Pill>
                  {opdInfo?.cached && <Pill tone="neutral">Cached</Pill>}
                </div>
                <span className="text-[13px] text-label-3">
                  Verified OPD registration timings
                </span>
              </div>

              {infoMutation.isPending ? (
                <div className="space-y-2 py-1">
                  <SkeletonLine className="h-4 w-3/4" />
                  <SkeletonLine className="h-4 w-1/2" />
                </div>
              ) : opdInfo && opdInfo.opd.length > 0 ? (
                <div className="space-y-1.5 divide-y divide-separator/50 text-[15px]">
                  {opdInfo.opd.map((slot, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap items-baseline justify-between gap-2 pt-1.5 first:pt-0"
                    >
                      <span className="font-semibold text-label">
                        {slot.department}
                      </span>
                      <span className="text-label-2">
                        {slot.days} ({slot.timings})
                      </span>
                    </div>
                  ))}
                  {opdInfo.notes && (
                    <p className="pt-2 text-[14px] italic text-label-3">
                      Note: {opdInfo.notes}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[15px] text-label-3">Not found</p>
              )}
            </Card>
          )}

          {/* 2. Select OPD Department */}
          <Card>
            <CardHeader
              title="2. Select OPD Department"
              trailing={
                departments.length > 0 ? (
                  <span>{departments.length} departments</span>
                ) : undefined
              }
            />

            {deptLoading ? (
              <div className="space-y-3 pt-1">
                <SkeletonLine className="h-10 w-full" />
                <SkeletonLine className="h-10 w-3/4" />
              </div>
            ) : deptError ? (
              <ErrorState
                title="Couldn't load departments"
                body="Please try again or select another hospital."
                onRetry={() => refetchHospital()}
              />
            ) : departments.length === 0 ? (
              <EmptyState
                title="No departments listed"
                body="No OPD departments are currently registered for this hospital."
              />
            ) : (
              <div
                className="flex flex-wrap gap-2.5"
                role="radiogroup"
                aria-label="OPD Departments"
              >
                {departments.map((dept) => {
                  const isSelected = dept.id === selectedDeptId;
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      aria-label={`Select department ${dept.name}`}
                      onClick={() => setUserDeptId(dept.id)}
                      className={cn(
                        "inline-flex min-h-[44px] items-center justify-center rounded-full px-4 text-[15px] font-medium transition-all active:scale-[0.97]",
                        isSelected
                          ? "bg-accent font-semibold text-white shadow-sm"
                          : "border border-separator bg-canvas/70 text-label-2 hover:bg-canvas hover:text-label"
                      )}
                    >
                      {dept.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 border-t border-separator pt-3">
              <ButtonLink
                href="/triage"
                variant="secondary"
                size="sm"
                icon={
                  <Sparkles
                    className="h-4 w-4 text-accent-strong"
                    aria-hidden="true"
                  />
                }
              >
                Not sure which department? Try Symptom Triage
              </ButtonLink>
            </div>
          </Card>

          {/* 3. Appointment Date & Token Availability */}
          <Card>
            <CardHeader title="3. Appointment Date & Token Availability" />

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAppointmentDate(dateDefaults.today)}
                aria-pressed={appointmentDate === dateDefaults.today}
                aria-label={`Select today, ${dateDefaults.today}`}
                className={cn(
                  "inline-flex min-h-[44px] flex-1 items-center justify-center rounded-row border px-4 text-[15px] transition-colors active:scale-[0.98]",
                  appointmentDate === dateDefaults.today
                    ? "border-accent bg-accent text-white font-semibold"
                    : "border-separator bg-fill text-label-2 hover:bg-fill-strong"
                )}
              >
                Today ({dateDefaults.today})
              </button>
              <button
                type="button"
                onClick={() => setAppointmentDate(dateDefaults.tomorrow)}
                aria-pressed={appointmentDate === dateDefaults.tomorrow}
                aria-label={`Select tomorrow, ${dateDefaults.tomorrow}`}
                className={cn(
                  "inline-flex min-h-[44px] flex-1 items-center justify-center rounded-row border px-4 text-[15px] transition-colors active:scale-[0.98]",
                  appointmentDate === dateDefaults.tomorrow
                    ? "border-accent bg-accent text-white font-semibold"
                    : "border-separator bg-fill text-label-2 hover:bg-fill-strong"
                )}
              >
                Tomorrow ({dateDefaults.tomorrow})
              </button>
            </div>

            <Field
              id="appointment-date-input"
              label="Custom appointment date"
              type="date"
              min={dateDefaults.today}
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
              hint="Select today or an upcoming weekday."
            />

            {/* Real-time token count card */}
            <div className="mt-4 rounded-card border border-separator bg-canvas/50 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-semibold text-label">
                  Live token availability
                </span>
                {tokensLoading ? (
                  <SkeletonLine className="h-5 w-24" />
                ) : tokensError ? (
                  <Pill tone="warn">Availability check failed</Pill>
                ) : !tokensData ? (
                  <Pill tone="neutral">Select department</Pill>
                ) : !tokensData.opd_open ? (
                  <Pill tone="danger">OPD closed</Pill>
                ) : tokensData.tokens_left <= 0 ? (
                  <Pill tone="warn">All tokens issued</Pill>
                ) : (
                  <Pill tone="ok">{tokensData.tokens_left} tokens left</Pill>
                )}
              </div>

              <div className="mt-2 text-[15px] text-label-2">
                {tokensLoading ? (
                  <p>Checking real-time OPD token availability with the hospital database…</p>
                ) : tokensError ? (
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-warn">
                      Could not verify token availability for this date.
                    </p>
                    <button
                      type="button"
                      onClick={() => refetchTokens()}
                      className="text-[14px] font-semibold text-accent-strong hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                ) : !tokensData ? (
                  <p>Please select a department to check available tokens.</p>
                ) : !tokensData.opd_open ? (
                  <p className="text-danger-text">
                    The OPD is closed for {selectedDeptObj?.name || "this department"} on{" "}
                    {appointmentDate}. Please choose another date.
                  </p>
                ) : tokensData.tokens_left <= 0 ? (
                  <p className="text-warn">
                    All {tokensData.daily_token_limit} daily OPD tokens have been issued for{" "}
                    {appointmentDate}. Please choose another date.
                  </p>
                ) : (
                  <p className="text-label-2">
                    <strong>{tokensData.tokens_left}</strong> of{" "}
                    <strong>{tokensData.daily_token_limit}</strong> tokens are currently available
                    for {selectedDeptObj?.name || "this department"} on {appointmentDate}.
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* 4. Reason for Visit (Optional) */}
          <Card>
            <CardHeader title="4. Reason for Visit (Optional)" />
            <Field
              id="appointment-reason-input"
              label="Reason for consultation"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Blood sugar checkup, cough, routine follow-up"
              hint="Briefly describe your symptoms or visit purpose."
            />
          </Card>

          {/* Review & Book Action */}
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full text-[17px] font-semibold"
              disabled={!canBook}
              onClick={handleOpenReview}
            >
              Review & book token
            </Button>
            {!canBook && (
              <p className="mt-2 text-center text-[15px] text-label-3">
                {!selectedHospitalId
                  ? "Please select a hospital to proceed."
                  : !selectedDeptId
                  ? "Please select a department to proceed."
                  : isDateInPast
                  ? "Appointment date cannot be in the past."
                  : isOpdClosed
                  ? "OPD is closed on this date. Select another date to book."
                  : isLimitReached
                  ? "All tokens issued for this date. Select another date to book."
                  : "Complete the selections above to issue an OPD token."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Sheet */}
      <Sheet
        open={isSheetOpen}
        onClose={() => {
          if (!bookMutation.isPending) {
            setIsSheetOpen(false);
            setBookingError(null);
          }
        }}
        title="Confirm OPD token booking"
        footer={
          <div className="flex w-full flex-col-reverse sm:flex-row items-center justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => setIsSheetOpen(false)}
              disabled={bookMutation.isPending}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleConfirmBooking}
              disabled={bookMutation.isPending}
              className="w-full sm:w-auto"
            >
              {bookMutation.isPending ? "Issuing token…" : "Confirm & issue token"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2">
          <p className="text-[15px] text-label-2">
            Please review your OPD token booking details before confirming:
          </p>

          <div className="rounded-card border border-separator bg-canvas/60 p-4 space-y-2.5 text-[15px]">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-label-3">Hospital:</span>
              <span className="font-semibold text-right text-label">
                {selectedHospital?.name}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2 border-t border-separator/60 pt-2">
              <span className="font-medium text-label-3">Department:</span>
              <span className="font-semibold text-right text-label">
                {selectedDeptObj?.name}
              </span>
            </div>
            <div className="flex items-start justify-between gap-2 border-t border-separator/60 pt-2">
              <span className="flex items-center gap-1.5 font-medium text-label-3">
                <Calendar className="h-4 w-4 shrink-0 text-label-3" aria-hidden="true" />
                Date:
              </span>
              <span className="font-semibold text-label">{appointmentDate}</span>
            </div>
            {reason.trim() ? (
              <div className="flex items-start justify-between gap-2 border-t border-separator/60 pt-2">
                <span className="font-medium text-label-3">Reason:</span>
                <span className="text-right text-label-2">{reason.trim()}</span>
              </div>
            ) : null}
            {tokensData && (
              <div className="flex items-center justify-between gap-2 border-t border-separator/60 pt-2">
                <span className="font-medium text-label-3">Tokens remaining:</span>
                <Pill tone="ok">{tokensData.tokens_left} left</Pill>
              </div>
            )}
          </div>

          <div className="rounded-card bg-fill p-3.5 space-y-1 text-[15px]">
            <div className="flex items-center gap-1.5 font-semibold text-label">
              <Clock className="h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
              Arrival instructions
            </div>
            <p className="text-label-2">
              Please arrive at the registration counter by 8:30 AM on {appointmentDate} to claim your slot.
            </p>
          </div>

          {bookingError && (
            <div
              role="alert"
              className="rounded-card border border-danger-soft bg-danger-soft/30 p-3.5 text-[15px] text-danger-text space-y-1"
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                Booking refusal
              </div>
              <p>{bookingError}</p>
            </div>
          )}
        </div>
      </Sheet>
    </div>
  );
}
