// The decision rules of the care agent: pure functions, no database, no model, no network.
// Rules decide; a model may only write words later. Each returns null or one proposal draft.

import { addDays, getRefillStatus } from "@vyana/shared";

export type ProposalKind = "refill_due" | "lab_recheck" | "missed_dose_pattern";

export interface ProposalDraft {
  kind: ProposalKind;
  title: string; // one plain sentence, shown on the card
  reason: string; // one plain sentence: the fact that triggered it
  dedupe_key: string; // same situation = same key, so it is never proposed twice
  expires_in_days: number; // how long the card stays
  evidence: { table: string; id: string; label: string }[]; // the rows the rule used
  payload: Record<string, string | number | boolean | null>; // what the action needs, only plain values
}

type DoseStatus = "taken" | "missed" | "skipped";

export interface RefillDueInput {
  today: string; // YYYY-MM-DD
  item: {
    id: string;
    medicine_name: string;
    strength: string | null;
    dose: string | null;
    times: string[];
    quantity_total: number | null;
    refill_alert_days: number | null;
    active: boolean;
    end_date: string | null;
  };
  doseLogs: { item_id: string; status: DoseStatus }[];
}

export function refillDueRule(input: RefillDueInput): ProposalDraft | null {
  const { today, item, doseLogs } = input;
  if (!item.active || item.refill_alert_days === null) return null;
  const status = getRefillStatus(
    { ...item, refill_alert_days: item.refill_alert_days },
    doseLogs,
    new Date(today + "T00:00:00"),
  );
  if (!status.refill_due || status.days_left === null) return null;
  const daysLeft = status.days_left;
  return {
    kind: "refill_due",
    title: `${item.medicine_name} may need a refill`,
    reason:
      daysLeft <= 0
        ? "The pack from your prescription is used up."
        : `About ${daysLeft} ${daysLeft === 1 ? "day" : "days"} of this medicine are left.`,
    dedupe_key: "refill:" + item.id + ":" + today.slice(0, 7),
    expires_in_days: 7,
    evidence: [{ table: "prescription_items", id: item.id, label: "Pack size and dose from your prescription" }],
    payload: { item_id: item.id, days_left: daysLeft },
  };
}

export interface LabRecheckInput {
  today: string;
  followUp: { test: string; every_days: number };
  lastMeasuredOn: string | null;
  reportId: string | null;
}

export function labRecheckRule(input: LabRecheckInput): ProposalDraft | null {
  const { today, followUp, lastMeasuredOn, reportId } = input;
  const { test, every_days } = followUp;
  if (!Number.isInteger(every_days) || every_days < 7 || every_days > 730) return null;
  if (lastMeasuredOn === null) return null;
  const due = addDays(lastMeasuredOn, every_days);
  if (today < due) return null;
  return {
    kind: "lab_recheck",
    title: "Time to repeat your " + test + " check",
    reason: `Your care plan says to repeat it every ${every_days} days, and the last result in Vyana is from ${lastMeasuredOn}.`,
    dedupe_key: "lab:" + test.toLowerCase() + ":" + due,
    expires_in_days: 14,
    evidence: [{ table: "lab_reports", id: reportId ?? "unknown", label: "Last " + test + " result" }],
    payload: { test, due_on: due },
  };
}

export interface MissedDosePatternInput {
  today: string;
  itemId: string;
  medicineName: string;
  logs: { scheduled_for: string; status: DoseStatus }[]; // scheduled_for is ISO
  hasCaregiver: boolean;
}

export function missedDosePatternRule(input: MissedDosePatternInput): ProposalDraft | null {
  const { today, itemId, medicineName, logs, hasCaregiver } = input;
  const weekStart = addDays(today, -6);
  const missed = logs.filter((log) => {
    const day = log.scheduled_for.slice(0, 10);
    return log.status === "missed" && day >= weekStart && day <= today;
  }).length;
  if (missed < 3) return null;
  return {
    kind: "missed_dose_pattern",
    title: "A few doses of " + medicineName + " were missed this week",
    reason: missed + " doses were marked missed in the last 7 days.",
    dedupe_key: "missed:" + itemId + ":" + weekStart,
    expires_in_days: 3,
    evidence: [{ table: "dose_logs", id: itemId, label: "Dose log of the last 7 days" }],
    payload: { item_id: itemId, missed, suggest: hasCaregiver ? "tell_caregiver" : "tell_doctor" },
  };
}
