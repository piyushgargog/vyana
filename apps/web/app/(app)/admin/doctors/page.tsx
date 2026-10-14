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
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  LargeTitle,
  Pill,
  Sheet,
  SkeletonLine,
  cn,
} from "@/components/ui";
import { Loader2, Search } from "lucide-react";

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

  // Inspecting verification JSON in design system Sheet
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
      <LargeTitle
        eyebrow="Administration"
        title="Doctors & Hospitals Registry"
        subtitle="Administrative oversight of verified medical practitioners and verified hospital OPD timings."
        actions={
          <Pill tone="neutral">
            Admin: {myProfile?.full_name || "Administrator"}
          </Pill>
        }
      />

      {/* Primary Section Switcher */}
      <div className="inline-flex rounded-full bg-fill p-1">
        <button
          type="button"
          onClick={() => setActiveTab("doctors")}
          className={cn(
            "rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors",
            activeTab === "doctors"
              ? "bg-surface text-label shadow-[0_1px_4px_rgb(0_0_0/0.08)]"
              : "text-label-2 hover:text-label"
          )}
        >
          Doctors Registry ({doctors.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("hospitals")}
          className={cn(
            "rounded-full px-4 py-1.5 text-[14px] font-semibold transition-colors",
            activeTab === "hospitals"
              ? "bg-surface text-label shadow-[0_1px_4px_rgb(0_0_0/0.08)]"
              : "text-label-2 hover:text-label"
          )}
        >
          Hospital OPD Timings ({hospitals?.length ?? 0})
        </button>
      </div>

      {/* TAB 1: DOCTORS REGISTRY */}
      {activeTab === "doctors" && (
        <div className="space-y-4">
          {/* Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1 overflow-x-auto rounded-full bg-fill p-1">
              {(["all", "verified", "pending", "failed"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    "rounded-full px-3.5 py-1 text-[13px] font-semibold capitalize transition-colors",
                    statusFilter === st
                      ? "bg-surface text-label shadow-[0_1px_3px_rgb(0_0_0/0.08)]"
                      : "text-label-2 hover:text-label"
                  )}
                >
                  {st}
                </button>
              ))}
            </div>

            <div className="w-full sm:w-72">
              <Field
                id="search-doctors-input"
                label="Search doctors"
                className="[&_label]:sr-only"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, reg #, specialization…"
              />
            </div>
          </div>

          {/* Doctors Table */}
          {doctorsLoading ? (
            <Card className="space-y-3">
              <SkeletonLine className="h-6 w-1/3" />
              <SkeletonLine className="h-10 w-full" />
              <SkeletonLine className="h-10 w-full" />
              <SkeletonLine className="h-10 w-full" />
            </Card>
          ) : doctorsError ? (
            <Card className="border border-danger/30 bg-danger-soft/20 text-danger-text">
              <p className="font-semibold text-[17px]">Failed to load doctors registry</p>
              <p className="mt-1 text-[13px] text-label-2">{doctorsError}</p>
            </Card>
          ) : filteredDoctors.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Search className="h-6 w-6" aria-hidden="true" />}
                title="No doctors match your criteria"
                body="Try adjusting your search terms or selecting a different status filter."
              />
            </Card>
          ) : (
            <Card padded={false} className="overflow-x-auto">
              <table className="w-full text-left text-[14px] text-label border-collapse">
                <thead>
                  <tr className="border-b border-separator bg-fill/50 text-[12px] font-semibold uppercase tracking-wider text-label-3">
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
                        className="border-b border-separator/60 hover:bg-canvas/50 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-label">
                          {doc.profile?.full_name || "Doctor"}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-medium text-label">{doc.reg_no}</span>
                          <span className="block text-[12px] text-label-3">
                            {doc.state_council}
                            {doc.year_of_registration
                              ? ` (${doc.year_of_registration})`
                              : ""}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-label-2">{doc.specialization}</td>
                        <td className="py-3.5 px-4 text-label-2">
                          {doc.hospitals?.name || "Independent Practice"}
                          {doc.departments?.name ? ` · ${doc.departments.name}` : ""}
                        </td>
                        <td className="py-3.5 px-4">
                          <Pill
                            tone={isVerified ? "ok" : isFailed ? "danger" : "warn"}
                          >
                            {doc.verification_status}
                          </Pill>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {doc.verification_json && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedDoctorForJson(doc)}
                              >
                                View Evidence
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}

      {/* TAB 2: HOSPITALS & VERIFIED OPD HOURS */}
      {activeTab === "hospitals" && (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Hospital OPD Operating Hours & Verification"
              trailing={
                <span className="text-[13px] text-label-3">
                  Autonomous Web Query
                </span>
              }
            />
            <p className="text-[15px] text-label-2">
              Verified hospital hours sourced directly via TinyFish autonomous web agents.
            </p>
          </Card>

          {hospitalsLoading ? (
            <Card className="space-y-3">
              <SkeletonLine className="h-6 w-1/3" />
              <SkeletonLine className="h-10 w-full" />
              <SkeletonLine className="h-10 w-full" />
            </Card>
          ) : hospitalsError ? (
            <Card className="border border-danger/30 bg-danger-soft/20 text-danger-text">
              <p className="font-semibold text-[17px]">Failed to load hospitals</p>
              <p className="mt-1 text-[13px] text-label-2">{hospitalsError.message}</p>
            </Card>
          ) : !hospitals || hospitals.length === 0 ? (
            <Card>
              <EmptyState
                title="No hospitals registered"
                body="There are no hospitals currently in the registry."
              />
            </Card>
          ) : (
            <div className="space-y-4">
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
                  <Card key={hosp.id} className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-separator pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[17px] font-semibold text-label">
                            {hosp.name}
                          </h3>
                          <Pill tone={isVerified ? "ok" : "warn"}>
                            {isVerified ? "Verified OPD Hours" : "Unverified / Pending"}
                          </Pill>
                          {hosp.ors_enabled && (
                            <Pill tone="accent">ORS Enabled</Pill>
                          )}
                        </div>
                        <p className="mt-1 text-[13px] text-label-3">
                          {hosp.address}, {hosp.city}
                          {hosp.phone ? ` · Phone: ${hosp.phone}` : ""}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={isVerifying}
                          onClick={() => handleVerifyHospitalOpd(hosp.id)}
                          icon={
                            isVerifying ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : undefined
                          }
                        >
                          {isVerifying ? "Verifying with TinyFish…" : "Refresh / Verify OPD"}
                        </Button>
                      </div>
                    </div>

                    {/* Verified OPD Timings Details */}
                    {opdList.length > 0 ? (
                      <div>
                        <span className="block text-[13px] font-semibold text-label mb-2">
                          Verified Department OPD Schedules:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {opdList.map((entry: { department?: string; days?: string; timings?: string }, i: number) => (
                            <div
                              key={i}
                              className="rounded-row bg-fill/60 p-3"
                            >
                              <strong className="block font-semibold text-[14px] text-label">
                                {entry.department || "General OPD"}
                              </strong>
                              <span className="block text-[12px] text-label-2 mt-0.5">
                                {entry.days || "Mon–Sat"}
                              </span>
                              <span className="block text-[12px] font-semibold text-accent-strong mt-0.5">
                                {entry.timings || "8:00 AM – 1:00 PM"}
                              </span>
                            </div>
                          ))}
                        </div>

                        {hosp.opd_info_fetched_at && (
                          <p className="mt-2 text-[12px] text-label-3">
                            Last verified on: {hosp.opd_info_fetched_at.slice(0, 16).replace("T", " ")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-row bg-warn-soft p-3 text-[13px] text-warn">
                        No verified OPD hours on record for this hospital yet. Click &quot;Refresh / Verify OPD&quot; to query the official hospital directory via TinyFish.
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Verification Evidence Inspector Sheet */}
      <Sheet
        open={Boolean(selectedDoctorForJson)}
        onClose={() => setSelectedDoctorForJson(null)}
        title={`NMC Verification Evidence — ${selectedDoctorForJson?.profile?.full_name || "Doctor"}`}
        footer={
          <div className="flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelectedDoctorForJson(null)}
            >
              Close
            </Button>
          </div>
        }
      >
        {selectedDoctorForJson && (
          <div className="space-y-4">
            <p className="text-[13px] text-label-3">
              Reg No: <span className="font-medium text-label">{selectedDoctorForJson.reg_no}</span> ·{" "}
              {selectedDoctorForJson.state_council}
            </p>

            <div>
              <span className="block text-[13px] font-semibold text-label mb-1.5">
                Server Registry Evidence Log (`verification_json`):
              </span>
              <pre className="max-h-72 overflow-y-auto rounded-row bg-fill p-3 text-[12px] font-mono text-label">
                {JSON.stringify(selectedDoctorForJson.verification_json, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
