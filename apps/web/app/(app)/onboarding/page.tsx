"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAddCondition,
  useAddContact,
  useCompleteOnboarding,
  useConditions,
  useDepartments,
  useEmergencyContacts,
  useHospitals,
  useMyDoctorProfile,
  useMyProfile,
  useUpsertDoctorProfile,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { Button, Card, EmptyState, Field, Pill, SelectField } from "@/components/ui";
import { SkeletonCard } from "@/components/ui-primitives";

export default function OnboardingPage() {
  const router = useRouter();
  const { showToast } = useVyanaWeb();

  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const {
    data: conditions = [],
    isLoading: conditionsLoading,
    isError: conditionsError,
    refetch: refetchConditions,
  } = useConditions();
  const { data: emergencyContacts = [] } = useEmergencyContacts();
  const { data: doctorProfile } = useMyDoctorProfile();
  const { data: hospitals = [] } = useHospitals();

  const completeOnboardingMutation = useCompleteOnboarding();
  const addConditionMutation = useAddCondition();
  const addEmergencyContactMutation = useAddContact();
  const upsertDoctorMutation = useUpsertDoctorProfile();

  const [fullNameOverride, setFullName] = useState<string | null>(null);
  const [phoneOverride, setPhone] = useState<string | null>(null);
  const [dobOverride, setDob] = useState<string | null>(null);
  const [sexOverride, setSex] = useState<string | null>(null);
  const [bloodGroupOverride, setBloodGroup] = useState<string | null>(null);
  const [cityOverride, setCity] = useState<string | null>(null);
  const [preferredLangOverride, setPreferredLang] = useState<string | null>(null);
  const [allergiesTextOverride, setAllergiesText] = useState<string | null>(null);
  const [newCondition, setNewCondition] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactRel, setContactRel] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fullName = fullNameOverride ?? profile?.full_name ?? "";
  const phone = phoneOverride ?? profile?.phone ?? "";
  const dob = dobOverride ?? profile?.dob ?? "";
  // No invented defaults for sex or blood group (#225): a profile whose gender is not
  // recorded yet showed "Female" (and a save then wrote it back as fact). Empty means
  // "not recorded" and the selects ask for a real choice.
  const sex = sexOverride ?? profile?.gender ?? "";
  const bloodGroup = bloodGroupOverride ?? profile?.blood_group ?? "";
  const city = cityOverride ?? profile?.city ?? "";
  const preferredLang =
    preferredLangOverride ?? profile?.preferred_language ?? "en";
  const allergiesText =
    allergiesTextOverride ?? (profile?.allergies ?? []).join(", ");

  // Doctor onboarding state (hospital + department + reg no)
  const [hospitalIdOverride, setHospitalId] = useState<string>("");
  const hospitalId = hospitalIdOverride || hospitals[0]?.id || "";
  const { data: departments = [] } = useDepartments(hospitalId || undefined);
  const [departmentNameOverride, setDepartmentName] = useState<string>("");
  const departmentName = departmentNameOverride || departments[0]?.name || "";
  const [regNoOverride, setRegNo] = useState<string | null>(null);
  const [stateCouncilOverride, setStateCouncil] = useState<string | null>(null);
  const [specializationOverride, setSpecialization] = useState<string | null>(
    null
  );
  const [yearOfRegOverride, setYearOfReg] = useState<string | null>(null);

  const regNo = regNoOverride ?? doctorProfile?.reg_no ?? "";
  const stateCouncil =
    stateCouncilOverride ?? doctorProfile?.state_council ?? "";
  const specialization =
    specializationOverride ?? doctorProfile?.specialization ?? "";
  const yearOfReg =
    yearOfRegOverride ??
    (doctorProfile?.year_of_registration
      ? String(doctorProfile.year_of_registration)
      : "");

  const role = profile?.role ?? "patient";

  const handleAddConditionClick = async () => {
    const trimmed = newCondition.trim();
    if (!trimmed) return;
    setErrorMsg(null);
    try {
      await addConditionMutation.mutateAsync({
        name: trimmed,
      });
      setNewCondition("");
      showToast(`Added chronic condition: ${trimmed}`, "success");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not add condition"
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const parsedAllergies = allergiesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      await completeOnboardingMutation.mutateAsync({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        dob: dob || null,
        gender: sex || null,
        blood_group: bloodGroup || null,
        city: city.trim() || null,
        preferred_language: preferredLang,
        allergies: parsedAllergies,
      });

      if (role === "doctor") {
        const selectedHosp = hospitals.find((h) => h.id === hospitalId);
        await upsertDoctorMutation.mutateAsync({
          specialization:
            specialization.trim() || departmentName || "General Medicine",
          reg_no: regNo.trim(),
          state_council: stateCouncil.trim(),
          year_of_registration: yearOfReg ? Number(yearOfReg) : null,
          clinic_name: selectedHosp
            ? `${selectedHosp.name}${departmentName ? ` · ${departmentName}` : ""}`
            : departmentName || null,
        });
      }

      if (
        contactName.trim() &&
        contactPhone.trim() &&
        !emergencyContacts.some((c) => c.phone.trim() === contactPhone.trim())
      ) {
        await addEmergencyContactMutation.mutateAsync({
          name: contactName.trim(),
          phone: contactPhone.trim(),
          relation: contactRel.trim() || "Family",
        });
      }

      showToast("Health profile & onboarding saved!", "success");

      if (role === "doctor") {
        router.push("/doctor");
      } else if (role === "admin") {
        router.push("/admin/doctors");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Could not save onboarding profile"
      );
    }
  };

  if (profileLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <SkeletonCard lines={6} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="space-y-6 p-6 sm:p-8">
        <div>
          <Pill tone="accent">
            Account Role: {role.charAt(0).toUpperCase() + role.slice(1)}
          </Pill>
          <h1 className="text-2xl font-bold text-label mt-2">
            {profile?.onboarded ? "Your health profile" : "Complete Your Vyana Onboarding"}
          </h1>
          <p className="text-sm text-label-2 mt-1">
            {profile?.onboarded
              ? "Your Medical ID essentials, allergies, emergency contacts and doctor registration details. Changes save to the same profile the rest of the app reads."
              : "Configure your Medical ID essentials, allergies, emergency contacts, or doctor registration details."}
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-tile border border-danger/30 bg-danger-soft p-3 text-xs font-medium text-danger-text"
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {role === "doctor" && (
            <div className="rounded-card border border-accent/20 bg-accent-soft p-5 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-accent-strong">
                Doctor Credentials · Hospital, Department & NMC Registration
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField
                  id="ob-doc-hosp"
                  label="Hospital"
                  value={hospitalId}
                  onChange={(e) => setHospitalId(e.target.value)}
                >
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.city})
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  id="ob-doc-dept"
                  label="Department"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                >
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.name}>
                      {dept.name}
                    </option>
                  ))}
                </SelectField>

                <Field
                  id="ob-doc-reg"
                  label="NMC / State Council Registration No."
                  type="text"
                  required
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  placeholder="e.g., DMC-45892"
                />

                <Field
                  id="ob-doc-council"
                  label="State Medical Council"
                  type="text"
                  required
                  value={stateCouncil}
                  onChange={(e) => setStateCouncil(e.target.value)}
                  placeholder="e.g., Delhi Medical Council"
                />

                <Field
                  id="ob-doc-spec"
                  label="Specialization"
                  type="text"
                  required
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="e.g., General Medicine"
                />

                <Field
                  id="ob-doc-year"
                  label="Year of Registration"
                  type="number"
                  value={yearOfReg}
                  onChange={(e) => setYearOfReg(e.target.value)}
                  placeholder="2015"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              id="ob-name"
              label="Full Name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />

            <Field
              id="ob-phone"
              label="Mobile Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <Field
              id="ob-dob"
              label="Date of Birth"
              type="date"
              aria-label="Date of birth"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
            />

            <div className="grid grid-cols-2 gap-2">
              <SelectField
                id="ob-sex"
                label="Sex"
                value={sex}
                required
                onChange={(e) => setSex(e.target.value)}
              >
                <option value="" disabled>
                  Select sex
                </option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </SelectField>

              <SelectField
                id="ob-blood"
                label="Blood Group"
                value={bloodGroup}
                required
                onChange={(e) => setBloodGroup(e.target.value)}
              >
                <option value="" disabled>
                  Select blood group
                </option>
                {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(
                  (bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  )
                )}
              </SelectField>
            </div>

            <Field
              id="ob-city"
              label="City"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />

            <SelectField
              id="ob-lang"
              label="Preferred Language"
              value={preferredLang}
              onChange={(e) => setPreferredLang(e.target.value)}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="hinglish">Hinglish</option>
            </SelectField>
          </div>

          <Field
            id="ob-allergies"
            label="Known Drug or Food Allergies (comma-separated, encoded in Medical ID QR)"
            type="text"
            value={allergiesText}
            onChange={(e) => setAllergiesText(e.target.value)}
            placeholder="e.g., Penicillin, Peanuts"
          />

          <div className="rounded-tile border border-separator bg-fill p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-label-3">
              Active Chronic Conditions
            </div>
            <div className="flex flex-wrap gap-2">
              {conditions.map((c) => (
                <Pill key={c.id} tone="accent">
                  {c.name}
                </Pill>
              ))}
              {/* "None recorded" is a fact the page may only state after a successful
                  read (#225): while loading it says so, and on error it offers a retry
                  instead of claiming the patient has no conditions. */}
              {conditionsLoading ? (
                <span className="text-xs text-label-3">
                  Loading your recorded conditions…
                </span>
              ) : conditionsError ? (
                <span className="text-xs text-danger-text">
                  Could not load your conditions.{" "}
                  <button
                    type="button"
                    onClick={() => refetchConditions()}
                    className="font-semibold underline"
                  >
                    Try again
                  </button>
                </span>
              ) : conditions.length === 0 ? (
                <EmptyState className="w-full" title="No chronic conditions recorded yet." />
              ) : null}
            </div>
            <div className="flex gap-2">
              <label htmlFor="ob-new-cond" className="sr-only">
                Add chronic condition
              </label>
              <input
                id="ob-new-cond"
                type="text"
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                placeholder="e.g., Hypothyroidism, Asthma"
                className="flex-1 rounded-row border border-transparent bg-surface px-4 text-[13px] text-label placeholder:text-label-3 outline-none transition-colors focus:border-accent"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={addConditionMutation.isPending}
                onClick={handleAddConditionClick}
              >
                + Add Condition
              </Button>
            </div>
          </div>

          <div className="rounded-tile border border-danger/30 bg-danger-soft p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-danger-text">
              Primary Emergency Contact (Alerted on SOS 108 & Shown on Medical ID)
            </div>
            {emergencyContacts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {emergencyContacts.map((ec) => (
                  <span
                    key={ec.id}
                    className="rounded-full bg-surface border border-danger/30 px-3 py-1 text-xs font-medium text-label"
                  >
                    {ec.name} ({ec.phone}) · {ec.relation}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field
                id="ob-ec-name"
                label="Contact Name"
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Family member name"
              />
              <Field
                id="ob-ec-phone"
                label="Contact Mobile Number"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 00000 00000"
              />
              <Field
                id="ob-ec-rel"
                label="Relationship"
                type="text"
                value={contactRel}
                onChange={(e) => setContactRel(e.target.value)}
                placeholder="Spouse / Parent"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={completeOnboardingMutation.isPending}
            >
              {completeOnboardingMutation.isPending
                ? "Saving Profile…"
                : "Save Profile & Open Portal →"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
