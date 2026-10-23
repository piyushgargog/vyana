"use client";

import React, { useState } from "react";
import {
  useMyProfile,
  useTriage,
  type Language,
  type TriageRes,
} from "@vyana/shared";
import {
  Button,
  ButtonLink,
  Card,
  Field,
  LargeTitle,
  Pill,
  TextAreaField,
  cn,
} from "@/components/ui";
import { AiSafetyBanner } from "@/components/ui-primitives";
import { useVyanaWeb } from "@/components/providers";
import { TriangleAlert } from "lucide-react";

const SEX_OPTIONS = ["female", "male", "other"] as const;

export default function TriagePage() {
  const { showToast } = useVyanaWeb();
  const { data: profile } = useMyProfile();
  const triageMutation = useTriage();

  const [symptoms, setSymptoms] = useState("");
  const [duration, setDuration] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "other" | undefined>(undefined);
  const [triageResult, setTriageResult] = useState<TriageRes | null>(null);

  const handleAssessSymptoms = async () => {
    const trimmed = symptoms.trim();
    if (trimmed.length < 3) {
      showToast("Please describe your symptoms in at least 3 characters", "error");
      return;
    }

    try {
      let parsedAge: number | undefined = age ? parseInt(age, 10) : undefined;
      if ((parsedAge === undefined || Number.isNaN(parsedAge)) && profile?.dob) {
        const birth = new Date(profile.dob).getTime();
        if (!Number.isNaN(birth)) {
          const years = Math.floor((Date.now() - birth) / (365.25 * 24 * 3600 * 1000));
          if (years > 0 && years < 120) {
            parsedAge = years;
          }
        }
      }
      const validLang: Language | undefined =
        profile?.preferred_language === "hi" ||
        profile?.preferred_language === "hinglish" ||
        profile?.preferred_language === "en"
          ? profile.preferred_language
          : undefined;

      const res = await triageMutation.mutateAsync({
        symptoms: trimmed,
        duration: duration.trim() || undefined,
        age: parsedAge && !Number.isNaN(parsedAge) ? parsedAge : undefined,
        sex,
        language: validLang,
      });
      setTriageResult(res);

      if (res.urgency === "emergency") {
        showToast("Emergency signs detected. Please seek immediate help.", "error");
      } else {
        showToast("Triage assessment completed", "info");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not assess symptoms", "error");
    }
  };

  const handleReset = () => {
    setTriageResult(null);
    setSymptoms("");
    setDuration("");
  };

  const canSubmit = symptoms.trim().length >= 3 && !triageMutation.isPending;

  return (
    <div className="space-y-6">
      <LargeTitle eyebrow="Check urgency" title="Symptom Triage" />

      <Card className="bg-accent-soft">
        <h2 className="text-[17px] font-semibold text-accent-strong">Safety first</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-accent-strong">
          Vyana triage evaluates clinical urgency and directs you to the appropriate medical
          department. It never invents diagnoses or provides prescription treatments.
        </p>
      </Card>

      {!triageResult ? (
        <Card>
          <h2 className="text-[17px] font-semibold text-label">Describe your symptoms</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-label-3">
            Provide details about what you are experiencing, how long it has lasted, and any
            associated discomfort.
          </p>

          <div className="mt-4 space-y-4">
            <TextAreaField
              label="What symptoms are you experiencing? *"
              rows={4}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. Sudden severe chest tightness with shortness of breath, or mild dry cough for 3 days…"
            />
            <Field
              label="Duration (optional)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 2 hours, 3 days, 1 week"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Age (optional)"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder={profile?.dob ? "Auto-filled" : "Years"}
              />
              <div>
                <span className="mb-1.5 block text-[14px] font-semibold text-label-2">
                  Biological sex (optional)
                </span>
                <div className="flex gap-2" role="group" aria-label="Biological sex">
                  {SEX_OPTIONS.map((s) => {
                    const selected = sex === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`Select biological sex ${s}`}
                        onClick={() => setSex(s === sex ? undefined : s)}
                        className={cn(
                          "min-h-11 flex-1 rounded-xl border px-2 text-[14px] font-semibold transition-colors",
                          selected
                            ? "border-accent bg-accent-soft text-accent-strong"
                            : "border-separator bg-fill text-label-3 hover:text-label",
                        )}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Button onClick={handleAssessSymptoms} disabled={!canSubmit}>
              {triageMutation.isPending ? "Evaluating with clinical rules…" : "Assess urgency & department"}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          <AiSafetyBanner feature="triage" />

          {triageResult.urgency === "emergency" ? (
            <Card className="border-2 border-danger">
              <Pill tone="danger">EMERGENCY</Pill>
              <h2 className="mt-3 text-[20px] font-semibold text-danger-text">
                Immediate medical attention required
              </h2>
              <p className="mt-1 text-[15px] leading-relaxed text-danger-text">
                {triageResult.advice}
              </p>
              <div className="mt-4">
                <div className="flex flex-wrap gap-2">
                  <ButtonLink href="tel:108" variant="destructive">
                    <TriangleAlert aria-hidden="true" className="h-[18px] w-[18px]" />
                    Call 108 now
                  </ButtonLink>
                  <ButtonLink href="/sos" variant="secondary">
                    Open Emergency SOS
                  </ButtonLink>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <Pill tone={triageResult.urgency === "soon" ? "warn" : "ok"}>
                {triageResult.urgency === "soon" ? "ATTENTION NEEDED SOON" : "ROUTINE OPD CONSULTATION"}
              </Pill>
              <h2 className="mt-3 text-[20px] font-semibold text-label">
                {triageResult.urgency === "soon"
                  ? "See a doctor soon"
                  : "Schedule a regular hospital OPD visit"}
              </h2>
              <p className="mt-1 text-[15px] leading-relaxed text-label-2">
                {triageResult.advice}
              </p>

              {triageResult.departments && triageResult.departments.length > 0 ? (
                <div className="mt-4 rounded-2xl bg-fill p-4">
                  <p className="text-[14px] font-bold text-label-2">
                    Recommended medical department:
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {triageResult.departments.map((dept) => (
                      <Pill key={dept} tone="accent">
                        {dept}
                      </Pill>
                    ))}
                  </div>
                  <div className="mt-3">
                    <ButtonLink
                      href={`/appointments/book?department=${encodeURIComponent(triageResult.departments[0])}`}
                    >
                      {`Book OPD appointment in ${triageResult.departments[0]}`}
                    </ButtonLink>
                  </div>
                </div>
              ) : null}
            </Card>
          )}

          {triageResult.red_flags && triageResult.red_flags.length > 0 ? (
            <Card className="bg-warn-soft">
              <h2 className="flex items-center gap-2 text-[17px] font-semibold text-warn">
                <TriangleAlert aria-hidden="true" className="h-[18px] w-[18px]" />
                Warning signs (go to emergency room if observed):
              </h2>
              <ul className="mt-2 space-y-1.5">
                {triageResult.red_flags.map((flag) => (
                  <li key={flag} className="flex gap-2 text-[14px] leading-relaxed text-warn">
                    <span aria-hidden="true" className="font-bold">•</span>
                    <span>{flag}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {triageResult.disclaimer ? (
            <p className="text-[13px] italic leading-relaxed text-label-3">
              {triageResult.disclaimer}
            </p>
          ) : null}

          <Button variant="secondary" onClick={handleReset}>
            Assess different symptoms
          </Button>
        </div>
      )}
    </div>
  );
}
