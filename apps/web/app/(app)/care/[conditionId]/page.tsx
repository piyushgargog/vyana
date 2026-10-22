"use client";

import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import {
  parseCarePlanJson,
  useCarePlan,
  useGenerateCarePlan,
} from "@vyana/shared";
import { AiSafetyBanner } from "@/components/ui-primitives";
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
import { ExternalLink, Loader2 } from "lucide-react";

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map((item, i) => (
        <li key={i} className="text-[15px] leading-relaxed text-label-2">
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function CarePlanPage() {
  const { conditionId } = useParams<{ conditionId: string }>();

  const {
    data: saved,
    isLoading: planLoading,
    isError: planError,
    refetch: refetchPlan,
  } = useCarePlan(conditionId);

  const generateMutation = useGenerateCarePlan();

  // A draft plan is never shown — treat it as no plan.
  const savedPlan =
    saved && saved.status !== "draft"
      ? parseCarePlanJson(saved.plan_json)
      : null;
  const activePlan =
    savedPlan ?? generateMutation.data?.plan ?? null;

  const isDoctorApproved = saved?.status === "approved";
  const isPatientGenerated =
    saved?.status === "patient_generated" ||
    Boolean(generateMutation.data?.plan);

  const handleGenerate = () => {
    if (!conditionId) return;
    generateMutation.mutate({ condition_id: conditionId });
  };

  const generateError = useMemo(
    () =>
      generateMutation.error instanceof Error
        ? generateMutation.error.message
        : "Could not generate a care plan",
    [generateMutation.error]
  );

  const titleBlock = (
    <LargeTitle
      eyebrow="Care plan"
      title={activePlan?.condition ?? "Care plan"}
      subtitle="Your daily plan for managing this condition."
      actions={
        <ButtonLink variant="secondary" size="md" href="/dashboard">
          Back to today
        </ButtonLink>
      }
    />
  );

  if (planLoading) {
    return (
      <div className="space-y-6">
        {titleBlock}
        <Card>
          <div className="space-y-3" aria-label="Loading care plan">
            <SkeletonLine className="w-2/3" />
            <SkeletonLine className="w-1/2" />
            <SkeletonLine className="w-3/5" />
          </div>
        </Card>
        <Card>
          <div className="space-y-3" aria-label="Loading diet plan">
            <SkeletonLine className="w-1/3" />
            <SkeletonLine />
            <SkeletonLine />
          </div>
        </Card>
        <Card>
          <div className="space-y-3" aria-label="Loading follow-up tests">
            <SkeletonLine className="w-1/2" />
            <SkeletonLine className="w-2/3" />
            <SkeletonLine />
          </div>
        </Card>
      </div>
    );
  }

  if (planError) {
    return (
      <div className="space-y-6">
        {titleBlock}
        <Card>
          <p className="text-[17px] font-semibold text-label">
            Could not load your care plan
          </p>
          <p className="mt-1 text-[15px] text-label-2">
            Your care plan could not be loaded. Check your connection and try again.
          </p>
          <Button
            variant="secondary"
            size="md"
            className="mt-4"
            onClick={() => refetchPlan()}
          >
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  if (!activePlan) {
    return (
      <div className="space-y-6">
        {titleBlock}
        <Card>
          <EmptyState
            title="No care plan yet"
            body="Generate a daily plan with diet, red flags and follow-up tests from trusted health sources."
            action={
              <div className="flex flex-col items-center gap-3">
                {generateMutation.isError && (
                  <Pill tone="warn">{generateError}</Pill>
                )}
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  icon={
                    generateMutation.isPending ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : undefined
                  }
                >
                  {generateMutation.isPending
                    ? "Generating…"
                    : "Generate care plan"}
                </Button>
              </div>
            }
          />
        </Card>
        <AiSafetyBanner feature="care_plan" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {titleBlock}

      {/* Plan status */}
      {(isDoctorApproved || isPatientGenerated) && (
        <Card>
          {isDoctorApproved ? (
            <>
              <Pill tone="ok">Doctor reviewed and approved</Pill>
              <p className="mt-2 text-[15px] leading-relaxed text-label-3">
                Approved by your doctor. Follow this plan as advised.
              </p>
            </>
          ) : (
            <>
              <Pill tone="warn">Not reviewed by a doctor</Pill>
              <p className="mt-2 text-[15px] leading-relaxed text-label-3">
                Created from trusted health guidelines. Please discuss it with your doctor.
              </p>
            </>
          )}
        </Card>
      )}

      {/* Generating indicator while a plan is being refreshed */}
      {generateMutation.isPending && (
        <Card>
          <div className="flex items-center gap-3">
            <Loader2
              className="h-5 w-5 shrink-0 animate-spin text-accent"
              aria-hidden="true"
            />
            <p className="text-[15px] text-label-2">
              Generating your care plan…
            </p>
          </div>
        </Card>
      )}
      {generateMutation.isError && (
        <Pill tone="warn">{generateError}</Pill>
      )}

      {/* Summary */}
      <Reveal>
        <Card>
          <CardHeader title="Summary" />
          <p className="text-[15px] leading-relaxed text-label-2">
            {activePlan.summary}
          </p>
        </Card>
      </Reveal>

      {/* Do */}
      {activePlan.do.length > 0 && (
        <Reveal>
          <Card>
            <CardHeader title="Do" />
            <BulletList items={activePlan.do} />
          </Card>
        </Reveal>
      )}

      {/* Don't */}
      {activePlan.dont.length > 0 && (
        <Reveal>
          <Card>
            <CardHeader title="Don't" />
            <BulletList items={activePlan.dont} />
          </Card>
        </Reveal>
      )}

      {/* Eat more */}
      {activePlan.diet.eat_more.length > 0 && (
        <Reveal>
          <Card>
            <CardHeader title="Eat more" />
            <BulletList items={activePlan.diet.eat_more} />
          </Card>
        </Reveal>
      )}

      {/* Limit */}
      {activePlan.diet.limit.length > 0 && (
        <Reveal>
          <Card>
            <CardHeader title="Limit" />
            <BulletList items={activePlan.diet.limit} />
          </Card>
        </Reveal>
      )}

      {/* A sample day */}
      {activePlan.diet.sample_day.length > 0 && (
        <Reveal>
          <Card>
            <CardHeader title="A sample day" />
            <div className="space-y-2">
              {activePlan.diet.sample_day.map((meal, i) => (
                <p
                  key={i}
                  className="text-[15px] leading-relaxed text-label-2"
                >
                  <span className="font-semibold text-label">
                    {capitalize(meal.meal)}:{" "}
                  </span>
                  {meal.items.join(", ")}
                </p>
              ))}
            </div>
          </Card>
        </Reveal>
      )}

      {/* Warning signs */}
      {activePlan.red_flags.length > 0 && (
        <Reveal>
          <Card className="bg-warn-soft/40">
            <CardHeader title="Warning signs" />
            <p className="text-[15px] font-bold leading-relaxed text-label">
              Go to a hospital or call 108 if you have:
            </p>
            <div className="mt-2">
              <BulletList items={activePlan.red_flags} />
            </div>
          </Card>
        </Reveal>
      )}

      {/* Follow-up tests */}
      {activePlan.follow_up_tests.length > 0 && (
        <Reveal>
          <Card>
            <CardHeader title="Follow-up tests" />
            <ul className="space-y-2">
              {activePlan.follow_up_tests.map((test, i) => (
                <li
                  key={i}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="text-[15px] text-label-2">
                    {test.test}
                  </span>
                  <span className="shrink-0 text-[15px] text-label-3">
                    every {test.every_days} days
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      )}

      {/* Sources */}
      {activePlan.sources.length > 0 && (
        <Reveal>
          <Card>
            <CardHeader title="Sources" />
            <ul className="space-y-2">
              {activePlan.sources.map((source, i) => (
                <li key={i}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-[44px] items-center gap-1.5 text-[15px] font-medium text-accent-strong underline decoration-accent/40 underline-offset-4"
                  >
                    {source.title}
                    <ExternalLink
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      )}

      <AiSafetyBanner
        feature="care_plan"
        aiRunId={generateMutation.data?.ai?.run_id}
      />
    </div>
  );
}
