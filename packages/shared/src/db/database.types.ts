// Generated from supabase/migrations with the generator behind `supabase gen types typescript`.
// Do not edit by hand: regenerate after a schema change (see supabase/README.md).
// Owner: Vaibhav Parmar

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      ai_runs: {
        Row: {
          created_at: string
          feature: string
          id: string
          input_ref: string | null
          input_tokens: number | null
          latency_ms: number | null
          model: string | null
          output_json: Json | null
          output_tokens: number | null
          prompt_version: string | null
          provider: string | null
          report_note: string | null
          sources: Json | null
          status: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          feature: string
          id?: string
          input_ref?: string | null
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_json?: Json | null
          output_tokens?: number | null
          prompt_version?: string | null
          provider?: string | null
          report_note?: string | null
          sources?: Json | null
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          input_ref?: string | null
          input_tokens?: number | null
          latency_ms?: number | null
          model?: string | null
          output_json?: Json | null
          output_tokens?: number | null
          prompt_version?: string | null
          provider?: string | null
          report_note?: string | null
          sources?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          appointment_date: string
          created_at: string
          department_id: string
          doctor_id: string | null
          doctor_notes: string | null
          hospital_id: string
          id: string
          patient_id: string
          reason: string | null
          scheduled_at: string | null
          status: string
          token_no: number
        }
        ComputedFields: never
        Insert: {
          appointment_date: string
          created_at?: string
          department_id: string
          doctor_id?: string | null
          doctor_notes?: string | null
          hospital_id: string
          id?: string
          patient_id: string
          reason?: string | null
          scheduled_at?: string | null
          status?: string
          token_no: number
        }
        Update: {
          appointment_date?: string
          created_at?: string
          department_id?: string
          doctor_id?: string | null
          doctor_notes?: string | null
          hospital_id?: string
          id?: string
          patient_id?: string
          reason?: string | null
          scheduled_at?: string | null
          status?: string
          token_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "appointments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      blood_requests: {
        Row: {
          blood_group: string
          city: string
          component: string
          contact_name: string
          contact_phone: string
          created_at: string
          hospital_name: string
          id: string
          note: string | null
          patient_id: string
          status: string
          units: number
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          blood_group: string
          city: string
          component: string
          contact_name: string
          contact_phone: string
          created_at?: string
          hospital_name: string
          id?: string
          note?: string | null
          patient_id: string
          status?: string
          units: number
          updated_at?: string
        }
        Update: {
          blood_group?: string
          city?: string
          component?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          hospital_name?: string
          id?: string
          note?: string | null
          patient_id?: string
          status?: string
          units?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blood_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_invite_attempts: {
        Row: {
          attempted_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          attempted_at?: string
          user_id: string
        }
        Update: {
          attempted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_invite_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_invites: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          patient_id: string
          used_at: string | null
          used_by: string | null
        }
        ComputedFields: never
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          patient_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          patient_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_invites_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_links: {
        Row: {
          caregiver_id: string
          created_at: string
          id: string
          patient_id: string
          relation: string | null
          status: string
        }
        ComputedFields: never
        Insert: {
          caregiver_id: string
          created_at?: string
          id?: string
          patient_id: string
          relation?: string | null
          status?: string
        }
        Update: {
          caregiver_id?: string
          created_at?: string
          id?: string
          patient_id?: string
          relation?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_links_caregiver_id_fkey"
            columns: ["caregiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_links_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plans: {
        Row: {
          condition_id: string
          created_at: string
          id: string
          language: string
          patient_id: string
          plan_json: NonNullable<Json>
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          condition_id: string
          created_at?: string
          id?: string
          language?: string
          patient_id: string
          plan_json: NonNullable<Json>
          reviewed_at?: string | null
          reviewed_by?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          condition_id?: string
          created_at?: string
          id?: string
          language?: string
          patient_id?: string
          plan_json?: NonNullable<Json>
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plans_condition_id_fkey"
            columns: ["condition_id"]
            isOneToOne: false
            referencedRelation: "conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_plans_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string
          id: string
          parts: NonNullable<Json>
          role: string
          session_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          parts: NonNullable<Json>
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parts?: NonNullable<Json>
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          created_at: string
          id: string
          title: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conditions: {
        Row: {
          active: boolean
          created_at: string
          diagnosed_by: string | null
          diagnosed_on: string | null
          id: string
          name: string
          notes: string | null
          patient_id: string
          prescription_id: string | null
          source: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          created_at?: string
          diagnosed_by?: string | null
          diagnosed_on?: string | null
          id?: string
          name: string
          notes?: string | null
          patient_id: string
          prescription_id?: string | null
          source?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          diagnosed_by?: string | null
          diagnosed_on?: string | null
          id?: string
          name?: string
          notes?: string | null
          patient_id?: string
          prescription_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "conditions_diagnosed_by_fkey"
            columns: ["diagnosed_by"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conditions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conditions_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          accepted_at: string
          id: string
          user_id: string
          version: string
        }
        ComputedFields: never
        Insert: {
          accepted_at?: string
          id?: string
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          id?: string
          user_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "consents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          daily_token_limit: number
          hospital_id: string
          id: string
          name: string
          opd_days: number[]
          opd_end: string
          opd_start: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          daily_token_limit?: number
          hospital_id: string
          id?: string
          name: string
          opd_days?: number[]
          opd_end?: string
          opd_start?: string
        }
        Update: {
          created_at?: string
          daily_token_limit?: number
          hospital_id?: string
          id?: string
          name?: string
          opd_days?: number[]
          opd_end?: string
          opd_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      doctors: {
        Row: {
          availability: NonNullable<Json>
          clinic_address: string | null
          clinic_name: string | null
          consultation_fee: number | null
          created_at: string
          department_id: string | null
          hospital_id: string | null
          id: string
          reg_no: string
          specialization: string
          state_council: string
          verification_json: Json | null
          verification_status: string
          verified_at: string | null
          year_of_registration: number | null
        }
        ComputedFields: never
        Insert: {
          availability?: NonNullable<Json>
          clinic_address?: string | null
          clinic_name?: string | null
          consultation_fee?: number | null
          created_at?: string
          department_id?: string | null
          hospital_id?: string | null
          id: string
          reg_no: string
          specialization: string
          state_council: string
          verification_json?: Json | null
          verification_status?: string
          verified_at?: string | null
          year_of_registration?: number | null
        }
        Update: {
          availability?: NonNullable<Json>
          clinic_address?: string | null
          clinic_name?: string | null
          consultation_fee?: number | null
          created_at?: string
          department_id?: string | null
          hospital_id?: string | null
          id?: string
          reg_no?: string
          specialization?: string
          state_council?: string
          verification_json?: Json | null
          verification_status?: string
          verified_at?: string | null
          year_of_registration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "doctors_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctors_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "doctors_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dose_logs: {
        Row: {
          id: string
          item_id: string
          logged_at: string
          patient_id: string
          scheduled_for: string
          status: string
        }
        ComputedFields: never
        Insert: {
          id?: string
          item_id: string
          logged_at?: string
          patient_id: string
          scheduled_for: string
          status: string
        }
        Update: {
          id?: string
          item_id?: string
          logged_at?: string
          patient_id?: string
          scheduled_for?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "dose_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "prescription_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drug_alerts: {
        Row: {
          created_at: string
          id: string
          medicine_name: string
          patient_id: string
          seen: boolean
          snippet: string | null
          title: string
          url: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          medicine_name: string
          patient_id: string
          seen?: boolean
          snippet?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          medicine_name?: string
          patient_id?: string
          seen?: boolean
          snippet?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "drug_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_contacts: {
        Row: {
          created_at: string
          id: string
          name: string
          patient_id: string
          phone: string
          relation: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          name: string
          patient_id: string
          phone: string
          relation?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          patient_id?: string
          phone?: string
          relation?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      emergency_requests: {
        Row: {
          area: string | null
          created_at: string
          eta_minutes: number | null
          hospitals_json: Json | null
          id: string
          lat: number
          lng: number
          note: string | null
          patient_id: string
          status: string
        }
        ComputedFields: never
        Insert: {
          area?: string | null
          created_at?: string
          eta_minutes?: number | null
          hospitals_json?: Json | null
          id?: string
          lat: number
          lng: number
          note?: string | null
          patient_id: string
          status?: string
        }
        Update: {
          area?: string | null
          created_at?: string
          eta_minutes?: number | null
          hospitals_json?: Json | null
          id?: string
          lat?: number
          lng?: number
          note?: string | null
          patient_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          address: string | null
          city: string
          created_at: string
          id: string
          kind: string
          lat: number | null
          lng: number | null
          name: string
          opd_info: Json | null
          opd_info_fetched_at: string | null
          ors_enabled: boolean
          phone: string | null
          pmjay_empanelled: boolean | null
          website: string | null
        }
        ComputedFields: never
        Insert: {
          address?: string | null
          city?: string
          created_at?: string
          id?: string
          kind: string
          lat?: number | null
          lng?: number | null
          name: string
          opd_info?: Json | null
          opd_info_fetched_at?: string | null
          ors_enabled?: boolean
          phone?: string | null
          pmjay_empanelled?: boolean | null
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string
          created_at?: string
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          name?: string
          opd_info?: Json | null
          opd_info_fetched_at?: string | null
          ors_enabled?: boolean
          phone?: string | null
          pmjay_empanelled?: boolean | null
          website?: string | null
        }
        Relationships: []
      }
      interaction_checks: {
        Row: {
          created_at: string
          id: string
          medicines_key: string
          patient_id: string
          result_json: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          medicines_key: string
          patient_id: string
          result_json: NonNullable<Json>
        }
        Update: {
          created_at?: string
          id?: string
          medicines_key?: string
          patient_id?: string
          result_json?: NonNullable<Json>
        }
        Relationships: [
          {
            foreignKeyName: "interaction_checks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_reports: {
        Row: {
          created_at: string
          extracted_json: Json | null
          file_path: string
          id: string
          lab_name: string | null
          patient_id: string
          report_date: string | null
          status: string
          summary: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          extracted_json?: Json | null
          file_path: string
          id?: string
          lab_name?: string | null
          patient_id: string
          report_date?: string | null
          status?: string
          summary?: string | null
        }
        Update: {
          created_at?: string
          extracted_json?: Json | null
          file_path?: string
          id?: string
          lab_name?: string | null
          patient_id?: string
          report_date?: string | null
          status?: string
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_values: {
        Row: {
          created_at: string
          flag: string
          id: string
          measured_on: string | null
          patient_id: string
          ref_high: number | null
          ref_low: number | null
          report_id: string
          test_name: string
          unit: string | null
          value: number | null
          value_text: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          flag?: string
          id?: string
          measured_on?: string | null
          patient_id: string
          ref_high?: number | null
          ref_low?: number | null
          report_id: string
          test_name: string
          unit?: string | null
          value?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          flag?: string
          id?: string
          measured_on?: string | null
          patient_id?: string
          ref_high?: number | null
          ref_low?: number | null
          report_id?: string
          test_name?: string
          unit?: string | null
          value?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_values_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_values_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "lab_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_logs: {
        Row: {
          calories: number | null
          created_at: string
          description: string
          id: string
          logged_at: string
          meal: string
          patient_id: string
        }
        ComputedFields: never
        Insert: {
          calories?: number | null
          created_at?: string
          description: string
          id?: string
          logged_at?: string
          meal: string
          patient_id: string
        }
        Update: {
          calories?: number | null
          created_at?: string
          description?: string
          id?: string
          logged_at?: string
          meal?: string
          patient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      missed_dose_alerts: {
        Row: {
          item_id: string
          scheduled_for: string
          sent_at: string
        }
        ComputedFields: never
        Insert: {
          item_id: string
          scheduled_for: string
          sent_at?: string
        }
        Update: {
          item_id?: string
          scheduled_for?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "missed_dose_alerts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "prescription_items"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          daily_ai_calls: number | null
          features: NonNullable<Json>
          id: string
          max_profiles: number | null
          name: string
        }
        ComputedFields: never
        Insert: {
          daily_ai_calls?: number | null
          features?: NonNullable<Json>
          id: string
          max_profiles?: number | null
          name: string
        }
        Update: {
          daily_ai_calls?: number | null
          features?: NonNullable<Json>
          id?: string
          max_profiles?: number | null
          name?: string
        }
        Relationships: []
      }
      prescription_items: {
        Row: {
          active: boolean
          created_at: string
          dose: string | null
          duration_days: number | null
          end_date: string | null
          form: string
          frequency: string
          id: string
          instructions: string | null
          medicine_name: string
          patient_id: string
          prescription_id: string
          quantity_total: number | null
          refill_alert_days: number
          start_date: string
          strength: string | null
          times: string[]
          with_food: string
        }
        ComputedFields: never
        Insert: {
          active?: boolean
          created_at?: string
          dose?: string | null
          duration_days?: number | null
          end_date?: string | null
          form?: string
          frequency: string
          id?: string
          instructions?: string | null
          medicine_name: string
          patient_id: string
          prescription_id: string
          quantity_total?: number | null
          refill_alert_days?: number
          start_date?: string
          strength?: string | null
          times?: string[]
          with_food?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          dose?: string | null
          duration_days?: number | null
          end_date?: string | null
          form?: string
          frequency?: string
          id?: string
          instructions?: string | null
          medicine_name?: string
          patient_id?: string
          prescription_id?: string
          quantity_total?: number | null
          refill_alert_days?: number
          start_date?: string
          strength?: string | null
          times?: string[]
          with_food?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescription_items_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_items_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          appointment_id: string | null
          created_at: string
          diagnosis: string | null
          doctor_id: string | null
          doctor_name: string | null
          file_path: string | null
          id: string
          issued_on: string
          notes: string | null
          patient_id: string
          source: string
        }
        ComputedFields: never
        Insert: {
          appointment_id?: string | null
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string | null
          doctor_name?: string | null
          file_path?: string | null
          id?: string
          issued_on?: string
          notes?: string | null
          patient_id: string
          source: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          diagnosis?: string | null
          doctor_id?: string | null
          doctor_name?: string | null
          file_path?: string | null
          id?: string
          issued_on?: string
          notes?: string | null
          patient_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_quotes: {
        Row: {
          fetched_at: string
          id: string
          in_stock: boolean | null
          kind: string
          mrp: number | null
          pack_size: string | null
          price: number | null
          product_name: string
          product_url: string | null
          query: string
          source: string
        }
        ComputedFields: never
        Insert: {
          fetched_at?: string
          id?: string
          in_stock?: boolean | null
          kind: string
          mrp?: number | null
          pack_size?: string | null
          price?: number | null
          product_name: string
          product_url?: string | null
          query: string
          source: string
        }
        Update: {
          fetched_at?: string
          id?: string
          in_stock?: boolean | null
          kind?: string
          mrp?: number | null
          pack_size?: string | null
          price?: number | null
          product_name?: string
          product_url?: string | null
          query?: string
          source?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allergies: string[]
          blood_group: string | null
          city: string | null
          created_at: string
          dob: string | null
          full_name: string | null
          gender: string | null
          id: string
          onboarded: boolean
          phone: string | null
          preferred_language: string
          role: string
        }
        ComputedFields: never
        Insert: {
          allergies?: string[]
          blood_group?: string | null
          city?: string | null
          created_at?: string
          dob?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          onboarded?: boolean
          phone?: string | null
          preferred_language?: string
          role?: string
        }
        Update: {
          allergies?: string[]
          blood_group?: string | null
          city?: string | null
          created_at?: string
          dob?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          onboarded?: boolean
          phone?: string | null
          preferred_language?: string
          role?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          hits: number
          user_id: string
          window_start: string
        }
        ComputedFields: never
        Insert: {
          bucket: string
          hits?: number
          user_id: string
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_limits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string
          expires_at: string
          kind: string
          last_opened_at: string | null
          open_count: number
          patient_id: string
          revoked: boolean
          scopes: string[]
          token: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          expires_at: string
          kind: string
          last_opened_at?: string | null
          open_count?: number
          patient_id: string
          revoked?: boolean
          scopes?: string[]
          token?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          kind?: string
          last_opened_at?: string | null
          open_count?: number
          patient_id?: string
          revoked?: boolean
          scopes?: string[]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tinyfish_monitors: {
        Row: {
          created_at: string
          id: string
          query: string
          tinyfish_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          query: string
          tinyfish_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          tinyfish_id?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          plan_id: string
          since: string
          source: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          plan_id: string
          since?: string
          source?: string
          user_id: string
        }
        Update: {
          plan_id?: string
          since?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vitals: {
        Row: {
          created_at: string
          id: string
          measured_at: string
          patient_id: string
          type: string
          unit: string
          value: number
          value2: number | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          measured_at?: string
          patient_id: string
          type: string
          unit: string
          value: number
          value2?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          measured_at?: string
          patient_id?: string
          type?: string
          unit?: string
          value?: number
          value2?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vitals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          note: string | null
          plan_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          email: string
          id?: string
          note?: string | null
          plan_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          note?: string | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      web_cache: {
        Row: {
          expires_at: string
          fetched_at: string
          key: string
          kind: string
          payload: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          expires_at: string
          fetched_at?: string
          key: string
          kind: string
          payload: NonNullable<Json>
        }
        Update: {
          expires_at?: string
          fetched_at?: string
          key?: string
          kind?: string
          payload?: NonNullable<Json>
        }
        Relationships: []
      }
    }
    Views: {
      ai_usage_daily: {
        Row: {
          calls: number | null
          day: string | null
          feature: string | null
          input_tokens: number | null
          output_tokens: number | null
          user_id: string | null
        }
        ComputedFields: never
        Relationships: [
          {
            foreignKeyName: "ai_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_care_invite: {
        Args: { p_code: string; p_relation?: string }
        Returns: {
          caregiver_id: string
          created_at: string
          id: string
          patient_id: string
          relation: string | null
          status: string
        }
        SetofOptions: {
          from: "*"
          to: "care_links"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      book_appointment: {
        Args: {
          p_date: string
          p_department: string
          p_doctor: string
          p_hospital: string
          p_reason: string
        }
        Returns: {
          appointment_date: string
          created_at: string
          department_id: string
          doctor_id: string | null
          doctor_notes: string | null
          hospital_id: string
          id: string
          patient_id: string
          reason: string | null
          scheduled_at: string | null
          status: string
          token_no: number
        }
        SetofOptions: {
          from: "*"
          to: "appointments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      bump_share_open: { Args: { p_token: string }; Returns: undefined }
      create_care_invite: { Args: Record<PropertyKey, never>; Returns: string }
      create_doctor_prescription: {
        Args: {
          p_appointment: string
          p_diagnosis: string
          p_items: Json
          p_notes: string
          p_patient: string
        }
        Returns: string
      }
      current_plan: {
        Args: Record<PropertyKey, never>
        Returns: {
          daily_ai_calls: number
          features: Json
          max_profiles: number
          name: string
          plan_id: string
          since: string
          source: string
        }[]
      }
      department_tokens: {
        Args: { p_date: string; p_department: string }
        Returns: {
          daily_token_limit: number
          opd_open: boolean
          tokens_left: number
        }[]
      }
      doctor_directory: {
        Args: { p_department?: string; p_hospital?: string; p_id?: string }
        Returns: {
          availability: Json
          clinic_address: string
          clinic_name: string
          consultation_fee: number
          department_id: string
          full_name: string
          hospital_id: string
          id: string
          reg_no: string
          specialization: string
          state_council: string
          verified_at: string
          year_of_registration: number
        }[]
      }
      hit_rate_limit: {
        Args: {
          p_bucket: string
          p_max: number
          p_user: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
      }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_caregiver_of: { Args: { p: string }; Returns: boolean }
      is_doctor_of: { Args: { p: string }; Returns: boolean }
      join_waitlist: {
        Args: { p_email: string; p_note?: string; p_plan_id: string }
        Returns: {
          created_at: string
          email: string
          id: string
          note: string
          plan_id: string
        }[]
      }
      my_ai_usage_today: {
        Args: Record<PropertyKey, never>
        Returns: {
          calls: number
          input_tokens: number
          output_tokens: number
        }[]
      }
      my_caregivers: {
        Args: Record<PropertyKey, never>
        Returns: {
          caregiver_id: string
          created_at: string
          full_name: string
          link_id: string
          relation: string
          status: string
        }[]
      }
      my_verified_department: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      run_missed_dose_check: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
