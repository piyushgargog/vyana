// packages/shared/src/mocks/plans.ts
// Waitlist mock (#305) only. The plan catalogue and today's AI usage used to live here
// alongside it, but the screens now read those from the database hooks (usePlans /
// useCurrentPlan, useMyAiUsageToday, #418), so their fixtures were removed with the
// client paths that served them (issue #530); no /api/plans/me or /api/ai/usage-today
// route exists. The waitlist join stays on the client until the form moves to the
// database hook (open PR #529).

import type { JoinWaitlistReq, JoinWaitlistRes } from "../contracts";

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
