"use client";

// packages/shared/src/hooks/db/profile.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DbProfile } from "../../db/types";
import { completeOnboarding, getMyProfile, updateMyProfile, type ProfilePatch } from "../../db/queries/profile";
import type { DbError } from "../../db/queries/helpers";
import { DB_KEYS, useDb } from "./shared";

export function useMyProfile() {
  const { sb, userId, ready } = useDb();
  return useQuery<DbProfile, DbError>({
    queryKey: [DB_KEYS.profile, userId],
    queryFn: () => getMyProfile(sb),
    enabled: ready,
  });
}

export function useUpdateProfile() {
  const { sb, userId } = useDb();
  const queryClient = useQueryClient();
  return useMutation<DbProfile, DbError, ProfilePatch>({
    mutationFn: (patch) => updateMyProfile(sb, patch),
    onSuccess: (profile) => queryClient.setQueryData([DB_KEYS.profile, userId], profile),
  });
}

/** Saves the onboarding answers and marks the profile as onboarded. */
export function useCompleteOnboarding() {
  const { sb, userId } = useDb();
  const queryClient = useQueryClient();
  return useMutation<DbProfile, DbError, ProfilePatch>({
    mutationFn: (patch) => completeOnboarding(sb, patch),
    onSuccess: (profile) => queryClient.setQueryData([DB_KEYS.profile, userId], profile),
  });
}
