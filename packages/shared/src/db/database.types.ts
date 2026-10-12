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
      profiles: {
        Row: {
          id: string
          role: 'patient' | 'doctor' | 'admin'
          full_name: string | null
          phone: string | null
          dob: string | null
          gender: 'male' | 'female' | 'other' | null
          blood_group: string | null
          allergies: string[]
          city: string | null
          onboarded: boolean
          created_at: string
        }
        Insert: {
          id: string
          role?: 'patient' | 'doctor' | 'admin'
          full_name?: string | null
          phone?: string | null
          dob?: string | null
          gender?: 'male' | 'female' | 'other' | null
          blood_group?: string | null
          allergies?: string[]
          city?: string | null
          onboarded?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          role?: 'patient' | 'doctor' | 'admin'
          full_name?: string | null
          phone?: string | null
          dob?: string | null
          gender?: 'male' | 'female' | 'other' | null
          blood_group?: string | null
          allergies?: string[]
          city?: string | null
          onboarded?: boolean
          created_at?: string
        }
        Relationships: []
      }
      doctors: {
        Row: {
          id: string
          specialization: string
          reg_no: string
          state_council: string
          year_of_registration: number | null
          clinic_name: string | null
          clinic_address: string | null
          consultation_fee: number | null
          availability: Json
          verification_status: 'pending' | 'verified' | 'failed'
          verification_json: Json | null
          verified_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          specialization: string
          reg_no: string
          state_council: string
          year_of_registration?: number | null
          clinic_name?: string | null
          clinic_address?: string | null
          consultation_fee?: number | null
          availability?: Json
          verification_status?: 'pending' | 'verified' | 'failed'
          verification_json?: Json | null
          verified_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          specialization?: string
          reg_no?: string
          state_council?: string
          year_of_registration?: number | null
          clinic_name?: string | null
          clinic_address?: string | null
          consultation_fee?: number | null
          availability?: Json
          verification_status?: 'pending' | 'verified' | 'failed'
          verification_json?: Json | null
          verified_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "doctors_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      emergency_contacts: {
        Row: {
          id: string
          patient_id: string
          name: string
          phone: string
          relation: string | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          name: string
          phone: string
          relation?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          name?: string
          phone?: string
          relation?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_contacts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      conditions: {
        Row: {
          id: string
          patient_id: string
          name: string
          diagnosed_on: string | null
          notes: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          name: string
          diagnosed_on?: string | null
          notes?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          name?: string
          diagnosed_on?: string | null
          notes?: string | null
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conditions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      appointments: {
        Row: {
          id: string
          patient_id: string
          doctor_id: string
          scheduled_at: string
          status: 'requested' | 'confirmed' | 'completed' | 'cancelled'
          reason: string | null
          doctor_notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          doctor_id: string
          scheduled_at: string
          status?: 'requested' | 'confirmed' | 'completed' | 'cancelled'
          reason?: string | null
          doctor_notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          doctor_id?: string
          scheduled_at?: string
          status?: 'requested' | 'confirmed' | 'completed' | 'cancelled'
          reason?: string | null
          doctor_notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      prescriptions: {
        Row: {
          id: string
          patient_id: string
          doctor_id: string | null
          appointment_id: string | null
          source: 'upload' | 'doctor'
          file_path: string | null
          doctor_name: string | null
          diagnosis: string | null
          notes: string | null
          issued_on: string
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          doctor_id?: string | null
          appointment_id?: string | null
          source: 'upload' | 'doctor'
          file_path?: string | null
          doctor_name?: string | null
          diagnosis?: string | null
          notes?: string | null
          issued_on?: string
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          doctor_id?: string | null
          appointment_id?: string | null
          source?: 'upload' | 'doctor'
          file_path?: string | null
          doctor_name?: string | null
          diagnosis?: string | null
          notes?: string | null
          issued_on?: string
          created_at?: string
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
          }
        ]
      }
      prescription_items: {
        Row: {
          id: string
          prescription_id: string
          patient_id: string
          medicine_name: string
          strength: string | null
          form: 'tablet' | 'capsule' | 'syrup' | 'injection' | 'drops' | 'inhaler' | 'other'
          dose: string | null
          frequency: 'OD' | 'BD' | 'TDS' | 'QID' | 'HS' | 'SOS' | 'custom'
          times: string[]
          with_food: 'before' | 'after' | 'any'
          duration_days: number | null
          start_date: string
          end_date: string | null
          instructions: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          prescription_id: string
          patient_id: string
          medicine_name: string
          strength?: string | null
          form?: 'tablet' | 'capsule' | 'syrup' | 'injection' | 'drops' | 'inhaler' | 'other'
          dose?: string | null
          frequency: 'OD' | 'BD' | 'TDS' | 'QID' | 'HS' | 'SOS' | 'custom'
          times?: string[]
          with_food?: 'before' | 'after' | 'any'
          duration_days?: number | null
          start_date?: string
          end_date?: string | null
          instructions?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          prescription_id?: string
          patient_id?: string
          medicine_name?: string
          strength?: string | null
          form?: 'tablet' | 'capsule' | 'syrup' | 'injection' | 'drops' | 'inhaler' | 'other'
          dose?: string | null
          frequency?: 'OD' | 'BD' | 'TDS' | 'QID' | 'HS' | 'SOS' | 'custom'
          times?: string[]
          with_food?: 'before' | 'after' | 'any'
          duration_days?: number | null
          start_date?: string
          end_date?: string | null
          instructions?: string | null
          active?: boolean
          created_at?: string
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
          }
        ]
      }
      dose_logs: {
        Row: {
          id: string
          patient_id: string
          item_id: string
          scheduled_for: string
          status: 'taken' | 'missed' | 'skipped'
          logged_at: string
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          item_id: string
          scheduled_for: string
          status: 'taken' | 'missed' | 'skipped'
          logged_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          item_id?: string
          scheduled_for?: string
          status?: 'taken' | 'missed' | 'skipped'
          logged_at?: string
          created_at?: string
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
          }
        ]
      }
      lab_reports: {
        Row: {
          id: string
          patient_id: string
          file_path: string
          lab_name: string | null
          report_date: string | null
          status: 'processing' | 'done' | 'failed'
          summary: string | null
          extracted_json: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          file_path: string
          lab_name?: string | null
          report_date?: string | null
          status?: 'processing' | 'done' | 'failed'
          summary?: string | null
          extracted_json?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          file_path?: string
          lab_name?: string | null
          report_date?: string | null
          status?: 'processing' | 'done' | 'failed'
          summary?: string | null
          extracted_json?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_reports_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      lab_values: {
        Row: {
          id: string
          report_id: string
          patient_id: string
          test_name: string
          value: number | null
          value_text: string | null
          unit: string | null
          ref_low: number | null
          ref_high: number | null
          flag: 'low' | 'normal' | 'high' | 'unknown'
          measured_on: string | null
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          patient_id: string
          test_name: string
          value?: number | null
          value_text?: string | null
          unit?: string | null
          ref_low?: number | null
          ref_high?: number | null
          flag?: 'low' | 'normal' | 'high' | 'unknown'
          measured_on?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          patient_id?: string
          test_name?: string
          value?: number | null
          value_text?: string | null
          unit?: string | null
          ref_low?: number | null
          ref_high?: number | null
          flag?: 'low' | 'normal' | 'high' | 'unknown'
          measured_on?: string | null
          created_at?: string
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
          }
        ]
      }
      vitals: {
        Row: {
          id: string
          patient_id: string
          type: 'bp' | 'sugar_fasting' | 'sugar_random' | 'weight' | 'heart_rate' | 'spo2' | 'temperature'
          value: number
          value2: number | null
          unit: string
          measured_at: string
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          type: 'bp' | 'sugar_fasting' | 'sugar_random' | 'weight' | 'heart_rate' | 'spo2' | 'temperature'
          value: number
          value2?: number | null
          unit: string
          measured_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          type?: 'bp' | 'sugar_fasting' | 'sugar_random' | 'weight' | 'heart_rate' | 'spo2' | 'temperature'
          value?: number
          value2?: number | null
          unit?: string
          measured_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vitals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      meal_logs: {
        Row: {
          id: string
          patient_id: string
          meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          description: string
          calories: number | null
          logged_at: string
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          meal: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          description: string
          calories?: number | null
          logged_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          meal?: 'breakfast' | 'lunch' | 'dinner' | 'snack'
          description?: string
          calories?: number | null
          logged_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      nutrition_plans: {
        Row: {
          id: string
          patient_id: string
          plan_json: Json
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          plan_json: Json
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          plan_json?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_plans_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_sessions: {
        Row: {
          id: string
          user_id: string
          title: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          user_id: string
          role: 'user' | 'assistant'
          parts: Json
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          role: 'user' | 'assistant'
          parts: Json
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          role?: 'user' | 'assistant'
          parts?: Json
          created_at?: string
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
          }
        ]
      }
      emergency_requests: {
        Row: {
          id: string
          patient_id: string
          lat: number
          lng: number
          area: string | null
          note: string | null
          status: 'requested' | 'dispatched' | 'arriving' | 'completed' | 'cancelled'
          eta_minutes: number | null
          hospitals_json: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          lat: number
          lng: number
          area?: string | null
          note?: string | null
          status?: 'requested' | 'dispatched' | 'arriving' | 'completed' | 'cancelled'
          eta_minutes?: number | null
          hospitals_json?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          lat?: number
          lng?: number
          area?: string | null
          note?: string | null
          status?: 'requested' | 'dispatched' | 'arriving' | 'completed' | 'cancelled'
          eta_minutes?: number | null
          hospitals_json?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      price_quotes: {
        Row: {
          id: string
          kind: 'medicine' | 'lab_test'
          query: string
          source: string
          product_name: string
          pack_size: string | null
          price: number | null
          mrp: number | null
          in_stock: boolean | null
          product_url: string | null
          fetched_at: string
          created_at: string
        }
        Insert: {
          id?: string
          kind: 'medicine' | 'lab_test'
          query: string
          source: string
          product_name: string
          pack_size?: string | null
          price?: number | null
          mrp?: number | null
          in_stock?: boolean | null
          product_url?: string | null
          fetched_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          kind?: 'medicine' | 'lab_test'
          query?: string
          source?: string
          product_name?: string
          pack_size?: string | null
          price?: number | null
          mrp?: number | null
          in_stock?: boolean | null
          product_url?: string | null
          fetched_at?: string
          created_at?: string
        }
        Relationships: []
      }
      drug_alerts: {
        Row: {
          id: string
          patient_id: string
          medicine_name: string
          title: string
          url: string
          snippet: string | null
          seen: boolean
          created_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          medicine_name: string
          title: string
          url: string
          snippet?: string | null
          seen?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          medicine_name?: string
          title?: string
          url?: string
          snippet?: string | null
          seen?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drug_alerts_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      push_tokens: {
        Row: {
          user_id: string
          token: string
          platform: 'ios' | 'android' | 'web'
          updated_at: string
        }
        Insert: {
          user_id: string
          token: string
          platform: 'ios' | 'android' | 'web'
          updated_at?: string
        }
        Update: {
          user_id?: string
          token?: string
          platform?: 'ios' | 'android' | 'web'
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      web_cache: {
        Row: {
          key: string
          kind: string
          payload: Json
          fetched_at: string
          expires_at: string
          created_at: string
        }
        Insert: {
          key: string
          kind: string
          payload: Json
          fetched_at?: string
          expires_at: string
          created_at?: string
        }
        Update: {
          key?: string
          kind?: string
          payload?: Json
          fetched_at?: string
          expires_at?: string
          created_at?: string
        }
        Relationships: []
      }
      tinyfish_monitors: {
        Row: {
          id: string
          tinyfish_id: string
          query: string
          created_at: string
        }
        Insert: {
          id?: string
          tinyfish_id: string
          query: string
          created_at?: string
        }
        Update: {
          id?: string
          tinyfish_id?: string
          query?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_doctor_of: {
        Args: {
          p: string
        }
        Returns: boolean
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
