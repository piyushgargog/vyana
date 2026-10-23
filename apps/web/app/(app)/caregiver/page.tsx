"use client";

import React, { useRef, useState } from "react";
import {
  EMERGENCY,
  useAcceptCareInvite,
  useCareInvite,
  useCarePlans,
  useMyCaregivers,
  useMyPatients,
  usePrescriptions,
  useRevokeCareLink,
  type CaregiverLink,
} from "@vyana/shared";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  Field,
  LargeTitle,
  ListGroup,
  ListRow,
  Pill,
  cn,
} from "@/components/ui";
import { SkeletonCard } from "@/components/ui-primitives";
import { useVyanaWeb } from "@/components/providers";
import { ShieldAlert, UserRound, Users } from "lucide-react";

type Tab = "patients" | "my_caregivers";

export default function CaregiverPage() {
  const { showToast } = useVyanaWeb();

  const [activeTab, setActiveTab] = useState<Tab>("patients");
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const inviteRef = useRef<HTMLDivElement>(null);
  const enterCodeRef = useRef<HTMLDivElement>(null);

  const { data: patients = [], isLoading: patientsLoading, isError: patientsError, refetch: refetchPatients } = useMyPatients();
  const { data: caregivers = [], isLoading: caregiversLoading, isError: caregiversError, refetch: refetchCaregivers } = useMyCaregivers();
  const revokeMutation = useRevokeCareLink();

  const inviteMutation = useCareInvite();
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const acceptMutation = useAcceptCareInvite();
  const [code, setCode] = useState("");
  const [relation, setRelation] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);

  const currentPatient =
    patients.find((p) => p.patient_id === activePatientId) ?? patients[0] ?? null;
  const linkedPatientId = currentPatient?.patient_id;
  const { data: patientPrescriptions = [] } = usePrescriptions(linkedPatientId);
  const prescriptions = linkedPatientId ? patientPrescriptions : [];
  const { data: patientCarePlans = [] } = useCarePlans(linkedPatientId ?? undefined);

  const activeCaregiverCount = caregivers.filter((c) => c.status === "active").length;

  const scrollTo = (ref: React.RefObject<HTMLDivElement | null>) =>
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleRevokeCaregiver = async (link: CaregiverLink) => {
    try {
      await revokeMutation.mutateAsync(link.link_id);
      setConfirmRevokeId(null);
      showToast("Caregiver access revoked", "info");
      void refetchCaregivers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not revoke access", "error");
    }
  };

  const handleGenerateCode = async () => {
    try {
      const generated = await inviteMutation.mutateAsync();
      setInviteCode(generated);
      showToast("New 6-digit caregiver invite code generated", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not generate invite code", "error");
    }
  };

  const handleCopyCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      showToast("Invite code copied", "success");
    } catch {
      showToast("Could not copy the code", "error");
    }
  };

  const handleAcceptCode = async () => {
    const cleanCode = code.trim().replace(/\s+/g, "");
    if (cleanCode.length !== 6) {
      setCodeError("Please enter a 6-digit invite code");
      return;
    }
    setCodeError(null);
    try {
      const link = await acceptMutation.mutateAsync({
        code: cleanCode,
        relation: relation.trim() || undefined,
      });
      if (!link) {
        // accept_care_invite returns null for a wrong or expired code.
        setCodeError("That code is invalid or has expired. Check the code and try again.");
        return;
      }
      setCode("");
      setRelation("");
      setActiveTab("patients");
      showToast("Patient linked. You are now their caregiver.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not accept the code", "error");
    }
  };

  const tabButton = (tab: Tab, label: string) => (
    <button
      key={tab}
      type="button"
      role="tab"
      aria-selected={activeTab === tab}
      onClick={() => setActiveTab(tab)}
      className={cn(
        "min-h-11 flex-1 rounded-xl px-3 text-[14px] font-semibold transition-colors",
        activeTab === tab ? "bg-surface text-accent-strong shadow-sm" : "text-label-2 hover:text-label",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <LargeTitle eyebrow="Family care" title="Caregiver Circle" />

      <div role="tablist" aria-label="Caregiver views" className="flex gap-1 rounded-2xl bg-fill p-1">
        {tabButton("patients", `Patients I monitor (${patients.length})`)}
        {tabButton("my_caregivers", `My caregivers (${activeCaregiverCount})`)}
      </div>

      {activeTab === "patients" ? (
        <div className="space-y-6">
          {patientsLoading ? (
            <SkeletonCard lines={3} />
          ) : patientsError ? (
            <ErrorState
              title="Your linked patients could not be loaded"
              body="Check your connection and try again."
              onRetry={() => void refetchPatients()}
            />
          ) : patients.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Users aria-hidden="true" />}
                title="No patients linked yet"
                body="You are not currently monitoring any family members or patients. Ask the patient to generate a 6-digit invite code from their Vyana app."
                action={
                  <Button onClick={() => scrollTo(enterCodeRef)}>Enter caregiver code</Button>
                }
              />
            </Card>
          ) : (
            <>
              {patients.length > 1 ? (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Select patient">
                  {patients.map((p) => {
                    const isSelected = (currentPatient?.patient_id ?? "") === p.patient_id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`Select patient ${p.patient?.full_name || "Patient"}`}
                        onClick={() => setActivePatientId(p.patient_id)}
                        className={cn(
                          "min-h-11 rounded-full border px-4 text-[14px] font-semibold transition-colors",
                          isSelected
                            ? "border-accent bg-accent-soft text-accent-strong"
                            : "border-separator bg-fill text-label-2 hover:text-label",
                        )}
                      >
                        {p.patient?.full_name || "Patient"}
                        {p.relation ? ` (${p.relation})` : ""}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {currentPatient ? (
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-[20px] font-semibold text-label">
                        {currentPatient.patient?.full_name || "Linked patient"}
                      </h2>
                      <p className="mt-0.5 text-[14px] text-label-3">
                        Relation: {currentPatient.relation || "Caregiver"}
                      </p>
                    </div>
                    <Pill tone="ok">Active</Pill>
                  </div>
                  <div className="mt-4 flex gap-3 rounded-2xl bg-warn-soft p-4">
                    <ShieldAlert aria-hidden="true" className="h-[22px] w-[22px] shrink-0 text-warn" />
                    <div>
                      <p className="text-[14px] font-bold text-warn">
                        60-minute missed-dose watch active
                      </p>
                      <p className="mt-0.5 text-[14px] leading-relaxed text-label-2">
                        If a scheduled medication dose is not logged within 60 minutes of its
                        time, our automated system sends a push alert to your device.
                      </p>
                    </div>
                  </div>
                </Card>
              ) : null}

              <ListGroup header="Active medicines">
                {prescriptions.length === 0 ? (
                  <ListRow title="No active prescription items recorded." />
                ) : (
                  prescriptions.flatMap((rx) =>
                    rx.prescription_items
                      .filter((i) => i.active)
                      .map((item) => (
                        <ListRow
                          key={item.id}
                          title={`${item.medicine_name} ${item.strength || ""}`.trim()}
                          subtitle={`${item.frequency} · ${(item.times || []).join(", ")} · ${item.with_food || "after"} food`}
                          value={item.dose ?? undefined}
                        />
                      )),
                  )
                )}
              </ListGroup>

              {patientCarePlans.length > 0 ? (
                <ListGroup header={`Care plans (${patientCarePlans.length})`}>
                  {patientCarePlans.map((cp) => (
                    <ListRow key={cp.id} title="Care plan" subtitle={`Status: ${cp.status}`} />
                  ))}
                </ListGroup>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <ButtonLink href={`tel:${EMERGENCY.ambulance}`} native variant="destructive">
                  Call 108 for the patient
                </ButtonLink>
                <Button variant="secondary" onClick={() => scrollTo(enterCodeRef)}>
                  Enter another caregiver code
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {caregiversLoading ? (
            <SkeletonCard lines={3} />
          ) : caregiversError ? (
            <ErrorState
              title="Your caregivers could not be loaded"
              body="Check your connection and try again."
              onRetry={() => void refetchCaregivers()}
            />
          ) : (
            <>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold text-label">My caregivers</h2>
                    <p className="mt-0.5 text-[14px] leading-relaxed text-label-3">
                      These people get an alert if you miss a dose by 60 minutes and can view
                      your medicine schedule.
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => scrollTo(inviteRef)}>
                    Invite
                  </Button>
                </div>
              </Card>

              {caregivers.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<UserRound aria-hidden="true" />}
                    title="No caregivers linked yet"
                    body="Invite a family member to watch over your medicines and get alerted if you miss a dose."
                    action={
                      <Button onClick={() => scrollTo(inviteRef)}>Generate invite code</Button>
                    }
                  />
                </Card>
              ) : (
                <ListGroup header="Linked caregivers">
                  {caregivers.map((c) => (
                    <ListRow
                      key={c.link_id}
                      title={c.full_name || "Family caregiver"}
                      subtitle={`Relation: ${c.relation || "Caregiver"}`}
                      trailing={
                        <span className="flex items-center gap-2">
                          <Pill tone={c.status === "active" ? "ok" : "neutral"}>
                            {c.status === "active" ? "Active" : c.status}
                          </Pill>
                          {c.status === "active" ? (
                            confirmRevokeId === c.link_id ? (
                              <span className="flex items-center gap-1">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={revokeMutation.isPending}
                                  onClick={() => void handleRevokeCaregiver(c)}
                                >
                                  Remove access
                                </Button>
                                <Button variant="plain" size="sm" onClick={() => setConfirmRevokeId(null)}>
                                  Cancel
                                </Button>
                              </span>
                            ) : (
                              <Button
                                variant="destructive"
                                size="sm"
                                aria-label={`Revoke access for ${c.full_name || "caregiver"}`}
                                onClick={() => setConfirmRevokeId(c.link_id)}
                              >
                                Revoke
                              </Button>
                            )
                          ) : null}
                        </span>
                      }
                    />
                  ))}
                </ListGroup>
              )}

              <Button variant="plain" onClick={() => { setActiveTab("patients"); scrollTo(enterCodeRef); }}>
                Looking after someone else? Enter their code
              </Button>
            </>
          )}
        </div>
      )}

      <div ref={inviteRef} className="scroll-mt-24">
        <Card>
          <h2 className="text-[17px] font-semibold text-label">Invite a caregiver</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-label-2">
            Generate a 6-digit code and share it with a family member. They enter it in their
            Vyana app to link to you. The code is valid for 24 hours.
          </p>
          {inviteCode ? (
            <div className="mt-4 space-y-3">
              <p
                className="text-center text-[36px] font-bold tracking-[0.3em] text-label"
                aria-label={`Invite code ${inviteCode}`}
              >
                {inviteCode}
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleCopyCode}>
                  Copy code
                </Button>
                <Button
                  variant="plain"
                  size="sm"
                  disabled={inviteMutation.isPending}
                  onClick={handleGenerateCode}
                >
                  Generate a new code
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <Button onClick={handleGenerateCode} disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Generating…" : "Generate invite code"}
              </Button>
            </div>
          )}
        </Card>
      </div>

      <div ref={enterCodeRef} className="scroll-mt-24">
        <Card>
          <h2 className="text-[17px] font-semibold text-label">Enter a caregiver code</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-label-2">
            Enter the 6-digit invite code generated on the patient&apos;s phone.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field
              label="Invite code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="123456"
              value={code}
              error={codeError ?? undefined}
              onChange={(e) => setCode(e.target.value)}
            />
            <Field
              label="Relation (optional)"
              placeholder="Son, daughter, spouse…"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={handleAcceptCode}
              disabled={acceptMutation.isPending || code.trim().length !== 6}
            >
              {acceptMutation.isPending ? "Linking…" : "Link patient"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
