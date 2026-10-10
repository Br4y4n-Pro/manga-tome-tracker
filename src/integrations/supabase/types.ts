export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      chapter_notes: {
        Row: {
          capitulo: number
          created_at: string
          id: string
          nota: string
          series_id: string
          user_id: string
        }
        Insert: {
          capitulo: number
          created_at?: string
          id?: string
          nota: string
          series_id: string
          user_id?: string
        }
        Update: {
          capitulo?: number
          created_at?: string
          id?: string
          nota?: string
          series_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_notes_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      import_logs: {
        Row: {
          actualizadas: number
          archivo: string
          created_at: string
          id: string
          nuevas: number
          total: number
          user_id: string
        }
        Insert: {
          actualizadas?: number
          archivo: string
          created_at?: string
          id?: string
          nuevas?: number
          total?: number
          user_id?: string
        }
        Update: {
          actualizadas?: number
          archivo?: string
          created_at?: string
          id?: string
          nuevas?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      release_schedules: {
        Row: {
          activo: boolean
          cada_n_dias: number | null
          created_at: string
          dias_semana: number[]
          fecha_inicio: string
          id: string
          series_id: string
          tipo_regla: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          cada_n_dias?: number | null
          created_at?: string
          dias_semana?: number[]
          fecha_inicio?: string
          id?: string
          series_id: string
          tipo_regla: string
          user_id?: string
        }
        Update: {
          activo?: boolean
          cada_n_dias?: number | null
          created_at?: string
          dias_semana?: number[]
          fecha_inicio?: string
          id?: string
          series_id?: string
          tipo_regla?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "release_schedules_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: true
            referencedRelation: "series"
            referencedColumns: ["id"]
          },
        ]
      }
      series: {
        Row: {
          anilist_id: number | null
          anilist_url: string | null
          artista: string | null
          autor: string | null
          caps_leidos: number | null
          caps_totales: number | null
          categoria: string | null
          categorias: string[]
          cover_checked: boolean
          cover_url: string | null
          created_at: string
          estado: string | null
          estado_api: string | null
          fecha_agregado: string | null
          fuente: string
          fuentes: string[]
          generos: string[]
          id: string
          info_checked: boolean
          last_read_at: string | null
          mal_id: number | null
          nota_general: string | null
          proximo_ep: number | null
          proximo_ep_at: string | null
          puntuacion: number | null
          sin_leer: number | null
          sinopsis: string | null
          tipo: string
          titulo: string
          total_api: number | null
          ultimo_cap_disponible: number | null
          ultimo_cap_leido: number
          ultimo_cap_nombre: string | null
          ultimo_cap_tracker: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anilist_id?: number | null
          anilist_url?: string | null
          artista?: string | null
          autor?: string | null
          caps_leidos?: number | null
          caps_totales?: number | null
          categoria?: string | null
          categorias?: string[]
          cover_checked?: boolean
          cover_url?: string | null
          created_at?: string
          estado?: string | null
          estado_api?: string | null
          fecha_agregado?: string | null
          fuente?: string
          fuentes?: string[]
          generos?: string[]
          id?: string
          info_checked?: boolean
          last_read_at?: string | null
          mal_id?: number | null
          nota_general?: string | null
          proximo_ep?: number | null
          proximo_ep_at?: string | null
          puntuacion?: number | null
          sin_leer?: number | null
          sinopsis?: string | null
          tipo?: string
          titulo: string
          total_api?: number | null
          ultimo_cap_disponible?: number | null
          ultimo_cap_leido?: number
          ultimo_cap_nombre?: string | null
          ultimo_cap_tracker?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          anilist_id?: number | null
          anilist_url?: string | null
          artista?: string | null
          autor?: string | null
          caps_leidos?: number | null
          caps_totales?: number | null
          categoria?: string | null
          categorias?: string[]
          cover_checked?: boolean
          cover_url?: string | null
          created_at?: string
          estado?: string | null
          estado_api?: string | null
          fecha_agregado?: string | null
          fuente?: string
          fuentes?: string[]
          generos?: string[]
          id?: string
          info_checked?: boolean
          last_read_at?: string | null
          mal_id?: number | null
          nota_general?: string | null
          proximo_ep?: number | null
          proximo_ep_at?: string | null
          puntuacion?: number | null
          sin_leer?: number | null
          sinopsis?: string | null
          tipo?: string
          titulo?: string
          total_api?: number | null
          ultimo_cap_disponible?: number | null
          ultimo_cap_leido?: number
          ultimo_cap_nombre?: string | null
          ultimo_cap_tracker?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
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
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
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
