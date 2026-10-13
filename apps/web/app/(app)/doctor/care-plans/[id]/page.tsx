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
        err instanceof Error ? err.message : "Failed to load care plan"
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
            err instanceof Error ? err.message : "Failed to load care plan"
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
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        <h2 className="text-base font-bold">Care Plan Not Available</h2>
        <p className="mt-1 text-xs">
          {planError || "Unable to locate care plan document for review."}
        </p>
        <Link
          href="/doctor"
          className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          Return to Queue
        </Link>
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
            className="text-xs font-semibold text-teal-800 hover:text-teal-900"
          >
            ← OPD Queue
          </Link>
          {conditionInfo?.patient_id && (
            <Link
              href={`/doctor/patients/${conditionInfo.patient_id}`}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              · Patient Profile
            </Link>
          )}
        </div>

        {/* Status Badge */}
        <div>
          {isApproved ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-900">
              ✓ Doctor Approved Care Plan
            </span>
          ) : isDraft ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-xs font-bold text-amber-900">
              ⚠ Draft Plan — Pending Doctor Approval
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-300 px-3 py-1 text-xs font-bold text-blue-900">
              Patient-Generated Plan
            </span>
          )}
        </div>
      </div>

      {/* Hero Review Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
              Care Plan: {draftPlan.condition}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              Patient:{" "}
              <strong>
                {conditionInfo?.patient?.full_name || "Assigned Patient"}
              </strong>
              {carePlan.reviewed_at && (
                <span className="ml-2 text-slate-500">
                  (Approved on {carePlan.reviewed_at.slice(0, 10)})
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isApproved ? (
              <button
                type="button"
                disabled={approveMutation.isPending}
                onClick={handleApprove}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-60"
              >
                {approveMutation.isPending ? "Approving…" : "Approve & Publish to Patient"}
              </button>
            ) : (
              <button
                type="button"
                disabled={approveMutation.isPending}
                onClick={handleApprove}
                className="rounded-xl border border-teal-600 bg-teal-50 px-4 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100 transition shadow-xs"
              >
                {approveMutation.isPending ? "Updating…" : "Update Approved Plan"}
              </button>
            )}
          </div>
        </div>

        {/* Clinical Safety Banner */}
        {!isApproved && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950">
            <strong>Clinical Safety Rule:</strong> Patients cannot see draft care plans until a verified doctor reviews and approves them. You may edit recommendations, add clinical red flags, and set diagnostic follow-up test frequencies before publishing.
          </div>
        )}
      </div>

      {/* Summary Field */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
        <label
          htmlFor="plan-summary"
          className="block text-xs font-bold uppercase tracking-wider text-slate-700"
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
          className="w-full rounded-xl border border-slate-300 p-3 text-xs sm:text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
        />
      </div>

      {/* 2-Column: Do's and Don'ts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Recommended Actions (Do) */}
        <div className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-teal-100 pb-2">
            <h2 className="text-sm font-bold text-teal-950">
              Recommended Actions (Do)
            </h2>
            <span className="text-[11px] text-teal-700 font-semibold">
              {draftPlan.do.length} items
            </span>
          </div>

          <div className="space-y-2">
            {draftPlan.do.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-xl bg-teal-50/50 border border-teal-100 p-2 text-xs"
              >
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const next = [...draftPlan.do];
                    next[idx] = e.target.value;
                    setDraftPlan({ ...draftPlan, do: next });
                  }}
                  className="flex-1 bg-transparent text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setDraftPlan({
                      ...draftPlan,
                      do: draftPlan.do.filter((_, i) => i !== idx),
                    });
                  }}
                  className="text-slate-400 hover:text-red-600 font-bold px-1"
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
              className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (newDoItem.trim()) {
                  setDraftPlan({
                    ...draftPlan,
                    do: [...draftPlan.do, newDoItem.trim()],
                  });
                  setNewDoItem("");
                }
              }}
              className="rounded-xl bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800"
            >
              Add
            </button>
          </div>
        </div>

        {/* Actions to Avoid (Don't) */}
        <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-rose-100 pb-2">
            <h2 className="text-sm font-bold text-rose-950">
              Actions to Avoid (Don&apos;t)
            </h2>
            <span className="text-[11px] text-rose-700 font-semibold">
              {draftPlan.dont.length} items
            </span>
          </div>

          <div className="space-y-2">
            {draftPlan.dont.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 rounded-xl bg-rose-50/50 border border-rose-100 p-2 text-xs"
              >
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const next = [...draftPlan.dont];
                    next[idx] = e.target.value;
                    setDraftPlan({ ...draftPlan, dont: next });
                  }}
                  className="flex-1 bg-transparent text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setDraftPlan({
                      ...draftPlan,
                      dont: draftPlan.dont.filter((_, i) => i !== idx),
                    });
                  }}
                  className="text-slate-400 hover:text-red-600 font-bold px-1"
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
              className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                if (newDontItem.trim()) {
                  setDraftPlan({
                    ...draftPlan,
                    dont: [...draftPlan.dont, newDontItem.trim()],
                  });
                  setNewDontItem("");
                }
              }}
              className="rounded-xl bg-rose-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-800"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Dietary Guidelines */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
          Dietary Guidelines
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Foods to Eat More */}
          <div className="space-y-2">
            <span className="font-bold text-emerald-800 block">
              Foods to Include (Eat More):
            </span>
            <div className="space-y-1.5">
              {(draftPlan.diet.eat_more || []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 p-1.5"
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
                    className="flex-1 bg-transparent text-emerald-950 focus:outline-none"
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
                    }}
                    className="text-slate-400 hover:text-red-600 px-1"
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
                className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
              />
              <button
                type="button"
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
                className="rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white"
              >
                Add
              </button>
            </div>
          </div>

          {/* Foods to Limit */}
          <div className="space-y-2">
            <span className="font-bold text-amber-800 block">
              Foods to Limit / Avoid:
            </span>
            <div className="space-y-1.5">
              {(draftPlan.diet.limit || []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 p-1.5"
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
                    className="flex-1 bg-transparent text-amber-950 focus:outline-none"
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
                    className="text-slate-400 hover:text-red-600 px-1"
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
                className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
              />
              <button
                type="button"
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
                className="rounded-lg bg-amber-700 px-2.5 py-1 text-xs font-semibold text-white"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Red Flags: Critical Hospital / 108 Symptoms */}
      <div className="rounded-2xl border border-red-300 bg-red-50/50 p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-red-200 pb-2">
          <h2 className="text-sm font-bold text-red-900">
            Emergency Red Flags (Immediate Hospital / 108 Escalation)
          </h2>
          <span className="text-[11px] text-red-700 font-semibold">
            {draftPlan.red_flags.length} symptoms
          </span>
        </div>

        <div className="space-y-2">
          {draftPlan.red_flags.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 rounded-xl bg-white border border-red-200 p-2 text-xs text-red-950 shadow-xs"
            >
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const next = [...draftPlan.red_flags];
                  next[idx] = e.target.value;
                  setDraftPlan({ ...draftPlan, red_flags: next });
                }}
                className="flex-1 bg-transparent font-medium focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  setDraftPlan({
                    ...draftPlan,
                    red_flags: draftPlan.red_flags.filter((_, i) => i !== idx),
                  });
                }}
                className="text-slate-400 hover:text-red-700 font-bold px-1"
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
            className="flex-1 rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (newRedFlagItem.trim()) {
                setDraftPlan({
                  ...draftPlan,
                  red_flags: [...draftPlan.red_flags, newRedFlagItem.trim()],
                });
                setNewRedFlagItem("");
              }
            }}
            className="rounded-xl bg-red-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-800"
          >
            Add Red Flag
          </button>
        </div>
      </div>

      {/* Follow-up Diagnostic Tests */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Recommended Follow-up Diagnostic Tests
          </h2>
          <span className="text-[11px] text-slate-500">
            Triggers automatic reminders on the patient mobile app
          </span>
        </div>

        <div className="space-y-2">
          {draftPlan.follow_up_tests.map((ft, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs"
            >
              <span className="font-bold text-slate-900">{ft.test}</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-600">Every {ft.every_days} days</span>
                <button
                  type="button"
                  onClick={() => {
                    setDraftPlan({
                      ...draftPlan,
                      follow_up_tests: draftPlan.follow_up_tests.filter((_, i) => i !== idx),
                    });
                  }}
                  className="text-slate-400 hover:text-red-600 px-1"
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
            className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 focus:outline-none"
          />
          <div className="flex items-center gap-1 text-xs text-slate-600">
            <span>Every</span>
            <input
              type="number"
              min="1"
              value={newTestDays}
              onChange={(e) => setNewTestDays(parseInt(e.target.value) || 30)}
              className="w-16 rounded-xl border border-slate-300 px-2 py-1.5 text-xs text-center"
            />
            <span>days</span>
          </div>
          <button
            type="button"
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
            className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
          >
            Add Test
          </button>
        </div>
      </div>

      {/* Clinical Sources & Evidence Citations */}
      {draftPlan.sources && draftPlan.sources.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Clinical Guideline References
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {draftPlan.sources.map((s, idx) => (
              <a
                key={idx}
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-medium text-teal-800 hover:underline"
              >
                ↗ {s.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Approval Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link
          href="/doctor"
          className="text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          Cancel & Return to OPD Queue
        </Link>
        <button
          type="button"
          disabled={approveMutation.isPending}
          onClick={handleApprove}
          className="rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-60"
        >
          {approveMutation.isPending
            ? "Approving…"
            : isApproved
              ? "Save Updated Care Plan"
              : "Approve & Publish Care Plan"}
        </button>
      </div>

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
