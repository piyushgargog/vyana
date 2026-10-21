// packages/shared/src/mocks/agent-proposals.ts
// Mock-first care-agent proposals (#304): fictional demo data and a small in-memory store, so the
// patient screens can be built, approved and rejected before the real contract and routes land.
// The store lives for the session only; a reload brings the fixtures back. Dates are written
// relative to "now" when the store is first read, so the demo never shows a stale or expired card
// by accident — except the one fixture whose expiry is in the past on purpose (it must not show).

import {
  AgentProposalsRes,
  type AgentDecideReq,
  type AgentDecideRes,
  type AgentProposal,
} from "../contracts";

const DAY = 24 * 60 * 60 * 1000;
const iso = (fromNowMs: number) => new Date(Date.now() + fromNowMs).toISOString();

function fixtures(): AgentProposal[] {
  return [
    {
      id: "proposal-refill-metformin",
      kind: "refill_reminder",
      title: "Your metformin may run out in 4 days",
      reason: "Your dose log and the pack size on your prescription say the current pack is nearly finished.",
      evidence: [
        { label: "Last 7 dose logs", detail: "6 taken, 1 missed" },
        { label: "Pack size from your prescription", detail: "30 tablets, started 26 days ago" },
      ],
      created_at: iso(-2 * 60 * 60 * 1000),
      expires_at: iso(3 * DAY),
      status: "pending",
    },
    {
      id: "proposal-lab-hba1c",
      kind: "lab_recheck",
      title: "Your HbA1c was last measured 3 months ago",
      reason: "Your care plan asks for this test every 3 months, and the last report on your record is from 3 months ago.",
      evidence: [
        { label: "Last HbA1c report", detail: "Uploaded 3 months ago" },
        { label: "From your care plan", detail: "Repeat HbA1c every 3 months" },
      ],
      created_at: iso(-5 * 60 * 60 * 1000),
      expires_at: iso(6 * DAY),
      status: "pending",
    },
    {
      id: "proposal-notify-caregiver",
      kind: "notify_caregiver",
      title: "Share this week's dose summary with your caregiver",
      reason: "You missed 3 doses this week. Your caregiver can see the summary only if you send it.",
      evidence: [
        { label: "Dose logs this week", detail: "11 of 14 doses taken" },
        { label: "Caregiver on your record", detail: "Linked family member" },
      ],
      created_at: iso(-26 * 60 * 60 * 1000),
      expires_at: iso(2 * DAY),
      status: "pending",
    },
    {
      id: "proposal-expired-refill",
      kind: "refill_reminder",
      title: "Your vitamin D may have run out",
      reason: "This suggestion has expired, so it is never shown.",
      evidence: [{ label: "Pack size from your prescription", detail: "8 tablets, finished last week" }],
      created_at: iso(-9 * DAY),
      expires_at: iso(-1 * DAY),
      status: "pending",
    },
  ];
}

const RESULT_TEXT: Record<string, string> = {
  "proposal-refill-metformin": "Reminder added for Monday 9:00",
  "proposal-lab-hba1c": "Reminder added to book the test this week",
  "proposal-notify-caregiver": "Summary shared with your caregiver",
};

let store: AgentProposal[] | null = null;
const data = () => (store ??= fixtures());

/** The pending, unexpired proposals, newest first — what the screens show. */
export function visibleProposals(now: Date = new Date()): AgentProposal[] {
  return data()
    .filter(
      (p) =>
        p.status === "pending" &&
        (p.expires_at === null || new Date(p.expires_at).getTime() > now.getTime())
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

/** The mock list response: visible proposals only, validated against the provisional contract. */
export function agentProposalsMock(): AgentProposalsRes {
  return AgentProposalsRes.parse({ proposals: visibleProposals() });
}

/** The mock decide: approve and reject settle the proposal; restore brings a rejection back. */
export function agentDecideMock(body: AgentDecideReq): AgentDecideRes {
  const proposal = data().find((p) => p.id === body.id);
  if (!proposal) return { status: "pending", result_text: null, undo_seconds: 0 };
  if (body.decision === "approve") {
    proposal.status = "approved";
    return {
      status: "approved",
      result_text: RESULT_TEXT[proposal.id] ?? "Done",
      undo_seconds: 0,
    };
  }
  if (body.decision === "reject") {
    proposal.status = "rejected";
    return { status: "rejected", result_text: null, undo_seconds: 5 };
  }
  proposal.status = "pending";
  return { status: "pending", result_text: null, undo_seconds: 0 };
}

/** Test hook: put the fixtures back. */
export function resetAgentProposalsMock() {
  store = null;
}
