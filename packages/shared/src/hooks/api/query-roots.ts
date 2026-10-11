// First element of the React Query keys that the API hooks invalidate on success.
// The DB hooks in hooks/db must start their query keys with these, e.g. [QUERY_ROOTS.prescriptions, id].
export const QUERY_ROOTS = {
  prescriptions: "prescriptions",
  activeItems: "active-items",
  labReports: "lab-reports",
  labValues: "lab-values",
  nutritionPlan: "nutrition-plan",
  drugAlerts: "drug-alerts",
  doctors: "doctors",
  emergency: "emergency",
} as const;
