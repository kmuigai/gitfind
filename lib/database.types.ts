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
      repos: {
        Row: {
          id: string
          github_id: number
          name: string
          owner: string
          description: string | null
          stars: number
          forks: number
          contributors: number
          language: string | null
          url: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          github_id: number
          name: string
          owner: string
          description?: string | null
          stars?: number
          forks?: number
          contributors?: number
          language?: string | null
          url: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          github_id?: number
          name?: string
          owner?: string
          description?: string | null
          stars?: number
          forks?: number
          contributors?: number
          language?: string | null
          url?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrichments: {
        Row: {
          id: string
          repo_id: string
          summary: string
          why_it_matters: string
          category: string
          early_signal_score: number
          score_breakdown: Json | null
          scored_at: string
        }
        Insert: {
          id?: string
          repo_id: string
          summary: string
          why_it_matters: string
          category: string
          early_signal_score: number
          score_breakdown?: Json | null
          scored_at?: string
        }
        Update: {
          id?: string
          repo_id?: string
          summary?: string
          why_it_matters?: string
          category?: string
          early_signal_score?: number
          score_breakdown?: Json | null
          scored_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'enrichments_repo_id_fkey'
            columns: ['repo_id']
            isOneToOne: true
            referencedRelation: 'repos'
            referencedColumns: ['id']
          }
        ]
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          id: string
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
        }
        Relationships: []
      }
      submissions: {
        Row: {
          id: string
          repo_url: string
          email: string
          note: string | null
          status: string
          submitted_at: string
        }
        Insert: {
          id?: string
          repo_url: string
          email: string
          note?: string | null
          status?: string
          submitted_at?: string
        }
        Update: {
          id?: string
          repo_url?: string
          email?: string
          note?: string | null
          status?: string
          submitted_at?: string
        }
        Relationships: []
      }
      tool_contributions: {
        Row: {
          id: string
          repo_id: string
          tool_name: string
          commit_count: number
          month: string
        }
        Insert: {
          id?: string
          repo_id: string
          tool_name: string
          commit_count?: number
          month: string
        }
        Update: {
          id?: string
          repo_id?: string
          tool_name?: string
          commit_count?: number
          month?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tool_contributions_repo_id_fkey'
            columns: ['repo_id']
            isOneToOne: false
            referencedRelation: 'repos'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type InsertTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type UpdateTables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Repo = Tables<'repos'>
export type Enrichment = Tables<'enrichments'>
export type Category = Tables<'categories'>
export type Subscriber = Tables<'subscribers'>
export type Submission = Tables<'submissions'>
export type ToolContribution = Tables<'tool_contributions'>

export type RepoWithEnrichment = Repo & {
  enrichment: Enrichment | null
}
