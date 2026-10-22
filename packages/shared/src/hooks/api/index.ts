"use client";

// React Query hooks for every API route. Each one reads the client from useApi().
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ApiError } from "../../api/client";
import { useApi } from "../../api/context";
import type {
  BasketCompareReq,
  BasketCompareRes,
  BloodSearchReq,
  BloodSearchRes,
  DoctorVerifyReq,
  DoctorVerifyRes,
  EmergencyNearbyReq,
  EmergencyNearbyRes,
  EmergencySosReq,
  EmergencySosRes,
  GenerateCarePlanReq,
  GenerateCarePlanRes,
  HospitalInfoReq,
  HospitalInfoRes,
  InteractionsReq,
  InteractionsRes,
  LabsCompareReq,
  LabsCompareRes,
  MedicinesCompareReq,
  MeExportRes,
  OkRes,
  PmjayHospitalsReq,
  PmjayHospitalsRes,
  PrescriptionExtractReq,
  PrescriptionExtractRes,
  ReportAnalyzeReq,
  ReportAnalyzeRes,
  LabValueCorrectReq,
  LabValueCorrectRes,
  ShareRes,
  TriageReq,
  TriageRes,
} from "../../contracts";
import { QUERY_ROOTS } from "./query-roots";

export { QUERY_ROOTS } from "./query-roots";
export { useCurrentPlan, useJoinWaitlist, useMyAiUsageToday, useRefreshAiUsage } from "./plans";

export function useCompareMedicine() {
  const api = useApi();
  // A one-item basket job (ADR-038): poll the returned job_id with useBasketJob.
  return useMutation<BasketCompareRes, ApiError, MedicinesCompareReq>({
    mutationKey: ["medicines", "compare"],
    mutationFn: (body) => api.medicines.compare(body),
  });
}

export function useBasketCompare() {
  const api = useApi();
  return useMutation<BasketCompareRes, ApiError, BasketCompareReq>({
    mutationKey: ["prescriptions", "basket"],
    mutationFn: (body) => api.basket.compare(body),
  });
}

/** Polls a basket job every 4 s until it is done. Pass the `job_id` from `useBasketCompare`. */
export function useBasketJob(jobId: string | null | undefined) {
  const api = useApi();
  return useQuery<BasketCompareRes, ApiError>({
    queryKey: [QUERY_ROOTS.basketJob, jobId],
    queryFn: () => api.basket.job(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => (query.state.data?.status === "done" ? false : 4000),
    retry: 1,
  });
}

export function useCompareLabTest() {
  const api = useApi();
  return useMutation<LabsCompareRes, ApiError, LabsCompareReq>({
    mutationKey: ["labs", "compare"],
    mutationFn: (body) => api.labs.compare(body),
  });
}

/** Polls a lab compare job every 4 s until it is done. Pass the `job_id` from `useCompareLabTest`. */
export function useLabsJob(jobId: string | null | undefined) {
  const api = useApi();
  return useQuery<LabsCompareRes, ApiError>({
    queryKey: ["labs-job", jobId],
    queryFn: () => api.labs.job(jobId as string),
    enabled: Boolean(jobId),
    refetchInterval: (query) => (query.state.data?.status === "done" ? false : 4000),
    retry: 1,
  });
}

export function useSearchBlood() {
  const api = useApi();
  return useMutation<BloodSearchRes, ApiError, BloodSearchReq>({
    mutationKey: ["blood", "search"],
    mutationFn: (body) => api.blood.search(body),
  });
}

/** Polls a blood bank search job every 4 s until it is done. Pass the `job_id` from `useSearchBlood`. */
export function useBloodJob(jobId: string | null | undefined) {
  const api = useApi();
  return useQuery<BloodSearchRes, ApiError>({
    queryKey: ["blood-job", jobId],
    queryFn: () => api.blood.job(jobId as string),
    enabled: Boolean(jobId),
    // Stops on "done" and also after an error (a 404 "expired" would otherwise be asked again every 4 s for ever).
    refetchInterval: (query) => (query.state.error || query.state.data?.status === "done" ? false : 4000),
    retry: 1,
  });
}

export function useNearbyHospitals() {
  const api = useApi();
  return useMutation<EmergencyNearbyRes, ApiError, EmergencyNearbyReq>({
    mutationKey: ["emergency", "nearby"],
    mutationFn: (body) => api.emergency.nearby(body),
  });
}

export function useSos() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<EmergencySosRes, ApiError, EmergencySosReq>({
    mutationKey: ["emergency", "sos"],
    mutationFn: (body) => api.emergency.sos(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_ROOTS.emergency] }),
  });
}

