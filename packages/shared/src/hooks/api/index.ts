"use client";

// React Query mutations for every API route. Each one reads the client from useApi().
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ApiError } from "../../api/client";
import { useApi } from "../../api/context";
import type {
  AlertsCheckRes,
  DoctorVerifyReq,
  DoctorVerifyRes,
  EmergencyNearbyReq,
  EmergencyNearbyRes,
  EmergencySosReq,
  EmergencySosRes,
  LabsCompareReq,
  LabsCompareRes,
  MedicinesCompareReq,
  MedicinesCompareRes,
  NutritionPlanReq,
  NutritionPlanRes,
  PrescriptionExtractReq,
  PrescriptionExtractRes,
  ReportAnalyzeReq,
  ReportAnalyzeRes,
} from "../../contracts";
import { QUERY_ROOTS } from "./query-roots";

export { QUERY_ROOTS } from "./query-roots";

export function useCompareMedicine() {
  const api = useApi();
  return useMutation<MedicinesCompareRes, ApiError, MedicinesCompareReq>({
    mutationKey: ["medicines", "compare"],
    mutationFn: (body) => api.medicines.compare(body),
  });
}

export function useCompareLabTest() {
  const api = useApi();
  return useMutation<LabsCompareRes, ApiError, LabsCompareReq>({
    mutationKey: ["labs", "compare"],
    mutationFn: (body) => api.labs.compare(body),
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

// Named "Generate" so it never clashes with the DB hook useNutritionPlan (reads the latest saved plan).
export function useGenerateNutritionPlan() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<NutritionPlanRes, ApiError, NutritionPlanReq>({
    mutationKey: ["nutrition", "plan"],
    mutationFn: (body) => api.nutrition.plan(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_ROOTS.nutritionPlan] }),
  });
}

export function useCheckAlerts() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<AlertsCheckRes, ApiError, void>({
    mutationKey: ["alerts", "check"],
    mutationFn: () => api.alerts.check(),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_ROOTS.drugAlerts] }),
  });
}
