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
import { SkeletonCard } from "@/components/ui-primitives";

export default function OnboardingPage() {
  const router = useRouter();
  const { showToast } = useVyanaWeb();

  const { data: profile, isLoading: profileLoading } = useMyProfile();
  const { data: conditions = [] } = useConditions();
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
  const [contactRel, setContactRel] = useState("Family");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fullName = fullNameOverride ?? profile?.full_name ?? "";
  const phone = phoneOverride ?? profile?.phone ?? "";
  const dob = dobOverride ?? profile?.dob ?? "";
  const sex = sexOverride ?? profile?.gender ?? "female";
  const bloodGroup = bloodGroupOverride ?? profile?.blood_group ?? "B+";
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
        gender: sex,
        blood_group: bloodGroup,
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-900 uppercase">
            Account Role: {role}
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">
            Complete Your Vyana Onboarding
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure your Medical ID essentials, allergies, emergency contacts,
            or doctor registration details.
          </p>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800"
          >
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {role === "doctor" && (
            <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-5 space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-900">
                Doctor Credentials · Hospital, Department & NMC Registration
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="ob-doc-hosp"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Hospital
                  </label>
                  <select
                    id="ob-doc-hosp"
                    value={hospitalId}
                    onChange={(e) => setHospitalId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {hospitals.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.city})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ob-doc-dept"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Department
                  </label>
                  <select
                    id="ob-doc-dept"
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="ob-doc-reg"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    NMC / State Council Registration No.
                  </label>
                  <input
                    id="ob-doc-reg"
                    type="text"
                    required
                    value={regNo}
                    onChange={(e) => setRegNo(e.target.value)}
                    placeholder="e.g., DMC-45892"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ob-doc-council"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    State Medical Council
                  </label>
                  <input
                    id="ob-doc-council"
                    type="text"
                    required
                    value={stateCouncil}
                    onChange={(e) => setStateCouncil(e.target.value)}
                    placeholder="e.g., Delhi Medical Council"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ob-doc-spec"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Specialization
                  </label>
                  <input
                    id="ob-doc-spec"
                    type="text"
                    required
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g., General Medicine"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ob-doc-year"
                    className="block text-xs font-semibold text-slate-700 mb-1"
                  >
                    Year of Registration
                  </label>
                  <input
                    id="ob-doc-year"
                    type="number"
                    value={yearOfReg}
                    onChange={(e) => setYearOfReg(e.target.value)}
                    placeholder="2015"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="ob-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Full Name
              </label>
              <input
                id="ob-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="ob-phone"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Mobile Number
              </label>
              <input
                id="ob-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="ob-dob"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Date of Birth
              </label>
              <input
                id="ob-dob"
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="ob-sex"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Sex
                </label>
                <select
                  id="ob-sex"
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="ob-blood"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Blood Group
                </label>
                <select
                  id="ob-blood"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(
                    (bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="ob-city"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                City
              </label>
              <input
                id="ob-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="ob-lang"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Preferred Language
              </label>
              <select
                id="ob-lang"
                value={preferredLang}
                onChange={(e) => setPreferredLang(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="hinglish">Hinglish</option>
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="ob-allergies"
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Known Drug or Food Allergies (comma-separated, encoded in Medical ID QR)
            </label>
            <input
              id="ob-allergies"
              type="text"
              value={allergiesText}
              onChange={(e) => setAllergiesText(e.target.value)}
              placeholder="e.g., Penicillin, Peanuts"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Active Chronic Conditions
            </div>
            <div className="flex flex-wrap gap-2">
              {conditions.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-900"
                >
                  {c.name}
                </span>
              ))}
              {conditions.length === 0 && (
                <span className="text-xs text-slate-500">
                  No chronic conditions recorded yet.
                </span>
              )}
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
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
              />
              <button
                type="button"
                disabled={addConditionMutation.isPending}
                onClick={handleAddConditionClick}
                className="rounded-xl border border-teal-700 bg-white px-4 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-50 cursor-pointer"
              >
                + Add Condition
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-red-900">
              Primary Emergency Contact (Alerted on SOS 108 & Shown on Medical ID)
            </div>
            {emergencyContacts.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {emergencyContacts.map((ec) => (
                  <span
                    key={ec.id}
                    className="rounded-full bg-white border border-red-200 px-3 py-1 text-xs font-medium text-slate-800"
                  >
                    {ec.name} ({ec.phone}) · {ec.relation}
                  </span>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="ob-ec-name"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Contact Name
                </label>
                <input
                  id="ob-ec-name"
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Family member name"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div>
                <label
                  htmlFor="ob-ec-phone"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Contact Mobile Number
                </label>
                <input
                  id="ob-ec-phone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+919811199887"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>
              <div>
                <label
                  htmlFor="ob-ec-rel"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Relationship
                </label>
                <input
                  id="ob-ec-rel"
                  type="text"
                  value={contactRel}
                  onChange={(e) => setContactRel(e.target.value)}
                  placeholder="Spouse / Parent"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={completeOnboardingMutation.isPending}
              className="rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
            >
              {completeOnboardingMutation.isPending
                ? "Saving Profile…"
                : "Save Profile & Open Portal →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
