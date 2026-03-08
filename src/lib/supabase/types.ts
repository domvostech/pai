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
      clients: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          email?: string | null
          created_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          user_id: string
          client_id: string | null
          name: string
          total_budget: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          client_id?: string | null
          name: string
          total_budget?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          client_id?: string | null
          name?: string
          total_budget?: number
          created_at?: string
        }
      }
      expenses: {
        Row: {
          id: string
          project_id: string | null
          user_id: string
          vendor: string | null
          amount: number
          date: string
          category: 'general' | 'transport'
          notes: string | null
          receipt_path: string | null
          is_return: boolean
          ocr_confidence: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          project_id?: string | null
          user_id: string
          vendor?: string | null
          amount: number
          date: string
          category: 'general' | 'transport'
          notes?: string | null
          receipt_path?: string | null
          is_return?: boolean
          ocr_confidence?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          project_id?: string | null
          user_id?: string
          vendor?: string | null
          amount?: number
          date?: string
          category?: 'general' | 'transport'
          notes?: string | null
          receipt_path?: string | null
          is_return?: boolean
          ocr_confidence?: Json | null
          created_at?: string
        }
      }
      inbound_tokens: {
        Row: {
          id: string
          user_id: string
          token: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          token?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          token?: string
          created_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      expense_category: 'general' | 'transport'
    }
  }
}