export function useHospitalInfo() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<HospitalInfoRes, ApiError, HospitalInfoReq>({
    mutationKey: ["hospitals", "info"],
    mutationFn: (body) => api.hospitals.info(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_ROOTS.hospitals] }),
  });
}

export function usePmjayHospitals() {
  const api = useApi();
  return useMutation<PmjayHospitalsRes, ApiError, PmjayHospitalsReq>({
    mutationKey: ["schemes", "pmjay"],
    mutationFn: (body) => api.schemes.pmjayHospitals(body),
  });
}

export function useVerifyDoctor() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<DoctorVerifyRes, ApiError, DoctorVerifyReq>({
    mutationKey: ["doctors", "verify"],
    mutationFn: (body) => api.doctors.verify(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_ROOTS.doctors] }),
  });
}

export function useExtractPrescription() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<PrescriptionExtractRes, ApiError, PrescriptionExtractReq>({
    mutationKey: ["prescriptions", "extract"],
    mutationFn: (body) => api.prescriptions.extract(body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: [QUERY_ROOTS.prescriptions] }),
        qc.invalidateQueries({ queryKey: [QUERY_ROOTS.activeItems] }),
        qc.invalidateQueries({ queryKey: [QUERY_ROOTS.interactions] }),
      ]),
  });
}

export function useAnalyzeReport() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<ReportAnalyzeRes, ApiError, ReportAnalyzeReq>({
    mutationKey: ["reports", "analyze"],
    mutationFn: (body) => api.reports.analyze(body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: [QUERY_ROOTS.labReports] }),
        qc.invalidateQueries({ queryKey: [QUERY_ROOTS.labValues] }),
      ]),
  });
}

// A patient corrects one value the AI read; the server recomputes the flag (ADR-062).
export function useCorrectLabValue() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<LabValueCorrectRes, ApiError, LabValueCorrectReq>({
    mutationKey: ["reports", "correctValue"],
    mutationFn: (body) => api.reports.correctValue(body),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: [QUERY_ROOTS.labReports] }),
        qc.invalidateQueries({ queryKey: [QUERY_ROOTS.labValues] }),
      ]),
  });
}

// Named "Generate" so it never clashes with the DB hook useCarePlan (reads a saved plan).
export function useGenerateCarePlan() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<GenerateCarePlanRes, ApiError, GenerateCarePlanReq>({
    mutationKey: ["care-plans", "generate"],
    mutationFn: (body) => api.carePlans.generate(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_ROOTS.carePlans] }),
  });
}

export function useCheckInteractions() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<InteractionsRes, ApiError, InteractionsReq>({
    mutationKey: ["interactions", "check"],
    mutationFn: (body) => api.interactions.check(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_ROOTS.interactions] }),
  });
}

export function useTriage() {
  const api = useApi();
  return useMutation<TriageRes, ApiError, TriageReq>({
    mutationKey: ["triage"],
    mutationFn: (body) => api.triage.assess(body),
  });
}

/** Read-only shared record for the public share page. Disabled until a token is present. */
export function useSharedRecord(token: string | null | undefined) {
  const api = useApi();
  return useQuery<ShareRes, ApiError>({
    queryKey: [QUERY_ROOTS.sharedRecord, token],
    queryFn: () => api.share.get(token as string),
    enabled: Boolean(token),
    retry: false,
    // One visit is one open (#237): the server counts every read of the record, so a doctor
    // switching tabs and back must not count as opening the link again.
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 30,
  });
}

export function useExportMyData() {
  const api = useApi();
  return useMutation<MeExportRes, ApiError, void>({
    mutationKey: ["me", "export"],
    mutationFn: () => api.me.exportData(),
  });
}

/** Deletes the account; clears every cached query on success. */
export function useDeleteAccount() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<OkRes, ApiError, void>({
    mutationKey: ["me", "delete"],
    mutationFn: () => api.me.deleteAccount(),
    onSuccess: () => qc.clear(),
  });
}
