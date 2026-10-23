"use client";

// The plans themselves (#305, #418): Free and Family side by side, read from the
// plans table — usePlans for the catalogue, useCurrentPlan for which one is the
// signed-in user's — and every number on a card comes from that plan's row, so
// no number is typed into this page. No price or date is promised anywhere; the
// waitlist is how interest is measured first.
import React, { useEffect } from "react";
import { track, useCurrentPlan, usePlans, type PlanRow } from "@vyana/shared";
import { Button, Card, Pill, SkeletonLine } from "@/components/ui";
import { Check } from "lucide-react";
import { WaitlistForm } from "./waitlist-form";

/** The card's lines, in the page's words; every number in them is read from the plan row. */
function planFeatures(plan: PlanRow): string[] {
  const switches =
    plan.features && typeof plan.features === "object" && !Array.isArray(plan.features)
      ? (plan.features as { caregivers?: unknown })
      : {};
  const lines: string[] = [];
  if (plan.id === "free") {
    lines.push("Your medicines and dose reminders", "Lab reports explained in plain words");
  }
  if (plan.id === "family") {
    lines.push("Everything in Free");
    if (plan.max_profiles !== null) {
      lines.push(`Up to ${plan.max_profiles} family members, linked with their permission`);
    }
  }
  if (plan.daily_ai_calls !== null) {
    lines.push(
      plan.id === "family"
        ? `${plan.daily_ai_calls} AI answers a day, shared by the family`
        : `${plan.daily_ai_calls} AI answers a day`,
    );
  }
  if (plan.id === "free") {
    if (plan.max_profiles === 1) lines.push("For one person");
    else if (plan.max_profiles !== null) lines.push(`For up to ${plan.max_profiles} people`);
  }
  if (plan.id === "family" && switches.caregivers === true) {
    lines.push("A caregiver view for the family");
  }
  return lines;
}

function PlanCard({ plan, current }: { plan: PlanRow; current: boolean }) {
  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[20px] font-semibold tracking-tight text-label">{plan.name}</h2>
        {current && <Pill tone="accent">Your plan</Pill>}
      </div>
      <ul className="space-y-2.5">
        {planFeatures(plan).map((f) => (
          <li key={f} className="flex items-start gap-2 text-[15px] text-label-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function PlansClient() {
  const { data: catalogue, isLoading, isError, refetch } = usePlans();
  // The signed-in user's own plan. Null when signed out or when the read fails:
  // then no card is marked as theirs — the page never defaults to Free.
  const { data: currentPlan } = useCurrentPlan();

  useEffect(() => {
    track("plan_viewed");
  }, []);

  const plans = (catalogue ?? []).filter((p) => p.id === "free" || p.id === "family");
  const family = plans.find((p) => p.id === "family");

  return (
    <div className="space-y-6">
      {isError ? (
        <Card className="space-y-3">
          <p className="text-[15px] font-medium text-label">The plans could not be loaded.</p>
          <p className="text-[15px] text-label-2">
            Check your connection and try again.
          </p>
          <Button variant="secondary" size="md" className="min-h-[44px]" onClick={() => refetch()}>
            Try again
          </Button>
        </Card>
      ) : isLoading || plans.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-label="Loading plans">
          {[0, 1].map((i) => (
            <Card key={i} className="space-y-3">
              <SkeletonLine className="h-6 w-1/3" />
              <SkeletonLine className="h-4 w-full" />
              <SkeletonLine className="h-4 w-5/6" />
              <SkeletonLine className="h-4 w-2/3" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {plans.map((p) => (
            <PlanCard key={p.id} plan={p} current={currentPlan?.plan_id === p.id} />
          ))}
        </div>
      )}

      <p className="text-[15px] text-label-2">
        Family is a plan we are considering; nothing is decided or promised. Joining the list is free and means one email, no
        more.
      </p>

      {family && (
        <Card className="mx-auto w-full max-w-xl space-y-4">
          <h2 className="text-[17px] font-semibold text-label">
            Tell me when Family opens
          </h2>
          <WaitlistForm />
        </Card>
      )}
    </div>
  );
}
