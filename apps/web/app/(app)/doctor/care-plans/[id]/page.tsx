"use client";

import React, { Suspense, use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  parseCarePlanJson,
  useApproveCarePlan,
  type CarePlan,
  type DbCarePlan,
  type DbCondition,
  type DbProfile,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { Button, ButtonLink, Card, Pill } from "@/components/ui";
import { AiSafetyBanner, SkeletonCard } from "@/components/ui-primitives";

interface ConditionWithPatient extends DbCondition {
  patient?: DbProfile | null;
}

function DoctorCarePlanReviewContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: routeId } = use(params);
  const { supabase, showToast } = useVyanaWeb();

  const [carePlan, setCarePlan] = useState<DbCarePlan | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState<string | null>(null);

  const [conditionInfo, setConditionInfo] = useState<ConditionWithPatient | null>(null);

  const [draftPlan, setDraftPlan] = useState<CarePlan | null>(null);
  const [newDoItem, setNewDoItem] = useState("");
  const [newDontItem, setNewDontItem] = useState("");
  const [newEatMoreItem, setNewEatMoreItem] = useState("");
  const [newLimitItem, setNewLimitItem] = useState("");
  const [newRedFlagItem, setNewRedFlagItem] = useState("");
  const [newTestName, setNewTestName] = useState("");
  const [newTestDays, setNewTestDays] = useState(90);

  const reloadCarePlan = useCallback(async () => {
    if (!routeId) return;
    try {
      setPlanLoading(true);
      setPlanError(null);

      // 1. Try by care_plan ID
      const { data: byId } = await supabase
        .from("care_plans")
        .select("*")
        .eq("id", routeId)
        .maybeSingle();

      let targetPlan: DbCarePlan | null = (byId as DbCarePlan | null) ?? null;

      // 2. Try by condition_id if not found by plan ID
      if (!targetPlan) {
        const { data: byCondition } = await supabase
          .from("care_plans")
          .select("*")
          .eq("condition_id", routeId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        targetPlan = (byCondition as DbCarePlan | null) ?? null;
      }

      setCarePlan(targetPlan);

      if (targetPlan?.plan_json) {
        const parsed = parseCarePlanJson(targetPlan.plan_json);
        if (parsed) {
          setDraftPlan(parsed);
        }
      }

      if (targetPlan?.condition_id) {
        const { data: condData } = await supabase
          .from("conditions")
          .select("*, patient:profiles!conditions_patient_id_fkey(*)")
          .eq("id", targetPlan.condition_id)
          .maybeSingle();
        setConditionInfo(condData as ConditionWithPatient | null);
      }
    } catch (err) {
      setPlanError(
        err instanceof Error ? err.message : "Please try again in a moment."
      );
    } finally {
      setPlanLoading(false);
    }
  }, [routeId, supabase]);

  useEffect(() => {
    if (!routeId) return;
    let ignore = false;
    async function loadPlan() {
      try {
        const { data: byId } = await supabase
          .from("care_plans")
          .select("*")
          .eq("id", routeId)
          .maybeSingle();

        let targetPlan: DbCarePlan | null = (byId as DbCarePlan | null) ?? null;

        if (!targetPlan) {
          const { data: byCondition } = await supabase
            .from("care_plans")
            .select("*")
            .eq("condition_id", routeId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          targetPlan = (byCondition as DbCarePlan | null) ?? null;
        }

        if (ignore) return;
        setCarePlan(targetPlan);

        if (targetPlan?.plan_json) {
          const parsed = parseCarePlanJson(targetPlan.plan_json);
          if (parsed && !ignore) {
            setDraftPlan(parsed);
          }
        }

        if (targetPlan?.condition_id) {
          const { data: condData } = await supabase
            .from("conditions")
            .select("*, patient:profiles!conditions_patient_id_fkey(*)")
            .eq("id", targetPlan.condition_id)
            .maybeSingle();
          if (!ignore) {
            setConditionInfo(condData as ConditionWithPatient | null);
          }
        }
      } catch (err) {
        if (!ignore) {
          setPlanError(
            err instanceof Error ? err.message : "Please try again in a moment."
          );
        }
      } finally {
        if (!ignore) {
          setPlanLoading(false);
        }
      }
    }
    loadPlan();
    return () => {
      ignore = true;
    };
  }, [routeId, supabase]);

  const approveMutation = useApproveCarePlan();

  const handleApprove = async () => {
    if (!carePlan || !draftPlan) return;
    try {
      await approveMutation.mutateAsync({
        id: carePlan.id,
        plan: draftPlan as unknown as NonNullable<
          Parameters<typeof approveMutation.mutateAsync>[0]
        >["plan"],
      });
      showToast(
        "Care plan approved! It is now active and visible to the patient.",
        "success"
      );
      await reloadCarePlan();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not approve care plan",
        "error"
      );
    }
  };

  if (planLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  if (planError || !carePlan || !draftPlan) {
    return (
      <div className="rounded-card border border-danger/30 bg-danger-soft p-6 text-sm text-danger-text">
        <h2 className="text-base font-bold">Care Plan Not Available</h2>
        <p className="mt-1 text-xs">
          {planError || "Unable to locate care plan document for review."}
        </p>
        <ButtonLink href="/doctor" size="sm" className="mt-4">
          Return to Queue
        </ButtonLink>
      </div>
    );
  }

  const isApproved = carePlan.status === "approved";
  const isDraft = carePlan.status === "draft";

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/doctor"
            className="text-xs font-semibold text-accent-strong hover:text-accent"
          >
            ← OPD Queue
          </Link>
          {conditionInfo?.patient_id && (
            <Link
              href={`/doctor/patients/${conditionInfo.patient_id}`}
              className="text-xs font-semibold text-label-2 hover:text-label"
            >
              · Patient Profile
            </Link>
          )}
        </div>

        {/* Status Badge */}
        <div>
          {isApproved ? (
            <Pill tone="ok">✓ Doctor Approved Care Plan</Pill>
          ) : isDraft ? (
            <Pill tone="warn">⚠ Draft Plan — Pending Doctor Approval</Pill>
          ) : (
            <Pill tone="accent">Patient-Generated Plan</Pill>
          )}
        </div>
      </div>

      {/* Hero Review Card */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-label">
              Care Plan: {draftPlan.condition}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-label-2">
              Patient:{" "}
              <strong>
                {conditionInfo?.patient?.full_name || "Assigned Patient"}
              </strong>
              {carePlan.reviewed_at && (
                <span className="ml-2 text-label-3">
                  (Approved on {carePlan.reviewed_at.slice(0, 10)})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isApproved ? (
              <Button
                size="sm"
                disabled={approveMutation.isPending}
                onClick={handleApprove}
              >
                {approveMutation.isPending ? "Approving…" : "Approve & Publish to Patient"}
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled={approveMutation.isPending}
                onClick={handleApprove}
              >
                {approveMutation.isPending ? "Updating…" : "Update Approved Plan"}
              </Button>
            )}
          </div>
        </div>

        {/* Clinical Safety Banner */}
        {!isApproved && (
          <div className="mt-4 rounded-tile border border-warn/30 bg-warn-soft p-3.5 text-xs text-label">
            <strong>Clinical Safety Rule:</strong> Patients cannot see draft care plans until a verified doctor reviews and approves them. You may edit recommendations, add clinical red flags, and set diagnostic follow-up test frequencies before publishing.
          </div>
        )}
      </Card>

      {/* Summary Field */}
      <Card className="space-y-2 p-5">
        <label
          htmlFor="plan-summary"
          className="block text-xs font-bold uppercase tracking-wider text-label-2"
        >
          Clinical Summary & Overview
        </label>
        <textarea
          id="plan-summary"
          rows={3}
          value={draftPlan.summary}
          onChange={(e) =>
            setDraftPlan({ ...draftPlan, summary: e.target.value })
          }
          className="w-full rounded-row border border-separator bg-surface p-3 text-xs sm:text-sm text-label focus:border-accent focus:outline-none"
        />
      </Card>

      {/* 2-Column: Do's and Don'ts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recommended Actions (Do) */}
        <Card className="space-y-3 border border-accent/30 p-5">
          <div className="flex items-center justify-between border-b border-separator pb-2">
            <h2 className="text-sm font-bold text-label">
              Recommended Actions (Do)
            </h2>
            <span className="text-[11px] text-accent-strong font-semibold">
              {draftPlan.do.length} items
            </span>
          </div>

          <div className="space-y-2">
            {draftPlan.do.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-row bg-accent-soft border border-accent/20 p-2 text-xs"
              >
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const next = [...draftPlan.do];
                    next[idx] = e.target.value;
                    setDraftPlan({ ...draftPlan, do: next });
                  }}
                  aria-label={`Recommended action ${idx + 1}`}
                  className="flex-1 bg-transparent text-label"
                />
                <button
                  type="button"
                  onClick={() => {
                    setDraftPlan({
                      ...draftPlan,
                      do: draftPlan.do.filter((_, i) => i !== idx),
                    });
                  }}
                  aria-label={`Remove do item: ${item}`} 
                className="inline-flex min-h-11 min-w-11 items-center justify-center font-bold text-label-3 hover:text-danger-text"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={newDoItem}
              onChange={(e) => setNewDoItem(e.target.value)}
              placeholder="Add recommended action…"
              aria-label="Add recommended action"
              className="flex-1 rounded-row border border-separator bg-surface px-3 py-1.5 text-xs text-label placeholder:text-label-3 focus:border-accent focus:outline-none"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (newDoItem.trim()) {
                  setDraftPlan({
                    ...draftPlan,
                    do: [...draftPlan.do, newDoItem.trim()],
                  });
                  setNewDoItem("");
                }
              }}
            >
              Add
            </Button>
          </div>
        </Card>

        {/* Actions to Avoid (Don't) */}
        <Card className="space-y-3 border border-danger/30 p-5">
          <div className="flex items-center justify-between border-b border-separator pb-2">
            <h2 className="text-sm font-bold text-label">
              Actions to Avoid (Don&apos;t)
            </h2>
            <span className="text-[11px] text-danger-text font-semibold">
              {draftPlan.dont.length} items
            </span>
          </div>

          <div className="space-y-2">
            {draftPlan.dont.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-row bg-danger-soft border border-danger/20 p-2 text-xs"
              >
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const next = [...draftPlan.dont];
                    next[idx] = e.target.value;
                    setDraftPlan({ ...draftPlan, dont: next });
                  }}
                  aria-label={`Action to avoid ${idx + 1}`}
                  className="flex-1 bg-transparent text-label"
                />
                <button
                  type="button"
                  onClick={() => {
                    setDraftPlan({
                      ...draftPlan,
                      dont: draftPlan.dont.filter((_, i) => i !== idx),
                    });
                  }}
                  aria-label={`Remove don't item: ${item}`} 
                className="inline-flex min-h-11 min-w-11 items-center justify-center font-bold text-label-3 hover:text-danger-text"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={newDontItem}
              onChange={(e) => setNewDontItem(e.target.value)}
              placeholder="Add restriction / contraindication…"
              aria-label="Add restriction / contraindication"
              className="flex-1 rounded-row border border-separator bg-surface px-3 py-1.5 text-xs text-label placeholder:text-label-3 focus:border-accent focus:outline-none"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (newDontItem.trim()) {
                  setDraftPlan({
                    ...draftPlan,
                    dont: [...draftPlan.dont, newDontItem.trim()],
                  });
                  setNewDontItem("");
                }
              }}
            >
              Add
            </Button>
          </div>
        </Card>
      </div>

      {/* Dietary Guidelines */}
      <Card className="space-y-4 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-label">
          Dietary Guidelines
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Foods to Eat More */}
          <div className="space-y-2">
            <span className="font-bold text-ok block">
              Foods to Include (Eat More):
            </span>
            <div className="space-y-1.5">
              {(draftPlan.diet.eat_more || []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-row bg-ok-soft border border-ok/20 p-1.5"
                >
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const next = [...draftPlan.diet.eat_more];
                      next[idx] = e.target.value;
                      setDraftPlan({
                        ...draftPlan,
                        diet: { ...draftPlan.diet, eat_more: next },
                      });
                    }}
                    aria-label={`Food to include ${idx + 1}`}
                    className="flex-1 bg-transparent text-label"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDraftPlan({
                        ...draftPlan,
                        diet: {
                          ...draftPlan.diet,
                          eat_more: draftPlan.diet.eat_more.filter((_, i) => i !== idx),
                        },
                      });
                    aria-label={`Remove food to include: ${item}`} 
                    className="inline-flex min-h-11 min-w-11 items-center justify-center text-label-3 hover:text-danger-text"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={newEatMoreItem}
                onChange={(e) => setNewEatMoreItem(e.target.value)}
                placeholder="e.g. Green leafy vegetables…"
                aria-label="Add food to include"
                className="flex-1 rounded-row border border-separator bg-surface px-2.5 py-1 text-xs text-label placeholder:text-label-3 focus:border-accent focus:outline-none"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (newEatMoreItem.trim()) {
                    setDraftPlan({
                      ...draftPlan,
                      diet: {
                        ...draftPlan.diet,
                        eat_more: [...draftPlan.diet.eat_more, newEatMoreItem.trim()],
                      },
                    });
                    setNewEatMoreItem("");
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>

          {/* Foods to Limit */}
          <div className="space-y-2">
            <span className="font-bold text-warn block">
              Foods to Limit / Avoid:
            </span>
            <div className="space-y-1.5">
              {(draftPlan.diet.limit || []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-row bg-warn-soft border border-warn/20 p-1.5"
                >
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => {
                      const next = [...draftPlan.diet.limit];
                      next[idx] = e.target.value;
                      setDraftPlan({
                        ...draftPlan,
                        diet: { ...draftPlan.diet, limit: next },
                      });
                    }}
                    aria-label={`Food to limit ${idx + 1}`}
                    className="flex-1 bg-transparent text-label"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setDraftPlan({
                        ...draftPlan,
                        diet: {
                          ...draftPlan.diet,
                          limit: draftPlan.diet.limit.filter((_, i) => i !== idx),
                        },
                      });
                    }}
                    aria-label={`Remove food to limit: ${item}`} 
                  className="inline-flex min-h-11 min-w-11 items-center justify-center text-label-3 hover:text-danger-text"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={newLimitItem}
                onChange={(e) => setNewLimitItem(e.target.value)}
                placeholder="e.g. Refined sugars, high-sodium snacks…"
                aria-label="Add food to limit"
                className="flex-1 rounded-row border border-separator bg-surface px-2.5 py-1 text-xs text-label placeholder:text-label-3 focus:border-accent focus:outline-none"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (newLimitItem.trim()) {
                    setDraftPlan({
                      ...draftPlan,
                      diet: {
                        ...draftPlan.diet,
                        limit: [...draftPlan.diet.limit, newLimitItem.trim()],
                      },
                    });
                    setNewLimitItem("");
                  }
                }}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Red Flags: Critical Hospital / 108 Symptoms */}
      <Card className="space-y-3 border border-danger/40 bg-danger-soft p-5">
        <div className="flex items-center justify-between border-b border-danger/30 pb-2">
          <h2 className="text-sm font-bold text-danger-text">
            Emergency Red Flags (Immediate Hospital / 108 Escalation)
          </h2>
          <span className="text-[11px] text-danger-text font-semibold">
            {draftPlan.red_flags.length} symptoms
          </span>
        </div>

        <div className="space-y-2">
          {draftPlan.red_flags.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-row bg-surface border border-danger/30 p-2 text-xs text-label"
            >
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const next = [...draftPlan.red_flags];
                  next[idx] = e.target.value;
                  setDraftPlan({ ...draftPlan, red_flags: next });
                }}
                aria-label={`Red flag symptom ${idx + 1}`}
                className="flex-1 bg-transparent font-medium"
              />
              <button
                type="button"
                onClick={() => {
                  setDraftPlan({
                    ...draftPlan,
                    red_flags: draftPlan.red_flags.filter((_, i) => i !== idx),
                  });
                }}
                aria-label={`Remove red flag symptom: ${item}`} 
              className="inline-flex min-h-11 min-w-11 items-center justify-center font-bold text-label-3 hover:text-danger-text"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <input
            type="text"
            value={newRedFlagItem}
            onChange={(e) => setNewRedFlagItem(e.target.value)}
            placeholder="Add red flag symptom (e.g. Sudden severe chest pain, loss of consciousness)…"
            aria-label="Add red flag symptom"
            className="flex-1 rounded-row border border-danger/30 bg-surface px-3 py-1.5 text-xs text-label placeholder:text-label-3 focus:border-accent focus:outline-none"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (newRedFlagItem.trim()) {
                setDraftPlan({
                  ...draftPlan,
                  red_flags: [...draftPlan.red_flags, newRedFlagItem.trim()],
                });
                setNewRedFlagItem("");
              }
            }}
          >
            Add Red Flag
          </Button>
        </div>
      </Card>

      {/* Follow-up Diagnostic Tests */}
      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between border-b border-separator pb-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-label">
            Recommended Follow-up Diagnostic Tests
          </h2>
          <span className="text-[11px] text-label-3">
            Triggers automatic reminders on the patient mobile app
          </span>
        </div>

        <div className="space-y-2">
          {draftPlan.follow_up_tests.map((ft, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 rounded-row bg-fill border border-separator p-2.5 text-xs"
            >
              <span className="font-bold text-label">{ft.test}</span>
              <div className="flex items-center gap-2">
                <span className="text-label-2">Every {ft.every_days} days</span>
                <button
                  type="button"
                  onClick={() => {
                    setDraftPlan({
                      ...draftPlan,
                      follow_up_tests: draftPlan.follow_up_tests.filter((_, i) => i !== idx),
                    });
                  }}
                  aria-label={`Remove follow-up test: ${ft.test}`} 
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-label-3 hover:text-danger-text"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            type="text"
            value={newTestName}
            onChange={(e) => setNewTestName(e.target.value)}
            placeholder="Test name (e.g. HbA1c, Serum Creatinine)…"
            aria-label="Follow-up test name"
            className="flex-1 rounded-row border border-separator bg-surface px-3 py-1.5 text-xs text-label placeholder:text-label-3 focus:border-accent focus:outline-none"
          />
          <div className="flex items-center gap-1 text-xs text-label-2">
            <span>Every</span>
            <input
              type="number"
              min="1"
              value={newTestDays}
              onChange={(e) => setNewTestDays(parseInt(e.target.value) || 30)}
              aria-label="Days between follow-up tests"
              className="w-16 rounded-row border border-separator bg-surface px-2 py-1.5 text-xs text-center text-label focus:border-accent focus:outline-none"
            />
            <span>days</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (newTestName.trim()) {
                setDraftPlan({
                  ...draftPlan,
                  follow_up_tests: [
                    ...draftPlan.follow_up_tests,
                    { test: newTestName.trim(), every_days: Number(newTestDays) || 90 },
                  ],
                });
                setNewTestName("");
              }
            }}
          >
            Add Test
          </Button>
        </div>
      </Card>

      {/* Clinical Sources & Evidence Citations */}
      {draftPlan.sources && draftPlan.sources.length > 0 && (
        <Card className="space-y-2 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-label-2">
            Clinical Guideline References
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {draftPlan.sources.map((s, idx) => (
              <a
                key={idx}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-row bg-accent-soft border border-accent/20 px-2.5 py-1 text-xs font-medium text-accent-strong hover:underline"
              >
                ↗ {s.title}
              </a>
            ))}
          </div>
        </Card>
      )}

      {/* Bottom Approval Footer */}
      <Card className="flex flex-col items-center justify-between gap-3 p-5 sm:flex-row">
        <Link
          href="/doctor"
          className="text-xs font-semibold text-label-2 hover:text-label"
        >
          Cancel & Return to OPD Queue
        </Link>
        <Button
          disabled={approveMutation.isPending}
          onClick={handleApprove}
        >
          {approveMutation.isPending
            ? "Approving…"
            : isApproved
              ? "Save Updated Care Plan"
              : "Approve & Publish Care Plan"}
        </Button>
      </Card>

      <AiSafetyBanner feature="doctor-care-plan" contextId={carePlan.id} />
    </div>
  );
}

export default function DoctorCarePlanReviewPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
        </div>
      }
    >
      <DoctorCarePlanReviewContent {...props} />
    </Suspense>
  );
}
