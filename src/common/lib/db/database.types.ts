// Generado desde Supabase. No editar a mano: regenerar con `npm run db:types`
// cada vez que se agregue una migración.

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
      account_transfers: {
        Row: {
          amount_in: number
          amount_out: number
          bcv_usd_rate: number
          binance_rate: number
          created_at: string
          created_by: string
          from_account_id: string
          id: string
          note: string | null
          occurred_at: string
          receipt_path: string | null
          to_account_id: string
          usd_usdt_rate: number
        }
        Insert: {
          amount_in: number
          amount_out: number
          bcv_usd_rate?: number
          binance_rate?: number
          created_at?: string
          created_by?: string
          from_account_id: string
          id?: string
          note?: string | null
          occurred_at?: string
          receipt_path?: string | null
          to_account_id: string
          usd_usdt_rate?: number
        }
        Update: {
          amount_in?: number
          amount_out?: number
          bcv_usd_rate?: number
          binance_rate?: number
          created_at?: string
          created_by?: string
          from_account_id?: string
          id?: string
          note?: string | null
          occurred_at?: string
          receipt_path?: string | null
          to_account_id?: string
          usd_usdt_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "account_transfers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          created_at: string
          created_by: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          notes: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string
          currency: Database["public"]["Enums"]["currency"]
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["account_kind"]
          name: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["account_kind"]
          name?: string
          notes?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          bcv_eur: number
          bcv_usd: number
          binance_usdt: number
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          rate_date: string
          source: Database["public"]["Enums"]["rate_source"]
          usd_usdt: number
        }
        Insert: {
          bcv_eur: number
          bcv_usd: number
          binance_usdt: number
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          rate_date?: string
          source?: Database["public"]["Enums"]["rate_source"]
          usd_usdt?: number
        }
        Update: {
          bcv_eur?: number
          bcv_usd?: number
          binance_usdt?: number
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          rate_date?: string
          usd_usdt?: number
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          team_member_id: string | null
          account_id: string
          amount: number
          bcv_usd_rate: number
          binance_rate: number
          category_id: string | null
          created_at: string
          created_by: string
          currency: Database["public"]["Enums"]["currency"]
          description: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id: string
          occurred_at: string
          person_id: string | null
          receipt_path: string | null
          reverses_entry_id: string | null
          transfer_id: string | null
          usd_usdt_rate: number
          usdt_value: number
        }
        Insert: {
          team_member_id?: string | null
          account_id: string
          amount: number
          bcv_usd_rate?: number
          binance_rate?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["currency"]
          description?: string | null
          entry_type: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          occurred_at?: string
          person_id?: string | null
          receipt_path?: string | null
          reverses_entry_id?: string | null
          transfer_id?: string | null
          usd_usdt_rate?: number
          usdt_value?: number
        }
        Update: {
          team_member_id?: string | null
          account_id?: string
          amount?: number
          bcv_usd_rate?: number
          binance_rate?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["currency"]
          description?: string | null
          entry_type?: Database["public"]["Enums"]["ledger_entry_type"]
          id?: string
          occurred_at?: string
          person_id?: string | null
          receipt_path?: string | null
          reverses_entry_id?: string | null
          transfer_id?: string | null
          usd_usdt_rate?: number
          usdt_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "movement_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_reverses_entry_id_fkey"
            columns: ["reverses_entry_id"]
            isOneToOne: true
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "account_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      movement_categories: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          is_system: boolean
          name: string
          scope: Database["public"]["Enums"]["category_scope"]
          type: Database["public"]["Enums"]["category_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          type: Database["public"]["Enums"]["category_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          type?: Database["public"]["Enums"]["category_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "movement_categories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movement_categories_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          price_currency: Database["public"]["Enums"]["currency"]
          rate_kind: Database["public"]["Enums"]["payment_rate_kind"]
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name: string
          price_currency: Database["public"]["Enums"]["currency"]
          rate_kind?: Database["public"]["Enums"]["payment_rate_kind"]
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          price_currency?: Database["public"]["Enums"]["currency"]
          rate_kind?: Database["public"]["Enums"]["payment_rate_kind"]
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_methods_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          created_by: string | null
          email: string | null
          first_name: string
          has_id_document: boolean
          id: string
          instagram: string | null
          is_active: boolean
          last_name: string | null
          notes: string | null
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name: string
          has_id_document?: boolean
          id?: string
          instagram?: string | null
          is_active?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string | null
          first_name?: string
          has_id_document?: boolean
          id?: string
          instagram?: string | null
          is_active?: boolean
          last_name?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      customer_private: {
        Row: {
          customer_id: string
          id_document: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          customer_id: string
          id_document: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          customer_id?: string
          id_document?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_private_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      colors: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      sizes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      products: {
        Row: {
          labor_cost_usdt: number
          category_id: string
          closure: Database["public"]["Enums"]["product_closure"] | null
          created_at: string
          created_by: string
          description: string | null
          fit: Database["public"]["Enums"]["product_fit"] | null
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          gender: Database["public"]["Enums"]["product_gender"] | null
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["product_kind"]
          name: string
          unit: Database["public"]["Enums"]["product_unit"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          labor_cost_usdt?: number
          category_id: string
          closure?: Database["public"]["Enums"]["product_closure"] | null
          created_at?: string
          created_by?: string
          description?: string | null
          fit?: Database["public"]["Enums"]["product_fit"] | null
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          gender?: Database["public"]["Enums"]["product_gender"] | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["product_kind"]
          name: string
          unit?: Database["public"]["Enums"]["product_unit"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          labor_cost_usdt?: number
          category_id?: string
          closure?: Database["public"]["Enums"]["product_closure"] | null
          created_at?: string
          created_by?: string
          description?: string | null
          fit?: Database["public"]["Enums"]["product_fit"] | null
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          gender?: Database["public"]["Enums"]["product_gender"] | null
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["product_kind"]
          name?: string
          unit?: Database["public"]["Enums"]["product_unit"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color_id: string | null
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          min_stock: number
          product_id: string
          size_id: string | null
          sku: string
          unit_cost_usdt: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          min_stock?: number
          product_id: string
          size_id?: string | null
          sku: string
          unit_cost_usdt?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          min_stock?: number
          product_id?: string
          size_id?: string | null
          sku?: string
          unit_cost_usdt?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          amount_usd: number
          created_at: string
          created_by: string
          id: string
          payment_method_id: string
          product_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_usd: number
          created_at?: string
          created_by?: string
          id?: string
          payment_method_id: string
          product_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_usd?: number
          created_at?: string
          created_by?: string
          id?: string
          payment_method_id?: string
          product_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          color_id: string | null
          created_at: string
          created_by: string
          id: string
          is_primary: boolean
          path: string
          product_id: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          color_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_primary?: boolean
          path: string
          product_id: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          color_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          is_primary?: boolean
          path?: string
          product_id?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_color_id_fkey"
            columns: ["color_id"]
            isOneToOne: false
            referencedRelation: "colors"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          production_run_id: string | null
          purchase_item_id: string | null
          created_at: string
          created_by: string
          id: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note: string | null
          occurred_at: string
          quantity: number
          sale_item_id: string | null
          unit_cost_usdt: number | null
          variant_id: string
        }
        Insert: {
          production_run_id?: string | null
          purchase_item_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          movement_type: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          occurred_at?: string
          quantity: number
          sale_item_id?: string | null
          unit_cost_usdt?: number | null
          variant_id: string
        }
        Update: {
          production_run_id?: string | null
          purchase_item_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          movement_type?: Database["public"]["Enums"]["stock_movement_type"]
          note?: string | null
          occurred_at?: string
          quantity?: number
          sale_item_id?: string | null
          unit_cost_usdt?: number | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_purchase_item_id_fkey"
            columns: ["purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string
          id: string
          invited_by: string | null
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          invited_by?: string | null
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_changes: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_is_active: boolean
          new_role: Database["public"]["Enums"]["app_role"]
          previous_is_active: boolean
          previous_role: Database["public"]["Enums"]["app_role"]
          profile_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_is_active: boolean
          new_role: Database["public"]["Enums"]["app_role"]
          previous_is_active: boolean
          previous_role: Database["public"]["Enums"]["app_role"]
          profile_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_is_active?: boolean
          new_role?: Database["public"]["Enums"]["app_role"]
          previous_is_active?: boolean
          previous_role?: Database["public"]["Enums"]["app_role"]
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_changes_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_changes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          is_backdated: boolean
          bcv_eur_rate: number
          bcv_usd_rate: number
          binance_rate: number
          channel: Database["public"]["Enums"]["sale_channel"]
          created_at: string
          created_by: string
          customer_id: string | null
          delivery_fee_usd: number
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          discount_by: string | null
          discount_reason: string | null
          discount_type: Database["public"]["Enums"]["discount_type"] | null
          discount_usd: number
          discount_value: number | null
          id: string
          notes: string | null
          number: number
          occurred_at: string
          price_method_id: string
          subtotal_usd: number
          total_usd: number
          usd_usdt_rate: number
        }
        Insert: {
          is_backdated?: boolean
          bcv_eur_rate: number
          bcv_usd_rate: number
          binance_rate: number
          channel: Database["public"]["Enums"]["sale_channel"]
          created_at?: string
          created_by?: string
          customer_id?: string | null
          delivery_fee_usd?: number
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          discount_by?: string | null
          discount_reason?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_usd?: number
          discount_value?: number | null
          id?: string
          notes?: string | null
          number?: number
          occurred_at?: string
          price_method_id: string
          subtotal_usd: number
          total_usd: number
          usd_usdt_rate: number
        }
        Update: {
          is_backdated?: boolean
          bcv_eur_rate?: number
          bcv_usd_rate?: number
          binance_rate?: number
          channel?: Database["public"]["Enums"]["sale_channel"]
          created_at?: string
          created_by?: string
          customer_id?: string | null
          delivery_fee_usd?: number
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          discount_by?: string | null
          discount_reason?: string | null
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_usd?: number
          discount_value?: number | null
          id?: string
          notes?: string | null
          number?: number
          occurred_at?: string
          price_method_id?: string
          subtotal_usd?: number
          total_usd?: number
          usd_usdt_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_discount_by_fkey"
            columns: ["discount_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_price_method_id_fkey"
            columns: ["price_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          line_total_usd: number
          quantity: number
          sale_id: string
          source: Database["public"]["Enums"]["sale_line_source"]
          unit_cost_usdt: number | null
          unit_price_usd: number
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_total_usd: number
          quantity: number
          sale_id: string
          source: Database["public"]["Enums"]["sale_line_source"]
          unit_cost_usdt?: number | null
          unit_price_usd: number
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          line_total_usd?: number
          quantity?: number
          sale_id?: string
          source?: Database["public"]["Enums"]["sale_line_source"]
          unit_cost_usdt?: number | null
          unit_price_usd?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_payments: {
        Row: {
          is_backdated: boolean
          amount: number
          applied_rate: number | null
          bcv_eur_rate: number
          bcv_usd_rate: number
          binance_rate: number
          created_at: string
          created_by: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          ledger_entry_id: string
          occurred_at: string
          payment_method_id: string
          rate_kind: Database["public"]["Enums"]["payment_rate_kind"]
          receipt_path: string | null
          sale_id: string
          usd_amount: number
          usd_usdt_rate: number
          usdt_value: number
        }
        Insert: {
          is_backdated?: boolean
          amount: number
          applied_rate?: number | null
          bcv_eur_rate: number
          bcv_usd_rate: number
          binance_rate: number
          created_at?: string
          created_by?: string
          currency: Database["public"]["Enums"]["currency"]
          id?: string
          ledger_entry_id: string
          occurred_at?: string
          payment_method_id: string
          rate_kind: Database["public"]["Enums"]["payment_rate_kind"]
          receipt_path?: string | null
          sale_id: string
          usd_amount: number
          usd_usdt_rate: number
          usdt_value: number
        }
        Update: {
          is_backdated?: boolean
          amount?: number
          applied_rate?: number | null
          bcv_eur_rate?: number
          bcv_usd_rate?: number
          binance_rate?: number
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          ledger_entry_id?: string
          occurred_at?: string
          payment_method_id?: string
          rate_kind?: Database["public"]["Enums"]["payment_rate_kind"]
          receipt_path?: string | null
          sale_id?: string
          usd_amount?: number
          usd_usdt_rate?: number
          usdt_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_item_status_events: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string | null
          sale_item_id: string
          status: Database["public"]["Enums"]["sale_item_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          sale_item_id: string
          status: Database["public"]["Enums"]["sale_item_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          sale_item_id?: string
          status?: Database["public"]["Enums"]["sale_item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "sale_item_status_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_item_status_events_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_voids: {
        Row: {
          created_at: string
          created_by: string
          reason: string
          sale_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          reason: string
          sale_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          reason?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_voids_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_voids_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_settings: {
        Row: {
          staff_max_backdate_days: number
          id: boolean
          staff_max_discount_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          staff_max_backdate_days?: number
          id?: boolean
          staff_max_discount_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          staff_max_backdate_days?: number
          id?: boolean
          staff_max_discount_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          contact_name: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          rif: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          rif?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          contact_name?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          rif?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          bcv_eur_rate: number
          bcv_usd_rate: number
          binance_rate: number
          created_at: string
          created_by: string
          due_date: string | null
          id: string
          is_backdated: boolean
          notes: string | null
          number: number
          occurred_at: string
          receipt_path: string | null
          supplier_id: string
          total_usd: number
          usd_usdt_rate: number
        }
        Insert: {
          bcv_eur_rate: number
          bcv_usd_rate: number
          binance_rate: number
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          is_backdated?: boolean
          notes?: string | null
          number?: number
          occurred_at?: string
          receipt_path?: string | null
          supplier_id: string
          total_usd: number
          usd_usdt_rate: number
        }
        Update: {
          bcv_eur_rate?: number
          bcv_usd_rate?: number
          binance_rate?: number
          created_at?: string
          created_by?: string
          due_date?: string | null
          id?: string
          is_backdated?: boolean
          notes?: string | null
          number?: number
          occurred_at?: string
          receipt_path?: string | null
          supplier_id?: string
          total_usd?: number
          usd_usdt_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          line_total_usd: number
          line_type: Database["public"]["Enums"]["purchase_line_type"]
          purchase_id: string
          quantity: number
          unit_cost_usd: number
          unit_cost_usdt: number | null
          variant_id: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          line_total_usd: number
          line_type: Database["public"]["Enums"]["purchase_line_type"]
          purchase_id: string
          quantity: number
          unit_cost_usd: number
          unit_cost_usdt?: number | null
          variant_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          line_total_usd?: number
          line_type?: Database["public"]["Enums"]["purchase_line_type"]
          purchase_id?: string
          quantity?: number
          unit_cost_usd?: number
          unit_cost_usdt?: number | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "movement_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_payments: {
        Row: {
          account_id: string
          amount: number
          applied_rate: number | null
          bcv_eur_rate: number
          bcv_usd_rate: number
          binance_rate: number
          created_at: string
          created_by: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          is_backdated: boolean
          occurred_at: string
          purchase_id: string
          rate_kind: Database["public"]["Enums"]["supplier_rate_kind"]
          receipt_path: string | null
          usd_amount: number
          usd_usdt_rate: number
          usdt_value: number
        }
        Insert: {
          account_id: string
          amount: number
          applied_rate?: number | null
          bcv_eur_rate: number
          bcv_usd_rate: number
          binance_rate: number
          created_at?: string
          created_by?: string
          currency: Database["public"]["Enums"]["currency"]
          id?: string
          is_backdated?: boolean
          occurred_at: string
          purchase_id: string
          rate_kind: Database["public"]["Enums"]["supplier_rate_kind"]
          receipt_path?: string | null
          usd_amount: number
          usd_usdt_rate: number
          usdt_value: number
        }
        Update: {
          account_id?: string
          amount?: number
          applied_rate?: number | null
          bcv_eur_rate?: number
          bcv_usd_rate?: number
          binance_rate?: number
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          is_backdated?: boolean
          occurred_at?: string
          purchase_id?: string
          rate_kind?: Database["public"]["Enums"]["supplier_rate_kind"]
          receipt_path?: string | null
          usd_amount?: number
          usd_usdt_rate?: number
          usdt_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_payment_entries: {
        Row: {
          category_id: string
          ledger_entry_id: string
          purchase_id: string
          purchase_payment_id: string
        }
        Insert: {
          category_id: string
          ledger_entry_id: string
          purchase_id: string
          purchase_payment_id: string
        }
        Update: {
          category_id?: string
          ledger_entry_id?: string
          purchase_id?: string
          purchase_payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_payment_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "movement_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payment_entries_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payment_entries_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_payment_entries_purchase_payment_id_fkey"
            columns: ["purchase_payment_id"]
            isOneToOne: false
            referencedRelation: "purchase_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_voids: {
        Row: {
          created_at: string
          created_by: string
          purchase_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          purchase_id: string
          reason: string
        }
        Update: {
          created_at?: string
          created_by?: string
          purchase_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_voids_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_voids_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      product_recipe_lines: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity: number
          raw_product_id: string | null
          raw_variant_id: string | null
          size_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity: number
          raw_product_id?: string | null
          raw_variant_id?: string | null
          size_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity?: number
          raw_product_id?: string | null
          raw_variant_id?: string | null
          size_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_recipe_lines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_lines_raw_product_id_fkey"
            columns: ["raw_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_lines_raw_variant_id_fkey"
            columns: ["raw_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_lines_size_id_fkey"
            columns: ["size_id"]
            isOneToOne: false
            referencedRelation: "sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_recipe_lines_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      production_runs: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_backdated: boolean
          note: string | null
          occurred_at: string
          quantity: number
          sale_item_id: string | null
          unit_cost_usdt: number
          variant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          id?: string
          is_backdated?: boolean
          note?: string | null
          occurred_at?: string
          quantity: number
          sale_item_id?: string | null
          unit_cost_usdt: number
          variant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_backdated?: boolean
          note?: string | null
          occurred_at?: string
          quantity?: number
          sale_item_id?: string | null
          unit_cost_usdt?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_runs_sale_item_id_fkey"
            columns: ["sale_item_id"]
            isOneToOne: false
            referencedRelation: "sale_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_runs_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string
          created_by: string | null
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
          notes: string | null
          phone: string | null
          profile_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          notes?: string | null
          phone?: string | null
          profile_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_agreements: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: Database["public"]["Enums"]["currency"]
          effective_from: string
          frequency: Database["public"]["Enums"]["salary_frequency"]
          id: string
          notes: string | null
          team_member_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          currency: Database["public"]["Enums"]["currency"]
          effective_from: string
          frequency: Database["public"]["Enums"]["salary_frequency"]
          id?: string
          notes?: string | null
          team_member_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["currency"]
          effective_from?: string
          frequency?: Database["public"]["Enums"]["salary_frequency"]
          id?: string
          notes?: string | null
          team_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "salary_agreements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_agreements_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_entries: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          currency: Database["public"]["Enums"]["currency"]
          id: string
          kind: Database["public"]["Enums"]["payroll_entry_kind"]
          ledger_entry_id: string
          occurred_at: string
          period_label: string | null
          team_member_id: string
          usd_amount: number
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string
          currency: Database["public"]["Enums"]["currency"]
          id?: string
          kind: Database["public"]["Enums"]["payroll_entry_kind"]
          ledger_entry_id: string
          occurred_at: string
          period_label?: string | null
          team_member_id: string
          usd_amount: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          currency?: Database["public"]["Enums"]["currency"]
          id?: string
          kind?: Database["public"]["Enums"]["payroll_entry_kind"]
          ledger_entry_id?: string
          occurred_at?: string
          period_label?: string | null
          team_member_id?: string
          usd_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_advance_settlements: {
        Row: {
          advance_entry_id: string
          created_at: string
          payment_entry_id: string
        }
        Insert: {
          advance_entry_id: string
          created_at?: string
          payment_entry_id: string
        }
        Update: {
          advance_entry_id?: string
          created_at?: string
          payment_entry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_advance_settlements_advance_entry_id_fkey"
            columns: ["advance_entry_id"]
            isOneToOne: false
            referencedRelation: "payroll_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_advance_settlements_payment_entry_id_fkey"
            columns: ["payment_entry_id"]
            isOneToOne: false
            referencedRelation: "payroll_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      profit_policy: {
        Row: {
          id: boolean
          reinvestment_percent: number
          reserve_account_id: string | null
          reserve_percent: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          reinvestment_percent?: number
          reserve_account_id?: string | null
          reserve_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          reinvestment_percent?: number
          reserve_account_id?: string | null
          reserve_percent?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profit_policy_reserve_account_id_fkey"
            columns: ["reserve_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profit_policy_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_salary_agreements: {
        Row: {
          amount: number | null
          created_at: string | null
          created_by: string | null
          currency: Database["public"]["Enums"]["currency"] | null
          effective_from: string | null
          frequency: Database["public"]["Enums"]["salary_frequency"] | null
          id: string | null
          notes: string | null
          team_member_id: string | null
        }
        Relationships: []
      }
      pending_salary_advances: {
        Row: {
          amount: number | null
          created_at: string | null
          created_by: string | null
          currency: Database["public"]["Enums"]["currency"] | null
          id: string | null
          kind: Database["public"]["Enums"]["payroll_entry_kind"] | null
          ledger_entry_id: string | null
          occurred_at: string | null
          period_label: string | null
          team_member_id: string | null
          usd_amount: number | null
        }
        Relationships: []
      }
      purchases_summary: {
        Row: {
          balance_usd: number | null
          due_date: string | null
          is_voided: boolean | null
          number: number | null
          occurred_at: string | null
          paid_usd: number | null
          paid_usdt: number | null
          payment_status: string | null
          purchase_id: string | null
          supplier_id: string | null
          total_usd: number | null
        }
        Relationships: []
      }
      payables: {
        Row: {
          balance_usd: number | null
          days_overdue: number | null
          due_date: string | null
          number: number | null
          occurred_at: string | null
          purchase_id: string | null
          supplier_id: string | null
          supplier_name: string | null
          total_usd: number | null
        }
        Relationships: []
      }
      receivables: {
        Row: {
          balance_usd: number | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          days_outstanding: number | null
          number: number | null
          occurred_at: string | null
          sale_id: string | null
          total_usd: number | null
        }
        Relationships: []
      }
      sales_summary: {
        Row: {
          balance_usd: number | null
          channel: Database["public"]["Enums"]["sale_channel"] | null
          collected_usdt: number | null
          customer_id: string | null
          is_voided: boolean | null
          number: number | null
          occurred_at: string | null
          paid_usd: number | null
          payment_status: string | null
          sale_id: string | null
          total_usd: number | null
        }
        Relationships: []
      }
      sale_item_current_status: {
        Row: {
          sale_item_id: string | null
          status: Database["public"]["Enums"]["sale_item_status"] | null
          status_at: string | null
        }
        Relationships: []
      }
      sales_daily_totals: {
        Row: {
          balance_usd: number | null
          collected_usdt: number | null
          paid_usd: number | null
          sale_date: string | null
          sales_count: number | null
          total_usd: number | null
        }
        Relationships: []
      }

      stock_balances: {
        Row: {
          is_low: boolean | null
          last_movement_at: string | null
          min_stock: number | null
          product_id: string | null
          quantity: number | null
          sku: string | null
          variant_id: string | null
        }
        Relationships: []
      }
      account_balances: {
        Row: {
          account_id: string | null
          balance: number | null
          currency: Database["public"]["Enums"]["currency"] | null
          entries_count: number | null
          is_active: boolean | null
          kind: Database["public"]["Enums"]["account_kind"] | null
          last_movement_at: string | null
          name: string | null
        }
        Relationships: []
      }
      current_exchange_rate: {
        Row: {
          bcv_eur: number | null
          bcv_usd: number | null
          binance_usdt: number | null
          created_at: string | null
          created_by: string | null
          id: string | null
          note: string | null
          rate_date: string | null
          source: Database["public"]["Enums"]["rate_source"] | null
          usd_usdt: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      cash_flow_by_account: {
        Args: { p_from: string; p_to: string }
        Returns: {
          account_id: string
          closing: number
          currency: Database["public"]["Enums"]["currency"]
          inflows: number
          inflows_usdt: number
          is_active: boolean
          name: string
          opening: number
          outflows: number
          outflows_usdt: number
        }[]
      }
      exchange_rate_effect: {
        Args: { p_from: string; p_to: string }
        Returns: {
          difference_usdt: number
          method_name: string
          nominal_usdt: number
          payments_count: number
          real_usdt: number
          source: string
        }[]
      }
      product_sales_margin: {
        Args: { p_from: string; p_to: string }
        Returns: {
          labor_cost_usdt: number
          lines_without_cost: number
          margin_usdt: number
          material_cost_usdt: number
          product_id: string
          product_name: string
          revenue_usd: number
          revenue_usdt: number
          units: number
        }[]
      }
      reserve_activity: {
        Args: { p_from: string; p_to: string }
        Returns: { account_id: string; account_name: string; balance_usdt: number; transferred_usdt: number }[]
      }
      register_salary_advance: {
        Args: {
          p_account_id: string
          p_amount: number
          p_note?: string
          p_occurred_at?: string
          p_receipt_path?: string
          p_team_member_id: string
        }
        Returns: string
      }
      register_salary_payment: {
        Args: {
          p_account_id: string
          p_amount: number
          p_note?: string
          p_occurred_at?: string
          p_period_label?: string
          p_receipt_path?: string
          p_settle_advance_ids?: string[]
          p_team_member_id: string
        }
        Returns: string
      }
      product_margins: {
        Args: never
        Returns: {
          cost_source: string | null
          labor_cost_usdt: number
          margin_percent: number | null
          margin_usdt: number | null
          material_cost_usdt: number | null
          method_name: string
          payment_method_id: string
          price_usd: number
          price_usdt: number
          product_id: string
          product_name: string
          sku: string
          variant_id: string
        }[]
      }
      recipe_requirements: {
        Args: { p_quantity: number; p_strict?: boolean; p_variant_id: string }
        Returns: { quantity: number; raw_variant_id: string | null; unit_cost_usdt: number | null }[]
      }
      register_production: {
        Args: {
          p_note?: string
          p_occurred_at?: string
          p_quantity: number
          p_unit_cost_usdt?: number
          p_variant_id: string
        }
        Returns: string
      }
      add_purchase_payment: {
        Args: {
          p_account_id: string
          p_amount: number
          p_occurred_at?: string
          p_purchase_id: string
          p_rate_kind?: Database["public"]["Enums"]["supplier_rate_kind"]
          p_receipt_path?: string
        }
        Returns: string
      }
      create_purchase: {
        Args: {
          p_due_date?: string
          p_items: Json
          p_notes?: string
          p_occurred_at?: string
          p_payments?: Json
          p_receipt_path?: string
          p_supplier_id: string
        }
        Returns: string
      }
      void_purchase: { Args: { p_purchase_id: string; p_reason: string }; Returns: undefined }
      exchange_rate_for_date: {
        Args: { p_date: string }
        Returns: Database["public"]["Tables"]["exchange_rates"]["Row"]
      }
      add_sale_payment: {
        Args: {
          p_amount: number
          p_occurred_at?: string
          p_payment_method_id: string
          p_receipt_path?: string
          p_sale_id: string
        }
        Returns: string
      }
      create_sale: {
        Args: {
          p_channel: Database["public"]["Enums"]["sale_channel"]
          p_customer_id?: string
          p_delivered?: boolean
          p_delivery_fee_usd?: number
          p_delivery_method: Database["public"]["Enums"]["delivery_method"]
          p_discount_reason?: string
          p_discount_type?: Database["public"]["Enums"]["discount_type"]
          p_discount_value?: number
          p_items: Json
          p_notes?: string
          p_occurred_at?: string
          p_payments?: Json
          p_price_method_id: string
        }
        Returns: string
      }
      set_sale_item_status: {
        Args: {
          p_note?: string
          p_sale_item_id: string
          p_status: Database["public"]["Enums"]["sale_item_status"]
        }
        Returns: undefined
      }
      void_sale: { Args: { p_reason: string; p_sale_id: string }; Returns: undefined }
      analytics_ledger_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          category_name: string
          category_type: Database["public"]["Enums"]["category_type"]
          month: string
          person_name: string | null
          usdt_value: number
        }[]
      }
      can_request_login_code: { Args: { p_email: string }; Returns: boolean }
      caracas_today: { Args: never; Returns: string }
      category_type_requires_person: {
        Args: { p_type: Database["public"]["Enums"]["category_type"] }
        Returns: boolean
      }
      category_type_staff_allowed: {
        Args: { p_type: Database["public"]["Enums"]["category_type"] }
        Returns: boolean
      }
      create_account_transfer: {
        Args: {
          p_amount_in: number
          p_amount_out: number
          p_bcv_usd_rate?: number
          p_binance_rate?: number
          p_from_account_id: string
          p_note?: string
          p_occurred_at?: string
          p_receipt_path?: string
          p_to_account_id: string
          p_usd_usdt_rate?: number
        }
        Returns: string
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      exchange_rate_exists_for: { Args: { p_date: string }; Returns: boolean }
      from_usdt: {
        Args: {
          p_binance_rate: number
          p_currency: Database["public"]["Enums"]["currency"]
          p_usd_usdt_rate: number
          p_usdt: number
        }
        Returns: number
      }
      has_role: {
        Args: { allowed: Database["public"]["Enums"]["app_role"][] }
        Returns: boolean
      }
      load_initial_stock: { Args: { p_rows: Json }; Returns: number }
      set_customer_id_document: {
        Args: { p_customer_id: string; p_id_document: string | null }
        Returns: undefined
      }
      is_own_ledger_entry: { Args: { p_entry_id: string }; Returns: boolean }
      my_category_usage: {
        Args: never
        Returns: {
          category_id: string
          last_used_at: string
          uses: number
        }[]
      }
      reverse_account_transfer: {
        Args: { p_reason: string; p_transfer_id: string }
        Returns: undefined
      }
      reverse_ledger_entry: {
        Args: { p_entry_id: string; p_reason: string }
        Returns: string
      }
      staff_can_use_category: {
        Args: { p_category_id: string }
        Returns: boolean
      }
      to_usdt: {
        Args: {
          p_amount: number
          p_binance_rate: number
          p_currency: Database["public"]["Enums"]["currency"]
          p_usd_usdt_rate: number
        }
        Returns: number
      }
    }
    Enums: {
      delivery_method: "pickup" | "delivery"
      discount_type: "amount" | "percent"
      payment_rate_kind: "bcv_usd" | "bcv_eur" | "none"
      sale_channel: "in_person" | "whatsapp" | "instagram" | "online_store"
      sale_item_status: "to_produce" | "in_production" | "ready" | "delivered"
      sale_line_source: "stock" | "made_to_order"
      account_kind: "bank" | "cash" | "zelle" | "crypto_wallet"
      app_role: "owner" | "admin" | "staff"
      category_scope: "business" | "personal"
      category_type:
        | "sales"
        | "other_income"
        | "capital_contribution"
        | "cost"
        | "operating_expense"
        | "exchange_fee"
        | "tax"
        | "salary"
        | "withdrawal"
        | "reinvestment"
        | "profit_distribution"
      currency: "VES" | "USD" | "USDT"
      rate_source: "api" | "manual"
      fulfillment_type: "stock" | "made_to_order" | "both"
      product_closure: "snap" | "zipper" | "buttons"
      product_fit: "jogger" | "straight"
      product_gender: "women" | "men" | "unisex"
      product_kind: "finished_good" | "raw_material"
      product_unit: "unit" | "meter" | "kg"
      stock_movement_type:
        | "initial_count"
        | "purchase"
        | "production"
        | "adjustment"
        | "sale"
        | "sale_reversal"
        | "purchase_reversal"
        | "consumption"
      ledger_entry_type:
        | "income"
        | "expense"
        | "sale_payment"
        | "transfer_out"
        | "transfer_in"
        | "exchange_fee"
        | "purchase_payment"
      supplier_rate_kind: "bcv_usd" | "parallel" | "none"
      purchase_line_type: "inventory" | "concept"
      salary_frequency: "weekly" | "biweekly" | "monthly"
      payroll_entry_kind: "payment" | "advance"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"]
export type Views<T extends keyof PublicSchema["Views"]> =
  PublicSchema["Views"][T]["Row"]
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T]

export const Constants = {
  public: {
    Enums: {
      delivery_method: ["pickup", "delivery"],
      discount_type: ["amount", "percent"],
      payment_rate_kind: ["bcv_usd", "bcv_eur", "none"],
      sale_channel: ["in_person", "whatsapp", "instagram", "online_store"],
      sale_item_status: ["to_produce", "in_production", "ready", "delivered"],
      sale_line_source: ["stock", "made_to_order"],
      account_kind: ["bank", "cash", "zelle", "crypto_wallet"],
      app_role: ["owner", "admin", "staff"],
      category_scope: ["business", "personal"],
      category_type: [
        "sales",
        "other_income",
        "capital_contribution",
        "cost",
        "operating_expense",
        "exchange_fee",
        "tax",
        "salary",
        "withdrawal",
        "reinvestment",
        "profit_distribution",
      ],
      currency: ["VES", "USD", "USDT"],
      rate_source: ["api", "manual"],
      fulfillment_type: ["stock", "made_to_order", "both"],
      product_closure: ["snap", "zipper", "buttons"],
      product_fit: ["jogger", "straight"],
      product_gender: ["women", "men", "unisex"],
      product_kind: ["finished_good", "raw_material"],
      product_unit: ["unit", "meter", "kg"],
      stock_movement_type: [
        "initial_count",
        "purchase",
        "production",
        "adjustment",
        "sale",
        "sale_reversal",
        "purchase_reversal",
        "consumption",
      ],
      ledger_entry_type: [
        "income",
        "expense",
        "sale_payment",
        "transfer_out",
        "transfer_in",
        "exchange_fee",
        "purchase_payment",
      ],
      supplier_rate_kind: ["bcv_usd", "parallel", "none"],
      purchase_line_type: ["inventory", "concept"],
      salary_frequency: ["weekly", "biweekly", "monthly"],
      payroll_entry_kind: ["payment", "advance"],
    },
  },
} as const
