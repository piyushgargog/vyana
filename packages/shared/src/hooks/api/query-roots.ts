// First element of the React Query keys that the API hooks invalidate on success.
// The DB hooks in hooks/db must start their query keys with these, e.g. [QUERY_ROOTS.prescriptions, id].
export const QUERY_ROOTS = {
  prescriptions: "prescriptions",
  activeItems: "active-items",
  labReports: "lab-reports",
  labValues: "lab-values",
  doctors: "doctors",
  emergency: "emergency",
  carePlans: "care-plans",
  interactions: "interactions",
  hospitals: "hospitals",
  appointments: "appointments",
  careLinks: "care-links",
  shareLinks: "share-links",
  sharedRecord: "shared-record",
  basketJob: "basket-job",
  plans: "plans",
  aiUsage: "ai-usage",
} as const;
