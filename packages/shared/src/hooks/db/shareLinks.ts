"use client";

// packages/shared/src/hooks/db/shareLinks.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import type { DbError } from "../../db/queries/helpers";
import { createShareLink, listShareLinks, revokeShareLink, type CreatedShareLink, type ShareKind } from "../../db/queries/shareLinks";
import type { DbShareLink } from "../../db/types";
import { useApiBaseUrl } from "../../providers/AppProviders";
import { QUERY_ROOTS } from "../api/query-roots";
import { useDb, useInvalidate } from "./shared";

/** Creates a read-only link that lasts `ttl_hours`. The URL points at the web app's /share page. */
export function useCreateShareLink() {
  const { sb } = useDb();
  const baseUrl = useApiBaseUrl();
  const invalidate = useInvalidate();
  return useMutation<CreatedShareLink, DbError, { kind: ShareKind; ttl_hours: number }>({
    mutationFn: ({ kind, ttl_hours }) => createShareLink(sb, kind, ttl_hours, baseUrl),
    onSuccess: () => invalidate(QUERY_ROOTS.shareLinks),
  });
}

export function useShareLinks() {
  const { sb, ready } = useDb();
  return useQuery<DbShareLink[], DbError>({
    queryKey: [QUERY_ROOTS.shareLinks],
    queryFn: () => listShareLinks(sb),
    enabled: ready,
  });
}

export function useRevokeShareLink() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<void, DbError, string>({
    mutationFn: (token) => revokeShareLink(sb, token),
    onSuccess: () => invalidate(QUERY_ROOTS.shareLinks, QUERY_ROOTS.sharedRecord),
  });
}
