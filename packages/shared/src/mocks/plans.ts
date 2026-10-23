// packages/shared/src/mocks/plans.ts
// Mock-first plans, waitlist and AI usage (#305). The numbers mirror the plans seeded in
// #316 (30 and 150 AI answers a day), so mock mode never shows other numbers than the
// database; the screens read everything from here, so a change stays a one-line edit in
// one place. No plan carries a price or a date: Vyana charges nothing yet, and the
// waitlist is how that is tested. Care suggestions are not listed until #312 is on main.

import {
  PlansRes,
  type AiUsageTodayRes,
  type JoinWaitlistReq,
  type JoinWaitlistRes,
  type Plan,
} from "../contracts";

export const freePlanMock: Plan = {
  slug: "free",
  name: "Free",
  features: [
    "Your medicines and dose reminders",
    "Lab reports explained in plain words",
    "30 AI answers a day",
    "For one person",
  ],
  ai_uses_per_day: 30,
};

export const familyPlanMock: Plan = {
  slug: "family",
  name: "Family",
  features: [
    "Everything in Free",
    "Up to 5 family members, linked with their permission",
    "150 AI answers a day, shared by the family",
    "A caregiver view for the family",
  ],
  ai_uses_per_day: 150,
};

/** Everyone is on Free until Family opens; that is the point of the waitlist. */
export const plansMock: PlansRes = {
  plans: [freePlanMock, familyPlanMock],
  current_slug: "free",
};

const joinedEmails = new Set<string>();

/** Join once: the same email a second time answers "already_on_list", never a second entry. */
export function joinWaitlistMock(body: JoinWaitlistReq): JoinWaitlistRes {
  const email = body.email.trim().toLowerCase();
  if (joinedEmails.has(email)) return { status: "already_on_list" };
  joinedEmails.add(email);
  return { status: "joined" };
}

export function resetWaitlistMock() {
  joinedEmails.clear();
}

/** The next midnight in India (Asia/Kolkata), as an ISO instant — when today's count resets. */
export function nextIstMidnight(from: Date = new Date()): string {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const ist = new Date(from.getTime() + IST_OFFSET_MS);
  const next = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + 1, 0, 0, 0);
  return new Date(next - IST_OFFSET_MS).toISOString();
}

/** Today's AI usage for the demo patient: a few answers used, the Free plan's limit. */
export const aiUsageTodayMock: AiUsageTodayRes = {
  used: 3,
  limit: freePlanMock.ai_uses_per_day,
  resets_at: nextIstMidnight(),
};
