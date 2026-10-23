"use client";

// Care agent proposal hooks (#304, #417). The cards call these two hooks. On the fixtures (`useMocks`, the demo and the
// tests) they use the in-memory store of the mock API; on the real app they read and decide the patient's own rows in
// `agent_proposals` through the database (migration 0017: row security keeps a patient to their own rows, and
// `decide_proposal` is the only way a status changes). The surface does not change, so the screens do not either.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ApiError } from "../../api/client";
import { useApi } from "../../api/context";
import type { AgentDecideReq, AgentDecideRes, AgentProposalsRes } from "../../contracts";
import { decideProposal, listMyProposals, toAgentProposal } from "../../db/queries/agentProposals";
import { afterSession, DB_KEYS, useDb } from "../db/shared";
import { QUERY_ROOTS } from "./query-roots";

/** What the patient is told after a choice: only what really happened. Nothing is ordered or sent for them yet. */
const APPROVED_TEXT = "Noted. Vyana has not ordered or sent anything for you; this only records your choice.";

/** Pending, unexpired proposals for the signed-in patient, newest first. */
export function useMyAgentProposals() {
  const api = useApi();
  const { sb, ready } = useDb();
  const live = !api.useMocks;
  return useQuery<AgentProposalsRes, ApiError | Error>({
    queryKey: [QUERY_ROOTS.agentProposals, live ? "mine-live" : "mine"],
    queryFn: async () => {
      if (!live) return api.agentProposals.list();
      const rows = await afterSession(sb, (client) => listMyProposals(client, "pending"));
      const now = Date.now();
      return { proposals: rows.filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now).map(toAgentProposal) };
    },
    enabled: !live || ready,
  });
}

/** Approve or reject one proposal; the list is refreshed with the answer. A rejection cannot be undone on the real data. */
export function useDecideAgentProposal() {
  const api = useApi();
  const { sb } = useDb();
  const qc = useQueryClient();
  const live = !api.useMocks;
  return useMutation<AgentDecideRes, ApiError | Error, AgentDecideReq>({
    mutationKey: [QUERY_ROOTS.agentProposals, "decide"],
    mutationFn: async (body) => {
      if (!live) return api.agentProposals.decide(body);
      // `decide_proposal` only moves a pending proposal to approved or rejected; it never moves one back.
      if (body.decision === "restore") throw new Error("This choice cannot be undone.");
      const approve = body.decision === "approve";
      await decideProposal(sb, body.id, approve);
      return { status: approve ? "approved" : "rejected", result_text: approve ? APPROVED_TEXT : null, undo_seconds: 0 };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QUERY_ROOTS.agentProposals] });
      void qc.invalidateQueries({ queryKey: [DB_KEYS.proposals] });
    },
  });
}
