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
      business_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      business_users: {
        Row: {
          business_id: string
          id: string
          joined_at: string | null
          role: string
          status: string
          user_id: string
        }
        Insert: {
          business_id: string
          id?: string
          joined_at?: string | null
          role: string
          status: string
          user_id: string
        }
        Update: {
          business_id?: string
          id?: string
          joined_at?: string | null
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_users_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          avg_monthly_revenue: number | null
          business_category_id: string | null
          business_type: string | null
          created_at: string | null
          employee_count: number | null
          id: string
          industry: string | null
          name: string
          official_email: string | null
          owner_id: string
          phone: string | null
          plan_id: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          avg_monthly_revenue?: number | null
          business_category_id?: string | null
          business_type?: string | null
          created_at?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          name: string
          official_email?: string | null
          owner_id: string
          phone?: string | null
          plan_id?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          avg_monthly_revenue?: number | null
          business_category_id?: string | null
          business_type?: string | null
          created_at?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          name?: string
          official_email?: string | null
          owner_id?: string
          phone?: string | null
          plan_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "businesses_business_category_id_fkey"
            columns: ["business_category_id"]
            isOneToOne: false
            referencedRelation: "business_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "businesses_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans_new"
            referencedColumns: ["plan"]
          },
        ]
      }
      categories: {
        Row: {
          business_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      inventory_actions: {
        Row: {
          action_type: string
          business_id: string
          id: string
          notes: string | null
          product_id: string
          quantity_changed: number
          timestamp: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          business_id: string
          id?: string
          notes?: string | null
          product_id: string
          quantity_changed: number
          timestamp?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          business_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          quantity_changed?: number
          timestamp?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_actions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_actions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          business_id: string
          created_at: string
          expiration_days_warning: number
          expiration_enabled: boolean
          id: string
          low_stock_enabled: boolean
          low_stock_threshold: number
          plan_limit_enabled: boolean
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          expiration_days_warning?: number
          expiration_enabled?: boolean
          id?: string
          low_stock_enabled?: boolean
          low_stock_threshold?: number
          plan_limit_enabled?: boolean
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          expiration_days_warning?: number
          expiration_enabled?: boolean
          id?: string
          low_stock_enabled?: boolean
          low_stock_threshold?: number
          plan_limit_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          business_id: string
          channel: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          product_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          channel?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          product_id?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          channel?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          product_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          access_scope: string
          created_at: string | null
          description: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          access_scope: string
          created_at?: string | null
          description?: string | null
          id?: string
          role: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          access_scope?: string
          created_at?: string | null
          description?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          business_category_id: string
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          business_category_id: string
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          business_category_id?: string
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_business_category_id_fkey"
            columns: ["business_category_id"]
            isOneToOne: false
            referencedRelation: "business_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_thresholds: {
        Row: {
          business_id: string
          created_at: string
          id: string
          low_stock_threshold: number
          product_id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          low_stock_threshold?: number
          product_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          low_stock_threshold?: number
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_thresholds_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_thresholds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          alert_dismissed: boolean
          barcode: string | null
          business_id: string
          cost: number | null
          created_at: string | null
          created_by: string
          expiration_date: string | null
          id: string
          image: string | null
          location: string | null
          name: string
          price: number | null
          product_category_id: string | null
          quantity: number
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          alert_dismissed?: boolean
          barcode?: string | null
          business_id: string
          cost?: number | null
          created_at?: string | null
          created_by: string
          expiration_date?: string | null
          id?: string
          image?: string | null
          location?: string | null
          name: string
          price?: number | null
          product_category_id?: string | null
          quantity?: number
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          alert_dismissed?: boolean
          barcode?: string | null
          business_id?: string
          cost?: number | null
          created_at?: string | null
          created_by?: string
          expiration_date?: string | null
          id?: string
          image?: string | null
          location?: string | null
          name?: string
          price?: number | null
          product_category_id?: string | null
          quantity?: number
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          business_id: string | null
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string
          first_name?: string | null
          id: string
          is_active?: boolean
          last_name?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_owned_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      recent_activity: {
        Row: {
          action_type: string
          business_id: string
          created_at: string
          description: string | null
          icon_name: string | null
          id: string
          is_critical: boolean
          is_system_generated: boolean
          metadata: Json | null
          priority_level: string
          product_id: string | null
          quantity_changed: number | null
          status_color: string
          supplier_id: string | null
          timestamp: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type: string
          business_id: string
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          is_critical?: boolean
          is_system_generated?: boolean
          metadata?: Json | null
          priority_level?: string
          product_id?: string | null
          quantity_changed?: number | null
          status_color?: string
          supplier_id?: string | null
          timestamp?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string
          business_id?: string
          created_at?: string
          description?: string | null
          icon_name?: string | null
          id?: string
          is_critical?: boolean
          is_system_generated?: boolean
          metadata?: Json | null
          priority_level?: string
          product_id?: string | null
          quantity_changed?: number | null
          status_color?: string
          supplier_id?: string | null
          timestamp?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recent_activity_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recent_activity_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recent_activity_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_cycles: {
        Row: {
          business_id: string
          created_at: string | null
          id: string
          period_end: string
          period_start: string
          profit: number | null
          total_cost: number | null
          total_revenue: number | null
          updated_at: string | null
        }
        Insert: {
          business_id: string
          created_at?: string | null
          id?: string
          period_end: string
          period_start: string
          profit?: number | null
          total_cost?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string | null
          id?: string
          period_end?: string
          period_start?: string
          profit?: number | null
          total_cost?: number | null
          total_revenue?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_cycles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          ai_access: boolean | null
          created_at: string | null
          duration_months: number | null
          features: Json | null
          id: string
          max_users: number | null
          monthly_price: number | null
          name: string
          role: Database["public"]["Enums"]["user_role"]
          setup_fee: number | null
          storage_gb: number | null
          updated_at: string | null
        }
        Insert: {
          ai_access?: boolean | null
          created_at?: string | null
          duration_months?: number | null
          features?: Json | null
          id?: string
          max_users?: number | null
          monthly_price?: number | null
          name: string
          role: Database["public"]["Enums"]["user_role"]
          setup_fee?: number | null
          storage_gb?: number | null
          updated_at?: string | null
        }
        Update: {
          ai_access?: boolean | null
          created_at?: string | null
          duration_months?: number | null
          features?: Json | null
          id?: string
          max_users?: number | null
          monthly_price?: number | null
          name?: string
          role?: Database["public"]["Enums"]["user_role"]
          setup_fee?: number | null
          storage_gb?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      subscription_plans_new: {
        Row: {
          ai_credit: number
          created_at: string | null
          plan: string
          storage_limit: number
          support_level: Database["public"]["Enums"]["support_level"]
          updated_at: string | null
          user_limit: number
        }
        Insert: {
          ai_credit: number
          created_at?: string | null
          plan: string
          storage_limit: number
          support_level: Database["public"]["Enums"]["support_level"]
          updated_at?: string | null
          user_limit: number
        }
        Update: {
          ai_credit?: number
          created_at?: string | null
          plan?: string
          storage_limit?: number
          support_level?: Database["public"]["Enums"]["support_level"]
          updated_at?: string | null
          user_limit?: number
        }
        Relationships: []
      }
      supplier_invoices: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          file_url: string | null
          id: string
          invoice_date: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          file_url?: string | null
          id?: string
          invoice_date: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          file_url?: string | null
          id?: string
          invoice_date?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          agent_name: string | null
          business_id: string | null
          contact_email: string | null
          created_at: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          agent_name?: string | null
          business_id?: string | null
          contact_email?: string | null
          created_at?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_name?: string | null
          business_id?: string | null
          contact_email?: string | null
          created_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_businesses: {
        Row: {
          business_id: string
          role: string | null
          user_id: string
        }
        Insert: {
          business_id?: string
          role?: string | null
          user_id?: string
        }
        Update: {
          business_id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_businesses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          business_id: string | null
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          business_id?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          business_id?: string | null
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          plan_id: string
          started_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          plan_id: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          plan_id?: string
          started_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions_new: {
        Row: {
          auto_renew: boolean | null
          created_at: string | null
          expires_at: string | null
          id: string
          plan: string
          started_at: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_renew?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          plan: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_renew?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          plan?: string
          started_at?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_new_plan_fkey"
            columns: ["plan"]
            isOneToOne: false
            referencedRelation: "subscription_plans_new"
            referencedColumns: ["plan"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_expiration_notifications: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      check_low_stock_notifications: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      delete_user_by_admin: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      get_product_autocomplete: {
        Args: {
          search_term: string
          business_uuid?: string
          limit_count?: number
        }
        Returns: {
          suggestion: string
          product_count: number
        }[]
      }
      get_user_business_context: {
        Args: { user_uuid?: string }
        Returns: {
          business_id: string
          business_name: string
          user_role: string
          is_owner: boolean
        }[]
      }
      get_user_role: {
        Args: { user_uuid?: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_users_for_admin_search: {
        Args: { search_pattern: string }
        Returns: {
          user_id: string
          email: string
          first_name: string
          last_name: string
          role: Database["public"]["Enums"]["user_role"]
          created_at: string
        }[]
      }
      has_role_or_higher: {
        Args: {
          required_role: Database["public"]["Enums"]["user_role"]
          user_uuid?: string
        }
        Returns: boolean
      }
      is_business_name_available: {
        Args: { business_name: string }
        Returns: boolean
      }
      is_first_user_in_business: {
        Args: { business_uuid: string }
        Returns: boolean
      }
      reports_aggregate: {
        Args: { business_id: string; date_from: string; date_to: string }
        Returns: Json
      }
      search_products: {
        Args: {
          search_term?: string
          business_uuid?: string
          limit_count?: number
        }
        Returns: {
          id: string
          name: string
          barcode: string
          quantity: number
          location: string
          expiration_date: string
          price: number
          cost: number
          category_name: string
          supplier_name: string
          search_rank: number
        }[]
      }
      search_users_for_admin: {
        Args: { search_pattern: string }
        Returns: {
          user_id: string
          email: string
          first_name: string
          last_name: string
          is_active: boolean
          created_at: string
        }[]
      }
      toggle_user_active_status: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      user_has_business_access: {
        Args: { user_uuid?: string }
        Returns: boolean
      }
    }
    Enums: {
      support_level: "basic" | "standard" | "advanced" | "vip"
      user_role:
        | "admin"
        | "free_user"
        | "pro_starter_user"
        | "smart_master_user"
        | "elite_pilot_user"
        | "OWNER"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      support_level: ["basic", "standard", "advanced", "vip"],
      user_role: [
        "admin",
        "free_user",
        "pro_starter_user",
        "smart_master_user",
        "elite_pilot_user",
        "OWNER",
      ],
    },
  },
} as const
