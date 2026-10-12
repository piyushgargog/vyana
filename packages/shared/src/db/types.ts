// packages/shared/src/db/types.ts
// Owner: Vaibhav Parmar

import type { Database } from './database.types';

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Inserts<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type Updates<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];

export type Profile = Tables<'profiles'>;
export type Doctor = Tables<'doctors'>;
export type EmergencyContact = Tables<'emergency_contacts'>;
export type Condition = Tables<'conditions'>;
export type Appointment = Tables<'appointments'>;
export type Prescription = Tables<'prescriptions'>;
export type DbPrescriptionItem = Tables<'prescription_items'>;
export type DoseLog = Tables<'dose_logs'>;
export type LabReport = Tables<'lab_reports'>;
export type DbLabValue = Tables<'lab_values'>;
export type Vital = Tables<'vitals'>;
export type MealLog = Tables<'meal_logs'>;
export type NutritionPlan = Tables<'nutrition_plans'>;
export type ChatSession = Tables<'chat_sessions'>;
export type ChatMessage = Tables<'chat_messages'>;
export type EmergencyRequest = Tables<'emergency_requests'>;
export type DbPriceQuote = Tables<'price_quotes'>;
export type DbDrugAlert = Tables<'drug_alerts'>;
export type PushToken = Tables<'push_tokens'>;
export type WebCache = Tables<'web_cache'>;
export type TinyfishMonitor = Tables<'tinyfish_monitors'>;

// Explicit Db-prefixed aliases for full consistency
export type DbProfile = Profile;
export type DbDoctor = Doctor;
export type DbEmergencyContact = EmergencyContact;
export type DbCondition = Condition;
export type DbAppointment = Appointment;
export type DbPrescription = Prescription;
export type DbDoseLog = DoseLog;
export type DbLabReport = LabReport;
export type DbVital = Vital;
export type DbMealLog = MealLog;
export type DbNutritionPlan = NutritionPlan;
export type DbChatSession = ChatSession;
export type DbChatMessage = ChatMessage;
export type DbEmergencyRequest = EmergencyRequest;
export type DbPushToken = PushToken;
export type DbWebCache = WebCache;
export type DbTinyfishMonitor = TinyfishMonitor;
