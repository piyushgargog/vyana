"use client";

// Care agent proposal hooks (#304, mock-first). These are the screens' hooks until Vaibhav's M3
// hooks land on the real contract; the surface (useMyAgentProposals / useDecideAgentProposal) is the one
// the issue names, so swapping the implementation later does not touch the screens.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ApiError } from "../../api/client";
import { useApi } from "../../api/context";
import type { AgentDecideReq, AgentDecideRes, AgentProposalsRes } from "../../contracts";
import { QUERY_ROOTS } from "./query-roots";

/** Pending, unexpired proposals for the signed-in patient, newest first (the server/store filters). */
export function useMyAgentProposals() {
  const api = useApi();
  return useQuery<AgentProposalsRes, ApiError>({
    queryKey: [QUERY_ROOTS.agentProposals, "mine"],
    queryFn: () => api.agentProposals.list(),
  });
}

/** Approve, reject or restore one proposal; the list is refreshed with the answer. */
export function useDecideAgentProposal() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<AgentDecideRes, ApiError, AgentDecideReq>({
    mutationKey: [QUERY_ROOTS.agentProposals, "decide"],
    mutationFn: (body) => api.agentProposals.decide(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [QUERY_ROOTS.agentProposals] });
    },
  });
}
