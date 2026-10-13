"use client";

import React, { useEffect, useState } from "react";
import {
  useHospitalInfo,
  useHospitals,
  useMyProfile,
  type DbDoctor,
  type DbHospital,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { SkeletonCard } from "@/components/ui-primitives";

interface DoctorWithRelations extends DbDoctor {
  profile: { full_name: string | null } | null;
  hospitals?: { name: string } | null;
  departments?: { name: string } | null;
}

export default function AdminDoctorsPage() {
  const { supabase, showToast } = useVyanaWeb();
  const { data: myProfile } = useMyProfile();

  const [activeTab, setActiveTab] = useState<"doctors" | "hospitals">("doctors");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "verified" | "pending" | "failed"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Inspecting verification JSON
  const [selectedDoctorForJson, setSelectedDoctorForJson] =
    useState<DoctorWithRelations | null>(null);

  // Doctors data state
  const [doctors, setDoctors] = useState<DoctorWithRelations[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const { data, error } = await supabase
          .from("doctors")
          .select(
            "*, profile:profiles!doctors_id_fkey(full_name), hospitals(name), departments(name)"
          )
          .order("created_at", { ascending: false });
        if (ignore) return;
        if (error) throw error;
        setDoctors((data ?? []) as DoctorWithRelations[]);
      } catch (err) {
        if (!ignore) {
          setDoctorsError(
            err instanceof Error ? err.message : "Failed to load doctors"
          );
        }
      } finally {
        if (!ignore) {
          setDoctorsLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [supabase]);

  // Fetch all hospitals
  const {
    data: hospitals,
    isLoading: hospitalsLoading,
    error: hospitalsError,
    refetch: refetchHospitals,
  } = useHospitals();

  // Mutation to verify hospital OPD info via TinyFish
  const hospitalInfoMutation = useHospitalInfo();
  const [verifyingHospitalId, setVerifyingHospitalId] = useState<string | null>(null);

  // Trigger TinyFish Hospital OPD verification
  const handleVerifyHospitalOpd = async (hospitalId: string) => {
    try {
      setVerifyingHospitalId(hospitalId);
      await hospitalInfoMutation.mutateAsync({
        hospital_id: hospitalId,
      });
      showToast(
        "Hospital OPD timings verified and updated via TinyFish.",
        "success"
      );
      await refetchHospitals();
    } catch (err) {
      showToast(
        err instanceof Error
          ? err.message
          : "Could not fetch verified hospital OPD timings",
        "error"
      );
    } finally {
      setVerifyingHospitalId(null);
    }
  };

  const filteredDoctors = doctors.filter((doc: DoctorWithRelations) => {
    if (statusFilter !== "all" && doc.verification_status !== statusFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = doc.profile?.full_name?.toLowerCase() ?? "";
      const reg = doc.reg_no.toLowerCase();
      const spec = doc.specialization.toLowerCase();
      if (!name.includes(q) && !reg.includes(q) && !spec.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white font-bold text-sm">
                Adm
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Doctors & Hospitals Registry
                </h1>
                <p className="text-xs text-slate-500">
                  Administrative oversight of verified medical practitioners and verified hospital OPD timings
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
              Role: Admin ({myProfile?.full_name || "Administrator"})
            </span>
          </div>
        </div>
      </div>

      {/* Primary Section Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-0.5">
        <button
          type="button"
          onClick={() => setActiveTab("doctors")}
          className={`rounded-t-xl px-4 py-2 text-xs font-bold transition border-b-2 ${
            activeTab === "doctors"
              ? "border-teal-700 bg-white text-teal-800 shadow-xs"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          Doctors Registry ({doctors.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("hospitals")}
          className={`rounded-t-xl px-4 py-2 text-xs font-bold transition border-b-2 ${
            activeTab === "hospitals"
              ? "border-teal-700 bg-white text-teal-800 shadow-xs"
              : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          }`}
        >
          Hospital OPD Timings ({hospitals?.length ?? 0})
        </button>
      </div>

      {/* TAB 1: DOCTORS REGISTRY */}
      {activeTab === "doctors" && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(["all", "verified", "pending", "failed"] as const).map((st) => (
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
              <label htmlFor="search-doctors-input" className="sr-only">
                Search doctors
              </label>
              <input
                id="search-doctors-input"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, reg #, specialization…"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Doctors Table */}
          {doctorsLoading ? (
            <SkeletonCard lines={4} />
          ) : doctorsError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
              <p className="font-bold">Failed to load doctors registry</p>
              <p className="mt-1 text-xs">{doctorsError}</p>
            </div>
          ) : filteredDoctors.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500 shadow-sm">
              No doctors matched your filter criteria.
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Doctor Name</th>
                    <th className="py-3 px-4">Registration</th>
                    <th className="py-3 px-4">Specialization</th>
                    <th className="py-3 px-4">Affiliation</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDoctors.map((doc: DoctorWithRelations) => {
                    const isVerified = doc.verification_status === "verified";
                    const isFailed = doc.verification_status === "failed";

                    return (
                      <tr
                        key={doc.id}
                        className="border-b border-slate-100 hover:bg-slate-50/50 transition"
                      >
                        <td className="py-3 px-4 font-bold text-slate-900">
                          {doc.profile?.full_name || "Doctor"}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold">{doc.reg_no}</span>
                          <span className="block text-[11px] text-slate-500">
                            {doc.state_council}
                            {doc.year_of_registration
                              ? ` (${doc.year_of_registration})`
                              : ""}
                          </span>
                        </td>
                        <td className="py-3 px-4">{doc.specialization}</td>
                        <td className="py-3 px-4 text-slate-600">
                          {doc.hospitals?.name || "Independent Practice"}
                          {doc.departments?.name ? ` · ${doc.departments.name}` : ""}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              isVerified
                                ? "bg-emerald-100 text-emerald-900"
                                : isFailed
                                  ? "bg-red-100 text-red-900"
                                  : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {doc.verification_status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {doc.verification_json && (
                              <button
                                type="button"
                                onClick={() => setSelectedDoctorForJson(doc)}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                View Evidence
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: HOSPITALS & VERIFIED OPD HOURS */}
      {activeTab === "hospitals" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Hospital OPD Operating Hours & Verification
              </h2>
              <p className="text-xs text-slate-500">
                Verified hospital hours sourced directly via TinyFish autonomous web agents.
              </p>
            </div>
          </div>

          {hospitalsLoading ? (
            <SkeletonCard lines={4} />
          ) : hospitalsError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
              <p className="font-bold">Failed to load hospitals</p>
              <p className="mt-1 text-xs">{hospitalsError.message}</p>
            </div>
          ) : !hospitals || hospitals.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500 shadow-sm">
              No hospitals currently registered.
            </div>
          ) : (
            <div className="space-y-3">
              {hospitals.map((hosp: DbHospital) => {
                const opdInfo = hosp.opd_info as
                  | { opd?: Array<{ department?: string; days?: string; timings?: string }> }
                  | Array<{ department?: string; days?: string; timings?: string }>
                  | null;
                const opdList = Array.isArray((opdInfo as { opd?: Array<{ department?: string; days?: string; timings?: string }> })?.opd)
                  ? (opdInfo as { opd: Array<{ department?: string; days?: string; timings?: string }> }).opd
                  : Array.isArray(opdInfo)
                    ? (opdInfo as Array<{ department?: string; days?: string; timings?: string }>)
                    : [];
                const isVerifying = verifyingHospitalId === hosp.id;
                const isVerified = opdList.length > 0;

                return (
                  <div
                    key={hosp.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">
                            {hosp.name}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              isVerified
                                ? "bg-emerald-100 text-emerald-900"
                                : "bg-amber-100 text-amber-900"
                            }`}
                          >
                            {isVerified ? "Verified OPD Hours" : "Unverified / Pending"}
                          </span>
                          {hosp.ors_enabled && (
                            <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                              ORS Enabled
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {hosp.address}, {hosp.city}
                          {hosp.phone ? ` · Phone: ${hosp.phone}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isVerifying}
                          onClick={() => handleVerifyHospitalOpd(hosp.id)}
                          className="rounded-xl border border-teal-600 bg-teal-50 px-3.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 transition shadow-xs disabled:opacity-60"
                        >
                          {isVerifying ? "Verifying with TinyFish…" : "Refresh / Verify OPD"}
                        </button>
                      </div>
                    </div>

                    {/* Verified OPD Timings Details */}
                    {opdList.length > 0 ? (
                      <div>
                        <span className="text-xs font-bold text-slate-700 block mb-1.5">
                          Verified Department OPD Schedules:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          {opdList.map((entry: { department?: string; days?: string; timings?: string }, i: number) => (
                            <div
                              key={i}
                              className="rounded-xl bg-slate-50 border border-slate-200 p-2.5"
                            >
                              <strong className="text-slate-900 block font-semibold">
                                {entry.department || "General OPD"}
                              </strong>
                              <span className="text-slate-600 block text-[11px]">
                                {entry.days || "Mon–Sat"}
                              </span>
                              <span className="text-teal-800 font-bold block text-[11px]">
                                {entry.timings || "8:00 AM – 1:00 PM"}
                              </span>
                            </div>
                          ))}
                        </div>

                        {hosp.opd_info_fetched_at && (
                          <p className="mt-2 text-[10px] text-slate-400">
                            Last verified on: {hosp.opd_info_fetched_at.slice(0, 16).replace("T", " ")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        No verified OPD hours on record for this hospital yet. Click &quot;Refresh / Verify OPD&quot; to query the official hospital directory via TinyFish.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Verification Evidence Inspector Modal */}
      {selectedDoctorForJson && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="evidence-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 id="evidence-modal-title" className="text-base font-bold text-slate-900">
              NMC Verification Evidence — {selectedDoctorForJson.profile?.full_name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Reg No: {selectedDoctorForJson.reg_no} · {selectedDoctorForJson.state_council}
            </p>

            <div className="mt-4">
              <span className="text-xs font-bold text-slate-800 block mb-1">
                Server Registry Evidence Log (`verification_json`):
              </span>
              <pre className="max-h-64 overflow-y-auto rounded-xl bg-slate-900 p-3 text-[11px] text-emerald-300 font-mono">
                {JSON.stringify(selectedDoctorForJson.verification_json, null, 2)}
              </pre>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDoctorForJson(null)}
                className="rounded-xl border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
