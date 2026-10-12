"use client";

// packages/shared/src/hooks/db/contacts.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import { addEmergencyContact, deleteEmergencyContact, listEmergencyContacts, type EmergencyContactInput } from "../../db/queries/contacts";
import type { DbError } from "../../db/queries/helpers";
import type { DbEmergencyContact } from "../../db/types";
import { DB_KEYS, useDb, useInvalidate } from "./shared";

export function useEmergencyContacts() {
  const { sb, ready } = useDb();
  return useQuery<DbEmergencyContact[], DbError>({
    queryKey: [DB_KEYS.contacts],
    queryFn: () => listEmergencyContacts(sb),
    enabled: ready,
  });
}

export function useAddContact() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbEmergencyContact, DbError, EmergencyContactInput>({
    mutationFn: (input) => addEmergencyContact(sb, input),
    onSuccess: () => invalidate(DB_KEYS.contacts),
  });
}

export function useDeleteContact() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<void, DbError, string>({
    mutationFn: (id) => deleteEmergencyContact(sb, id),
    onSuccess: () => invalidate(DB_KEYS.contacts),
  });
}
