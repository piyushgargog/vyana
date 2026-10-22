// packages/shared/src/db/queries/agentProposals.ts
// The care agent's proposals (issue #302): the server writes them, the patient decides.
// Owner: Vaibhav Parmar

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
