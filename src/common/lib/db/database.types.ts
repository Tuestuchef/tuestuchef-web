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
    }
    Views: {
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
      ledger_entry_type:
        | "income"
        | "expense"
        | "sale_payment"
        | "transfer_out"
        | "transfer_in"
        | "exchange_fee"
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
      stock_movement_type: ["initial_count", "purchase", "production", "adjustment", "sale", "sale_reversal"],
      ledger_entry_type: [
        "income",
        "expense",
        "sale_payment",
        "transfer_out",
        "transfer_in",
        "exchange_fee",
      ],
    },
  },
} as const
