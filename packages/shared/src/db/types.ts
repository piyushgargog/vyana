// packages/shared/src/db/types.ts
// Row aliases for direct-DB code. Plain names (CarePlan, PrescriptionItem, ...) belong to the API contracts.
// Owner: Vaibhav Parmar

import type { Tables } from "./database.types";

export type DbProfile = Tables<"profiles">;
export type DbDoctor = Tables<"doctors">;
export type DbEmergencyContact = Tables<"emergency_contacts">;
export type DbCondition = Tables<"conditions">;
export type DbHospital = Tables<"hospitals">;
export type DbDepartment = Tables<"departments">;
export type DbAppointment = Tables<"appointments">;
export type DbPrescription = Tables<"prescriptions">;
export type DbPrescriptionItem = Tables<"prescription_items">;
export type DbDoseLog = Tables<"dose_logs">;
export type DbLabReport = Tables<"lab_reports">;
export type DbLabValue = Tables<"lab_values">;
export type DbVital = Tables<"vitals">;
export type DbDailyActivity = Tables<"daily_activity">;
export type DbDeviceConnection = Tables<"device_connections">;
export type DbWeeklySummary = Tables<"weekly_summaries">;
export type DbMealLog = Tables<"meal_logs">;
export type DbCarePlan = Tables<"care_plans">;
export type DbCareInvite = Tables<"care_invites">;
export type DbCareLink = Tables<"care_links">;
export type DbShareLink = Tables<"share_links">;
export type DbInteractionCheck = Tables<"interaction_checks">;
export type DbConsent = Tables<"consents">;
export type DbAiRun = Tables<"ai_runs">;
export type DbAgentProposal = Tables<"agent_proposals">;
export type DbAgentAction = Tables<"agent_actions">;
export type DbChatSession = Tables<"chat_sessions">;
export type DbChatMessage = Tables<"chat_messages">;
export type DbEmergencyRequest = Tables<"emergency_requests">;
export type DbPriceQuote = Tables<"price_quotes">;
export type DbPushToken = Tables<"push_tokens">;
export type DbBloodRequest = Tables<"blood_requests">;
