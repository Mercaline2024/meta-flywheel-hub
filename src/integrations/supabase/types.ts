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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      meta_ad_accounts: {
        Row: {
          created_at: string
          id: string
          meta_ad_account_id: string
          meta_bm_id: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_ad_account_id: string
          meta_bm_id?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_ad_account_id?: string
          meta_bm_id?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_business_managers: {
        Row: {
          created_at: string
          id: string
          meta_bm_id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_bm_id: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_bm_id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_connections: {
        Row: {
          access_token: string | null
          ad_account_sync_at: string | null
          bm_sync_at: string | null
          created_at: string
          id: string
          provider: string
          refresh_token: string | null
          scope: string | null
          token_received_at: string
          token_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          ad_account_sync_at?: string | null
          bm_sync_at?: string | null
          created_at?: string
          id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          token_received_at?: string
          token_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          ad_account_sync_at?: string | null
          bm_sync_at?: string | null
          created_at?: string
          id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          token_received_at?: string
          token_type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meta_whatsapp_business_accounts: {
        Row: {
          created_at: string
          id: string
          meta_bm_id: string
          name: string
          updated_at: string
          user_id: string
          waba_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meta_bm_id: string
          name: string
          updated_at?: string
          user_id: string
          waba_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meta_bm_id?: string
          name?: string
          updated_at?: string
          user_id?: string
          waba_id?: string
        }
        Relationships: []
      }
      meta_whatsapp_templates: {
        Row: {
          category: string | null
          components: Json
          created_at: string
          id: string
          language: string
          raw: Json
          status: string | null
          template_name: string
          updated_at: string
          user_id: string
          waba_id: string
        }
        Insert: {
          category?: string | null
          components?: Json
          created_at?: string
          id?: string
          language: string
          raw?: Json
          status?: string | null
          template_name: string
          updated_at?: string
          user_id: string
          waba_id: string
        }
        Update: {
          category?: string | null
          components?: Json
          created_at?: string
          id?: string
          language?: string
          raw?: Json
          status?: string | null
          template_name?: string
          updated_at?: string
          user_id?: string
          waba_id?: string
        }
        Relationships: []
      }
      whatsapp_campaign_recipients: {
        Row: {
          accepted_at: string | null
          attempt_count: number
          campaign_id: string
          created_at: string
          custom_fields: Json
          delivered_at: string | null
          error_message: string | null
          full_name: string | null
          id: string
          meta_message_id: string | null
          next_attempt_at: string | null
          opt_in: boolean
          phone_number: string
          status_api: string
          status_delivery: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          attempt_count?: number
          campaign_id: string
          created_at?: string
          custom_fields?: Json
          delivered_at?: string | null
          error_message?: string | null
          full_name?: string | null
          id?: string
          meta_message_id?: string | null
          next_attempt_at?: string | null
          opt_in?: boolean
          phone_number: string
          status_api?: string
          status_delivery?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          attempt_count?: number
          campaign_id?: string
          created_at?: string
          custom_fields?: Json
          delivered_at?: string | null
          error_message?: string | null
          full_name?: string | null
          id?: string
          meta_message_id?: string | null
          next_attempt_at?: string | null
          opt_in?: boolean
          phone_number?: string
          status_api?: string
          status_delivery?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns: {
        Row: {
          created_at: string
          delivered_count: number
          failed_count: number
          id: string
          phone_number_id: string
          rate_limit_per_minute: number
          scheduled_at: string
          sent_api_count: number
          status: string
          template_language: string
          template_name: string
          total_recipients: number
          updated_at: string
          user_id: string
          waba_id: string
        }
        Insert: {
          created_at?: string
          delivered_count?: number
          failed_count?: number
          id?: string
          phone_number_id: string
          rate_limit_per_minute?: number
          scheduled_at: string
          sent_api_count?: number
          status?: string
          template_language?: string
          template_name: string
          total_recipients?: number
          updated_at?: string
          user_id: string
          waba_id: string
        }
        Update: {
          created_at?: string
          delivered_count?: number
          failed_count?: number
          id?: string
          phone_number_id?: string
          rate_limit_per_minute?: number
          scheduled_at?: string
          sent_api_count?: number
          status?: string
          template_language?: string
          template_name?: string
          total_recipients?: number
          updated_at?: string
          user_id?: string
          waba_id?: string
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
