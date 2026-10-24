import { DEFAULT_TIMES, type FrequencyType } from "./constants";
import { CarePlan } from "./contracts";
import type { DbPrescriptionItem, DbShareLink } from "./db/types";
import { getScheduledRefillStatus } from "./health/refill";
import { carePlanMock } from "./mocks/care-plan";

export function parseCarePlanJson(
  planJson: unknown,
  useMocks: boolean = false
): CarePlan | null {
  const parsed = CarePlan.safeParse(planJson);
  if (parsed.success) {
    return parsed.data;
  }
  if (useMocks && (planJson === null || planJson === undefined)) {
    return carePlanMock.plan;
  }
  return null;
}

/**
 * The "days left" the prescription and dashboard screens show (#508). This is only a shape
 * adapter over `getScheduledRefillStatus` in health/refill — the days-left math lives there,
 * shared with the logged answer `getRefillStatus` via `deriveRefillStatus`. It is a
 * schedule-assumed estimate (the doses the schedule says should have been taken since
 * `start_date`), not the logged answer the refill alerts and the care agent use, because these
 * screens do not load dose logs. It agrees with the logged answer whenever every taken dose
 * was logged. `dosesPerDay` is the number of dose slots per day (the units per day also count
 * the units in each dose — see `parseDoseUnits`); `needsRefillSoon` follows the same
 * switched-off / course-ended rules as the alerts, so a paused or finished course is never
 * flagged here either.
 */
export function computeItemRefill(
  item: Pick<
    DbPrescriptionItem,
    | "frequency"
    | "times"
    | "dose"
    | "quantity_total"
    | "start_date"
    | "end_date"
    | "refill_alert_days"
    | "active"
  >,
  now: Date = new Date()
): {
  dosesPerDay: number;
  daysLeft: number | null;
  refillDate: string | null;
  needsRefillSoon: boolean;
} {
  const times =
    item.times && item.times.length > 0
      ? item.times
      : DEFAULT_TIMES[(item.frequency as FrequencyType) ?? "OD"] ?? [];
  const status = getScheduledRefillStatus(item, now);
  return {
    dosesPerDay: times.length,
    daysLeft: status.days_left,
    refillDate: status.refill_date,
    needsRefillSoon: status.refill_due,
  };
}

// ---------------------------------------------------------------- share links

const SHARE_SCOPE_LABELS: Record<string, string> = {
  labs: "Labs",
  vitals: "Vitals",
  medicines: "Medicines",
  adherence: "Adherence",
};

/** The human name of one share-link scope (#237), the same words on phone and web. */
export function shareScopeLabel(scope: string): string {
  return SHARE_SCOPE_LABELS[scope] ?? scope;
}

/**
 * "just now", "5 min ago", "1 h ago", "29 d ago", then a plain date — for "last opened"
 * lines (#239). Floored, never rounded up: 90 minutes reads "1 h ago", 23.5 hours reads
 * "23 h ago". A timestamp in the future reads "just now".
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const ms = now.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/** What an active share link covers and how it has been used (#239) — one line for link lists. */
export function shareLinkSubtitle(
  link: Pick<DbShareLink, "kind" | "scopes" | "expires_at" | "open_count" | "last_opened_at">,
  now: Date = new Date()
): string {
  const parts: string[] = [];
  // A row read from a database without migration 0014 has neither column: treat it as an old link, never crash the list.
  const scopes = link.scopes ?? [];
  const opens = link.open_count ?? 0;
  if (link.kind === "timeline") {
    parts.push(
      scopes.length > 0
        ? `Includes ${scopes.map(shareScopeLabel).join(", ")}`
        : "No summary sections"
    );
  }
  parts.push(
    `Expires ${new Date(link.expires_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`
  );
  parts.push(
    opens > 0
      ? `Opened ${opens} ${opens === 1 ? "time" : "times"}${link.last_opened_at ? `, last ${relativeTime(link.last_opened_at, now)}` : ""}`
      : "Not opened yet"
  );
  return parts.join(" · ");
}

/** A `tel:` link only for something that is a phone number: digits with an optional leading +. */
export function telHref(phone: string | null): string | null {
  const p = phone?.replace(/[\s().-]+/g, "") ?? "";
  return /^\+?\d{6,15}$/.test(p) ? `tel:${p}` : null;
}
