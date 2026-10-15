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
import { SkeletonCard } from "@/components/ui-primitives";

export default function DoctorQueuePage() {
  const { showToast } = useVyanaWeb();
  const { data: profile } = useMyProfile();
  const { data: doctorProfile, isLoading: doctorLoading } = useMyDoctorProfile();

  const todayStr = new Date().toISOString().slice(0, 10);
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                OPD Consultation Queue
              </h1>
              {doctorProfile?.verification_status === "verified" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-600" /> Verified Doctor
                </span>
              ) : (
                <Link
                  href="/doctor/verify"
                  className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-800 border border-amber-200 hover:bg-amber-100"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-600" /> NMC Verify Pending
                </Link>
              )}
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              {profile?.full_name ? `Dr. ${profile.full_name.replace(/^Dr\.\s*/i, "")}` : "Doctor Portal"}
              {doctorProfile?.specialization ? ` · ${doctorProfile.specialization}` : ""}
              {doctorProfile?.reg_no ? ` (Reg: ${doctorProfile.reg_no})` : ""}
            </p>
          </div>

          {/* Date Picker Controls */}
          <div className="flex items-center gap-2">
            <label htmlFor="queue-date" className="text-xs font-semibold text-slate-700">
              Queue Date:
            </label>
            <input
              id="queue-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 shadow-sm focus:border-teal-600 focus:bg-white focus:outline-none"
            />
            {selectedDate !== todayStr && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-teal-800 hover:bg-slate-50 shadow-sm"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Department Capacity Banner */}
        {tokensInfo && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-teal-50/70 border border-teal-200 p-3 text-xs text-teal-950">
            <div className="flex items-center gap-2">
              <span className="font-bold text-teal-800">Department Tokens Status:</span>
              <span>
                {tokensInfo.opd_open ? "OPD is OPEN" : "OPD is CLOSED"} for this date
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-white px-2 py-0.5 font-semibold text-teal-900 border border-teal-300">
                {tokensInfo.tokens_left} tokens remaining
              </span>
              <span className="text-teal-700">
                (Limit: {tokensInfo.daily_token_limit} / day)
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Queue Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-xl border p-3.5 text-left transition cursor-pointer ${
            statusFilter === "all"
              ? "border-teal-600 bg-teal-50/80 ring-2 ring-teal-600/20"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <p className="text-xs font-medium text-slate-500">Total in Queue</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">{totalCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("requested")}
          className={`rounded-xl border p-3.5 text-left transition cursor-pointer ${
            statusFilter === "requested"
              ? "border-amber-600 bg-amber-50/80 ring-2 ring-amber-600/20"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <p className="text-xs font-medium text-amber-700">Waiting / Requested</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-amber-900">{requestedCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("confirmed")}
          className={`rounded-xl border p-3.5 text-left transition cursor-pointer ${
            statusFilter === "confirmed"
              ? "border-blue-600 bg-blue-50/80 ring-2 ring-blue-600/20"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <p className="text-xs font-medium text-blue-700">Called / Confirmed</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-blue-900">{confirmedCount}</p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("completed")}
          className={`rounded-xl border p-3.5 text-left transition cursor-pointer ${
            statusFilter === "completed"
              ? "border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-600/20"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <p className="text-xs font-medium text-emerald-700">Consultation Done</p>
          <p className="mt-1 text-xl sm:text-2xl font-bold text-emerald-900">{completedCount}</p>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(["all", "requested", "confirmed", "completed"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                statusFilter === st
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

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
            className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none"
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
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
          <p className="font-bold">Failed to load OPD queue</p>
          <p className="mt-1 text-xs">{queueError.message}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-800"
          >
            Retry Loading Queue
          </button>
        </div>
      ) : filteredQueue.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400 text-xl font-bold">
            0
          </div>
          <h3 className="mt-3 text-base font-semibold text-slate-900">
            No patients match this filter
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            {totalCount === 0
              ? `There are no appointments scheduled for ${selectedDate}.`
              : "Try switching filters or clearing your search query."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQueue.map((entry) => {
            const isRequested = entry.status === "requested";
            const isConfirmed = entry.status === "confirmed";
            const isCompleted = entry.status === "completed";

            return (
              <div
                key={entry.id}
                className={`rounded-2xl border p-4 sm:p-5 transition shadow-sm ${
                  isConfirmed
                    ? "border-blue-300 bg-blue-50/30"
                    : isCompleted
                      ? "border-slate-200 bg-white opacity-85"
                      : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  {/* Left: Token & Patient Details */}
                  <div className="flex items-start gap-3.5">
                    <span
                      aria-label={`Token number ${entry.token_no}`}
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-black text-lg ${
                        isConfirmed
                          ? "bg-blue-600 text-white"
                          : isCompleted
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-900 text-white"
                      }`}
                    >
                      #{entry.token_no.toString().padStart(2, "0")}
                    </span>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900">
                          {entry.patient?.full_name || "Patient Record"}
                        </h2>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                            isCompleted
                              ? "bg-emerald-100 text-emerald-800"
                              : isConfirmed
                                ? "bg-blue-100 text-blue-800"
                                : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>

                      <p className="mt-1 text-xs sm:text-sm text-slate-700">
                        <span className="font-semibold text-slate-800">Reason:</span>{" "}
                        {entry.reason || "General consultation / OPD token"}
                      </p>

                      {entry.doctor_notes && (
                        <p className="mt-1.5 text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-2">
                          <span className="font-semibold text-slate-700">Doctor Notes:</span>{" "}
                          {entry.doctor_notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Doctor Actions */}
                  <div className="flex flex-wrap items-center gap-2 sm:self-center">
                    {/* View Patient Summary Button */}
                    <Link
                      href={`/doctor/patients/${entry.patient_id}`}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition shadow-sm"
                    >
                      View Summary
                    </Link>

                    {/* If Requested: Confirm / Call Patient */}
                    {isRequested && (
                      <button
                        type="button"
                        disabled={updateMutation.isPending}
                        onClick={() => handleStatusUpdate(entry.id, "confirmed")}
                        className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
                      >
                        Call Patient
                      </button>
                    )}

                    {/* If Confirmed: Write Prescription & Complete Consultation */}
                    {isConfirmed && (
                      <>
                        <Link
                          href={`/doctor/appointments/${entry.id}/prescribe`}
                          className="rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-teal-800 transition shadow-sm"
                        >
                          Write e-Rx
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleOpenCompleteModal(entry)}
                          className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm"
                        >
                          Complete Visit
                        </button>
                      </>
                    )}

                    {/* If Completed: Write / View Rx */}
                    {isCompleted && (
                      <Link
                        href={`/doctor/appointments/${entry.id}/prescribe`}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                      >
                        Prescriptions
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Complete Consultation Notes Modal */}
      {completingEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="complete-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 id="complete-modal-title" className="text-lg font-bold text-slate-900">
              Complete Consultation — Token #{completingEntry.token_no}
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Patient: {completingEntry.patient?.full_name || "Patient Record"}
            </p>

            <div className="mt-4">
              <label htmlFor="doctor-notes-input" className="block text-xs font-bold text-slate-800 mb-1">
                Doctor Consultation Notes (optional):
              </label>
              <textarea
                id="doctor-notes-input"
                rows={3}
                value={doctorNotes}
                onChange={(e) => setDoctorNotes(e.target.value)}
                placeholder="Clinical observations, diagnostic impression, advice given…"
                className="w-full rounded-xl border border-slate-300 p-3 text-xs sm:text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setCompletingEntry(null)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updateMutation.isPending}
                onClick={() =>
                  handleStatusUpdate(completingEntry.id, "completed", doctorNotes)
                }
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm"
              >
                {updateMutation.isPending ? "Saving…" : "Mark Completed"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
