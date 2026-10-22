"use client";

// packages/shared/src/hooks/db/agentProposals.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import { decideProposal, listMyProposals } from "../../db/queries/agentProposals";
import type { DbError } from "../../db/queries/helpers";
import type { DbAgentProposal } from "../../db/types";
import { DB_KEYS, useDb, useInvalidate } from "./shared";

/** The signed-in user's care-agent proposals, newest first; pass a status to see only that kind (issue #302). */
export function useMyProposals(status?: string) {
  const { sb, ready } = useDb();
  return useQuery<DbAgentProposal[], DbError>({
    queryKey: [DB_KEYS.proposals, status ?? "all"],
    queryFn: () => listMyProposals(sb, status),
    enabled: ready,
  });
}

/** Approve or reject a proposal in one tap; the list is read again afterwards. */
export function useDecideProposal() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbAgentProposal, DbError, { id: string; approve: boolean }>({
    mutationFn: ({ id, approve }) => decideProposal(sb, id, approve),
    onSuccess: () => invalidate(DB_KEYS.proposals),
  });
}
