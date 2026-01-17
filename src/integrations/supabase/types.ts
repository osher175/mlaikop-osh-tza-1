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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action_type: string
          business_id: string | null
          created_at: string
          details: Json | null
          id: string
          ip_address: unknown
          target_id: string | null
          target_type: string | null
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          business_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          business_id?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: unknown
          target_id?: string | null
          target_type?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
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
      login_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip_address: unknown
          success: boolean
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip_address?: unknown
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip_address?: unknown
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      notification_settings: {
        Row: {
          business_id: string
          created_at: string
          expiration_days_warning: number
          expiration_enabled: boolean
          id: string
          is_active: boolean
          low_stock_enabled: boolean
          low_stock_threshold: number
          notification_type: string
          plan_limit_enabled: boolean
          updated_at: string
          whatsapp_to_supplier: boolean
        }
        Insert: {
          business_id: string
          created_at?: string
          expiration_days_warning?: number
          expiration_enabled?: boolean
          id?: string
          is_active?: boolean
          low_stock_enabled?: boolean
          low_stock_threshold?: number
          notification_type?: string
          plan_limit_enabled?: boolean
          updated_at?: string
          whatsapp_to_supplier?: boolean
        }
        Update: {
          business_id?: string
          created_at?: string
          expiration_days_warning?: number
          expiration_enabled?: boolean
          id?: string
          is_active?: boolean
          low_stock_enabled?: boolean
          low_stock_threshold?: number
          notification_type?: string
          plan_limit_enabled?: boolean
          updated_at?: string
          whatsapp_to_supplier?: boolean
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
      notification_targets: {
        Row: {
          created_at: string
          id: string
          notification_setting_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notification_setting_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notification_setting_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_targets_notification_setting_id_fkey"
            columns: ["notification_setting_id"]
            isOneToOne: false
            referencedRelation: "notification_settings"
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
          enable_whatsapp_supplier_notification: boolean
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
          enable_whatsapp_supplier_notification?: boolean
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
          enable_whatsapp_supplier_notification?: boolean
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
      stock_alerts: {
        Row: {
          alert_type: string
          business_id: string | null
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          quantity_at_trigger: number
          resolved: boolean | null
          resolved_at: string | null
          supplier_name: string | null
          supplier_phone: string | null
        }
        Insert: {
          alert_type: string
          business_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          quantity_at_trigger: number
          resolved?: boolean | null
          resolved_at?: string | null
          supplier_name?: string | null
          supplier_phone?: string | null
        }
        Update: {
          alert_type?: string
          business_id?: string | null
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          quantity_at_trigger?: number
          resolved?: boolean | null
          resolved_at?: string | null
          supplier_name?: string | null
          supplier_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_approval_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          product_id: string | null
          product_name: string | null
          quantity: number | null
          status: string | null
          supplier_id: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number | null
          status?: string | null
          supplier_id?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_name?: string | null
          quantity?: number | null
          status?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_approval_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_approval_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_approval_requests_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_approvals: {
        Row: {
          approved_at: string | null
          business_id: string
          created_at: string | null
          id: string
          is_approved: boolean | null
          product_id: string
          product_name: string
        }
        Insert: {
          approved_at?: string | null
          business_id: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          product_id: string
          product_name: string
        }
        Update: {
          approved_at?: string | null
          business_id?: string
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          product_id?: string
          product_name?: string
        }
        Relationships: []
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
          sales_agent_name: string | null
          sales_agent_phone: string | null
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
          sales_agent_name?: string | null
          sales_agent_phone?: string | null
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
          sales_agent_name?: string | null
          sales_agent_phone?: string | null
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
      user_activity_log: {
        Row: {
          action_type: string
          business_id: string | null
          created_at: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          business_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_log_business_id_fkey"
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
          canceled_at: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          next_billing_date: string | null
          payment_link_id: string | null
          plan_id: string
          receipt_url: string | null
          started_at: string | null
          status: string | null
          subscription_started_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          next_billing_date?: string | null
          payment_link_id?: string | null
          plan_id: string
          receipt_url?: string | null
          started_at?: string | null
          status?: string | null
          subscription_started_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          next_billing_date?: string | null
          payment_link_id?: string | null
          plan_id?: string
          receipt_url?: string | null
          started_at?: string | null
          status?: string | null
          subscription_started_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
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
      whatsapp_notifications_log: {
        Row: {
          business_id: string
          created_at: string
          id: string
          message_text: string
          product_id: string
          recipient_phone: string
          sales_agent_phone: string
          sent_at: string | null
          supplier_id: string
          trigger_type: string | null
          updated_at: string
          was_sent: boolean
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          message_text: string
          product_id: string
          recipient_phone: string
          sales_agent_phone: string
          sent_at?: string | null
          supplier_id: string
          trigger_type?: string | null
          updated_at?: string
          was_sent?: boolean
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          message_text?: string
          product_id?: string
          recipient_phone?: string
          sales_agent_phone?: string
          sent_at?: string | null
          supplier_id?: string
          trigger_type?: string | null
          updated_at?: string
          was_sent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_notifications_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_notifications_log_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_notifications_log_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bytea_to_text: { Args: { data: string }; Returns: string }
      check_expiration_notifications: { Args: never; Returns: undefined }
      check_low_stock_notifications: { Args: never; Returns: undefined }
      check_rate_limit: {
        Args: {
          max_attempts?: number
          time_window_minutes?: number
          user_email: string
          user_ip?: unknown
        }
        Returns: boolean
      }
      cleanup_old_audit_logs: { Args: never; Returns: undefined }
      delete_user_by_admin: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      generate_weekly_stock_summary: {
        Args: { target_business_id: string }
        Returns: Json
      }
      get_user_business_context: {
        Args: { user_uuid?: string }
        Returns: {
          business_id: string
          business_name: string
          is_owner: boolean
          user_role: string
        }[]
      }
      get_user_role: {
        Args: { user_uuid?: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_users_for_admin_search: {
        Args: { search_pattern: string }
        Returns: {
          created_at: string
          email: string
          first_name: string
          last_name: string
          role: Database["public"]["Enums"]["user_role"]
          user_id: string
        }[]
      }
      has_role_or_higher: {
        Args: {
          required_role: Database["public"]["Enums"]["user_role"]
          user_uuid?: string
        }
        Returns: boolean
      }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
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
      log_audit_event: {
        Args: {
          p_action_type: string
          p_business_id?: string
          p_details?: Json
          p_ip_address?: unknown
          p_target_id?: string
          p_target_type?: string
          p_user_agent?: string
        }
        Returns: string
      }
      log_login_attempt: {
        Args: {
          is_success?: boolean
          user_agent_string?: string
          user_email: string
          user_ip?: unknown
        }
        Returns: undefined
      }
      log_user_activity: {
        Args: {
          p_action_type: string
          p_business_id: string
          p_entity_id: string
          p_entity_name: string
          p_entity_type: string
          p_ip_address?: unknown
          p_new_values?: Json
          p_old_values?: Json
          p_user_agent?: string
        }
        Returns: string
      }
      reports_aggregate: {
        Args: { business_id: string; date_from: string; date_to: string }
        Returns: Json
      }
      search_users_for_admin: {
        Args: { search_pattern: string }
        Returns: {
          created_at: string
          email: string
          first_name: string
          is_active: boolean
          last_name: string
          user_id: string
        }[]
      }
      text_to_bytea: { Args: { data: string }; Returns: string }
      toggle_user_active_status: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
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
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
