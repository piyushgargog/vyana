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
  Field,
  LargeTitle,
  Pill,
  Sheet,
  SkeletonLine,
  TextAreaField,
  cn,
} from "@/components/ui";
import { ExternalLink, Search } from "lucide-react";

/** Where the admin checks a registration by hand: the public Indian Medical Register. */
const NMC_REGISTER_URL =
  "https://www.nmc.org.in/information-desk/indian-medical-register/";

/** The badge words (W3): a doctor is checked by an admin, on a date — or not checked yet. */
function doctorStatusText(doc: DbDoctor): string {
  if (doc.verification_status === "verified") {
    return doc.verified_at
      ? `Checked by Vyana admin on ${doc.verified_at.slice(0, 10)}`
      : "Checked by Vyana admin";
  }
  if (doc.verification_status === "failed") return "Not approved";
  return "Not checked yet";
}

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
  } = useHospitals();

  // The manual doctor check (W3): the admin opens the register, compares the entry by hand,
  // then records what they found. The server side of POST /api/doctors/verify for an admin
  // entry lands in PR S; until then the form posts the fields below and shows the answer.
  const [checkDoctor, setCheckDoctor] = useState<DoctorWithRelations | null>(null);
  const [checkRegNo, setCheckRegNo] = useState("");
  const [checkCouncil, setCheckCouncil] = useState("");
  const [checkYear, setCheckYear] = useState("");
  const [checkNote, setCheckNote] = useState("");
  const [checkBusy, setCheckBusy] = useState(false);

  const openCheck = (doc: DoctorWithRelations) => {
    setCheckDoctor(doc);
    setCheckRegNo(doc.reg_no);
    setCheckCouncil(doc.state_council);
    setCheckYear(doc.year_of_registration ? String(doc.year_of_registration) : "");
    setCheckNote("");
  };

  const submitCheck = async (decision: "approve" | "reject") => {
    if (!checkDoctor || checkBusy) return;
    if (!checkRegNo.trim() || !checkCouncil.trim()) {
      showToast("Enter the registration number and the state council as found", "warning");
      return;
    }
    setCheckBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch("/api/doctors/verify", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          doctor_id: checkDoctor.id,
          decision,
          reg_no: checkRegNo.trim(),
          state_council: checkCouncil.trim(),
          year: checkYear.trim() ? Number(checkYear.trim()) : null,
          note: checkNote.trim(),
        }),
      });
      if (!res.ok) throw new Error(`The server answered ${res.status}`);
      const now = new Date().toISOString();
      setDoctors((prev) =>
        prev.map((d) =>
          d.id === checkDoctor.id
            ? {
                ...d,
                verification_status: decision === "approve" ? "verified" : "failed",
                verified_at: now,
              }
            : d
        )
      );
      showToast(
        decision === "approve"
          ? "Doctor approved — checked by hand against the register"
          : "Doctor rejected — the register entry did not match",
        "success"
      );
      setCheckDoctor(null);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not save the check",
        "error"
      );
    } finally {
      setCheckBusy(false);
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
        subtitle="Administrative oversight of medical practitioners and the hospital records Vyana keeps. Doctor registration is checked by hand against the NMC register."
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
                            {doctorStatusText(doc)}
                          </Pill>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openCheck(doc)}
                            >
                              Check by hand
                            </Button>
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

      {/* TAB 2: HOSPITALS & SAVED OPD HOURS */}
      {activeTab === "hospitals" && (
        <div className="space-y-4">
          <Card>
            <CardHeader title="Hospitals & saved OPD hours" />
            <p className="text-[15px] text-label-2">
              The hospital records and OPD hours Vyana has saved. Nothing here
              is fetched live; the team updates a record by hand when it
              changes.
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
                const hasOpd = opdList.length > 0;

                return (
                  <Card key={hosp.id} className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-separator pb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[17px] font-semibold text-label">
                            {hosp.name}
                          </h3>
                          <Pill tone={hasOpd ? "neutral" : "warn"}>
                            {hasOpd ? "OPD hours saved" : "No OPD hours saved"}
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
                    </div>

                    {/* Saved OPD timings */}
                    {opdList.length > 0 ? (
                      <div>
                        <span className="block text-[13px] font-semibold text-label mb-2">
                          Saved department OPD schedules:
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
                            Saved on: {hosp.opd_info_fetched_at.slice(0, 16).replace("T", " ")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-row bg-warn-soft p-3 text-[13px] text-warn">
                        No OPD hours saved for this hospital yet.
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Manual doctor check */}
      <Sheet
        open={Boolean(checkDoctor)}
        onClose={() => setCheckDoctor(null)}
        title={`Check by hand — ${checkDoctor?.profile?.full_name || "Doctor"}`}
        footer={
          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={checkBusy}
              onClick={() => submitCheck("approve")}
            >
              Approve
            </Button>
            <Button
              variant="destructive"
              size="md"
              className="w-full"
              disabled={checkBusy}
              onClick={() => submitCheck("reject")}
            >
              Reject
            </Button>
          </div>
        }
      >
        {checkDoctor && (
          <div className="space-y-4">
            <p className="text-[15px] text-label-2">
              Open the register, find the entry for{" "}
              <strong className="text-label">{checkDoctor.profile?.full_name || "this doctor"}</strong>,
              and type what it says. The doctor claimed: Reg No{" "}
              <strong className="text-label">{checkDoctor.reg_no}</strong> ·{" "}
              {checkDoctor.state_council}
              {checkDoctor.year_of_registration
                ? ` · ${checkDoctor.year_of_registration}`
                : ""}
              .
            </p>
            <ButtonLink
              href={NMC_REGISTER_URL}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="md"
              className="min-h-[44px] w-full"
              icon={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
            >
              Open the NMC register
            </ButtonLink>
            <Field
              id="check-reg-no"
              label="Registration number, as found"
              value={checkRegNo}
              onChange={(e) => setCheckRegNo(e.target.value)}
              required
            />
            <Field
              id="check-council"
              label="State council, as found"
              value={checkCouncil}
              onChange={(e) => setCheckCouncil(e.target.value)}
              required
            />
            <Field
              id="check-year"
              label="Year of registration, as found"
              type="number"
              value={checkYear}
              onChange={(e) => setCheckYear(e.target.value)}
            />
            <TextAreaField
              id="check-note"
              label="Note (optional)"
              value={checkNote}
              onChange={(e) => setCheckNote(e.target.value)}
              placeholder="What the register showed, in a line"
            />
          </div>
        )}
      </Sheet>

      {/* Verification Evidence Inspector Sheet */}
      <Sheet
        open={Boolean(selectedDoctorForJson)}
        onClose={() => setSelectedDoctorForJson(null)}
        title={`Check record — ${selectedDoctorForJson?.profile?.full_name || "Doctor"}`}
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
                Record of the check (`verification_json`):
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
