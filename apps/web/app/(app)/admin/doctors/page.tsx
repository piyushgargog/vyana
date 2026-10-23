"use client";

import React, { useEffect, useState } from "react";
import {
  useHospitals,
  useMyProfile,
  type DbDoctor,
  type DbHospital,
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
  Sheet,
  SkeletonLine,
  cn,
} from "@/components/ui";
import { Search } from "lucide-react";

interface DoctorWithRelations extends DbDoctor {
  profile: { full_name: string | null } | null;
  hospitals?: { name: string } | null;
  departments?: { name: string } | null;
}

export default function AdminDoctorsPage() {
  const { supabase } = useVyanaWeb();
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
  const [doctorsAttempt, setDoctorsAttempt] = useState(0);

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
            err instanceof Error ? err.message : "Please try again in a moment."
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
  }, [supabase, doctorsAttempt]);

  // Fetch all hospitals
  const {
    data: hospitals,
    isLoading: hospitalsLoading,
    error: hospitalsError,
    refetch: refetchHospitals,
  } = useHospitals();

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
        subtitle="Administrative oversight of verified medical practitioners and registered hospitals."
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
          Hospitals ({hospitals?.length ?? 0})
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
            <Card>
              <ErrorState
                title="We could not load the doctors list"
                body={doctorsError}
                onRetry={() => {
                  setDoctorsError(null);
                  setDoctorsLoading(true);
                  setDoctorsAttempt((n) => n + 1);
                }}
              />
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
            <CardHeader title="Registered hospitals" />
            <p className="text-[15px] text-label-2">
              OPD timings are checked on each hospital&apos;s own website.
            </p>
          </Card>

          {hospitalsLoading ? (
            <Card className="space-y-3">
              <SkeletonLine className="h-6 w-1/3" />
              <SkeletonLine className="h-10 w-full" />
              <SkeletonLine className="h-10 w-full" />
            </Card>
          ) : hospitalsError ? (
            <Card>
              <ErrorState
                title="We could not load the hospitals list"
                body={hospitalsError.message}
                onRetry={() => refetchHospitals()}
              />
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
                const website =
                  hosp.website && hosp.website.startsWith("https://") ? hosp.website : null;

                return (
                  <Card key={hosp.id} className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-separator pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[17px] font-semibold text-label">
                            {hosp.name}
                          </h3>
                          {hosp.ors_enabled && (
                            <Pill tone="accent">ORS Enabled</Pill>
                          )}
                        </div>
                        <p className="mt-1 text-[13px] text-label-3">
                          {hosp.address}, {hosp.city}
                          {hosp.phone ? ` · Phone: ${hosp.phone}` : ""}
                        </p>
                      </div>

                      {website && (
                        <ButtonLink
                          variant="secondary"
                          href={website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open the hospital&apos;s own website
                        </ButtonLink>
                      )}
                    </div>
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
