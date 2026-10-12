"use client";

// packages/shared/src/hooks/db/consents.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { acceptConsent, getConsent } from "../../db/queries/consents";
import type { DbError } from "../../db/queries/helpers";
import type { DbConsent } from "../../db/types";
import { DB_KEYS, useDb } from "./shared";

/** The record of the user accepting `version`, or null when they have not (show the consent screen). */
export function useConsent(version: string) {
  const { sb, userId, ready } = useDb();
  return useQuery<DbConsent | null, DbError>({
    queryKey: [DB_KEYS.consent, userId, version],
    queryFn: () => getConsent(sb, version),
    enabled: ready,
  });
}

export function useAcceptConsent() {
  const { sb, userId } = useDb();
  const queryClient = useQueryClient();
  return useMutation<DbConsent, DbError, string>({
    mutationFn: (version) => acceptConsent(sb, version),
    onSuccess: (consent, version) => queryClient.setQueryData([DB_KEYS.consent, userId, version], consent),
  });
}
