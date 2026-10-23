"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  useDoctorQueue,
  useMyDoctorProfile,
  useMyProfile,
  useTokensLeft,
  useUpdateAppointment,
  type QueueEntry,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import {
  Button,
  ButtonLink,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  ErrorState,
  Pill,
  Sheet,
  TextAreaField,
} from "@/components/ui";
import { SkeletonCard } from "@/components/ui-primitives";

export default function DoctorQueuePage() {
  const { showToast } = useVyanaWeb();
  const { data: profile } = useMyProfile();
  const { data: doctorProfile, isLoading: doctorLoading } = useMyDoctorProfile();

  // The queue day is the DOCTOR's local day. toISOString() is UTC, which in India is
  // still yesterday until 05:30 — the date defaulted to yesterday every morning (#225).
  const nowLocal = new Date();
  const todayStr = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, "0")}-${String(nowLocal.getDate()).padStart(2, "0")}`;
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState<"all" | "requested" | "confirmed" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Notes modal for completing appointment
  const [completingEntry, setCompletingEntry] = useState<QueueEntry | null>(null);
  const [doctorNotes, setDoctorNotes] = useState("");

  const {
    data: queue,
    isLoading: queueLoading,
    error: queueError,
    refetch,
  } = useDoctorQueue(selectedDate);

  const { data: tokensInfo } = useTokensLeft(
    doctorProfile?.department_id ?? undefined,
    selectedDate
  );

  const updateMutation = useUpdateAppointment();

  const handleStatusUpdate = async (
    id: string,
    status: "confirmed" | "completed",
    notes?: string
  ) => {
    try {
      await updateMutation.mutateAsync({
        id,
        status,
        doctor_notes: notes,
      });
      showToast(
        status === "confirmed"
          ? "Patient called & appointment confirmed."
          : "Consultation marked as completed.",
        "success"
      );
      if (completingEntry) {
        setCompletingEntry(null);
        setDoctorNotes("");
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not update appointment status",
        "error"
      );
    }
  };

  const handleOpenCompleteModal = (entry: QueueEntry) => {
    setCompletingEntry(entry);
    setDoctorNotes(entry.doctor_notes ?? "");
  };

  const filteredQueue = (queue ?? []).filter((entry) => {
    if (statusFilter !== "all" && entry.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = entry.patient?.full_name?.toLowerCase() ?? "";
      const token = entry.token_no.toString();
      const reason = entry.reason?.toLowerCase() ?? "";
      if (!name.includes(q) && !token.includes(q) && !reason.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const totalCount = queue?.length ?? 0;
  const requestedCount = queue?.filter((e) => e.status === "requested").length ?? 0;
  const confirmedCount = queue?.filter((e) => e.status === "confirmed").length ?? 0;
  const completedCount = queue?.filter((e) => e.status === "completed").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-label">
                OPD Consultation Queue
              </h1>
              {doctorProfile?.verification_status === "verified" ? (
                <Pill tone="ok" icon={<span className="h-2 w-2 rounded-full bg-ok" />}>
                  Verified Doctor
                </Pill>
              ) : (
                <Link
                  href="/doctor/verify"
                  className="inline-flex min-h-11 items-center rounded-full px-1 py-1"
                >
                  <Pill tone="warn" icon={<span className="h-2 w-2 rounded-full bg-warn" />}>
                    NMC Verify Pending
                  </Pill>
                </Link>
              )}
            </div>
            <p className="mt-1 text-xs sm:text-sm text-label-2">
              {profile?.full_name ? `Dr. ${profile.full_name.replace(/^Dr\.\s*/i, "")}` : "Doctor Portal"}
              {doctorProfile?.specialization ? ` · ${doctorProfile.specialization}` : ""}
              {doctorProfile?.reg_no ? ` (Reg: ${doctorProfile.reg_no})` : ""}
            </p>
          </div>

          {/* Date Picker Controls */}
          <div className="flex items-center gap-2">
            <label htmlFor="queue-date" className="text-xs font-semibold text-label-2">
              Queue Date:
            </label>
            <input
              id="queue-date"
              type="date"
              aria-label="Queue date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-row border border-transparent bg-fill px-3 py-1.5 text-xs sm:text-sm font-semibold text-label outline-none transition-colors focus:border-accent focus:bg-surface"
            />
            {selectedDate !== todayStr && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectedDate(todayStr)}
              >
                Today
              </Button>
            )}
          </div>
        </div>

        {/* Department Capacity Banner */}
        {tokensInfo && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-tile bg-accent-soft border border-accent/20 p-3 text-xs text-label">
            <div className="flex items-center gap-2">
              <span className="font-bold text-accent-strong">Department Tokens Status:</span>
              <span>
                {tokensInfo.opd_open ? "OPD is OPEN" : "OPD is CLOSED"} for this date
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone="accent">{tokensInfo.tokens_left} tokens remaining</Pill>
              <span className="text-label-2">
                (Limit: {tokensInfo.daily_token_limit} / day)
              </span>
            </div>
          </div>
        )}
      </Card>

      {/* Queue Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-tile border p-3.5 text-left transition cursor-pointer ${
            statusFilter === "all"
              ? "border-accent bg-accent-soft ring-2 ring-accent/20"
              : "border-separator bg-surface hover:bg-canvas"
          }`}
        >
          <p className="text-xs font-medium text-label-3">Total in Queue</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-label">{totalCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("requested")}
          className={`rounded-tile border p-3.5 text-left transition cursor-pointer ${
            statusFilter === "requested"
              ? "border-warn bg-warn-soft ring-2 ring-warn/20"
              : "border-separator bg-surface hover:bg-canvas"
          }`}
        >
          <p className="text-xs font-medium text-warn">Waiting / Requested</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-warn">{requestedCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("confirmed")}
          className={`rounded-tile border p-3.5 text-left transition cursor-pointer ${
            statusFilter === "confirmed"
              ? "border-accent bg-accent-soft ring-2 ring-accent/20"
              : "border-separator bg-surface hover:bg-canvas"
          }`}
        >
          <p className="text-xs font-medium text-accent-strong">Called / Confirmed</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-accent-strong">{confirmedCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("completed")}
          className={`rounded-tile border p-3.5 text-left transition cursor-pointer ${
            statusFilter === "completed"
              ? "border-ok bg-ok-soft ring-2 ring-ok/20"
              : "border-separator bg-surface hover:bg-canvas"
          }`}
        >
          <p className="text-xs font-medium text-ok">Consultation Done</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-ok">{completedCount}</p>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <ChipGroup label="Show appointments" className="flex-nowrap overflow-x-auto pb-1 sm:pb-0">
          {(["all", "requested", "confirmed", "completed"] as const).map((st) => (
            <Chip key={st} selected={statusFilter === st} onSelect={() => setStatusFilter(st)} className="shrink-0 capitalize">
              {st}
            </Chip>
          ))}
        </ChipGroup>

        <div className="w-full sm:w-72">
          <label htmlFor="search-queue" className="sr-only">
            Search Queue
          </label>
          <input
            id="search-queue"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient name, token #, reason…"
            className="w-full rounded-row border border-transparent bg-fill px-3.5 py-1.5 text-xs sm:text-sm text-label placeholder:text-label-3 outline-none transition-colors focus:border-accent focus:bg-surface"
          />
        </div>
      </div>

      {/* Queue Entries List */}
      {queueLoading || doctorLoading ? (
        <div className="space-y-3">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : queueError ? (
        <ErrorState
          title="We could not load the OPD queue"
          body={queueError.message}
          onRetry={() => refetch()}
        />
      ) : filteredQueue.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<span className="text-xl font-bold">0</span>}
            title="No patients match this filter"
            body={
              totalCount === 0
                ? `There are no appointments scheduled for ${selectedDate}.`
                : "Try switching filters or clearing your search query."
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredQueue.map((entry) => {
            const isRequested = entry.status === "requested";
            const isConfirmed = entry.status === "confirmed";
            const isCompleted = entry.status === "completed";

            return (
              <Card
                key={entry.id}
                className={`border p-4 sm:p-5 transition ${
                  isConfirmed
                    ? "border-accent/40 bg-accent-soft"
                    : isCompleted
                      ? "border-separator opacity-85"
                      : "border-separator hover:border-label-3/50"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* Left: Token & Patient Details */}
                  <div className="flex items-start gap-3.5">
                    <span
                      aria-label={`Token number ${entry.token_no}`}
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-tile font-black text-lg ${
                        isConfirmed
                          ? "bg-accent text-white"
                          : isCompleted
                            ? "bg-ok text-white"
                            : "bg-label text-white"
                      }`}
                    >
                      #{entry.token_no.toString().padStart(2, "0")}
                    </span>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-label">
                          {entry.patient?.full_name || "Patient Record"}
                        </h2>
                        <Pill
                          tone={
                            isCompleted ? "ok" : isConfirmed ? "accent" : "warn"
                          }
                        >
                          {entry.status}
                        </Pill>
                      </div>

                      <p className="mt-1 text-xs sm:text-sm text-label-2">
                        <span className="font-semibold text-label">Reason:</span>{" "}
                        {entry.reason || "General consultation / OPD token"}
                      </p>

                      {entry.doctor_notes && (
                        <p className="mt-1.5 text-xs text-label-2 bg-fill border border-separator rounded-row p-2">
                          <span className="font-semibold text-label">Doctor Notes:</span>{" "}
                          {entry.doctor_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Doctor Actions */}
                  <div className="flex flex-wrap items-center gap-2 sm:self-center">
                    {/* View Patient Summary Button */}
                    <ButtonLink
                      href={`/doctor/patients/${entry.patient_id}`}
                      variant="secondary"
                      size="sm"
                    >
                      View Summary
                    </ButtonLink>

                    {/* If Requested: Confirm / Call Patient */}
                    {isRequested && (
                      <Button
                        size="sm"
                        disabled={updateMutation.isPending}
                        onClick={() => handleStatusUpdate(entry.id, "confirmed")}
                      >
                        Call Patient
                      </Button>
                    )}

                    {/* If Confirmed: Write Prescription & Complete Consultation */}
                    {isConfirmed && (
                      <>
                        <ButtonLink
                          href={`/doctor/appointments/${entry.id}/prescribe`}
                          size="sm"
                        >
                          Write e-Rx
                        </ButtonLink>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenCompleteModal(entry)}
                        >
                          Complete Visit
                        </Button>
                      </>
                    )}

                    {/* If Completed: Write / View Rx */}
                    {isCompleted && (
                      <ButtonLink
                        href={`/doctor/appointments/${entry.id}/prescribe`}
                        variant="secondary"
                        size="sm"
                      >
                        Prescriptions
                      </ButtonLink>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Complete Consultation Notes Modal */}
      {completingEntry && (
        <Sheet
          open
          onClose={() => setCompletingEntry(null)}
          title={`Complete Consultation — Token #${completingEntry.token_no}`}
          footer={
            <div className="flex justify-end gap-2.5">
              <Button
                variant="secondary"
                onClick={() => setCompletingEntry(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={updateMutation.isPending}
                onClick={() =>
                  handleStatusUpdate(completingEntry.id, "completed", doctorNotes)
                }
              >
                {updateMutation.isPending ? "Saving…" : "Mark Completed"}
              </Button>
            </div>
          }
        >
          <p className="text-xs text-label-2">
            Patient: {completingEntry.patient?.full_name || "Patient Record"}
          </p>

          <div className="mt-4">
            <TextAreaField
              id="doctor-notes-input"
              label="Doctor Consultation Notes (optional):"
              rows={3}
              value={doctorNotes}
              onChange={(e) => setDoctorNotes(e.target.value)}
              placeholder="Clinical observations, diagnostic impression, advice given…"
            />
          </div>
        </Sheet>
      )}
    </div>
  );
}
