"use client";

// The plans themselves (#305, #418): Free and Family side by side. The plan catalogue
// copy lives in the one fixture (`mocks.plansMock`, test-locked to the plans seeded in
// migration 0016) — no number is typed into this page. Which plan is YOURS, and its real
// daily limit, come from the plans table through `useCurrentPlan`; when that read fails
// or there is no plan, no card is marked and no plan is claimed (never "Free" by default).
// No price or date is promised anywhere; the waitlist is how interest is measured first.
import React, { useEffect } from "react";
import { mocks, track, useCurrentPlan, type Plan } from "@vyana/shared";
import { Button, Card, Pill } from "@/components/ui";
import { Check } from "lucide-react";
import { WaitlistForm } from "./waitlist-form";

function PlanCard({
  plan,
  current,
  dailyLimit,
}: {
  plan: Plan;
  current: boolean;
  dailyLimit?: number | null;
}) {
  return (
    <Card className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[20px] font-semibold tracking-tight text-label">{plan.name}</h2>
        {current && <Pill tone="accent">Your plan</Pill>}
      </div>
      <ul className="space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-[15px] text-label-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden="true" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {current && typeof dailyLimit === "number" && (
        <p className="text-[15px] text-label-2">
          On your plan: {dailyLimit} AI answers a day.
        </p>
      )}
    </Card>
  );
}

export function PlansClient() {
  const { data: currentPlan, isError, refetch } = useCurrentPlan();

  useEffect(() => {
    track("plan_viewed");
  }, []);

  const plans = mocks.plansMock.plans;
  const family = plans.find((p) => p.slug === "family");

  return (
    <div className="space-y-6">
      {isError && (
        <Card className="space-y-3">
          <p className="text-[15px] font-medium text-label">Your plan could not be loaded.</p>
          <p className="text-[15px] text-label-2">
            Check your connection and try again.
          </p>
          <Button variant="secondary" size="md" className="min-h-[44px]" onClick={() => refetch()}>
            Try again
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {plans.map((p) => (
          <PlanCard
            key={p.slug}
            plan={p}
            current={currentPlan?.plan_id === p.slug}
            dailyLimit={currentPlan?.plan_id === p.slug ? currentPlan.daily_ai_calls : undefined}
          />
        ))}
      </div>

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
