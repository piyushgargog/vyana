// packages/shared/src/db/queries/agentProposals.ts
// The care agent's proposals (issue #302): the server writes them, the patient decides.
// Owner: Vaibhav Parmar

import type { AgentProposal } from "../../contracts";
import type { DbAgentProposal } from "../types";
import { unwrap, type Sb } from "./helpers";

/**
 * The signed-in user's care-agent proposals, newest first — all of them, or
 * only one status when asked. Row security does the filtering by owner: a
 * patient sees theirs, a doctor sees their patients'.
 */
export async function listMyProposals(sb: Sb, status?: string): Promise<DbAgentProposal[]> {
  let query = sb.from("agent_proposals").select("*").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  return unwrap(await query) as DbAgentProposal[];
}

/**
 * Approves or rejects one of the user's own proposals through
 * `decide_proposal` (migration 0017): only the owner, only while the proposal
 * is pending and unexpired. Returns the decided row.
 */
export async function decideProposal(sb: Sb, proposalId: string, approve: boolean): Promise<DbAgentProposal> {
  return unwrap(await sb.rpc("decide_proposal", { p_proposal_id: proposalId, p_approve: approve })) as unknown as DbAgentProposal;
}

/** The table behind a proposal's evidence row, said in the patient's words (never a table name on a screen). */
const EVIDENCE_SOURCE: Record<string, string> = {
  prescription_items: "Your prescription",
  prescriptions: "Your prescription",
  dose_logs: "Your dose log",
  reports: "Your lab report",
  lab_values: "Your lab report",
  care_plans: "Your care plan",
};

/**
 * A stored proposal as the cards show it. The rules write the title, the reason and the evidence labels; this only
 * renames the evidence source and drops anything that is not a labelled object, so a row can never break a card.
 */
export function toAgentProposal(row: DbAgentProposal): AgentProposal {
  const raw = Array.isArray(row.evidence) ? row.evidence : [];
  const evidence = raw.flatMap((e) => {
    if (!e || typeof e !== "object") return [];
    const item = e as { label?: unknown; detail?: unknown; table?: unknown };
    if (typeof item.label !== "string" || !item.label.trim()) return [];
    const detail =
      typeof item.detail === "string" && item.detail.trim()
        ? item.detail
        : EVIDENCE_SOURCE[typeof item.table === "string" ? item.table : ""] ?? "Your records";
    return [{ label: item.label, detail }];
  });
  return {
    id: row.id,
    kind: row.kind as AgentProposal["kind"],
    title: row.title,
    reason: row.reason,
    evidence,
    created_at: row.created_at,
    expires_at: row.expires_at,
    status: row.status as AgentProposal["status"],
  };
}
