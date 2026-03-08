export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
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
        Relationships: []
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
        Relationships: [
          {
            foreignKeyName: 'projects_client_id_fkey'
            columns: ['client_id']
            isOneToOne: false
            referencedRelation: 'clients'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: [
          {
            foreignKeyName: 'expenses_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          }
        ]
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
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      expense_category: 'general' | 'transport'
    }
  }
}
