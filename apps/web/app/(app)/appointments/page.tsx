"use client";

import React, { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  useMyAppointments,
  useUpdateAppointment,
  type MyAppointment,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  LargeTitle,
  ListGroup,
  ListRow,
  Pill,
  Sheet,
  SkeletonLine,
} from "@/components/ui";

function getLocalTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatAppointmentDate(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return dateStr;
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statusPill(status: string): { label: string; tone: "ok" | "warn" | "neutral" } {
  switch (status.toLowerCase()) {
    case "confirmed":
      return { label: "Confirmed", tone: "ok" };
    case "requested":
      return { label: "Requested", tone: "warn" };
    case "completed":
      return { label: "Completed", tone: "neutral" };
    case "cancelled":
    default:
      return { label: "Cancelled", tone: "neutral" };
  }
}

export default function AppointmentsPage() {
  const { showToast } = useVyanaWeb();
  const todayStr = useMemo(() => getLocalTodayDateString(), []);

  const {
    data: appointments = [],
    isLoading,
    isError,
    refetch,
  } = useMyAppointments();

  const updateMutation = useUpdateAppointment();

  const [selectedToken, setSelectedToken] = useState<MyAppointment | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const { upcoming, past } = useMemo(() => {
    const up: MyAppointment[] = [];
    const p: MyAppointment[] = [];

    for (const appt of appointments) {
      const isUpcoming =
        (appt.status === "requested" || appt.status === "confirmed") &&
        appt.appointment_date >= todayStr;

      if (isUpcoming) {
        up.push(appt);
      } else {
        p.push(appt);
      }
    }

    // Sort upcoming soonest first
    up.sort((a, b) => {
      const dateCmp = a.appointment_date.localeCompare(b.appointment_date);
      if (dateCmp !== 0) return dateCmp;
      return a.token_no - b.token_no;
    });

    // Sort past most recent first
    p.sort((a, b) => {
      const dateCmp = b.appointment_date.localeCompare(a.appointment_date);
      if (dateCmp !== 0) return dateCmp;
      return b.token_no - a.token_no;
    });

    return { upcoming: up, past: p };
  }, [appointments, todayStr]);

  const handleConfirmCancel = async () => {
    if (!selectedToken) return;
    setCancelError(null);

    try {
      await updateMutation.mutateAsync({
        id: selectedToken.id,
        status: "cancelled",
      });
      setSelectedToken(null);
      showToast("Token cancelled", "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not cancel the appointment";
      setCancelError(message);
    }
  };

  const hasAnyAppointments = appointments.length > 0;

  // One primary button per screen: the empty state and the no-upcoming card
  // each render their own primary "Book a token", so the header action is
  // suppressed whenever one of those is on screen.
  const inlinePrimaryShown =
    !isLoading && !isError && (!hasAnyAppointments || upcoming.length === 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <LargeTitle
        title="My appointments"
        actions={
          inlinePrimaryShown ? undefined : (
            <ButtonLink href="/appointments/book" variant="primary" size="md">
              Book a token
            </ButtonLink>
          )
        }
      />

      {isLoading ? (
        <Card>
          <div className="space-y-4 py-2">
            <SkeletonLine className="h-6 w-32" />
            <SkeletonLine className="h-12 w-full" />
            <SkeletonLine className="h-12 w-full" />
          </div>
        </Card>
      ) : isError ? (
        <Card>
          <ErrorState onRetry={() => refetch()} />
        </Card>
      ) : !hasAnyAppointments ? (
        <Card>
          <EmptyState
            title="No appointments yet"
            body="Book an OPD token at a hospital near you."
            action={
              <ButtonLink href="/appointments/book" variant="primary">
                Book a token
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Upcoming Card */}
          <Card>
            <CardHeader title="Upcoming" />
            {upcoming.length === 0 ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
                <p className="text-[15px] text-label-2">No upcoming tokens.</p>
                <ButtonLink href="/appointments/book" variant="primary" size="sm" className="min-h-[44px]">
                  Book a token
                </ButtonLink>
              </div>
            ) : (
              <ListGroup className="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6">
                {upcoming.map((appt) => {
                  const hospitalName = appt.hospitals?.name ?? "Hospital not found";
                  const departmentName = appt.departments?.name ?? "Department not found";
                  const formattedDate = formatAppointmentDate(appt.appointment_date);
                  const pill = statusPill(appt.status);

                  return (
                    <ListRow
                      key={appt.id}
                      className="[&_span]:whitespace-normal items-start py-3"
                      title={
                        <span className="block">
                          <span className="block text-[17px] font-semibold text-label">
                            {hospitalName}
                          </span>
                          {appt.hospitals?.address ? (
                            <span className="block text-[15px] text-label-3">
                              {appt.hospitals.address}
                            </span>
                          ) : null}
                        </span>
                      }
                      subtitle={
                        <span className="block pt-0.5">
                          <span className="block text-[15px] text-label-2">
                            {departmentName} · Token {appt.token_no} · {formattedDate}
                          </span>
                          {appt.reason && appt.reason.trim() ? (
                            <span className="block text-[15px] text-label-3">
                              Reason: {appt.reason.trim()}
                            </span>
                          ) : null}
                        </span>
                      }
                      trailing={
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          <Pill tone={pill.tone}>{pill.label}</Pill>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="min-h-[44px]"
                            onClick={() => {
                              setCancelError(null);
                              setSelectedToken(appt);
                            }}
                          >
                            Cancel token
                          </Button>
                        </div>
                      }
                    />
                  );
                })}
              </ListGroup>
            )}
          </Card>

          {/* Past Card */}
          {past.length > 0 && (
            <Card>
              <CardHeader title="Past" />
              <ListGroup className="-mx-5 -mb-5 sm:-mx-6 sm:-mb-6">
                {past.map((appt) => {
                  const hospitalName = appt.hospitals?.name ?? "Hospital not found";
                  const departmentName = appt.departments?.name ?? "Department not found";
                  const formattedDate = formatAppointmentDate(appt.appointment_date);
                  const pill = statusPill(appt.status);

                  return (
                    <ListRow
                      key={appt.id}
                      className="[&_span]:whitespace-normal items-start py-3"
                      title={
                        <span className="block">
                          <span className="block text-[17px] font-semibold text-label">
                            {hospitalName}
                          </span>
                          {appt.hospitals?.address ? (
                            <span className="block text-[15px] text-label-3">
                              {appt.hospitals.address}
                            </span>
                          ) : null}
                        </span>
                      }
                      subtitle={
                        <span className="block pt-0.5">
                          <span className="block text-[15px] text-label-2">
                            {departmentName} · Token {appt.token_no} · {formattedDate}
                          </span>
                          {appt.reason && appt.reason.trim() ? (
                            <span className="block text-[15px] text-label-3">
                              Reason: {appt.reason.trim()}
                            </span>
                          ) : null}
                        </span>
                      }
                      trailing={
                        <div className="flex shrink-0 items-center gap-2">
                          <Pill tone={pill.tone}>{pill.label}</Pill>
                        </div>
                      }
                    />
                  );
                })}
              </ListGroup>
            </Card>
          )}
        </div>
      )}

      {/* Cancel Confirmation Sheet */}
      <Sheet
        open={Boolean(selectedToken)}
        onClose={() => {
          if (!updateMutation.isPending) {
            setSelectedToken(null);
            setCancelError(null);
          }
        }}
        title="Cancel this token?"
        footer={
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 w-full">
            <Button
              variant="secondary"
              size="lg"
              disabled={updateMutation.isPending}
              onClick={() => {
                setSelectedToken(null);
                setCancelError(null);
              }}
              className="w-full sm:w-auto text-[15px]"
            >
              Keep token
            </Button>
            <Button
              variant="destructive"
              size="lg"
              icon={
                updateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : undefined
              }
              disabled={updateMutation.isPending}
              onClick={handleConfirmCancel}
              className="w-full sm:w-auto text-[15px]"
            >
              {updateMutation.isPending ? "Cancelling..." : "Cancel token"}
            </Button>
          </div>
        }
      >
        {selectedToken && (
          <div className="space-y-4 py-2">
            <p className="text-[15px] leading-relaxed text-label-2">
              Your token {selectedToken.token_no} at {selectedToken.hospitals?.name ?? "Hospital not found"} on {formatAppointmentDate(selectedToken.appointment_date)} will be released. You can book again afterwards.
            </p>

            {cancelError && (
              <div className="pt-1">
                <Pill tone="warn">{cancelError}</Pill>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
