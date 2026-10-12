"use client";

// packages/shared/src/hooks/db/appointments.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import {
  bookAppointment,
  listDoctorQueue,
  listMyAppointments,
  updateAppointmentStatus,
  type AppointmentStatus,
  type BookAppointmentInput,
  type MyAppointment,
  type QueueEntry,
} from "../../db/queries/appointments";
import type { DbError } from "../../db/queries/helpers";
import type { DbAppointment } from "../../db/types";
import { QUERY_ROOTS } from "../api/query-roots";
import { DB_KEYS, useDb, useInvalidate } from "./shared";

export function useMyAppointments() {
  const { sb, ready } = useDb();
  return useQuery<MyAppointment[], DbError>({
    queryKey: [QUERY_ROOTS.appointments, "mine"],
    queryFn: () => listMyAppointments(sb),
    enabled: ready,
  });
}

/** A doctor's queue for one day (`YYYY-MM-DD`). Live through Realtime is up to the screen. */
export function useDoctorQueue(date: string) {
  const { sb, ready } = useDb();
  return useQuery<QueueEntry[], DbError>({
    queryKey: [QUERY_ROOTS.appointments, "queue", date],
    queryFn: () => listDoctorQueue(sb, date),
    enabled: ready,
  });
}

/** Books a token. The result has the `token_no`; a refusal ('OPD is closed on that day', ...) is the error message. */
export function useBookAppointment() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbAppointment, DbError, BookAppointmentInput>({
    mutationFn: (input) => bookAppointment(sb, input),
    onSuccess: () => invalidate(QUERY_ROOTS.appointments, DB_KEYS.timeline),
  });
}

export function useUpdateAppointment() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbAppointment, DbError, { id: string; status: AppointmentStatus; doctor_notes?: string }>({
    mutationFn: ({ id, status, doctor_notes }) => updateAppointmentStatus(sb, id, status, doctor_notes),
    onSuccess: () => invalidate(QUERY_ROOTS.appointments, DB_KEYS.timeline),
  });
}
