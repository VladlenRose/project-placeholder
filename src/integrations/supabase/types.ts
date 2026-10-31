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
      documents: {
        Row: {
          body: string | null
          counterparty: string | null
          created_at: string
          id: string
          negotiation_id: string | null
          negotiation_version: number | null
          owner_id: string
          status: string
          thread_id: string | null
          title: string
        }
        Insert: {
          body?: string | null
          counterparty?: string | null
          created_at?: string
          id?: string
          negotiation_id?: string | null
          negotiation_version?: number | null
          owner_id: string
          status?: string
          thread_id?: string | null
          title: string
        }
        Update: {
          body?: string | null
          counterparty?: string | null
          created_at?: string
          id?: string
          negotiation_id?: string | null
          negotiation_version?: number | null
          owner_id?: string
          status?: string
          thread_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "request_negotiations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          author: string
          created_at: string
          id: string
          offer_conditions: string | null
          offer_price: string | null
          offer_term: string | null
          text: string | null
          thread_id: string
        }
        Insert: {
          author?: string
          created_at?: string
          id?: string
          offer_conditions?: string | null
          offer_price?: string | null
          offer_term?: string | null
          text?: string | null
          thread_id: string
        }
        Update: {
          author?: string
          created_at?: string
          id?: string
          offer_conditions?: string | null
          offer_price?: string | null
          offer_term?: string | null
          text?: string | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "threads"
            referencedColumns: ["id"]
          },
        ]
      }
      negotiation_versions: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          id: string
          negotiation_id: string
          param_key: string | null
          snapshot: Json
          version: number
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          id?: string
          negotiation_id: string
          param_key?: string | null
          snapshot: Json
          version: number
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          id?: string
          negotiation_id?: string
          param_key?: string | null
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "negotiation_versions_negotiation_id_fkey"
            columns: ["negotiation_id"]
            isOneToOne: false
            referencedRelation: "request_negotiations"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attrs: Json
          category: string | null
          created_at: string
          created_by: string | null
          description: string | null
          embedding: string | null
          embedding_text: string | null
          id: string
          image_id: string | null
          kind: string
          merged_into: string | null
          owner_id: string | null
          price: number
          rating: number
          status: string
          supplier: string | null
          title: string
          unit: string | null
        }
        Insert: {
          attrs?: Json
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          embedding?: string | null
          embedding_text?: string | null
          id?: string
          image_id?: string | null
          kind?: string
          merged_into?: string | null
          owner_id?: string | null
          price?: number
          rating?: number
          status?: string
          supplier?: string | null
          title: string
          unit?: string | null
        }
        Update: {
          attrs?: Json
          category?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          embedding?: string | null
          embedding_text?: string | null
          id?: string
          image_id?: string | null
          kind?: string
          merged_into?: string | null
          owner_id?: string | null
          price?: number
          rating?: number
          status?: string
          supplier?: string | null
          title?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          inn: string | null
          name: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inn?: string | null
          name?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          inn?: string | null
          name?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      request_negotiations: {
        Row: {
          buyer_id: string
          buyer_request_id: string
          created_at: string
          id: string
          seller_id: string
          seller_request_id: string
          snapshot: Json
          updated_at: string
          version: number
        }
        Insert: {
          buyer_id: string
          buyer_request_id: string
          created_at?: string
          id?: string
          seller_id: string
          seller_request_id: string
          snapshot: Json
          updated_at?: string
          version?: number
        }
        Update: {
          buyer_id?: string
          buyer_request_id?: string
          created_at?: string
          id?: string
          seller_id?: string
          seller_request_id?: string
          snapshot?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "request_negotiations_buyer_request_id_fkey"
            columns: ["buyer_request_id"]
            isOneToOne: false
            referencedRelation: "trade_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_negotiations_seller_request_id_fkey"
            columns: ["seller_request_id"]
            isOneToOne: false
            referencedRelation: "trade_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      threads: {
        Row: {
          buyer_id: string
          company: string | null
          created_at: string
          id: string
          last_at: string | null
          preview: string | null
          product_id: string | null
          seller_id: string | null
          stage: string
        }
        Insert: {
          buyer_id: string
          company?: string | null
          created_at?: string
          id?: string
          last_at?: string | null
          preview?: string | null
          product_id?: string | null
          seller_id?: string | null
          stage?: string
        }
        Update: {
          buyer_id?: string
          company?: string | null
          created_at?: string
          id?: string
          last_at?: string | null
          preview?: string | null
          product_id?: string | null
          seller_id?: string | null
          stage?: string
        }
        Relationships: []
      }
      trade_requests: {
        Row: {
          attachment_url: string | null
          created_at: string
          extra: string | null
          id: string
          kind: string
          owner_id: string
          params: Json
          product_id: string | null
          product_snapshot: Json | null
          response_to: string | null
          title: string
        }
        Insert: {
          attachment_url?: string | null
          created_at?: string
          extra?: string | null
          id?: string
          kind: string
          owner_id: string
          params?: Json
          product_id?: string | null
          product_snapshot?: Json | null
          response_to?: string | null
          title: string
        }
        Update: {
          attachment_url?: string | null
          created_at?: string
          extra?: string | null
          id?: string
          kind?: string
          owner_id?: string
          params?: Json
          product_id?: string | null
          product_snapshot?: Json | null
          response_to?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_requests_response_to_fkey"
            columns: ["response_to"]
            isOneToOne: false
            referencedRelation: "trade_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_negotiation: {
        Args: { _actor: string; _expected: number; _id: string }
        Returns: string
      }
      admin_exists: { Args: never; Returns: boolean }
      admin_list_users: {
        Args: never
        Returns: {
          company: string
          email: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      admin_merge_products: {
        Args: { _dup: string; _keep: string }
        Returns: number
      }
      admin_set_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      claim_first_admin: { Args: never; Returns: boolean }
      commit_request_negotiation: {
        Args: {
          _action: string
          _actor: string
          _expected: number
          _id: string
          _key: string
          _snapshot: Json
        }
        Returns: {
          buyer_id: string
          buyer_request_id: string
          created_at: string
          id: string
          seller_id: string
          seller_request_id: string
          snapshot: Json
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "request_negotiations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_negotiation_contract: {
        Args: { _actor: string; _expected: number; _id: string }
        Returns: string
      }
      create_product_from_request: {
        Args: {
          _attrs?: Json
          _category: string
          _description: string
          _image_id: string
          _kind?: string
          _title: string
          _unit: string
        }
        Returns: string
      }
      delete_catalog_product: { Args: { _id: string }; Returns: string }
      finalize_request_negotiation: {
        Args: { _actor: string; _expected: number; _id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_products: {
        Args: { _count?: number; _query: string }
        Returns: {
          category: string
          description: string
          id: string
          image_id: string
          kind: string
          similarity: number
          title: string
          unit: string
        }[]
      }
      my_role: { Args: never; Returns: Database["public"]["Enums"]["app_role"] }
      open_request_negotiation: {
        Args: {
          _actor: string
          _buyer: string
          _seller: string
          _snapshot: Json
        }
        Returns: {
          buyer_id: string
          buyer_request_id: string
          created_at: string
          id: string
          seller_id: string
          seller_request_id: string
          snapshot: Json
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "request_negotiations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_pair_similarity: {
        Args: { _ids: string[]; _ref: string }
        Returns: {
          product_id: string
          similarity: number
        }[]
      }
      product_request_counts: {
        Args: { _ids: string[] }
        Returns: {
          cnt: number
          product_id: string
        }[]
      }
      public_profiles: {
        Args: { _ids: string[] }
        Returns: {
          company: string
          name: string
          user_id: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
