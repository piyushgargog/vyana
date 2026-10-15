"use client";

import React from "react";
import { useParams } from "next/navigation";
import {
  computeItemRefill,
  useCheckInteractions,
  usePrescription,
  useSetItemActive,
  type Interaction,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import {
  AiSafetyBanner,
  MedicalDisclaimerFooter,
} from "@/components/ui-primitives";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  LargeTitle,
  Pill,
  Reveal,
  SkeletonLine,
} from "@/components/ui";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  FlaskConical,
  Loader2,
  Pause,
  Pill as PillIcon,
  Play,
  RefreshCw,
} from "lucide-react";

function severityTone(
  severity: Interaction["severity"]
): "danger" | "warn" | "neutral" {
  if (severity === "major") return "danger";
  if (severity === "moderate") return "warn";
  return "neutral";
}

export default function PrescriptionDetailPage() {
  const params = useParams();
  const rawId = params.id;
  const id = typeof rawId === "string" ? rawId : undefined;

  const { showToast } = useVyanaWeb();
  const {
    data: prescription,
    isLoading,
    isError,
    refetch,
  } = usePrescription(id);
  const toggleMutation = useSetItemActive();
  const interactionsMutation = useCheckInteractions();

  const handleToggle = async (itemId: string, nextActive: boolean) => {
    try {
      await toggleMutation.mutateAsync({ id: itemId, active: nextActive });
      showToast(
        nextActive ? "Medicine is active again." : "Medicine paused.",
        "info"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not update the medicine.",
        "error"
      );
    }
  };

  const handleCheckInteractions = async () => {
    if (!id) return;
    try {
      await interactionsMutation.mutateAsync({ prescription_id: id });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "The check could not run.",
        "error"
      );
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-2">
          <SkeletonLine className="h-8 w-2/3" />
          <SkeletonLine className="h-5 w-1/2" />
        </div>
        <Card>
          <div className="space-y-3">
            <SkeletonLine className="w-1/3" />
            <SkeletonLine />
            <SkeletonLine className="w-5/6" />
          </div>
        </Card>
        <Card>
          <div className="space-y-3">
            <SkeletonLine className="w-1/2" />
            <SkeletonLine />
            <SkeletonLine />
          </div>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <LargeTitle eyebrow="Prescriptions" title="Prescription" />
        <Card>
          <EmptyState
            icon={<AlertTriangle aria-hidden="true" />}
            title="Something went wrong"
            body="We could not load this prescription. Please try again."
            action={
              <Button
                variant="secondary"
                icon={<RefreshCw aria-hidden="true" className="h-4 w-4" />}
                onClick={() => void refetch()}
              >
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  if (!prescription) {
    return (
      <div className="space-y-6">
        <LargeTitle eyebrow="Prescriptions" title="Prescription" />
        <Card>
          <EmptyState
            icon={<FileText aria-hidden="true" />}
            title="Prescription not found"
            body="This prescription may have been deleted."
            action={
              <ButtonLink variant="secondary" href="/prescriptions/scan">
                Scan a prescription
              </ButtonLink>
            }
          />
        </Card>
      </div>
    );
  }

  const items = prescription.prescription_items ?? [];
  const interactionsData = interactionsMutation.data;

  return (
    <div className="space-y-6">
      <LargeTitle
        eyebrow="Prescriptions"
        title={
          prescription.doctor_name
            ? `Prescription · ${prescription.doctor_name}`
            : "Prescription"
        }
        subtitle={`${prescription.issued_on ? `Issued on ${prescription.issued_on}` : "Date not found on the prescription"} · ${
          prescription.source === "doctor" ? "Doctor e-Rx" : "Scanned paper Rx"
        }`}
      />

      <Reveal>
        <Card>
          <CardHeader title="About this prescription" />
          <dl className="divide-y divide-separator">
            <div className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-[15px] text-label-3">Diagnosis</dt>
              <dd className="text-right text-[17px] font-semibold text-label">
                {prescription.diagnosis || "Not found on the prescription"}
              </dd>
            </div>
            {prescription.notes && (
              <div className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="text-[15px] text-label-3">Doctor notes</dt>
                <dd className="max-w-[60%] text-right text-[17px] text-label">
                  {prescription.notes}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </Reveal>

      <Reveal>
        <Card>
          <CardHeader
            title="Drug interactions"
            trailing={
              interactionsMutation.isPending ? "Checking…" : undefined
            }
          />
          {interactionsMutation.isPending ? (
            <div
              role="status"
              className="flex items-center gap-3 rounded-tile bg-fill px-4 py-5"
            >
              <Loader2
                aria-hidden="true"
                className="h-5 w-5 animate-spin text-accent"
              />
              <p className="text-[15px] font-semibold text-label-2">
                Checking your medicines against each other…
              </p>
            </div>
          ) : interactionsData ? (
            <div className="space-y-3">
              {interactionsData.interactions.length === 0 ? (
                <div className="flex items-start gap-3 rounded-tile bg-ok-soft p-4">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-ok"
                  />
                  <p className="text-[15px] text-label">
                    No interactions found in:{" "}
                    {interactionsData.sources_checked
                      .map((s) => s.title)
                      .join(", ") || "the checked sources"}
                    .
                  </p>
                </div>
              ) : (
                interactionsData.interactions.map((inter, i) => (
                  <div
                    key={i}
                    className="space-y-2 rounded-tile border border-separator bg-canvas p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={severityTone(inter.severity)}>
                        {inter.severity}
                      </Pill>
                      <p className="text-[17px] font-semibold text-label">
                        {inter.medicine_a} + {inter.medicine_b}
                      </p>
                    </div>
                    {inter.layer && (
                      <p className="text-[13px] font-semibold text-accent-strong">
                        {inter.layer === "table"
                          ? "From the reviewed list"
                          : "From a trusted source"}
                      </p>
                    )}
                    <p className="text-[15px] text-label">{inter.effect}</p>
                    <p className="text-[15px] text-label-2">
                      <span className="font-semibold text-label">
                        What to do:{" "}
                      </span>
                      {inter.advice}
                    </p>
                    {inter.quote && (
                      <p className="text-[13px] italic text-label-3">
                        From the source: “{inter.quote}”
                      </p>
                    )}
                    {inter.sources.length > 0 && (
                      <p className="text-[13px] text-label-3">
                        Sources:{" "}
                        {inter.sources
                          .map((s) => `${s.title} (${s.url})`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                ))
              )}
              {interactionsData.not_checked &&
                interactionsData.not_checked.length > 0 && (
                  <p className="text-[15px] text-label-3">
                    Not checked: {interactionsData.not_checked.join(", ")}
                  </p>
                )}
              <AiSafetyBanner feature="interactions" />
            </div>
          ) : (
            <p className="text-[15px] leading-relaxed text-label-2">
              Check whether these medicines interact with each other, using
              the reviewed list and trusted sources.
            </p>
          )}
          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={interactionsMutation.isPending || items.length === 0}
            icon={
              interactionsMutation.isPending ? (
                <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
              ) : (
                <FlaskConical aria-hidden="true" className="h-5 w-5" />
              )
            }
            onClick={() => void handleCheckInteractions()}
          >
            {interactionsMutation.isPending
              ? "Checking…"
              : interactionsData
                ? "Check again"
                : "Check drug interactions"}
          </Button>
        </Card>
      </Reveal>

      <h2 className="text-xl font-semibold text-label">
        Medicines ({items.length})
      </h2>

      {items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PillIcon aria-hidden="true" />}
            title="No medicines here"
            body="This prescription has no saved medicines."
            action={
              <ButtonLink variant="secondary" href="/prescriptions/scan">
                Scan a prescription
              </ButtonLink>
            }
          />
        </Card>
      ) : (
        items.map((item, idx) => {
          const refill = computeItemRefill(item);
          return (
            <Reveal key={item.id} delay={Math.min(idx * 0.05, 0.3)}>
              <Card className={item.active ? undefined : "opacity-70"}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[17px] font-semibold text-label">
                      {item.medicine_name}
                      {item.strength ? ` ${item.strength}` : ""}
                    </p>
                    <p className="mt-1 text-[15px] text-label-2">
                      {item.dose ? `${item.dose} · ` : ""}{item.frequency}
                      {item.times && item.times.length > 0
                        ? ` (${item.times.join(", ")})`
                        : ""}
                      {" · "}
                      {item.with_food ? `${item.with_food} food` : "food timing not specified"}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    aria-label={
                      item.active
                        ? `Pause ${item.medicine_name}`
                        : `Activate ${item.medicine_name}`
                    }
                    icon={
                      item.active ? (
                        <Pause aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <Play aria-hidden="true" className="h-4 w-4" />
                      )
                    }
                    disabled={toggleMutation.isPending}
                    onClick={() => void handleToggle(item.id, !item.active)}
                  >
                    {item.active ? "Pause" : "Activate"}
                  </Button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  {refill.needsRefillSoon ? (
                    <Pill tone="warn" icon={<AlertTriangle aria-hidden="true" />}>
                      Refill due · about {refill.daysLeft ?? "–"} days left
                    </Pill>
                  ) : (
                    <Pill tone="neutral">
                      Refill · about {refill.daysLeft ?? "–"} days left
                    </Pill>
                  )}
                </div>

                {item.instructions && (
                  <p className="mt-3 text-[15px] italic text-label-2">
                    {item.instructions}
                  </p>
                )}
              </Card>
            </Reveal>
          );
        })
      )}

      <AiSafetyBanner feature="prescriptions" />
      <MedicalDisclaimerFooter />
    </div>
  );
}
