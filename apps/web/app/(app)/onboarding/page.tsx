"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useAddCondition,
  useAddContact,
  useDepartments,
  useHospitals,
  useUpdateProfile,
  useUpsertDoctorProfile,
} from "@vyana/shared";
import { DEMO_HOSPITALS } from "@/components/health-helpers";
import { useVyanaWeb, type DemoRole } from "@/components/providers";

export default function OnboardingPage() {
  const router = useRouter();
  const {
    profile,
    demoRole,
    setDemoRole,
    updateLocalProfile,
    conditions,
    addLocalCondition,
    emergencyContacts,
    addLocalEmergencyContact,
    setOnboarded,
    showToast,
  } = useVyanaWeb();

  const updateProfileMutation = useUpdateProfile();
  const addConditionMutation = useAddCondition();
  const addEmergencyContactMutation = useAddContact();
  const upsertDoctorMutation = useUpsertDoctorProfile();
  const { data: liveHospitals } = useHospitals();

  const hospitals =
    liveHospitals && liveHospitals.length > 0 ? liveHospitals : DEMO_HOSPITALS;

  const [role, setRole] = useState<DemoRole>(demoRole);
  const [fullName, setFullName] = useState(profile.full_name || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [dob, setDob] = useState(profile.dob || "1968-04-12");
  const [sex, setSex] = useState(profile.gender || "female");
  const [bloodGroup, setBloodGroup] = useState(profile.blood_group || "B+");
  const [city, setCity] = useState(profile.city || "New Delhi");
  const [pincode, setPincode] = useState("110029");
  const [preferredLang, setPreferredLang] = useState(
    profile.preferred_language || "en"
  );
  const [allergiesText, setAllergiesText] = useState(
    (profile.allergies ?? []).join(", ")
  );
  const [newCondition, setNewCondition] = useState("");
  const [contactName, setContactName] = useState(
    emergencyContacts[0]?.name || ""
  );
  const [contactPhone, setContactPhone] = useState(
    emergencyContacts[0]?.phone || ""
  );
  const [contactRel, setContactRel] = useState(
    emergencyContacts[0]?.relation || "Family"
  );

  // Doctor onboarding state (hospital + department + reg no)
  const [hospitalId, setHospitalId] = useState<string>(
    hospitals[0]?.id ?? "hosp-aiims-delhi"
  );
  const { data: liveDepartments } = useDepartments(hospitalId);
  const [departmentName, setDepartmentName] = useState<string>(
    "General Medicine OPD"
  );
  const [regNo, setRegNo] = useState<string>("DMC-45892");
  const [stateCouncil, setStateCouncil] = useState<string>(
    "Delhi Medical Council"
  );
  const [specialization, setSpecialization] = useState<string>(
    "General Medicine & Diabetology"
  );
  const [yearOfReg, setYearOfReg] = useState<string>("2010");

  const handleAddConditionClick = async () => {
    const trimmed = newCondition.trim();
    if (!trimmed) return;
    try {
      await addConditionMutation.mutateAsync({
        name: trimmed,
      });
    } catch {
      // Fallback to local state in demo mode
    }
    addLocalCondition(trimmed);
    setNewCondition("");
    showToast(`Added chronic condition: ${trimmed}`, "success");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAllergies = allergiesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const dbRole =
      role === "admin" ? "doctor" : (role as "patient" | "doctor" | "caregiver");

    try {
      await updateProfileMutation.mutateAsync({
        full_name: fullName.trim(),
        phone: phone.trim(),
        dob,
        gender: sex,
        blood_group: bloodGroup,
        city: city.trim(),
        preferred_language: preferredLang,
        allergies: parsedAllergies,
      });
    } catch {
      // Local demo state updated below
    }

    if (role === "doctor") {
      try {
        const selectedHosp = hospitals.find((h) => h.id === hospitalId);
        await upsertDoctorMutation.mutateAsync({
          specialization: specialization.trim() || departmentName,
          reg_no: regNo.trim(),
          state_council: stateCouncil.trim(),
          year_of_registration: Number(yearOfReg) || 2010,
          clinic_name: `${selectedHosp?.name ?? "AIIMS"} · ${departmentName}`,
        });
      } catch {
        // Fallback to local demo doctor state
      }
    }

    if (contactName.trim() && contactPhone.trim()) {
      try {
        await addEmergencyContactMutation.mutateAsync({
          name: contactName.trim(),
          phone: contactPhone.trim(),
          relation: contactRel.trim() || "Family",
        });
      } catch {
        // Fallback to local demo contact
      }
      if (
        !emergencyContacts.some(
          (c) => c.phone.trim() === contactPhone.trim()
        )
      ) {
        addLocalEmergencyContact({
          name: contactName.trim(),
          phone: contactPhone.trim(),
          relation: contactRel.trim() || "Family",
        });
      }
    }

    setDemoRole(role);
    updateLocalProfile({
      role: dbRole,
      full_name: fullName.trim(),
      phone: phone.trim(),
      dob,
      gender: sex,
      blood_group: bloodGroup,
      city: city.trim(),
      preferred_language: preferredLang,
      allergies: parsedAllergies,
    });
    setOnboarded(true);
    showToast("Health profile & onboarding saved!", "success");

    if (role === "doctor") {
      router.push("/doctor");
    } else if (role === "admin") {
      router.push("/admin/doctors");
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-900">
            Step 2 of 2 · Role & Health Profile Setup
          </span>
          <h1 className="text-2xl font-bold text-slate-900 mt-2">
            Complete Your Vyana Onboarding
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Configure your role, medical ID essentials, allergies, emergency
            contacts, or doctor hospital/department credentials.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <fieldset>
            <legend className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              1. Choose Your Primary Role
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: "patient" as const,
                  title: "Patient",
                  desc: "Manage doses, prescriptions, lab reports, care plans & OPD tokens",
                },
                {
                  id: "doctor" as const,
                  title: "Doctor",
                  desc: "Manage hospital OPD queue, write e-Rx & approve care plans",
                },
                {
                  id: "caregiver" as const,
                  title: "Caregiver",
                  desc: "Monitor family member adherence, alerts & emergency Medical ID",
                },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={role === item.id}
                  onClick={() => setRole(item.id)}
                  className={`rounded-xl border p-4 text-left transition cursor-pointer ${
                    role === item.id
                      ? "border-teal-700 bg-teal-50/70 ring-1 ring-teal-700"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-bold text-slate-900">
                    {item.title}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">{item.desc}</div>
                </button>
              ))}
            </div>
          </fieldset>

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
                    {(liveDepartments && liveDepartments.length > 0
                      ? liveDepartments.map((d) => d.name)
                      : [
                          "General Medicine OPD",
                          "Endocrinology & Diabetes",
                          "Cardiology OPD",
                          "Obstetrics & Gynaecology",
                          "Paediatrics",
                          "Orthopaedics",
                        ]
                    ).map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
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
                    placeholder="DMC-45892"
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
                    placeholder="Delhi Medical Council"
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
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="General Medicine & Diabetology"
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
                    placeholder="2010"
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

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="ob-pincode"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  PIN Code
                </label>
                <input
                  id="ob-pincode"
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
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
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="hinglish">Hinglish</option>
                </select>
              </div>
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
              placeholder="Penicillin, Sulfa drugs, Peanuts"
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
                  placeholder="Rohit Verma"
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
                  placeholder="Son / Spouse"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
            >
              Save Profile & Open Portal →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
