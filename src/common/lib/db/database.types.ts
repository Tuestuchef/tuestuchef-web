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
    }
    Views: {
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
